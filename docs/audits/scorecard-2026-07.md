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

## 2026-09: triage of the gap (#159) — CI diagnosis, not a new scored run

This section is deliberately **not** a new `## 2026-09` score table. `scorecard.yml`
itself was silently broken the entire time the 5.8/10 baseline above sat uncorrected —
every scheduled/push run since 2026-07-06 (three consecutive: 07-06, 07-09, 08-11) failed
at the `Run analysis` step with:

```
scorecard had an error: internal error: ListCommits: ... Resource not accessible by integration
```

This is documented upstream behavior (`ossf/scorecard-action` README, "Additional
permissions for private repositories"): on a **private** repo, the default `GITHUB_TOKEN`
needs job-level `issues: read`, `pull-requests: read`, and `checks: read` in addition to
`contents: read`/`security-events: write`, or Scorecard's GraphQL commit/SAST-detection
queries 403. No PAT needed — it's a permissions fix, not a repo-settings one. **Fixed** in
`scorecard.yml` as part of this PR.

This means the number this repo has been citing (5.8/10) was a single hand-run CLI
snapshot from 2026-07-05, not a freshness-checked, continuously-reconfirmed score — the
automation meant to keep it current had silently stopped running two months before this
was ever verified, one more instance of the failure mode this repo's history keeps
surfacing (a control that exists on paper but doesn't actually run).

**Could not confirm the fix with a fresh number in this same PR**: `scorecard-action`
refuses to analyze anything but the repository's default branch (`Only the default
branch main is supported`), so a `workflow_dispatch` run against this PR's branch fails
immediately, by design, regardless of the permissions fix. **Next step, immediately after
this PR merges:** `gh workflow run scorecard.yml --ref main`, then append a real
`## 2026-09` (or later) scored section here from that run's `results.sarif` — don't hand-
wave a number in its place.

One data point worth flagging for whoever reads that fresh run: the **Maintained** 0/10
reason recorded above ("created within the last 90 days") was accurate on 2026-07-05 (the
repo was created 2026-06-05, so it was ~30 days old) but is no longer true — the repo
passed the 90-day mark around 2026-09-03. That doesn't guarantee a higher score (Scorecard
also weighs actual commit/issue activity, which this repo has plenty of), but the specific
reason given for the 0 in the table above has expired; don't assume it still applies
without checking the fresh run.

### Also fixed in this pass (Token-Permissions, workflow-level write scopes)

Two more workflow-level (not job-level) write-scope grants, the same anti-pattern the
Token-Permissions row above already covers for `codeql.yml`/`release.yml`:
`content-watch.yml`'s `issues: write` and `deploy-aws-preview.yml`'s `id-token: write`
were both declared at workflow level (applying to every job by default, even though each
file has exactly one job that needs the grant). Both moved to job level. Re-verified by
grep that every `uses:` across `.github/workflows/` is still SHA-pinned (Pinned-Dependencies
row above) — no regressions introduced.

### Not fixed, and why (triaged, not silently dropped)

- **Branch-Protection (3/10) / Code-Review (0/10)** — unchanged. Both need a live
  repo-settings decision (a review-count policy, `enforce_admins`) that
  `branch-protection-2026-07-05.md` already correctly frames as the repo owner's call, not
  a code change; nothing here overrides that. The one purely mechanical item it also names
  — the required-status-checks list being stale (missing `secret-scan`/`workflow-sast`) —
  is a live GitHub API mutation outside this PR's diff, so it's named here rather than
  applied silently: `gh api -X PATCH repos/ChelseaKR/trans-docs-navigator/branches/main/protection/required_status_checks -f strict=true -f 'contexts[]=verify' -f 'contexts[]=smoke-journey' -f 'contexts[]=a11y-browser' -f 'contexts[]=security-sast' -f 'contexts[]=container-and-infra' -f 'contexts[]=secret-scan' -f 'contexts[]=workflow-sast'` is additive-only (widens required checks, changes no review/admin policy) and is the repo owner's to run.
- **Contributors (0/10)** — single-maintainer repo; structurally unmovable, not a real gap.
- **CII-Best-Practices (0/10)** — not pursued; a prior, explicit, low-priority call for
  this repo, restated rather than silently revisited.
- **Fuzzing (0/10)** — out of scope for this app shape (server-rendered HTML, no
  binary/parser attack surface); same prior call, restated.
- **SAST (8/10) / Pinned-Dependencies (9/10)** — both already investigated as likely
  normalization artifacts of how Scorecard samples commits / distinguishes npm integrity
  hashes from Actions SHA pins, not real gaps; re-confirmed here (every `uses:` under
  `.github/workflows/` is still SHA-pinned) rather than re-litigated.
- **Packaging / Signed-Releases (N/A)** — no releases exist yet; genuinely not
  attainable until a tag is cut, which is outside this PR's scope.

Not chased: no check here was "fixed" by loosening a control, muting a scanner, or
adding a suppression to move a number. Every change above is either a real permissions
bug (scorecard.yml, content-watch.yml, deploy-aws-preview.yml) or a documentation of why
a check stays where it is.
