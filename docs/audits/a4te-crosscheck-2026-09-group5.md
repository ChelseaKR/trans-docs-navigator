# A4TE ID Documents Center Cross-Check — SC through WY — 2026-09-05

> **This is an index-driven cross-check, not a verification pass.** Advocates for Trans
> Equality (A4TE, formerly NCTE) maintains human-curated state guides at
> `transequality.org/documents/<state>-identity-documents`. This document uses those
> pages **only as a map** — which agencies, pages, forms, and facts to go look at — never
> as a source of truth in its own right, and never as text to reuse. No A4TE prose is
> reproduced here beyond a form id, a statute citation, or a short quoted fact (a fee, a
> word count under a dozen words) needed to identify what's being compared. Every
> disagreement below was checked against this project's own live fetch of the relevant
> `.gov` page before this document takes a position on which one currently looks right —
> and several times the honest answer is "I can't tell, here's why."
>
> Scope: South Carolina, South Dakota, Tennessee, Texas, Utah, Vermont, Virginia,
> Washington, West Virginia, Wisconsin, Wyoming (the fifth of five parallel groups
> covering all 50 states + DC). Read-only: nothing in `corpus/`, `forms/`, `tests/`,
> `src/`, or `api/` was touched to produce this document.

## Method

- Each state's A4TE page was fetched on 2026-09-05 with this project's declared user
  agent (`trans-docs-navigator-source-watch/1.0 (+https://github.com/ChelseaKR/trans-docs-navigator)`),
  stripped of HTML/nav chrome, and read in full. All 11 pages returned HTTP 200.
- Every fact A4TE stated was compared against the matching `corpus/jurisdictions/<state>.json`
  record(s) and against `forms/registry.json`.
- For every disagreement that touches a fee, a timeline, a requirement, or whether a
  gender-marker path exists at all, this project's own tools re-fetched the **live cited
  `.gov` page** (the same URL our corpus record already cites, or the exact URL A4TE
  itself names as its source) on 2026-09-05 and quoted the current text directly, rather
  than trusting either side. Where a page is a JavaScript application that returns only
  navigation chrome to a plain fetch (confirmed independently via both `curl` and
  `WebFetch`), that is stated plainly as a limit on what could be checked, not papered
  over as a resolution either way.
- Tennessee's Secretary of State rules repository (`sos.tn.gov`) returned HTTP 403 to
  both `curl` (with the declared user agent) and `WebFetch` for every URL tried. One
  disagreement (Tennessee's driver-license gender-marker rule) could not be resolved for
  this reason and is flagged as unresolved rather than guessed at.

## Headline

A4TE's guides for this group are **strongest and most current on Washington and Texas**
— both show recent maintenance and, in Washington's case, already reflect the exact
venue-rule and mailing-address change this project corrected in its own records this
month. They are **weakest on Wyoming, Wisconsin, West Virginia, and Vermont**, where a
live re-fetch of the cited government page directly contradicts a specific fact A4TE
states — most strikingly **Wyoming**, where A4TE names a "Gender Designation Change
Request Form" for driver's licenses/IDs and cites, as its own source, the very WYDOT page
that this project confirmed today contains no such form and no mention of gender or sex
at all.

| Jurisdiction | A4TE page | New `.gov` sources found | New forms found | Disagreements (checked against primary source) | Doc types A4TE covers, we don't | A4TE gaps (we cover, they don't) |
|---|---|---|---|---|---|---|
| South Carolina | reachable, thin | 2 (SC birth-cert statutes, family-court locator) | 0 | 1 — SC gender-marker court process; live source no longer says "DHEC" (agency renamed 2024), fee/process unconfirmed | 0 | SLED/DSS/sex-offender screening detail; REAL ID $25 nuance |
| South Dakota | reachable, thin | 0 | 0 | 2 — DL gender path (source unreadable both sides); BC gender path (live source titled "Court-Ordered **Name** Change" only) | 0 | UJS-024–027 form packet; 6-month residency rule |
| Tennessee | reachable, thin | 2 (statewide statute; DPS Rule 1340-1-13-.12) | 0 | 1 — DL gender-marker rule; **could not verify**, sos.tn.gov blocked (403) | 0 | Shelby County procedural detail; *Gore v. Lee* litigation |
| Texas | reachable, detailed, "last updated Aug 2025" | 4 (EO 14168; Fam. Code §45; DPS fingerprint logistics; mailing address) | 6 (TX court-forms: petition, civil case info sheet, fingerprint card, order, fee-waiver declarations, minor equivalents) | 0 confirmed — content unusually well-aligned; one unconfirmed added fact (6–8 week BC timeline) | 0 | felony 2-yr wait; some org referrals |
| Utah | reachable, thin on the contested part | 0 | 2 (generic BC request form; sex-offender-registry certification) | 2 — DL gender path (live source: no mention at all); code citation `26-2-11` (pre-2023 recodification; current cite is `26B-8-111`) | 0 | the entire clear-and-convincing-evidence / 6-month / GAL statutory standard |
| Vermont | reachable, **stale on the key fact** | 1 (name-change statute) | 2 (generic DL/replacement application forms) | 1 — **major**: A4TE describes a physician-affidavit/surgical-treatment requirement; current VT form is pure self-attestation, no physician involved | 0 | none of note |
| Virginia | reachable, current | 0 | 0 | 1 — certified-copy fee: A4TE says $12, live source says $15 | 0 | DL replacement-fee structure |
| Washington | reachable, most current of the 11 | 0 | 1 (DOL "Change of Gender Designation" form, in 3 languages) | 0 confirmed — A4TE already reflects the corrected venue rule and PO Box; does not state the 10mo→2mo timeline fact either way | 0 | none of note |
| West Virginia | reachable, thin | 0 | 0 | 1 — A4TE says a court order is required for the BC gender marker; live source says physician form only, no court order | 0 | how an amended certificate is physically annotated (unconfirmed either way) |
| Wisconsin | reachable, thin | 1 (Wis. Stat. §985.07) | 0 | 1 — A4TE requires a notarized doctor's SRS letter; live source lists only a court order + $20 fee | 0 | per-copy fee breakdown |
| Wyoming | reachable, thin, **most contradicted** | 1 (name-change statute) | 1 (Gender Designation Change Request Form — cites our exact source URL, which doesn't support it) | 2 — **major**: DL gender-marker form/process not on the cited page at all; BC fee $16 (A4TE) vs. $55 (live source) | 0 | none of note |

**Totals: 11/11 A4TE pages reachable. ~11 new official sources pointed to. ~11 forms named that aren't in `forms/registry.json`. 11 fact disagreements identified, of which 8 were resolved against a live primary-source fetch, 1 (Vermont) resolved against a live primary document even though the statute itself couldn't be loaded, and 2 (South Dakota's driver's-license page, Tennessee's DPS rule) could not be resolved because the source was technically unreachable by this project's tools.**

---

## South Carolina

A4TE: <https://transequality.org/documents/south-carolina-identity-documents>

**1. Sources A4TE points to that we don't cite.** A4TE cites S.C. Code Ann. §
63-3-530(9) and § 44-63-150 as the general statutory basis for birth-certificate
corrections; `sc.birth-certificate.name` and `.gender-marker` cite only the DPH
web page, not these statutes. A4TE also links the SC Family Court locator,
`sccourts.org/familyCourt/familyMap.cfm` — useful for anyone who gets to the "file a
petition" step and doesn't know which circuit to use.

**2. Forms.** A4TE names a "Notification of Change of Address or Name form," which
appears to be the same document our `sc.drivers-license.name` record already calls
Form 4057 by number — not a new form, just named differently.

**3. Disagreements.** A4TE describes a specific court-based process for changing the
**sex marker** on an SC birth certificate that `sc.birth-certificate.gender-marker`
does not: petition the Family Court for a "Petition for Change of Sex," submit a
notarized physician's affidavit in specific quoted language, pay a $150 money order to
the Family Court, then submit the resulting court order to Vital Records with a $12 fee
"made payable to **SC DHEC**."

I re-fetched `dph.sc.gov/public/vital-records/birth-certificates` live today. It confirms
our record's language verbatim — the $15 amendment fee, the $3 one-year replacement fee,
and "1–2 business days... up to 2 weeks for court-ordered amendments" all match exactly —
and it never mentions "sex," "gender," or a $12 fee anywhere. It also never says "DHEC":
South Carolina split its Department of Health and Environmental Control into the
Department of Public Health (DPH) and a separate environmental agency in 2024. A4TE's
sex-marker section still directs payment to the defunct "SC DHEC" — concrete, checkable
evidence that this specific part of A4TE's SC page predates the 2024 agency split and has
not been refreshed since. The underlying legal mechanism it describes (a court order can
amend "other changes" per the current page's general language) is still plausible, but
the $12/$150 figures and the DHEC addressee could not be confirmed as current. This is a
genuine, useful pointer for whoever re-verifies `sc.birth-certificate.gender-marker` —
it's the kind of concrete "go check this" our record's own cautious framing invites — but
it should not be copied in as-is given the stale agency name.

**4. Document types.** None beyond what we cover.

**5. A4TE gaps.** A4TE's SC page says nothing about the SLED fingerprint/background
check, the DSS Central Registry of Child Abuse and Neglect screening, the sex-offender
registry screening, or the domestic-violence residency waiver that `sc.court-order.name`
documents in detail. It also omits the REAL ID $25 nuance and the "one opportunity to
change your name at marriage" DMV rule.

## South Dakota

A4TE: <https://transequality.org/documents/south-dakota-identity-documents>

**1. Sources.** No new official sources — A4TE cites the same `doh.sd.gov` and
`ujs.sd.gov` pages and the same statute chapter (21-37) our corpus already cites.

**2. Forms.** A4TE names a generic "Application for Birth Record" — already implicit
in our `doh.sd.gov` citation, not a new find.

**3. Disagreements — both unresolved, and that's the finding.**

- A4TE: SD driver's-license gender-marker path exists via "(2a) a court order... or
  (2b) a signed affidavit from a licensed physician." Our `sd.drivers-license.gender-marker`
  record says the DPS page "did not return readable text to confirm whether one exists."
  I re-fetched the exact cited URL (`sd.gov/dps?id=cs_kb_article_view&sysparm_article=KB0043549`)
  today via both `curl` (declared user agent) and `WebFetch` — both return only a
  ServiceNow "Loading..." shell with zero article content. This independently confirms
  our record's own finding is still accurate today: **this page cannot be checked by this
  project's tools, one year after the fact was first recorded, and A4TE's claim can
  neither be confirmed nor refuted against it.** A4TE's information must come from
  somewhere else — a cached view, a different page, or direct contact with SD DPS — that
  this project cannot verify.
- A4TE: SD birth-certificate "Court Order" section covers "the legal name and/or
  gender of the applicant." Our `sd.birth-certificate.gender-marker` record says South
  Dakota's page describes no sex-designation route at all. I re-fetched
  `doh.sd.gov/licensing-and-records/vital-records/amendments-court-orders/` today
  (page states "Content last updated: January 9, 2025"). Its court-order section is
  captioned specifically **"Court-Ordered Name Change"**, and its three bullet
  requirements ("information to identify the certificate," "the incorrect data,"
  "the correct data") never mention sex or gender anywhere on the page. Our record's
  cautious framing is the better-supported reading of the current page — but the
  generic "incorrect data / correct data" language doesn't affirmatively rule a sex
  correction out either, so this is "our framing looks more current," not "confirmed
  closed."

**4. Document types.** None new.

**5. A4TE gaps.** A4TE never names the SD Unified Judicial System's specific Adult
Name Change packet (UJS-024 instructions, UJS-025 verified petition, UJS-026 notice of
hearing, UJS-027 order) that `sd.court-order.name` documents by number. It also omits
the six-month residency requirement our record states (sourced from the same
`ujs.sd.gov` self-help page) — A4TE's summary covers only the four-week newspaper
publication requirement.

## Tennessee

A4TE: <https://transequality.org/documents/tennessee-identity-documents>

**1. Sources.** A4TE cites Tenn. Code Ann. §§ 29-8-101 to 29-8-105 — the general,
statewide name-change statute. `tn.court-order.name` cites **only**
`shelbycountytn.gov`, a single county's own procedural page; the corpus has no
statewide statutory citation for Tennessee name changes at all. A4TE also cites TN
Department of Safety Rule 1340-1-13-.12(5)-(6), an administrative rule not cited
anywhere in our TN records.

**2. Forms.** No new forms named.

**3. Disagreements — unresolved.** A4TE says updating a TN license/ID's gender marker
requires "a statement from the attending physician... or a court order recognizing
gender change," under Rule 1340-1-13-.12(5)/(6). `tn.drivers-license.gender-marker`
says TN DOS's own "Helpful Information" page lists no such topic at all. I re-fetched
both TN DOS pages our record cites (`tn.gov/safety/driver-services/helpful-information.html`
and `.../dlnamechange.html`) live today — neither contains the word "gender" or "sex"
anywhere, which is at least consistent with our record. I then tried to check the
underlying administrative rule directly at Tennessee's Secretary of State rules
repository — **`sos.tn.gov` returned HTTP 403 to both a `curl` fetch with this
project's declared user agent and to `WebFetch`, on every URL tried.** I could not
determine whether Rule 1340-1-13-.12 still contains this provision, has been amended,
or has been superseded by Tennessee's 2023 statutory definition of sex (already in our
corpus as `tn.drivers-license.gender-marker.law`, which defines sex as fixed at birth
for the entire state code and explicitly includes "government-issued identification
documents"). **This is exactly the kind of contested, moving fact the task called out
for Tennessee, and I'm reporting it unresolved rather than guessing:** a human with
access to Tennessee's administrative rules (or a different fetch path than this
project's tools have) needs to settle whether that rule is still live.

**4. Document types.** None new.

**5. A4TE gaps.** A4TE gives no county-specific procedural detail anywhere (Shelby
County's in-person filing window, Thursday-hearing schedule, Zoom option, $166.50/$170
fees) — understandable for a 50-state guide, but a real gap next to
`tn.court-order.name`. A4TE also cites only the bare statute for the birth-certificate
sex-designation bar (§68-3-203(d)) and never mentions *Gore v. Lee*, the Sixth Circuit
case `tn.birth-certificate.gender-marker` centers its citation on.

## Texas

A4TE: <https://transequality.org/documents/texas-identity-documents> (states "Last
updated August 2025" — the most recently dated page of the 11, and it shows)

**1. Sources.** A4TE cites Executive Order 14168 (federal) as part of why TX DSHS
stopped gender-marker amendments — not cited in any TX corpus record. It also cites
Tex. Fam. Code §§ 45.001-45.107, the actual name-change statute — `tx.court-order.name`
cites only `texaslawhelp.org`, a legal-aid guide, never the statute. A4TE also names
the DPS fingerprint "Print and Go" FAST scheduling line (1-888-467-2080) and the
Central Cash Receiving mailing address (P.O. Box 15999, Austin, TX 78761-5999) for
submitting fingerprint cards — neither in our corpus.

**2. Forms.** A4TE names a full slate of Texas judicial-branch name-change forms not
in `forms/registry.json` (which has only `tx-vs-170` for Texas, a birth-certificate
form): Civil Case Information Sheet, Petition to Change the Name of an Adult,
Fingerprint Card, Order Changing the Name of an Adult, and their minor-specific
equivalents (Petition to Change the Name of a Child, Child's Consent to Name Change,
Information on Suit Affecting the Family Relationship, Order Changing the Name of a
Child, Certificate of Last Known Mailing Address), plus the fee-waiver forms
(Declaration of Indigency / Statement of Inability to Afford Payment of Court Costs).

**3. Disagreements.** None found — Texas is the best-aligned state in this batch. Both
sources cite HB 229, AG Opinion KP-0489, and the August 2024 DPS gender-marker freeze
consistently, and the $15/$22 birth-certificate fees match exactly. A4TE adds two
specific facts our corpus doesn't have and that I did not independently re-verify in
this pass: a 6–8 week birth-certificate amendment processing time, and a felony
conviction 2-year post-discharge waiting period before a name-change petition. Neither
contradicts anything in our records — they're additions, not corrections — but they
should be confirmed against `dshs.texas.gov` and `texaslawhelp.org` directly before
being added.

**4. Document types.** None new (A4TE separately links its own federal-level Social
Security and Passport guidance from the TX page, out of scope for a state-level
cross-check).

**5. A4TE gaps.** None of substance — if anything, A4TE's TX page is more detailed
than our corpus in places (the step-by-step minor process, contested-hearing service
rules), which is worth a look for anyone doing a follow-up content pass, but that's a
"we could learn from their structure" note, not a gap in what we cite.

## Utah

A4TE: <https://transequality.org/documents/utah-identity-documents>

**1. Sources.** None new — same `utcourts.gov`/`dld.utah.gov` pages cited.

**2. Forms.** A4TE names a generic "birth certificate request form" (the copy-request
form, distinct from the court-order amendment form already registered as
`ut-vitalrecords-902-amendment-court-order`) and a "Certification Regarding Sex
Offender Registry" attachment for the court petition — neither is in
`forms/registry.json`.

**3. Disagreements.**

- A4TE: UT driver's-license/ID gender-marker update requires "(2) a passport or birth
  certificate bearing the new gender" — a document-swap, no court order. Our
  `ut.drivers-license.gender-marker` record: the DLD's own required-documents page
  "makes no mention of a sex or gender designation... or of any process for changing
  one." I re-fetched `dld.utah.gov/required-documents/` via `WebFetch` today and
  confirmed: "no mention of changing sex or gender designation... does not address
  gender or sex designation changes." This corroborates our record; A4TE's document-swap
  path isn't evidenced on the current official page.
- A4TE cites "UT Code Ann. § 26-2-11" for the birth-certificate court-order amendment
  authority. Our `ut.birth-certificate.gender-marker.law` record cites "Utah Code
  26B-8-111" — the current, far more detailed and restrictive standard (clear-and-
  convincing evidence, six months living as the sex sought, clinically significant
  distress, guardian ad litem for minors 15.5+). Utah recodified its health code from
  Title 26 into a new Title 26B effective 2023, which is why the numbering differs; a
  citation to the old "26-2-11" is a concrete signal A4TE's Utah page predates that
  recodification. I attempted to load live statutory text for both citations at
  `le.utah.gov` — it is a JavaScript application that returns only navigation chrome to
  a plain fetch (confirmed via both `curl` and `WebFetch`), so I could not quote either
  section's current text directly. The citation mismatch itself, combined with the
  well-documented 2023 recodification, is the checkable signal here.

**4. Document types.** None new.

**5. A4TE gaps — the largest of the batch.** A4TE's entire Utah gender-marker
description is silent on the contested statutory standard `ut.court-order.gender-marker`
and `ut.birth-certificate.gender-marker.law` document in detail: the
clear-and-convincing-evidence finding, the six-month living-as-the-sex-sought
requirement, the clinically-significant-distress finding, the sealed-case privacy rule,
and the guardian-ad-litem/no-petitions-under-15.5 rules for minors. A4TE presents this
as a comparatively simple document-based or court-order process without any of that —
for a state the task specifically flagged as contested, this is the biggest
thinness gap found in this whole group.

## Vermont

A4TE: <https://transequality.org/documents/vermont-identity-documents>

**1. Sources.** A4TE cites Vt. Stat. Ann. tit. 15, §§ 811-817 for the name-change
statute — not in `vt.court-order.name`, which cites only `vtcourts.gov`.

**2. Forms.** A4TE names VT DMV's generic "Driver's License Application" and
"Replacement License Application" (for selecting a gender marker) — distinct from Form
VL-021 already implicit in `vt.drivers-license.name`; neither is in
`forms/registry.json` (which has only the two VT birth-certificate forms).

**3. Disagreement — the single biggest finding in this entire batch.** A4TE's
Vermont birth-certificate section describes "an affidavit by a licensed physician who
has treated or evaluated the individual stating that the individual has undergone
surgical, hormonal, or other treatment appropriate for... gender transition... [including]
the medical license number and signature of the physician," citing 18 V.S.A. § 5112.
Our `vt.birth-certificate.gender-marker` record describes Vermont's actual current
**Affidavit of Gender Identity** — a self-attestation the applicant signs before a
notary — and explicitly notes it "does not ask for a court order or a medical or
physician's statement," sourced directly from the current `healthvermont.gov` PDF our
record quotes.

These are two incompatible legal regimes: a medical/physician-gatekept model (A4TE) and
a pure self-attestation model (our record). A reader who trusted A4TE's Vermont page
would believe they need a doctor's affidavit that Vermont's actual current process does
not require — the highest-stakes single disagreement found across all 11 states, because
it could talk someone out of using a process that's actually easier than they think, or
send them chasing a physician's signature the state doesn't ask for.

I tried to load the current text of 18 V.S.A. § 5112 directly at the Vermont
Legislature's statute site to settle this conclusively; like Utah's, it is a
JavaScript search application that returns only navigation chrome to a plain fetch, so
I could not quote the current statute text. But our record's description is
independently corroborated by directly reading the live PDF of Vermont's own current
Affidavit of Gender Identity form — the same document our record already cites and
quotes — whose operative language is unambiguous and has no physician-certification
field. A4TE's Vermont page has no visible "last updated" date; recommend flagging this
specific section to A4TE directly, since self-attestation for VT birth certificates is
not a brand-new change.

**4. Document types.** None new.

**5. A4TE gaps.** None of note — the rest of Vermont's page (self-designated
descriptor model for DL/ID, 30-day DMV notification rule, $150 name-change fee with
waiver) matches our corpus closely.

## Virginia

A4TE: <https://transequality.org/documents/virginia-identity-documents> ("Last updated
November 2023")

**1. Sources.** None new — same `law.lis.virginia.gov`, `dmv.virginia.gov`, and
`vdh.virginia.gov` pages already cited.

**2. Forms.** None new — VS42 is already registered as `va-vs42`.

**3. Disagreement.** A4TE states the VDH certified-copy fee as "$12 for each
certified birth certificate requested." `va.birth-certificate.gender-marker` and
`va.birth-certificate.fees` both independently state $15 for the same certified copy. I
re-fetched `vdh.virginia.gov/vital-records/what-is-the-procedure-to-update-a-virginia-birth-certificate-after-a-person-has-undergone-gender-transition/`
live today: it states "$15 for each certified birth certificate requested." This
confirms our corpus figure is current and A4TE's $12 is stale — likely an older fee
schedule that predates a VDH fee increase, consistent with the page's own November
2023 "last updated" stamp.

**4. Document types.** None new.

**5. A4TE gaps.** A4TE doesn't mention the $20 replacement-license / $10 REAL ID
surcharge fee structure `va.drivers-license.fees` documents, nor the note in
`va.drivers-license.gender-marker` and `.gender-marker` that Virginia's gender-marker
policy "has shifted before with changes in administration" — useful context our record
carries that A4TE's page (last touched in 2023) doesn't.

## Washington

A4TE: <https://transequality.org/documents/washington-identity-documents> — by far the
most detailed and evidently the most actively maintained page of the 11.

**1. Sources.** None new — same `courts.wa.gov`, `dol.wa.gov`, `doh.wa.gov` pages. A4TE
additionally links several non-.gov legal-aid resources (Northwest Justice Project,
Q-Law Foundation of Washington, the Lincoln LGBTQ+ Legal Rights Clinic at Gonzaga,
Disability Rights Washington) that have no equivalent anywhere in this project's corpus
— out of scope for `corpus/referrals/*.json` per this task's boundaries, but worth
flagging to whoever owns that file.

**2. Forms.** A4TE explicitly names and links a WA DOL "Change of Gender Designation"
form (available in Spanish, Russian, and Vietnamese) as the specific document used at
driver-licensing offices. This is **not** in `forms/registry.json` — the registry has
only WA's two DOH birth-certificate forms (`wa-doh-422-126`, `wa-doh-422-143`); no WA
DOL driver's-license form is registered at all, even though `wa.drivers-license.gender-marker`'s
own statement text already describes "a Gender Designation Request form" by name.

**3. Disagreements — the task specifically asked about this pair, and both check out.**
I re-fetched both sources live today:

- `courts.wa.gov/forms/?fa=forms.static&staticID=13` currently reads: "Name change
  petitions may be filed in any district court in the state. But in some instances,
  name changes may be filed in Superior Court," with mailing address "P.O. Box 47814."
  This matches `wa.court-order.name`'s current (corrected) text exactly.
- `doh.wa.gov/.../court-ordered-name-change` currently reads: "We currently have a two
  (2) month processing turnaround time... If your request has not been processed after
  two (2) months, please call us." This matches `wa.birth-certificate.name`'s current
  (corrected) text exactly.
- **A4TE's Washington page already states "You can file in any county in Washington,
  it doesn't have to be where you live" and already lists the corrected "PO Box
  47814" address.** On the venue-rule and address change, A4TE was already current by
  the time this cross-check ran — it moved at least as fast as this project's own
  correction cycle. However, A4TE's page **never states a specific processing-time
  figure** for the court-ordered name-change route on a birth certificate at all (it
  only says the separate self-ID sex-designation route has "no fee to amend the
  record"). So A4TE can be credited with independently corroborating the *venue* and
  *address* corrections, but not the *timeline* one — it simply never made that claim
  either way, which is a meaningfully different thing from "getting it right."

**4. Document types.** None new.

**5. A4TE gaps.** None of substance — Washington is the closest match to our corpus of
the 11 states in this group.

## West Virginia

A4TE: <https://transequality.org/documents/west-virginia-identity-documents>

**1. Sources.** None new — same `courtswv.gov`, `transportation.wv.gov`, `dhhr.wv.gov`
pages. A4TE links its own "West Virginia Name and Gender Change Guide" (an A4TE
resource, not a primary source).

**2. Forms.** None new — DMV-99-RO, the HSC correction affidavit, and the HSC Sex
Designation Form are all already registered.

**3. Disagreement.** A4TE's WV birth-certificate section states a court order is
required for the gender-marker change: "West Virginia will amend[] the gender marker
on a birth certificate with a court order for gender change," and, to request the
update, "a court order for gender change from any state." Our
`wv.birth-certificate.gender-marker` record (and the already-registered forms)
describe an entirely different, non-judicial process: a physician completes the Sex
Designation Form with an affidavit — no court order at all. I re-fetched
`dhhr.wv.gov/HSC/VR/Pages/Correct-or-Amend-a-Certificate.aspx` live today: "To change
the sex designation on your birth certificate, please have your physician fill out the
Sex Designation Form and also provide the appropriate affidavit found above." No court
order is mentioned anywhere on the page for the sex-designation route (a court order is
required only for a **name** change). This confirms our corpus is accurate and current,
and that A4TE's WV birth-certificate description — requiring a court order for the
gender marker — is not supported by the live page and should be corrected on their end.

**4. Document types.** None new.

**5. A4TE gaps.** A4TE adds one procedural detail our corpus lacks and that I could
not independently confirm either way: how WV physically annotates an amended
certificate ("will not issue a new birth certificate, but will strike through the
existing name and gender and type the new information above... the abstract/short form
will indicate a change was made but will not show the previous name and gender"). The
current `dhhr.wv.gov` page I fetched doesn't address this either way — flagged as an
open pointer, not a confirmed fact, for whoever next touches this record.

## Wisconsin

A4TE: <https://transequality.org/documents/wisconsin-identity-documents>

**1. Sources.** A4TE cites Wis. Stat. Ann. § 985.07 (general newspaper-publication
procedure) alongside § 786.37, which our `wi.court-order.name` record already cites a
subsection of (786.37(4)) — § 985.07 itself is not in our corpus.

**2. Forms.** No new forms from A4TE (our own corpus text separately names MV3001/
MV3004 for `wi.drivers-license.gender-marker`, but A4TE doesn't mention either — that's
an internal registry gap, not something A4TE surfaced).

**3. Disagreement.** A4TE's WI birth-certificate section requires, beyond the court
order and fee, "a notarized letter from the doctor that performed SRS," framing the
whole process as being for a "surgical sex-change procedure" under Wis. Stat. §
69.15(4). Our `wi.birth-certificate.gender-marker` record explicitly checked for and
found no such requirement: "Wisconsin's page does not describe any option besides a
court order... for this specific change." I re-fetched
`dhs.wisconsin.gov/vitalrecords/amendments.htm` live today. Its "How to amend a birth
record following a sex change" section lists exactly two requirements: a certified
court order, and a $20 fee — no doctor's letter, no mention of "SRS" or surgery
anywhere. This confirms our record is accurate and current; A4TE's added doctor's-letter
requirement is not supported by the live page and appears to carry over older language
from the statute's historical wording rather than the agency's current documentary
checklist.

**4. Document types.** None new.

**5. A4TE gaps.** A4TE omits the certified-copy cost breakdown ($20 first copy, $3
each additional) that both `wi.birth-certificate.name` and `.gender-marker` document —
a completeness gap, not a legal-substance one.

## Wyoming

A4TE: <https://transequality.org/documents/wyoming-identity-documents>

**1. Sources.** A4TE cites Wyo. Stat. Ann. §§ 1-25-101 to 1-25-104 for the name-change
statute — not cited by `wy.court-order.name`, which cites only `wyocourts.gov`'s
plain-language page.

**2. Forms — and the biggest, cleanest contradiction in this whole batch.** A4TE
names a "Gender Designation Change Request Form" for WYDOT driver's-license/ID gender
changes, "signed by the applicant and a physician, therapist or counselor, psychiatric
social worker, or other medical or social service provider," and cites **the exact
same URL** our own corpus cites — `dot.state.wy.us/.../add_or_change_information.html`
— as WYDOT's page "address[ing] name and gender changes." This form is not in
`forms/registry.json`.

I re-fetched that exact URL live today. The page currently covers exactly three
topics — Address Change, Name Changes, and Organ Donor Status Changes — and contains
**no occurrence of "gender," "sex," or any designation-change form anywhere.** This
directly confirms `wy.drivers-license.gender-marker`'s own finding ("does not mention a
sex or gender designation, or any process for changing one") and directly contradicts
A4TE's claim, on the very page A4TE itself points to as its source. Either the page
changed materially since A4TE last reviewed it, or this entry has simply been wrong for
some time; this project's tools can't rule out that such a form exists elsewhere on
`wyo.gov` without a link from this particular page, but as sourced, A4TE's claim doesn't
hold up.

**3. Disagreement (fee).** A4TE states the Wyoming birth-certificate court-ordered
amendment fee as "$16.00... includ[ing] one certified copy." Our `wy.birth-certificate.name`
record states $55. I re-fetched `health.wyo.gov/admin/vitalstatistics/amending-a-vital-record/`
live today: "$55 fee (We do not accept third party checks)" for Court Ordered
Amendments — exactly matching our corpus and directly contradicting A4TE's $16 figure,
which is stale. A4TE also requires "a letter from a doctor, on letterhead, that gender
reassignment surgery has been completed" for a sex-designation change — the live page
never mentions sex/gender at all (consistent with `wy.birth-certificate.gender-marker`'s
own framing), so this specific documentary claim can't be corroborated either way from
the current official page.

**4. Document types.** None new.

**5. A4TE gaps.** None beyond the above — Wyoming's A4TE page is thin, and on both of
its central, checkable claims (the DL gender form and the BC fee), the live source
contradicts it.

---

## Notes on method and its limits

Several state government pages in this group are JavaScript applications that return
only navigation chrome — no article body — to a plain HTTP fetch, confirmed
independently via both `curl` (with this project's declared user agent) and `WebFetch`:
South Dakota's DPS knowledge-base article, and the Utah and Vermont legislature
code/statute search tools. This is the same class of problem `sd.drivers-license.gender-marker`
and `sd.drivers-license.name` already flag for their own source. Where this blocked a
disagreement from being resolved, this document says so explicitly rather than picking a
side. Tennessee's Secretary of State rules site (`sos.tn.gov`) returned HTTP 403 to
every fetch attempted, for reasons this project cannot determine from the outside
(bot-blocking, WAF, or a rate limit) — that disagreement (the TN DPS gender-marker rule)
is likewise reported unresolved.

## Next steps for a human

1. **Wyoming** — highest priority. Confirm directly with WYDOT whether a
   "Gender Designation Change Request Form" exists anywhere in their system; if not,
   consider notifying A4TE, since their page cites our exact source URL for a claim that
   URL doesn't support. Also confirm the WY birth-certificate fee is $55, not A4TE's $16.
2. **Vermont** — the highest-stakes single finding. A4TE's description of a
   physician-affidavit requirement for the birth-certificate gender marker looks
   significantly out of date next to Vermont's own current self-attestation form; worth
   flagging to A4TE directly.
3. **Utah** — the "26-2-11" vs. "26B-8-111" citation mismatch is a concrete signal
   A4TE's Utah page predates the 2023 Title 26B recodification; A4TE's page is also
   silent on the entire contested statutory standard (clear-and-convincing evidence,
   six-month rule, GAL for minors) that makes Utah's actual process far more involved
   than A4TE portrays.
4. **Tennessee** and **South Dakota's driver's-license page** — both have a
   disagreement this project's tools could not resolve (sos.tn.gov blocked at 403; SD's
   DPS page is an unreadable JS app on both sides of the comparison). Flagged, not
   guessed at.
5. **West Virginia and Wisconsin** — both have a live-source-confirmed case of A4TE
   requiring more (a court order; a doctor's SRS letter) than the current official page
   actually asks for. Worth a note back to A4TE.
6. **South Carolina** — the "SC DHEC" reference is a clean, checkable staleness signal
   (the agency was renamed/split in 2024); the underlying sex-marker court process A4TE
   describes may still be substantively usable, but the specific fee and payee are not
   confirmed current.
7. Add the forms A4TE surfaced to `forms/registry.json` where a human confirms they're
   current: WA's DOL Change of Gender Designation form; Texas's slate of judicial-branch
   name-change forms (Civil Case Information Sheet, Petition to Change the Name of an
   Adult/Child, Fingerprint Card, Order Changing the Name of an Adult/Child, and the
   fee-waiver forms); South Dakota's UJS-024–027 packet (already named in our own corpus
   text, just never registered); Utah's generic birth-certificate request form and
   sex-offender-registry certification; Vermont's DMV Driver's License/Replacement
   License applications.
8. Add the statutory citations A4TE surfaced that our records currently lack, where a
   human confirms the citation is current: SC §§63-3-530(9), 44-63-150; TN §§29-8-101
   to -105; TX Fam. Code §§45.001-45.107 and Executive Order 14168; VT tit. 15
   §§811-817; WY §§1-25-101 to -104; WI §985.07.
9. Consider a referral-type entry (outside this task's scope to create) for the
   regional legal-aid organizations A4TE's Washington page links that this project's
   corpus has no equivalent for (Northwest Justice Project, Q-Law Foundation of
   Washington, the Lincoln LGBTQ+ Legal Rights Clinic, Disability Rights Washington).

This document does not change, confirm, or reject any record's `verification_status`.
Every fact above still needs the same human re-verification step this project's normal
process requires before a corpus record is edited — this is the map to where that
re-verification should start, not a substitute for it.
