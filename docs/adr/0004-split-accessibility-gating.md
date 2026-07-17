# 4. Accessibility gating is split: mechanical checks auto-gated, real-browser axe in CI, manual walkthrough review-gated

## Status

Accepted

Recorded inline as ADR-4 in `docs/ROADMAP.md` §6 during the M0–M4 build; migrated
to this file 2026-07-17. The decision content is unchanged.

## Context

Accessibility is a launch property of this product, not a polish item. But the
checks that can run on every merge differ in kind: some are mechanical and
dependency-free, some need a real browser, and some need a human with a screen
reader. Collapsing those into one claim ("the a11y gate is green, therefore the
site is accessible") would overstate what automation measures — automated
checking covers only roughly 30–40% of WCAG.

## Decision

Three layers, each labeled as what it is:

1. **`make a11y`** (`scripts/a11y-lint.ts`) enforces a mechanical WCAG subset
   (structure, labels, contrast) with no headless browser — dependency-free and
   fast, so it runs in the local merge-blocking pipeline.
2. **Real-browser pa11y/axe** runs in CI (`.pa11yci.json`), plus Lighthouse CI
   with an a11y score floor.
3. **The manual screen-reader/keyboard/zoom walkthrough is review-gated** in
   `docs/audits/accessibility-*.md` — a dated human artifact, never simulated.

**Rejected:** claiming the static linter equals axe — the standard itself says
automation covers only a minority of WCAG.

## Consequences

- The local loop stays fast and dependency-free; the browser truth runs in CI.
- The manual walkthrough is a standing human gate. Its artifact is dated
  2026-05-31 and staleness-flagged: the save/resume panel and offline controls
  shipped after it and are explicitly listed as PENDING walkthrough rows.
- Any new UI surface widens the PENDING list rather than silently inheriting the
  old walkthrough's conclusions.
