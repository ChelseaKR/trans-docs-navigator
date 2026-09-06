# A4TE Cross-Check — Alabama through Florida + Federal — 2026-09-05

> **Index-driven review, not verification.** Advocates for Trans Equality (A4TE,
> formerly NCTE) maintains human-curated state guides at
> `transequality.org/documents/<state>-identity-documents`. This document uses those
> pages **only as a map** — which agencies, pages, forms, and facts to go check — never
> as a cited source and never quoted beyond a form id or a number; their prose is
> copyrighted and this project cites official government sources. No record's
> `verification_status`, `last_verified`, or `verifier` field was touched to produce
> this document, and nothing in `corpus/`, `forms/`, `corpus/referrals/`, `tests/`,
> `src/`, or `api/` was edited. This is the reviewed input a human (or a follow-up PR)
> acts on, not the fix itself.

## Scope and method

- Ten jurisdictions — Alabama, Alaska, Arizona, Arkansas, California, Colorado,
  Connecticut, Delaware, District of Columbia, Florida — plus the federal records in
  `corpus/jurisdictions/federal.json` (SSA, passport), checked against `forms/registry.json`
  and each record's own `source.url`.
- Every A4TE page was fetched with `curl -A "trans-docs-navigator-source-watch/1.0
  (+https://github.com/ChelseaKR/trans-docs-navigator)"` on 2026-09-05 and read in full
  (converted to plain text with `pandoc`, not summarized by a model). DC's slug on A4TE's
  site is **`district-columbia-identity-documents`**, not `district-of-columbia-...` or
  `dc-...` — found by crawling A4TE's own site index
  (`transequality.org/documents`) after both natural guesses 404'd. Federal SSA/passport
  content on A4TE lives under `documents/know-your-rights-social-security` and
  `documents/know-your-rights-passports`, not a state-style slug.
- For every fact where A4TE and a corpus record appeared to conflict, the **current, live**
  primary `.gov` page (or, for one item, a case-law database) was fetched separately in
  this session and read — not assumed from either side. Where that resolved the conflict,
  this document says which side is current and cites the live page. Where it didn't
  (budget or the page itself being ambiguous), it says so plainly rather than guessing.
- "Missing forms" means a form A4TE names by id/title that has no entry in
  `forms/registry.json` — not that the corpus record itself is wrong.
- Nothing here implies a record's `verification_status` should change without a human
  re-reading the specific page cited below. This is triage input for a follow-up wave.

## Summary

| Jurisdiction | Official sources not cited | Forms missing from registry | Material disagreements (resolved this pass) | Uncovered doc types |
|---|---|---|---|---|
| Alabama (AL) | 2 | 1 | 3 (2 resolved) | 0 |
| Alaska (AK) | 3 | 3 | 1 (resolved) | 0 |
| Arizona (AZ) | 2 | 0 | 2 (resolved) | 0 |
| Arkansas (AR) | 1 | 0 | 0 | 0 |
| California (CA) | 4 | 2 | 0 | 0 |
| Colorado (CO) | 2 | 4 | 0 | 0 |
| Connecticut (CT) | 4 | 0 | 0 (1 unresolved fact) | 0 |
| Delaware (DE) | 0 | 1 | 0 (1 unresolved fact) | 0 |
| District of Columbia (DC) | 1 | 0 | 0 (1 unresolved fact) | 0 |
| Florida (FL) | 1 | 1 | 2 (resolved) | 0 |
| Federal (SSA, passport) | 1 | 0 | 0 | 0 |
| **Total** | **21** | **12** | **8** | **0** |

No jurisdiction in this batch has a document type A4TE covers that our five types
(court-order, ssa-card, drivers-license, passport, birth-certificate) don't already
name as a category — `financial-records` is a sixth type this project tracks that
**A4TE does not cover at all**, in any of the eleven pages read for this audit. See
"A4TE gaps" at the end.

---

## Alabama

**1. Sources not cited**
- ***Darcy Corbitt v. Secretary of the Alabama Law Enforcement Agency***, 115 F.4th 1335
  (11th Cir. Sept. 20, 2024) — confirmed real via CourtListener's opinion database
  (docket search on "Corbitt" + "gender marker", court `ca11`, one hit, filed
  2024-09-20). This is the appellate decision that currently governs whether Alabama
  must let people change the sex marker on a driver's license. Neither
  `al.drivers-license.gender-marker` nor any other AL record cites it.
- Alabama Code §§ 22-9A-19, 22-9A-21 — the birth-certificate sex-change statute A4TE
  cites (court order + surgical-procedure finding). Not cited by
  `al.birth-certificate.gender-marker`.

**2. Forms missing from `forms/registry.json`**
- `ADPH-HS-33`, "Application to Change an Alabama Birth or Death Certificate." Confirmed
  as the real, current form name on `alabamapublichealth.gov` today (see below) — not in
  the registry under any id.

**3. Disagreements — checked against the live `.gov` page, not assumed**
- **Birth-certificate amendment fee.** A4TE says $15.00. `al.birth-certificate.name`
  says $20.00. Live fetch of `alabamapublichealth.gov/vitalrecords/birth-certificate-corrections.html`
  today (page footer: "Page last updated: February 20, 2025") reads: *"the required
  amendment fee of $20.00, which includes one certified copy... Additional copies...
  are $6.00 each. There is an additional fee of $15.00 to expedite a request."*
  **Our corpus is current and correct; A4TE's $15 figure is stale** — most likely A4TE
  conflated the $15 expedite surcharge with the base fee.
- **Driver's license gender-marker route.** `al.drivers-license.gender-marker` says
  ALEA's page "names no form or process" and marks the record `needs_reverification`.
  A4TE describes two live routes: (1) get an amended birth certificate first, or (2) a
  surgeon's letter attesting "complete and irreversible" surgery, per *Corbitt v.
  Taylor*. Live fetch of ALEA's own cited page
  (`alea.gov/dps/driver-license/driver-license-forms`) today still says nothing about
  sex or gender anywhere on the page. **Both are simultaneously true**: the page our
  record cites really is silent (so the record isn't wrong about *that page*), but
  A4TE's fuller picture — sourced from litigation and internal ALEA policy, not this
  webpage — is the more complete and current answer to the reader's actual question.
  This is the strongest single finding in this batch: a materially different real-world
  answer ("here are the two ways," restrictive as they are) than what the record leaves
  the reader with ("we don't know / it might not be possible").
- **Name-change filing fee range.** A4TE says counties charge $25–$95. Our
  `al.court-order.fees` record cites Jefferson County's schedule (effective Oct 15,
  2025) at $125 — above A4TE's stated maximum. **Not resolved**: Jefferson County's own
  page is itself a primary source and is more recent than A4TE's citation, but I did not
  survey enough of Alabama's other 66 counties to know whether $25–$95 is still typical
  elsewhere or whether A4TE's range itself is dated. Flagging for a human, not guessing.

**4. Document types A4TE covers that we don't:** none.

**5. A4TE gaps:** A4TE's own AL page correctly separates "amending the name only" from
"amending the sex only" with distinct fee/form detail — more structurally organized than
our two separate `needs_reverification` records, but it never flags that ALEA's and
ADPH's own webpages are silent on gender/sex (a distinction our corpus is careful about
and A4TE is not).

---

## Alaska

**1. Sources not cited**
- `https://courts.alaska.gov/shc/courtfees.htm` — confirmed live today, states plainly:
  *"Change of Name (child or adult): $200."* This is the page the court's own CIV-699
  instructions point to for the fee amount; `ak.court-order.name` currently says only
  "not stated in dollars... contact the court." Worth adding with this exact citation.
- ***K.L. v. State, Dep't of Admin., Div. of Motor Vehicles***, No. 3AN-11-05431-CI
  (Alaska Super. Ct. Mar. 12, 2012) — the state-court decision A4TE cites as the basis
  for DL gender-marker changes existing at all in Alaska. Not independently verified via
  a case database this pass (it's a trial-court decision, not in the appellate databases
  checked), but it is not currently cited by `ak.drivers-license.gender-marker`.
- Alaska Statutes § 09.55.010 (name-change jurisdiction/notice) and 2 AAC § 90.480
  (driver's licenses) — statutory citations A4TE names that no AK record cites.

**2. Forms missing from `forms/registry.json`**
- `VS-405`, "Application or Report of Change of Name" — required alongside CIV-700 on
  every AK adult and minor name-change filing per both A4TE and the CIV-699 instructions
  PDF (confirmed: the live PDF names it too).
- `CIV-708`, "Request to Waive Posting in Adult Change of Name Case."
- `TF-920`, "Request for Exemption from Payment of Fees" (AK's fee-waiver form).

**3. Disagreements — checked against the live `.gov` page**
- **Birth-certificate processing time.** `ak.birth-certificate.name` says "about 16
  weeks." A4TE says "up to 3 months" (~13 weeks). Live fetch of
  `health.alaska.gov/en/services/vital-records-orders/` today: *"Corrections and
  paternities: ... please allow us 16 weeks for processing, this does not include
  shipping time."* **Our corpus's figure is current and more precise; A4TE's is a
  rounded understatement**, not a wrong one, but worth not "correcting" our 16-week
  figure down to match A4TE's if this is ever revisited.

**4. Document types A4TE covers that we don't:** none.

**5. A4TE gaps:** A4TE's page does not mention that Alaska's DMV blocks automated
re-verification (including, per our own record, the Internet Archive's crawler) — a
transparency note our `ak.drivers-license.gender-marker` record carries and A4TE's
doesn't. A4TE also doesn't independently flag Form 427 as needing two signers
(applicant + qualified professional) the way our record and the live form do, though
this is a wording difference more than a gap.

---

## Arizona

**1. Sources not cited**
- Ariz. Rev. Stat. § 36-337(A)(3) (2006) — the birth-certificate sex-amendment statute
  A4TE cites by section number; `az.birth-certificate.gender-marker` describes the same
  substantive rule but cites only the AZDHS webpage, not the statute itself.
- Ariz. Rev. Stat. §§ 12-601 & 12-602 — the name-change notice statute A4TE cites; not
  cited by `az.court-order.name`.

**2. Forms missing from `forms/registry.json`:** none with a stable id — A4TE's
"Application for Name Change for an Adult" and "birth certificate request form" are
named generically, without a form number, on both A4TE's page and the state's own
pages.

**3. Disagreements — checked against the live `.gov` page**
- **Name-change filing fee.** A4TE says "around $320." `az.court-order.fees` says
  $252.00 ($222 base + $15 + $15), citing `azcourts.gov/courtfilingfees/Superior-Court-Filing-Fees`.
  Live fetch of that exact page today, row "Petition for change of name": **$222.00 +
  $15.00 + $15.00 = $252.00**, unchanged. **Our corpus is current and correct; A4TE's
  $320 figure is stale or wrong** — it doesn't match any combination of statewide fees
  on the current schedule.
- **Driver's license gender-marker route and its source.** A4TE describes a single
  combined process — submit a court order and a physician's statement to MVD — and
  attributes it to "The Arizona Department of Transportation." Our
  `az.drivers-license.gender-marker` record instead cites a Maricopa County Superior
  Court self-help PDF (not ADOT) as the only source it could find for this, explicitly
  because ADOT "does not publish its own public webpage" on it. Live fetch of ADOT's own
  cited name-change page (`azdot.gov/mvd/services/driver-license-ID/change-your-name`)
  today: **zero mentions of "gender" or "sex" anywhere on the page.** **Our corpus's
  more careful sourcing is confirmed current** — A4TE's attribution of this process to
  ADOT directly appears to be either a conflation with the county self-help document or
  based on a page ADOT no longer publishes.

**4. Document types A4TE covers that we don't:** none.

**5. A4TE gaps:** A4TE doesn't flag Arizona's gender-marker rules as under active federal
litigation the way our two AZ `needs_reverification` records both do — a materially
important caveat for a reader in a state where the rules are genuinely moving.

---

## Arkansas

**1. Sources not cited**
- Ark. Code Ann. § 20-18-307 — cited by A4TE, not currently cited by any AR record.
  (A4TE's other citation, "Ark. Code Ann § 006-16-24," does not match Arkansas's
  standard title-chapter-section citation format and could not be resolved to a real
  statute; flagging it as a likely typo on A4TE's part rather than listing it as a
  source to add.)

**2. Forms missing from `forms/registry.json`:** none with stable ids — Arkansas's own
circuit-court forms (Cover Sheet, Petition for Change of Name, Order for Name Change, In
Forma Pauperis, Petition/Order for Gender Change) are referenced by title only, with no
form number, on both A4TE's page and the state's own court-forms site.

**3. Disagreements:** none found. A4TE's $165 circuit-court filing fee (both for a name
change and for a standalone gender-change petition) matches `ar.court-order.name`'s
figure exactly. A4TE additionally states a $10 fee to update a driver's license/ID and a
$15/$12 fee to update a birth certificate; the birth-certificate figures match
`ar.birth-certificate.name` exactly ($15 amendment + $12 first copy), and the $10
driver's-license fee is a fact our `ar.drivers-license.name` record doesn't state at
all (not a conflict — the record simply doesn't give a number).

**4. Document types A4TE covers that we don't:** none.

**5. A4TE gaps:** A4TE's page already notes that Arkansas rescinded self-ID and the "X"
marker option in 2024 — this matches `ar.drivers-license.gender-marker` closely; no
material gap found in either direction for Arkansas.

---

## California

**1. Sources not cited**
- Cal. Code Civ. Proc. §§ 1275–1279.5 (name changes, general).
- Cal. Code Civ. Proc. § 1277.5 (gender-identity name changes specifically).
- Cal. Veh. Code § 12800 (driver's licenses).
- Cal. Health & Safety Code § 103426 (birth certificates).

None of California's eight corpus records cite a state code section directly — all cite
`selfhelp.courts.ca.gov` or `cdph.ca.gov` pages. Adding the underlying statutes would
strengthen citation coverage without changing any asserted fact.

**2. Forms missing from `forms/registry.json`**
- `NC-100`, "Petition for Change of Name" — the base adult name-change petition.
  `ca.court-order.name` itself has no `form_ref` at all; A4TE names NC-100 as the actual
  form filed.
- `NC-300`, "Petition for Recognition of Change of Gender and Sex Identifier, Name
  Change, and Issuance of New Certificates" — the combined gender+name petition.
  `ca.court-order.gender-marker` likewise has no `form_ref`.

(A4TE also names NC-110, NC-125, NC-130, NC-330, CM-010, and several NC-3xx/5xx minor
and ancillary forms; NC-100 and NC-300 are the two that matter most, since they're the
petitions themselves, not attachments to them.)

**3. Disagreements:** none found. Every dollar figure A4TE states for California
matches the corpus: $435 name-change filing fee, $26 birth-record amendment fee. A4TE
additionally states a $40 certified-copy fee (court orders) and a 10–12 week birth-record
processing time that our corpus doesn't state at all — both are additions, not
contradictions, since the CA birth-certificate records explicitly decline to state a
processing time and instead point to CDPH's own timing page.

**4. Document types A4TE covers that we don't:** none.

**5. A4TE gaps:** California is A4TE's most thorough, most recently updated page in this
batch ("Last updated September 2025") and the closest match to our corpus; few gaps
either direction.

---

## Colorado

**1. Sources not cited**
- C.R.S. § 13-15-101 (petition proceedings) and § 13-15-102 (publication requirement,
  including the gender-identity publication exemption) — cited by A4TE; no CO record
  cites either directly (`co.court-order.name` cites `coloradojudicial.gov` only).

**2. Forms missing from `forms/registry.json`**
- `JDF 433`, "Petition for Name Change – Adult" — already named in
  `co.court-order.name`'s own text but has no `form_ref` and no registry entry.
- `JDF 386`, "Petition for Name Change – prior felon" (variant procedure for people with
  felony convictions).
- `JDF 389`, "Petition for Name Change – 70 Years of Age or Older."
- `DR 2083`, "Change of Sex Designation" (Dept. of Revenue) — already named in
  `co.drivers-license.gender-marker`'s own text but has no `form_ref` and no registry
  entry.

**3. Disagreements:** A4TE states a name-change filing-fee range of "$98–$268." Live
fetch of `coloradojudicial.gov/self-help/adult` today confirms our corpus's claim: **the
cited page itself states no dollar figure**, only that a fee waiver (JDF 205/206) is
available. A4TE's range must come from a different source (likely the "Guide to Name
Change" packet or individual county schedules) that I did not track down this pass — not
a contradiction of our record (which makes no fee claim to conflict with), but a
concrete number worth adding once its actual source is identified.

**4. Document types A4TE covers that we don't:** none.

**5. A4TE gaps:** A4TE flags that, "beginning July 1, 2026" (now in effect as of this
audit's date), Colorado minor name-change filings are automatically sealed and no longer
require publication — a real, current legal change. This affects only minor records,
which are out of scope for this audit's edits, but is worth a note for whoever is
currently adding minor records to the corpus.

---

## Connecticut

**1. Sources not cited**
- Conn. Gen. Stat. § 52-11 (name-change petitions).
- Public Act 15-132, "An Act Concerning Birth Certificate Amendments" (effective Oct. 1,
  2015) — the specific act that created CT's current gender-marker amendment path.
- Conn. Gen. Stat. § 19a-42 and Regs. Conn. State Agencies §§ 19a-41-5 through -12 —
  vital-records amendment regulations.

None of these are cited by `ct.court-order.name` or `ct.birth-certificate.gender-marker`,
both of which cite only `portal.ct.gov` pages.

**2. Forms missing from `forms/registry.json`:** none — Connecticut is actually the
reverse case. A4TE names CT's forms only generically ("Petition for Change of Name
(Adult)," "Affidavit Re Change of Name (Adult)," "Name Correction Request," "Gender
Designation Change Form"), while `ct.court-order.name` and `ct.drivers-license.name`
already name the specific form ids (PC-901, PC-910, Form E-78) that A4TE's page doesn't
give. See "A4TE gaps" below.

**3. Disagreements:** A4TE states a $225 combined petition-and-affidavit filing fee.
`ct.court-order.name` states no dollar figure, pointing instead to the Probate Court's
"Fees & Expenses Tool." I was not able to independently confirm $225 against a live
CT Probate fee-schedule page this pass (a guessed URL 404'd, and I didn't have budget
left to locate the correct one) — flagging as an unresolved fact for a human to check
directly against `ctprobate.gov`, not a confirmed disagreement.

**4. Document types A4TE covers that we don't:** none.

**5. A4TE gaps:** CT is one of the two thinnest, least-detailed pages in this batch (see
Florida for the other) — no visible "last updated" date at all, unlike most of A4TE's
other state pages, and it is less specific about form ids than our own corpus already
is.

---

## Delaware

**1. Sources not cited:** none found. A4TE's two DE statute citations — Del. Code Ann.
tit. 10 §§ 5901–5905 and 16 Del. Admin. Code § 4205-10.7 — are the same statute and the
same regulation (different subsection: `-10.7` vs. our cited `-10.0`) our
`de.court-order.jurisdiction` and `de.birth-certificate.name` records already cite.
Worth a human double-checking the `.7` vs. `.0` subsection difference, but this is not a
new source.

**2. Forms missing from `forms/registry.json`**
- "Healthcare Provider's Affidavit for Sex Change on Birth Certificate" — the companion
  form to the Requester's Affidavit we already have registered
  (`de-dph-sexchange-requester`); both are named in `de.birth-certificate.gender-marker`'s
  text, but only the requester's side has a registry entry.

**3. Disagreements:** A4TE states a Delaware driver's-license/ID fee of **"$1.15."**
`de.drivers-license.name` states the DMV page it cites doesn't give a clear dollar
figure — confirmed still true on a fresh fetch of that exact page today. $1.15 looks
implausibly low for a full license/ID transaction (Delaware's actual base ID fees are
tens of dollars in every public schedule I'm aware of), but I could not reach DE DMV's
separate "DMV Fees" subpage to confirm or refute the number directly this pass.
**Flagging as a likely error on A4TE's part, not confirmed** — a human should check DE
DMV's fee schedule directly before touching this record.

**4. Document types A4TE covers that we don't:** none.

**5. A4TE gaps:** none material — Delaware's A4TE page and our corpus agree closely on
process, fees ($85 name-change filing, $25 birth-certificate fees), and the "no X marker
available" fact for both DL and birth certificate.

---

## District of Columbia

**1. Sources not cited**
- D.C. Code § 7-210 — the statutory basis for DC Health's gender-designation amendment
  that A4TE cites; `dc.birth-certificate.gender-marker` cites only the DC Health PDF
  form, not the underlying code section.

**2. Forms missing from `forms/registry.json`:** none — all four DC forms A4TE names
(name-change application, gender self-designation, birth-record court-order amendment,
gender designation application) already have registry entries.

**3. Disagreements:** A4TE states specific DC DMV fees — **$47 for a first-time or
renewal license/ID, $20 for a duplicate.** `dc.drivers-license.name` and
`dc.drivers-license.gender-marker` both state only "DC DMV's standard fee... see DC
DMV's fee schedule," with no number. I attempted to reach a live DC DMV fee-schedule page
to confirm this and got a 404 on my guessed URL; not independently confirmed this pass.
Also worth noting: A4TE describes the DC gender-marker DL change as simply selecting
M/F/X on the *regular* DL application form ("no other documentation required"), while our
record cites a distinct standalone "Gender Self-Designation form" PDF. These aren't
necessarily in conflict — the standalone PDF may be exactly how that selection gets
formalized — but it's a framing difference worth a human's eye.

**4. Document types A4TE covers that we don't:** none.

**5. A4TE gaps:** A4TE's own DC name-change section is explicitly dated **"Last updated
December 2021"** — nearly five years old as of this audit. Our DC records were all
`last_verified: 2026-07-13`. This is a clean example of our corpus being more current
than A4TE's own page on the same topic, worth keeping for the partnership pitch in #198.

---

## Florida

**1. Sources not cited:** Florida Administrative Code's birth-record amendment rule
(A4TE quotes it as allowing amendments to sex with "original, certified, or notarized
supporting documentary evidence" but does not give a rule number, and I could not
independently pin down the exact current chapter/section this pass — flagging rather
than guessing a citation).

**2. Forms missing from `forms/registry.json`**
- `DH430`, "Affidavit of Amendment of Certificate of Live Birth" — confirmed as a real,
  currently-listed form on `floridahealth.gov/certificates-records/amendments-and-corrections/`
  today (used for several of that page's *other* amendment categories, e.g. paternity
  and legal name change); not in the registry alongside `fl-dh429`.

**3. Disagreements — checked against the live `.gov` page, and against A4TE's own
linked sources**

This is the most striking pair of findings in the whole batch, so it's worth showing the
work:

- **Driver's-license gender marker.** `fl.drivers-license.gender-marker` says FLHSMV's
  page "does not describe any way" to change the sex/gender marker. A4TE says a route
  exists: submit a court order and/or a physician's letter, and cites (a) FLHSMV's
  "name changes" page and (b) a link it calls "their memo on gender marker change
  policy." I checked both of A4TE's own links directly: (a) `flhsmv.gov/ddl/namechange.html`
  — an old URL — **redirects today to the exact same page** (`flhsmv.gov/name-and-address-changes/`)
  our record already cites and already found silent on gender; a fresh fetch of it
  today confirms zero mentions of "sex" or "gender" anywhere on the page. (b) The
  "memo" link, `gulfcoasttransgenderalliance.com/florida-dmv-gender-marker-change-requirements.html`
  — never an official government page, only a third-party mirror — **no longer resolves
  to that organization at all**; it 301-redirects to an unrelated `.id` domain, meaning
  the original site has lapsed and the domain has been repurposed. **A4TE's own citation
  for this claim is dead. Our corpus's current record is accurate; A4TE's is stale**,
  and its evidentiary trail for the claim no longer exists to check.
- **Birth-certificate gender marker.** `fl.birth-certificate.gender-marker` says the
  DOH's amendments page "does not list any way" to change sex on a birth certificate.
  A4TE says DH429 + DH430 + a physician's letter accomplish this. A fresh fetch of
  `floridahealth.gov/certificates-records/amendments-and-corrections/` today lists
  exactly seven amendment categories — Birth Amendments (general), Death Amendments,
  Medical Amendments, Paternity Acknowledgement, Legal Change of Name, Adoption
  Procedures, Release of Original Birth Certificate, Foreign Births, Delayed Birth
  Procedures — **and not one of them mentions sex or gender**. **Our corpus's current
  record is accurate and current; A4TE's claim does not reflect Florida's present
  policy** (consistent with Florida's broader, publicly known rollback of gender-marker
  changes on state records in recent years).

**4. Document types A4TE covers that we don't:** none.

**5. A4TE gaps:** Florida is A4TE's thinnest page in this batch by far (its main content
is two paragraphs plus links out to a third-party guide and a Florida-courts site) and
the one with the clearest evidence of being stale — both of its own driver's-license
citations are now dead or redirect away from the claim they were cited for. This is good
material for the partnership pitch: it's a concrete example of our re-verification
cadence catching something A4TE's own page has not caught up to.

---

## Federal (SSA, passport)

**1. Sources not cited**
- ***Orr v. Trump*** — A4TE notes the appeal of the district court's stayed injunction
  is pending before the **First Circuit** Court of Appeals; `us.passport.gender-marker`
  mentions the case and the Nov. 6, 2025 Supreme Court stay but not the appellate venue.
- SSA's own guidance is dated by A4TE to **January 31, 2025**; `us.ssa-card.gender-marker`
  cites the POMS section itself but not this specific issuance date.

**2. Forms missing from `forms/registry.json`:** none new from A4TE (DS-11, DS-5504, and
DS-60 are already named in `us.passport.name`'s own prose without registry entries, but
that's a pre-existing gap, not something A4TE surfaces).

**3. Disagreements:** none. Every dated fact on A4TE's two federal pages — the Jan. 20,
2025 executive order, the Jan. 31, 2025 SSA guidance, the Orr v. Trump injunction and its
Nov. 6, 2025 Supreme Court stay, "no X marker," "cannot correct sex on a renewal" — lines
up exactly with `us.ssa-card.gender-marker` and `us.passport.gender-marker`, both already
marked `needs_reverification`. This is the strongest cross-source agreement found in the
whole audit.

**4. Document types A4TE covers that we don't:** none (A4TE's federal pages also cover
Global Entry, TSA, and Enhanced Driver's Licenses — none of which map to this project's
five federal/state document types).

**5. A4TE gaps:** A4TE's federal pages (dated "Last updated: November 25, 2025") don't
walk through the form-level mechanics — when to use DS-11 vs. DS-82 vs. DS-5504, or that
a name change is still processed even though sex is not — the way `us.passport.name`
does. Good complementary strength to note for #198: A4TE is stronger on policy context
and litigation tracking; our corpus is stronger on the concrete form-by-form mechanics.

---

## A4TE gaps — useful for the #198 partnership pitch

Patterns that held across most or all of the ten state pages, not just one:

- **No `financial-records` coverage anywhere.** None of A4TE's eleven pages read for
  this audit (ten states + two federal) mention banks, financial institutions, or
  financial records at all. This is a document type our corpus's schema already
  recognizes (even though no jurisdiction in this batch has a record for it yet) that
  A4TE's index simply doesn't index.
- **No structured fee-waiver signal.** A4TE mentions fee waivers narratively wherever
  they exist, but nothing in its pages plays the role of our `fee_waiver: true` field —
  a reader has to find the sentence, not a flag.
- **Page-level "last updated" dates, not per-fact ones.** A4TE dates some pages
  (Alabama: November 2021; California: September 2025; Colorado: April 2026) but not
  others (Connecticut, Arizona, Florida carry no visible date at all), and the date
  covers the whole page even when — as in DC's "December 2021" name-change section next
  to presumably-fresher DMV/DOH sections — different parts were clearly last touched at
  different times. Our per-record `last_verified` + `recheck_sla_days` is more granular.
- **No built-in skepticism when a government page goes quiet.** Where a state's own
  page stops describing a route (Alabama's DL gender marker, Florida's DL and
  birth-certificate gender markers), our corpus is built to say "we could not find one
  — don't assume it's open," flagged `needs_reverification`. A4TE's pages in this batch
  state a route as available even where — as directly confirmed in Florida — the
  official pages and even A4TE's *own* cited links no longer support that claim. This
  project's honesty-first framing (the subject of this branch's own recent commits) is a
  genuine, demonstrable advantage over A4TE's index on exactly the pages where it
  matters most.
- **English only.** Every page read for this audit is English-only (Florida's
  third-party Cooley LLP guide is a one-off exception, not part of A4TE's own page).
  This project maintains EN/ES parity for every record.

## What this document is not

This is not a verification pass. No record's `verification_status`, `last_verified`, or
`verifier` changed. No corpus, forms, or referrals file was edited. The disagreements
above that were resolved were resolved by reading a live, primary `.gov` page (or, once,
a case-law database) directly — not by trusting A4TE over the corpus or the corpus over
A4TE. Where that resolution wasn't possible in this pass (Connecticut's $225 fee,
Delaware's $1.15 fee, DC's $47/$20 fees, Alabama's county fee range), this document says
so and names exactly what a human should go check next.
