# OpenSSF Scorecard — 2026-07 baseline

> SEC-38: a dated Scorecard report committed to the repo, not just claimed. Generated
> with the real `scorecard` CLI (`scorecard --repo=github.com/ChelseaKR/trans-docs-navigator`)
> against **live GitHub API data**, on 2026-07-05.
>
> **Important scope note:** this run reflects the state of the **remote `main` branch on
> GitHub**, i.e. the repo *before* this remediation pass's changes are committed and
> pushed (this pass leaves all changes as uncommitted working-tree edits per its ground
> rules — nothing was pushed to produce this baseline). Treat this as the honest "before"
> snapshot; re-run `scorecard --repo=github.com/ChelseaKR/trans-docs-navigator` after
> these changes are reviewed and pushed, and append a new dated section below rather than
> overwriting this one.

## Aggregate score: 5.8 / 10

| Check | Score | Reason |
|---|--:|---|
| Binary-Artifacts | 10/10 | no binaries found in the repo |
| Branch-Protection | 3/10 | branch protection is not maximal on `main` (see `branch-protection-2026-07-05.md` for the exact settings and what's missing) |
| CI-Tests | 10/10 | 25/25 merged PRs checked by a CI test |
| CII-Best-Practices | 0/10 | no OpenSSF Best Practices badge (not pursued; low priority for this repo) |
| Code-Review | 0/10 | 0/22 approved changesets — no PR review is currently required (confirmed independently via the branch-protection API; see `branch-protection-2026-07-05.md`) |
| Contributors | 0/10 | single-maintainer repo — expected, not actionable |
| Dangerous-Workflow | 10/10 | no dangerous workflow patterns detected |
| Dependency-Update-Tool | 10/10 | Renovate + Dependabot both present |
| Fuzzing | 0/10 | not fuzzed — out of scope for this app shape (server-rendered HTML, no binary/parser attack surface warranting fuzzing today) |
| License | 10/10 | AGPL-3.0-or-later detected |
| Maintained | 0/10 | Scorecard's "created within the last 90 days" heuristic — not a real signal for this repo's actual activity |
| Packaging | N/A | no packaging workflow detected (app is deployed as a container image, not a published package) |
| Pinned-Dependencies | 9/10 | one non-hash-pinned dependency detected as of this run (Scorecard doesn't distinguish npm lockfile integrity hashes the same way it does for Actions SHAs; `package-lock.json` is committed with full integrity hashes — see CQ-28) |
| SAST | 8/10 | SAST tool (Semgrep) detected but not run on 100% of commits (matches the audit: `security-sast`'s trigger is push/PR, which covers all commits landing on `main`, so this is likely a normalization artifact of the check, not a real gap) |
| Security-Policy | 10/10 | `SECURITY.md` detected |
| Signed-Releases | N/A | no releases exist yet (`git tag -l` is empty) |
| Token-Permissions | 0/10 | flagged two workflow-level (not job-level) `write` permission grants: `codeql.yml`'s `security-events: write` and `release.yml`'s `packages: write`. **Both fixed in this remediation pass** — `codeql.yml`'s write scope moved to job level; `release.yml` was rewritten with `contents: read` at workflow level and `packages`/`id-token`/`attestations` write scopes only on the one job (`package`) that needs them. Re-running Scorecard after these changes are pushed should raise this to a much higher score. |
| Vulnerabilities | 10/10 | 0 existing vulnerabilities detected |

## What this baseline changes about the audit's UNVERIFIED controls

- **SEC-36** (Scorecard Vulnerabilities 10/10): now **verified PASS** — 10/10 on this run.
- **SEC-37** (Scorecard aggregate ≥ 8): **not yet met** (5.8/10 today). The two lowest,
  most fixable components are Branch-Protection (3/10 — see the ⛔ action items in
  `branch-protection-2026-07-05.md`, which require the repo owner's own settings change)
  and Token-Permissions (0/10 — code-fixed in this pass, not yet reflected until pushed).
  Code-Review (0/10) and Contributors (0/10) are structurally hard to move for a
  single-maintainer repo and are not, by themselves, evidence of a real security gap.
- **CICD-03** (Scorecard Token-Permissions 10/10): the two real findings behind this
  score are fixed in this remediation pass's working-tree changes (see above); the score
  itself won't update until `.github/workflows/scorecard.yml` runs against pushed changes.
- **CICD-11** (Scorecard Branch-Protection ≥ 8): **open** — needs the repo-owner actions
  listed in `branch-protection-2026-07-05.md` (require PR review, add the new required
  checks, consider `enforce_admins`).

## Re-running this report

```sh
scorecard --repo=github.com/ChelseaKR/trans-docs-navigator --format=default
```

or let `.github/workflows/scorecard.yml` do it on the weekly schedule / next push to
`main`, and publish its SARIF to the Security tab (public repo; no Advanced Security
purchase needed). Append a new `## YYYY-MM` section below on each re-run — don't
overwrite this baseline.
