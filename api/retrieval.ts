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
  /** True when the query is about someone under 18 (minors pilot). See `selectAudience`. */
  for_minor?: boolean;
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
 * Audience exclusivity (minors pilot, api/types.ts `RecordAudience`). Within a
 * (jurisdiction × document_type) pair, a minor query must see ONLY the minor-audience
 * record when one exists — never the adult record alongside or instead of it, which is
 * the "adult records must not be retrieved for a minor query where a minor record exists"
 * guarantee — and a non-minor query must never see a minor-audience record at all.
 *
 * When `forMinor` is true and NO minor record exists for a given jurisdiction × document
 * pair (every state outside the five-state pilot, and every document type this pilot does
 * not yet cover even inside it), the adult/general record is returned UNCHANGED — this is
 * the deliberate, disclosed fallback ("the steps below are for adults and may not apply"),
 * not a silent one. The disclosure itself is api/checklist.ts `hasNoMinorCoverage` +
 * the `ui.noMinorCoverage` copy, rendered by the caller; this function only decides which
 * records are eligible to be shown at all.
 */
export function selectAudience(records: CorpusRecord[], forMinor: boolean): CorpusRecord[] {
  if (!forMinor) return records.filter((r) => r.audience !== "minor");
  const minorCells = new Set(
    records.filter((r) => r.audience === "minor").map((r) => `${r.jurisdiction}|${r.document_type}`),
  );
  return records.filter((r) => {
    const cell = `${r.jurisdiction}|${r.document_type}`;
    return minorCells.has(cell) ? r.audience === "minor" : r.audience !== "minor";
  });
}

/**
 * The mandatory STRUCTURED filter every retriever must apply first: jurisdiction (+ federal),
 * change type, document, language, audience. Scoring/ranking is what differs between
 * retrievers; this gate is shared so no retriever can widen the candidate set beyond what's
 * permitted.
 */
export function filterByQuery(query: RetrievalQuery, corpus: CorpusRecord[]): CorpusRecord[] {
  const language: Language = query.language ?? "en";
  const structural = corpus.filter((rec) => {
    if (rec.language !== language) return false;
    if (!jurisdictionMatches(rec, query.jurisdiction)) return false;
    if (!rec.change_type.some((c) => query.change_types.includes(c))) return false;
    if (query.documents && query.documents.length > 0 && !query.documents.includes(rec.document_type)) return false;
    return true;
  });
  return selectAudience(structural, query.for_minor === true);
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
