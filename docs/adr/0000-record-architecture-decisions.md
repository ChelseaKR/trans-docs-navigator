# 0. Record architecture decisions

## Status

Accepted

## Context

trans-docs-navigator makes a small number of consequential, hard-to-reverse
decisions — how retrieval stays deterministic, why no claim renders without a
citation, why the reference build runs on Node's native type-stripping with zero
runtime dependencies, how the corpus is quarantined and launch-review-gated. This
repo serves a sensitive population, so the reasoning behind a safety-relevant
structural choice must not live only in a commit message or a closed PR thread,
or a later change will either re-litigate a settled question or unknowingly
reverse a decision made for a reason nobody re-reads.

Five ADRs already exist inline in `docs/ROADMAP.md` §6 (ADR-1 through ADR-5).
This record formalizes the practice and gives future decisions a dedicated home;
migrating the inline ADRs into individual files here is deliberate follow-up
work, not part of this record.

## Decision

We will record architecture decisions in **Architecture Decision Records (ADRs)**
using the format described by Michael Nygard.

- Each ADR is a short Markdown file in `docs/adr/`, numbered sequentially and named
  `NNNN-title-in-kebab-case.md`.
- Each ADR has the sections **Title**, **Status**, **Context**, **Decision**, and
  **Consequences**.
- **Status** is one of *Proposed*, *Accepted*, *Deprecated*, or *Superseded*. A
  superseded ADR is not deleted; it is marked superseded and points to the ADR that
  replaces it, and the replacement points back.
- ADRs are immutable once accepted, except to change their status. A new decision is
  a new ADR, not an edit to an old one.

This ADR is the first record and establishes the practice for all that follow.
The inline ADR-1..ADR-5 in `docs/ROADMAP.md` §6 remain authoritative for the
decisions they record until they are migrated into numbered files here.

## Consequences

- The reasoning behind structural decisions is preserved and versioned alongside the
  code it explains.
- Writing an ADR is a small, deliberate friction on consequential change — intended,
  since it makes reversing a load-bearing decision a visible act rather than an
  accident.
- ADRs add a modest maintenance habit. They are not a substitute for
  `docs/ROADMAP.md` or `docs/RESPONSIBLE-TECH-AUDITS.md` — they capture decisions,
  not the full design or the audit trail.
