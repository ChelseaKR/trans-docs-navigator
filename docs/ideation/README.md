# Ideation — Large-Scale Fixes & Expansions

> **Drafted 2026-07-01.** This folder is a structured ideation pass over the repo as it
> actually exists on `main` (through PR #37) plus the unmerged research branches. It
> proposes deep structural fixes and expansion bets that the existing planning documents
> do **not** already contain. Everything here is an **idea for evaluation, not a
> commitment** — nothing in this folder is scheduled, resourced, or approved, and
> nothing here weakens an open review gate.

## How this relates to the existing documents

This repo already has an unusually complete planning stack. This folder deliberately
does not restate it:

- [`docs/ROADMAP.md`](../ROADMAP.md) — the original buildable spec (M0–M6, ADRs 1–5).
- [`docs/RESEARCH-ROADMAP.md`](../RESEARCH-ROADMAP.md) + [`docs/USER-RESEARCH.md`](../USER-RESEARCH.md)
  — the 2026-06-30 synthetic-stakeholder pass (items **R1–R12**, **E1–E9**). **Note:**
  as of 2026-07-01 these two files live on the unmerged `research-panel-and-roadmap`
  branch, not on `main` — see FIX-01 in [`02-large-scale-fixes.md`](./02-large-scale-fixes.md).
- [`docs/IMPROVEMENT-PLAN.md`](../IMPROVEMENT-PLAN.md) / [`-2.md`](../IMPROVEMENT-PLAN-2.md)
  — the honest-confidence audit and hardening rounds (§0–§7, A–E).
- [`docs/PRODUCTIONIZATION-PLAN.md`](../PRODUCTIONIZATION-PLAN.md) — deploy/ops phases 1–6.
- [`docs/SEO-PLAN.md`](../SEO-PLAN.md), [`docs/I18N.md`](../I18N.md) — findability and i18n gates.

When an idea here builds on an existing item, it cites that item by ID
(e.g. "builds on R1", "goes beyond IMPROVEMENT-PLAN §1.3") and states what is new.
Where those documents already sequence something, they remain the source of truth.

## Standing constraints every idea honors

1. **Counsel/UPL gate.** Any idea that touches legal content, legal framing, or how
   legal facts are presented is flagged **[counsel-gated]** and cannot ship without
   counsel review (STATUS open gate; IMPROVEMENT-PLAN-2 A1).
2. **Named-human verification gate.** No corpus fact is launch-real until a named human
   verifies it (ADR-3; R1). Ideas that widen content are gated on verification capacity.
3. **Privacy outranks features.** The hostile-jurisdiction threat model
   (RESPONSIBLE-TECH-AUDITS §C) vetoes any idea that adds server-side state, contact
   info, or new data flows. Several ideas below exist specifically to *strengthen* it.
4. **Honesty as a feature.** Deferred work is reported as deferred; synthetic inputs are
   labeled synthetic; green checks must be earnable, not decorative.

## Contents

| File | What it holds |
|---|---|
| [`01-deep-dive.md`](./01-deep-dive.md) | Current-state assessment from a fresh full read of the code, CI, corpus, and docs — including debt not recorded anywhere else. |
| [`02-large-scale-fixes.md`](./02-large-scale-fixes.md) | **FIX-01…FIX-12** — deep structural fixes with effort tiers, risks, and measurable excellence bars. |
| [`03-expansions.md`](./03-expansions.md) | **EXP-01…EXP-16** — expansion ideas in three horizons (deepen core / adjacent / transformative bets). |
| [`04-impact-and-sequencing.md`](./04-impact-and-sequencing.md) | Impact×effort matrix over all IDs, dependencies, a Now/Next/Later sequence beyond the existing roadmaps, and the honest list of human-gated items. |

## Honest limits

These ideas come from one deep read (2026-07-01) by an AI assistant, grounded in file
paths and observed behavior but **not** validated with real users, counsel, or partner
orgs. Impact estimates for at-risk users are hypotheses; the project's own research
docs say plainly that synthetic findings are not demand signals, and that applies to
this folder too. Anything here that survives evaluation should enter the normal
planning documents with an owner and a gate — this folder is upstream of that, not a
substitute for it.
