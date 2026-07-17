# 5. The reference build is TypeScript on Node's native type-stripping — no build step, not Next.js

## Status

Accepted

Recorded inline as ADR-5 in `docs/ROADMAP.md` §6 during the M0–M4 build; migrated
to this file 2026-07-17. The decision content is unchanged.

## Context

ROADMAP §6 specifies a Next.js PWA as the production shape. For the reference
build, the goal was a runnable, fully-tested, accessible, server-rendered PWA
shell whose every gate closes end-to-end — and the safety-critical logic
(retrieval, citation enforcement, freshness, logging) lives in `api/`, not in a
framework.

## Decision

The stack is TypeScript executed via Node's native type-stripping
(`node --experimental-strip-types`), server-rendered on plain `node:http`, with
**zero production npm dependencies and no build step**. `pdf-lib` is vendored
client-side (SRI-pinned), not a server dependency.

**Rejected:** a full Next.js app — heavy to make `make verify`-green end-to-end
in one pass, and the safety-critical logic lives in `api/`, which is
framework-agnostic and ports directly.

## Consequences

- What is committed is what runs: no bundler output to audit, a minimal
  supply-chain surface for a threat model that assumes hostile scrutiny.
- The reference build does not satisfy M4's field-mapped PDF-fill done-condition;
  the on-device copy helper plus authoritative form links is the shipped state.
- The Next.js PWA remains the stated production target in ROADMAP §6; the `api/`
  engine is the part designed to survive that port unchanged.
- Toolchain consequences of the same stance (no ESLint/Prettier/bundler) are
  recorded separately in ADR-0006.
