# Lapsed-record handling: what a visitor sees, 2026-10-17

Measured on 2026-10-17, five days after the cliff described in
[`docs/HELP-WANTED.md`](../HELP-WANTED.md). Method: ran the app with the real clock and
read the rendered pages, then ran `freshnessOf` over the corpus.

Nothing here marks a record verified, changes a `last_verified` date, or claims a person
reviewed anything. No record, date, or verifier was touched by this change.

## The position

| | Count |
|---|---|
| Jurisdiction records in the corpus | 688 (344 English, 344 Spanish) |
| Serveable as current on 2026-10-17 | **0** |
| Past their recheck SLA | 530 (265 English, 265 Spanish) |
| Already `needs_reverification` before the cliff | 158 (79 English, 79 Spanish) |
| Referral records still current | 12 until 2026-12-05 (unchanged from HELP-WANTED; not re-measured here) |
| Records verified by a named human | 0 of 1000 (launch gate 1, unchanged) |

On 2026-10-11 the same script finds 218 English records current. On 2026-10-12 it finds 0.

## Was the handling honest? Mostly yes, and the core was right

The freshness contract held. On a lapsed step the checklist, packet, guide and relocation
plan withhold the record's statement, fee, timeline and prerequisites and hand over only the
agency's own URL, under a separate "Check these official pages yourself" heading. The caption
beside each source already read "recorded {date} · not yet verified by a named reviewer", never
"verified". Nothing on a lapsed checklist step is presented as a current fact.

## What was unclear or misleading

1. **No page said the lapse was site-wide.** A visitor chose a state, filled the intake, and
   got four steps that each said "Needs reverification" with the details missing. Nothing told
   them in advance, or why every state looked the same.
2. **"Needs reverification, so we don't show it as current."** Jargon, and it did not say what
   was missing or what to do. It also read as if the details were shown, only labeled.
3. **"We have not re-checked these pages recently."** Implies an earlier check by someone. The
   date is the date a record was compiled, and no named person has verified any of them.
   Reworded to describe the date as when the page was recorded.
4. **"Your steps ... each links to its official source and the date it was last checked"** and
   the guide index promise of "costs, timelines" were false for every lapsed page.
5. **A lapsed document was filed under "Not yet covered".** That heading means we never looked.
   The same document also appeared as a step, so it was listed twice with a contradictory label.
6. **The cost summary said "4 step(s) have no fee listed in our sources"** for steps whose fee
   was being withheld, not absent. That is a statement about our sources that we cannot make.
7. **/compare printed the claim text of lapsed records.** The checklist withheld it. The
   comparison table showed fees, forms and process text from lapsed records under a
   "needs reverification" badge, inside a disclosure labeled "Sources".
8. **/compare "No path documented" had no lapse signal at all.** `classifyCell` returned the
   no-path status before it looked at freshness. 76 cells (of 510 across all five documents and
   both changes) told a reader in a hostile jurisdiction that a source describes no route, with
   nothing to say the record was past its recheck date. A stale absence is a stale claim.
9. **The answer scaffolding said "I last checked it on {date}"**, the same implied-review problem.

## What changed

- A page-level note (`ui.lapseNote`, EN and ES) on the checklist, packet and guide whenever at
  least one step is lapsed. It says what is and is not shown, what the date means, and where to
  go instead. It does not hard-code that nobody has verified anything: the per-source caption
  already says that line by line and will change by itself once a roster human verifies a record.
- Home page: a note computed from the live corpus count, so it states the position before the
  intake form and disappears when no record is lapsed (`lapseCounts` in `api/router.ts`).
- Per-step flag, stale-sources note, gap reason and answer scaffolding reworded without
  "re-checked" or "last checked".
- Lapsed documents get their own heading, "Past our re-check date", instead of "Not yet covered".
- Cost summary: a lapsed step is reported as "costs withheld", never as "no source prices it".
- /compare: a cell with any lapsed record shows a visible "Out of date" mark, withholds the
  claim text (including for "No path documented"), and keeps the official link. The status
  itself is unchanged, so no cell is re-labeled "Documented". `CompareCell.lapsed` is new.
- Methodology page paragraph rewritten to match.
- Spanish strings are new and machine-assisted like the rest of the Spanish; a native speaker
  has not reviewed them. The site's existing machine-translation notice still applies.

## Left alone, and why

- **No record, `last_verified`, `verification_status`, or verifier was changed.** Re-dating is
  the verifier's act, not the code's.
- **/answer**: for a question about one state it prints one "may have changed" paragraph per
  lapsed related rule, about 25 for a California cost question, many about unrelated federal
  documents. Honest but noisy. Collapsing them changes the answer composer and the citation
  gate's inputs, so it is a separate change.
- **/plan and /move** keep their existing lapse behavior; they gained the reworded strings only.
- **SEO meta descriptions** on guide pages still say "what each costs, how long it takes".
  Indexed snippets promise more than a lapsed page delivers.
- **The portable edition** shares the checklist and comparison engines and judges freshness by
  the reader's device clock, so it inherits these changes when rebuilt. Not rebuilt here.

## Other things found while verifying

- `make test` was red on `main` before this change: nine tests read the real clock and assumed
  a corpus with current records (two `/readyz` tests, the citation-gate efficacy test, the
  fee-waiver, minors and Spanish-page tests, and two cost-summary tests). They now pin
  `TEST_TODAY`. This is a test fix, not a loosened gate; the production code path still uses
  the real clock.
- `/readyz` returns 503 with `freshness: unavailable` today, by design (fail closed with no
  current record). `render.yaml`, the Dockerfile healthcheck and the Lambda adapter probe
  `/healthz`, so serving continues. Anything that probes `/readyz` would pull the service.
- `make verify` on this machine: `security` fails on the dependency audit (0 critical, 7 high),
  also on `main`; `i18n-overflow` needs a browser build the sandbox lacks (see the PR for how
  it was run). Neither is caused by this change.

## What closes the gap

Only a named human reading each source. See `docs/HELP-WANTED.md` and
`docs/VERIFIER-WORKBENCH.md`. Verifying a jurisdiction resets that jurisdiction's SLA; it does
not stop the clock for the rest.
