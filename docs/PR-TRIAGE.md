# Open pull request triage

Date of triage: 2026-08-28. Read-only review against the GitHub API and a
scratch clone. Nothing was merged, closed, commented on, labelled, or re-run.
This file is the only change.

This repository helps people navigate identity-document changes. A confidently
wrong answer here costs someone money they may not have, or outs them somewhere
that is dangerous. So the audit leads with the claim question and nothing else,
and it deliberately proposes no legal or procedural text of its own.

## 1. Legal and procedural claims: the audit, first

### The standard this queue was judged against

`corpus/README.md`:

> one JSON record per `(jurisdiction x document x change-type x language)`. Each
> record is the unit of **retrieval** and the unit of **citation** - there is no
> claim in the product that does not trace to a record here.

> `source` | `{ url, title, last_verified (ISO), verifier }` - guardrail #1: no
> claim renders without this

> `make fidelity` ... reads them **offline** and fails the build when a record
> asserts a fee, a duration, a form id, a hard requirement, or a
> `residency_bound` flag that **its own cited page never states**.

`README.md`, design guarantee 1:

> **No claim without a citation - and no citation without a matching source.**
> Every substantive statement renders with a source and a last-verified date, or
> it does not render.

`DEFINITION_OF_DONE.md` section 4:

> No legal fact is served as current without a named human verifier.

### Verdict

**No open pull request adds or changes a user-facing legal or procedural
claim.** Not one of the eleven touches `corpus/`, `corpus/snapshots/`,
`forms/registry.json`, or `forms/form-hashes.json`. The four human-authored PRs
all move in the opposite direction: each one adds a disclosure of something the
system does *not* know. That is the honest headline and it is worth stating
plainly rather than manufacturing a finding.

Two real but lower-severity items belong under this heading anyway.

#### 1a. #121 writes two uncited legal sentences into a test fixture, bound to real record ids

File: `tests/render.test.ts`, in the block appended at the end.

The fixture builds two records, each with a real government `source.url` (a
`nycourts.gov` court-help page and a `selfhelp.courts.ca.gov` page), each with a
`kind: "claim"` block whose `citations` array points at a record id that really
exists in the corpus, and each carrying a short invented sentence of the form
"you file X in Y court". Neither sentence is text the cited record states.

`make fidelity` audits `corpus/` only. **No gate in this repository reads test
fixtures**, so these two claims are uncheckable by construction. They never
reach a user, so this is not a live safety defect. It is a hygiene defect in the
highest-stakes place the repository has: legal-sounding prose, in the tree,
bound to a real record id and a real court URL, one copy-paste away from the
corpus.

No correction is proposed here, because proposing one would be exactly the act
the repository's own standard forbids. The fix is structural: make the fixture
prose obviously synthetic, or extend the fidelity idea so fixture claim text can
never be mistaken for record text.

#### 1b. #122 resets a legal-content freshness stamp on an architecture-only review

File: `docs/ROADMAP.md`, line 5. The banner moves from
`Last verified: 2026-07-12` to `Last verified: 2026-08-15`. The same banner
continues:

> Legal requirements change; treat every jurisdiction fact as needing
> reverification before launch.

and its cadence is "quarterly for legal content". The pull request's own added
text scopes what was actually rechecked: "Architecture statements in
**sections 1, 5, 6 and 8** were re-checked against the code on 2026-08-15." The
document also carries section 10, Legal and compliance, and section 9, Community
and partner review. Neither is in that list.

So a global stamp that governs a quarterly legal-content clock is being advanced
a month on the strength of a code-versus-docs architecture pass. Everything else
in #122 is a genuine honesty correction and should land. Recommendation: keep
the architecture note, and either leave the banner at 2026-07-12 or split it
into two dated stamps, one for architecture and one for legal content.

#### Audited clean

- **#119**'s two new user-facing strings were written specifically to assert
  nothing about any jurisdiction, and the PR ships a test that enforces it:
  `tests/coverage-honesty.test.ts`, "the disclosure asserts nothing about what
  the state requires", greps the copy for `\bno (further|additional|other)
  steps\b` and `\bnothing (else|more) is (needed|required)\b`.
- **#121**'s new user-visible string describes the tool's own monitoring, not a
  rule.
- **#120** touches gates, fixtures and eval plumbing only.
- The seven Dependabot pull requests touch workflow SHAs and `package*.json`
  only.

## 2. Live or retired

**Live, and mid-remediation. Do not mass-close.**

- Four issues filed 2026-08-15 map one to one onto the four human pull requests:
  #117 to #121, #116 to #120, #115 to #122, #114 to #120. This is a planned,
  self-audited remediation batch.
- Last non-bot commit `ddc6d2b`, 2026-08-15, at the end of a dense run of
  security work (#118, #111, #103, #102, #101, #100).
- All eleven pull requests are based on the current tip and are zero commits
  behind. Nothing has rotted.
- CI physically cannot run. See section 3. The work stopped four days after the
  issues were filed, when the runners stopped.

**On `civic-rag-starter-kit` being archived:** that repository's `CLAUDE.md`
calls itself "the base for trans-docs-navigator". That claim is false, and #122
exists partly to say so. Verified: this repository is TypeScript on `node:http`
with zero production dependencies; the starter kit is a Python package. There is
no submodule, no vendored copy, no fork lineage. The only shared artifact is a
standards repository fetched read-only at CI time. **The archive of the sibling
says nothing about this repository.** This is not a descendant being wound down.

## 3. Read the checks with suspicion: they are absent, not red

**Billing starvation, confirmed.** Every Actions job from 2026-08-16T01:22:30Z
onward reports `steps: 0`, `runner_id: 0`, a 2 to 3 second wall time, and the
check-run annotation:

> The job was not started because recent account payments have failed or your
> spending limit needs to be increased.

Verified on run `31919421042` (7 jobs, all in that shape). The last run that
really executed is `31919331834`, a push to `main` at 2026-08-16T01:20Z, where
all 8 jobs succeeded with 8 to 13 steps each.

`main` is protected with five required contexts (`verify`, `smoke-journey`,
`a11y-browser`, `security-sast`, `container-and-infra`) and `strict: true`.
**All five are starved.** Nothing merges until the budget is restored.

Four of the eleven (#119, #120, #121, #122) have never had a real CI run at all.

One more absent-not-green case, pre-existing and not introduced by any pull
request: `.github/workflows/scorecard.yml` guards its `upload-sarif` step with
`if: ${{ !github.event.repository.private }}`. This repository is private, so
that step has never run. It is the same shape the repository already fixed for
CodeQL in `7d2b73c`. #109 bumps the pin on a step that does not execute.

## 4. The queue, grouped

| Group | Count | PRs |
| --- | --- | --- |
| Human remediation batch (issues #114 to #117) | 4 | #119, #120, #121, #122 |
| Dependabot, GitHub Actions SHA bumps | 4 | #109, #113, #124, #125 |
| Dependabot, npm devDependencies | 3 | #107, #112, #123 |

Drafts: none. Conflicting against `main`: none.

**There is no stack.** All eleven target `main`; every merge base is `ddc6d2b`.
**No pull request would be auto-closed by merging any other**, and none is a
cumulative snapshot of another.

One thing that looks like a stack and is not:

```
main (ddc6d2b)
 |
 +-- 2609d85 -> 43188e0 ----------------------------> #119
 |
 +-- 63b5b16  "fix(deps): bump nanoid to 3.3.18"  <-- already on main
      +-- 150eace -> 1a27f01 -> merge 22c76c2 ------> #120
      +-- d868618            -> merge 1ce32f8 ------> #121
      +-- 303c99f            -> merge d3b0d1b ------> #122
```

`63b5b16` appears in the history of #120, #121 and #122 but in none of their
diffs: nanoid is already at 3.3.18 on `main`. It inflates their commit counts
and nothing else. Separately verified that #107, #112 and #123 each preserve
nanoid 3.3.18 in their regenerated lockfiles, so no Dependabot rebase silently
reverts that advisory fix.

## 5. The headline defect: a TypeScript source file that every gate treats as a binary asset

**#121, `api/watchability.ts`, new, 5821 bytes.**

`git diff --stat` renders it as `Bin 0 -> 5821 bytes`. The cause is at byte
4033, line 89:

```js
const key = `${paths.corpusBaseline}<NUL>${paths.formsBaseline}<NUL>${paths.snapshotIndex}`;
```

Two raw `0x00` bytes were typed into a template literal as a cache-key separator
instead of `\0` escapes. Three consequences, each verified:

1. **The module is unreviewable in the pull request.** GitHub renders a
   NUL-bearing blob as "Binary file not shown". 5821 bytes of new logic, in the
   module that decides which cited sources a user is told cannot be monitored,
   cannot be read in the diff.
2. **The merge-blocking `i18n-utf8` gate skips it rather than failing it.**
   `scripts/i18n-utf8.ts` line 17: `const SKIP = new Set(["binary"]);`, commented
   "non-text assets: images, fonts, compiled blobs". `file --mime-encoding` on
   the file returns `binary`. Running the real gate: on `main` it reports 304
   text files and 4 binary assets skipped; on `pr/121`, 305 text files and
   **5** binary assets skipped, the fifth being `api/watchability.ts` alongside
   four genuine PNGs.
3. **Every other gate passes.** `scripts/lint.ts` on the merged tree is green. A
   NUL inside a JS template literal is legal, so the compiler and the runtime
   accept it. The file works correctly. It simply cannot be reviewed or
   encoding-checked.

This is the target shape exactly: it passes in both states. Fix is two escape
sequences, plus narrowing the gate's `SKIP` set to an asset-extension allowlist
so a source file can never claim binary immunity again.

## 6. #120 closes one fail-open hole and opens another of the same shape

#120's stated purpose is to stop the security gate reporting "0 critical, 0
high" for an audit that never ran. It does that correctly and thoroughly, and it
argues its own case well, in `scripts/security-scan.ts`:

> an escape hatch a pull request can set on itself is a bypass, not an escape
> hatch

and it enforces that: `SECURITY_SCAN_ALLOW_NO_AUDIT` is refused in CI, with a
test proving it, and `SECURITY_SCAN_ROOT` rewrites the verdict to
`[SECURITY_SCAN_ROOT override in effect - NOT a scan of this repository]`, with
a test proving that too.

The same pull request then adds `EVAL_GOLD_POISON` to `eval/gold.ts`, which
replaces the entire accuracy gold set from an environment variable, **with no CI
refusal and no verdict label**. Verified by running the real gate on the pull
request's own tree with the authored 23-item gold set swapped for its own
3-item fixture:

```
EVAL_GOLD_POISON=.../baseline-clean.json node eval/run.ts
  groundedness: 100.0% (>= 95.0%, n=1)
  factual_accuracy: 100.0% (>= 98.0%, n=1)
  eval: groundedness/accuracy/refusal/coverage gates met
```

Nothing in that output says the gold set was substituted. By the pull request's
own description the eval gate is "the only gate that can tell a well-formed
answer from a correct one", and a workflow-file edit can now turn it green
against a gold set of the author's choosing, using the very bypass shape the
same pull request spends three files arguing against.

Recommendation: merge with a fix. Give `EVAL_GOLD_POISON` the `IN_CI` refusal
and the override label `SECURITY_SCAN_*` already has in this same diff.

Checked and clean, for contrast: `RUN_TESTS_GLOB` (pre-existing on `main`) fails
closed. A glob matching nothing still measures coverage against `api/**` and
`src/**` and trips the 90 percent floor.

## 7. #119 is the strongest pull request in the queue, and that was not taken on trust

Its tests were mutation-verified on the merged `pr/119 + pr/121` tree:

- unmutated: 19 of 19 pass;
- with both guards in `src/pages.ts` removed (forcing `stateNote = ""` and
  reverting the cost loop to the old silent `if (!st.cost || st.done) continue;`):
  **8 of 19 fail**, including both named regression tests and "every real state's
  checklist states how many of its steps are unpriced".

So that last test's `if (unpriced > 0)` guard is not vacuous against today's
corpus. It would go silent if the corpus were ever fully priced, which is worth
a comment but is not a defect today.

## 8. Pairwise conflicts, and the non-diff hazards

`git merge-tree --write-tree --messages` over all 55 pairs. Exactly two
conflict:

```
#107 x #112   package.json, package-lock.json
#112 x #123   package.json, package-lock.json
```

The cause is alphabetical adjacency, not semantics: in `devDependencies` the
order is `@playwright/test` (#107), `@types/node` (#112), `js-yaml` (#123), and
#112 sits between the other two. **#107 x #123 does not conflict**, because
#112's line separates them. Merge #112 first and let Dependabot rebase the
others.

Shared files with no conflict: `.github/workflows/codeql.yml` (#109, #124),
`release.yml` (#113, #124), `scorecard.yml` (#109, #124), and `src/i18n/en.ts`,
`src/i18n/es.ts`, `src/i18n/types.ts`, `src/pages.ts` (#119, #121).

### (a) A CHANGELOG hunk landing inside an already-released section

**Cannot occur, and does not.** `CHANGELOG.md` states that no tagged release has
been cut, so there is exactly one section and it is `[Unreleased]`. Separately:
**no open pull request touches `CHANGELOG.md` at all.**

That absence is itself the finding. `DEFINITION_OF_DONE.md` section 3 requires
an `[Unreleased]` entry "for anything a user or operator would notice", and
**#119 and #121 both add new user-visible page content** (a disclosure banner
above the checklist and on the printed packet; a note beside every source that
cannot be monitored). Neither adds an entry. Both are definition-of-done
violations. And because both entries would land in the same `### Added` list,
adding them later is precisely the end-of-list append collision described in (b).
Latent, not yet present.

### (b) Two pull requests appending to one file's end, merged into a syntax error

**Checked, and it does not occur.** #119 and #121 both add keys to the three
`src/i18n/` files and both edit `src/pages.ts`, and `merge-tree` reports clean,
which is exactly the condition under which this hazard hides. So the merged tree
was materialized and executed:

```
node --test tests/coverage-honesty.test.ts   19/19 pass
node --test tests/render.test.ts             13/13 pass
node scripts/i18n-parity.ts                  locale parity: 2 bundles match key-for-key
node scripts/lint.ts                         green
```

They insert at different anchors, so the merge is genuinely correct. The real
merge hazard in this repository is section 5, not an append collision.

## 9. #124 and the workflow overlaps

**#124 is complete.** `main` has 14 `step-security/harden-runner` call sites
across four workflows (`ci.yml` x8, `release.yml` x4, `codeql.yml` x1,
`scorecard.yml` x1). #124 changes all 14, in all four files, to one SHA. No
workflow is missed; the other five workflows do not use harden-runner.

#109, #113 and #125 overlap those files but do not collide, each editing a
different `uses:` line. #109 is correctly grouped so CodeQL's `init`, `analyze`
and `upload-sarif` can never split versions, which is the failure this
portfolio has hit before.

## 10. Recommendations

| PR | Recommendation |
| --- | --- |
| #119 | **Merge first.** Mutation-verified, pure safety gain. Add the missing `[Unreleased]` entry. |
| #120 | **Merge with fix.** Give `EVAL_GOLD_POISON` the CI refusal and verdict label (section 6). |
| #121 | **Merge with fix.** Replace the two NUL bytes with `\0` escapes (section 5), and de-legalize the two fixture sentences (1a). Add the `[Unreleased]` entry. |
| #122 | **Merge with fix.** Do not advance the global freshness stamp on an architecture-only recheck (1b). |
| #124 | Merge. Complete across all 14 sites. |
| #109 | Merge. Correctly grouped. |
| #113 | Merge. |
| #125 | Merge. |
| #112 | Merge, and sequence it first among the npm three. |
| #107 | Merge. |
| #123 | Merge. |

### Safe order of operations

0. **Restore the Actions budget.** All five required contexts are starved.
   Nothing below is safe until they can start, and every check you see today is
   absent rather than passing.
1. **#119.** No conflicts with anything, smallest surface, verified.
2. **#121**, after the NUL fix. Merging it first commits an unreviewable binary
   source file to `main`.
3. **#120**, after the `EVAL_GOLD_POISON` refusal is added.
4. **#122**, after the stamp is corrected. Docs only, so order is free.
5. **#124**, then #109, #113, #125. No conflicts among them in any order; #124
   first because it is the largest and the rest rebase trivially onto it.
6. **#112**, then #107, then #123. Merging #107 and #123 first leaves #112
   conflicting with both at once.

While the budget is down, `make verify` locally is a real substitute for the
`verify` context; the browser-dependent gates are not.

## 11. Verified, and taken on trust

**Verified by running a command or reading the code:**

- Billing starvation on run `31919421042`; the last real run `31919331834`; the
  five required contexts on `main` from the branch-protection API.
- All eleven merge bases equal `ddc6d2b`; all target `main`; all head trees
  distinct.
- All 55 pairwise `merge-tree` results, and the alphabetical-adjacency cause of
  the two conflicts.
- The two NUL bytes at byte 4033 of `api/watchability.ts`, `file --mime-encoding`
  returning `binary`, and the `i18n-utf8` gate's skipped-asset count going 4 to 5
  between `main` and `pr/121`, with the file named.
- `EVAL_GOLD_POISON` producing an all-green, unlabelled eval verdict from a
  3-item substitute for the 23-item authored gold set, by running the real
  `eval/run.ts`.
- #119's tests: 19 of 19 on the merged tree, 8 of 19 failing after the guards
  are removed.
- `i18n-parity` and `lint` green on the merged `pr/119 + pr/121` tree.
- #124 covering all 14 harden-runner sites.
- nanoid 3.3.18 present on `main` and preserved in all three npm pull requests.
- `CHANGELOG.md` having exactly one `[Unreleased]` section, and no pull request
  touching it.
- Issues #114 to #117 and their mapping to the four human pull requests.
- `scorecard.yml`'s private-repository guard, and the repository being private.
- That no open pull request touches `corpus/`, `corpus/snapshots/`,
  `forms/registry.json`, or `forms/form-hashes.json`.

**Taken on trust:**

- That the action SHAs in the Dependabot pull requests correspond to the tagged
  versions in their comments. No SHA was resolved against upstream.
- The correctness of the legal content already in `corpus/`. Out of scope, and
  deliberately not adjudicated.
- That `npm audit` would report the expected advisory in a networked CI run. No
  registry was contacted and no `node_modules` was installed.
- That `tsc --strict` passes on the merged tree. No compiler was available
  offline; the code was executed under Node's type-stripping, which runs but
  does not typecheck.
- Playwright, pa11y, Lighthouse and container-scan behaviour. Not run.

**Noted in passing, out of scope:** `origin` carries roughly thirty stale
feature branches with no open pull request. They are not part of this queue, but
they are why the branch list is hard to read.
