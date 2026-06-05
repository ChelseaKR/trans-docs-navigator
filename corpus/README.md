# Corpus

Version-controlled, structured knowledge base: one JSON record per
`(jurisdiction × document × change-type × language)`. Each record is the unit of
**retrieval** and the unit of **citation** — there is no claim in the product that
does not trace to a record here.

## ⚠️ This is illustrative pilot seed data — NOT launch-cleared content

> The records in this repository are **engineering seed data** used to build and
> exercise the pipeline (retrieval, citation enforcement, checklist, freshness).
> They use **real official source URLs** and reflect generally-known process facts,
> but they have **not** been through the project's real-world verification gate:
>
> - `verifier` is the placeholder **"Pilot Seed Reviewer"**, not a named human who
>   checked each claim against the source on the stated date.
> - No jurisdiction is **launch-cleared**. Per `docs/ROADMAP.md` §4 and §M6, a
>   jurisdiction goes live only after (a) a named human verifies every record,
>   (b) it passes accuracy eval against an **independently authored** expert gold
>   set, and (c) counsel reviews the disclaimers.
>
> The launch-readiness review-gate is **OPEN** (unsigned) for every jurisdiction.
> See `docs/audits/data-card.md`.

## Schema

Validated by `api/corpus.ts` and enforced by `make content`. Required fields:

| Field | Meaning |
|-------|---------|
| `id` | Stable unique id, e.g. `ca.court-order.name` |
| `jurisdiction` | `US` (federal) or `US-XX` |
| `document_type` | court-order · ssa-card · drivers-license · passport · birth-certificate · financial-records |
| `change_type` | array of `name` / `gender-marker` |
| `topic`, `statement` | short label + the substantive plain-language claim |
| `source` | `{ url, title, last_verified (ISO), verifier }` — guardrail #1: no claim renders without this |
| `verification_status` | `verified` · `needs_reverification` · `unverified` |
| `recheck_sla_days` | per-record freshness SLA (legal default 90) |
| `language` | `en` / `es` |

Optional: `detail`, `cost`, `timeline`, `prerequisites`, `discretionary`, `form_ref`.

## Freshness demonstration (guardrail #4 in action)

`us.ssa-card.gender-marker` and `us.passport.gender-marker` are deliberately marked
`needs_reverification`: federal sex/gender-marker policy is volatile and litigated.
The runtime **degrades** these to "needs reverification" and never serves them as a
current fact — exactly the behavior the freshness gate protects. This is the
clearest single illustration of why the project exists.
