# Governance

This is a small project with an unusual property: **a wrong answer here costs a real
person money, months, or safety.** That shapes how decisions get made, so it is written
down rather than left to taste.

## Who decides

Maintainer: [@ChelseaKR](https://github.com/ChelseaKR). Final call on merges, and on
whether a launch gate is cleared.

## What can and cannot be decided by discussion

Some things in this repo are deliberately **not** matters of opinion:

| Decision | How it is made |
|---|---|
| Does a record's claim match its cited source? | Mechanically, by `make fidelity`. Not by agreement. |
| Is a gate passing? | By the gate. A gate that cannot run is not a gate that passed. |
| Is a launch gate cleared? | Only by a named human signing off in `docs/signoffs/`. Never by editing a doc or a table. |
| Should coverage expand? | Only as each jurisdiction passes review — see `docs/ROADMAP.md` §8. |

If a discussion concludes "let's just lower the threshold," the answer is no. Thresholds
here encode a safety property, and the repo's history is mostly the story of gates that
silently stopped protecting anything. Weakening one to get a build green is the failure
mode this project is built to prevent.

## The verification bar

Every record must trace to an official government source that was actually fetched. The
project would rather publish **"we could not confirm this"** than a plausible guess. A
record that says a path does not exist must be able to show that its cited source is
silent — asserting a restriction is as much a claim as asserting a process.

No record is "verified" in the sense that matters until a **named human** has checked it
and is credited in `corpus/VERIFIERS.json`. Everything currently in the corpus carries a
placeholder, and the app says so next to every source.

## How disagreements resolve

1. Point at the source. Most disagreements about content dissolve when someone quotes
   the official page.
2. If the source is ambiguous, the record says it is ambiguous. That is a valid outcome.
3. If a change would weaken a gate, it needs a written rationale in the PR and an ADR
   under `docs/adr/` — not just a passing build.

## AI assistance

This project is built with AI assistance, disclosed in the README, in every commit
that used it, and on every page of the app. That does not lower the bar: AI-authored
content is subject to the same gates, the same citation requirements, and the same rule
that a named human — not a model — clears a launch gate.

## Conduct

[`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md) applies everywhere, including issues and
discussions. This project serves a population that is frequently harassed; moderation
errs toward protecting them.
