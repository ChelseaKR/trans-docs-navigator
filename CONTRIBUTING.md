# Contributing

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
