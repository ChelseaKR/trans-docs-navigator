// Embedding-based retriever (the production seam from ROADMAP §6 / ADR-2). It implements
// the SAME `Retriever` signature as the lexical retriever and applies the IDENTICAL
// mandatory structured filter (filterByQuery), then ranks the survivors by vector
// similarity instead of raw token overlap.
//
// The embedding here is a deterministic, dependency-free local model: a hashed
// bag-of-words + character-trigram vector with cosine similarity. It needs no external
// infra, so it runs in CI and tests. The production deploy swaps `embed()` for a real
// sentence-embedding model and the linear scan for a pgvector/OpenSearch ANN index —
// behind this exact interface, so nothing downstream (guidance, citation gate) changes.
// The lexical retriever stays the DEFAULT because it is the most reproducible for eval.

import type { CorpusRecord, Language } from "./types.ts";
import { loadCorpus } from "./corpus.ts";
import { isCurrent } from "./freshness.ts";
import { filterByQuery, tokensFor, rankStable } from "./retrieval.ts";
import type { RetrievalQuery, Retrieved, Retriever } from "./retrieval.ts";

// Larger space + separate offsets for word vs sub-word features so common domain terms
// (e.g. "marker" vs "order") don't collide, and word signal isn't drowned by trigrams.
const DIM = 4096;
const WORD_SPACE = 2048; // [0, 2048) for word features
const GRAM_SPACE = DIM - WORD_SPACE; // [2048, 4096) for trigram features

function fnv(s: string, seed: number): number {
  let h = seed >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function wordBucket(s: string): number {
  return fnv(s, 2166136261) % WORD_SPACE;
}
function gramBucket(s: string): number {
  return WORD_SPACE + (fnv(s, 0x811c9dc5 ^ 0x5bd1e995) % GRAM_SPACE);
}

function trigrams(token: string): string[] {
  const t = `#${token}#`;
  const out: string[] = [];
  for (let i = 0; i < t.length - 2; i++) out.push(t.slice(i, i + 3));
  return out;
}

/** Deterministic local embedding: hashed bag-of-words + char trigrams, L2-normalized. */
export function embed(text: string, language: Language = "en"): Float64Array {
  const v = new Float64Array(DIM);
  const bump = (i: number, w: number) => { v[i] = v[i]! + w; };
  for (const tok of tokensFor(text, language)) {
    bump(wordBucket(tok), 1); // word feature
    for (const g of trigrams(tok)) bump(gramBucket(g), 0.5); // sub-word feature (typo robustness)
  }
  let norm = 0;
  for (const x of v) norm += x * x;
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < DIM; i++) v[i]! /= norm;
  return v;
}

function cosine(a: Float64Array, b: Float64Array): number {
  let dot = 0;
  for (let i = 0; i < DIM; i++) dot += a[i]! * b[i]!;
  return dot; // both already unit-normalized
}

function recordText(rec: CorpusRecord): string {
  return `${rec.topic} ${rec.statement} ${rec.detail ?? ""}`;
}

export const embeddingRetrieve: Retriever = (query: RetrievalQuery, corpus = loadCorpus()): Retrieved[] => {
  const language: Language = query.language ?? "en";
  const filtered = filterByQuery(query, corpus);
  const qVec = query.question ? embed(query.question, language) : null;

  const scored = filtered.map((record): Retrieved => {
    let score = 1; // base: passed the structured filter
    if (qVec) score += cosine(qVec, embed(recordText(record), language)) * 4; // similarity-weighted
    return { record, score, current: isCurrent(record, query.today) };
  });
  return rankStable(scored);
};
