# Help wanted: 1000 records, 0 named humans, and a date

trans-docs-navigator is a cited checklist for changing the name and gender
marker on identity documents in 52 US jurisdictions. Every claim it serves
carries a citation to an official government page, and no claim renders
without one.

Launch gate 1, machine-derived on every `make verify` run, reads **"0 of 1000
records verified by a named human."** All 1000 carry the `Pilot Seed Reviewer`
placeholder. That gate is why this is a demonstration and not a service, and no
amount of code closes it.

This page is about what closes it, and about a date.

## The date

Measured against `origin/main` on 2026-09-07, from every record's own
`source.last_verified` and `recheck_sla_days`. The corpus is 836 records: 688
jurisdiction records (344 English, 344 Spanish) plus 148 referral records. The
gate's 1000 is those 836 plus the 164 entries in `forms/registry.json`.

| | |
|---|---|
| Records verified by a named human | **0 of 1000** |
| Corpus records serveable as current today | **574** of 836 |
| Already `needs_reverification` | 158 |
| Verified but already past their own SLA | 104 |
| **Jurisdiction records current today that lapse by 2026-10-12** | **438 of 438** |
| The last record of any kind to lapse | 2026-12-05 (12 referral records) |

`api/freshness.ts` resolves currency against the real clock on the serving
path, deliberately, with a comment explaining why. So this is not hypothetical:

**On 12 October 2026, on current data, every jurisdiction record this project
serves has degraded to `needs_reverification`.** 436 of the 438 lapse during
October. What survives past that date is 12 referral records, until 5 December.

The jurisdiction records are the ones carrying the fee, the form number, the
timeline and the filing court. They are the part somebody acts on.

**That is not a bug and it is not an emergency. It is the design doing exactly
what it was built to do.** A record whose recheck window has passed stops
claiming to be current, because stale law is broken law, and a confidently
wrong answer about a gender-marker requirement is worse than no answer at all.
ADR 0003 considered the alternative and wrote it down in one line:

> **Rejected:** fabricating named human verifiers - dishonest and unsafe.

What the date does is put a number on what honest staleness costs. The 30- and
90-day SLA model assumes a verifier roster that has never contained a human, so
nothing restocks it. Not because restocking is unbuilt, but because restocking
is a person reading a government web page, and nobody has.

### Two corrections, since these numbers will get quoted

**Do not compute the expiry over all records.** Taking
`last_verified + recheck_sla_days` across all 836 puts the last expiry at
2026-12-04 and makes the corpus look 88 days from empty. Several of the records
reaching December are already `needs_reverification` - they are degraded now,
and their SLA date has no effect on anything served. Counting them makes the
corpus look fresher than it is, which is this project's own defect class
pointed at itself.

**Do not read "2026-12-05" as the deadline either.** It is true, and it is
about 12 referral records. The claims a person actually acts on are gone 54
days earlier.

## What one hour buys

**One jurisdiction's records, checked and re-dated by a named human.**

A jurisdiction is 4 to 20 English records, with 6 the median - typically the
court-ordered name change, the birth certificate or vital record, and the
driver's licence or state ID.
[`docs/VERIFIER-WORKBENCH.md`](VERIFIER-WORKBENCH.md) is a local tool that
walks them one at a time, fetches the cited source, shows the record beside the
state of that source, asks you one question, and writes down your answer:

> **Does this source support this statement, as written?**

The workbench's own claim is that it makes checking one record "a five-minute
act instead of an afternoon in a text editor". On a median jurisdiction with
fetchable sources, that is an hour, including reading the diff and opening a
pull request.

**Two honest caveats, so an hour does not turn into an afternoon:**

1. **A jurisdiction with unfetchable sources is slower**, because you are
   reading pages in a browser rather than being shown them. See the next
   section - and that work is worth more, not less.
2. **Verifying a record resets that record's SLA. It does not stop the clock.**
   One jurisdiction re-dated is one jurisdiction that stays current for another
   30 or 90 days. It is not a fix for the corpus, and this page is not going to
   suggest that one volunteer's hour saves it.

**You do not need to be a lawyer.** The tool never decides, never scores, never
ranks, and deliberately has no "these look similar" heuristic, because a machine
that hints at *looks fine* is a machine that gets nodded through. The judgement
is yours and it is a narrow one: does the cited page say what the record says,
today.

[Good first verification
(#197)](https://github.com/ChelseaKR/trans-docs-navigator/issues/197) is the
on-ramp. Your own state is a good place to start: you probably know where the
official pages are, and local knowledge catches what a remote reader misses.

## The 44 records a machine cannot check at all

This is the highest-value hour in the project, and it is invisible from the
outside.

Sixteen cited sources are marked `unfetchable` in
`corpus/snapshots/index.json`. Their hosts refuse this project's declared
user-agent, and this project does not spoof a browser user-agent to get around
that. The index says what follows, in its own words:

> Records citing it can only be verified by a human reading the page.

**Forty-four records across nine jurisdictions cite one of those sixteen
sources.** For every one of them the automated gate reports `UNCHECKABLE`, and
the workbench refuses to let you answer `yes` - it will not store "I could not
check this" as "a human checked this and it was right".

A person opening the page in an ordinary browser is not a workaround for that
refusal. It is the only method that exists. Alaska's DMV name-change page,
Louisiana's vital-records amendments page, Ohio's birth-record page, the State
Department's passport correction page: all 403 or 404 a script and all load
fine for you.

If you have twenty minutes and a browser, that is the most useful twenty
minutes anyone can currently give this project.

## What you get

- **Your name, or your organisation's, in `corpus/VERIFIERS.json`**, rendered
  next to the record in the app. Matching is exact, and the workbench exits
  before reading a single record if the name you pass is not on the roster, so
  a typo cannot attach itself to a record's provenance.
- **A citable contribution.** Being a named verifier is a dated, public,
  attributable statement that you read an official source and it said what this
  corpus says it said. That is professional work of the same kind a legal-aid
  organisation already does invisibly, and here it is a linkable artifact in a
  repository with a `CITATION.cff`.
- **A refusal you can rely on.** Saying "no" sets `verification_status` to
  `needs_reverification` and **leaves `source.last_verified` alone**, so a
  record you just rejected cannot look freshly checked to the freshness gate.
  Your "no" cannot be laundered into a "yes" by the machinery.
- **A gap published rather than a guess.** "I could not confirm the fee" is a
  real answer and the project wants it.

## The question this page raises and does not answer

**A named verifier is the whole trust model here, and being named is not free
for everyone.**

ADR 0003 requires a *named human verifier* in `corpus/VERIFIERS.json` before
any jurisdiction is launch-cleared, and it is right that a self-attestation
would be worth nothing. But this project's audience explicitly includes people
in hostile jurisdictions, and the people best placed to verify a record - staff
at a name-change clinic, a trans paralegal, a volunteer at a legal-aid office in
a state that is actively legislating against them - are among the people for
whom a public, searchable, permanent association with this project may carry
real risk.

Whether a pseudonym, an affiliation-only entry ("a name-change clinic in
Oklahoma"), or an organisational verifier standing in for an individual is
acceptable **is not settled, is not this document's call, and should not be
settled in an issue thread.** It is the maintainer's decision and quite possibly
counsel's.

It is worth saying that sibling projects in this portfolio have landed in three
different places on the same question:

- **contextsafe** accepts pseudonymity outright, offers an attribution choice
  before a first contribution, and publishes no roster or acknowledgement
  without individual written consent, with "no acknowledgement" as the default.
- **herevidence** names reviewers "or stable professional IDs if safety
  requires", with a role and qualification summary.
- **this project** requires a name on a public roster.

Those cannot all be the right default. The disagreement is written down here
rather than resolved because the deadline above creates pressure to recruit
quickly, and recruiting quickly is precisely when a safety policy gets skipped.

Until it is decided, the existing route holds and is stated in the
[verify-a-record
template](../.github/ISSUE_TEMPLATE/verify-a-record.md): if you would rather not
be named, your finding is filed as a plain correction and you stay anonymous.
The correction lands. The launch gate does not move. Both of those are true and
you should know both before you start.

## Where to start

| If you have | Do this |
|---|---|
| 20 minutes and a browser | One of the 44 records citing an unfetchable source. See the section above. |
| an hour | [#197](https://github.com/ChelseaKR/trans-docs-navigator/issues/197), one jurisdiction, with the workbench. |
| a jurisdiction you know well | The same, but pick your own state. |
| an organisation behind you | [#198](https://github.com/ChelseaKR/trans-docs-navigator/issues/198) and its children, [#199](https://github.com/ChelseaKR/trans-docs-navigator/issues/199) to [#203](https://github.com/ChelseaKR/trans-docs-navigator/issues/203): the five largest states, 32 records. |
| a browser and a specific state in mind | The A4TE cross-check issues [#207](https://github.com/ChelseaKR/trans-docs-navigator/issues/207), [#209](https://github.com/ChelseaKR/trans-docs-navigator/issues/209), [#211](https://github.com/ChelseaKR/trans-docs-navigator/issues/211), [#213](https://github.com/ChelseaKR/trans-docs-navigator/issues/213), [#215](https://github.com/ChelseaKR/trans-docs-navigator/issues/215) carry per-state checklists, several of which are a single unresolved fee or form that only a browser can settle. |

A half-finished check is more useful than a perfect one you never file.
