# Impact × Effort and Sequencing

> Drafted 2026-07-01. Covers FIX-01…FIX-12 and EXP-01…EXP-16. "Impact" is judged
> against the project's own priority order: user safety > correctness/honesty >
> access/equity > reach > polish. These are planning aids, not measurements — several
> impact calls are hypotheses that only counsel, verifiers, or real users can settle
> (final section).

## 1. Impact × effort matrix

Effort: S/M/L/XL. Impact: ★★★ (safety-critical or unblocks the critical path) ·
★★ (major user/trust value) · ★ (real but incremental).

| Impact ↓ / Effort → | S | M | L | XL |
|---|---|---|---|---|
| **★★★** | FIX-02 (runtime clock) | FIX-01 (land research branches) · FIX-04 (polarity/quantity faithfulness) · FIX-05 (gate efficacy) | FIX-03 (corpus schema v2) · EXP-04 (verifier workbench) | EXP-15 (federated verification) |
| **★★** | FIX-12 (truth-in-numbers) | FIX-07 (has_court_order) · FIX-08 (quick exit)† · EXP-05 (policy sentinel) · FIX-11 (metamorphic eval) · FIX-09 (zero-egress, M–L) · EXP-08 (public dataset) · EXP-11 (onion mirror)† · EXP-13 (language-justice pipeline) | EXP-01 (offline shell)† · EXP-02 (portable edition)† · EXP-07 (partner API)† | EXP-14 (engine kit) · EXP-16 (on-device answers)† |
| **★** | EXP-12 (transparency page)† | FIX-06 (states registry) · FIX-10 (forms depth) · EXP-06 (facet chips)† · EXP-10 (supporter view)† | EXP-03 (packet staleness, M after FIX-03) · EXP-09 (clinic mode)† | — |

† = carries a counsel/community/verifier gate that caps how fast it can ship
regardless of engineering effort (see §4).

Reading the matrix by the project's ethos: the top-left region (FIX-02, FIX-01,
FIX-04, FIX-05) is almost all *correctness-of-the-guarantees* work — cheap, high
impact, zero human-gate friction — and none of it appears in the existing roadmaps.
That is the clearest signal of this ideation pass.

## 2. Dependency notes

- **FIX-01 → FIX-06, and precedes anything touching `src/pages.ts`/`src/i18n`**
  (FIX-07, FIX-08, EXP-10). Merging later multiplies conflicts; do it first.
- **FIX-02 → EXP-01, EXP-02, EXP-03** (all offline/staleness surfaces are
  meaningless while the serving clock is pinned).
- **FIX-03 is the load-bearing schema change** → EXP-03 (changelog), EXP-06
  (facets), EXP-13 (variant linkage), FIX-11's language-consistency property, and
  it materially de-risks EXP-08/EXP-14/EXP-15. Schedule it before corpus content
  scales (R10/E8), not after — migration cost grows with record count.
- **FIX-04 and FIX-11 should land before the real Bedrock/embedding swaps**
  (PRODUCTIONIZATION Phase 2) so the seams are gated by stronger checks *when*
  they open, not patched after.
- **EXP-04 and EXP-05 amplify R1/R6** (the named-verification critical path in
  RESEARCH-ROADMAP's "Now"). They are the engineering answer to a human
  bottleneck; build them while the human gates are being negotiated.
- **EXP-07/EXP-08/EXP-09/EXP-15 presuppose partner relationships** that do not yet
  exist (RESEARCH-ROADMAP validation question #1). Treat partner acquisition as the
  real dependency, not code.
- **EXP-02 and EXP-16-Stage-1 share the "engine in the browser" substrate** —
  design them together to avoid two client ports of `buildChecklist()`/`enforce()`.

## 3. Suggested sequence (beyond the existing roadmaps)

The existing plans already sequence the launch gates (R1–R4, A1–A5) and deploy work
(PRODUCTIONIZATION phases). This sequence slots the *new* items around them without
competing for the same human attention:

**Now (engineering-only, no human gates, ~2–3 weeks of focused work):**
1. FIX-01 — reconcile and land the research branches (everything else edits the
   same files).
2. FIX-02 — un-pin the runtime clock (safety property; hours, not days).
3. FIX-05 — gate-efficacy negative controls (locks in the trust story before more
   gates are added).
4. FIX-04 — polarity/quantity faithfulness hardening (before any real-model eval
   run happens under PRODUCTIONIZATION Phase 2.1).
5. FIX-12 + FIX-06 — small drift/dedup cleanups that keep the repo audit-clean.

**Next (structural, while R1/R3 human gates are in progress):**
6. FIX-03 — corpus schema v2 (canonical/variant/facets/changelog), migrated while
   the corpus is still 32 records.
7. EXP-04 — verifier workbench, ready *before* the first real verifier is
   onboarded, so their first hour is productive.
8. EXP-05 — policy-change sentinel added to content-watch.
9. FIX-11 — metamorphic eval, gating the retrieval/model seam swaps.
10. FIX-07 — has_court_order personalization (copy through counsel alongside R3's
    review, batching the UPL asks).
11. FIX-09 — zero-egress Terraform + corpus attestation (lands with the staging
    deploy PRODUCTIONIZATION Phase 1 already plans).

**Later (bets, sequenced by which external validation arrives first):**
- If **community-org partnership** materializes → EXP-09 (clinic mode), FIX-08
  (quick exit, validated), EXP-13 (language-justice pipeline), then EXP-15.
- If **privacy/threat-model review** capacity arrives first → EXP-01 (offline
  shell) → EXP-02 (portable edition) → EXP-11 (onion mirror) → EXP-16 Stage 1.
- If **institutional/funder interest** arrives first → EXP-08 (public dataset) →
  EXP-07 (partner API) → EXP-14 (engine kit).
- EXP-03, EXP-06, EXP-10, EXP-12 slot in behind their dependencies as capacity
  allows.

This ordering deliberately front-loads the theme the deep dive surfaced: **make the
existing guarantees true everywhere they claim to be true** (clock, branches, gate
efficacy, faithfulness) before adding new surfaces that would inherit the gaps.

## 4. Items that require humans — defer and report honestly, never fake

**Counsel / UPL review required before shipping (or before wording ships):**
- FIX-01 (lifeline/referral copy), FIX-02 (degradation banner copy, if reworded),
  FIX-07 ("already have your order" framing), FIX-08 (safety copy),
  FIX-10 (`preparation` content), EXP-01/EXP-02 (staleness/expiry messaging),
  EXP-03 ("the law changed" summaries), EXP-06 (facet presentation),
  EXP-07 (API terms binding downstream framing), EXP-09 (crib sheets),
  EXP-10 (minor/parental-consent adjacency), EXP-12 (canary — counsel may veto;
  accept it), EXP-14/EXP-15/EXP-16 (any generated or re-presented legal content).
  *Until reviewed, these ship structurally disabled or not at all — consistent with
  the repo's existing pattern of enforcing gates that block launch claims.*

**Named-human verification required (content can be staged, never served as fact):**
- All facet values (EXP-06 via FIX-03), form `preparation` lists and version pins
  (FIX-10), translation reconciliation (EXP-13), anything the policy sentinel
  (EXP-05) or staleness checker (EXP-03) surfaces, every attestation in EXP-15,
  and — as always — the R1 record backlog that everything above serves.

**Real-user / community-org validation required (synthetic evidence is not demand):**
- FIX-08 (quick-exit patterns — wrong safety UX is worse than none),
  EXP-01/EXP-02 (offline cache vs device-forensics trade-off for actual at-risk
  users), EXP-09 (does a real clinic want this?), EXP-10 (supporter framing),
  EXP-11 (do target users use Tor?), EXP-16 (is on-device answering trusted or
  spooky?). The open questions in RESEARCH-ROADMAP §"What to validate with real
  users" remain the master list; these items extend it and inherit its discipline.

**Honest status if nothing external arrives:** the Now-block (items 1–5) and most
of the Next-block are still fully executable and worth doing — they harden what
exists rather than expanding what is claimed. That is the correct failure mode for
this project: guarantees that get stronger while coverage waits for humans.
