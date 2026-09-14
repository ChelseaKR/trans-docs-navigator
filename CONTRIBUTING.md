# Contributing

## Start here if you have an hour

[`docs/HELP-WANTED.md`](./docs/HELP-WANTED.md) is the honest version: what the
freshness position actually measures to today, what one hour of verification
buys (one jurisdiction re-dated, and no more than that), the 44 records that no
script can check because their hosts refuse an automated fetch, and the open
question about whether a verifier has to be named.

Thank you for helping keep this resource **current, cited, and safe**. Because wrong or
stale guidance can cost people money, time, and sometimes safety, contributions are held
to a higher bar than a typical app — especially anything that touches the corpus.

## The one rule that matters most

**No claim ships without a real source and a real, named human verifier.** Every corpus
record carries a `source` (official URL + title + `last_verified` date) and a `verifier`
who is listed by exact name in [`corpus/VERIFIERS.json`](./corpus/jurisdictions/../VERIFIERS.json).
The CI content gate rejects any record whose verifier is not in that roster.

> The seed corpus today is verified by a **placeholder** ("Pilot Seed Reviewer") and is
> therefore **not launch-cleared** (see ADR-3 in `docs/ROADMAP.md` and `docs/STATUS.md`).
> Replacing placeholders with accountable named verifiers, per jurisdiction, is the open
> launch gate.

## Adding or correcting a jurisdiction record

**Start from A4TE's state guide, then cite the government page.** Advocates for Trans Equality
keeps a human-curated guide for every state at `https://transequality.org/documents/<state>-identity-documents`.
Use it as a *map*: it tells you which agencies, official pages, and form ids matter for that state.
Then fetch and cite the official `.gov` page — never A4TE's page — because the fidelity gate must be
able to locate every claim in a primary source, and drift-watch must watch the law, not a summary of
it. **Do not copy their text.** Their prose is copyrighted; facts and pointers are what you take.

1. Edit the relevant file under `corpus/jurisdictions/`.
2. Provide a primary, official `source` (a `.gov`/court/agency URL — not a blog or forum).
3. Set `last_verified` to the date **you** checked the claim against that source, and add
   yourself (or the reviewing expert) to `corpus/VERIFIERS.json` with `placeholder: false`.
4. If the law is volatile or you couldn't confirm it, set
   `verification_status: "needs_reverification"` — the app degrades it to "needs
   reverification" rather than serving it as current. **Never** bump `last_verified`
   without actually re-checking the source.
5. Run the gates locally:

   ```sh
   make content      # schema + source + verifier-in-roster + real ISO date
   make freshness    # SLA: nothing stale served as current
   make citation     # 100% citation coverage on every path
   make readability  # plain-language target
   make eval         # groundedness / accuracy / refusal / adversarial
   ```

   or just `make verify` to run the full blocking pipeline (CI parity).

This repo also participates in a portfolio-wide engineering standard (see the
"Standards conformance" table in the README and `/STANDARDS` if you have access to the
private standards repo); `.github/workflows/standards.yml` checks the corpus/audit
artifacts for staleness against it on every push and PR.

## Pull requests

- "Done" is defined in [`DEFINITION_OF_DONE.md`](./DEFINITION_OF_DONE.md) — including the
  rollback, observability, and quality-characteristic lines the PR template asks for.
- Keep PRs focused; a corpus PR should touch corpus + verifier roster, not app code.
- Fill in the PR template — the source + verifier checklist is required for corpus changes.
- All of `make verify` must be green. CI also runs a real-browser accessibility gate
  (pa11y/axe) and SAST; both are **blocking**.

## Reporting that the law changed

If a requirement is out of date, open a **"Law changed in X"** issue (template provided)
with the jurisdiction, document, what changed, and the official source. That converts
directly into a corpus correction.

## Privacy & safety

This project assumes some users are in hostile jurisdictions. Do not add anything that
sends user data to the server, requires an account by default, or logs identifying
information. The privacy and PII-egress gates will block it, but please design with the
threat model (`docs/RESPONSIBLE-TECH-AUDITS.md` §C) in mind from the start.

## Commercial solicitation

Issues here are not open to bids. They are design records — written so a decision is
reconstructable later — not scope documents for outside quoting, and unsolicited offers to
implement one for a fee will be declined.

Contributions through the normal fork-and-PR process are welcome, and `good first issue` is the
place to start.
