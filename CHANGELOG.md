# Changelog

All notable changes to this project are documented in this file. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project has not yet cut a
tagged release (`package.json` is `0.1.0`, `git tag -l` is empty), so everything to date
lives under `[Unreleased]`.

## [Unreleased]

### Added
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
