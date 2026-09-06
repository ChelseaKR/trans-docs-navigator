# Source Drift Triage — 2026-09-05

> Human-reviewed triage in response to #150. **Nothing in `corpus/source-hashes.json`,
> `forms/form-hashes.json`, or `corpus/snapshots/` was touched to produce this document.**
> No drift was adopted and no record's asserted facts were changed. This is a reviewed
> diff for a human to act on — the issue closes when a human has read it, re-verified the
> affected records, and run the reviewed re-baseline procedure in `docs/OPERATIONS.md`,
> not when this document exists.

## Headline

Of the sources `make source-watch` currently reports as drifted, **2 sources (4 record
ids, counting EN/ES) carry a change that affects an asserted fact** — a fee, timeline,
requirement, or form. Both are in Washington State, and both make the corpus **more
wrong than it already looked**, not less:

| Record(s) | Source | What changed | Why it matters |
|---|---|---|---|
| `wa.court-order.name`, `wa.court-order.name.es` | `courts.wa.gov/forms/?fa=forms.static&staticID=13` | "name change petitions **are usually filed in district court in the county where you reside**" → "name change petitions **may be filed in any district court in the state**" | The record's own **statement** field asserts the county-of-residence rule as the current law. The source no longer says that. A reader following the record's guidance would file in the wrong county under an outdated rule that no longer applies — or would wrongly believe they *must* stay in-county when they no longer must. |
| `wa.birth-certificate.name`, `wa.birth-certificate.name.es` | `doh.wa.gov/.../court-ordered-name-change` | "we currently have a **ten (10) month** processing turnaround time" (both instances) → "**two (2) month**" | The record's **detail** field states "these requests currently take about ten months to process." The real current wait is a fifth of that. This is a timeline claim — exactly the class of assertion `make fidelity` is built to catch, and it will start failing once `corpus/snapshots/` is refreshed for this URL, because the record will no longer match the (correctly re-baselined) source. |

Every other drifted source was read against a live fetch and found to be either
**cosmetic** (site chrome: rotating alert banners, nav-menu wording, footer year bumps,
timestamp/date stamps, an emoji-encoding artifact) or **substantive on the page but not
touching what the record actually asserts** (a real content rewrite that lands outside
the paragraph the record cites). None of those require a content change — they still
require a human to open the page and confirm before re-baselining, per the procedure
below; "cosmetic" here means "reviewed and found not to bear on the record," not
"skip the review."

## Scope and method

- `make source-watch` (read-only, no baseline written) was run against `main` @ `bf9424b`
  on 2026-09-05. It reported **24 drifted corpus/forms sources** and **82 baseline-coverage
  issues** — see "About the coverage-gap count" below; that count is a different, larger
  problem than this triage and is explicitly out of scope for it.
- #150 named 22 drifted sources. The current run reports 24: the same 22 plus
  `mva.maryland.gov/about-mva/Pages/changing-gender.aspx` and
  `law.lis.virginia.gov/vacode/title32.1/chapter7/section32.1-269/`, which drifted after
  the issue was filed (Maryland and Virginia were both added to the corpus the same day).
  Both are cosmetic (see table below) — this is normal source churn, not a regression.
- For every drifted URL, the live page was fetched with the project's declared user-agent
  and normalized with the **exact same `normalize()`** `scripts/source-watch.ts` hashes
  (imported, not reimplemented), then diffed word-by-word against the committed snapshot
  in `corpus/snapshots/` to find every changed span with context. The one non-HTML
  source (`us-ds-82`, a PDF) has no text snapshot to diff against — see its row below for
  what could and couldn't be checked.
- Every "cosmetic" or "not affecting our claims" call below is backed by the actual
  before/after text quoted or described, not by assumption. Where a record's specific
  asserted fee, timeline, form id, or requirement is at stake, the record's JSON is quoted
  directly.

## The 24 drifted sources, sorted by risk

### ⚠️ Affects an asserted fact (2 sources / 4 record ids)

**1. `https://www.courts.wa.gov/forms/?fa=forms.static&staticID=13`** — re-verify
`wa.court-order.name`, `wa.court-order.name.es`

- Record statement (current, both EN and ES): *"In Washington you usually file a name
  change petition in the district court of the county where you reside."*
- Live source, today: *"name change petitions may be filed in any district court in the
  state. But in some instances, name changes may be filed in superior court."* (was:
  *"...are usually filed in district court in the county where you reside."*)
- **This is a venue-rule change, not wording.** The record's central claim about *where*
  to file is now unsupported by its own cited source.
- The same page also changed its mailing address for sending certified copies to DOH
  Center for Health Statistics: `P.O. Box 9709, Olympia, WA 98507-9709` →
  `P.O. Box 47814, Olympia, WA 98504-7814`. Neither `wa.court-order.name` nor
  `wa.birth-certificate.name` currently states this address as an assertion, so this
  specific change does not falsify an existing claim — but a human re-verifying this
  record anyway should confirm the record doesn't need this step/address added, and
  should not carry the old PO Box forward from memory.
- Everything else on the page (a version marker `n2`→`n1` in the footer) is cosmetic.

**2. `https://doh.wa.gov/licenses-permits-and-certificates/vital-records/court-ordered-name-change`**
— re-verify `wa.birth-certificate.name`, `wa.birth-certificate.name.es`

- Record detail (current, both EN and ES): *"...A certified copy of the new birth
  certificate costs $25. The health department says these requests currently take about
  ten months to process."*
- Live source, today (both instances on the page): *"we currently have a **two (2) month**
  processing turnaround time"* / *"if your request has not been processed after **two (2)**
  months, please call us..."* (was: *"ten (10) month"* / *"ten (10) months"*).
- The $25 fee is unaffected — it does not appear anywhere in this page's diff.
- Also on this page (cosmetic, does not touch the record): a global nav-menu swap
  (`covid-19` topic link removed; `respiratory viruses` / `wildfire resources` added —
  site-wide taxonomy churn, not page content) and a phone-number reformat
  (`(360) 236-4300` → `360-236-4300`, same number).

Both of these need a human to open the live page, confirm the new text, and correct the
record (EN **and** ES — i18n parity gate) before re-baselining just these two URLs
through the reviewed procedure in `docs/OPERATIONS.md` ("The safe procedure"). Neither
should be re-baselined as-is: the corpus currently asserts something these two sources
no longer say.

### Substantive change on the page, but not touching what the record asserts (2)

**3. `https://www.illinoislegalaid.org/legal-information/updating-sex-and-gender-markers-identification`**
— re-verify `il.drivers-license.gender-marker`, `il.drivers-license.gender-marker.es`

- This FAQ page was **genuinely rewritten** — 64 word-level changes, including a real
  legal-deadline change elsewhere on the same page (an Illinois Human Rights Act
  discrimination-complaint filing window: *"within 300 days"* → *"within 2 years"*), an
  added ILGA "IL Pride Connect" hotline number, a restructured passport-policy history
  section, and a new FAQ ("do all sex and gender markers on identification have to
  match?").
- **None of it touches the paragraph `il.drivers-license.gender-marker` actually cites.**
  The record's specific claims — *"complete a Gender Designation Change form and bring
  it, with your current Illinois license or ID, to a Secretary of State facility,"* no
  medical-documentation requirement stated, no separate fee stated — were checked
  word-for-word against both the committed snapshot and the live fetch and are
  **byte-identical**. The rewritten sections are the surrounding civil-rights/passport/
  voting/TSA content on the same long page, which no corpus record currently cites.
- Recommendation: safe to re-baseline once a human confirms the above (a 30-second check,
  not a full read of the rewrite) — but confirm it themselves; this report is the input
  to that check, not a substitute for it.

**4. `https://eforms.state.gov/Forms/ds82_pdf.PDF`** (form registry, not a corpus record)
— re-verify `us-ds-82`, cited via `form_ref` by `us.passport.name`, `us.passport.name.es`

- This is a PDF, hashed as raw bytes (`binaryHash`), not HTML. **There is no committed
  text snapshot for forms** — `corpus/snapshots/` only covers corpus-record HTML sources
  — so unlike every other row in this table, the old version cannot be diffed against the
  new one. This is a real gap in what this triage can verify; noted rather than papered
  over.
- What could be checked: the current PDF was fetched and read (`pdftotext`). It is still
  clearly Form DS-82, "U.S. Passport Renewal Application for Eligible Individuals,"
  `OMB Control No. 1405-0020`, new `Expiration Date: 06/30/2028`. Its stated eligibility
  criteria (must submit the prior passport; name change by marriage or court order still
  qualifies; renew by mail) and its fee language ("no execution fee to use this form...
  visit travel.state.gov/passportfees for current fees") are consistent with what
  `us.passport.name` currently asserts. Nothing in the readable text contradicts the
  record.
- This pattern — an OMB expiration-date bump with an otherwise-unchanged form — is the
  single most common reason a government PDF's byte hash changes, and is consistent with
  what was found here. It is not proof of "no change" the way the HTML diffs above are;
  a human should still open both a copy of the new PDF and the eligibility text quoted
  above side by side before re-baselining.

### Cosmetic — reviewed, no record content affected (20)

Every row below was diffed word-for-word against its committed snapshot; the full excerpt
is available in the PR if a reviewer wants to double check a specific one. Grouped by
what changed:

**Page-generation / re-render timestamps only (word count unchanged or near-unchanged,
no wording touched):**
- `https://secure.ssa.gov/poms.nsf/lnx/0110212200` (`us.ssa-card.gender-marker`, `.es`) —
  only the page's "effective dates / batch run / rev" footer timestamps moved
  (`06/29/2026` → `06/05/2026`/`07/31/2026`). The actual content-revision identifier,
  **POMS Transmittal Number `TN 36 (06-26)`, is unchanged** in both versions — the
  strongest available signal that the underlying policy text (which this record's
  `needs_reverification` status already flags for other reasons) was not itself revised.
- `https://guides.sll.texas.gov/name-changes/gender-marker-and-name-change`
  (`tx.drivers-license.gender-marker`, `tx.birth-certificate.gender-marker.law`, `.es`) —
  only the LibGuides "Last Updated" date/time stamp moved (`Jul 10, 2026 2:05 pm` →
  `Sep 1, 2026 1:52 pm`); word count is identical before and after.
- `https://www.illinoislegalaid.org/legal-information/changing-your-name`
  (`il.court-order.name`, `.es`) — the page's own "as-of" date stamp moved
  (`07/13/2026` → `09/05/2026`); the only wording change is in an unrelated "changing a
  child's name" related-link card. The adult name-change procedure text this record
  cites — circuit clerk filing, Motion to Impound, the Jan-2024/Mar-2025 law-update
  language, "no longer lists a newspaper publication step" — is byte-identical.

**Encoding/typography artifacts (same visible character, different underlying bytes —
not a wording change):**
- `https://selfhelp.courts.ca.gov/name-change` (`ca.court-order.name`) — `⚠️` vs `⚠ ️`
  (an inserted space between the emoji and its variation selector).
- `https://selfhelp.courts.ca.gov/gender-recognition` (`ca.court-order.gender-marker`) —
  same emoji artifact.
- `https://selfhelp.courts.ca.gov/gender-recognition/update-gender-marker-ID-documents`
  (`ca.birth-certificate.gender-marker.no-court-order`, `.es`) — same artifact, `↗️` vs `↗ ️`.
- `https://selfhelp.courts.ca.gov/es/cambie-su-nombre-en-california`
  (`ca.court-order.name.es`) — same emoji artifact (twice on the page).
- `https://selfhelp.courts.ca.gov/es/reconocimiento-de-genero`
  (`ca.court-order.gender-marker.es`) — same emoji artifact.
- `https://dmv.ny.gov/driver-license/change-information-on-dmv-photo-documents`
  (`ny.drivers-license.gender-marker`, `ny.drivers-license.name`, `.es`) — `dmv's` vs
  `dmv s` (an apostrophe/quote-mark encoding difference).
  *(Note for whoever picks up the workflow fix: this repeated pattern — the same visible
  glyph hashing differently only on California's `selfhelp.courts.ca.gov` and this NY DMV
  page — suggests `normalize()`'s entity/whitespace handling is sensitive to how a given
  CMS encodes typographic characters. It produces true positives here — none of these
  changed anything a reader would see — but it is worth a follow-up look at whether
  `normalize()` should collapse variation selectors and smart-quote encodings, since a
  false "drift" alarm is exactly the kind of noise that makes a real one easier to miss.
  Not fixed in this PR — it's a normalize() behavior change, not a triage finding, and
  changing shared hashing logic belongs in its own reviewed change.)*

**Site chrome (rotating alert banners, nav-menu taxonomy, footer year) — the page's own
subject-matter content is untouched:**
- `https://dol.wa.gov/.../change-your-name-or-address-your-driver-license`
  (`wa.drivers-license.name`, `.es`) — a phishing-scam banner was replaced by a
  Washington-wildfire relief-resources banner, and a since-passed "portal unavailable
  July 14" outage notice was removed.
- `https://dol.wa.gov/.../change-your-gender-designation`
  (`wa.drivers-license.gender-marker`, `.es`) — identical banner rotation as above (same
  site header, same page family).
- `https://doh.wa.gov/.../sex-designation-change-birth-certificate`
  (`wa.birth-certificate.gender-marker`, `.es`) — a global nav-menu swap (`covid-19` out,
  `respiratory viruses` / `wildfire resources` in); the sex-designation procedure text
  itself is untouched.
- `https://mva.maryland.gov/about-mva/Pages/changing-gender.aspx`
  (`md.drivers-license.name`, `md.drivers-license.gender-marker`, `.es`) — a rotating
  "customer alert" banner about a VEIP kiosk outage changed from one branch location to
  another (Frederick → Bel Air); routine site-status churn.
- `https://dph.illinois.gov/topics-services/birth-death-other-records/birth-records/gender-reassignment.html`
  (`il.birth-certificate.gender-marker`, `il.birth-certificate.name`, `.es`) — a single
  inserted `2027` in the site footer (copyright-year rollover).
- `https://www.dshs.texas.gov/vital-statistics/requirements-requesting-changing-vital-records/supporting-documentation-record-changes`
  (`tx.birth-certificate.gender-marker`, `tx.birth-certificate.name`, `.es`) — a
  site-wide nav-menu item renamed (`environmental hazards programs` →
  `environmental health section`) on a completely unrelated part of the global menu; the
  supporting-documentation content itself is untouched.
- `https://www.courts.wa.gov/forms/?fa=forms.static&staticID=13` — see the ⚠️ entry
  above; its cosmetic footer-version-marker change (`n2`→`n1`) is noted there, not
  repeated here.

**Additive navigation / related-content links (nothing existing was altered or removed):**
- `https://selfhelp.courts.ca.gov/jcc-form/NC-200` (`ca.court-order.name.form`, `.es`) —
  added links to get the same NC-200 form in Chinese, Korean, and Spanish; the form's own
  "Effective: July 1, 2026" line and instructions are unchanged.
- `https://texaslawhelp.org/guide/i-want-to-change-my-name` (`tx.court-order.name`, `.es`)
  — one new "related guide" teaser card added, about fee waivers for people who can't
  afford court costs. Purely additive; the guide's own text is unchanged, and the new
  card if anything reinforces the record's existing `fee_waiver: true`.
- `https://www.dps.texas.gov/section/driver-license/how-change-information-your-driver-license-or-id-card`
  (`tx.drivers-license.name`, `.es`) — one new "Contact Customer Service" nav link added.

**Label wording only, dollar amounts unchanged:**
- `https://www.dshs.texas.gov/vital-statistics/costs-fees` (`tx.birth-certificate.fees`,
  `.es`) — same unrelated nav-menu rename as above, plus a fee-table label reworded
  from *"Certified long/short form"* to *"Certified copy - long/short form."* Every dollar
  figure on the page was individually checked against the live fetch and is unchanged:
  $15.00 (correction), $22.00 (new certified copy — twice), $25.00, $60.00, $10.00,
  $20.00, $3.00, $62.00. The record's own $15 / $22 figures match on both sides.

**Sidebar/library boilerplate (the actual cited legal text is untouched):**
- `https://law.lis.virginia.gov/vacode/title32.1/chapter7/section32.1-269/`
  (`va.birth-certificate.name`, `.es`) — an added "Virginia Law Library" resources blurb
  in the page chrome; the statute text itself (§32.1-269) has zero diff.

## About the coverage-gap count (out of scope for this triage, flagged so it isn't lost)

`make source-watch` currently reports **82** `missingBaseline`/`staleBaseline` coverage
issues, not the 2 named in #150 (`nycourts.gov`, `ssa.gov/forms/ss-5.pdf`). Those two are
still there — plus 80 more. The other 80 are sources cited by the M6 jurisdiction-expansion
PRs merged since the issue was filed (Alabama through Wyoming, roughly), whose new corpus
records were never followed by a `make source-baseline` pass for their newly-cited URLs.
Coverage gaps and drift are different problems: a coverage gap means "no baseline exists
to compare against," not "the source moved." **This is not drift, and re-baselining a
brand-new source is not the prohibited "clear it and move on" action** the hard boundary
on this task is about — but establishing 80 new baselines is a much larger job than this
triage, it deserves the same discipline (a human reading the page before the baseline is
recorded, not a blanket `--update`), and it is out of this PR's scope. It is called out
here so it is not mistaken for something this document resolved.

## Deliverable 2 — why `content-watch` has been failing since 2026-08-17

**The cause is not in this repository, and no workflow-file change fixes it.**

`gh run view` on the three failing runs named in #150 (33365893020, 32697664896,
32005219967) shows an identical annotation on all three, and the job never starts —
each run completes in 1–5 seconds with **zero steps executed**:

> The job was not started because recent account payments have failed or your spending
> limit needs to be increased. Please check the 'Billing & plans' section in your
> settings.

This is a GitHub Actions **billing/spending-limit block at the account level**, raised
before `actions/checkout` or any step in `content-watch.yml` runs. It is not caused by
`make source-watch`, `make link-check`, `make verify`, the fast-uri advisory #150
speculates about, or anything else in the repository — none of that code ever executes
when this happens. Two facts confirm the block is scheduled-trigger-specific rather than
account-wide-and-permanent:

1. **Push/PR-triggered workflows on this same repo are unaffected.** `ci`, `standards`,
   and `codeql` have run successfully dozens of times today and throughout the failure
   window (`gh run list` shows continuous green `push`/`pull_request` runs).
2. **`content-watch` itself has succeeded on `schedule` triggers during the same window**
   — 2026-08-03 (30804298323) and 2026-08-10 (31368643336) both completed normally (48s
   and 54s, all four `make` steps ran, `steps.*.outcome` evaluated correctly) — bracketed
   by failures of the identical kind going back to at least 2026-06-15. This is an
   intermittent, recurring block on scheduled runs specifically, not a one-time outage
   and not something that was ever going to be fixed by editing YAML.

**This also corrects, not just supplements, #150's stated theory.** The issue proposes
the failures were masked because "the entire CI surface was red at the same time" from
the fast-uri advisory. That's not what happened on the three named runs: the job was
never *started*, so it never got the chance to run `make source-watch`/`link-check` and
fail *from those* — there is no execution to be masked. The failures were visible the
whole time as a plain red ✗ in the Actions tab; what made them easy to overlook was that
they carry no useful summary in a run list (a bare "content-watch" job name, no log to
open) and recurred alongside plenty of other red CI for unrelated reasons, not that
`make verify` was drowning them out.

**What a human must do** (no code or workflow change can do this): sign in to
https://github.com/settings/billing (or the relevant organization's billing settings) and
resolve the failed payment method and/or raise the GitHub Actions spending limit for this
account. Once scheduled jobs can start again, `content-watch.yml` itself needs no fix —
the two runs that did start during the failure window completed correctly, including the
"open an issue when anything needs a human" step.

**Not changed in this PR:** `content-watch.yml`. There is no in-repo defect to fix, and
editing the workflow to "look like a fix" for an account-billing block would be
theater — it would not make the job start. If it would help make a future recurrence of
this exact failure mode easier to spot at a glance in a run list, that is a legitimate
follow-up (e.g., a separate lightweight non-scheduled canary that pages a human when the
scheduled run's `gh api` history shows a `startup_failure`-shaped gap), but it does not
fix the actual cause and is left for a human to decide is worth the added surface.

## Next steps for a human

1. Fix the GitHub Actions billing/spending-limit issue (above) so the weekly signal is
   trustworthy again.
2. Re-verify `wa.court-order.name` / `.es` (venue rule) and `wa.birth-certificate.name` /
   `.es` (processing time) against their live sources, correct the records in EN and ES,
   then re-baseline **only those two URLs** through the reviewed procedure in
   `docs/OPERATIONS.md` ("The safe procedure — re-baseline only what you actually
   re-read"), followed by `make source-snapshot` + `make fidelity` for those URLs.
3. Spot-check the two "substantive but not affecting our claims" rows above
   (`il.drivers-license.gender-marker`'s cited paragraph; the DS-82 PDF's eligibility
   text) against this document's quoted evidence, then re-baseline.
4. Re-baseline the 20 cosmetic rows once a human has confirmed the excerpts above — this
   document is the reviewed diff `docs/OPERATIONS.md` asks for, not a replacement for a
   human looking at it.
5. Separately, and on its own timeline, work through the 82 baseline-coverage gaps
   (`missingBaseline`) left by the M6 jurisdiction-expansion PRs — see "About the
   coverage-gap count" above. Do not blanket `make source-baseline`; each new source
   still needs a human to read it once before its first baseline is recorded.

Do not run `make source-baseline` or `make source-snapshot` over this list as a batch.
Each URL above needs an individual, reviewed re-baseline once a human has acted on it —
that is the entire point of the mechanism this repo is built around.
