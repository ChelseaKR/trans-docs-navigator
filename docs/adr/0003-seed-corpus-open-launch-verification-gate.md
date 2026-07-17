# 3. The corpus is illustrative seed data; launch verification is an explicit, open review gate

## Status

Accepted

Recorded inline as ADR-3 in `docs/ROADMAP.md` §6 during the M0–M4 build; migrated
to this file 2026-07-17. The decision content is unchanged. The gate this record
describes is still open: no jurisdiction is launch-cleared as of the migration
date.

## Context

The mechanical gates (schema, citation, freshness, source fidelity, eval) run
green on the seed corpus — but green gates prove internal consistency, not legal
correctness. The `verifier` fields are placeholders, and the gold set was
co-authored with the corpus, so eval accuracy is partly tautological
(`eval/gold.provenance.json` makes that machine-readable). For an audience that
may act on this information in hostile jurisdictions, shipping seed data as
verified fact would be the worst failure mode this project can have.

## Decision

Launch verification is an explicit review gate, separate from and above the
mechanical pipeline:

- No jurisdiction is `launch_cleared` until every serving record has a **named
  human verifier** listed in `corpus/VERIFIERS.json`, the gold set has an
  independent author, and counsel has reviewed the legal copy.
- The gate's status is machine-derived on every `make verify` run
  (`make launch-gates`), so the open state cannot silently drift into a claimed
  closed one.
- See `docs/audits/data-card.md` and `docs/STATUS.md` for the current state.

**Rejected:** fabricating named human verifiers — dishonest and unsafe.

## Consequences

- The public framing stays "demonstration/preview" until the first jurisdiction
  genuinely clears — the README says so.
- Records the humans have not confirmed serve in an honestly-degraded state
  ("needs reverification") rather than as current fact.
- Content expansion is gated on verification capacity, not enthusiasm: an
  unverified state is worse than an honest gap.
- Keeping this gate open is a decision, not a defect; closing it is human work
  that no automated pass may simulate.
