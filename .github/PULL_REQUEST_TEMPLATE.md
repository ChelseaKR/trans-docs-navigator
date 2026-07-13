<!-- Thanks for contributing! Keep PRs focused. Run `make verify` before opening. -->

## What & why

<!-- One or two sentences. Link any "law changed in X" issue this resolves. -->

## Type of change

- [ ] Corpus add/correction (jurisdiction data)
- [ ] App / engine code
- [ ] Gate / CI / tooling
- [ ] Docs

## Corpus changes — required if you touched `corpus/`

- [ ] Every new/edited record cites a **primary, official** source (URL + title).
- [ ] `last_verified` is the date I actually checked the claim against that source.
- [ ] The `verifier` is listed by exact name in `corpus/VERIFIERS.json`.
- [ ] Volatile/unconfirmed claims are set to `verification_status: needs_reverification`.
- [ ] Every claim in the record — **every fee, timeline, form id, and requirement** — is stated by
      the page the record cites. Not by a page it links to. Not by a page you know is right. **That
      page.** If it isn't there, cite a source that says it or drop the claim.
- [ ] If you cited a new URL: `make source-snapshot` + a reviewed drift baseline (docs/OPERATIONS.md).
- [ ] `make content freshness citation fidelity readability eval` pass locally.

## Checks

- [ ] `make verify` is green (all blocking gates).
- [ ] No direct identity fields enter runtime API/log code, and raw request content is not reflected (privacy gates pass).
- [ ] Accessibility unaffected or improved (mechanical a11y + contrast pass).
