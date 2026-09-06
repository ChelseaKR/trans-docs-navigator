# Verifier workbench

A local tool that makes checking one corpus record a five-minute act instead of an
afternoon in a text editor.

```sh
npm run verify-record -- --jurisdiction tx --verifier "Your Name As It Appears On The Roster"
```

It walks the records for one jurisdiction. For each one it fetches the cited source, shows
you the record beside the state of that source, asks you one question, and writes down your
answer. Then it stops and leaves the diff for you to review and open a PR with.

**The tool never decides.** It does not score, rank, guess, or suggest a verdict, and it
deliberately has no "these look similar" heuristic. A machine that hints at *looks fine* is a
machine that gets nodded through, and the entire value of this project's launch gate is that
a named human actually read the source.

---

## The one question

> **Does this source support this statement, as written?**

That is the whole job. Answer it about the `STATEMENT` line, against the page at the cited
URL, as that page reads **today**.

### What you are judging

- Does the cited page actually say what the statement says?
- Is it still true on the page *now*, not just when it was last checked?
- Are the specifics right — the fee, the age, the residency period, the form number, the
  court that hears it?
- If the statement hedges ("varies by county"), does the source support the hedge?

### What you are **not** judging

- **Not** whether the guidance is good advice. That is not what a corpus record claims.
- **Not** whether the writing could be clearer. File an issue; do not fail the record.
- **Not** whether the law *should* be this way.
- **Not** whether some *other* source contradicts it. If you know of one, say so in your
  reason and open an issue — but this question is only about the source that is cited.
- **Not** whether the Spanish translation is right. That is a separate parity gate.

If the answer is "the statement is right but the citation is the wrong page", that is a
**no**, with the better URL in your reason. The record's claim and its provenance travel
together; a true sentence with a citation that does not support it is exactly the failure
this corpus exists to prevent.

---

## What the tool refuses to do

Three refusals are enforced in code, not left to your discipline. They will stop you, and
they are supposed to.

### 1. Your name must be on the roster, before anything else happens

If the name you pass is not in `corpus/VERIFIERS.json` **exactly**, the tool exits before it
reads a single record. Matching is exact — not case-insensitive, not fuzzy — so a typo cannot
attach itself to a record's provenance. Getting added to the roster is a reviewed PR.

Seed/placeholder reviewers are refused too. A record carrying a placeholder is never
launch-cleared, so stamping real records with one would manufacture the appearance of
progress. `--allow-placeholder` exists for exercising the tool against fixtures and says so.

### 2. A source you could not read cannot become a verification

If the cited page 403s, times out, is a PDF with no extractable text, is on the list of hosts
that refuse automated fetching, or has no committed snapshot to compare against, the record
is shown as **UNCHECKABLE** and the `yes` answer is not available. The tool will not take it.

This is the project's most persistent bug class pointed at its own records: *"I could not
check this"* must never be storable as *"a human checked this and it was right."* You can
still mark it `needs_reverification` — recording that you could not check it is a real and
useful outcome.

When a source is UNCHECKABLE, check it **by hand in a browser** and, if it is fine, get the
snapshot fixed (`make source-snapshot`) rather than working around the refusal.

### 3. Saying "no" does not restamp the record as fresh

A rejection sets `verification_status` to `needs_reverification` and **leaves
`source.last_verified` alone**. If a "no" wrote today's date, a record that just failed
review would look freshly checked to the freshness gate and keep being served as current.

---

## What you will see

```
SOURCE STATE
  ✓ the live page matches the committed snapshot byte-for-byte (normalized).
```

The live page is unchanged since the snapshot was taken. That does **not** mean the record is
right — nobody has checked whether the page ever supported the claim. Read it anyway.

```
SOURCE STATE
  ⚠ the live page DIFFERS from the committed snapshot — read the live page, not the snapshot.
```

The page moved under the record. Read the **live** page. This is the case most likely to
change an answer, and the reason the snapshot path is printed for you: you can diff them.

```
SOURCE STATE
  ⛔ UNCHECKABLE (fetch-failed) — the cited page could not be read just now (HTTP 403)
```

See refusal 2 above.

---

## Answers

| key | meaning |
|---|---|
| `y` | the source supports the statement as written → `verified`, stamped with your name and today's date |
| `n` | it does not → `needs_reverification`; you are asked for a one-line reason |
| `s` | skip — no change, and you will be asked again next run |
| `q` | stop; progress is saved |

There is no default. Pressing Enter re-asks, because a default answer is the tool making the
call for you. Ending input (Ctrl-D) is treated as `quit`, never as an answer.

## Resuming

Progress is saved per jurisdiction under `.verifier-workbench/` (gitignored, local to your
machine). Quitting costs nothing — rerun the same command and it picks up where you stopped.
`--reset` walks the jurisdiction again from the top.

## Your rejection reasons

Reasons go to `.verifier-workbench/review-log.jsonl` on your machine, **not** into the corpus
record. There is no private-note field in the record schema today; it arrives with the
schema-v2 changelog (#229). Until then, paste the relevant reasons into your PR description
so a reviewer can see why each record moved.

## When you are done

The workbench never commits and never pushes.

```sh
git diff corpus/jurisdictions/          # read every line of this
make content                            # the corpus gates
```

Then open a PR. Your name on those records is the claim that you read the sources — it is the
thing the whole project rests on.

## Flags

| flag | meaning |
|---|---|
| `--jurisdiction`, `-j` | jurisdiction to walk (`tx`, `TX`, `US-TX` all work) |
| `--verifier`, `-v` | your name, exactly as it appears in `corpus/VERIFIERS.json` |
| `--record`, `-r` | verify a single record id instead of the whole jurisdiction |
| `--reset` | forget saved progress for this jurisdiction |
| `--allow-placeholder` | permit a seed/placeholder verifier (fixtures and demos only) |
| `--dir` | jurisdiction directory to read (fixtures; defaults to the corpus) |

Related: `docs/ideation/03-expansions.md` EXP-04, and the open verification issues #197–#203.
