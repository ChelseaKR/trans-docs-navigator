# Project Scope

Last reviewed: 2026-07-08. Base branch: `main`.

This file is a plain-language map of the project as it exists on `main`. It does not replace the README, roadmap, audit docs, or source comments. It points to them so a reviewer can see the whole shape without reading every file first.

## What This Project Is

Trans Docs Navigator helps people build a state-by-state checklist for legal name and gender-marker changes. It links official forms, cites source law or agency guidance, supports English and Spanish, and avoids collecting identity details.

Package metadata checked in this pass:

- Node workspace `package.json` named `trans-docs-navigator` (scripts: test, typecheck, lint, dev).

## Who It Serves

- People researching name or gender-marker document changes.
- Community helpers and legal-information projects reviewing cited steps.
- Maintainers building privacy-first legal-information software.

## What It Covers

- Corpus records for supported jurisdictions and federal documents.
- Checklist, guidance, forms, citation, retrieval, generator, freshness, and logging code.
- Docs for operations, deployment, status, SEO, production plans, audits, and roadmaps.
- Eval data, citation coverage, privacy checks, readability, i18n, accessibility, and E2E tests.
- Preview and AWS deployment material.

## How It Is Put Together

- api/ contains guidance, checklist, retrieval, citation, forms, server, and generator logic.
- corpus/ contains jurisdiction records, verifiers, and source hashes.
- src/ contains the web surface.
- docs/ contains deployment, operations, audits, screenshots, and launch planning.
- tests/ and e2e/ cover legal content behavior and browser flows.

Observed source and operations surfaces:

- `Dockerfile`
- `Makefile`
- `api/`
- `corpus/`
- `eval/`
- `forms/`
- `infra/`
- `loadtest/`
- `package.json`
- `scripts/`
- `src/`

GitHub workflow files checked:

- `.github/workflows/ci.yml`
- `.github/workflows/codeql.yml`
- `.github/workflows/container-scan.yml`
- `.github/workflows/content-watch.yml`
- `.github/workflows/deploy-aws-preview.yml`
- `.github/workflows/release.yml`
- `.github/workflows/scorecard.yml`
- `.github/workflows/secret-scan-scheduled.yml`
- `.github/workflows/standards.yml`

## Trust Boundaries

- Every substantive claim is expected to carry a citation and last-checked date.
- The product gives information, not legal advice.
- Privacy is part of safety: the app avoids collecting identity details and treats progress saving carefully.

## Outside This Scope

- It does not replace counsel or court/agency instructions.
- Corpus records need named-human verification before launch.
- Jurisdictions and legal facts change, so freshness work never ends.

## Docs And Evidence Checked

This pass checked 31 hand-authored doc or metadata files, 25 test files, and 9 workflow files on `main`. The count excludes vendored provider licenses, dependency folders, generated cache files, and large generated artifact history.

Primary docs checked:

- `.github/ISSUE_TEMPLATE/law-changed.md`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `CHANGELOG.md`
- `CITATION.cff`
- `CODE_OF_CONDUCT.md`
- `CONTRIBUTING.md`
- `LICENSE`
- `README.md`
- `SECURITY.md`
- `corpus/README.md`
- `docs/DEPLOY-AWS-PREVIEW.md`
- `docs/DEPLOY-PREVIEW.md`
- `docs/I18N.md`
- `docs/IMPROVEMENT-PLAN-2.md`
- `docs/IMPROVEMENT-PLAN.md`
- `docs/OPERATIONS.md`
- `docs/PRODUCTIONIZATION-PLAN.md`
- `docs/RESPONSIBLE-TECH-AUDITS.md`
- `docs/ROADMAP.md`
- `docs/SEO-PLAN.md`
- `docs/STATUS.md`
- `docs/audits/accessibility-2026-05-31.md`
- `docs/audits/branch-protection-2026-07-05.md`
- `docs/audits/coverage.md`
- `docs/audits/data-card.md`
- `docs/audits/dpia.md`
- `docs/audits/eval-report.md`
- `docs/audits/model-card.md`
- `docs/audits/residual-risk.md`
- `docs/audits/scorecard-2026-07.md`
- `infra/README.md`

Representative test files checked:

- `tests/bedrock.test.ts`
- `tests/checklist.test.ts`
- `tests/citation.test.ts`
- `tests/corpus.test.ts`
- `tests/e2e/i18n/pseudo-overflow.spec.ts`
- `tests/e2e/i18n/pseudo-server.ts`
- `tests/embedding-retrieval.test.ts`
- `tests/forms.test.ts`
- `tests/freshness.test.ts`
- `tests/generator.test.ts`
- `tests/guidance.test.ts`
- `tests/i18n-parity.test.ts`
- `tests/i18n-pseudo-hook.test.ts`
- `tests/legal.test.ts`
- `tests/log.test.ts`
- `tests/observability.test.ts`
- `tests/offline.test.ts`
- `tests/pages.test.ts`
- `tests/privacy-egress.test.ts`
- `tests/render.test.ts`
- `tests/retrieval.test.ts`
- `tests/router.test.ts`
- `tests/secure-resume.test.ts`
- `tests/seo.test.ts`
- `tests/spanish-parity.test.ts`

## Validation Notes

For this docs PR, validation means the scope file was generated from the clean `origin/main` worktree, reviewed against repo metadata and docs inventory, and checked with `git diff --check`. Project test suites are still the authority for code behavior, because this PR changes documentation only.
