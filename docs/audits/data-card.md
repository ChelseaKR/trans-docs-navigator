# Data Card — Trans Docs Navigator corpus

> Last verified: 2026-07-13 · Recheck cadence: quarterly per jurisdiction.
> Auto-gated by `make content` (schema + provenance) and `make freshness` (SLA).

## What the corpus is
A version-controlled set of structured records (`corpus/jurisdictions/*.json`), one
per `(jurisdiction × document × change-type × language)`. Each record is the unit of
retrieval and the unit of citation. **63 records:** federal (SSA, passport) +
California, Illinois, New York, Texas, Washington. English coverage spans all five
states + federal; **Spanish coverage** (30 records) spans California, Illinois, New
York, Texas + federal, plus Washington's birth-certificate records (Washington's
court-order and driver's-licence rows are still English-only — a tracked gap).

**Birth certificates (added 2026-07-13, 28 records, EN + ES).** Every state's own
vital-records/health-department source, including the `court-order → birth-certificate`
prerequisite edge each of the five states states in its own words, and the closed route
in Texas: its Vital Statistics page lists only hospital records or a hospital
clerical-error letter as evidence for the sex field, and no route to change it to match
gender identity. That "not available here" is a **cited, served claim**, not a silence —
see `docs/RELOCATION.md` for why the planner treats a birth certificate as governed by
the state of *birth*, which a move cannot change.

## Provenance & verification
- Every record carries `source = { url, title, last_verified, verifier }`. The
  content gate rejects any record missing provenance (guardrail #1).
- `verification_status ∈ { verified, needs_reverification, unverified }`. Only
  `verified` AND within `recheck_sla_days` is served as current (guardrail #4).

## ⚠️ Launch-readiness: OPEN (not signed) for every jurisdiction
This is **engineering seed data**, not launch-cleared content:
- `verifier` is the placeholder `"Pilot Seed Reviewer"`, not a named human who
  checked each claim against the source on the stated date.
- The eval gold set (`eval/gold.ts`) is **co-authored with the corpus**, so the
  reported accuracy demonstrates the *harness mechanism* — it is not an independent
  accuracy measurement. A launch requires an independently authored, expert-reviewed
  gold set per ROADMAP §4.

**Launch gate per jurisdiction (all currently UNSIGNED):**
1. [ ] Named human verifies every record against its official source.
2. [ ] Independent expert gold set authored; accuracy ≥ 0.98 on it.
3. [ ] Counsel reviews disclaimers (UPL — see ROADMAP §10).

## Known limitations
- Coverage is 5 states + federal; most states absent (shown as checklist `gaps`, never hidden).
- Spanish covers 4 states + federal; Washington is English-only — a fairness gap
  tracked in the bias audit (the gate measures EN and ES separately).
- Federal gender-marker policy (SSA, passport) and the **Texas** DMV sex-marker policy are
  deliberately `needs_reverification` (volatile/contested) and are never served as current fact.
- Scheduled source-drift monitoring currently fails closed on four missing reviewed-baseline
  entries: three corpus URLs (SSA SS-5, SSA home, New York Courts name change) and one
  form URL (SSA SS-5 again in the separate raw-form baseline). No hash is auto-adopted;
  a verifier must review those sources before running `make source-baseline`.
- Per-jurisdiction **mechanical readiness** is reported in `eval-report.md`; **launch-clearance
  (named-human verification + counsel) is review-gated and OPEN for every jurisdiction.**

## Refresh cadence
Quarterly reverification per jurisdiction; volatile federal records on a 30-day SLA.
Expired data degrades to "needs reverification" rather than being served.
