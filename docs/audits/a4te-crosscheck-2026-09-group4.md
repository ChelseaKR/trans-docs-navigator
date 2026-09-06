# A4TE Cross-Check — New Jersey to Rhode Island — 2026-09-05

> Read-only, index-driven review. **This is not a verification pass and no corpus,
> forms, test, source, or API file was edited to produce it.** Advocates for Trans
> Equality (A4TE, formerly NCTE) maintains human-curated state guides at
> `transequality.org/documents/<state>-identity-documents`. Their pages are used here
> strictly **as a map** — which official agencies, pages, and forms matter, and which
> facts they assert — never as a source of prose or of truth. No A4TE text is quoted
> beyond a form id or a number; every claim below was checked, where the effort budget
> allowed, against the actual `.gov` page it depends on. Where it didn't resolve, that
> is stated plainly rather than guessed at.

## Headline

Across the ten jurisdictions in this group, A4TE's own page quality is **not uniform**,
and that unevenness is itself the most useful finding here. Four states — North Dakota,
Oklahoma, Oregon, and Rhode Island — carry an "Overview" block, citations, and an
explicit **"Last updated January 2026"** stamp; their content is detailed, mostly
correct where checked against primary sources, and in Oregon's case unusually close to
our own record. The other six — New Jersey, New Mexico, New York, North Carolina, Ohio,
and Pennsylvania — are older-format pages with no visible update date, and two of them
are **confirmed stale in ways that matter**:

- **North Carolina**: A4TE says a name-change petition still requires ten days of
  courthouse-door publication and an affidavit of good character from two county
  citizens. Both requirements are gone. G.S. 101-2(b) (the publication subsection) was
  **repealed by Session Laws 2025-54, effective December 1, 2025**, and the
  "two-citizen" affidavit does not appear anywhere in the current G.S. 101-5 (fetched
  directly for this review). Our own `nc.court-order.name` record already states the
  publication repeal correctly and matches the current G.S. 101-5 requirements
  word-for-requirement. A4TE's page is behind the law here, not us.
- **Ohio**: A4TE describes a working driver's-license gender-marker process — a
  "Declaration of Gender Change" form (`bmv2369.pdf`) signed by a physician or other
  listed provider, mailed to BMV License Control, 7–10 day turnaround — and a
  no-restriction probate-court path to a corrected birth certificate. The form PDF
  **404s** (confirmed by direct fetch this session), Ohio BMV's current forms page
  (also fetched directly) lists no such form, and A4TE's page never mentions **Ohio
  Revised Code 9.05** (effective September 30, 2025, declaring sex "not changeable" for
  state records) or the Ohio Supreme Court's November 2024 non-ruling in the birth
  certificate case — both of which our corpus already covers in detail. A4TE's Ohio
  page appears to predate both developments entirely.

No other jurisdiction in this batch showed a confirmed factual reversal this stark.
North Dakota, Oklahoma, and New York surfaced real, useful pointers — mostly primary
sources and forms we don't yet cite — plus a small number of dollar-figure claims
(filing fees on court petitions) that this review could not run to ground within its
effort budget; those are named explicitly below rather than left silent.

**Tally across the ten jurisdictions:** 16 official sources A4TE points to that our
records don't cite, 10 forms A4TE names that `forms/registry.json` lacks, and 11 factual
points flagged for a human to check further (of which 4 — the two Ohio items and two
North Carolina items above — this review was able to resolve outright in the corpus's
favor; the rest remain open).

## Scope and method

- Fetched all ten A4TE pages with `curl -A "trans-docs-navigator-source-watch/1.0"` on
  2026-09-05; every one returned HTTP 200. Anchor text and `href` targets were extracted
  from each page's `<main>` region so that every "here" link could be resolved to an
  actual URL, not just read as prose.
- Compared each page's named agencies, forms, and facts against the matching
  `corpus/jurisdictions/<state>.json` record(s) (read in full for all ten states,
  including the `.es` twin structure in `spanish.json` is unaffected by this review — no
  language-specific claims are made here) and against `forms/registry.json` filtered to
  each state's `jurisdiction` code.
- Where a disagreement surfaced, the primary `.gov` (or `.courts.gov`) page was fetched
  directly with the same declared user-agent — not A4TE's description of it — and read.
  That includes two NC statute pages fetched in full, the ND DOT gender-designation PDF,
  the Oregon name/sex-change packet PDF, Ohio BMV's forms page and the linked (now-dead)
  gender-change form, the NC DL-300 PDF, and the NY DMV photo-documents page. Every
  fetch's HTTP status is reported inline where it matters (a 404 is evidence, not noise).
- Two known blind spots carried over unchanged from `docs/OPERATIONS.md`:
  `nycourts.gov` and `health.ny.gov` return HTTP 403 to this project's declared
  user-agent (confirmed again this session) and to `curl` under the same UA. We do not
  spoof a browser UA to get past that. This is exactly the situation the task called out
  New York for: A4TE's page — reachable, and current-looking — is the best available
  pointer to what those blocked pages likely say, but it is a pointer, not a
  replacement, and its claims that go beyond what an *un*blocked NY source (like
  `dmv.ny.gov`) actually states are marked as unconfirmed below, not adopted.
- Effort was not spent chasing every dollar figure to its ultimate ground truth. Where a
  fee lives several pages deep behind a general "Court Fees" schedule (North Dakota,
  Oregon) rather than on the page our record already cites, that is named as an open
  item for the follow-up wave rather than guessed at or left unmentioned.
- No file under `corpus/`, `forms/`, `tests/`, `src/`, or `api/` was modified.
  `corpus/referrals/*.json` was read only far enough to confirm this repo already treats
  A4TE as a referral resource, not a source of facts — consistent with this review's
  own ground rule.

## Summary table

| Jurisdiction | A4TE page vintage | Sources not cited | Forms missing from registry | Facts flagged for review | Doc-type gaps | A4TE gaps (we cover, they don't) |
|---|---|---|---|---|---|---|
| New Jersey | Old-format, no date stamp | 2 | 2 | 0 | — | Court/MVC/Treasury fee & timing detail |
| New Mexico | Old-format, no date stamp | 0 | 0 | 0 | — | All dollar figures |
| New York | Old-format, no date stamp | 5 | 3 | 1 (open) | NYC Municipal ID (IDNYC); state/NYC benefits card | — (A4TE is richer here than our corpus) |
| North Carolina | Old-format, no date stamp | 1 | 1 (needs reconciliation) | 3 (2 resolved — A4TE stale; 1 open) | — | 2025–2026 law changes (GS 12-3.3, amended GS 130A-118) entirely absent from A4TE |
| North Dakota | **New format, "Last updated January 2026"** | 2 | 1 confirmed live | 1 (open — filing fee) | — | Statutory exceptions detail in `nd.birth-certificate.gender-marker.law` |
| Ohio | Old-format, no date stamp | 0 | 0 (named form is dead) | 2 (both resolved — A4TE stale) | — | ORC 9.05 and the Ohio Supreme Court case are missing entirely from A4TE |
| Oklahoma | **New format, "Last updated January 2026"** | 1 (EO 2023-20, URL not pinned) | 1 confirmed live | 1 (open — fee breakdown) | — | Specific statutory text (63 O.S. §1-321) banning X/nonbinary |
| Oregon | **New format, "Last updated January 2026"** | 2 | 0 | 1 (open — filing fee) | — | — (strongest agreement of the ten) |
| Pennsylvania | Old-format, no date stamp | 1 (archival policy PDF, A4TE-hosted) | 0 | 0 | — | — (second-strongest agreement) |
| Rhode Island | **New format, "Last updated January 2026"** | 2 | 2 confirmed live | 1 (open — in-person requirement) | — | $18 duplicate / $7 expedite fee detail |
| **Total** | | **16** | **10** | **11** (4 resolved) | **2 states** | |

## New Jersey

**Sources A4TE points to that we don't cite**
- `njleg.state.nj.us/2018/Bills/A2000/1718_R2.PDF` — the actual Babs Siperstein Law bill
  text. Our `nj.birth-certificate.gender-marker` record cites NJ DOH's page describing
  the law's effect, not the enacted bill itself.
- `nj.gov/health/forms/reg-15.pdf` — "Application to Amend a NJ Vital Record," the
  general-purpose amendment application A4TE lists alongside REG-L2 for a birth
  certificate name change. Our `nj.birth-certificate.name` record doesn't name a form at
  all.

**Forms A4TE names that `forms/registry.json` lacks**
- MVC's "Declaration of Gender Designation Change" form —
  `nj.gov/mvc/pdf/license/genderchange.pdf` (confirmed live, HTTP 200) — is the actual
  form behind `nj.drivers-license.gender-marker`, which today has no `form_ref`.
- REG-15 (above), for `nj.birth-certificate.name`.

**Facts checked:** none in disagreement. A4TE's `info.nj.gov` link now 301-redirects to
`nj.gov/transgender/name-changes/index.shtml` (confirmed live) rather than 404ing — a
domain migration, not drift, and not the specific page our record cites.

**A4TE gaps:** A4TE's NJ page states no dollar figures at all. Our record has the $250
court fee, the $25 certified-copy fee, the $50/45-day Department of Treasury filing, and
the two-week MVC deadline — none of which A4TE mentions.

## New Mexico

**Sources / Forms:** No gap in either direction. A4TE names exactly the same two forms
our registry already has (`nm-mvd-10237-gender-designation` and
`nm-health-gender-designation-adult-form`), and cites the same underlying statutes
(NMSA §§40-8-1 to 40-8-3 for name change; the 2019 gender-designation law). A4TE also
links its own third-party "Name and Gender Change Guide" (co-authored with a New Mexico
legal aid group), which is a good user-facing pointer but not a primary source in its
own right, so it isn't counted as a citable gap.

**Facts:** no disagreement found.

**A4TE gaps:** A4TE's NM page states no dollar figures anywhere. Our record has the
$132 court filing fee, $1.50 certified-copy fee, $25 recording fee, and the $20 birth
certificate fee — all absent from A4TE.

## New York

This is the jurisdiction the task flagged as mattering most for A4TE's pointers, since
`nycourts.gov` and `health.ny.gov` 403 our fetcher (reconfirmed this session). A4TE's
page is old-format (no date stamp) but unusually rich — richer, in fact, than our own
five-record corpus for this state.

**Sources A4TE points to that we don't cite**
- `nyc.gov/site/idnyc/about/about.page` — NYC's municipal ID card (IDNYC) program.
- `nyc.gov/assets/doh/downloads/pdf/notice/2018/noa-amend-article207-section207-05.pdf`
  — NYC Health Code amendment authorizing self-attested gender-marker changes on NYC
  (not NYS) birth certificates.
- `nyc.gov/assets/doh/downloads/pdf/vr/gender-marker-change-application.pdf` — the NYC
  DOHMH application form itself.
- `a069-access.nyc.gov/accesshra` — the ACCESS HRA portal for correcting a name on a
  SNAP/Cash Assistance benefits card.
- `portal.311.nyc.gov/article/?kanumber=KA-02340` — NYC 311's benefits-card name-update
  guidance.

**Forms A4TE names that `forms/registry.json` lacks**
- `dmv.ny.gov/forms/mv44.pdf` (MV-44) and `dmv.ny.gov/forms/mv44nc.pdf` (MV-44NC) — our
  own `ny.drivers-license.name` and `.gender-marker` records already *name* MV-44 in
  prose, but neither form is a registered entry.
- The NYC gender-marker application PDF above.

One data-quality note on A4TE itself: its "MV-44 form" link actually points to
`dmv.ny.gov/forms/id44.pdf`, which — confirmed by fetching and reading it — is "How to
Apply for a New York Learner Permit, Driver License, or Non-Driver ID" (the ID-44
requirements guide), not the MV-44 application. The real MV-44 lives at
`dmv.ny.gov/forms/mv44.pdf`, confirmed by reading the DMV page's own HTML. This is a
mislabeled link on A4TE's side, not a fact worth adopting either way — but it means
their link, taken at face value, would send a reader to the wrong PDF.

**Facts flagged (open):** A4TE states the DMV gender-marker change is by self-attestation
with M/F/X all available and no medical documentation or court order required. The
`dmv.ny.gov/driver-license/change-information-on-dmv-photo-documents` page — fetched
directly this session — confirms the mechanism (online, or MV-44 in person) but is
**silent on which designations are offered and on documentation requirements**, exactly
as our own `ny.drivers-license.gender-marker` record already says (it's flagged
`needs_reverification` for precisely this reason). A4TE's added specificity could not be
confirmed from a primary source in this session. Our record's cautious stance is the one
currently supported by what the primary page actually says; A4TE's fuller claim is
plausible but unverified.

**Document types A4TE covers that we don't:** NYC's Municipal ID card (IDNYC), and the
state/NYC benefits card (SNAP/Cash Assistance) name-correction process via ACCESS HRA.
Neither maps cleanly onto our six document types; both are real gaps for a New York
reader who doesn't hold a driver's license.

**A4TE gaps:** none found — for New York specifically, A4TE's page is the more complete
resource.

## North Carolina

**Sources A4TE points to that we don't cite:**
`vitalrecords.nc.gov/documents/ApplicationStandardVRFillableBirth122818.pdf` — "Application
for a Copy of a Birth Certificate," used per A4TE by checking a "Record Changes: Other =
Gender Change" box. This is a different document than `nc-dhhs-1578` (Birth Certificate
Modification Application), which our registry already cites and which the NC birth
records office's own site foregrounds today. It's unclear from this review alone whether
the older form A4TE describes is a superseded parallel path or simply an outdated
pointer — **flagged for reconciliation, not a clean add.**

**Facts — confirmed by direct statute fetch (`ncleg.gov` GS 101-2 and GS 101-5, read in
full this session):**
1. A4TE says publishing notice at the courthouse door for ten days is required before
   filing. **G.S. 101-2(b) — the publication subsection — was repealed by Session Laws
   2025-54, s. 4(a), effective December 1, 2025**, and the statute page states this
   explicitly. Our `nc.court-order.name` record already states the repeal correctly.
   **A4TE is stale here; no corpus change needed.**
2. A4TE says the applicant must submit "proof of good character" attested to by two
   county citizens. The current G.S. 101-5 — read in full — lists the actual current
   requirements (true name, county/date of birth, parents' names, a state/national
   criminal history check via SBI/FBI/an approved Channeler within 90 days, and a sworn
   residency/tax/child-support statement) and **contains no citizen-affidavit
   requirement at all**. Our `nc.court-order.name.requirements` record matches the
   current statute exactly. **A4TE is stale here too; no corpus change needed.**
3. Open: A4TE describes NC's birth-certificate gender-marker path as available *only*
   via sex-reassignment surgery plus a physician's notarized letter — quoting G.S.
   130A-118's surgery clause directly. Our `nc.birth-certificate.gender-marker` record,
   citing the current DHHS-1578 form (fetched 2026-09-05, already flagged
   `needs_reverification` in the corpus for unrelated reasons — the new GS 12-3.3 law),
   describes a broader menu of documentary options (a passport/license already showing
   the requested sex, a professional's gender-identity certification, or a birth
   attendant's statement) in addition to the surgery path. A4TE's page also never
   mentions NC's brand-new GS 12-3.3 (effective January 1, 2026) or the amended GS
   130A-118 multi-page-certificate-preservation rule (effective December 1, 2025) that
   our corpus already covers. This one is **not resolved** — it needs a human to read
   NC Vital Records' own current page (not just the form PDF, which is unchanged since
   2022) alongside both statutes.

**A4TE gaps:** the entirety of NC's 2025–2026 legal shift (GS 12-3.3's state-agency sex
definitions; the amended GS 130A-118 recordkeeping rule) is absent from A4TE's page,
which reads as though nothing has changed since NC's earlier (2019-era) law.

## North Dakota

The strongest, most current A4TE page in this batch (explicit "Last updated January
2026" stamp, an "Overview" section, and a citations list).

**Sources A4TE points to that we don't cite:** the fee-waiver instructions page
(`ndcourts.gov/legal-self-help/fee-waiver`) and the federal background-check portal
(`edo.cjis.gov`) that ND's own courts point defendants to. Our `nd.court-order.name`
record mentions neither.

**Forms A4TE names that `forms/registry.json` lacks:**
- **`dot.nd.gov/forms/sfn61146.pdf` — Gender Designation Form (SFN 61146, revision
  4-2026)** — fetched and read directly this session. It is real, current, and requires
  a licensed physician, physician assistant, advanced practice nurse, psychologist, or
  psychiatrist to certify that "a gender role transition has been completed and is
  permanent"; only Male/Female are offered, no X. This is exactly the specific form and
  requirement our own `nd.drivers-license.gender-marker` record says it could not find
  ("the page never says what that documentation is, names no specific form") — a
  characterization confirmed still accurate of the *specific page cited*
  (`dot.nd.gov/driver/driver-license`, refetched and grepped this session: it alludes to
  "gender change" documentation in one FAQ line but never names or links SFN 61146).
  A4TE found the form elsewhere on the same site. **This form should be added to the
  registry and the corpus record's uncertainty resolved**, but that is a fix for the
  follow-up wave, not this review.
- `hhs.nd.gov/.../SFN%208140.pdf` ("Birth Request Form") — a general vital-record
  request form A4TE lists alongside the SFN 60183 amendment application already in the
  registry; likely a companion form rather than a replacement.

**Facts flagged (open):** A4TE states the adult name-change filing fee is $160.00 and
certified copies of the order are $10 first / $5 each additional. Our
`nd.court-order.name` record explicitly states the cited page lists no filing fee. The
$160 figure appears to come from ND courts' separate statewide fee schedule, which
neither our record nor A4TE's own linked "Petition for Name Change" PDF states directly
— I could not locate and confirm that fee schedule's current, live text within this
review's effort budget. **Open for the follow-up wave.**

**A4TE gaps:** our own `nd.birth-certificate.gender-marker.law` record quotes ND Century
Code 23-02.1-25.1's three narrow exceptions (scrivener's error; chromosomal/genetic
testing; a specific surgical/certification clause) in more legal detail than A4TE's
one-line Overview summary ("no longer making amendments... unless genetic testing shows
an error").

## Ohio

**Sources / Forms:** A4TE's only DL-gender-marker pointer
(`publicsafety.ohio.gov/links/bmv2369.pdf`) returns **HTTP 404**, confirmed by direct
fetch this session — it cannot be added to the registry because it no longer exists.
Ohio BMV's current forms page (`bmv.ohio.gov/doc-forms.aspx`, also fetched directly) was
grepped for any gender/sex-related form and found none, matching what our
`oh.drivers-license.gender-marker` record already states.

**Facts — both resolved in the corpus's favor:**
1. A4TE describes a working gender-marker-change process for Ohio driver's licenses: a
   "Declaration of Gender Change" form signed by a physician or other listed
   professional, mailed to BMV License Control, approved in 7–10 days. That process no
   longer exists — the form 404s, and it is not listed on BMV's current forms page.
   A4TE's page never mentions **Ohio Revised Code 9.05** (effective September 30, 2025,
   declaring the state's two recognized sexes "not changeable"), which our
   `oh.drivers-license.gender-marker.law` record already covers. A4TE's Ohio content
   predates this law and was not updated when it took effect.
2. A4TE describes an unrestricted probate-court path to a corrected birth certificate
   sex marker, with the corrected order forwarded "automatically" and no mention of any
   legal uncertainty. Our `oh.birth-certificate.gender-marker` and
   `.gender-marker.law` records cover a materially different reality: Ohio courts are
   currently split on whether a probate court has the authority to grant this at all,
   and the Ohio Supreme Court's November 2024 decision left that question unresolved
   (no majority reached). A4TE's page does not mention this case, this split, or Ray v.
   McCloud anywhere.

**A4TE gaps:** the entire ORC 9.05 / Ohio Supreme Court thread — arguably the single
most legally significant Ohio development for this corpus's subject matter — has no
counterpart on A4TE's page at all.

## Oklahoma

A "Last updated January 2026" page, and largely in agreement with our corpus's own
(correctly bleak) picture of Oklahoma's current restrictions.

**Sources A4TE points to that we don't cite:** A4TE attributes Oklahoma DPS's
driver's-license gender-marker freeze to **Governor Stitt's Executive Order 2023-20**.
Our `ok.drivers-license.gender-marker` record only observes that Service Oklahoma's
services list doesn't include a gender-marker change — it doesn't cite the EO as the
underlying authority. I was not able to locate and confirm a stable `oklahoma.gov` URL
for the executive order itself within this session (a direct guess 404'd); **finding
and citing it directly would strengthen the record**, but that is follow-up work.

**Forms A4TE names that `forms/registry.json` lacks:** Oklahoma's own Vital Records
"Birth Certificate Request Form"
(`oklahoma.gov/.../18008vr-vr-birth-application-eng-eform.pdf`) is a real, current,
official PDF that OK's registry entry is currently missing (OK has zero forms
registered today).

**Facts flagged (open):** A4TE states the birth-certificate name-change amendment fee is
a flat $40.00 (including one certified copy). Our `ok.birth-certificate.name` record
describes what reads as two separate fee tracks on the OSDH page — a $15
application + $25 amendment fee for the "minor correction" route, with the
District-Court legal-name-change route's own fee left unstated — and $15 + $25 = $40
suggests these might be the *same* fee construed as two line items rather than two
different tracks. This review did not have time to re-fetch and closely re-parse
`oklahoma.gov/health/services/birth-and-death-certificates/amendments.html` carefully
enough to settle which reading is right. **Open for the follow-up wave** — likely a
quick fix once someone reads that page slowly.

**A4TE gaps:** our `ok.birth-certificate.gender-marker` record cites the operative
statute directly — **63 O.S. § 1-321**, which states a birth certificate amended under
it "cannot be amended to display gender identity, a nonbinary designation, or the letter
'X'" — while A4TE only cites HB1688 and frames the policy as an agency choice ("no
longer issuing"). Our citation is the more durable, specific legal ground.

## Oregon

The strongest agreement of any jurisdiction in this batch. A "Last updated January 2026"
page whose Overview, forms, and fee detail line up closely with our own five records.

**Sources A4TE points to that we don't cite:** the Oregon Judicial Department's general
"Court Fees" page tree (`courts.oregon.gov/Pages/fees.aspx` → Circuit Court Fees) that
apparently backs A4TE's stated filing fee, and the `oregon.public.law` statute/rule
mirrors A4TE cites directly (ORS 432.235, ORS 33.410/33.460, OAR 333-011-0265 and
0271–0275) as its legal authority — our OR records are procedural (courts.oregon.gov,
oregon.gov/oha pages) rather than statute-grounded.

**Facts flagged (open):** A4TE states the circuit-court filing fee for a name and/or sex
change petition is $124.00. Our `or.court-order.name-and-sex` record states the cited
page lists no filing fee. Like North Dakota, this number lives on a separate general fee
schedule several links deep (`courts.oregon.gov/Pages/fees.aspx` → "Circuit Court Fees")
that I fetched but could not resolve to a specific current dollar figure within this
review's effort budget. **Open for the follow-up wave.**

**A4TE gaps:** none of substance found. The $35 birth-certificate amendment fee and
$25–$30 certificate fee match exactly; the self-attestation, no-medical-documentation
description for both the DL and birth-certificate gender-marker paths match exactly.

## Pennsylvania

**Sources A4TE points to that we don't cite:** `transequality.org/sites/default/files/docs/PA-BC-Policy.pdf`
— A4TE's own archived copy of "Pennsylvania Department of Health policy" dated August 8,
2016. This doesn't appear to have a live, independently-hosted `pa.gov` counterpart any
more; our `pa.birth-certificate.gender-marker` record instead cites the operative
"Request to Modify an Adult's Birth Record" form PDF, which states the same
physician-letter requirement operationally. Worth a note, not necessarily a citation to
add, since A4TE's copy may be the only surviving copy of the original policy memo.

**Forms / Facts:** no gap or disagreement found. A4TE names the same DL-32 (gender, with
identical M/F/X-non-binary framing) and the same Adult's Birth Record modification form
and $20 fee our registry and corpus already have.

**A4TE gaps:** none of substance — the second-strongest agreement in this batch, after
Oregon.

## Rhode Island

Another "Last updated January 2026" page.

**Sources A4TE points to that we don't cite:**
`health.ri.gov/vital-records/changes-birth-death-or-marriage-records` and its linked PDF
(`RI-Vital-Records-Correction-and-Amendment-Requirements.pdf`) — RIDOH's own
plain-language procedural guidance. Our `ri.birth-certificate.name` and
`.gender-marker` records cite only the underlying regulation text
(`rules.sos.ri.gov` 216-RICR-10-10-1), not RIDOH's own how-to page, which appears to be
where A4TE's added procedural detail below actually comes from.

**Forms A4TE names that `forms/registry.json` lacks:** both of RI's DMV forms —
`dmv.ri.gov/media/391/download` (License/ID/Permit Application, i.e. LI-1) and
`dmv.ri.gov/media/41/download` (Gender Designation for License/Identification Card).
RI currently has zero forms registered despite both our corpus and A4TE naming these two
by function.

**Facts flagged (open):** A4TE states that changing a birth certificate's gender marker
requires an **in-person appointment** at the Vital Records Office to sign the
self-attestation affidavit. Our `ri.birth-certificate.gender-marker` record, citing only
the RICR regulation text, describes just "an affidavit" with no in-person requirement
stated one way or the other. This review did not fetch RIDOH's own procedural PDF
(linked above) to settle whether in-person signing is actually mandatory or whether
mailed/notarized submission remains possible — **open for the follow-up wave.**

**A4TE gaps:** A4TE doesn't break out the $18 each-additional-copy fee or the $7
expedite-handling fee that our `ri.birth-certificate.fees` record states.

## What this review did not do

This is a pointer-and-fact audit against a volunteer-maintained index, not a
verification pass. It does not re-run `make fidelity`, `make source-watch`, or any other
gate; it does not touch `corpus/source-hashes.json`, `forms/form-hashes.json`, or
`corpus/snapshots/`. Every "open" item above needs a human (or a future automated pass)
to actually read the named primary source and decide; nothing here should be merged into
a corpus record on the strength of this document alone. Where this review *did* reach a
confident conclusion — the two North Carolina statute repeals and the two Ohio
confirmations — the conclusion is that **our existing records are already correct** and
A4TE's page is what's behind, which means no corpus edit is needed for those four items;
they're listed so nobody re-litigates them from scratch.
