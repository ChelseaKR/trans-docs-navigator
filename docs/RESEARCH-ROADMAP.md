# Research-Backed Roadmap — Trans Docs Navigator

> **Framing.** This roadmap is derived from two inputs: the **synthetic stakeholder
> panel** in [`USER-RESEARCH.md`](./USER-RESEARCH.md) (22 personas across five groups —
> *synthetic, not real interviews; hypotheses, not demand*) and the **cited external
> research** in that document's Method section (legal landscape, equity statistics,
> threat model, comparable tools, standards). It **complements — does not replace —**
> the existing [`docs/ROADMAP.md`](./ROADMAP.md) (the buildable spec),
> [`docs/IMPROVEMENT-PLAN.md`](./IMPROVEMENT-PLAN.md) and
> [`-2`](./IMPROVEMENT-PLAN-2.md) (the prioritized quality plans), and
> [`docs/PRODUCTIONIZATION-PLAN.md`](./PRODUCTIONIZATION-PLAN.md) (the deploy plan).
> Items are tagged **[corroborates …]** when the panel independently lands on something
> those docs already plan (triangulation is signal), and **[NET-NEW]** when the panel
> surfaces something they don't cover.
>
> **Last assembled: 2026-06-30.** Priority: **P0** launch-blocking · **P1** pre-launch ·
> **P2** post-launch · **P3** opportunistic. Effort: **S** ≈ afternoon · **M** ≈ a day or
> two · **L** ≈ a week+. *No product feature, history, or statistic is invented; external
> claims carry real URLs and are cross-checked where high-stakes. The federal and several
> state facts are volatile and litigated — verify before relying.*

---

## Research basis / evidence (why these priorities)

The full citations and access notes live in [`USER-RESEARCH.md` §Method](./USER-RESEARCH.md#method).
The findings that move this roadmap:

- **Federal markers turned hostile mid-build and are litigated.** EO 14168 (Jan 20,
  2025) → State Dept ended "X"/self-attested passports (sex-at-birth), and the **Supreme
  Court (Nov 2025) let the policy take effect during *Orr v. Trump***; **SSA stopped
  sex-marker changes** (~March 2025) while still doing name changes
  ([HRW](https://www.hrw.org/news/2025/11/10/us-supreme-court-allows-discriminatory-passport-rule);
  [State Dept](https://travel.state.gov/content/travel/en/passports/passport-help/sex-marker.html);
  [Metro Weekly/SSA](https://www.metroweekly.com/2025/02/social-security-no-longer-allows-changes-to-sex-identification/);
  [A4TE Passports](https://transequality.org/documents/know-your-rights-passports)).
  → drives **E1** (federal-status explainer) and validates the freshness SLA.
- **State patchwork + publication burden.** MAP tracks state ID/name law *daily*; ~24
  states require newspaper publication (cost **$40–$250**), waivable in several states for
  gender/safety reasons; publication "disproportionately impacts … individuals who are
  transgender"
  ([MAP](https://www.lgbtmap.org/equality-maps/identity_documents/);
  [TotalLegal](https://www.totallegal.com/name-change-publication-waivers)).
  → drives **R7** (cost/fee-waiver realism), **R12** (per-state marker/publication
  specifics), **E8** (verification-gated expansion).
- **Scale of need + safety stakes.** 2022 USTS (A4TE, **92,329 respondents**): **48%**
  had no ID with the name they wanted; **22%** were harassed/denied/assaulted when an ID
  didn't match
  ([USTS](https://transequality.org/us-trans-survey);
  [CNN](https://www.cnn.com/2024/02/07/us/us-transgender-2022-survey-reaj/index.html)).
  → correctness and coverage are safety, not polish (everything P0).
- **Threat model is real.** Government buys data-broker profiles; **DHS removed LGBTQ
  surveillance protections (Mar 2025)**; ~24 states ban gender-affirming care; doxxing
  risk is elevated
  ([TechPolicy.Press](https://www.techpolicy.press/gender-politics-and-the-weaponization-of-personal-data/);
  [EPIC](https://epic.org/documents/data-broker-harms-to-public-officials/)).
  → validates the privacy architecture; drives **R5** (DPIA/STRIDE + edge-log/supply-chain
  seams) and the standing guardrail against reminders-with-contact / accounts.
- **Comparable tools leave a gap.** A4TE ID Documents Center (50-state static guides),
  MAP (policy maps), Lambda Legal (FAQ), TLDEF Name Change Project (pro bono, income-gated,
  ~7 metros) — **none** are personalized + privacy-by-design + bilingual + freshness-gated
  ([A4TE](https://transequality.org/documents);
  [TLDEF](https://www.transanta.com/resources/tldef-name-change-project)).
  → the differentiation is real; the thin spots are coverage (**E8**) and partner/verifier
  integration (**E2/E4**).
- **Plain-language + language-justice are access-to-justice standards.** ABA Standards
  2.3/5.7; plain language aids LEP and is cheaper to translate; WCAG 2.2 AA floor
  ([ABA 5.7](https://www.americanbar.org/groups/legal_aid_indigent_defense/resource_center_for_access_to_justice/standards-and-policy/updated-standards-for-the-provision-of-civil-legal-aid/standard-5-7-on-implementing-language-justice/);
  [WCAG 2.2](https://www.w3.org/TR/WCAG22/)).
  → drives **R4/R9** (a11y + literacy tier), **R10/E7** (ES parity + a third language).

---

## Remediation backlog (close gaps in what exists)

| ID | Item | Personas | Pri | Effort | Evidence / citation |
|---|---|---|---|---|---|
| R1 | **Named human verification per record** — replace `Pilot Seed Reviewer` with real, dated, source-snapshotted verifiers; gate `launch_cleared` per jurisdiction | V2, A3, S1, S2, U1, U6 | P0 | L | The trust ceiling for *every* governing/serving persona. **[corroborates IMPROVEMENT-PLAN §1.1; STATUS open-gate]** · safety: [USTS](https://transequality.org/us-trans-survey) |
| R2 | **Independent, expert-authored gold set** (not co-authored with the corpus); flip `independent_author: true` | V2, A3 | P0 | M | Turns accuracy from self-consistent into verified. **[corroborates §1.2; STATUS open-gate]** |
| R3 | **Counsel UPL sign-off** — finalize Terms/Privacy/disclaimers; audit degraded-step "safest action today" copy for advice-drift | V1 | P0 | M | UPL is a true launch blocker. **[corroborates §7.1 / IMPROVEMENT-PLAN-2 A1]** |
| R4 | **Manual SR / keyboard / 200%-zoom / 320px walkthrough** signed + published as `docs/audits/accessibility-YYYY-MM-DD.md` | U6, A1, S3 | P0 | M | Mechanical lint ≠ AA (ADR-4). **[corroborates §3.1; STATUS open-gate]** · [WCAG 2.2](https://www.w3.org/TR/WCAG22/) |
| R5 | **DPIA + STRIDE sign-off**; close edge/CDN-log + corpus-poisoning seams; enforce branch protection requiring source + named verifier on corpus PRs; CSP nonces | A2, A4 | P1 | M | Threat model is real. **[corroborates §2.3, IMPROVEMENT-PLAN-2 D1]** · [TechPolicy.Press](https://www.techpolicy.press/gender-politics-and-the-weaponization-of-personal-data/) |
| R6 | **Source-liveness/link-rot gate live + re-point the 14/24 404'd seed citations** (named-verifier work; a dead citation is a broken safety property) | A3, V2, O1 | P0 | M | First link-check found 14/24 sources dead. **[corroborates IMPROVEMENT-PLAN-2 B1 / PRODUCTIONIZATION P3.2]** |
| R7 | **Link the actual fee-waiver forms** (FW-001 / state equivalents) with plain-language eligibility; show a **worst-case total cost** line, not "varies" | U1, U3, U4, S3 | P1 | S | Fee waiver is make-or-break for low-income users; publication $40–$250. **[corroborates prior panel quick-win]** · [TotalLegal](https://www.totallegal.com/name-change-publication-waivers) |
| R8 | **CSP nonce hardening** — externalize the two inline scripts (SRI), drop `'unsafe-inline'` from `script-src` | A2 | P1 | S | **[corroborates IMPROVEMENT-PLAN-2 D1 / PRODUCTIONIZATION P4.1]** |
| R9 | **Literacy tier** — read-aloud option, visible "Copied!" confirmation, simplify records below the readability target, add a **form helper on the gating court-order step** (federal forms already have one) | S3, U1, U6 | P1 | M | ~8th-grade target + LEP. **[corroborates §3.2/§3.3]** · partly **[NET-NEW: read-aloud]** · [ABA 5.7](https://www.americanbar.org/groups/legal_aid_indigent_defense/resource_center_for_access_to_justice/standards-and-policy/updated-standards-for-the-provision-of-civil-legal-aid/standard-5-7-on-implementing-language-justice/) |
| R10 | **Full Spanish corpus parity** for TX/WA state records (currently English-only) | U3, U4 | P2 | M | Tracked ES gap. **[corroborates §4.1 / data-card]** |
| R11 | **Surface referrals *before* risky federal/court steps** (not only at the page bottom); wire a **per-step "report an error / law changed" link** to the existing `law-changed.md` template — ✅ Implemented 2026-06-30 (working tree, uncommitted) | U7, U9, O1 | P1 | S | Referral exists but is bottom-anchored; report link not wired. **[corroborates IMPROVEMENT-PLAN-2 C1]** · **[NET-NEW: referral placement]** |
| R12 | **Confirm X/nonbinary marker availability explicitly** per state × document (replace vague "self-certify your sex designation") | U2, U6 | P2 | S | Core to the nonbinary pitch. **[corroborates prior panel]** · [A4TE](https://transequality.org/documents) |

## Expansion backlog (new capability)

| ID | Item | Personas | Pri | Effort | Evidence / citation |
|---|---|---|---|---|---|
| E1 | **Federal-status explainer** — one maintained surface for SSA/passport markers keyed to EO 14168 / *Orr v. Trump*, with official links, dates, and a "safest thing today," instead of per-step `needs_reverification` silence | U1, U2, U4, U7 | P1 | M | The federal rule is now hostile-but-stable, not just volatile. **[NET-NEW strategy]** · [HRW](https://www.hrw.org/news/2025/11/10/us-supreme-court-allows-discriminatory-passport-rule); [SSA](https://www.metroweekly.com/2025/02/social-security-no-longer-allows-changes-to-sex-identification/) |
| E2 | **Regional & situational referrals as cited corpus records** — per-jurisdiction legal-aid/clinics (incl. TLDEF Name Change Project metros, immigrant- and survivor-serving, Spanish-speaking), under the same verifier gate | U2, U4, U7, U9, S1 | P1 | M | National-only today. **[corroborates IMPROVEMENT-PLAN-2 C3]** · **[NET-NEW: regional/situational]** · [TLDEF](https://www.transanta.com/resources/tldef-name-change-project) |
| E3 | **Situational content branches** (content, not new case logic): minor/parental-consent, DV-survivor confidential/sealed filing + address-confidentiality programs, no-fixed-address, reentry, interstate move/residency | U5, U8, U9, U10 | P2 | L | Flagged-but-unhandled high-stakes cases. **[corroborates ROADMAP §3 "Could" (jurisdiction-change)]** · **[NET-NEW depth]** |
| E4 | **"For legal-aid partners" surface** + partner-as-verifier workflow + published **methodology/trust page** + partner-review cadence | S1, S2, V2, O1 | P1 | M | Legal aid is the distribution channel. **[corroborates §7.2 / IMPROVEMENT-PLAN-2 E2]** · **[NET-NEW: partner surface]** |
| E5 | **Funding & sustainability plan** for quarterly per-jurisdiction reverification (costed; coverage gated on verification capacity) | V3, O1 | P1 | M | The real ongoing cost. **[corroborates IMPROVEMENT-PLAN-2 E1 / ROADMAP §11]** |
| E6 | **Privacy-safe reminders** — downloadable `.ics` / printable next-step reminders, **entirely client-side, no server, no contact info** (preserves the threat model) — ✅ Implemented 2026-06-30 (working tree, uncommitted) | U1, U8 | P2 | S | **[corroborates IMPROVEMENT-PLAN-2 C2]** |
| E7 | **Third language** (e.g., Arabic) — prove the "one bundle + verified corpus translations + gold items + readability pass" path end-to-end | U7 | P3 | L | Immigrant users beyond ES. **[corroborates §4.3 / PRODUCTIONIZATION P6.3]** |
| E8 | **Coverage expansion beyond 5 states**, strictly verification-gated; publish the completeness matrix (`docs/audits/coverage.md`) publicly so gaps are honest | U2, V3, S1, S2 | P2 | L | Most states get federal+referral only. **[corroborates ROADMAP §8 M6 / PRODUCTIONIZATION P6.1]** |
| E9 | **Stand up staging → live demo → real-Bedrock eval → Search Console** (unblocks SEO ranking + the model-path honest-confidence gap) | O1, O2, A3 | P1 | L | Blocked on account/domain, not code. **[corroborates PRODUCTIONIZATION P1/P2; SEO-PLAN Phase 4]** |

---

## Sequenced roadmap (ties to the existing roadmap)

**Now — P0, the provenance + sign-off spine** (this is the panel's loudest, most
unanimous signal: the architecture is trusted, the *content provenance* is the ceiling).
Maps to ROADMAP §4 "Validation before launch" and the OPEN gates in
[`STATUS.md`](./STATUS.md):
- **R1** named verification · **R2** independent gold set · **R6** re-point the 404'd
  citations · **R3** counsel sign-off · **R4** signed a11y walkthrough.
- *Gate to keep:* no jurisdiction flips to `launch_cleared` until its records are
  independently verified **and** covered by the independent gold set (ROADMAP §8 already
  says "never widen coverage ahead of verification").

**Next — P1, highest user + partner leverage** (maps to ROADMAP §6 seams, §9 GTM/partners):
- **E1** federal-status explainer (closes the biggest user-facing dead end) · **R7**
  fee-waiver links + real cost · **R11** referrals-before-risk + report-an-error link ·
  **E2** regional/situational referrals · **E4** partner/verifier surface + methodology
  page · **E5** sustainability plan · **R5** DPIA/STRIDE + **R8** CSP nonces · **E9**
  deploy → live demo → real-Bedrock eval → Search Console.

**Later — P2/P3, depth + reach** (maps to ROADMAP §8 M6 expansion, §3 "Could"):
- **E3** situational branches · **R9** literacy tier (deepen) · **R10** ES parity for
  TX/WA · **R12** explicit X-marker confirmation · **E6** privacy-safe reminders · **E8**
  verification-gated coverage growth · **E7** third language.

## Recommended first sprint (highest leverage)

The panel and the existing plans converge on one starting line: **convert the trusted
architecture into earned, named provenance, and close the single biggest user-facing
dead end.** Ship these together:

1. **R1 + R6 — named verification + re-point the dead citations.** This is the literal
   ceiling on every governing, auditing, and serving persona (V2, A3, S1, S2) and the
   high-stakes users (U1, U6). Code prepares the artifacts (roster, snapshot, gate);
   humans sign. *Highest leverage, hardest, do it first.*
2. **R3 + R4 — counsel UPL sign-off + signed a11y walkthrough.** The other two human
   launch gates; cheap to prepare, blocking until signed.
3. **E1 — federal-status explainer.** One maintained surface turns "three grayed-out
   `needs reverification` boxes" into "here's the current federal reality and the safest
   thing you can do today" for every federal-marker user — the panel's most-cited
   dead end, and squarely backed by the EO-14168 / *Orr v. Trump* / SSA evidence.
4. **R7 — fee-waiver links + worst-case cost.** An afternoon of work that removes the
   most-cited equity blocker for low-income users (U1, U3, U4, S3); evidence-backed.
5. **R11 — referrals-before-risk + report-an-error link.** Cheap; moves the existing
   lifeline to where the danger is, and turns users into a freshness signal.

Items 1–2 are human-led (the project already has the enforcing gates); 3–5 are code +
content and can land immediately. Nothing here widens jurisdiction coverage ahead of
verification.

## Traceability matrix (persona → findings)

| Persona | Remediations | Expansions |
|---|---|---|
| U1 Maya (CA, fee waiver) | R1, R7, R9 | E1, E6 |
| U2 River (FL, uncovered, X) | R12 | E1, E2, E8 |
| U3 Sofía (ES-only) | R7, R10 | — |
| U4 Daniel (TX, ES) | R7, R10 | E1, E2 |
| U5 Alex (minor) | — | E3 |
| U6 Jordan (blind) | R1, R4, R9, R12 | — |
| U7 Priya (undocumented) | R11 | E1, E2, E7 |
| U8 Sam (reentry/no address) | — | E3, E6 |
| U9 Cass (DV survivor) | R11 | E2, E3 |
| U10 Robin (interstate) | — | E3 |
| V1 Counsel | R3 | — |
| V2 Dr. Reyes (verifier) | R1, R2, R6 | E2, E4 |
| V3 Lena (funder) | — | E5, E8 |
| A1 Grace (a11y) | R4, R9 | — |
| A2 Iris (security) | R5, R8 | — |
| A3 Nadia (fact-checker) | R1, R2, R6 | E9 |
| A4 Investigator (adversary) | R5 | — |
| S1 Marcus (legal aid) | R1 | E2, E4, E8 |
| S2 Bex (advocacy org) | R1 | E4, E8 |
| S3 Tomás (navigator) | R7, R9 | — |
| O1 Chelsea (owner) | R6, R11 | E4, E5, E9 |
| O2 Sky (SEO) | — | E9 |

## What to validate with real users (and risks)

The synthetic panel cannot tell you which of these are real — these are the questions to
take into **real discovery with trans community members and trans legal-aid orgs**
(ROADMAP §9), ordered by how much they'd change the roadmap:

1. **Will legal-aid orgs actually verify and distribute it?** R1/E4 assume a partner
   pipeline exists. If no org will co-sign, named verification becomes Chelsea's solo
   burden and the sustainability math (E5) changes. *Validate before scaling coverage.*
2. **Do users want the federal explainer (E1), or does naming the hostile reality cause
   harm/chill?** Test framing with affected users; the "safest action today" copy must
   not read as advice (R3) or as discouragement.
3. **Which situational branches (E3) are highest-frequency?** Minor, survivor,
   undocumented, reentry, interstate — prioritize by real caseload data from partners,
   not by panel guess.
4. **Is national referral enough, or is regional/local (E2) the real need?** The panel
   strongly suspects local, but real users in covered states may be served by national
   orgs already.
5. **Does the privacy posture match what at-risk users actually fear?** Confirm the
   threat model with people in hostile jurisdictions; the edge-log seam (R5) may matter
   more or less than assumed.

**Standing risks the roadmap must respect:**
- **Volatility.** The federal and several state facts are litigated and can change with a
  ruling ([HRW](https://www.hrw.org/news/2025/11/10/us-supreme-court-allows-discriminatory-passport-rule)).
  E1 is only safe *with* the freshness SLA and a maintained reverification cadence (E5).
- **Threat-model regression.** E6 (reminders) and any future accounts must stay
  client-side/contactless; the moment contact info or server state appears, the
  hostile-jurisdiction model re-opens (ROADMAP §3 "Won't"; persona A4).
- **Coverage-ahead-of-verification.** E8 must stay gated; an unverified state is worse
  than an honest "not covered + referral."
- **Over-indexing on synthetic findings.** See limits below.

## Honest limits

This roadmap is **derived from a synthetic panel plus real external research** — not from
real interviews or usage data. The personas over-represent the author's mental model and
cannot establish demand, willingness to pay, or what real trans users do under stress.
The external evidence is real and cross-checked for the high-stakes claims, but **the
legal landscape is volatile and litigated (verify before relying)**, and one primary
statistic (USTS identity-document figures) was corroborated via secondary summaries
because the source PDF blocked automated access at the time of writing. Effort and
priority are estimates. Many items **[corroborate]** the existing
[`ROADMAP.md`](./ROADMAP.md) / [`IMPROVEMENT-PLAN.md`](./IMPROVEMENT-PLAN.md) /
[`PRODUCTIONIZATION-PLAN.md`](./PRODUCTIONIZATION-PLAN.md) — treat that as triangulation,
not duplication, and let those documents remain the source of truth for anything they
already sequence. The **[NET-NEW]** items (esp. the federal-status explainer E1, regional
referrals E2, the partner/verifier surface E4, and the literacy tier's read-aloud) are
the panel's distinct contribution and the place to start real validation.
