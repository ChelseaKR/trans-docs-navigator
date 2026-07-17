# 6. No ESLint, no Prettier, no bundler — a recorded deviation from the code-quality standard

## Status

Accepted (2026-07-17)

This is a new record, not a migration: the stance has been in force since the M0
build, was called out as an open item in the 2026-07-05 audit (CQ-14/15/18,
CQ-44/46), and is written down here so it is a decision rather than an omission.

## Context

The portfolio's code-quality standard names ESLint (flat config) and Prettier as
the default lint/format pair for TypeScript repos, and has rules for bundler
configuration. This repo's threat model and posture pull the other way: it ships
with **zero production npm dependencies**, no build step (ADR-0005), and a
deliberately small dev-dependency set (`typescript`, `@playwright/test`,
`stylelint` + `stylelint-use-logical`, `js-yaml`, `@types/node`). Every
additional dev tool is supply-chain surface, version churn, and configuration
drift on a repo whose credibility rests on being fully auditable.

## Decision

- **No ESLint, no Prettier, no bundler.** The gap is covered by compensating
  controls, each merge-blocking:
  - `tsc --strict` plus all 7 beyond-strict flags (`tsconfig.json`) — the
    correctness half of what ESLint would catch.
  - `scripts/lint.ts` — a dependency-free gate for the highest-value hygiene
    rules: no `debugger`, no `console.log`/`console.debug` in app code (the
    allowlist logger `api/log.ts` is the only console user), no TODO without a
    linked issue.
  - Coverage floors (90/85/90 lines/branches/functions) via
    `scripts/run-tests.ts`.
  - `stylelint-use-logical` for the G10 logical-CSS gate — the one place a
    dedicated linter earns its dependency, because no in-house script would be
    credible for it.
- **Formatting is not machine-enforced.** Style consistency relies on review;
  there is no formatter whose output would be misrepresented as a gate.

**Rejected:** adopting ESLint flat config + Prettier for standard-conformance's
own sake — it would add the largest dev-dependency graph in the repo to
re-detect a subset of what `tsc`'s beyond-strict flags already block.

## Consequences

- The CQ-14/15/18 rows of the standard are deviations by decision, recorded
  here; the README conformance table points at this file instead of claiming the
  tools exist.
- **Known limit, still open:** `scripts/lint.ts` walks only `api/` and `src/` —
  `scripts/`, `tests/`, and `eval/` are not lint-covered, and there is no
  FIXME/HACK or unexplained-`@ts-expect-error` pattern check yet. Extending the
  script's scope is tracked in the 2026-07-06 roadmap (§3.4) and is the intended
  path — the answer to a lint gap in this repo is widening the dependency-free
  gate, not importing a toolchain.
- If the production Next.js port (ROADMAP §6) ever lands, this decision must be
  revisited: a framework build step changes the cost/benefit and would get a new
  ADR, not an edit to this one.
