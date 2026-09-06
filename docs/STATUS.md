# Build Status — Trans Docs Navigator

> Snapshot of what the ROADMAP §8 implementation plan has produced.
> Last updated: 2026-07-13. `make verify` is green (24/24 gates).
>
> **2026-07-13 the SSA records — a blocked host is not an excuse for a stale claim.**
> Both SSA records cited pages that **no gate could read**: every host under `www.ssa.gov` returns
> **403** to any non-browser client. Behind that unreadable citation sat the corpus's worst
> remaining claim — the sex-marker record said only *"policy has changed and is being litigated"*
> and deliberately presented **no rule at all** — plus a `$0` fee and a `2–4 week` timeline nobody
> could check. The rule against spoofing a browser UA is what kept it that way, and that rule is
> right. **The fix was not to defeat the block but to find the authority.** SSA publishes its
> **binding internal policy manual** — POMS — on `secure.ssa.gov`, which serves this project's own
> declared user-agent a clean **HTTP 200**. It is *more* authoritative than the public page it
> replaced, not a workaround for it.
>
> What POMS actually says, and what the records now say plainly (EN + ES):
> - **Sex marker: the route is closed.** RM 10212.200 (TN 36, effective **2026-06-29**): *"The
>   agency is only correcting or changing the sex field on the NUMIDENT to reflect the NH's sex at
>   birth."* Evidence must be a birth certificate or CRBA **showing sex at birth**. There is no
>   route to a marker matching gender identity. A truthful, cited *"this is not available"* is far
>   more useful to a trans user than the silence that stood here before.
> - **Name: the route is open.** RM 10212.010 routes a name change to RM 10212.080 — *"US court
>   order for a name change"* — and RM 10212.001 defines a valid court order as an event that
>   changes the legal name, applied for on **Form SS-5**. The federal landscape is **bifurcated**,
>   and the corpus now says so instead of blurring the two.
> - **The `$0` fee and the `2–4 week` timeline were dropped, not re-cited.** No fetchable official
>   source states either, and POMS RM 10205.100 actually says *"within 2 weeks"* — so the timeline
>   was not merely unverifiable, it was **wrong**. A claim we cannot source does not render.
>
> Both URLs are now snapshotted, drift-baselined and fidelity-checked like any other source, so the
> machinery finally watches the most volatile records in the corpus: **UNCHECKABLE assertions fell
> 42 → 32** and **unwatchable cited sources 4 → 3** (the SS-5 PDF remains, as a *forms-registry*
> link; NY Courts and health.ny.gov remain 403). Only then were the **MAP Nondiscrimination** and
> **A4TE** trackers re-baselined — after reading them and confirming the eight federal records they
> implicate had been re-verified. Two limitations are now written down rather than discovered again:
> `policy-watch` stores **hashes, not content** (so a true tracker diff is impossible), and the MAP
> Nondiscrimination tracker is **mis-scoped** — tagged `US`, it points its drift at the federal
> records while containing zero federal identity-document content.
>
> **2026-07-13 `link-check`: a broken server is not a dead link.**
> CDPH sends its leaf certificate without the intermediate that signs it, so Node's `fetch` threw
> `UNABLE_TO_VERIFY_LEAF_SIGNATURE` and **four live CDPH URLs** — HTTP 200 in any browser — were
> reported as **rot**. A rot-detector that cries wolf gets switched off, and then it protects
> nobody. The gate now separates the two **on evidence**: a chain error can only be raised *after*
> the server hands us a certificate, which proves the host is up, while a genuinely dead host fails
> with `ENOTFOUND`/`ECONNREFUSED`/timeout and is **still reported dead**. The condition is named
> `incomplete-TLS-chain`, printed on every run, and does not fail the build. **Certificate
> verification is never disabled** — no `-k`, no `rejectUnauthorized: false`; the status is
> confirmed through a client that completes the chain from the certificate's AIA exactly as a
> browser does. The carve-out is scoped to the TLS error and **not** to the host: a genuine 404
> behind CDPH's broken chain still fails the gate (there is a negative control for precisely that).
>
> **2026-07-13 source-fidelity gate — closing the bottom link of the citation chain.**
> The citation gate proves an answer cites a *record*. `eval/faithfulness.ts` proves a generated
> claim is supported by *the record it cites*. **Nothing proved the record was supported by the
> source IT cites** — and that was the load-bearing safety property, because the corpus is where
> the legal claims actually live. The California DMV bug is the proof it mattered: that record
> asserted a paper form (`DL 329`) and a `$0` fee its cited page never mentioned, and its
> normalized-text hash was **unchanged**, so source-watch — which detects *movement*, never *fit* —
> reported nothing. Only a human re-reading the page found it.
>
> `make fidelity` (stage 9) now re-reads every record against a committed, offline snapshot of its
> cited source and fails the build when a **load-bearing** assertion — a fee, a duration, a form id,
> a hard requirement, or the `residency_bound` relocation flag — is not locatable in that source.
> Run against the corpus as it stood, it found **20 unsupported assertions across 8 records**:
> - **`ca.court-order.name`** (EN+ES): claimed a **$480** fee (page says **$435–$450**), a **6–12
>   week** timeline (page says **2 to 3 months**), and forms **NC-100 / FW-001** the page never
>   names — while *omitting* the newspaper-publication requirement the page does state, **including
>   its gender-identity exemption**, which is the single most relevant sentence on that page for
>   this app's users.
> - **California's own form page then said the quiet part**: a name change *"related to gender
>   identity"* uses **form NC-200**, not NC-100. The corpus had been handing trans users the wrong
>   form, and the co-authored gold set had certified it (`mustContain: ["NC-100"]`) — exactly what
>   `gold.provenance.json: independent_author: false` exists to warn you about.
> - **`ca.drivers-license.name`** (EN+ES): cited a DMV **landing page with zero name-change content**
>   — the passport bug again, in a different state. Repointed to the page that covers it.
> - **`tx.court-order.name`** (EN+ES): cited a TexasLawHelp **navigation stub** that states no fee,
>   no waiver and no fingerprint requirement. Repointed to the guide that states all three (and a
>   **$150–$300** filing-fee range the record never had).
> - **`relocation.residency_bound`** — the flag behind the planner's most consequential warning,
>   *"this door closes the day you stop being a resident"* — was asserted on three records and **not
>   one of their cited sources said so**. `api/corpus.ts` validated the flag against the record's own
>   prose, i.e. it validated the claim against the claim: this bug class in miniature. TX now cites a
>   page that says "the county where you live"; CA and IL, whose pages do not, no longer claim it.
>
> **What the gate does not do is written down, on purpose.** It vouches for literals (fees,
> durations, form ids) and for topic-presence on a curated set of high-harm requirements. It does
> **not** do semantic entailment — a similarity score here would quietly bless wrong records with a
> number that looks like proof. So **246 of 313 prose sentences carry no checkable literal and no
> gate vouches for them**, and **42 assertions are UNCHECKABLE** because SSA, NY Courts and
> health.ny.gov return 403 to any non-browser client (we do not spoof a browser UA to get past a
> host that said no). Those numbers are published in `docs/audits/source-fidelity.md` and in the
> generated launch-gate table below, so the blind spot is *visible* rather than invisible.
>
> **2026-07-13 source-watch fail-quiet fix + first real churn-detection pass.**
> `scripts/source-watch.ts` returned on baseline-coverage issues (missingBaseline /
> staleBaseline) **before** it evaluated drift. Because the repo deliberately carries four
> review-gated baseline gaps (SS-5 ×2, SSA home, NY-Courts), **real drift at every other
> source was silently never reported** — a fail-quiet in the exact mechanism the product's
> safety story depends on. Drift and coverage are now reported together in one run (both
> still fail the build; neither suppresses the other), via a pure, testable `summarize()`;
> `tests/source-watch.test.ts` pins the regression. `policy-watch.ts` had the same class of
> bug in a second form — a tracker configured with **no** baseline entry was silently
> unwatched forever (this was live: the MAP *Identity Document Laws* tracker, the one most
> on-point for this corpus, had no baseline) — and now reports it as a coverage issue.
>
> Un-masking the bug surfaced **11** drifted sources, not the 7 previously known. The four
> extra were all **federal passport** pages — the most legally volatile area in the corpus.
> Substantive changes found and corrected in the records (EN + ES):
> - **U.S. passport sex marker:** State now issues **only M/F matching sex at birth and no
>   X markers** (EO 14168; SCOTUS stayed the injunction on 2025-11-06). The record said only
>   "policy has changed and is being litigated" and cited a page carrying no sex-marker
>   content at all; it now cites the official sex-markers page and states the operative rule.
> - **Illinois name change:** the **newspaper-publication requirement is gone** from the
>   official guide (laws updated 2024-01-01 and again 2025-03-01). The record still asserted
>   publication was usually required, with a 6-week timeline driven by the publication period.
> - **Texas driver's license:** DPS **stopped accepting court orders that change sex** (and
>   combined name+gender orders) in 2024 — repointed from a DPS landing page that says
>   nothing about gender markers to the Texas State Law Library page that actually supports it.
> - **California DMV:** retired the **DL 329** "Gender Category Request" paper-form route; the
>   page now names no form and routes through the online DL/ID application finished in a field
>   office. The `ca-dl-329` form entry was removed and the (unsupported) $0-fee claim dropped.
> - Also corrected: CA gender-recognition fee/timeline ($435–$450, ~1–2 months), IL DL
>   designation route, NY DMV name-change fees/forms, and NY's now-unsupported X-marker claim.
>
> Records are reconciled to what the official pages say **today**; baselines were re-taken
> only for pages actually re-read (see the safe re-baseline procedure in docs/OPERATIONS.md).
>
> **2026-07-12 observability and lifecycle pass** — added W3C trace-context
> continuation and correlated server/Bedrock client records, bounded-route RED metrics
> at `/metrics`, formal request-based availability/response-latency SLOs with fast/slow
> multi-window burn-alert definitions, and content-free GenAI usage/duration/cost telemetry pinned
> to the portfolio's immutable semantic-convention/pricing shim. `make slo` is stage 22;
> the real-server smoke journey also checks trace continuity and metrics. Loading alert
> rules into a monitoring backend and running recurring real-Bedrock evals remain honest
> deployment/credential dependencies.
>
> **2026-06-05 hardening pass** (see `docs/IMPROVEMENT-PLAN.md` for the full plan):
> added a named-verifier roster + placeholder enforcement (§1.1), a gold-set provenance
> gate (§1.2), HTTP hardening with a testable router + input bounds + security headers
> + rate limiting (§2.2), a runtime request-content non-reflection test (§2.1, which caught and
> fixed a query-string reflection bug), a readability gate (§3.2), colour-contrast
> assertions + blocking pa11y/SAST in CI (§3.1), full Spanish localization of generated
> answers (§4.1), an adversarial/prompt-injection eval suite (§1.3), form-fill failure
> feedback (§3.3), real calendar-date validation + conflicting-cost detection (§1.5),
> language-aware retrieval (§4.2), runtime corpus quarantine (§6.3), vendored-asset SRI
> (§2.4), content-free observability counters (§6.2), and a contribution path (§7.2). The
> HTTP/render surface is now covered by tests rather than excluded.
>
> **2026-06-05 second pass** — landed the previously-deferred code items: a real
> **Bedrock model path** (`BedrockGenerator` + injectable transport, run through the same
> `citation.enforce()` gate; `tests/bedrock.test.ts` proves a hallucinating model is
> rejected; `make eval-bedrock`), a pluggable **embedding retriever** seam
> (`api/embedding-retrieval.ts`) + a load test (`make loadtest`, `loadtest/p95.k6.js`),
> and client-side **encrypted save/resume** (`src/secure-resume.ts`, PBKDF2→AES-GCM,
> local-only, identity never persisted). The OPEN review-gates below are unchanged — they
> require humans, not code.

## Milestones

| Milestone | Status | Evidence |
|-----------|--------|----------|
| **M0 — Scaffold & gates** | ✅ Done | `make verify` runs the 24-stage blocking pipeline; CI in `.github/workflows/ci.yml`; `Dockerfile`; `infra/`. |
| **M1 — Corpus & data model** | ✅ Done (seed) | 78 schema-validated records (6 states + federal; 39 EN + 39 ES); `make content` + `make freshness` + `make fidelity` green. Content is **seed data**, not launch-verified (ADR-3) — the record/verifier counts in the generated launch-gate table below are the machine-derived source of truth. |
| **M2 — Retrieval-mandatory guidance** | ✅ Done | `api/retrieval.ts` → `api/generator.ts` → `api/citation.enforce()`; groundedness 100%, citation coverage 100% on the gold set. |
| **M3 — Checklist engine** | ✅ Done | `api/checklist.ts`; ordered, prerequisite-aware, freshness-flagged; matches gold expectations. |
| **M4 — Client-side form pre-fill** | ◑ Scoped fallback; PDF fill not done | The shipped helper keeps current/new legal-name fields on-device, formats them for copying, and links to authoritative official forms. It deliberately does **not** auto-fill the XFA/LiveCycle PDFs; ROADMAP M4's field-mapped pilot-form done condition remains unmet rather than being simulated with unsafe fixtures. |
| **M5 — Experience & a11y hardening** | ✅ Done (auto-gated parts) | Full flow + no saved browser session by default (explicit "private mode" affordance) + **printable packet** (`/packet`, print CSS, no-JS-friendly) + **Spanish parity** (16 ES records, EN/ES both 100% on the gold set) + keyboard-path tests; mechanical a11y auto-gated across 19 templates. Manual SR/keyboard/zoom walkthrough remains **review-gated (PENDING)**. |
| **M6 — Expand jurisdictions** | ◑ In progress | 6 states + federal represented (TX, WA, and CO added through the gates). Each carries a **mechanical readiness** row in `eval-report.md`; **launch-clearance is review-gated and OPEN** for all. TX DMV gender-marker is `needs_reverification` (volatile) — demonstrates per-jurisdiction degradation. |

## Hard guardrails — how each is enforced

| Guardrail | Enforcement | Gate |
|-----------|-------------|------|
| #1 No claim without a citation | `citation.enforce()` rejects uncited answers at runtime; `make citation` proves 100% coverage across all paths | ✅ auto |
| #2 Information, not legal advice | persistent banner on every page + trailing disclaimer on every answer; `make disclosure` | ✅ auto |
| #3 Privacy is a safety property | no runtime identity-field handling; local form helper/resume blob; allowlist logger; request-content non-reflection; `make privacy` | ✅ auto |
| #4 Stale law is broken law | `freshness.ts` degrades stale/volatile records; `make freshness` blocks "verified-but-past-SLA" | ✅ auto |
| #1a A record must match the source IT cites | `make fidelity` re-reads every record against a committed snapshot of its cited source and blocks any unsupported fee/duration/form-id/requirement/residency claim; what it *cannot* check is counted and published, never silently passed | ✅ auto (+ published gap) |

## Merge-blocking metrics (ROADMAP §7) — current

| Metric | Target | Now |
|--------|--------|-----|
| Citation coverage | 100% | 100% ✅ |
| Groundedness | ≥ 0.95 | 1.00 ✅ |
| Factual accuracy (gold) | ≥ 0.98 | 1.00 ✅ (16 items; co-authored gold — see caveat) |
| Per-segment accuracy (jurisdiction × language) | ≥ 0.95 each | 100% all 9 segments ✅ |
| Refusal safety | 1.0 | 1.00 ✅ |
| Corpus freshness | 0 stale-as-current | 0 ✅ (8 records correctly degraded) |
| Mechanical a11y violations | 0 | 0 ✅ |
| Runtime API references to direct identity-form fields | 0 | 0 ✅ |
| Sentinel request content reflected in app logs/responses | 0 | 0 ✅ |
| Core-logic coverage | ≥ 90% / ≥ 85% | 98.42% lines / 91.59% branches ✅ (latest exact-head gate run; includes router + render surface) |
| Adversarial/injection safety | 1.0 | 1.00 ✅ (8 stress cases) |
| HTTP availability SLO | 99.9% / 30 d | Request-based and drift-gated ✅; probes/scrapes excluded; PromQL parser + page/ticket delivery await deployment |
| HTTP response-latency SLO | 99% ≤ 1.5 s / 30 d | Request-based and drift-gated ✅; probes/scrapes excluded; process-local RED counters exported at `/metrics` |
| GenAI content capture | Off | `content_captured: false`; prompt/completion fields structurally absent ✅ |

## Explicitly OPEN review-gates (not signed — required before any real launch)

This table is **generated** by `scripts/launch-gates.ts` (stage 24 of `make verify`) from the
repository's own artifacts. It is not a claim anyone typed, and no one can clear a gate here by
editing this file — `make verify` goes red until the evidence itself changes. Same anti-drift
discipline as the gate-count check, applied to the disclosures that actually matter.

<!-- launch-gates:start — GENERATED by scripts/launch-gates.ts. Do not hand-edit. -->

**Launch readiness: 8 of 8 review gates are OPEN.** Every status below is derived from the
repository's own artifacts on each `make verify` run — none of it is hand-written, and none of it
can be cleared by editing this table. **No record in this corpus has been verified by a named human.**

| Launch gate | Status | Machine-derived evidence | Derived from |
|---|---|---|---|
| Named-human verification of every record | 🔴 **OPEN** | **0 of 631** records verified by a named human. 631 carry the `Pilot Seed Reviewer` placeholder. | `corpus/` + `forms/registry.json` × `corpus/VERIFIERS.json` |
| Every record's claims backed by its own cited source | 🔴 **OPEN** | 853 assertion(s) located in their cited source, 0 unsupported (merge-blocking), **304 UNCHECKABLE**. Separately, **1824 of 2286 prose sentences carry no checkable literal** and no gate vouches for them. | `make fidelity` (`scripts/source-fidelity.ts`) |
| Every cited source actually under drift watch | 🔴 **OPEN** | **50** cited source(s) are UNWATCHABLE — no baseline can be taken or compared, so drift there is undetectable and `last_verified` is a human's assertion rather than a checked fact: `https://courts.delaware.gov/forms/download.aspx?id=16858` (no reviewed drift baseline), `https://dhss.delaware.gov/wp-content/uploads/sites/12/dph/pdf/GenderReassignment.pdf` (no reviewed drift baseline), `https://dhss.delaware.gov/wp-content/uploads/sites/12/dph/pdf/RequesterAffidavitSexChange.pdf` (no reviewed drift baseline), `https://dmv.de.gov/DriverServices/drivers_license/pdfs/gender_designation_change_procedure.pdf` (no reviewed drift baseline), `https://dmv.de.gov/forms/driver_serv_forms/pdfs/gender_change_request_form.pdf` (no reviewed drift baseline), `https://doa.alaska.gov/dmv/akol/namchg.htm` (403 to our declared user-agent; we do not spoof one), `https://doa.alaska.gov/dmv/forms/pdfs/427.pdf` (no reviewed drift baseline), `https://dph.georgia.gov/document/document/affidavit-amendment-form-3977-revisedpdf/download` (no reviewed drift baseline), `https://dphhs.mt.gov/assets/Statistics/VitalStats/MTGenderDesignationForm.pdf` (no reviewed drift baseline), `https://dphhs.mt.gov/assets/Statistics/VitalStats/affidavitcorr.pdf` (no reviewed drift baseline), `https://health.wyo.gov/wp-content/uploads/2026/07/WDH-VRS-Correction-Form-2026.pdf` (no reviewed drift baseline), `https://ndlegis.gov/cencode/t23c02-1.pdf` (no reviewed drift baseline), `https://odh.ohio.gov/know-our-programs/vital-statistics/changing-correcting-birth-record` (403 to our declared user-agent; we do not spoof one), `https://portal.ct.gov/-/media/DMV/20/29/B-385.pdf` (no reviewed drift baseline), `https://public.courts.alaska.gov/web/forms/docs/civ-699.pdf` (no reviewed drift baseline), `https://public.courts.alaska.gov/web/forms/docs/civ-700.pdf` (no reviewed drift baseline), `https://publicdocuments.dhw.idaho.gov/WebLink/ElectronicFile.aspx?docid=1294&dbid=0&repo=PUBLIC-DOCUMENTS` (no reviewed drift baseline), `https://realfile.tax.newmexico.gov/mvd10237.pdf` (no reviewed drift baseline), `https://superiorcourt.maricopa.gov/media/emucljue/name-gender-change-eng-spa.pdf` (no reviewed drift baseline), `https://vitalrecords.nc.gov/documents/NCOVR-BirthModificationsApplicationFinal-07072022v6.pdf` (no reviewed drift baseline), `https://vitalrecords.utah.gov/wp-content/uploads/902-Affidavit-to-Amend-by-Court-Order.pdf` (no reviewed drift baseline), `https://www.azdhs.gov/documents/vital-records/manuals/correction-affidavit-correct-amend-birth.pdf?v=20260409` (no reviewed drift baseline), `https://www.capitol.tn.gov/Bills/113/Bill/SB1440.pdf` (no reviewed drift baseline), `https://www.courts.nh.gov/sites/g/files/ehbemt471/files/documents/2021-06/filing_fees.pdf` (403 to our declared user-agent; we do not spoof one), `https://www.dfa.arkansas.gov/wp-content/uploads/Affidavit_of_Legal_Name_Change_2019.pdf` (no reviewed drift baseline), `https://www.dfa.arkansas.gov/wp-content/uploads/DS_GenderApplication.pdf` (no reviewed drift baseline), `https://www.dmv.nh.gov/drivers-licensenon-driver-ids/update-personal-information` (403 to our declared user-agent; we do not spoof one), `https://www.dpbh.nv.gov/siteassets/programs/birthdeath/dta/forms/Court_Ordered_Change_ONLY.pdf` (no reviewed drift baseline), `https://www.dpbh.nv.gov/siteassets/programs/pco/Changing_Your_Gender_In_Nevada_Guide_08.24.2018_1.pdf` (no reviewed drift baseline), `https://www.dpbh.nv.gov/uploadedFiles/dpbh.nv.gov/content/Programs/BirthDeath/dta/Forms/Corrections%20-%20Birth.pdf` (no reviewed drift baseline), `https://www.health.ny.gov/vital_records/gender_designation_corrections.htm` (403 to our declared user-agent; we do not spoof one), `https://www.healthvermont.gov/sites/default/files/document/hsi-vr-gender-affidavit.pdf` (no reviewed drift baseline), `https://www.healthvermont.gov/sites/default/files/documents/pdf/HS_VR_BC_Correct_Amend.pdf` (no reviewed drift baseline), `https://www.hhs.nd.gov/sites/www/files/documents/DOH%20Legacy/Vital/SFN%2060183%20-%20Birth%20Amendment%20Changes.pdf` (no reviewed drift baseline), `https://www.maine.gov/dhhs/mecdc/sites/maine.gov.dhhs.mecdc/files/Application%20to%20Correct%20a%20Vital%20Record%20in%20Maine%20%28VS-7%29.pdf` (no reviewed drift baseline), `https://www.maine.gov/sos/sites/maine.gov.sos/files/inline-files/GENDER%20DESIGNATION%20FORM2019.pdf` (no reviewed drift baseline), `https://www.maine.gov/sos/sites/maine.gov.sos/files/inline-files/Guidance%20about%20Gender%20Designations%20on%20Maine%20Drivers%20Licenses_1.pdf` (no reviewed drift baseline), `https://www.michigan.gov/mdhhs/doing-business/vitalrecords/correct-change-a-vital-record-and-legal-name-change` (403 to our declared user-agent; we do not spoof one), `https://www.michigan.gov/sos/all-services/license-or-id-name-correction` (403 to our declared user-agent; we do not spoof one), `https://www.michigan.gov/sos/all-services/license-or-id-sex-designation-correction` (403 to our declared user-agent; we do not spoof one), `https://www.ncdot.gov/dmv/downloads/Documents/DL-300.pdf` (no reviewed drift baseline), `https://www.nj.gov/health/forms/reg-l2_1.pdf` (no reviewed drift baseline), `https://www.njcourts.gov/sites/default/files/forms/10551_namechg_adult.pdf` (no reviewed drift baseline), `https://www.nmhealth.org/publication/view/form/5429/` (no reviewed drift baseline), `https://www.nycourts.gov/courthelp/Family/nameChange.shtml` (403 to our declared user-agent; we do not spoof one), `https://www.opn.ca6.uscourts.gov/opinions.pdf/24a0151p-06.pdf` (no reviewed drift baseline), `https://www.ssa.gov/forms/ss-5.pdf` (no reviewed drift baseline), `https://www.tn.gov/content/dam/tn/health/documents/vital-records/PH-1186-Application-to-Amend-A-Tennessee-Birth-Record.pdf` (no reviewed drift baseline), `https://www.vdh.virginia.gov/content/uploads/sites/93/2020/07/VS42_Gender-Designation-Form.pdf` (no reviewed drift baseline), `https://www4.honolulu.gov/docushare/dsweb/Get/Document-325980/State%20of%20Hawaii%20Driver_s%20License%20Application.pdf` (no reviewed drift baseline) | `api/watchability.ts` over `corpus/source-hashes.json` + `forms/form-hashes.json` + `corpus/snapshots/index.json` |
| Independently authored expert gold set | 🔴 **OPEN** | `independent_author: false` — the gold set was co-authored with the corpus, so accuracy is partly tautological | `eval/gold.provenance.json` |
| Counsel review of the disclaimers (UPL) | 🔴 **OPEN** | no sign-off in `docs/signoffs/` — this gate cannot be cleared by editing a doc | docs/signoffs/*.json (gate: `counsel-review`) |
| Manual screen-reader / keyboard / 200%-zoom walkthrough | 🔴 **OPEN** | no sign-off in `docs/signoffs/` — this gate cannot be cleared by editing a doc | docs/signoffs/*.json (gate: `accessibility-walkthrough`) |
| Real Bedrock-backed eval run | 🔴 **OPEN** | no sign-off in `docs/signoffs/` — this gate cannot be cleared by editing a doc | docs/signoffs/*.json (gate: `bedrock-eval`) |
| DPIA + STRIDE threat-model sign-off | 🔴 **OPEN** | no sign-off in `docs/signoffs/` — this gate cannot be cleared by editing a doc | docs/signoffs/*.json (gate: `dpia`) |

<!-- launch-gates:end -->

## Repo map
```
api/      retrieval, grounded generation, citation enforcement, checklist, forms, log;
          trace + RED metrics + pinned GenAI telemetry; router (pure routing + input
          hardening) + server (thin HTTP shell)
src/      accessible rendering + intake/checklist/form-helper pages (official links + on-device copy helper)
corpus/   structured jurisdiction records + VERIFIERS.json (named-verifier roster)
forms/    official-form registry + source-drift baseline (no field maps or generated PDFs)
eval/     gold set + provenance + deterministic harness + report writer
scripts/  CI gates (lint/test/security/content/citation/privacy/freshness/disclosure/readability/a11y/SLO)
slos/     30-day objectives + Prometheus multi-window burn-alert definitions
tests/    unit + integration (node:test) incl. router, render, and request non-reflection proof
infra/    terraform (closed VPC option, bounded app-log retention) ; Dockerfile at root
docs/     ROADMAP, IMPROVEMENT-PLAN, audits, OPERATIONS, this file
```
