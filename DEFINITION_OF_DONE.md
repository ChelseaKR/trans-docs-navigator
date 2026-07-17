# Definition of Done

What "done" means for a change to this repository. Each item is labeled by how it
is enforced: **[gate]** = machine-enforced and merge-blocking (the pipeline fails,
the change does not land) · **[review]** = enforced by a human reading the PR
against this list · **[human-gate]** = one of the standing launch gates that no PR
can close (see `docs/STATUS.md`) — a change is *done* when it honestly reflects
those gates' open state, never when it simulates closing them.

A change is done when all of the following hold:

## 1. Gates are green — [gate]

- `make verify` passes: the full merge-blocking pipeline, CI parity. The stage
  count is derived mechanically (`make gate-count`), so it is not restated here.
- CI's additional blocking checks pass: real-browser accessibility (pa11y/axe),
  Lighthouse CI, SAST (Semgrep/CodeQL), gitleaks, container CVE scan, zizmor.
- No gate is skipped, weakened, or marked non-blocking to get a change in. A
  deliberate change to what a gate enforces is an ADR (`docs/adr/`), not a patch
  detail.

## 2. Behavior is tested — [gate] + [review]

- The coverage floors (lines/branches/functions, enforced by
  `scripts/run-tests.ts`) hold — **[gate]**.
- New behavior ships with tests that exercise the claimed behavior, not just the
  lines; bug fixes ship with a pinning test that fails on the old code —
  **[review]**.

## 3. The docs tell the truth — [gate] + [review]

- Self-description drift is machine-checked where it can be: gate counts
  (`gate-count`), launch-gate status (`launch-gates`) — **[gate]**.
- Everything else is reviewed against the honesty rule: README/CHANGELOG/docs
  claims match what the code does *on this branch*. Deferred work is called
  deferred; unsigned artifacts are called unsigned; structure that ships ahead of
  counsel-reviewed copy says so — **[review]**.
- `CHANGELOG.md` gets an `[Unreleased]` entry for anything a user or operator
  would notice.

## 4. Corpus rules hold — [gate] + [human-gate]

- Schema, source, verifier-in-roster, freshness, citation coverage, and source
  fidelity gates pass (`make content freshness citation fidelity`) — **[gate]**.
- No legal fact is served as current without a named human verifier; unconfirmed
  claims carry `verification_status: needs_reverification` and render degraded —
  **[gate]**, backed by the open launch gates — **[human-gate]**.

## 5. Privacy holds — [gate] + [review]

- `privacy-lint` and the sentinel egress test pass; no direct identity fields
  enter runtime API/log code; raw request content is not reflected — **[gate]**.
- Any new data flow — however innocuous-looking — re-opens the DPIA
  (`docs/audits/dpia.md`) before the change is done — **[review]**; the DPIA
  sign-off itself is a **[human-gate]**.

## 6. Accessibility holds — [gate] + [human-gate]

- Mechanical a11y + contrast gates and the CI browser gate pass — **[gate]**.
- A change that adds or reshapes UI adds its surface to the PENDING rows of the
  manual-walkthrough artifact (`docs/audits/accessibility-*.md`) rather than
  inheriting the old walkthrough's conclusions — **[review]**; the walkthrough
  itself is a **[human-gate]**.

## 7. Rollback is stated — [review]

- The PR says how to undo the change. The default answer is "revert the merge
  commit"; the PR must call out anything that makes a plain revert insufficient
  (snapshot/baseline files, cache format changes, corpus schema migrations,
  workflow changes already consumed by CI) and state the manual steps.

## 8. Observability is stated — [review]

- A change to server-visible behavior names the signal an operator would watch:
  a structured-log field (`api/log.ts` allowlist), a `/metrics` counter, or an
  SLO (`slos/`). "This PR has no runtime surface" is an acceptable answer when
  true. New signals respect the privacy posture — non-PII, allowlisted, no RUM.

## 9. Quality characteristics are named — [review]

- The PR names the primary ISO 25010 characteristic(s) it affects (functional
  suitability, reliability, security, maintainability, usability/accessibility,
  performance efficiency, portability, compatibility) so review effort lands
  where the change claims to matter.

## 10. Release discipline — [review] + [human-gate]

- Version bumps and git tags are human actions, never automation's; release-prep
  file changes may land, the tag itself may not.
- Nothing in the change requires a repo-settings, secrets, or
  branch-protection edit to be true.

---

*This file is review-material, not a parser target: the machine-checked facts it
references (gate count, launch-gate status, coverage floors) are derived by their
own gates, so this file states none of them as numbers that could drift.*
