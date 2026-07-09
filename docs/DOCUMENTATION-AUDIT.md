# Documentation Audit

Last reviewed: 2026-07-08. Base branch: `main`.

This audit records the documentation sweep and remediation loop for this repository. It checks the docs as a system: entry points, root-level process and legal files, project scope, setup and validation notes, safety and privacy posture, architecture and planning docs, local links, and the places where code, tests, workflows, and docs meet.

## Audit Results

| Area | Result | Evidence |
| --- | --- | --- |
| Entry docs | pass | `README.md` present |
| Security/process docs | pass | CONTRIBUTING.md, SECURITY.md, CHANGELOG.md |
| Architecture/planning docs | pass | 0 architecture/interface docs; 5 planning/research docs |
| Safety/privacy/audit docs | pass | 11 safety/privacy/accessibility/audit docs |
| Validation surface | pass | 24 test files; 9 workflow files |
| Local doc links | pass | 43 authored-doc links checked; 0 unresolved |

## Root-Level Documentation Audit

This section covers hand-authored documentation at the repository root and root-adjacent GitHub templates. It is separate from the `docs/` inventory so README, process, legal, release, and project-specific root files do not get hidden inside the larger docs tree.

| Surface | Result | Evidence |
| --- | --- | --- |
| Root README | pass | Present: `README.md` |
| Root process docs | pass | Present: `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md` |
| Root legal, citation, and conduct docs | pass | Present: `LICENSE`, `NOTICE`, `CITATION.cff`, `CODE_OF_CONDUCT.md` |
| Other root project docs | info | None found. |
| Root-adjacent GitHub templates | pass | `.github/PULL_REQUEST_TEMPLATE.md`, `.github/CODEOWNERS`, `.github/ISSUE_TEMPLATE/law-changed.md` |
| Root/template doc links | pass | 22 root-level/template links checked; 0 unresolved |

Root-level files checked:

- `CHANGELOG.md`
- `CITATION.cff`
- `CODE_OF_CONDUCT.md`
- `CONTRIBUTING.md`
- `LICENSE`
- `NOTICE`
- `README.md`
- `SECURITY.md`

Root-adjacent template files checked:

- `.github/PULL_REQUEST_TEMPLATE.md`
- `.github/CODEOWNERS`
- `.github/ISSUE_TEMPLATE/law-changed.md`

## Remediation In This PR

- Added missing root-level remediation docs found by the audit loop, including legal, conduct, contribution, or security files where absent.
- Added `docs/PROJECT-SCOPE.md` as the plain-language project and boundary map.
- Added this audit record so future doc changes have a dated baseline.
- Added or refreshed the docs index so scope, audit, and primary docs are easy to find.
- Fixed or added root/doc remediation files: `NOTICE`.

## Repo Surfaces Checked

Package and workspace metadata:

- Node workspace `package.json` named `trans-docs-navigator` (scripts: a11y, citation:coverage, content:validate, dev, disclosure:check, eval, eval:bedrock, freshness).

Source and operations surfaces seen at the repo root:

- `Dockerfile`
- `eval/`
- `infra/`
- `Makefile`
- `package-lock.json`
- `package.json`
- `public/`
- `scripts/`
- `src/`
- `tests/`

Workflow files checked:

- `.github/workflows/ci.yml`
- `.github/workflows/codeql.yml`
- `.github/workflows/container-scan.yml`
- `.github/workflows/content-watch.yml`
- `.github/workflows/deploy-aws-preview.yml`
- `.github/workflows/release.yml`
- `.github/workflows/scorecard.yml`
- `.github/workflows/secret-scan-scheduled.yml`
- `.github/workflows/standards.yml`

## Documentation Inventory

| Category | Count | Representative files |
| --- | ---: | --- |
| architecture and interfaces | 0 |  |
| entry points and repo process | 11 | `.github/CODEOWNERS`, `.github/ISSUE_TEMPLATE/law-changed.md`, `.github/PULL_REQUEST_TEMPLATE.md`, `CHANGELOG.md`, `CITATION.cff`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `LICENSE`, plus 3 more |
| operations and release | 2 | `docs/DEPLOY-AWS-PREVIEW.md`, `docs/DEPLOY-PREVIEW.md` |
| other docs | 7 | `corpus/README.md`, `docs/I18N.md`, `docs/OPERATIONS.md`, `docs/PROJECT-SCOPE.md`, `docs/README.md`, `docs/STATUS.md`, `infra/README.md` |
| planning and research | 5 | `docs/IMPROVEMENT-PLAN-2.md`, `docs/IMPROVEMENT-PLAN.md`, `docs/PRODUCTIONIZATION-PLAN.md`, `docs/ROADMAP.md`, `docs/SEO-PLAN.md` |
| safety, privacy, accessibility, and audits | 11 | `docs/DOCUMENTATION-AUDIT.md`, `docs/RESPONSIBLE-TECH-AUDITS.md`, `docs/audits/accessibility-2026-05-31.md`, `docs/audits/branch-protection-2026-07-05.md`, `docs/audits/coverage.md`, `docs/audits/data-card.md`, `docs/audits/dpia.md`, `docs/audits/eval-report.md`, plus 3 more |

Full hand-authored doc inventory checked by this pass:

- `.github/CODEOWNERS`
- `.github/ISSUE_TEMPLATE/law-changed.md`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `CHANGELOG.md`
- `CITATION.cff`
- `CODE_OF_CONDUCT.md`
- `CONTRIBUTING.md`
- `LICENSE`
- `NOTICE`
- `README.md`
- `SECURITY.md`
- `corpus/README.md`
- `docs/DEPLOY-AWS-PREVIEW.md`
- `docs/DEPLOY-PREVIEW.md`
- `docs/DOCUMENTATION-AUDIT.md`
- `docs/I18N.md`
- `docs/IMPROVEMENT-PLAN-2.md`
- `docs/IMPROVEMENT-PLAN.md`
- `docs/OPERATIONS.md`
- `docs/PRODUCTIONIZATION-PLAN.md`
- `docs/PROJECT-SCOPE.md`
- `docs/README.md`
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

## Link Check

- Checked 43 local links in authored Markdown and MDX docs.
- Unresolved authored-doc links after remediation: 0.
- Root-level/template unresolved links after remediation: 0.

Audit scope notes:

- Generated sites, deployed app routes, raw third-party HTML captures, and golden fixture websites were inventoried as product or data surfaces but excluded from authored-doc link failure counts.

## Validation Notes

- The audit was generated from a clean worktree based on `origin/main` for this PR branch.
- Ran a local relative-link check over hand-authored Markdown and MDX docs.
- Ran an explicit root-level documentation presence and link check for README, process, legal, project, and template docs.
- Ran `git diff --check` across the PR worktrees after remediation.
- Product test suites remain the authority for runtime behavior; this PR changes documentation only.
