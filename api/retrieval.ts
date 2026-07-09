// Retrieval. Generation is retrieval-mandatory (ROADMAP §6 / guardrail #1): the
// generator only ever sees records returned here.
//
// This implementation is a deterministic lexical retriever (token-overlap scoring)
// filtered by jurisdiction + change type + document. It is the seam where a
// production deploy swaps in pgvector/OpenSearch embeddings (ADR-1 in ROADMAP).
// Determinism is a feature: it makes the eval reproducible (eval-harness guardrail).

import type {
  CorpusRecord,
  JurisdictionId,
  ChangeType,
  DocumentType,
  Language,
} from "./types.ts";
import { loadCorpus } from "./corpus.ts";
import { isCurrent } from "./freshness.ts";

const STOP: Record<Language, Set<string>> = {
  en: new Set([
    "the", "a", "an", "to", "of", "in", "for", "and", "or", "is", "are", "do", "i",
    "my", "how", "what", "can", "with", "on", "at", "it", "be", "need", "change",
  ]),
  es: new Set([
    "el", "la", "los", "las", "un", "una", "de", "del", "a", "en", "para", "por", "y",
    "o", "es", "son", "mi", "como", "qué", "que", "puedo", "con", "se", "cambiar",
    "cambio", "necesito", "cómo",
  ]),
};

/** Defense-in-depth: bound the text fed to tokenization even if a caller skipped it. */
const MAX_TOKENIZE_LEN = 2000;

function tokenize(s: string, language: Language = "en"): string[] {
  const stop = STOP[language];
  return s
    .slice(0, MAX_TOKENIZE_LEN)
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúüñ\s]/gi, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !stop.has(t));
}

export interface RetrievalQuery {
  jurisdiction: JurisdictionId;
  change_types: ChangeType[];
  /** Optional document filter; when omitted, all relevant documents are considered. */
  documents?: DocumentType[];
  /** Optional free-text question to rank within the filtered set. */
  question?: string | undefined;
  /** Language to serve; defaults to English. */
  language?: Language;
  today?: string | undefined;
}

export interface Retrieved {
  record: CorpusRecord;
  score: number;
  /** True when the record passes the freshness check and may be served as fact. */
  current: boolean;
}

/** A retriever is any function with this shape; the production embedding store plugs in here. */
export type Retriever = (query: RetrievalQuery, corpus?: CorpusRecord[]) => Retrieved[];

/**
 * Federal records (jurisdiction "US") apply within every state, so a state query
 * always also pulls the matching federal records.
 */
function jurisdictionMatches(rec: CorpusRecord, j: JurisdictionId): boolean {
  return rec.jurisdiction === j || rec.jurisdiction === "US";
}

/**
 * The mandatory STRUCTURED filter every retriever must apply first: jurisdiction (+ federal),
 * change type, document, language. Scoring/ranking is what differs between retrievers; this
 * gate is shared so no retriever can widen the candidate set beyond what's permitted.
 */
export function filterByQuery(query: RetrievalQuery, corpus: CorpusRecord[]): CorpusRecord[] {
  const language: Language = query.language ?? "en";
  return corpus.filter((rec) => {
    if (rec.language !== language) return false;
    if (!jurisdictionMatches(rec, query.jurisdiction)) return false;
    if (!rec.change_type.some((c) => query.change_types.includes(c))) return false;
    if (query.documents && query.documents.length > 0 && !query.documents.includes(rec.document_type)) return false;
    return true;
  });
}

/** Tokenize externally (language-aware) — reused by alternate retrievers. */
export function tokensFor(text: string, language: Language = "en"): string[] {
  return tokenize(text, language);
}

export const retrieve: Retriever = (query, corpus = loadCorpus()): Retrieved[] => {
  const { question, today } = query;
  const language: Language = query.language ?? "en";
  const qTokens = question ? tokenize(question, language) : [];

  const filtered = filterByQuery(query, corpus);

  const scored = filtered.map((record): Retrieved => {
    let score = 1; // base score: it matched the structured filter
    if (qTokens.length > 0) {
      const hay = new Set(tokenize(`${record.topic} ${record.statement} ${record.detail ?? ""}`, language));
      const overlap = qTokens.filter((t) => hay.has(t)).length;
      score += overlap * 2;
    }
    return { record, score, current: isCurrent(record, today) };
  });

  // Deterministic ordering: score desc, then current-first, then id for stability.
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.current !== b.current) return a.current ? -1 : 1;
    return a.record.id.localeCompare(b.record.id);
  });

  return scored;
};

/** Stable ordering shared by retrievers: score desc, current-first, id for determinism. */
export function rankStable(scored: Retrieved[]): Retrieved[] {
  return [...scored].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.current !== b.current) return a.current ? -1 : 1;
    return a.record.id.localeCompare(b.record.id);
  });
}
