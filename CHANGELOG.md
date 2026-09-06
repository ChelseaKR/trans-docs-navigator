# Changelog

All notable changes to this project are documented in this file. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project has not yet cut a
tagged release (`package.json` is `0.1.0`, `git tag -l` is empty), so everything to date
lives under `[Unreleased]`.

## [Unreleased]

### Added
- **Idaho, Utah, and Wyoming** (M6 — expand jurisdictions): 19 EN + 19 ES corpus records
  (court-order name change, driver's-license name and gender-marker, and birth-certificate
  name and gender-marker) across all three states, 7 referrals, and 3 forms-registry
  entries, each sourced from an official state statute, court self-help page, DMV/driver's
  license page, or vital-records page and fetched into `corpus/snapshots/`. Idaho's current
  birth-certificate statute (Idaho Code § 39-245A, added 2020 and amended again in 2024)
  treats sex as a "material fact" fixed at birth, correctable after the first year only for
  "fraud, duress, or material mistake of fact" — an earlier version of this same policy was
  the subject of federal litigation, so both Idaho gender-marker records are marked
  **`needs_reverification`** rather than presented as a settled bar. Utah's *current* law
  (Utah Code § 26B-8-111) actually **permits** a court-ordered sex-designation change under
  detailed criteria (clear-and-convincing evidence, six months' consistent expression,
  clinically significant distress) — the opposite of a closed route — but Utah's courts and
  legislature have sent conflicting signals on this over time, so those records are also
  marked `needs_reverification` rather than asserted as durably settled either way. Wyoming's
  official vital-records pages and statute (W.S. 35-1-424) never mention a sex/gender
  designation at all; that silence is recorded as a genuine documentation gap, not inferred
  as either an open or a closed path (PR #119's standard). Idaho's, Utah's, and Wyoming's
  driver's-license pages are likewise silent on a sex/gender marker, recorded as `verified`
  plain absences (Tennessee's PR #119 pattern) rather than volatile facts. Idaho's birth
  certificate name-change source (a DHW instructions PDF) and Wyoming's and Utah's
  registered vital-records forms have no drift baseline and are pinned in
  `tests/watchability.test.ts` as deliberate, not silent, gaps.

- **Delaware, New Hampshire, and Maine** (M6 — expand jurisdictions): 20 EN + 20 ES corpus
  records (court-order name change, driver's-license name and gender-marker, and
  birth-certificate name and gender-marker for all three states), 6 referrals, and 5
  forms-registry entries, each sourced from an official state statute, court, DMV/BMV, or
  vital-records page and fetched into `corpus/snapshots/`.
  - **Delaware**: name changes go to the Court of Common Pleas (not Chancery), $85 filing
    fee, publication repealed in 2022 (Del. Code tit. 10, ch. 59). The DMV's gender-marker
    change needs a medical or social-service provider's certification (Form MV2020) —
    self-attestation, but not self-*certification*. Birth-certificate sex-designation
    changes need notarized Requester's and Healthcare Provider's affidavits; no court order
    unless the name is also changing. A pending bill (HB 375) would remove the
    provider-certification requirement and add an "X" marker but had not passed as of
    research — recorded as pending, not as current law.
  - **New Hampshire**: the probate court cannot require consent or public notice for an
    adult's own name change (RSA 547:3-i, RSA 550:4); filing costs $170 (Family Division:
    $140), per the court's own fee schedule. The DMV's gender-marker change is genuinely
    self-attested — the current page lists only a form, current ID, and a $10 fee, no court
    order or medical letter. A birth-certificate sex-designation change requires a court
    order and results in a **new** record rather than an annotated one (RSA 5-C:87 ¶V) —
    a meaningful difference from the name-change process that the record calls out.
    `courts.nh.gov` and `dmv.nh.gov` refuse this project's declared user-agent (confirmed
    403 from both `fetch` and `curl`); the court-order and birth-certificate records
    instead cite `gencourt.state.nh.us` (the statute site), which is not blocked.
  - **Maine**: 18-C M.R.S. §1-701 bars the court from requiring public notice for *any*
    adult name change (not only gender-identity-related ones, contrary to this task's
    original premise — see "what I could not verify" below); filing costs $75. Maine's BMV
    gender-marker change is self-attested on a form that offers male, female, or
    non-binary, under penalty of perjury, no court order or physician's letter. Maine's
    birth-certificate process is the most permissive of the three: an adult can change
    their own gender marker AND, in the same filing, a first/middle name, with no court
    order at all (form VS-7, notarized, $60) — the only route in this corpus that lets a
    name change proceed without a court order tied to a gender-marker change on the same
    document.

  **What I could not fully verify by machine:** the task brief cited "LD 1626" as Maine's
  vehicle for repealing the public-notice requirement; the current Maine Legislature bill
  tracker shows LD 1626 (130th Legislature) is an unrelated, unenacted bill about the
  Maine Indian Claims Settlement. The statute's own section-history line names several
  amending Public Laws (2017–2023) but none of the chapter-law PDFs needed to isolate which
  one first added the no-public-notice sentence could be fetched. The record states only
  what the *current, in-force* statutory text says, not which bill produced it. Separately,
  the exact BMV fee for a name-change license reissue in Maine, and the exact DE DMV fee
  for the same transaction, could not be confirmed from any fetchable page — both records
  carry `cost.amount_usd: null` with a note to call the agency, rather than a guessed
  number. New Hampshire's DMV gender-marker fee is stated as $10.00 on the DMV's own page,
  but a secondary advocacy source states $3.00; the corpus uses the primary source's figure
  and this discrepancy is worth a human re-check before launch.

  All 40 new records (20 EN + 20 ES) carry `"verifier": "Pilot Seed Reviewer"` and
  `verification_status: "verified"`; none are launch-cleared. Gender-marker records use
  `recheck_sla_days: 30`, matching this repo's existing convention for politically volatile
  topics.

  `make verify`: 24/24 gates pass (470/470 tests, Playwright 16/16). `make fidelity`: 0
  unsupported assertions across the new records (220 uncheckable corpus-wide, up from
  179 — all from Delaware's and Maine's PDF-only forms and New Hampshire's blocked
  courts.nh.gov/dmv.nh.gov pages, none newly introduced beyond what each state's own
  sources make unavoidable).

  Snapshot discipline: `make source-snapshot` also refreshed 23 pre-existing snapshots
  with live drift from this simulated environment's source pages, unrelated to this
  change, plus 3 orphaned passport snapshots that `travel.state.gov` now 403s on fetch.
  Those refreshes were reverted (`git checkout -- corpus/snapshots/`) rather than adopted
  blind, per `docs/OPERATIONS.md`'s re-baseline discipline — only the 11 new snapshots for
  Delaware/New Hampshire/Maine's checkable HTML sources and their
  `corpus/source-hashes.json` baselines were added.

- **Connecticut, Rhode Island, and Vermont** (M6 — expand jurisdictions): 17 EN + 17 ES
  corpus records (court-order name change, driver's-license name and gender-marker,
  birth-certificate name and gender-marker, plus a birth-certificate fees record for RI
  and VT), 6 referrals, and 3 forms-registry entries, each sourced from an official state
  probate/judiciary, DMV, or health-department page and fetched into `corpus/snapshots/`.
  - **Connecticut**: the Probate Court's own name-change page (`ctprobate.gov`), the DMV's
    driver's-license update page and its Gender Designation form B-385 (F/M/Non-Binary,
    no medical documentation required), and DPH's Gender Change and Corrections and
    Amendments pages — a court-order-supported gender-marker change on a birth certificate
    still requires a licensed provider's affidavit of surgical, hormonal, or other
    gender-transition treatment.
  - **Rhode Island**: the name-change statute (R.I. Gen. Laws § 33-22-28 — no publication
    required, fee waiver for indigent petitioners), the DMV's combined name/gender-designation
    page, and the state's own e-Regulations portal (`rules.sos.ri.gov`) for vital-records
    amendments — used instead of `health.ri.gov`, whose HTML pages return 403 to this
    project's declared user-agent (its PDF documents remain fetchable and are cited directly
    where the HTML page could not be).
  - **Vermont**: the Judiciary's probate name-change page ($150 fee, waivable), the DMV's
    Identity Documents page (gender is a self-designated descriptor alongside height,
    weight, and eye color — no documentation required by state or federal law), and the
    Department of Health's birth-certificate forms. Both Vermont birth-certificate records
    cite a PDF form directly (the Affidavit of Gender Identity, and the Application to
    Correct or Amend a Vermont Birth Certificate) because no HTML page states the same
    operative facts; `make source-snapshot` marks both `unextractable`, and every assertion
    sourced to them is reported UNCHECKABLE rather than silently passed.

  All 34 new records carry `"verifier": "Pilot Seed Reviewer"` and
  `verification_status: "verified"`; none are launch-cleared. Gender-marker records use
  `recheck_sla_days: 30`, matching this repo's existing convention for politically
  volatile topics.

- **Virginia** (M6 — expand jurisdictions): 7 EN + 7 ES corpus records (court-order name
  change, driver's-license name and gender-marker, a driver's-license replacement-fee
  record, birth-certificate name and gender-marker, and a birth-certificate fee record),
  2 referrals, and 1 forms-registry entry, each sourced from the Code of Virginia,
  Virginia's Judicial System self-help site, Virginia DMV, or the Virginia Department of
  Health, and fetched into `corpus/snapshots/`. Virginia's name-change statute
  (§ 8.01-217) directs a petitioner to the circuit court of the county or city where they
  live and requires the court to grant the change unless it finds fraud, an infringement
  of others' rights, or — for a minor — that it is not in the child's best interest; extra
  requirements apply to incarcerated, probationary, or registered petitioners. Virginia no
  longer requires a court order to change the sex designation on a birth certificate — an
  adult files form VS42, signed by a treating medical provider, directly with the State
  Registrar — but both the DMV and birth-certificate gender-marker records are marked
  **`needs_reverification`**: Virginia's gender-marker policy has shifted with changes in
  administration before, so the corpus degrades rather than asserts a settled fact. The
  Code of Virginia's own site (`law.lis.virginia.gov`) was observed to intermittently
  include or omit a footer HTML fragment across otherwise-identical fetches; the committed
  snapshot and drift baseline were pinned to the same fetch to keep `make fidelity`
  deterministic, but the weekly `source-watch` job may need a human's eye on that one
  domain (see the PR description).

- **Maryland** (M6 — expand jurisdictions): 5 EN + 5 ES corpus records (court-order name
  change, driver's-license name and gender-marker, birth-certificate name and
  gender-marker), 2 referrals, and 2 forms-registry entries, each sourced from an official
  Maryland Judiciary, MVA, or Department of Health page and fetched into
  `corpus/snapshots/`. Maryland is comparatively permissive on a couple of fronts, recorded
  exactly as its own sources state them rather than generalized: the MVA's own page says
  **no documentation** is required to change the gender marker on a driver's license or ID
  (M/F/X), only an in-person appointment; and Maryland's birth-certificate sex-designation
  change accepts **either** a licensed health care practitioner's signed statement (surgical,
  hormonal, "or other treatment appropriate for the individual") **or** a court order — no
  surgery requirement, unlike some other states already in this corpus. The name-change
  court petition (Circuit Court, CC-DR-60, $165 filing fee) describes a 30-day objection
  window for adults, not a newspaper-publication requirement. Both PDF sources cited (the
  CC-DR-60 form and the Division of Vital Records' sex-designation fact sheet) were
  fetchable and are under drift watch, unlike Georgia's Form 3977 below — but their own text
  still cannot be fidelity-checked (PDF, not HTML), so assertions sourced to them are
  reported UNCHECKABLE rather than silently passed.

- **Georgia** (M6 — expand jurisdictions): 6 EN + 6 ES corpus records (court-order name
  change, driver's-license name and gender-marker, birth-certificate name and
  gender-marker, and a birth-certificate fee record), 2 referrals, and 1 forms-registry
  entry, each sourced from an official Georgia state page or administrative rule and
  fetched into `corpus/snapshots/`. Georgia's driver's-license gender-marker rule
  (Ga. Comp. R. & Regs. 375-3-1-.17) is recorded as **restricted, not open**: it requires
  a gender-reassignment operation plus a court order or physician's letter, and even then
  leaves the decision to the Department's discretion. Georgia's vital-records rules fold a
  birth-certificate sex-designation change into the generic "All Other Amendments" rule
  (511-1-3-.25), with no separate gender-identity or court-order path described. A
  name-change amendment to a Georgia birth certificate also carries an unusual,
  directly-sourced requirement — a physician's letterhead statement of an
  "intersex/transgender diagnosis" — read from the official Affidavit for Amendment
  (Form 3977); as a PDF, that source cannot be automatically fidelity-checked and is
  reported UNCHECKABLE rather than silently passed, the same honest degradation already
  applied to the New York sources this project cannot fetch.

- **ADR directory completed** (`docs/adr/`): the five build ADRs migrated out of
  `docs/ROADMAP.md` §6 into individual Nygard-format files (0001–0005, decision content
  unchanged), plus a new ADR-0006 recording the deliberate no-ESLint/no-Prettier/no-bundler
  toolchain deviation, its compensating controls, and its known open limit (lint scope is
  `api/`+`src/` only). `docs/ROADMAP.md` §6 now points at the files; README conformance
  rows updated to match.
- **Birth-certificate corpus coverage** for all five jurisdictions (CA, IL, NY, TX, WA) in
  EN and ES, from each state's own vital-records/health-department source: 28 records,
  including the `court-order → birth-certificate` prerequisite edge every one of those
  states states in its own words, and a **cited, plainly-stated closed route in Texas**
  (Vital Statistics lists only hospital/clerical-error evidence for the sex field, and no
  route to change it to match gender identity). No fee is estimated anywhere: where a
  source states one it is recorded, and where it does not, the step is reported unpriced.
- **`DEFINITION_OF_DONE.md`** at the repo root (audit P2, QM-18/QM-13/CQ-42): defines
  "done" with an explicit gate/review/human-gate enforcement split — it claims nothing as
  machine-enforced that isn't. The PR template gains the matching rollback, observability,
  and ISO 25010 quality-characteristic lines; CONTRIBUTING links it.
- **`state-of-birth` portability** in the relocation planner (`api/relocation.ts`) — a birth
  certificate is governed by the state you were *born* in, which is neither the origin nor
  the destination of a move and which the app never asks for. It is therefore never
  classified `redo-in-destination`, never given a closing-residency window, and never marked
  done by the "what you already have" checkbox; it gets its own plan phase ("Where you were
  born") that says the move changes nothing about it. See `docs/RELOCATION.md`.
- Offline-capable PWA shell with explicit user-initiated saving (EXP-01) — service
  worker, save-for-offline UI, no background sync, review-gate approved before merge.
- Structured JSON logging + `/livez` and `/readyz` fail-closed health/readiness probes.
- EN/ES locale key-parity CI gate (G6), UTF-8 (G1) and BCP-47 (G3) mechanical i18n gates.
- G9 pseudolocale overflow gate (Playwright, desktop + mobile) and G10 logical-CSS
  static gate (stylelint-use-logical) for RTL readiness.
- Trivy container CVE scan (HIGH,CRITICAL, blocking) on every push/PR.
- Renovate configuration with GitHub Actions digest pinning and a 72-hour cooldown.
- `CITATION.cff` for scholarly/portfolio citation.
- `CHANGELOG.md` (this file), `.github/CODEOWNERS`, `.nvmrc`, `.standards-version`,
  `.pre-commit-config.yaml` (gitleaks + typecheck), gitleaks CI + scheduled TruffleHog
  full-history secret scanning, and a release-hardening pass on `release.yml`
  (re-verify at tag, version-tag consistency check, keyless cosign signing, SBOM schema
  validation, digest-only publish, post-publish verification) — standards remediation,
  2026-07-05.
- HSTS and Permissions-Policy response headers (`api/server.ts`).
- `## Observability` tier declaration in `docs/ROADMAP.md` (Tier A, hosted service).
- README standards-conformance table.

### Fixed
- **The two SSA records now state the real, bifurcated federal rule, cited to SSA's own policy
  manual.** Every page under `www.ssa.gov` 403s a non-browser client, so both records cited a
  source no gate could read: the sex-marker record said only "policy has changed and is being
  litigated" (a stale non-answer), and the name record asserted a `$0` fee and a `2–4 week`
  timeline behind that unreadable citation. Rather than spoof a browser user-agent, both were
  repointed to SSA's **Program Operations Manual System** on `secure.ssa.gov`, which serves our
  declared UA a clean HTTP 200 and is SSA's *binding internal policy manual* — a more
  authoritative source than the public page it replaced. The records now say plainly, EN + ES:
  the sex field is **only** changed to reflect **sex at birth** (POMS RM 10212.200, TN 36,
  effective 2026-06-29), while a **court-ordered name change still works** (POMS RM 10212.001 /
  RM 10212.010 → .080). The unsourceable `$0` and `2–4 weeks` claims were **dropped**, not
  re-cited — POMS states neither, and the timeline was contradicted by POMS RM 10205.100
  ("within 2 weeks"). Both URLs are now snapshotted, drift-baselined and fidelity-checked:
  UNCHECKABLE assertions fell **42 → 32**, and unwatchable cited sources **4 → 3**.
- **`make link-check` no longer reports a live link as dead because the server's TLS is broken.**
  CDPH (`www.cdph.ca.gov`) sends its leaf certificate without the intermediate that signs it, so
  Node's `fetch` threw `UNABLE_TO_VERIFY_LEAF_SIGNATURE` and four **live** CDPH URLs (HTTP 200 in
  any browser) were reported as rot. `link-check` now distinguishes the two on evidence — a chain
  error can only be raised *after* the server presents a certificate, so it proves the host is up,
  whereas a dead host fails with `ENOTFOUND`/`ECONNREFUSED`/timeout (still reported dead) — and
  names the condition `incomplete-TLS-chain`, printing it on every run without failing the build.
  **Certificate verification is never disabled** (no `-k`, no `rejectUnauthorized: false`); the
  real status is confirmed through a client that completes the chain from the cert's AIA the way a
  browser does. The carve-out is scoped to the TLS error, not the host: a genuine 404 behind
  CDPH's broken chain is still reported dead.
- Re-baselined the **MAP Nondiscrimination** and **A4TE Know Your Rights** policy trackers after
  reading them and re-verifying the eight federal records they implicate. Recorded in
  `docs/OPERATIONS.md`: `policy-watch` stores *hashes, not content*, so a true before/after diff of
  a tracker is impossible, and the *MAP Nondiscrimination* tracker is **mis-scoped** (`jurisdiction:
  US` points its drift at the federal SSA/passport records, but the map carries zero federal
  identity-document content).
- A router test's simulated clock (`2026-05-31`) had silently decayed past the corpus's
  verification dates, so it was asserting a freshness refusal rather than the change-param
  defaulting it exists to pin. `freshnessOf()`'s future-date guard is unchanged.
- Un-pinned the runtime freshness clock from a frozen date (FIX-02) — the freshness SLA
  now evaluates against the real calendar in production.
- Checklist save-for-offline URL no longer duplicates `language=es`.
- `docs/ROADMAP.md` §7 no longer overstates the p95-latency row as "merge-blocking" when
  it wasn't wired into `make verify`; the in-process latency guard
  (`scripts/latency-bench.ts`) is now an actual `make verify` step (see below), and the
  ledger reflects the real gate shape (in-process guard merge-blocking; network-level k6
  run remains opt-in via `make loadtest`, against a deployed instance).
- The last unpinned GitHub Action (`aws-actions/configure-aws-credentials` in
  `deploy-aws-preview.yml`) is now SHA-pinned; 26/26 actions pinned.

### Security
- `persist-credentials: false` hardening across workflow checkouts.
- Dockerfile base image aligned to `node:22-slim`, matching `engines.node` and the
  CI-tested Node 22 runtime (previously drifted to `node:26-slim`).

## Prior audit baseline

`STANDARDS/AUDIT-2026-06-21.md` recorded 0 high / 4 medium / 4 low findings as of that
date; the entries above are everything shipped since then. See
`docs/audits/` for the currently-committed audit artifacts (DPIA, model card, data card,
residual-risk register, accessibility audit, eval reports) and their own dated
recheck-cadence notes.
