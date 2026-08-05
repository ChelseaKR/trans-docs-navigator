# User Research — Synthetic Stakeholder Panel & Simulated Interviews

> [!WARNING]
> **These personas and interviews are SYNTHETIC.** They were generated as a
> structured brainstorming device — *not* conducted with real people. No real user,
> attorney, auditor, or funder said any of this. The "quotes" are illustrative
> hypotheses, not data. This panel is a way to pressure-test the product from many
> angles at once; it is **not evidence of demand** and does **not** substitute for
> real discovery with the trans community and the legal-aid orgs who serve it. Treat
> every quote as *a hypothesis to validate, not a finding*. Consistent with how this
> project labels its synthetic datasets (the eval gold set is openly marked
> co-authored; corpus verifiers are openly marked placeholders — see
> [`docs/audits/data-card.md`](./audits/data-card.md)).
>
> **Last assembled: 2026-06-30.**

This document complements the earlier end-user *satisfaction* run
([`docs/research/USER-RESEARCH-2026-06-17.md`](./research/USER-RESEARCH-2026-06-17.md),
18 end-user personas scored against the live preview). That run answered "does the
product satisfy the people who use it?" This one widens the cast to **every
stakeholder who has to use, verify, govern, audit, serve, or operate** the product,
and grounds the findings in external legal/equity evidence (the Method section).
Where the two agree, that is triangulation; where this one goes further, it is the
stakeholder lens the first run did not have.

## Why do this at all
Even simulated, role-playing the full cast around a high-stakes, hostile-jurisdiction
legal-info tool surfaces gaps a single author misses, and forces the question "who is
each guardrail *for*?" The synthesis is tagged so it can't become a wishlist:
**[corroborates …]** when a finding matches the existing roadmap/improvement plans,
**[NET-NEW]** when it doesn't. The roadmap lives in
[`RESEARCH-ROADMAP.md`](./RESEARCH-ROADMAP.md).

## How to read a persona
Each card compresses the interview to five lines: **Goal · Values today** (grounded
in features that actually exist in this repo) **· Gets stuck · Wants next · Adopts /
walks** (the one thing that flips the decision).

---

## Method

- **Sampling frame.** The product's real relationship-graph, not just its end users:
  (1) **people changing their own name/gender** across the full range of situations
  named in the threat model — supportive vs. hostile state, name-only / marker-only /
  both, English / Spanish-dominant / Spanish-only / other-language, minor, undocumented,
  unhoused / reentry, screen-reader, and privacy-as-survival; (2) the people who must
  **verify and govern** the content (counsel, named-human record verifiers, funders);
  (3) those who **assure and audit** it independently (accessibility, security/privacy,
  fact-checker, and an adversary the privacy model must defeat); (4) those who **serve
  and advocate** for the user base (legal-aid attorneys, advocacy orgs, community
  navigators); and (5) those who **operate and find** it (owner/maintainer, SEO owner).
- **Protocol.** For each persona: a goal, a walkthrough of the surfaces they'd actually
  touch in the current build, what worked, where they stalled, and an open "what would
  make this a yes?" prompt. Frictions → **R**emediations; wishes → **E**xpansions.
- **Effort scale (used in the roadmap).** S ≈ an afternoon · M ≈ a day or two · L ≈ a
  week+. **Priority:** P0 launch-blocking · P1 pre-launch · P2 post-launch · P3
  opportunistic — the same scale the repo uses.

### Research basis (external evidence, with citations)
*Accessed 2026-06-30. High-stakes legal/policy claims are cross-checked against ≥2
reputable sources. The federal landscape is **volatile and litigated — verify before
relying**; this is exactly why the product treats freshness as a safety property.*

1. **The federal layer turned hostile during this product's build, and is in active
   litigation.** Executive Order 14168 (Jan 20, 2025) directs the federal government to
   recognize only "male" or "female" as an unchangeable sex and to conform federal IDs
   accordingly ([EO 14168 overview](https://en.wikipedia.org/wiki/Executive_Order_14168);
   [Act for Public Health FAQ](https://actforpublichealth.org/executive-orders-affecting-lgbtq-communities-faqs/)).
   Downstream: the **State Department stopped issuing "X" markers and self-attested
   passports**, issuing sex-at-birth designations; after a 2025 preliminary injunction
   (*Orr v. Trump*), the **U.S. Supreme Court in November 2025 allowed the policy to take
   effect while litigation continues**
   ([Human Rights Watch, 2025-11-10](https://www.hrw.org/news/2025/11/10/us-supreme-court-allows-discriminatory-passport-rule);
   [State Dept "Sex Markers in Passports"](https://travel.state.gov/content/travel/en/passports/passport-help/sex-marker.html);
   [Lambda Legal trans ID FAQ](https://lambdalegal.org/trans-id-guidance-faq/);
   [A4TE Know Your Rights: Passports](https://transequality.org/documents/know-your-rights-passports)).
   The **SSA stopped processing sex-marker changes** (guidance Jan 31, 2025; in effect by
   ~March 1, 2025) while still processing **name** changes
   ([Metro Weekly, 2025-02](https://www.metroweekly.com/2025/02/social-security-no-longer-allows-changes-to-sex-identification/);
   [A4TE Know Your Rights: Social Security](https://transequality.org/documents/know-your-rights-social-security);
   [WashingtonLawHelp](https://www.washingtonlawhelp.org/en/can-i-change-sex-my-social-security-record)).
   → *Directly validates the product's "stale law is broken law" gate and its
   `needs_reverification` handling of federal SSA/passport marker steps — and raises a
   strategy question (see roadmap): the federal rule is now hostile-but-fairly-stable, not
   merely "volatile," and users need a maintained explainer, not just silence.*

2. **The state layer is a genuine, shifting patchwork — the core product thesis.**
   Movement Advancement Project maintains the authoritative state-by-state tracker of ID
   and name-change laws, *updated daily*
   ([MAP Identity Document Laws & Policies](https://www.lgbtmap.org/equality-maps/identity_documents/)).
   Roughly **half of states impose a newspaper-publication requirement** for name changes
   (commonly cited as ~24 states), with publication costs reported from **$40 to $250**,
   and several states (e.g., CA, NY) waive publication for gender-related or
   safety-based filings
   ([TotalLegal publication-waiver overview](https://www.totallegal.com/name-change-publication-waivers);
   [MAP name-change citations PDF](https://www.mapresearch.org/img/maps/citations-id-name-change.pdf)).
   → *Validates the corpus model (per jurisdiction × document × change-type), the
   publication-waiver content already in the IL/NY records, and the freshness SLA.*

3. **Cost and process are real equity barriers.** Court filing fees vary widely (e.g.,
   California's name-change fee is commonly ~$435–$480; certified copies ~$40 each),
   fee waivers exist but **often do not cover publication**, and publication
   "disproportionately impacts individuals with low incomes … and individuals who are
   transgender"
   ([Sacramento Superior Court name/gender change](https://www.saccourt.ca.gov/civil/self-help-services/name-gender-change.aspx);
   [A4TE California Identity Documents](https://transequality.org/documents/california-identity-documents);
   [TotalLegal](https://www.totallegal.com/name-change-publication-waivers)).
   → *Validates surfacing fee-waiver forms and realistic costs, and the panel's repeated
   "fee waiver is make-or-break" finding.*

4. **The need is large and under-met.** The **2022 U.S. Trans Survey** (Advocates for
   Trans Equality, **92,329 respondents** — the largest survey of trans people in the
   U.S.) reports that **48% of respondents with at least one ID said *none* of their IDs
   listed the name they wanted**, and **22% reported being verbally harassed, denied
   service, asked to leave, or assaulted when they showed an ID that didn't match their
   presentation**
   ([A4TE 2022 USTS](https://transequality.org/us-trans-survey);
   [Early Insights report PDF](https://transequality.org/sites/default/files/2024-02/2022%20USTS%20Early%20Insights%20Report_FINAL.pdf);
   [CNN coverage, 2024-02-07](https://www.cnn.com/2024/02/07/us/us-transgender-2022-survey-reaj/index.html)).
   *(The primary PDF returned 403 at access time; the two figures are corroborated across
   independent summaries and CNN — verify exact wording before quoting publicly.)*
   → *Establishes that mismatched IDs are common and carry physical-safety consequences —
   correctness here is a safety property, as the README claims.*

5. **The threat model is not hypothetical.** Government purchase of commercial
   data-broker profiles is routine; **DHS Intelligence & Analysis removed LGBTQ identity
   from its surveillance protections in March 2025**; gender-affirming-care bans are in
   effect in **~24 states**; and trans/gender-diverse people face elevated doxxing risk
   ([TechPolicy.Press, weaponization of personal data](https://www.techpolicy.press/gender-politics-and-the-weaponization-of-personal-data/);
   [LGBTQ Nation, data privacy in Trump 2.0](https://www.lgbtqnation.com/2025/05/data-privacy-in-2-0-and-lgbtq-rights-what-you-need-to-know/);
   [EPIC, data-broker harms](https://epic.org/documents/data-broker-harms-to-public-officials/)).
   → *Validates "privacy is a safety property": zero server-side PII, ephemeral default,
   client-side form-fill, no-tracker stance, strict referrer policy.*

6. **Comparable resources exist — but none combine personalization, privacy-by-design,
   bilingual delivery, and a freshness contract.** The closest is **A4TE's ID Documents
   Center**, free state-by-state guides for all 50 states
   ([transequality.org/documents](https://transequality.org/documents)); **MAP's** policy
   maps ([above](https://www.lgbtmap.org/equality-maps/identity_documents/)); **Lambda
   Legal's** know-your-rights FAQ
   ([trans ID FAQ](https://lambdalegal.org/trans-id-guidance-faq/)); and **TLDEF's Name
   Change Project**, free *pro bono* legal name changes — but income-restricted and
   limited to ~7 metros, having served 3,000+ people in a decade
   ([TLDEF Name Change Project via Transanta](https://www.transanta.com/resources/tldef-name-change-project)).
   These are static reference text or a capacity-limited service; **none produce a
   personalized, ordered, cited checklist that stores nothing and ships EN/ES with a
   last-checked date.** → *This is the product's differentiation — and the gap personas
   flag (5 hand-built states, national-only referrals) is where it's thinnest.*

7. **Plain-language and language-justice are recognized access-to-justice standards.**
   The ABA's civil-legal-aid standards require promoting language justice (Standards 2.3
   and 5.7); plain language is "the first step to access to justice" and is *cheaper to
   translate* and more usable for limited-English-proficiency readers
   ([ABA Standard 5.7](https://www.americanbar.org/groups/legal_aid_indigent_defense/resource_center_for_access_to_justice/standards-and-policy/updated-standards-for-the-provision-of-civil-legal-aid/standard-5-7-on-implementing-language-justice/);
   [Mass Legal Services, "Making Legal Information Readable"](https://www.masslegalservices.org/content/making-legal-information-readable-more-plain-language);
   [LSC Language Access](https://www.lsc.gov/i-am-grantee/model-practices-innovations/language-access-cultural-sensitivity)).
   Accessibility floor: **WCAG 2.2 AA** ([W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/)).
   → *Validates the readability gate, the EN/ES parity gate, and the WCAG 2.2 AA target —
   and the panel's pressure to add a literacy tier and a third language.*

---

## Persona roster

| # | Persona | Group | Primary goal | Top friction |
|---|---|---|---|---|
| U1 | **Maya** — binary trans woman, Oakland CA (supportive) | Use | Name + marker on every doc; needs a fee waiver | Fee-waiver form not linked; federal marker steps degraded |
| U2 | **River** — nonbinary, Tallahassee FL (hostile, uncovered) | Use | Get an X marker; covered state absent | Only federal + referrals; X-availability never confirmed |
| U3 | **Sofía** — Spanish-monolingual trans woman, LA CA | Use | Do the whole thing in Spanish | ES parity thinner than EN for some states/steps |
| U4 | **Daniel** — trans man, Houston TX, Spanish-dominant | Use | Name + marker in a hostile state | TX marker degraded; TX has no Spanish state records |
| U5 | **Alex (17) + parent** — trans youth, Illinois | Use | Start a minor name change | Minor/parental-consent path not modeled |
| U6 | **Jordan** — nonbinary, blind (VoiceOver/NVDA), NY | Use | Complete intake→checklist by screen reader | Manual SR walkthrough still PENDING (unsigned) |
| U7 | **Priya** — undocumented trans woman, NYC, Arabic/Spanish | Use | Safe name change without immigration exposure | No Arabic; situational safety Q's unanswerable |
| U8 | **Sam** — recently incarcerated, no stable address, NY | Use | Reentry name change, ordered | No-fixed-address / reentry specifics not covered |
| U9 | **Cass** — nonbinary DV survivor, California | Use | Change name without becoming public record | Confidential-filing handled only as a generic note |
| U10 | **Robin** — trans woman, just moved TX→WA | Use | Which state's rules apply mid-process? | Interstate-move handling not modeled |
| V1 | **Counsel** — pro bono UPL reviewer | Verify & Govern | Sign off that this isn't legal advice | Disclaimers drafted but "pending review" |
| V2 | **Dr. Reyes** — trans-law legal-aid attorney (record verifier) | Verify & Govern | Put her name on verified records | Verifiers are placeholders; gold set co-authored |
| V3 | **Lena** — LGBTQ / tech-justice funder | Verify & Govern | Fund something durable and safe | No funding/sustainability plan for reverification |
| A1 | **Grace** — accessibility specialist (manual auditor) | Assure & Audit | Confirm the AA claim with a real pass | Mechanical gate green; manual walkthrough unsigned |
| A2 | **Iris** — security & privacy researcher | Assure & Audit | Trust the hostile-jurisdiction threat model | DPIA/STRIDE unsigned; CSP still allows inline |
| A3 | **Nadia** — fact-checker / watchdog journalist | Assure & Audit | Verify "cited, current" is true | Placeholder verifiers; 404'd citations in seed corpus |
| A4 | **"The Investigator"** — hostile actor (adversary) | Assure & Audit | Identify/track a trans user via the tool | (The model must defeat this) |
| S1 | **Marcus** — pro bono name-change attorney (TLDEF-style) | Serve & Advocate | Hand clients a tool he can stand behind | Unverified content; only national referrals |
| S2 | **Bex** — advocacy-org content lead | Serve & Advocate | Embed/link it from the org's site | 5 states; no co-brand/partner surface |
| S3 | **Tomás** — community navigator, low-literacy clients | Serve & Advocate | Walk a client through it in person | Reading level + legalese; no read-aloud |
| O1 | **Chelsea** — owner / maintainer | Operate | Keep it correct without becoming a law firm | Quarterly reverification is unfunded human work |
| O2 | **Sky** — SEO / findability owner | Operate | Be found at the moment of search, safely | Not yet on a real domain; index contract tension |

---

## Group 1 — USE (people changing their own name and gender marker)

### U1 — Maya, binary trans woman, Oakland CA (supportive state; low savings; phone-only)
- **Goal:** name + gender marker on every document, on a tight budget.
- **Values today:** CA is hand-built, so she gets a real ordered checklist for **both** name and marker; the court step states **no physician's statement is required** and a **fee waiver (Form FW-001)** exists (`corpus/jurisdictions/california.json`); private mode says "nothing saved, closing this tab erases everything" (`src/i18n/en.ts`), which makes her willing to use the copy helper on her phone.
- **Gets stuck:** the **federal marker steps (SSA, passport) show `needs reverification`** — true to reality post-EO-14168 ([HRW](https://www.hrw.org/news/2025/11/10/us-supreme-court-allows-discriminatory-passport-rule)) — so half her goal is non-actionable; the fee waiver is *named* but the FW-001 form isn't *linked*.
- **Wants next:** a direct FW-001 link with one line of "do you qualify" (income / public-benefits shortcut); a worst-case total cost instead of "varies."
- **Adopts / walks:** **Adopts** as her starting map. **Walks** to a forum if the fee-waiver trail keeps going cold at the exact step her affordability depends on.

### U2 — River, nonbinary, Tallahassee FL (hostile, uncovered state)
- **Goal:** get an "X" marker; Florida is not one of the five hand-built states.
- **Values today:** unlike a dead end, the build now lets **any state be selected** and degrades to **federal steps + named national referrals** (`src/states.ts`, `src/referrals.ts`) — A4TE, Transgender Law Center, NCLR, Trans Lifeline — instead of a wall; it refuses to invent Florida steps rather than hallucinate.
- **Gets stuck:** the referral block is **national-only**; whether an **X marker** is even available is never confirmed for their situation; the federal X path is now closed ([State Dept](https://travel.state.gov/content/travel/en/passports/passport-help/sex-marker.html)) and that reality isn't explained, just degraded.
- **Wants next:** a clear "here's what's possible in Florida today and who locally to ask"; explicit per-state X-marker availability.
- **Adopts / walks:** **Adopts** the referral hand-off as better than nothing. **Walks** if "we don't cover your state" still feels like being turned away at the door.

### U3 — Sofía, Spanish-monolingual trans woman, Los Angeles CA
- **Goal:** complete the whole process in Spanish.
- **Values today:** Spanish is **real and parity-enforced** (compiler + e2e test; `src/i18n/es.ts`), the answers are localized (not just chrome), and the **fee-waiver help string exists in Spanish** ("en California es el Formulario FW-001"); the disclosure and privacy promise render in Spanish too.
- **Gets stuck:** where ES corpus coverage is thinner than EN (TX/WA are English-only state records — [`data-card.md`](./audits/data-card.md)), a page honestly says so, which for a Spanish-only user reads as "the real content is in English."
- **Wants next:** full ES parity for every launched state; native-Spanish guide pages that rank for Spanish queries.
- **Adopts / walks:** **Adopts** for California. **Walks** if a shared link silently renders English at the moment she needs Spanish.

### U4 — Daniel, trans man, Houston TX, Spanish-dominant (reads English with difficulty)
- **Goal:** name + gender marker in a hostile state, in Spanish.
- **Values today:** the **TX DMV sex-marker is deliberately `needs_reverification`** (volatile/contested — `corpus/jurisdictions/texas.json`) and the tool says so honestly rather than guessing; privacy messaging in Spanish lowers his fear of using a Texas tool.
- **Gets stuck:** the marker half is non-actionable in TX, and **TX has no Spanish state records**, so the Spanish view is thin; the safest-action pointer helps but he still doesn't have a *Houston* org to call.
- **Wants next:** Spanish parity for Texas; a **Texas/Houston-specific** referral, ideally Spanish-speaking, not only national orgs.
- **Adopts / walks:** **Adopts** the honesty and privacy. **Walks** if "honest but powerless" leaves him with no local human.

### U5 — Alex (17) and a supportive parent, Illinois
- **Goal:** start a legal name change for a minor.
- **Values today:** IL is hand-built; the court step correctly flags that **newspaper publication can be waived when it could endanger the petitioner** (`corpus/jurisdictions/illinois.json`), and the **sensitive-situations note** explicitly says "if you're under 18 … the steps can differ in ways this tool doesn't cover" and routes to help orgs (`src/i18n/en.ts`).
- **Gets stuck:** there's **no minor/parental-consent flow** — the checklist speaks to an adult petitioner; the generic note is harm-reduction, not guidance.
- **Wants next:** a minor branch (who files, parental-consent vs. one-parent, guardian ad litem where relevant) with citations.
- **Adopts / walks:** **Adopts** the honest redirect (better than wrong adult steps). **Walks** if "this tool doesn't cover you" is the whole answer for a common, well-defined scenario.

### U6 — Jordan, nonbinary, blind daily VoiceOver/NVDA user, New York
- **Goal:** complete intake → checklist → form links entirely by screen reader.
- **Values today:** semantic server-rendered HTML that **works with JS off**, one `<h1>` per page, mechanical a11y gated across templates, contrast assertions, reduced-motion respected; the copy helper exposes an `aria-live` confirmation.
- **Gets stuck:** the **manual SR / keyboard / 200%-zoom / 320px walkthrough is review-gated and still PENDING/unsigned** ([`STATUS.md`](./STATUS.md)) — so they'd be the untested first screen-reader user on a legal task.
- **Wants next:** the signed manual walkthrough published as `docs/audits/accessibility-YYYY-MM-DD.md`; an explicit polite-announcement audit of degraded-step flags.
- **Adopts / walks:** **Adopts** if the manual pass is signed. **Walks** the moment a focus trap or unannounced flag breaks a filing flow.

### U7 — Priya, undocumented trans woman, NYC, speaks Arabic and Spanish, limited English
- **Goal:** a safe name change without exposing herself to immigration enforcement.
- **Values today:** **zero server-side PII / nothing saved** is exactly her threshold for entering a deadname into the copy helper; the NY record notes courts can **seal the record / waive publication for safety**; the sensitive-situations note names "undocumented" and routes to Transgender Law Center / TransLatin@ Coalition (Spanish).
- **Gets stuck:** the one question that gates everything — *is it safe for an undocumented person to file, and what does contacting SSA/State Dept expose?* — is unanswerable by a grounded tool, and **there's no Arabic**.
- **Wants next:** an explicit "what each federal agency sees" safety note before those steps; an immigrant-legal referral surfaced *before* the federal steps, not only at the bottom; Arabic.
- **Adopts / walks:** **Adopts** the privacy design and the safety routing. **Walks** to a human immigration lawyer for the load-bearing question (correctly — and the tool should say so).

### U8 — Sam, recently released from incarceration, no stable mailing address, New York
- **Goal:** a reentry name change, in the right order.
- **Values today:** the **ordered, prerequisite-aware checklist** (court order first) and the "nothing saved" posture (more respect than he usually gets); the sensitive-situations note names "recently incarcerated" and "without a stable address."
- **Gets stuck:** court/SSA correspondence goes *somewhere* — there's **no no-fixed-address guidance**, and reentry-specific wrinkles (records, fees) aren't modeled.
- **Wants next:** a "where does mail go / can I use a clinic or shelter address" note; reentry-aware fee-waiver framing.
- **Adopts / walks:** **Adopts** the ordering and candor. **Walks** if the practical address problem — his actual blocker — is never acknowledged.

### U9 — Cass, nonbinary domestic-violence survivor, California
- **Goal:** change their name without it becoming a public record an abuser could find.
- **Values today:** the **public-record / confidential-filing warning on the court step** ("some courts allow a confidential or sealed filing — ask before you file," `src/i18n/en.ts`) and CA's safety-based publication exemption ([A4TE CA](https://transequality.org/documents/california-identity-documents)); privacy-by-design means the *tool* itself stores nothing about them.
- **Gets stuck:** the warning is a **generic note**, not a confidential-filing *flow* (which form, which county, address-confidentiality programs like Safe at Home).
- **Wants next:** a survivor branch: confidential/sealed petition steps + address-confidentiality program links, cited.
- **Adopts / walks:** **Adopts** because the tool protects browser data *and* warns about the public-record trap. **Walks** if "ask the court" is the entire safety plan for the highest-stakes user.

### U10 — Robin, trans woman who just moved from Texas to Washington
- **Goal:** figure out which state's rules apply now, mid-process.
- **Values today:** both TX and WA are hand-built, so she can compare; WA's record notes courts can **seal the name-change record** for safety (`corpus/jurisdictions/washington.json`); privacy matters because she was recently in a hostile state.
- **Gets stuck:** **interstate moves aren't modeled** — nothing reconciles "started in TX, finishing in WA," residency/venue, or which prior steps still count.
- **Wants next:** an interstate-move note (residency/venue basics, what transfers); recognition of partially-completed processes.
- **Adopts / walks:** **Adopts** per-state. **Walks** if she has to mentally diff two checklists herself.

---

## Group 2 — VERIFY & GOVERN (decide, fund, sign, own the legal risk)

### V1 — Counsel, pro bono UPL reviewer
- **Goal:** confirm the product is *information, not legal advice*, and won't incur liability.
- **Values today:** the **persistent "information, not legal advice" disclosure on every page in both languages**, the disclosure CI gate, the absence of individualized-conclusion templates, and committed Terms/Privacy/Accessibility pages (`src/legal.ts`).
- **Gets stuck:** the legal text is drafted but carries **"pending review"** caveats; counsel sign-off is an explicit OPEN gate ([`STATUS.md`](./STATUS.md)).
- **Wants next:** finalized liability/governing-law language; a one-page "claims the project may / may not make"; confirmation that degraded-step "safest action today" copy doesn't drift into advice.
- **Adopts / walks:** **Signs** once the disclosure is unmissable on *every* path and the conclusions stay categorical. **Blocks launch** if any answer reads as applying law to a person's facts.

### V2 — Dr. Reyes, trans-law legal-aid attorney (a potential named record verifier)
- **Goal:** verify records against primary sources and put her name on them.
- **Values today:** each `CorpusRecord` already carries `source = {url, title, last_verified, verifier}`; the **verifier roster (`corpus/VERIFIERS.json`) and placeholder-enforcement gate** mean a fake verifier can't be `launch_cleared`; the "no claim without a citation" gate matches how she works.
- **Gets stuck:** every verifier is the placeholder **"Pilot Seed Reviewer"**, the **gold set is co-authored with the corpus** (so accuracy is self-consistent, not independent), and a first link-check found **14 of 24 seed citations 404** ([`PRODUCTIONIZATION-PLAN.md`](./PRODUCTIONIZATION-PLAN.md)).
- **Wants next:** a per-jurisdiction verification workflow she can actually run (fetch/snapshot the source, sign a dated pass); an **independently authored** gold set.
- **Adopts / walks:** **Verifies** if the workflow respects her time and credits her. **Walks** if she's asked to rubber-stamp seed data as authoritative.

### V3 — Lena, LGBTQ / tech-justice funder
- **Goal:** fund something durable, safe, and not a liability.
- **Values today:** the committed audit artifacts (DPIA, data-card, model-card, residual-risk, eval-report), the merge-blocking guardrails, the **AGPL license + portable structured corpus** ("if it winds down, the verified corpus remains a public asset," ROADMAP §11), and the explicit honesty about what's *not* signed.
- **Gets stuck:** the real recurring cost — **quarterly per-jurisdiction reverification by humans** — has **no funding/maintenance plan** ([`IMPROVEMENT-PLAN-2.md`](./IMPROVEMENT-PLAN-2.md) E1); coverage is 5 states.
- **Wants next:** a costed sustainability plan (who reverifies, how often, what it costs per state); a coverage-expansion plan gated on verification; impact metrics that don't require tracking users.
- **Adopts / walks:** **Funds** a credible reverification engine and partner-review cadence. **Walks** from a demo that can't say who keeps it correct in year two.

---

## Group 3 — ASSURE & AUDIT (independent scrutiny)

### A1 — Grace, accessibility specialist (does the manual sign-off)
- **Goal:** confirm the WCAG 2.2 AA claim is real, not asserted.
- **Values today:** the project **already concedes mechanical lint covers only ~30–40% of WCAG** (ADR-4) and gates contrast + keyboard paths; real-browser pa11y/axe is blocking in CI; the gate *blocks a launch claim until the human walkthrough is signed*.
- **Gets stuck:** the **manual VoiceOver/NVDA + 200%-zoom + 320px reflow walkthrough is unsigned**; she can't yet confirm degraded-step flags and the form-fill panel announce politely.
- **Wants next:** to run and sign the committed walkthrough; a forced-colors / high-contrast pass on the copy/print controls.
- **Adopts / walks:** **Signs** if primary tasks complete by screen reader. **Walks** if the static linter is ever cited as equivalent to a real pass.

### A2 — Iris, security & privacy researcher
- **Goal:** trust the hostile-jurisdiction threat model on the actual data flows.
- **Values today:** **zero server-side PII by default**, ephemeral mode, client-side form-fill, the **allowlist logger + runtime PII-egress data-flow test that already caught a real query-string reflection bug**, strict `Referrer-Policy: no-referrer` (so which jurisdiction/step a user viewed doesn't leak), HTTP hardening, vendored-asset SRI, no client analytics.
- **Gets stuck:** the **DPIA/STRIDE sign-off is OPEN**; the CSP still allows `'unsafe-inline'` for two scripts (nonce hardening is planned, [`IMPROVEMENT-PLAN-2.md`](./IMPROVEMENT-PLAN-2.md) D1); corpus-poisoning (a malicious PR = harmful guidance) is the asset she'd attack.
- **Wants next:** the signed DPIA/STRIDE; CSP nonces + drop inline; branch protection requiring source + named verifier on corpus PRs.
- **Adopts / walks:** **Clears** it as genuinely privacy-first. **Walks** if the threat-model doc stays unsigned while real users arrive ([data-broker/surveillance context](https://www.techpolicy.press/gender-politics-and-the-weaponization-of-personal-data/)).

### A3 — Nadia, fact-checker / watchdog journalist
- **Goal:** verify the headline claim — "current, cited, accessible."
- **Values today:** every substantive claim renders with a **source + last-verified date or doesn't render**; uncited model output is rejected pre-render; the project *publishes its own open gates and OPEN review-gates* rather than claiming readiness.
- **Gets stuck:** the **verifiers are placeholders** and **seed citations 404'd** — so "cited" is structurally true but not yet *independently* true; she'd report the gap between the architecture and the seed content.
- **Wants next:** named human verification; a live source-liveness/link-rot gate; a public methodology page.
- **Adopts / walks:** **Reports it favorably** once citations resolve and a named human stands behind them. **Walks** (writes the critical version) if "last checked" dates sit atop unverified seed data.

### A4 — "The Investigator," hostile actor (the adversary the privacy model must defeat)
- **Goal:** use the service to identify, locate, or build a list of trans users (subpoena, breach, or traffic analysis).
- **What the model denies them:** there are **no accounts, no server-side identity inputs, and nothing persisted by default** — "the strongest protection is having nothing to hand over"; form-fill happens client-side; logs are allowlisted and PII-free (proven by the egress test); `Referrer-Policy: no-referrer` and `noindex` on user-state URLs starve traffic-pattern inference.
- **Residual seams they'd probe:** server access logs / IP + timing (mitigated by no-PII logging, but edge/CDN logs live outside the app); the optional save/resume blob (mitigated: local-only, encrypted, selections-not-names); a poisoned corpus PR (mitigated by review + verifier gate, *if* branch protection is enforced).
- **Defeats it if:** the DPIA/STRIDE pass closes the edge-log and supply-chain seams. **Wins if:** the project ever adds reminders-with-contact-info or server-side accounts — which would re-open the whole threat model (correctly kept out of v1).

---

## Group 4 — SERVE & ADVOCATE (closest to the user base)

### S1 — Marcus, pro bono name-change attorney (runs a TLDEF-style clinic)
- **Goal:** hand clients a self-serve tool that does the orientation so his hours go to the hard cases.
- **Values today:** the **ordered checklist, official-form links, fee-waiver mentions, and publication-waiver content** map to what he explains every intake; the privacy posture is one he can endorse to clients in hostile situations; it never pretends to be a lawyer.
- **Gets stuck:** he **can't professionally recommend unverified seed data** with placeholder verifiers; coverage is 5 states while his clients are everywhere; referrals are national, not his local network.
- **Wants next:** named verification (ideally a partnership where his clinic *is* a verifier); a way to add his org as a regional referral; a "for legal-aid partners" page.
- **Adopts / walks:** **Distributes it widely** once a named human stands behind the content — he's the highest-leverage channel to the user base. **Walks** while "nobody's name is on this."

### S2 — Bex, content lead at an LGBTQ advocacy org
- **Goal:** embed or link the tool from the org's resource hub.
- **Values today:** the **indexable guide pages** (`/guide/<state>/<topic>`) with full citations and **HowTo/BreadcrumbList JSON-LD derived from the same records** (so structured data can't drift), EN/ES hreflang, and the honest "last reviewed" framing — link-worthy E-E-A-T.
- **Gets stuck:** 5 states limits how broadly she can promote it; there's **no co-brand / partner-review surface**, and she'd want to vouch for the verification before sending her community.
- **Wants next:** a partner-review cadence and a methodology/trust page; coverage growth; a way to co-sign verified states.
- **Adopts / walks:** **Links it** for covered states once verification is real. **Walks** if linking unverified content would put her org's name at risk.

### S3 — Tomás, community navigator who sits with low-literacy clients
- **Goal:** walk a client through the process in one session, in plain terms.
- **Values today:** the **readability gate (~8th-grade target, EN+ES)**, the calm low-stimulation design, the printable **packet** (`/packet`) he can hand over, and the plain "we don't fill it in for you, work from the authoritative form" honesty.
- **Gets stuck:** even gated, legal vocabulary trips the lowest-literacy clients; there's **no read-aloud, no icons, no "simplest mode,"** and the silent copy button confuses non-screen-reader users.
- **Wants next:** a literacy tier (read-aloud, icons, shorter sentences on the hardest steps); a visible "Copied!" confirmation; the gating court-order step to get a form helper like the federal forms have.
- **Adopts / walks:** **Uses it in sessions** because the packet + plain language already beat the alternatives. **Walks** if clients freeze on legalese at the scariest step.

---

## Group 5 — OPERATE (run it and make it findable)

### O1 — Chelsea, owner / maintainer
- **Goal:** keep the corpus correct over time without the project becoming a law firm or a data collector.
- **Values today:** **`make verify` (14 gates), the freshness SLA, the weekly `content-watch` workflow** (link-rot + source-hash drift → opens a labeled issue), the operations runbook's alarm→action table, non-PII observability counters, runtime corpus quarantine (one bad record doesn't down the service), and the deliberately-OPEN review gates that keep her honest.
- **Gets stuck:** the durable cost is **human quarterly reverification with no funding model**; the seam work (real Bedrock eval, vector index, deploy) is **blocked on accounts/credentials/a domain**, not code ([`PRODUCTIONIZATION-PLAN.md`](./PRODUCTIONIZATION-PLAN.md)).
- **Wants next:** a costed reverification cadence + partner verifiers; the staging deploy that unblocks the live demo, real-Bedrock eval, and SEO.
- **Adopts / walks:** This *is* her project; the risk is **scope creep that re-opens the threat model** (reminders-with-contact, accounts) and **coverage outrunning verification** — both she's explicitly guarding against.

### O2 — Sky, SEO / findability owner
- **Goal:** make sure someone searching "change gender marker California" finds cited guidance, not forum lore — without betraying the privacy posture.
- **Values today:** the **indexing contract is code, not a doc** (`page()` defaults to `noindex`; only home/guide/legal pages opt in), `robots.txt` + `sitemap.xml` with hreflang, the **seo-lint gate**, and a measurement plan that uses **Search Console (no client cookies)** plus referrer-*host*-only server logs — compatible with the no-tracker stance.
- **Gets stuck:** the **real ranking payoff is blocked until there's a public domain** (Search Console verification, `SITE_ORIGIN`); the corpus's content is the ranking asset but only 5 states exist.
- **Wants next:** the domain + Search Console; native-Spanish guide ranking; off-page links from advocacy orgs (E-E-A-T) — which is relationship work, not automation.
- **Adopts / walks:** The strategy is sound; **value is realized only post-deploy.** The tension to never lose: discoverability is the mission, but user-state URLs must stay out of the index.

---

## Cross-cutting themes (what the cast agrees on)

1. **The architecture is trusted; the *content provenance* is the ceiling.** V2, A3, S1, S2, and U6 independently land on the same thing: the gates, privacy model, and citation discipline are genuinely good, but **placeholder verifiers + a co-authored gold set + 404'd seed citations** cap how far anyone — attorney, journalist, advocacy org, or high-stakes user — will rely on it. Named human verification is the single highest-leverage unlock. **[corroborates IMPROVEMENT-PLAN §1.1/§1.2, STATUS open-gates]**

2. **Honesty without a lifeline was the old failure; the build largely fixed it — finish the job.** The prior run's "honest but stranded" blocker is materially addressed: degraded steps now **keep the official source link + a why + a "safest action today,"** any state is selectable, and a **named national referral block** exists. The remaining gap is **local/regional** named referrals (Houston, a survivor's county) and surfacing referrals *before* risky federal steps. **[corroborates IMPROVEMENT-PLAN-2 C3; NET-NEW: regionalize referrals]**

3. **The federal layer needs a *strategy*, not just `needs_reverification`.** Post-EO-14168 the SSA marker change is closed and the passport rule is sex-at-birth pending *Orr v. Trump* — that's hostile-but-fairly-stable, not merely volatile ([HRW](https://www.hrw.org/news/2025/11/10/us-supreme-court-allows-discriminatory-passport-rule); [SSA/Metro Weekly](https://www.metroweekly.com/2025/02/social-security-no-longer-allows-changes-to-sex-identification/)). Every federal-marker persona hits silence where they need a maintained "here's the current federal reality + the safest thing you can do today" explainer. **[NET-NEW strategy]**

4. **The highest-stakes situations are flagged but not *handled*.** Minor (U5), undocumented (U7), reentry/no-address (U8), DV survivor (U9), interstate (U10) are all caught by the **sensitive-situations note + referral** (good harm-reduction) but none are modeled as content. These are common, well-defined branches; content — not new case logic — closes the most frequent ones. **[partially corroborates ROADMAP §3 "Could"; NET-NEW depth]**

5. **Equity is about money and language, and the evidence backs both.** Fee-waiver linkage and worst-case totals (U1, U3, U4, S3) and full ES parity + a third language and a literacy tier (U3, U7, S3) map directly to the access-to-justice and USTS evidence: 48% have no ID with their name, publication costs $40–$250 and disproportionately burdens trans and low-income people ([USTS](https://transequality.org/us-trans-survey); [TotalLegal](https://www.totallegal.com/name-change-publication-waivers); [ABA language justice](https://www.americanbar.org/groups/legal_aid_indigent_defense/resource_center_for_access_to_justice/standards-and-policy/updated-standards-for-the-provision-of-civil-legal-aid/standard-5-7-on-implementing-language-justice/)). **[corroborates IMPROVEMENT-PLAN §3.2/§4.1]**

6. **Two whole audiences exist beyond the end user — and they're underserved by surface.** Legal-aid partners (S1/S2) and funders (V3) are the distribution-and-survival channel, but there's **no partner/verifier surface and no sustainability plan**. The engine is fine; the *partner-facing views and governance* are thin — the same pattern the portfolio's other panels found. **[NET-NEW]**

---

## Honest limits of this exercise

This is **simulated**. It can generate plausible needs and obvious gaps; it **cannot**
tell you which are real, how many users or partners exist, what they'd pay, or what
real trans people — especially in hostile jurisdictions — actually do under stress. It
**over-represents the author's mental model** and will miss what only real users
surprise you with. The external evidence is real and cross-checked, but the **federal
and several state facts are volatile and litigated** (verify before relying), and one
primary statistic (USTS identity-document figures) was corroborated via secondary
summaries because the source PDF blocked automated access. Personas' "values today" are
mapped to features that exist in this repo as of 2026-06-30; "wants" and "walks" are
hypotheses. **Do not prioritize a roadmap off this panel alone** — use it to design the
questions for, and lower the cost of, **real discovery with trans community members and
trans legal-aid organizations**, which is itself the project's stated trust strategy
(ROADMAP §9). The derived backlog is in [`RESEARCH-ROADMAP.md`](./RESEARCH-ROADMAP.md).
