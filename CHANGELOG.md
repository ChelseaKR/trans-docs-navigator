# Changelog

All notable changes to this project are documented in this file. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project has not yet cut a
tagged release (`package.json` is `0.1.0`, `git tag -l` is empty), so everything to date
lives under `[Unreleased]`.

## [Unreleased]

### Added
- **Pennsylvania corpus coverage** (ROADMAP §M6, "expand jurisdictions") — the sixth state,
  court-order name change, driver's-license/photo-ID name and gender-marker change, and
  birth-certificate name/gender-marker amendment, in EN and ES (10 new records + 3 new
  official forms + 2 legal-aid referrals). `pa.court-order.name` cites the actual statute
  text (54 Pa.C.S. Ch. 7) rather than a summary — fingerprint-based criminal-history check,
  publication in two newspapers, and the judgment/lien search are each stated in the
  statute's own words. The two birth-certificate records cite the PA Department of Health's
  own PDF amendment form directly, because its HTML landing page states none of the
  physician-letter/notarization/fee facts; every load-bearing assertion in those two records
  is therefore reported **uncheckable** by `make fidelity`, the same honest-degradation class
  as the pre-existing SSA/NY-Courts sources. See `docs/audits/data-card.md`.
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
