# 2. Retrieval is a deterministic lexical filter in the reference build

## Status

Accepted

Recorded inline as ADR-2 in `docs/ROADMAP.md` §6 during the M0–M4 build; migrated
to this file 2026-07-17. The decision content is unchanged.

## Context

Generation is retrieval-mandatory (ADR-1), so retrieval sits on the safety path.
Standing up a vector store (pgvector/OpenSearch) for a corpus of a few dozen
records would add infrastructure and operational surface without changing the
safety contract, and would make retrieval behavior harder to reproduce in tests.

## Decision

`api/retrieval.ts` filters by jurisdiction + change-type + document + language
(a mandatory structured filter, not a similarity heuristic) and ranks the
survivors by token overlap. The embedding store from ROADMAP §6 plugs in behind
the same `retrieve()` signature.

**Rejected:** standing up a vector DB for the reference build — infrastructure
without a change to the safety contract.

## Consequences

- Retrieval is deterministic, so the eval (and the retrieval-quality metrics
  added 2026-07-05: context recall@8 ≥ 0.80, precision@1 ≥ 0.70, both
  merge-blocking) measures a stable system rather than an index's day-to-day
  drift.
- Lexical token overlap has no IDF or field weighting; ranking quality degrades
  as the corpus scales and is weaker for Spanish. This is an accepted limit of
  the reference build, tracked in `docs/IMPROVEMENT-PLAN.md`.
- The seam has since been exercised: `api/embedding-retrieval.ts` implements the
  same `Retriever` signature with a deterministic, dependency-free local
  embedding and the identical mandatory structured filter. The lexical retriever
  remains the default; any swap must pass the same merge-blocking
  retrieval-quality gates.
