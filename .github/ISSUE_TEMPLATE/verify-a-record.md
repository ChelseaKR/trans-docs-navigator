---
name: Verify a record (become a credited verifier)
about: You checked a jurisdiction record against its official source and can be credited for it, by name, stable pseudonym or organization ID
title: "[verify] <jurisdiction> · <document>: <name or gender-marker>"
labels: ["corpus", "verification", "help wanted"]
---

<!--
This is the single most valuable contribution to this project.

Every record in the corpus currently carries a PLACEHOLDER verifier
("Pilot Seed Reviewer"). 0 of them have been verified by a named human. That is
launch gate 1, it is the reason this is not a launched service, and it is the one
thing no amount of code can close.

You do not need to be a lawyer, and you do not need to use your legal name. You
do need to have actually read the official source and be willing to be credited
for it: under your name, a stable pseudonym, or an organization ID. See
docs/HELP-WANTED.md, "How you are credited".
-->

## What you checked

- **Record id(s):** <!-- e.g. wa.court-order.name — see corpus/jurisdictions/ -->
- **Official source you read:** <!-- the URL, and the date you read it -->

## What you found

<!-- For each load-bearing fact — fee, form id, timeline, requirement, who may file,
     where it is filed — say whether the record matches the source today. -->

- [ ] The record matches its cited source
- [ ] The record is wrong or out of date (describe below)
- [ ] The source itself has moved or changed

<!-- If anything is wrong, quote what the source actually says. Please don't
     paraphrase a legal requirement — quote it. -->

## How you want to be credited

You choose this before anything is published. The credit you choose goes in
`corpus/VERIFIERS.json` and renders next to the record in the app as
`Verified by <credit>, <date>`. Nothing else about you goes on the roster or in
the app, apart from a role if you choose to give one.

- [ ] My name
- [ ] A stable pseudonym (the same one on every record I verify)
- [ ] An organization ID (the organization is credited, not me)
- [ ] No credit — file this as a correction instead, and I'll stay anonymous

- **Credit, exactly as it should appear:**
- **Role (optional):** <!-- e.g. paralegal, legal-aid volunteer. Leave it blank if it would identify you. -->
- [ ] I consent to this credit appearing publicly, and I understand it stays in the repository's history

<!-- The default is no credit. If you tick nothing above, nothing is added to the
     roster and your finding is filed as a correction. Silence is not consent.
     Whatever you choose here, GitHub shows the account you file this issue from. -->

## Anything you're unsure about

<!-- "I couldn't confirm the fee" is a genuinely useful answer. This project would
     much rather publish a gap than a guess. -->
