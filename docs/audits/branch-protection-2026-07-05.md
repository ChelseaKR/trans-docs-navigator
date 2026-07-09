# Branch Protection Snapshot — 2026-07-05

> Instantiates CI-CD-STANDARD §"branch protection" as a committed artifact rather than
> an unverifiable server-side claim. Raw response: `branch-protection-2026-07-05.json`
> (`GET /repos/ChelseaKR/trans-docs-navigator/branches/main/protection`, read-only —
> fetched during the 2026-07-05 remediation pass, no setting changed by that pass).
> `GET /repos/.../rulesets` returned `[]` — no repo-level ruleset object is in use;
> the classic branch-protection API above is the live mechanism.

This resolves the "no committed ruleset artifact" caveat behind several controls that
the audit could only mark UNVERIFIED from the repo contents alone (CQ-37/38/40/43,
CICD-11/12/14/15/16, SEC-15). With the real settings now on record:

| Setting | Value | Reading |
|---|---|---|
| Required status checks (strict) | `verify`, `smoke-journey`, `a11y-browser`, `security-sast`, `container-and-infra` | **Stale** — does not yet include `secret-scan` or `workflow-sast` (both added to `ci.yml` in this same remediation pass). CICD-13 needs these added as required checks. |
| Required pull request reviews | **Not configured at all** (`required_pull_request_reviews` key absent from the API response) | CQ-37 ("PR required, ≥1 review") is **not mechanically enforced** — a maintainer (or anyone with push access) can currently merge to `main` without any review. This is a real gap, not just an UNVERIFIED one. |
| `enforce_admins` | `false` | CICD-15 gap — the repo owner can bypass every rule above, including the ones this file just confirmed are already weak. |
| `required_signatures` | `false` | Matches CQ-41 FAIL (sampled commits are unsigned). |
| `required_linear_history` | `false` | Matches CQ-41 FAIL — this is exactly how `bc26ca9` landed as a merge commit. |
| `allow_force_pushes` | `false` | ✅ Good — CICD-16 satisfied. |
| `allow_deletions` | `false` | ✅ Good. |
| `required_conversation_resolution` | `false` | Minor gap — unresolved PR conversations can currently be merged past. |

## What this means for the controls it unblocks

- **CICD-13** (required checks incl. zizmor + CodeQL-actions): now genuinely **FAIL** for
  a different, more specific reason than the audit gave — the mechanism (required status
  checks) exists and is strict, but its list is stale. **Action needed:** add `secret-scan`
  and `workflow-sast` to the required-checks list (and, once wired, `ossf-scorecard`).
- **CQ-37 / CQ-38 / CQ-40 / CQ-43** (review requirement, stale-review dismissal, checks
  green + up-to-date, self-merge prohibited): the "up-to-date branch" half is real
  (`strict: true`). The review-requirement half is **not configured** — there is currently
  no mechanical control preventing a direct merge with zero review. For a single-maintainer
  repo this is a real, defensible operating mode (there is no second reviewer), but it
  should be a **stated** operating mode, not a silent absence — see the README conformance
  table's Responsible-Tech row and CONTRIBUTING.md.
- **CICD-11/12** (Scorecard Branch-Protection ≥ 8, required reviewers ≥ 2 via ruleset):
  still not achievable at ≥ 2 reviewers on a solo-maintainer repo; now backed by a real
  artifact instead of an assumption.
- **SEC-15** (ruleset blocks on Dependabot alert ≥ 7.0): no such rule exists in either the
  classic protection response or the (empty) rulesets list — genuine **FAIL**, not merely
  unverifiable.

## ⛔ Action this repo's owner needs to take (cannot be done by an automated remediation pass)

Changing branch-protection settings is a live, write-effect GitHub API/UI action and was
explicitly out of scope for this remediation pass (see the plan's ground rules). To close
the gaps above:

1. Add `secret-scan` and `workflow-sast` (and, once P1-2/Scorecard lands, its check name)
   to **Settings → Branches → main → Require status checks to pass**.
2. Decide and record an explicit review policy: either turn on **Require a pull request
   before merging** with 0–1 approvals (honest for a solo maintainer) and **Require review
   from Code Owners** (now that `.github/CODEOWNERS` exists), or explicitly document in
   `docs/RESPONSIBLE-TECH-AUDITS.md` §F why direct-push-to-main is the accepted operating
   mode for this repo today.
3. Consider `enforce_admins: true` given the sensitivity of this repo's content — currently
   every rule above is owner-bypassable.
4. Consider `required_conversation_resolution: true` (cheap, no downside for a solo repo).

Re-run `gh api repos/ChelseaKR/trans-docs-navigator/branches/main/protection` and re-commit
this pair of files after making any of the above changes, so the artifact stays current.
