# A4TE Cross-Check — Group 2 (GA–ME) — 2026-09-05

> **Index-driven review, not a verification pass.** [Advocates for Trans Equality](https://transequality.org)
> (A4TE, the 2024 NCTE/TLDEF merger) maintains human-curated state guides at
> `transequality.org/documents/<state>-identity-documents`. This document uses those pages
> strictly as a **map** — which agencies, forms, and facts to go check — never as a source of
> truth in themselves, and never as text to reproduce. No prose was copied from A4TE; nothing
> longer than a form id or a number is quoted from their pages anywhere below. Every disagreement
> was checked against a live primary `.gov` fetch (same declared user-agent this project's own
> watchers use, `trans-docs-navigator-source-watch/1.0`, never a spoofed browser UA), not resolved
> by picking a side. **No corpus, forms, or test file was edited to produce this document, and no
> record's `verification_status` changed.** Fixes belong to a follow-up wave — see "Next steps."
>
> Ten jurisdictions: Georgia, Hawaii, Idaho, Illinois, Indiana, Iowa, Kansas, Kentucky, Louisiana,
> Maine. All ten M6-era corpus records here carry `last_verified: 2026-07-13`; today is 2026-09-05,
> so every record already past its `recheck_sla_days` (mostly the 30-day gender-marker records)
> was already due for re-verification independent of anything found here.

## Headline

A4TE's guides are a genuinely useful, actively-maintained index — most of what they cite still
holds up against a live fetch, and their per-page "last updated" stamps (where present) are
usually honest signals. But this pass found **real, dated drift on both sides, in both
directions**, across **9 of the 10 jurisdictions** — only Louisiana came back clean.

**A4TE's own pages currently describe at least one superseded rule in six states** (Hawaii,
Idaho, Illinois, Iowa, Kansas, Maine) — confirmed against a live primary source, not assumed.
Two are especially notable because they sit exactly in the contested-gender-marker-rules
territory this audit was told to scrutinize hardest: **Iowa's** A4TE page tells readers the DOT
is "still processing gender marker updates" on driver's licenses via a rule and a DOT memo link
that **no longer exist in that form**, both superseded by the same Nov. 2025 SF418 rulemaking our
own `needs_reverification`-flagged record had already flagged as unresolved; **Idaho's** A4TE page
names a specific driver's-license gender-marker form, **ITD3533**, that Wayback Machine's capture
history shows disappeared from Idaho Transportation Department's site in **mid-2024** — nearly two
years before A4TE's own claimed "January 2026" update date. **Kansas's** and **Maine's** A4TE pages
each carry a live, confirmable dead link (a 404'd KDHE document; three 404'd Maine.gov PDFs)
sitting directly behind the stale claim.

The reverse also happened: **Georgia's own corpus record** appears to describe an *incomplete*
picture, not a wrong one — a live cross-reference in current Georgia Secretary of State rule text
corroborates a second, court-order-plus-surgery birth-certificate path (§ 31-10-23(e)) that A4TE
names and our record's "no court-order path exists" language omits. And **Idaho's** A4TE page is
also right where it matters most: a January 2026 Idaho AG press release, independently confirmed
by four news outlets, verifies A4TE's claim that a federal injunction was dissolved and birth-
certificate sex-marker changes are no longer available — exactly matching the caution our own
`needs_reverification` record was already expressing, just less confidently stated.

| Jurisdiction | A4TE page quality | New sources found | Missing forms | Disagreements (resolved) | Doc-type gaps | Notable A4TE gap |
|---|---|---|---|---|---|---|
| Georgia | Thin but current, no date stamp | 4 | 0 (Form 3977 already registered) | 1 — **A4TE's picture is more complete than ours**: a second, still-live court-order+surgery birth-cert path (§ 31-10-23(e)) that our record's "no court-order path" claim omits | 0 | Exact fee schedule, discretionary/appeal language, ES parity |
| Hawaii | Stale on driver's license, dead link found | 4 | 2 (DOH amendment + physician-affidavit forms) | 1 — **A4TE is stale**: DL gender-marker section describes a pre-2020, non-self-attestation process via a dead 2013 .gov PDF + non-.gov 2012 ACLU form | 0 (+1 incidental: marriage-record sex-designation path, neither side covers) | Full HI name-change fee/timeline breakdown, birth-cert name-change caveat |
| Idaho | Thorough, dated Jan 2026, but stale on one item | 4 (statutes, ITD policy, minor-process pages) | 12+ named Idaho court forms (NCA/NCM series) — all missing from registry | 2 — **A4TE is stale** on DL gender-marker (names Form ITD3533, gone from ITD's site since mid-2024 per Wayback CDX); **A4TE is accurate and current** on birth-cert unavailability (confirmed via a Jan 2026 AG press release + 4 news outlets), matching our hedged record | 1 (full minor name-change process; A4TE has one, we don't) | Exact fees, full statutory text/history, structural `needs_reverification` flagging |
| Illinois | Reachable but thin, no date stamp | 2 (ILCS statute directly, SOS's own gender-change page) | 2 named (Request/Order for Name Change; Gender Designation Change Form) — neither numbered by either side | 2 — **A4TE is stale**: describes a publication requirement repealed effective 3-1-25; states a 6-month residency rule superseded by the current 3-month/at-hearing rule (this second fact is missing from our record entirely, not wrong) | 0 | Motion-to-Impound sealing option, fee-waiver flag, ES parity |
| Indiana | Current, dated Feb 2026 | 2 (statute cites, LGBTQ+ Project guide) | 1 (Form 49607) + minor name-change set | 2 — fee structure unclear on **both sides** (needs a phone call, not a web fetch); gender-marker "yes" claim adds detail but doesn't close our record's underlying source-conflict | 0 | Case-law citations behind publication sealing, explicit source-conflict flag |
| Iowa | Thorough but undated; DL section stale | 3 (statute/rule cites, minor name-change restriction) | 0 registry entries exist at all for IA | 2 — **A4TE is stale** on the $195 flat filing fee ("varies by county") and, more seriously, on **DL gender-marker availability** (describes a rescinded pre-Nov-2025 rule; cited DOT memo now 404s) | 0 | SF418 statutory mechanics, `needs_reverification` honesty on the same fact A4TE states confidently |
| Kansas | Long, dated Feb 2026, internally inconsistent | 6+ (KJC forms, KDHE forms/pages, statutes) | All (0 KS entries in registry) — several named | 1 — **A4TE is stale**: says already-amended birth certificates "are still valid" post-SB244; live KDHE FAQ says SB244 invalidates them (matches our record); A4TE's own cited source is now a 404 | 0 | No-refund/no-notification facts, exact compliance deadline, appeal rights, law/effect record split |
| Kentucky | Very thin, no date, no fees | 1 (fuller KRS range) + methodology limitation (JS-gated statute site) | 0 (A4TE names no form ids at all) | 1 — **A4TE's specific DL gender-marker claim is not corroborated** by either current KYTC page found; our record's "couldn't confirm, ask directly" framing holds up better | 0 | All fee/timeline data, 1990-vintage law context |
| Louisiana | Very thorough, dated Nov 2025 | 4 (LA statute, LDH forms, LA Trans Advocates index) | 2 LDH-hosted PDFs (unverifiable — LDH 403'd our UA) | 0 substantive — everything checkable corroborated | 0 | $15 search fee, R.S. 14:2(B) permanent-bar nuance, LDH-page navigational-trap finding |
| Maine | Thin, no date, 3 dead links | 0 net-new current sources (A4TE's own cites are stale/dead) | 0 net-new (VS-7/MVL-20 already registered; flags VS-14 missing from registry independent of A4TE) | 2 — **A4TE is stale on both**: birth-cert gender-marker (describes pre-self-attestation physician-letter process) and court-order name change (cites recodified/repealed Title 18-A, conflates minor-notice rule with a general adult publication rule that doesn't exist) | 0 | Minor gender-marker process, DL legal-authority memo, $60-stacking detail |

## Scope and method

- A4TE pages fetched live on 2026-09-05 with this project's declared user-agent
  (`trans-docs-navigator-source-watch/1.0 (+https://github.com/ChelseaKR/trans-docs-navigator)`),
  the same UA `scripts/source-watch.ts` and `scripts/source-snapshot.ts` already use — never a
  spoofed browser UA, including against every primary `.gov` source checked below.
- A4TE's prose was used only to identify *what to check* — which agency, which form, which fact.
  Every fee, timeline, requirement, and path-availability claim below was checked against a fresh
  fetch of a primary source, not against A4TE's own wording. Nothing longer than a form id or a
  number is quoted from A4TE anywhere in this document.
- Every disagreement below was investigated by fetching the primary `.gov` page(s) live — both
  the one A4TE cites and the one our record cites, where they differ — and stating plainly which
  reads as current, or that it could not be determined and why (a 403, a dead link, a
  JavaScript-only legislature site, contested/unsettled law).
- This document changes nothing. It is the input to a follow-up wave of record fixes, the same
  relationship `docs/audits/source-drift-2026-09.md` has to its own triage.

## Georgia

**A4TE page:** `transequality.org/documents/georgia-identity-documents` — reachable (200), three
sections (name change, driver's license, birth certificate), no visible last-updated date, ~80
lines. Broadly current where checked, but its birth-certificate section describes a second legal
path our own record does not mention.

1. **Sources A4TE points to that we don't cite:**
   - `Ga. Code Ann. § 19-12-1` (name-change publication timing) — cited by A4TE, not by
     `ga.court-order.name` (cites only `georgia.gov/apply-name-change`). Statute text itself was
     not independently fetchable (justia/findlaw 403'd our UA; LexisNexis's mirror is
     JS-rendered).
   - `Ga. Code Ann. § 31-10-23(e)` (court-order + surgical-procedure birth-certificate path) — see
     disagreement below.
   - `https://dds.georgia.gov/georgia-licenseid/existing-licenseid/how-do-i-update-license` — the
     actual DDS URL A4TE links, distinct from our cited `dds.georgia.gov/license-faqs`. Live fetch
     today surfaced a fee fact absent from `ga.drivers-license.name` (whose `cost` is currently
     unset): **one free name/address change per license term, then $10 for a second change**, and
     a rule requiring renewal instead of a simple update within **150 days** of expiration.
   - `https://dph.georgia.gov/ways-request-vital-record/birth` — the actual DPH URL A4TE links
     (distinct from our cited `/fees` page and the Form 3977 download URL); overlaps existing
     corpus content but independently confirms the sealed-court-order-file mechanism below.

2. **Forms A4TE names that the registry lacks:** none. A4TE's birth-certificate document list
   (affidavit, certified court order, medical certification, photo ID, money order/cashier's
   check) maps to the same **Form 3977**, already registered as `ga-dph-3977`.

3. **Facts where A4TE and our record disagree:**
   - **DISAGREEMENT — `ga.birth-certificate.gender-marker`.** A4TE: Georgia amends the sex marker
     "upon receipt of a certified copy of a court order" showing a change "by surgical procedure,"
     issuing an all-new (not "amended") certificate, per § 31-10-23(e). Our record cites only Rule
     511-1-3-.25 ("All Other Amendments" — affidavit + 5-year-old documentary evidence, no court
     order, no surgery) and states plainly "no separate court-order or gender-identity-based
     path." **Primary-source check, live today:** `rules.sos.ga.gov/gac/511-1-3` — Rule
     511-1-3-.25(1) itself opens "Unless otherwise provided in these Rules **or by Statute**..."
     (i.e., explicitly non-exclusive), and the same page's Rule 511-1-3-.31(d) directly
     cross-references **§ 31-10-23(e)** by number, describing the new-certificate-plus-sealed-file
     mechanism A4TE names. `dph.georgia.gov/ways-request-vital-record` and `.../birth` (both live,
     "last updated" 2026) independently describe the same sealed-court-order-file mechanism. Form
     3977's own printed instructions (page 3, "To Amend the Sex") describe *only* the
     documentary-evidence path, with no court order or surgery mentioned. **Conclusion: both paths
     appear to be currently, simultaneously codified** — A4TE's cited court-order/surgery path
     (§ 31-10-23(e)) is corroborated as still live by two independent fresh `.gov` cross-references
     today; our record's blanket "no court-order path exists" claim is the one that reads as
     incomplete. The raw statute text itself remains unconfirmed (justia/findlaw 403, LexisNexis
     JS-gated), so this rests on the rule's live cross-reference and the DPH page's sealed-file
     language, not the statute's own wording.
   - Unresolved, not scored either way: A4TE's claim that a passport showing a gender update can
     also serve as DL gender-marker evidence isn't in the current DDS FAQ or Rule 375-3-1-.17 text
     (both re-fetched live); may be undocumented DDS practice. A4TE's "publication within seven
     days of filing" isn't in the current `georgia.gov/apply-name-change` text either (re-fetched,
     "last updated April 2026") — neither claim could be confirmed against the raw statute.

4. **Document types A4TE covers that we don't:** none — same three categories (court-order,
   drivers-license, birth-certificate) on both sides. No SSA/passport section on A4TE's GA page
   (consistent with those being handled at the federal level in our corpus, not per-state).

5. **A4TE gaps:** exact dollar figures A4TE never states ($10 amendment, $25 certified copy, $5/
   extra copy — all reconfirmed live); discretionary-decision and written-reasons/appeal language
   on both the DL and birth-certificate gender-marker rules; the `relocation.residency_bound` flag
   on `ga.court-order.name`; full Spanish parity for all 5 EN records. Bonus, found via A4TE's own
   linked DDS page: the free-first-change/$10-second-change and 150-day-renewal rules above, worth
   considering for `ga.drivers-license.name`'s currently-null `cost` field.

## Hawaii

**A4TE page:** `transequality.org/documents/hawaii-identity-documents` — reachable (200), ~74
lines, same three-section structure. Birth-certificate section holds up; **driver's-license
section is stale and internally contradictory**, and links a dead government PDF.

1. **Sources A4TE points to that we don't cite:**
   - `Haw. Rev. Stat. §§ 574-1–574-6` (name-change eligibility, sex-offender restriction,
     prosecutor-affidavit safety waiver) — not cited by `hi.court-order.name` (cites only the
     eHawaii portal). Statute text itself 403'd on both `capitol.hawaii.gov` and
     `law.justia.com`.
   - **HB1165** (the 2020 legislative basis for DL self-attestation A4TE cites) — bill page 403'd;
     not cited anywhere in our HI records.
   - `namechange.ehawaii.gov/public/pdf/instructions.pdf` — a printable-instructions companion to
     the portal we already cite.
   - *Incidental, found while fetching a page A4TE already cites, not from A4TE itself:* Hawaii DOH
     also runs a **"New Marriage Certificate for Sex/Gender Designation Change"** process under
     HRS §572 (Act 179) — a document type neither A4TE's page, our corpus, nor
     `forms/registry.json` currently covers. Noted as a possible future addition on both sides.

2. **Forms A4TE names that the registry lacks:** two, both HI DOH, neither with a numeric id
   (Hawaii doesn't number these the way Georgia does):
   - "Application for Amendment to Birth Record" —
     `health.hawaii.gov/vitalrecords/files/2015/07/Application-for-Amendment-to-Birth-Record.pdf`
     (confirmed live).
   - "Physician Affidavit Form for Sex Designation Change" — same domain, confirmed live.
   `forms/registry.json` currently has only `hi-dl-application` for Hawaii.

3. **Facts where A4TE and our record disagree:**
   - **DISAGREEMENT — `hi.drivers-license.gender-marker`.** A4TE states, in the same section, both
     that Hawaii moved to self-attestation (M/F/X, no medical documentation) "starting July 1,
     2020" *and* — one paragraph later — describes a **pre-reform** process requiring an SSA name
     change plus a court order **and** a "Gender Designation Form" completed by a medical/social
     professional, linking a form hosted on a 2012 ACLU-Hawaii WordPress blog. Our record: the
     current official DL application's gender field is a self-selected checkbox, Male/Female/Not
     Specified, no supporting document. **Primary-source check, live today:** the actual State of
     Hawaii DL Application PDF ("Rev. 3/15/2023") shows exactly **MALE / FEMALE / NOT SPECIFIED**
     checkboxes with no certification requirement anywhere on the form — matching our record. The
     2012 ACLU PDF A4TE links, by contrast, offers only Male/Female and *requires* a licensed
     professional's certification — the opposite of self-attestation. A4TE's own second linked
     source, a 2013 HIDOT fact sheet, is a **dead link (404 today)**. **Conclusion: A4TE's page is
     stale on this item; our record matches the current, live, official form.** Unresolved:
     whether HB1165 literally authorizes an "X" marker (the form implements "Not Specified"
     instead) couldn't be checked against the 403'd bill text — flagged, not resolved.

4. **Document types A4TE covers that we don't:** none (same three categories). No SSA/passport
   section on A4TE's HI page.

5. **A4TE gaps:** complete HI name-change fee breakdown ($50 filing + $1 archive + $5 service +
   ~$204.19 publication + $41 registration, 8–12 week timeline — all reconfirmed live on
   `namechange.ehawaii.gov` today; A4TE states no dollar figures or timeline at all); the $3-per-
   amended-item birth-certificate fee (reconfirmed live; not in A4TE); the explicit caution that
   HI birth-certificate *name* changes are available only in five narrow scenarios, not as a
   routine post-court-order update (`hi.birth-certificate.name` — confirmed unchanged live; **A4TE
   never addresses birth-certificate name changes at all**, a real and practically useful gap our
   corpus fills); full Spanish parity for all 5 EN records.

## Idaho

**A4TE page:** `transequality.org/documents/idaho-identity-documents` — reachable (200), thorough
and current-looking, with an explicit **"last updated in January 2026"** banner, a bulleted
overview table, and separate adult/minor name-change walkthroughs. This is squarely one of the
contested-rules states this audit was asked to scrutinize hardest, and both a stale claim and a
confirmed-current one turned up here.

1. **Sources A4TE points to that we don't cite:** Idaho Code §§ 7-801–7-805 (general name-change
   statute — `id.court-order.name` cites only the courts' self-help procedural page, not the
   underlying statute); Idaho Code § 39-278 ("Procedure for Delayed Registration or Amendment of
   Vital Record," A4TE's cited vital-records amendment authority, absent from our corpus); Idaho
   Department of Transportation Administrative Policy 5504 (A4TE's cited authority for the DL/ID
   gender-marker process — itself apparently stale, see below); Idaho Courts' district-court
   locator and approved-newspapers publication list.

2. **Forms A4TE names that the registry lacks:** `forms/registry.json` has exactly one Idaho
   entry (`id-dhw-name-change-instructions`). A4TE names many more, all missing: **NCA 1-1**
   (Unredacted/Redacted Petition for Name Change, adult/emancipated minor), **NCA 1-2** (Notice of
   Hearing), **NCA 1-3** (Name Change Letter for Publication), **NCA 8-1** (Judgment for Name
   Change, adult), General Civil Case Information Sheet, Motion/Order for Fee Waiver, **NCA 1-4**/
   **NCA 1-5**/**NCA 8-2** (the minor-name-change equivalents), **NCM 2-1** (Parental Consent to
   Name Change), an Affidavit of Service (minor), and — see the disagreement below — **Form
   ITD3533** (Sex/Gender Designation on a Driver's License or ID Card).

3. **Facts where A4TE and our record disagree:**
   - **DISAGREEMENT (the flagged high-value item) — `id.drivers-license.gender-marker`.** A4TE
     (claiming January 2026 currency): "Yes," via **Form ITD3533**, requiring a physician's
     certification of "gender change" or a court order, M/F only. Our record
     (`verification_status: verified`): no such path is discoverable; ITD's required-documents
     page never mentions sex/gender at all. **Primary-source check, live today:** ITD's
     required-documents and ID-card pages, freshly fetched, contain no mention of sex/gender or
     "3533" anywhere; ITD's own site search for "3533" returns **"No results found."** The Wayback
     Machine's capture history for the known 2017 form URL
     (`itd.idaho.gov/wp-content/uploads/2017/03/3533Fill.pdf`) shows HTTP 200 continuously from
     2017 through **May 25, 2024**, then **HTTP 404 from July 16, 2024 onward**, including the
     most recent capture (Feb. 16, 2026). A live fetch just now confirms 404. **Conclusion: our
     record is current and correct; A4TE's "Yes, via Form ITD3533" claim is stale by roughly two
     years**, despite the page's own claimed January 2026 update — a form gone from ITD's site
     since mid-2024 that A4TE is still actively pointing readers to today. (Caveat: the form could
     in principle have moved to an unguessed new URL; ITD's internal form-finder tool didn't index
     DMV-category forms at all during this check, so its empty result was treated as inconclusive
     rather than confirming, and the Wayback evidence carried the finding instead.)
   - **DISAGREEMENT, resolved the other way — `id.birth-certificate.gender-marker`.** A4TE states
     flatly: "No" — as of a January 2026 court ruling, birth-certificate sex-marker corrections
     are no longer available, attributing this to the dissolution of a 2018 federal injunction,
     with certificates already corrected pre-2026 remaining valid. Our record cites Idaho Code
     §§ 39-245A and 73-114 accurately but stops short of A4TE's definitive "No" — it is hedged and
     flagged `needs_reverification`. **Primary-source check, live today:** the Idaho Attorney
     General's office (dated Jan. 9, 2026, fetched fresh) confirms Chief U.S. Magistrate Judge
     Raymond E. Patricco dissolved the 2018 injunction on **January 8, 2026**, on stipulation of
     the parties, and that Idaho DHW "can now enforce" § 39-245A "for the first time since 2018" —
     independently corroborated by four news outlets (Idaho Capital Sun, Idaho Statesman,
     KBOI/idahonews.com, localnews8.com). **Conclusion: A4TE's claim is accurate and current here.**
     Our own record's caution is honest, not wrong, but this pass confirms it can now be stated
     more definitely by a human reviewer — worth firming up at the next verification pass, not
     something this document changes itself.

4. **Document types A4TE covers that we don't:** A4TE has a full **minor name-change** walkthrough
   (parental consent, objection/"best interest" standard, service on non-consenting parents) —
   our corpus has no minor-specific Idaho name-change record at all, only the adult
   `id.court-order.name`. SSA/passport appear only as A4TE's generic "next steps" pointer, with no
   Idaho-specific content to compare against `federal.json`.

5. **A4TE gaps:** A4TE never states Idaho's birth-certificate name-change fee ($20) or the
   $16/copy (+$25 optional rush) figures our corpus has; it also doesn't quote or link the actual
   statutory text (§ 39-245A, § 73-114) the way our corpus does, including legislative-findings
   language and amendment history — useful for judging how durable the current rule is; nor does
   it surface the residency/mail-in flexibility for out-of-state Idaho-born residents implicit in
   the DHW instructions PDF. The corpus's explicit `needs_reverification` flagging on both Idaho
   gender-marker records is a structural feature A4TE's static "Yes/No" table has no equivalent
   for — and, per the finding above, is arguably the more honest posture on the DL question right
   now.

## Illinois

**A4TE page:** `transequality.org/documents/illinois-identity-documents` — reachable (200) but
noticeably **thin**: no last-updated date, no minor-specific section (just an outbound link to a
separate NCTE minors resource), no numbered forms, and no discussion of Illinois's 2024/2025
name-change law overhaul beyond a bare statute citation.

1. **Sources A4TE points to that we don't cite:** 735 ILCS 5/21-101 to 5/21-105 (the Illinois
   name-change article) — A4TE cites this directly; `il.court-order.name` cites only
   illinoislegalaid.org, not the underlying ILCS text. The Illinois Secretary of State's own
   driver's-license gender-designation page — not cited in our corpus, which cites
   illinoislegalaid.org (a legal-aid intermediary) instead of the SOS directly. A4TE's own "Name
   Change Project" (Cook County pro bono representation) is a service pointer worth noting for the
   partnership angle, not a fact source.

2. **Forms A4TE names that the registry lacks:** A4TE gives no numeric form ids for Illinois
   (consistent with our own cited source, which is equally silent on numbers) — it names by title
   only: "Request for Name Change" and "Order for Name Change" (Illinois Courts' statewide adult
   forms, agency: Illinois Courts/circuit clerk — zero Illinois court-order forms currently in the
   registry) and "Gender Designation Change Form" (Illinois Secretary of State — the registry's
   only IL entry, `il-affidavit-correction`, is an IDPH birth-certificate form, not this one). A
   numeric SOS form id could not be found: `ilsos.gov` timed out repeatedly during this research
   session — a live-source gap in this pass, not a corpus problem.

3. **Facts where A4TE and our record disagree:**
   - **DISAGREEMENT — `il.court-order.name`, publication requirement.** A4TE states a publication
     requirement still applies — notice in a newspaper for three consecutive weeks, starting at
     least six weeks before the hearing, waivable only for hardship. Our record states "the guide
     no longer lists a newspaper publication step," reflecting law changes effective Jan. 1, 2024
     and March 1, 2025. **Primary-source check, live today:** the current text of 735 ILCS 5/Art.
     XXI, pulled directly from `ilga.gov`, contains **no occurrence of "publication" anywhere** in
     §§ 21-101–21-106; § 21-103 — where such a requirement plausibly once lived — is explicitly
     marked **"(Repealed)," effective 3-1-25** (P.A. 103-1063). A fresh fetch of
     illinoislegalaid.org (our own cited source) confirms it still says nothing about publication
     either. **Conclusion: our record is current and correct; A4TE's publication-requirement claim
     describes pre-2024 law that no longer applies.**
   - **DISAGREEMENT — Illinois residency duration, a fact our record is missing rather than
     stating wrong.** A4TE: "resided in the state for at least six months." Our record: no
     residency duration stated at all. **Primary-source check, live today:** the current effective
     text of § 21-101(a) (P.A. 103-1063, eff. 3-1-25 — the latest of three overlapping versions
     ILGA displays) reads "resided in this State for **3 months** at the time of the name change
     hearing or entry of an order" — down from the 6-month/at-filing rule in the prior (7-1-24)
     version. **Conclusion: A4TE's 6-month figure matches an earlier (2024) version of the law,
     not the version in force since March 1, 2025.** Our record isn't wrong here, just silent —
     worth adding at 3 months, measured at hearing/order rather than at filing.
   - **No disagreement found**, reconfirmed live today: `il.birth-certificate.gender-marker`/
     `.name` ($15 fee, $2/extra copy, notarized Affidavit and Certificate of Correction Request,
     M/F/X options, July 1, 2023 effective date — matching both our record and A4TE);
     `il.drivers-license.gender-marker` (SOS-facility visit, Gender Designation Change form, no
     medical documentation — matching both sides). Illinois's felony/sex-offender-registrant
     name-change restrictions that A4TE states are confirmed still current law (§ 21-101(b),
     (b-1)) — A4TE is accurate here, and this is a restriction our corpus omits entirely (see
     gaps).

4. **Document types A4TE covers that we don't:** none among the six categories — same three
   (court-order, drivers-license, birth-certificate) on both sides. No SSA-card, passport,
   financial-records, marriage, or voter-ID content on A4TE's IL page.

5. **A4TE gaps:** the **Motion to Impound** privacy-sealing option for the court file
   (`il.court-order.name`'s `detail` field) — real, current law (§ 21-103.8, eff. 3-1-25) that
   A4TE's page omits entirely; the corpus's `fee_waiver: true` flag, which A4TE doesn't mention;
   full Spanish parity (`il.*.es`) that A4TE's English-only guide has no equivalent for. One gap on
   **both** sides, found while checking the statute rather than from either guide: **735 ILCS
   5/21-106** (eff. 7-1-24) lets an Illinois resident born in another state or country petition an
   Illinois circuit court for findings of fact to help correct an out-of-state birth certificate —
   potentially significant for a trans Illinoisan born in a more hostile state, and a candidate for
   this corpus to add since neither guide currently covers it. Conversely, our corpus is missing
   the felony/registrant name-change restriction A4TE does state (§ 21-101(b)/(b-1)) — worth adding
   from our side.

## Indiana

**A4TE page:** `transequality.org/documents/indiana-identity-documents` — reachable (200),
current and thorough, explicitly dated **"Last updated February 2026"**, correctly reflects
Indiana's Feb. 2026 BMV rule change.

1. **Sources A4TE points to that we don't cite:** Ind. Code §§ 34-28-2-1 to -4 (name-change
   petition), IC 11-8-8-23 (victim notification), IC 31-15-2-19 (A4TE's cite for the lifetime
   sex/violent-offender bar — this citation number reads as mismatched to a dissolution-of-
   marriage statute; flagged for a maintainer to check, not resolved here), IC 34-28-2-1.5
   (prohibited-persons list, religious exception), IC 31-33-26-17, and **IC 16-37-2-10**
   ("Additions or Corrections to Birth Certificate," the likely authorizing statute behind both
   `in.birth-certificate.name` and `.gender-marker`). `iga.in.gov` is a JS single-page app that
   returns an empty shell to a plain fetch (confirmed, 691-byte skeleton) — none of these statute
   texts were independently readable this way. The Indiana Legal Services LGBTQ+ Project guide and
   DeBrota Law Firm pro bono program (≤$40,000 income) are named as resources; the LGBTQ+ Project
   guide appears only in a record's `detail` field today, not as a `source.url`.

2. **Forms A4TE names that the registry lacks:**
   - **Form 49607** ("Application for Search and Certified Copy of Birth Record," IN DOH Vital
     Records) — named explicitly by A4TE for both the name-only and gender-marker birth-
     certificate paths; confirmed live on the IN DOH vital-records page ("print Form 49607").
     Zero IN vital-records forms currently in `forms/registry.json`.
   - A full minor's-name-change form set from Indiana Legal Help (Verified Petition, Order,
     Consent to Change Name of Minor, Affidavit of Diligent Search, self-represented Appearance) —
     the registry has only the adult packet (`in-cca-namechange-adult`).

3. **Facts where A4TE and our record disagree:**
   - **DISAGREEMENT (fee) — `in.birth-certificate.name` / `.gender-marker`.** A4TE states a flat
     **$10.00 fee, including one certified copy**. Our record states no fee at all is published.
     **Primary-source check, live today:** IN DOH's own fee schedule lists **"Birth Certificate:
     $10.00"** (a certified-copy line item) as *separate* from **"Amendment/Correction on a Birth
     Certificate: $8.00,"** while the corrections page itself tells applicants to call
     (317) 233-2700 rather than publish a combined total. **Neither A4TE's flat $10 nor our
     record's "no fee stated" matches the department's own two-line breakdown, and the department
     doesn't publish a combined total anywhere reachable — this needs a phone call to resolve, not
     another web fetch.**
   - **DISAGREEMENT (partially resolved) — `in.birth-certificate.gender-marker`.** Our record
     already flags an internal conflict: IN DOH's FAQ says a court order suffices, but a separate
     legal-aid guide says the gender marker "cannot be changed at all." A4TE states a confident
     "Yes," with a concrete procedure (court order + Form 49607 + fee) citing IC 16-37-2-10. The
     live DOH FAQ is unchanged today ("A court order is needed for a legal sex change"), consistent
     with A4TE's account and adding real procedural detail — **but neither A4TE nor DOH's own site
     explains how someone obtains a court order specifically for a gender-marker change**, since
     Indiana has no standalone statewide petition for that (unlike its numbered name-change
     process). A4TE adds detail; it does not close the gap our record already flagged.
   - **Agreement, well-corroborated:** DL gender-marker unavailability (BMV stopped effective
     Feb. 12, 2026 under Amended Rule 140/IAC 7-1.1-3) — our record, A4TE, and a fresh BMV fetch
     today all state the identical rule and date. The `needs_reverification` flag's 30-day SLA is
     overdue, but the content itself holds up. Court filing fee ($157, $185 with sheriff service)
     matches exactly between A4TE and `in.court-order.filing-fee`.

4. **Document types A4TE covers that we don't:** none. A4TE mentions SSA/passport only as a
   closing checklist item, deferring to its own generic (non-state) page — no IN-specific SSA/
   passport facts to check against `federal.json`.

5. **A4TE gaps:** the specific Court of Appeals case law (`In re Name Change of A.L.`, 81 N.E.3d
   283; `In Re M.E.B.`, 126 N.E.3d 932; `In Re K.H.`, 127 N.E.3d 257) behind the publication-
   sealing route in `in.court-order.publication` — A4TE names the mechanism, not the cases; the
   internal-source-conflict flag itself on `in.birth-certificate.gender-marker`, which A4TE
   presents as a single confident "Yes" with no acknowledgment another advocacy org's guide
   disagrees; more granular fee-waiver mechanics on the $157/$185 court fee.

## Iowa

**A4TE page:** `transequality.org/documents/iowa-identity-documents` — reachable (200), broad
coverage, **no visible last-updated date anywhere**. Birth-certificate section is current; **the
driver's-license gender-marker section is stale**, describing a since-rescinded rule.

1. **Sources A4TE points to that we don't cite:** Iowa Code § 618.13 (alongside ch. 674, A4TE's
   "Changing Names" cite) and IAC 641-99.6(144) ("Amendment of Vital Record") — our
   birth-certificate records cite Iowa Code § 144.23 directly instead, a defensible but different
   citation. More substantively: **A4TE's overview states Iowa restricts name changes for people
   incarcerated or under felony-related civil-liberties restrictions** (some surviving past
   sentence/parole). `ia.court-order.name` says nothing about this restriction at all — a real
   content gap, not just a sourcing one.

2. **Forms A4TE names that the registry lacks:** `forms/registry.json` has **zero** `US-IA`
   entries. A4TE names, by title only (Iowa's forms aren't numbered the way Indiana's are):
   "Petition for Change of Name" and "...of Minor Child" (Iowa Judicial Branch e-filing forms),
   "Application and Affidavit to Defer Payment of Costs" (fee waiver), and "Abstract to Change
   Registrant's Legal Name on Birth Certificate" (Iowa HHS Bureau of Health Statistics).

3. **Facts where A4TE and our record disagree:**
   - **DISAGREEMENT (fee) — `ia.court-order.name`.** A4TE: the filing fee "varies depending on
     county." Our record: a fixed **$195**. **Primary-source check, live today:** the Iowa
     Judicial Branch's own self-help page states, twice (adult and minor sections), a flat
     **"$195 filing fee"** — not county-variable. **Our record is current and correct; A4TE's
     "varies by county" claim reads as wrong or badly outdated for this fee.**
   - **DISAGREEMENT (the flagged high-value item) — `ia.drivers-license.gender-marker`.** Our
     record (`needs_reverification`) says Iowa DOT "does not publish a page" describing a
     gender-marker path and calls the state "unclear." A4TE states the opposite in detail: DOT "is
     still processing gender marker updates" — Iowa-born applicants use their birth certificate;
     others use a notarized physician affidavit, amended out-of-state birth certificate, CRBA, or
     Certificate of Citizenship — citing "IAC 761-601.5" and a DOT memo PDF.
     **Primary-source check, live today:** the DOT memo link **404s** (confirmed via `curl -I`;
     no Wayback snapshot exists at all for that media id). The **current** IAC chapter 761-601
     (amended by ARC 9622C, effective 11/19/2025) shows rule **601.5 retitled "Parent's,
     guardian's, or custodian's consent"** — unrelated to sex designation; the sex requirement now
     lives at **601.4(7)**: "The sex listed on the ... license or ... card ... will be identical to
     the sex listed on the identity document submitted" — with **no physician-affidavit or
     out-of-state carve-out** anywhere in the current chapter. A Wayback Machine snapshot from
     Feb. 5, 2025 confirms the **old** rule 601.5(7), "Verification of change of sex designation,"
     did contain exactly the procedure A4TE describes — before being renumbered/rescinded as part
     of the same 2025 Iowa Acts Senate File 418 rulemaking already reflected in our
     birth-certificate record. **Conclusion: A4TE is describing a pre-November-2025 rule that no
     longer exists in that form; our record's "unclear/no current process found" holds up as the
     more accurate framing against the live rule text.** This is the single most consequential
     finding in this cross-check.
   - **Agreement (birth certificate, gender marker):** both sides agree Iowa HHS is no longer
     processing gender-marker amendments since SF418 removed the physician-affidavit provision
     from Iowa Code § 144.23 (effective July 1, 2025) — current on both sides. DL name-change fee
     ($10), birth-certificate name-amendment fee ($15, since July 2019), and the 30-day waiting
     period all match between A4TE and our records, reconfirmed live.

4. **Document types A4TE covers that we don't:** none. Same SSA/passport-as-checklist-item
   pattern as Indiana — no Iowa-specific facts to check against `federal.json`.

5. **A4TE gaps:** the precise SF418 statutory mechanics (§ 144.23(3)'s physician-affidavit
   subsection deleted outright, new § 4.1A defining "sex"/"gender" as synonyms tied to birth) are
   far more precise in `ia.birth-certificate.gender-marker` than A4TE's one-line "no longer
   processing" statement; the `needs_reverification`/30-day-SLA mechanism on exactly the two
   records where the ground truth was genuinely moving is a structural advantage A4TE's undated
   static page has no equivalent for.

## Kansas

**A4TE page:** `transequality.org/documents/kansas-identity-documents` — reachable (200), long
and detailed, carries its own **"Important Note" banner dated February 2026** noting it is
"still monitoring SB 244" — but is **internally inconsistent**: newer SB244-aware framing coexists
with an older section describing pre-SB244 status.

1. **Sources A4TE points to that we don't cite:** Kansas Judicial Council's adult-name-change
   forms library (`kjc.ks.gov/legal-forms/adult-name-change`) and poverty-affidavit fee-waiver form
   (both 403'd our declared UA — a `.gov` 403, not retried with a different UA); KDHE's
   "Amendments & Corrections" index and "Amend Adult Birth Certificates" pages (content overlaps
   the FAQ page we cite, under different URLs); the KDHE Amendment Request Form PDF
   (`kdhe.ks.gov/DocumentCenter/View/46270`, live); K.S.A. 60-1401 (confirms "at the cost of the
   petitioner," no dollar figure, useful corroboration not currently cited); K.S.A. 23-2223
   (minor birth-certificate parent-name procedure); Kansas district-court locator and a minor
   name-change self-help portal.

2. **Forms A4TE names that the registry lacks:** **all of them** — `forms/registry.json` has
   **zero** Kansas entries. Kansas Judicial Council forms have no numeric ids, only names: Petition
   for Change of Name (adult/minor), Civil Cover Sheet, Order Changing Name, Notice of Hearing by
   Publication/by Mail, Poverty Affidavit/Order Waiving Docket Fee, Verification of Next Friend,
   Consent of Parent to Change Name of Minor Child, Motion/Order Waiving Service by Publication,
   plus KDHE's Amendment Request Form (PDF, `DocumentCenter/View/46270`).

3. **Facts where A4TE and our record disagree:**
   - **DISAGREEMENT (the flagged high-value item) — `ks.birth-certificate.gender-marker`.** A4TE:
     an already-amended birth certificate "is still valid," and only a newly-requested certified
     copy will show sex at birth going forward. Our record: SB 244 directs KDHE to **invalidate
     and amend the certificate in the database itself**, not just future copies.
     **Primary-source check, live today:** KDHE's FAQ (`kdhe.ks.gov/FAQ.aspx?QID=265`, mirrored at
     `/1172/Amend-Adult-Birth-Certificates`) states verbatim that SB 244 "directs [KDHE] to
     invalidate and amend the birth certificate to reflect the individual's sex at birth" — **this
     matches our record, not A4TE's description. Our record is current; A4TE's is outdated.** A4TE's
     own cited source for this section, `kdhe.ks.gov/DocumentCenter/View/30719/SB-180-Impacts-on-
     Birth-Certificates`, is now a **dead link (404)** — a concrete, checkable staleness signal on
     A4TE's own page. (SB 244 was still moving through committee as late as Jan. 27–28, 2026, with
     a driver's-license compliance deadline of March 25, 2026 — A4TE's February 2026 update landed
     right at passage, before KDHE's database-invalidation implementation rolled out; its top
     banner already knows about SB244 while a lower section still describes the older SB180-era
     interim behavior.)
   - No factual disagreement on DL gender-marker unavailability itself (both sides agree Kansas no
     longer permits new changes); A4TE is vaguer ("may have been revoked") where our record gives
     the specific deadline (see gaps below).
   - **No disagreement found** on `ks.birth-certificate.gender-marker.law` (K.S.A. 77-207,
     reconfirmed live, unchanged), `ks.court-order.name` (K.S.A. 60-1402, reconfirmed live —
     A4TE's procedural detail is actually richer here), and the $16/$12 DL-ID and $20
     birth-certificate-amendment fees (all reconfirmed live).

4. **Document types A4TE covers that we don't:** none. A4TE name-drops "social security card, and
   passport" as a closing checklist item with no KS-specific content; no marriage/voter-ID/
   financial-records content.

5. **A4TE gaps:** KDHE will **not refund** fees already paid for a since-invalidated amendment,
   and **cannot proactively notify** affected people (no current contact on file) — both confirmed
   live, neither mentioned by A4TE; the exact DL compliance deadline (close of business
   March 25, 2026, no further grace periods anticipated) where A4TE is only vague; appeal rights
   under K.S.A. 8-259 for the DL surrender (with the caveat that appealing doesn't preserve
   validity while pending) — absent from A4TE entirely; the exact statutory citation/enactment
   data for the sex-definition law (K.S.A. 77-207, L. 2023 ch. 84, eff. July 1, 2023) — omitted
   from A4TE's own "Code Citations" list; the corpus's structural split of **law**
   (`ks.birth-certificate.gender-marker.law`) from **practical effect**
   (`ks.birth-certificate.gender-marker`) as separately dated, re-checkable records — a mechanism
   A4TE's single static page has no equivalent of.

## Kentucky

**A4TE page:** `transequality.org/documents/kentucky-identity-documents` — reachable but **very
thin**: three short paragraphs, no step-by-step process, no fees, no timelines, no legal-aid
resources, **no last-updated date at all** — reads as a stub next to Kansas's page.

1. **Sources A4TE points to that we don't cite:** the full KRS name-change range §§ 401.010–
   .040 (our `ky.court-order.name` cites only 401.010; the rest — minors, order-book entry,
   certification/fee — aren't independently cited). **Methodology limitation, applies to both
   sides:** `apps.legislature.ky.gov` is a JS single-page app; a plain fetch returns only an empty
   shell for every relevant statute id, so **neither A4TE's nor our own citation to this site could
   be independently confirmed** in this pass.

2. **Forms A4TE names that the registry lacks:** none — **A4TE names no form ids or titles at all**
   for any of its three topics, only prose paraphrases of statutory requirements. Our registry's
   one KY entry, `ky-vs-2j` (Form VS-2J), is a form A4TE doesn't name despite pointing at the same
   underlying requirement.

3. **Facts where A4TE and our record disagree:**
   - **DISAGREEMENT — `ky.drivers-license.gender-marker`.** A4TE: submit one of three documents —
     an updated birth certificate, a court order of gender change, or a surgeon's letter — to
     change a KY ID's gender marker. Our record: Kentucky's Transportation Cabinet publishes no
     standalone gender-marker process; only a name-change document requirement is mentioned when
     name/DOB/gender differs from underlying documents.
     **Primary-source check, live today:** `drive.ky.gov/Drivers/Pages/ID-Cards.aspx` and
     `.../Update-Replace.aspx` (both current) describe only a name-change process (SSA update →
     documentation → in-person visit, $15 fee), with a passing mention of a "name change document
     ... if your current ... gender is different" — **no standalone gender-marker path, and
     nothing matching A4TE's three-document list, on either page.** This doesn't prove the
     process doesn't exist somewhere unpublished, but on the two most likely current official
     pages, it isn't there. **Our record's "couldn't find a published process, confirm directly"
     framing is the one corroborated by what's currently live; A4TE's specific three-document
     claim isn't corroborated by current KYTC web content.**
   - **No disagreement** on `ky.birth-certificate.gender-marker` — A4TE's paraphrase (physician's
     sworn statement of surgical procedure + certified court-order name change) matches the live
     current VS-2J PDF (Rev. 11.24.2025), which quotes KRS 213.121(5) in full. `ky.drivers-
     license.name` (SSA-first, in-person, $15, 10–15 business days) also reconfirmed live and
     unchanged.

4. **Document types A4TE covers that we don't:** none — same four categories (court-order,
   drivers-license name+gender, birth-certificate name+gender) on both sides.

5. **A4TE gaps:** no fee amounts anywhere on A4TE's KY page — our corpus has exact figures ($15
   DL/ID, $10 certified corrected birth certificate, waived if a certified copy from within the
   past year is returned); no timeline (our corpus: 10–15 business days, reconfirmed live); no
   historical context (our record notes the surgical-procedure requirement "has been in Kentucky
   law since 1990" — a durability signal A4TE doesn't offer); the explicit epistemic-honesty
   framing on `ky.drivers-license.gender-marker` itself, which this cross-check suggests may
   actually be the more accurate posture right now.

## Louisiana

**A4TE page:** `transequality.org/documents/louisiana-identity-documents` — reachable, thorough,
explicitly **"Last updated November 2025"** — the most current-looking page in this batch. One
fetch limitation: the entire `ldh.la.gov` domain 403'd our declared UA, so LDH-hosted PDFs below
are cross-checked via A4TE's description only, not independently refetched.

1. **Sources A4TE points to that we don't cite:**
   - `legis.la.gov/legis/Law.aspx?d=98726` — **La. R.S. 40:62.1** ("Issuance of new birth
     certificate for child with mistaken sex designation"), fetched live (200): authorizes a
     *child's* birth-certificate correction via two physicians' affidavits of a hereditary/
     hormonal condition, and explicitly states it does **not** apply to "sexual reassignment or
     major corrective surgery." This is almost certainly the statutory basis behind LDH's own
     "not applicable for gender reassignment" framing already captured in
     `la.birth-certificate.gender-marker.agency-guidance` — but that record cites only LDH's
     webpage, not this statute directly. Worth adding as a supporting citation.
   - `lasc.org/About/MapsofJudicialDistricts` (LA Supreme Court's judicial-district finder) and
     OMV contact/appointment pages — navigational, not fact-bearing.
   - `latransadvocates.org/id-documents-center` (a third-party NGO, not `.gov`) — A4TE's actual
     source for parish-specific name-change petition templates, since Louisiana has no single
     statewide form.

2. **Forms A4TE names that the registry lacks:** `forms/registry.json` has **zero** `US-LA`
   entries. A4TE names, unverifiable today due to the LDH 403:
   - "Application to Amend Birth Certificate" (LDH Center for Vital Records, filename implies
     informal "Form S2").
   - "Affidavit for Correcting of Given Names Only" (minors ≤12, same LDH office).
   No name-change petition has one statewide form (parish-variable, per A4TE), and no form is
   named for the DL gender-marker change (physician's letter only, on both sides).

3. **Facts where A4TE and our record disagree:** **none found.** Everything checkable
   corroborates: `la.birth-certificate.name`'s $27.50 + $9/extra-copy fee and 8–12 week timeline
   match A4TE exactly; `la.birth-certificate.gender-marker`'s court-order/surgery standard matches
   a live refetch of **La. R.S. 40:62** today, text unchanged; `la.drivers-license.gender-marker`
   matches a live refetch of **OMV Policy 22.01** today (unchanged since its 2009 revision date);
   `la.drivers-license.name`'s $17 fee is confirmed live, and the OMV consumer FAQ still contains
   no mention of "gender" anywhere, supporting the record's claim that OMV doesn't publish its
   gender-marker policy on public pages; `la.court-order.name`/`.fees`'s felony and R.S. 14:2(B)
   violent-felony bars match a live refetch of R.S. 13:4751 exactly. One nuance, not a hard
   conflict: A4TE twice states LA name changes are "at the discretion of the district court";
   `la.court-order.name` carries no `discretionary` flag today (only `la.court-order.fees` does).

4. **Document types A4TE covers that we don't:** none among our six categories. One granular
   fact worth folding in: A4TE states there is **no X gender-marker option in Louisiana** (M/F
   only) — a hard ceiling our `la.drivers-license.gender-marker` record doesn't currently state.

5. **A4TE gaps:** the **$15 search fee** when the original birth certificate can't be produced
   (`la.birth-certificate.name`) — A4TE never mentions it; the distinction between the ordinary
   felony name-change bar (lifts after sentence/parole) and the **permanent, no-waiting-period
   bar** for R.S. 14:2(B) "crime of violence" convictions — A4TE's overview states only "you
   cannot change your name" for a violent felony, without the statute or the permanence detail;
   the finding that LDH's own public page never mentions the R.S. 40:62 surgery-based path at all
   and instead describes an unrelated process it says is "not applicable for gender reassignment"
   (`la.birth-certificate.gender-marker.agency-guidance`) — a genuine navigational trap, not on
   A4TE's page, and strong partnership-pitch material.

## Maine

**A4TE page:** `transequality.org/documents/maine-identity-documents` — reachable but **thin and
stale-looking**: ~68 lines (vs. Louisiana's ~370), **no visible last-updated date**, three of its
cited Maine.gov PDF links are dead, and its birth-certificate and name-change sections describe
procedures Maine has since superseded. Its driver's-license section is accurate and current.

1. **Sources A4TE points to that we don't cite:** none currently valid. What A4TE cites is either
   already represented under current URLs in our corpus, or dead: the VS7/VS14 PDF links A4TE
   cites both **404 today**; `maine.gov/sos/bmv/forms/GENDER%20DESIGNATION%20FORM.pdf` **404s
   today** (our registry's `me-bmv-mvl20` already uses the current live URL); A4TE's statute cite,
   "Me. Rev. Stat. tit. 18-A, § 1-701," **404s today** — Maine recodified its probate code from
   Title 18-A to 18-C years ago, and our record already correctly cites the current 18-C § 1-701.
   A4TE also links a "Name Changes for Minors in Maine" resource, surfacing that **our corpus has
   no minor-specific Maine name-change record at all** — a genuine coverage gap (adult-only today).

2. **Forms A4TE names that the registry lacks:** registry already has `me-bmv-mvl20` and
   `me-drvs-vs7`; nothing new and current from A4TE. A4TE separately names a "Physician's
   Affidavit for Legal Change of Sex" (hosted on A4TE's own server, still live, but appears — see
   below — to describe a superseded, no-longer-required legacy process, so not addable as a
   current requirement). Independent of A4TE: our own `me.birth-certificate.name` record names
   VS-14 by title, yet **`forms/registry.json` has no VS-14 entry at all** — a real registry gap
   found via this review, unrelated to A4TE.

3. **Facts where A4TE and our record disagree:**
   - **DISAGREEMENT (major) — `me.birth-certificate.gender-marker`.** A4TE: Maine issues an
     amended birth certificate with a physician's letter verifying surgery/treatment is
     "completed," via a notarized "Physician's Affidavit" plus an "Application to Correct a Vital
     Record." Our record (`verified`): adults 18+ can change the marker themselves — no court
     order, no doctor's letter — using only the notarized VS-7 form and a $60 fee; a physician's
     declaration is required only for a minor's application.
     **Primary-source check, live today:** `maine.gov/dhhs/mecdc/vital-records/amend-correct-or-
     complete-vital-records/change-the-gender-marker-on-your-birth-record` states plainly that
     people 18+ "may simply complete" the VS-7 application and sign it with a notary — **no
     physician's letter for adults**; a "Gender Marker Change Health Care Professional
     Declaration" applies only to minors. **Our corpus is current; A4TE describes a pre-self-
     attestation process Maine has since replaced** — corroborated by A4TE's own dead VS7/VS14
     links and by the fact its "Physician's Affidavit" PDF now lives only on A4TE's own server,
     not `maine.gov`.
   - **DISAGREEMENT (secondary) — `me.court-order.name`.** A4TE: a publication requirement exists,
     waivable for abuse/safety, citing Title 18-A § 1-701. Our record: the court **may not**
     require public notice before approving an adult name change, citing the current Title 18-C
     § 1-701, $75 fee. **Primary-source check, live today:** the current statute (data extracted
     10/20/2025) states verbatim in subsection 2 that "the court may not require public notice
     before approving the name change" — matching our record exactly, with the $75 fee confirmed
     in subsection 4. A4TE's abuse/safety carve-out does exist in current law, but only for a
     **minor's** name change (subsection 2-A's parent/guardian-notice rule), not a general adult
     publication requirement. **Our corpus is current; A4TE's citation to the now-nonexistent
     Title 18-A indicates this section predates Maine's 18-A→18-C recodification** and conflates
     the minor-notice carve-out with a general adult rule that doesn't exist.
   - **No disagreement** on `me.drivers-license.gender-marker` — A4TE's description (M/F/X,
     self-attestation, no medical certification, effective November 2019) matches our record
     exactly; this is the one section of A4TE's Maine page that reads as current.

4. **Document types A4TE covers that we don't:** none — same three categories on both sides.

5. **A4TE gaps:** the entire **minor's** birth-certificate gender-marker process (parent/guardian
   + Health Care Professional Declaration) is absent from A4TE's ME page entirely; the "once a
   field is changed administratively, a later change needs a court order" rule
   (`me.birth-certificate.gender-marker`); `me.drivers-license.gender-marker.law` (Maine SOS's
   legal-authority memo — state civil-rights basis, the open REAL-ID/X-marker federal-acceptance
   question) has no A4TE counterpart at all; the $60-stacking detail (a separate name-change
   application costs another $60 atop the VS-7 fee, confirmed live) — absent from A4TE. One mutual
   gap, not scored against either side: Maine's confidentiality/sealing provisions for adult
   name-change records (18-C § 1-701 subsections 3, 3-A, 3-B) exist in current law but appear in
   neither A4TE nor our corpus — a candidate future corpus addition.

## Next steps for a human

This document is index-driven research, not a fix. Per scope, no record was touched to produce
it. A follow-up wave should, per `docs/OPERATIONS.md`'s reviewed-fix discipline (read the source,
correct EN+ES, re-snapshot/re-baseline only what changed):

1. **Highest priority — records already correctly saying the more cautious/accurate thing, now
   corroborated by a live primary-source fetch in this pass:** `ia.drivers-license.gender-marker`
   (corroborates its "unclear" framing against the live post-SF418 rule),
   `ks.birth-certificate.gender-marker` (corroborates the SB244-invalidation reading),
   `id.drivers-license.gender-marker` (corroborates that no current path exists — A4TE's cited
   Form ITD3533 has been gone since mid-2024), and `ky.drivers-license.gender-marker`
   (corroborates its "couldn't confirm a published process" framing). None of these four need a
   *content* fix — all four already say the more accurate thing — but each should have its
   `last_verified` bumped only after a human re-reads the cited page, per the freshness SLA.
2. **Idaho — firm up, don't hedge, on the birth-certificate side.** Unlike the item above,
   `id.birth-certificate.gender-marker` can now move from hedged/`needs_reverification` to a
   confident "not currently available," per the Jan. 8, 2026 injunction dissolution (Idaho AG
   press release + 4 independent news outlets, all confirmed live in this pass). A human should
   read that source and update the record's confidence, not just its date.
3. **Georgia — resolve the two-path question.** `ga.birth-certificate.gender-marker` currently
   states no court-order path exists; this pass found live cross-references suggesting a
   court-order+surgery path (§ 31-10-23(e)) coexists with the documentary-evidence path the record
   describes. A human should read the raw statute (not accessible to automated fetch in this pass)
   and decide whether to add the second path, not just patch the citation.
4. **Illinois — add the missing 3-month residency fact.** `il.court-order.name` states no
   residency duration at all; this pass confirms the current statute (735 ILCS 5/21-101(a), eff.
   3-1-25) requires 3 months' residency measured at the hearing/order, not at filing. Also
   consider adding the felony/sex-offender-registrant restriction (§ 21-101(b), (b-1)) A4TE states
   and our record omits.
5. **Indiana — a phone call, not a web fetch.** `in.birth-certificate.name`/`.gender-marker`'s fee
   field needs a call to IN DOH Vital Records (317-233-2700) to resolve whether $8, $10, or both
   apply to an amendment; no web source states a combined total.
6. **Registry gaps to fill** (form id + agency, all detailed above): GA none; HI 2 (DOH amendment
   + physician-affidavit forms); ID 12+ named Idaho court forms (NCA/NCM series) — Idaho currently
   has only 1 registry entry; IL 2 named forms, neither numbered by either side; IN Form 49607 +
   minor packet; IA 0 of 4 named forms currently registered (IA has zero registry entries at all);
   KS 0 of ~9 named forms currently registered (KS also has zero registry entries); KY none named
   by A4TE; LA 2 LDH PDFs (unverifiable pending an LDH-domain UA resolution — see below); ME's
   independently-found VS-14 gap.
7. **A fetch limitation worth a maintainer's attention, unrelated to any specific record:** the
   entire `ldh.la.gov` domain, `kjc.ks.gov`, and `ilsos.gov` all either 403'd or timed out against
   this project's declared user-agent during this pass; `apps.legislature.ky.gov` and `iga.in.gov`
   are JavaScript single-page apps that return an empty shell to any plain fetch. Per this
   project's own stated policy, none of this is something to work around by spoofing a browser
   UA — but it means several Louisiana LDH-hosted forms, the Kansas Judicial Council's forms
   library, an Illinois Secretary of State form id, and the raw Kentucky/Indiana statute text
   couldn't be independently confirmed here, and should be flagged the same way
   `docs/OPERATIONS.md` already flags `nycourts.gov`/`health.ny.gov`/the SSA PDF.
8. Everything under "A4TE gaps" per state above is optional, additive corpus-quality work, not a
   correctness fix — useful mainly for the #198 partnership pitch (evidence that a structured,
   source-verified corpus adds real value alongside A4TE's own guides, not a duplicate of them).
   Two mutual gaps (neither side covers them) are worth a maintainer's independent look: Hawaii's
   marriage-certificate sex-designation path (HRS §572, Act 179) and Illinois's out-of-state
   birth-certificate correction petition (735 ILCS 5/21-106).

Do not treat any "no disagreement found" line above as a substitute for that record's own
`recheck_sla_days` cycle — several records checked here as "still accurate today" are already past
their 30-day SLA and are due for a normal, independent re-verification regardless of this pass's
findings.
