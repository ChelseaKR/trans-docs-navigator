# A4TE Cross-Check — Maryland through New Hampshire — 2026-09-05

> **This is an index-driven review, not verification.** Advocates for Trans Equality
> (A4TE, formerly NCTE) maintains human-curated state guides at
> `https://transequality.org/documents/<state>-identity-documents`. This document uses
> those pages **only as a map** — which agencies, pages, and forms to check, and which
> facts to check them against — never as a cited source. **No A4TE prose is copied
> anywhere in this document or was copied into the corpus.** Every fact asserted below as
> confirmed was checked against the primary `.gov`/`.mil`/legislative source directly,
> with the fetch shown. Nothing in `corpus/`, `forms/`, `tests/`, `src/`, or `api/` was
> changed to produce this document, and nothing in `corpus/referrals/` was touched. This
> is the reviewed input to a follow-up wave of corpus fixes — it does not itself close
> any gap it names.

## Scope and method

Ten jurisdictions: Maryland, Massachusetts, Michigan, Minnesota, Mississippi, Missouri,
Montana, Nebraska, Nevada, New Hampshire. For each, this review:

1. Fetched `https://transequality.org/documents/<state>-identity-documents` with this
   project's declared user agent (`trans-docs-navigator-source-watch/1.0
   (+https://github.com/ChelseaKR/trans-docs-navigator)`) — all 10 fetches returned
   `HTTP 200`.
2. Extracted A4TE's actual content block (their site markup separates the formatted-text
   field from nav/footer chrome) and stripped it to plain text — never quoted verbatim
   beyond a form id, statute cite, or dollar figure.
3. Read the corresponding `corpus/jurisdictions/<state>.json` records in full (EN), and
   the matching `.es` records in `corpus/jurisdictions/spanish.json` where relevant, plus
   every `forms/registry.json` entry whose `jurisdiction` is one of these 10 states.
4. Extracted every outbound link A4TE's content actually cites (the real "index" this
   review is here to exploit), and diffed the set of official URLs and form ids against
   what our corpus and forms registry currently cite.
5. For every place A4TE and the corpus disagreed on a checkable fact, attempted a live
   fetch of the primary `.gov`/legislative source myself, rather than trusting either
   side. Some of those primary pages returned `HTTP 403` to this fetcher (both `curl`
   with the project's user agent and Claude's `WebFetch` tool) — noted individually below,
   never papered over as "resolved."

**A4TE freshness varies sharply within this group.** Eight of the ten pages carry an
explicit "Last updated [Month Year]" line and a rewritten step-by-step format (Michigan:
November 2025; Nevada, Missouri, Montana: December 2025; Mississippi: December 2025;
Minnesota, Nebraska: January 2026). **Maryland and Massachusetts do not** — they are
still on A4TE's older, short-form template, carry no freshness stamp at all, and cite
policy dates from 2015 and 2019 in their own body text. That distinction matters for how
much weight to put on A4TE as an index for each state below.

## Summary table

| Jurisdiction | A4TE freshness | Sources A4TE points to that we don't cite | Forms A4TE names that the registry lacks | Disagreements found | Confirmed against primary source |
|---|---|---|---|---|---|
| Maryland | No date stamp; cites 2015/2019 policy | MVA name-change info page (different URL than ours); MD VSA mailing address | 0 (MD already has 2/2 registry forms) | 0 | — |
| Massachusetts | No date stamp | RVRS amendments page; RVRS gender-marker fact sheet | 0 (MA already has 3/3) | 0 | — |
| Michigan | Nov 2025 | courts.michigan.gov SCAO forms index; MDHHS mailing address | PC-51, PC-51c, PC-52, PC-161, PC-50, MC-20 (fee waiver) — court name-change forms | 1 (filing-fee framing) | Yes — MI Legal Help confirms flat $175, live-fetched |
| Minnesota | Jan 2026 | mncourts.gov name-change self-help hub and forms | NAM102, NAM103, NAM107 (adult); NAM202/203/208 (minor) | 0 hard disagreements; 1 added restriction (incarcerated filers) | — |
| Mississippi | Dec 2025 | courts.ms.gov chancery-court finder; the Nov 2025 MS Supreme Court opinion (CO182514) | Form 1126 (Affidavit to Amend MS Birth Certificate); Petition/Order for Change of Name | 1 major (age-21 "adult" threshold) | **No** — could not independently confirm; flagged |
| Missouri | Dec 2025 | — (dor.mo.gov, revisor.mo.gov already cited) | CAFC401/402/411/412/470/472/480/482, FI-10, GN320, GN10 | 1 confirmed wrong on A4TE's side | **Yes** — revisor.mo.gov live-fetched, confirms our corpus |
| Montana | Dec 2025 | mvdmt.gov (new MVD domain); dailymontanan.com lawsuit coverage | Petition for Name Change (Adult/Child), Order Setting Hearing, Order for Name Change, Affidavit of Inability to Pay | 1 (DL gender-marker requirement) | Partial — corroborated by 2 sources, but the .gov page itself still 403s us |
| Nebraska | Jan 2026 | supremecourt.nebraska.gov forms hub | DC-6:9-1, DC-6:9-4, DC-6:9-3 (name-change forms); "Application for Amendment" (birth record) | 0 | — |
| Nevada | Dec 2025 | dhs.nv.gov copy of the 2018 gender guide (different host than ours) | Petition for Change of Adult/Minor Name, Family Cover Sheet, Order for Name Change, IFP application | 0 new (echoes our corpus's own already-flagged $40/$45 conflict) | No — still unresolved, as before |
| New Hampshire | Dec 2025 | sos.nh.gov vital-records page | VSCr, VSX (birth record); NHJB-2175 petition, Confidential Information Sheet, fee-waiver motion | 2 (DL gender-marker fee; birth-cert copy fee) | 1 of 2 confirmed — RSA 5-C:10 live-fetched; DL fee unconfirmable (dmv.nh.gov 403s) |

**Totals across the 10 states: 8 official sources A4TE points to that we don't currently
cite, at least 34 named forms missing from `forms/registry.json` (3 of these 10 states —
Mississippi, Nebraska, New Hampshire — have *zero* registry entries), and 5 factual
disagreements worth a human's attention, of which 2 are now confirmed (one favoring our
corpus, one showing A4TE is stale), 1 is corroborated-but-still-unverifiable-by-us, and 2
remain genuinely open.**

---

## Maryland

**A4TE page:** old-style template, no "Last updated" stamp, 24 lines of content. Cites
"Starting October 1, 2019" (driver's license X marker) and "Effective October 1, 2015"
(birth certificate) as if these were still the newest applicable dates — a strong signal
this specific state page has not been substantively refreshed in some time, unlike 8 of
the other 9 states in this batch.

1. **Sources A4TE points to that we don't cite.** A4TE's driver's-license section links
   to `mva.maryland.gov/drivers/apply/md-drivers-license.htm#mddlcorrecting` — a different
   MVA URL than the one our `md.drivers-license.name` / `md.drivers-license.gender-marker`
   records cite (`mva.maryland.gov/about-mva/Pages/changing-gender.aspx`). Worth a human
   opening both to see if they're two live pages saying the same thing or if one is
   stale/redirected. A4TE also states a mailing address for the Division of Vital Records
   (6550 Reisterstown Road, Baltimore, MD 21215) that neither `md.birth-certificate.name`
   nor `md.birth-certificate.gender-marker` currently states.
2. **Forms gap.** None — both Maryland forms A4TE names (the CC-DR-60 name-change
   petition, the VSA gender-reassignment application) are already in
   `forms/registry.json` as `md-cc-dr-60` and `md-vsa-gender-reassignment`.
3. **Disagreements.** None found that rise above A4TE's page being simply out of date.
   Notably, A4TE's birth-certificate section describes only the healthcare-provider-
   certification path to a new birth certificate — it does not mention the intersex-
   diagnosis or court-order alternatives that `md.birth-certificate.gender-marker`
   documents (sourced directly from the VSA's own instructions PDF, which lists all
   three as alternatives). This reads as A4TE's page being incomplete/stale rather than
   the corpus being wrong — not fetched live to reconfirm here since it wasn't a
   contradiction, just a completeness gap in A4TE's favor of ours.
4. **Document types A4TE covers that we don't.** None — A4TE's Maryland page covers
   court-order (name-change law), driver's license, and birth certificate, the same set
   our corpus covers for Maryland.
5. **A4TE gaps.** A4TE's page states no dollar amounts anywhere for Maryland — not the
   $165 court filing fee, not the $10 birth-certificate fees, not the MVA's driver's
   license/ID correction fee. It also doesn't mention Maryland's fee-waiver option, the
   30-day objection window on a name-change petition, or the "judicial declaration of
   gender identity" combined process our `md.court-order.name` record describes.

## Massachusetts

**A4TE page:** old-style template, no "Last updated" stamp, 40 lines of content.

1. **Sources A4TE points to that we don't cite.** A4TE links to the RVRS amendments
   landing page (`mass.gov/eohhs/gov/departments/dph/programs/admin/dmoa/vitals/`) and a
   dedicated "fact sheet on birth certificate gender marker amendments" PDF
   (`mass.gov/eohhs/docs/dph/vital-records/r-117-fact-sheet-birth-certificate-amendment-
   following-sex-reassignment.pdf`) — neither is currently cited by
   `ma.birth-certificate.gender-marker` or `ma.birth-certificate.name`, both of which
   cite newer-looking `mass.gov/how-to/...` URLs instead. Worth checking whether the
   `eohhs/docs` PDF is a legacy mirror of the same content or carries anything the
   `how-to` page doesn't (e.g., the exact affidavit form).
2. **Forms gap.** None — all three Massachusetts forms A4TE names (CJP 27, the RMV
   license/ID application, the RVRS applicant affidavit) are already registered.
3. **Disagreements.** None found. A4TE's summary of the birth-certificate rule ("Surgery
   is not required and a court order is not required," an affidavit plus a notarized
   physician statement) matches `ma.birth-certificate.gender-marker.law`'s citation of
   Mass. Gen. Laws c.46 §13(e) exactly in substance.
4. **Document types A4TE covers that we don't.** None.
5. **A4TE gaps.** A4TE's page states no fee anywhere for Massachusetts — not the $165
   total court filing fee (with the $22 e-filing add-on and indigency waiver our
   `ma.court-order.name` record documents), not the $25 RMV amendment fee, not the
   $50/$32/$20 birth-certificate fee structure. It also doesn't cite the specific driver's
   license statute (c.90 §8N) that `ma.drivers-license.gender-marker.law` names, or the
   3-year window (extendable for good cause) for bundling a name change onto a
   sex-designation amendment that `ma.birth-certificate.gender-marker.law` documents.

## Michigan

**A4TE page:** rewritten format, "Last updated November 2025," 247 lines — by far the
most detailed of the old-style pair above, and one of the richest in this batch.

1. **Sources A4TE points to that we don't cite.** `courts.michigan.gov/SCAO-forms/
   name-change/` (the state courts' own name-change forms index) and
   `courts.michigan.gov/courts/trial-courts/` (circuit-court finder) — neither is cited
   by `mi.court-order.name`, which instead cites Michigan Legal Help's guide. A4TE also
   states the MDHHS Vital Records mailing address (P.O. Box 30721, Lansing MI 48909) that
   `mi.birth-certificate.name` / `mi.birth-certificate.gender-marker` don't currently
   state, and a $16.00-per-extra-copy figure that `mi.birth-certificate.fees` doesn't
   mention (it states only the $50 base and $25 expedite fee).
2. **Forms gap.** A4TE names an extensive set of Michigan circuit-court self-help forms
   that `forms/registry.json` does not have any entry for: **PC-51** (Petition for Name
   Change), **PC-51c** (Petition + Ex Parte Request for Nonpublication), **PC-51b**
   (Minor's Consent), **PC-52** (Order Following Hearing), **PC-161** (Order Regarding
   Nonpublication), **PC-162** (Request for Hearing/Dismissal), **PC-50** / **PC-50C**
   (Publication of Notice), **PC-164** (Alternate Service), and **MC-20** (Fee Waiver
   Request) — all issued by the Michigan State Court Administrative Office, all linked
   directly from `courts.michigan.gov`. `forms/registry.json` currently has only
   Michigan's two vital-records/SOS forms (`mi-mdhhs-sex-designation-form`,
   `mi-mdos-sex-designation-form`, `mi-vital-records-correction-application`) — nothing
   for the court side of a Michigan name change at all.
3. **Disagreements.** `mi.court-order.name` states a flat **$175** filing fee, sourced
   from Michigan Legal Help. A4TE instead says "Filing fee (varies depending on county)"
   with no number. **Checked against the primary source directly**: I re-fetched
   `michiganlegalhelp.org/resources/ids-and-name-change/i-want-change-my-name` live today
   and it still states, unambiguously, "It will cost $175 to file your petition" — the
   same $10 order-entry fee and $11 certified-copy fee our corpus already has are also
   unchanged on the live page. **The corpus's $175 figure is current and confirmed.**
   A4TE's "varies by county" framing may be trying to capture that some Michigan trial
   courts add local fees on top of the state fee schedule — genuinely useful color a
   human could fold in as a caveat — but it should not replace the specific $175 figure,
   which is verified as of today.
4. **Document types A4TE covers that we don't.** None.
5. **A4TE gaps.** Nothing significant — Michigan is one of the better-matched states.

## Minnesota

**A4TE page:** rewritten format, "Last updated January 2026," 244 lines.

1. **Sources A4TE points to that we don't cite.** `mncourts.gov/help-topics/name-change`
   (the courts' own self-help hub) and its linked forms index — `mn.court-order.name` and
   `mn.court-order.grant-standard` cite only the Minnesota Statutes text (`revisor.mn.gov`)
   directly, not the courts' own procedural guide, which is where the practical
   step-by-step (witnesses, notarization, filing location) actually lives.
2. **Forms gap.** A4TE names **NAM102** (Application for Name Change), **NAM103**
   (Criminal History Check Release), and **NAM107** (Proposed Order Granting Name
   Change) for adults, plus **NAM202/NAM203/NAM208** for minors — none of these Minnesota
   Judicial Branch forms are in `forms/registry.json`, which has only the birth-record
   amendment form (`mn-mdh-birth-record-amendment`) for Minnesota.
3. **Disagreements.** None found on a checkable fact. A4TE adds one restriction our
   corpus doesn't have at all: "If incarcerated, can only file a name change once and
   must show a constitutional right will be denied in order to waive the filing fee" — a
   specific, narrow rule about incarcerated petitioners that isn't in `mn.court-order.name`
   and wasn't independently verified here (A4TE doesn't cite a specific statute for it on
   this page); worth a human's follow-up rather than treating it as confirmed.
4. **Document types A4TE covers that we don't.** None.
5. **A4TE gaps.** A4TE doesn't mention `mn.drivers-license.gender-marker`'s honest
   admission that the DVS self-designation page itself couldn't be automatically
   verified by this project's tooling — A4TE simply asserts DVS lets you self-designate,
   without flagging that its own source for that claim (a DVS page) is
   JavaScript-rendered in a way our fetcher can't read. That's not a disagreement, just a
   reminder that A4TE doesn't carry the same "we couldn't check this" honesty signal our
   corpus does.

## Mississippi

**A4TE page:** rewritten format, "Last updated December 2025," 213 lines.

1. **Sources A4TE points to that we don't cite.** `courts.ms.gov/trialcourts/
   chancerycourt/chancerycourt.php` (chancery-court finder) and, most importantly, a
   **Mississippi Supreme Court opinion** at `courts.ms.gov/images/Opinions/CO182514.pdf`
   — cited by A4TE as a November 2025 decision affirming a Hinds County chancery judge's
   denial of a 16-year-old trans minor's name-change petition. Neither this opinion nor
   anything about it appears anywhere in `ms.court-order.name`, which currently discusses
   only the 2026 sex-offender name-change felony provision (SB 2126) and nothing else
   about who may petition or courts' discretion over minors.
2. **Forms gap.** A4TE names **Form 1126** (Affidavit to Amend Mississippi Birth
   Certificate — the actual current MSDH amendment form) plus a chancery-court "Petition
   for Change of Name" / "Order for Change of Name" and a "Cover Sheet for Civil Case
   Filing Forms." None of these are in `forms/registry.json`, which currently has **zero**
   entries for Mississippi.
3. **Disagreements — the significant one.** A4TE's overview states Mississippi defines
   an "adult" as **21 or older** for name-change purposes (with under-21 treated as a
   minor petition, parent/guardian required), and cites the November 2025 Supreme Court
   opinion above as illustrating the practical stakes of that line for a 16-year-old
   trans petitioner. **`ms.court-order.name` says nothing about an age threshold at
   all** — it discusses only jurisdiction (chancery court) and the sex-offender felony
   provision. **I attempted to independently confirm the age-21 claim** against
   Mississippi's general age-of-majority statute (Miss. Code Ann. § 1-3-27) and could
   not: `law.justia.com`, `codes.findlaw.com`, `mscode.com`, and a law-school mirror all
   returned `403`/`404` to this fetcher, and this session's web-search budget was
   exhausted by the time I reached this point, so I could not fall back to a search-based
   citation either. **I am not asserting the age-21 figure is correct — only that A4TE
   states it, cites a real-looking Supreme Court opinion for it, and our corpus is
   silent on the question entirely.** This is exactly the kind of gap a human with
   working search/browser access should resolve directly, ideally by opening the cited
   opinion PDF itself, before deciding whether `ms.court-order.name` needs an age
   threshold added.
4. **Document types A4TE covers that we don't.** None.
5. **A4TE gaps.** A4TE's overview also names a narrower restriction — "Incarcerated
   people cannot file a name change petition unless filed on their behalf by a district
   attorney, sheriff... or MDOC commissioner or chaplain" — that isn't in our corpus and,
   like the Minnesota incarceration note above, isn't independently statute-cited on the
   A4TE page itself; flagged, not confirmed.

## Missouri

**A4TE page:** rewritten format, "Last updated December 2025," 260 lines.

1. **Sources A4TE points to that we don't cite.** None beyond what's already cited —
   A4TE's DOR and health-department links match `dor.mo.gov/driver-license/issuance/
   id-requirements.html` and `health.mo.gov/.../correctamend-vital-record` already in our
   corpus.
2. **Forms gap.** A4TE names a long list of Missouri circuit-court self-help forms with
   no registry counterpart: **CAFC401** (Petition, adult), **CAFC402** (Petition by
   parent, minor), **CAFC411** (Next Friend appointment), **CAFC412** (Parental consent),
   **CAFC470/CAFC472** (Judgment, adult/minor), **CAFC480/CAFC482** (Request for
   Publication), **FI-10** (Confidential Case Filing Information Sheet), **GN320**
   (Redaction Certification), and **GN10** (In Forma Pauperis Application). Missouri's
   only registry entry today is the birth-certificate correction affidavit
   (`mo-dhss-580-0645`) — nothing for the court side.
3. **Disagreements — confirmed.** A4TE's overview states "Restrictions Based on Past
   Criminal Convictions: **None**." Our `mo.court-order.name` record states the opposite:
   that a person required to register under Missouri's sex-offender registration law
   (§§ 589.400–589.425) **cannot** change their name for as long as they must register,
   citing RSMo § 527.270. **I re-fetched `revisor.mo.gov/main/OneSection.aspx?
   section=527.270` live today** (effective 2026-08-28 revision) and it states, in
   subsection 2, verbatim in substance: "no person required to register under sections
   589.400 to 589.425 shall change his or her name for the period of time he or she is
   required to register on the registry." **Our corpus is correct and current; A4TE's
   overview line is wrong** (or reflects an older law-review pass on the page that its
   detailed body text elsewhere doesn't repeat — either way, the "None" summary line
   should not be relied on for Missouri).
4. **Document types A4TE covers that we don't.** None.
5. **A4TE gaps.** A4TE adds one useful, unconfirmed data point: "In 2024, the Missouri
   Department of Revenue stopped accepting a form to update the gender marker on
   driver's licenses. It remains possible... with a court order or letter from a
   surgeon." **I re-fetched `dor.mo.gov/driver-license/issuance/id-requirements.html`
   live** and its current text still reads exactly as `mo.drivers-license.gender-marker`
   already quotes it — "additional documents may be required... to request a change to
   the gender or date of birth" — with **no mention of a discontinued form, a court
   order, or a surgeon's letter anywhere on the current page**. A4TE's added specificity
   is not confirmable from Missouri's own current official page; our corpus's honest
   "unclear from official sources, `needs_reverification`" framing remains the more
   defensible position until a human can independently confirm A4TE's 2024-change claim
   (e.g., by calling DOR or finding the discontinued form itself).

## Montana

**A4TE page:** rewritten format, "Last updated December 2025," 219 lines. Montana and
Mississippi are the two jurisdictions the task called out as having contested rules —
that held up under review.

1. **Sources A4TE points to that we don't cite.** Two are worth flagging specifically:
   - `mvdmt.gov` — the Montana Motor Vehicle Division's own newer-looking dedicated
     domain (`/changing-your-name/`, `/required-documents/#identity`, `/licensing-fees/`),
     distinct from the `dojmt.gov/driving/driver-licensing/` fallback URL our
     `mt.drivers-license.name-and-gender-marker` record currently points readers to.
     **I attempted to fetch `mvdmt.gov` directly and it also returned `HTTP 403`** to
     both `curl` (project user agent) and Claude's `WebFetch` tool — the same
     Cloudflare-style block our corpus already documents for `dojmt.gov`. A4TE's page
     itself is not blocked from linking there, but neither A4TE nor this project can get
     an automated read of what the page currently says; a human still needs to open it
     directly.
   - `dailymontanan.com/2024/04/18/lawsuit-doj-quietly-changed-policy-for-changing-
     gender-markers-on-drivers-licenses/` — a news article, not a primary legal source,
     but **I fetched and read it in full**, and it independently corroborates the shape
     of A4TE's claim below: an ACLU of Montana class-action lawsuit alleging Montana's
     DOJ "quietly adopted a new policy for changing gender markers on Montana driver's
     licenses that would require transgender Montanans to provide an amended birth
     certificate, as opposed to only requiring a note from a doctor," filed against a
     backdrop of a 2022 DPHHS rule and 2023's SB 458 (defining sex as binary), both
     separately under ongoing litigation. This is useful context to add to
     `mt.drivers-license.name-and-gender-marker`'s existing "we could not confirm this"
     disclosure, even though it's a secondary source.
2. **Forms gap.** A4TE names **Petition for Name Change (Adult)**, **Petition for Name
   Change (Child)**, **Order Setting Hearing**, **Notice of Hearing on Name Change**,
   **Order for Name Change**, and **Affidavit of Inability to Pay** — all
   `courts.mt.gov`-hosted self-help forms with no registry entry. Montana's registry
   entries today (`mt-dphhs-affidavit-correction`, `mt-dphhs-gender-designation-form`)
   cover only the vital-records side.
3. **Disagreements.** A4TE states the driver's-license gender-marker requirement plainly:
   "An amended birth certificate displaying your preferred gender **OR** a certified
   copy of a court order for change of gender" — where our own record explicitly says it
   *could not* determine this because `dojmt.gov` blocks our fetcher. **This is not a
   contradiction — it's A4TE filling a hole our corpus is honest about having** — and the
   Daily Montanan article above independently corroborates that this is a real, recently
   adopted MVD requirement (not a longstanding one; the article describes it as a 2024
   policy change from a prior doctor's-note standard). **I still could not confirm this
   against the primary `.gov` source myself** — both `dojmt.gov` and `mvdmt.gov` 403 this
   fetcher — so I'm reporting it as well-corroborated by two independent sources rather
   than as independently confirmed. A human who can open `mvdmt.gov/required-documents/`
   directly in a browser should be able to close this out quickly.
4. **Document types A4TE covers that we don't.** None.
5. **A4TE gaps.** I independently re-fetched `courts.mt.gov/Forms/namechange` live (it is
   not blocked, unlike the MVD domains) to check one more overview-table line: A4TE's
   Montana overview states "Restrictions Based on Past Criminal Convictions: None." The
   live page **still states**, unchanged: "NOTE: DO NOT use these forms if you are
   incarcerated or under the supervision of the Department of Corrections" — matching
   what `mt.court-order.name` already documents (citing Mont. Code Ann. § 27-31-201(4)).
   This isn't necessarily a flat contradiction of A4TE's "None" (a restriction on using
   the self-help *forms* isn't quite the same claim as a restriction tied to a
   *conviction*), but it's a meaningful nuance A4TE's own overview table omits that our
   corpus already captures correctly.

## Nebraska

**A4TE page:** rewritten format, "Last updated January 2026," 271 lines — the longest in
this batch.

1. **Sources A4TE points to that we don't cite.** `supremecourt.nebraska.gov/self-help/
   name-change/adult-name-change` and its full forms index — `ne.court-order.name` cites
   this exact self-help URL already, so no gap there. Nothing else new surfaced.
2. **Forms gap.** A4TE names Nebraska's actual form numbers in full: **DC 6:9-1**
   (Petition for Name Change, matching what `ne.court-order.name`'s text already
   mentions as "DC 6:9.1"), **DC 6:9-4** (Confidential Party Information, matching the
   text's "DC 6:9.4"), **DC 6:9-3** (Decree of Name Change), plus publication-waiver and
   mailing-affidavit forms, and a separate "Application for Amendment" form for the
   birth-record side. **None of these are registered** — `forms/registry.json` has
   **zero** entries for Nebraska despite `ne.court-order.name` already naming two of
   these forms by number in its own text.
3. **Disagreements.** None found. A4TE's fee figures ($16 birth-record amendment fee,
   $17 certificate fee) match `ne.birth-certificate.name`/`ne.birth-certificate.
   gender-marker`'s framing that a fee applies without a corpus-stated dollar figure —
   worth folding A4TE's numbers in as a lead for a human to confirm against
   `dhhs.ne.gov`, not treated as confirmed here since I did not independently re-fetch
   that specific fee page.
4. **Document types A4TE covers that we don't.** None.
5. **A4TE gaps.** Nothing significant found — Nebraska's corpus and A4TE's page are
   well-aligned on substance (surgery-required birth-certificate rule under Neb. Rev.
   Stat. § 71-604.01, no X marker on driver's licenses, physician certification for
   driver's license gender-marker changes).

## Nevada

**A4TE page:** rewritten format, "Last updated December 2025," 242 lines.

1. **Sources A4TE points to that we don't cite.** A4TE's "Instruction Packet" link for
   the gender/name birth-certificate guide points to
   `dhs.nv.gov/siteassets/content/programs/nomhe/mh/Transgender_in_NV_03262018_v1.pdf` —
   a different host (`dhs.nv.gov` vs. our `dpbh.nv.gov`) and a different exact filename
   date (`03262018` vs. our cited `08.24.2018_1`) for what appears to be the same
   underlying guide. Worth a human checking whether these are two live mirrors of the
   same document or whether one is stale.
2. **Forms gap.** A4TE names **Petition for Change of Adult Name**, **Family Cover
   Sheet**, **Order for Name Change**, **Request for Summary Disposition and Declaration
   in Support**, **Application to Proceed In Forma Pauperis**, and the minor-name-change
   equivalents — all `selfhelp.nvcourts.gov`-hosted, none registered. Nevada's registry
   entries today (`nv-dpbh-corrections-birth`, `nv-dpbh-court-ordered-change`) cover only
   the vital-records side.
3. **Disagreements.** A4TE states the birth-certificate gender-marker amendment fee as
   "$40 fee, that includes one certified copy... Additional copies are $20 each" — this
   **echoes one side of a disagreement our own corpus already flags**:
   `nv.birth-certificate.gender-marker` already states that Nevada's own guide says $40
   while the department's current corrections-packet form says $45, and declines to
   assert either number for that reason. A4TE's number matches the "guide" side but adds
   no new information toward resolving which is currently correct — the corpus's existing
   refusal to pick one remains the right call.
4. **Document types A4TE covers that we don't.** None.
5. **A4TE gaps.** Nothing significant — Nevada's corpus already captures the greatest
   level of nuance here (both affidavit paths, the alternate-evidence option, the
   fee conflict) of any state in this batch.

## New Hampshire

**A4TE page:** rewritten format, "Last updated December 2025," 240 lines.

1. **Sources A4TE points to that we don't cite.** `sos.nh.gov/vital-records-0/
   purchasing-correcting-vital-records` — the Secretary of State's consumer-facing vital
   records page, distinct from the RSA statute texts (`gencourt.state.nh.us`) our corpus
   cites directly. **I attempted to fetch this page and it returned `HTTP 403`** — this
   is one of the pages the task named as blocked to our fetcher; confirmed. A human
   should open it directly, since it likely has the current practical application
   instructions the bare statute text doesn't.
2. **Forms gap — the largest of any state in this batch.** A4TE names Form **VSCr**
   (Application for Correcting or Completing a Certificate of Birth) and Form **VSX**
   (the minor equivalent) for birth records, plus **NHJB-2175** (Petition for Change of
   Name), a **Confidential Information Sheet**, **Consent to Minor Name Change**, and a
   **Motion to Reduce or Eliminate Filing Fees**. `forms/registry.json` has **zero**
   entries for New Hampshire — every one of these forms, plus the DSMV 30 and DSMV 450
   DMV forms already named in `nh.drivers-license.name` / `nh.drivers-license.
   gender-marker`'s own text, is unregistered.
3. **Disagreements — two, one resolved.**
   - **Birth-certificate copy fee.** A4TE states "$10.00 amendment fee. There is an
     additional certificate fee of **$15.00** for each copy request." Our
     `nh.birth-certificate.fees` states the amendment fee is $10 (matching), but that
     **each additional certified copy costs $10**, with $15 being a *separate* search
     fee that includes one copy. **I re-fetched RSA 5-C:10 directly**
     (`gencourt.state.nh.us/rsa/html/I/5-C/5-C-10.htm`) and its current text confirms our
     corpus exactly: "$15 for making a search, which sum shall include payment for the
     issuance of such copy... and **$10 for each subsequent copy**." **A4TE appears to
     have conflated the $15 search fee with a per-copy fee; our corpus is correct and
     verified against the current statute.**
   - **Driver's license gender-marker fee.** A4TE states "**$3.00 fee**." Our
     `nh.drivers-license.gender-marker` states **$10.00**, sourced directly from
     `dmv.nh.gov/drivers-licensenon-driver-ids/update-personal-information`. **I could
     not resolve this**: that DMV page returned `HTTP 403` to both `curl` and `WebFetch`
     today — the exact page the task flagged as blocked. I am not able to say which
     figure is current. A human who can open that page in a real browser should check
     this specific number directly; it's a small dollar amount but a real, specific
     factual claim that two otherwise-reasonable sources disagree on.
4. **Document types A4TE covers that we don't.** None.
5. **A4TE gaps.** A4TE's court-fee section states a flat "$170.00" filing fee without
   mentioning the $140 Family Division alternative (e.g., filing as part of a divorce)
   that `nh.court-order.fee` documents from the same Circuit Court fee schedule PDF —
   not wrong, just incomplete next to what our corpus already has.

---

## What this review could not do

- **Mississippi's age-21 "adult" threshold** and the November 2025 Supreme Court opinion
  A4TE cites for it were not independently confirmable here — every secondary-law mirror
  attempted returned 403/404, and this session's web-search budget was exhausted before
  a citation-grade source could be found. This is the single most consequential open
  item in this batch: if the age-21 figure is right, `ms.court-order.name` is materially
  incomplete for anyone under 21.
- **New Hampshire's $3 vs. $10 driver's-license gender-marker fee** and **Montana's
  driver's-license gender-marker requirement** both remain genuinely unverified against
  their primary `.gov` sources, because `dmv.nh.gov`, `dojmt.gov`, and `mvdmt.gov` all
  return `HTTP 403` to this project's fetcher (confirmed today, with both `curl` using
  the project's declared user agent and Claude's own `WebFetch` tool) — matching what the
  task described going in. A4TE's page is a genuinely useful pointer in both cases
  precisely because a human, not this pipeline, can open a real browser there.
- **Minnesota's and Mississippi's "incarcerated petitioner" restrictions**, as stated by
  A4TE, were not independently statute-checked — A4TE's own page doesn't cite a specific
  provision for either, so I'm passing them along as leads, not findings.

## Suggested next steps for a human

1. Resolve the two confirmed-open disagreements first: Mississippi's age-21 threshold
   (open the cited opinion, `courts.ms.gov/images/Opinions/CO182514.pdf`, and Miss. Code
   Ann. § 1-3-27 directly) and New Hampshire's DL gender-marker fee ($3 vs. $10 — open
   `dmv.nh.gov` in a browser).
2. Register the ~34 missing court/vital-records forms named above in
   `forms/registry.json`, starting with the three states that have zero entries today
   (Mississippi, Nebraska, New Hampshire).
3. Add the 8 newly-identified official source URLs above to the relevant records'
   `source` fields where a human confirms they add something the currently-cited page
   doesn't (the Michigan/Minnesota/Nebraska courts' self-help hubs look like the
   strongest candidates; the two "different host, same document" cases in Maryland and
   Nevada need a same-document check before being added).
4. Fix Missouri's `mo.court-order.name` is already correct — the finding here is that
   **A4TE's own overview table is wrong** about Missouri's sex-offender name-change
   restriction. Nothing to change in our corpus for that one.
5. Consider whether `mt.drivers-license.name-and-gender-marker` and
   `nh.drivers-license.gender-marker` should note, in addition to "we could not confirm
   this," that A4TE names a specific answer as of December 2025 that a human should
   verify directly — giving the next reviewer a concrete lead instead of a blank wall.
