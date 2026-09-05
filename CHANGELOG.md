# Changelog

All notable changes to this project are documented in this file. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project has not yet cut a
tagged release (`package.json` is `0.1.0`, `git tag -l` is empty), so everything to date
lives under `[Unreleased]`.

## [Unreleased]

### Added
- **District of Columbia, West Virginia, and Kentucky** (M6 — expand jurisdictions): 15 EN
  + 15 ES corpus records (court-order name change, driver's-license name and
  gender-marker, birth-certificate name and gender-marker), 6 referrals, and 8
  forms-registry entries. DC is modeled as a district under jurisdiction id `US-DC`
  (labeled "District of Columbia" throughout, never called a state) consistent with the
  existing `US-XX` convention. Sourced from DC Superior Court, DC Health Vital Records,
  and DC DMV; West Virginia's Judiciary, DMV, and Health Statistics Center; and Kentucky's
  Revised Statutes, Transportation Cabinet, and Cabinet for Health and Family Services'
  Office of Vital Statistics.

  DC Superior Court (`dccourts.gov`) refuses this project's declared user-agent
  domain-wide (like NY Courts), so `dc.court-order.name` cites the court's own name-change
  instructions PDF and is UNCHECKABLE by `make fidelity`, never silently passed. Two DC
  Health PDF forms are likewise unextractable-but-authoritative, matching the Georgia
  precedent.

  West Virginia's own statute portal (`code.wvlegislature.gov`) is fetchable but renders
  its actual statute text only via client-side JavaScript, so no automated snapshot can
  ever contain it; `wv.court-order.name` instead cites the Judiciary's county-court
  directory and plainly states that West Virginia publishes no standard name-change form
  or self-help guide online — the honest degradation this project's own standard calls
  for rather than describing a process that does not work.

  Kentucky's law (KRS 213.121(5)) is considerably more restrictive than most jurisdictions
  in this corpus: a birth certificate's gender marker may only be amended after a licensed
  physician swears the person's gender has been changed **by surgical procedure**, together
  with a certified court-ordered name change — sourced directly to the current statute and
  to the state's own VS-2J amendment form, which reprints it. Kentucky's Transportation
  Cabinet publishes no separate process for a driver's-license/ID gender-marker change on
  its own; `ky.drivers-license.gender-marker` says so plainly and is marked
  `needs_reverification` rather than describing a path that may not exist.

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
