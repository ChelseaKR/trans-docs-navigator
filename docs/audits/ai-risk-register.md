# AI Risk Register — Trans Docs Navigator (NIST AI RMF view)

> **DRAFT — 2026-07-17 · Review-gated sign-off: PENDING.** This is a governance *view*
> that maps the existing, dated risk entries of
> [`residual-risk.md`](./residual-risk.md) onto the NIST AI Risk Management Framework
> (AI RMF 1.0) functions. It introduces **no new risk judgments**: likelihood/impact
> ratings, mitigations, and statuses are those of the underlying register, which remains
> the single source of truth. Conformance target: RESPONSIBLE-TECH-FRAMEWORK RTF-09.
> No human sign-off is simulated here; the open sign-offs are listed at the end.

## System being assessed

Retrieval-mandatory guidance over a hand-verified corpus (see
[`model-card.md`](./model-card.md)). Two generator modes share one enforcement gate:

- **Default (this build):** `GroundedComposer`, a deterministic extractive composer.
- **Production seam (unconfigured here):** `BedrockGenerator` (Claude on AWS Bedrock),
  whose output passes the *identical* `citation.enforce()` gate — an ungrounded sentence
  is rejected, not rendered.

## GOVERN — accountability structures that exist today

| Mechanism | Where it lives | Status |
|---|---|---|
| Merge-blocking gate pipeline (no advisory stages) | `Makefile` `verify` target; every stage listed there is enforced in CI and by the pre-push hook | Live |
| Launch gates derived from artifacts, not prose — placeholder verifiers cannot sign | `scripts/launch-gates.ts`, `docs/signoffs/` (empty by honest default), `corpus/VERIFIERS.json` | Live; all launch gates OPEN |
| Named-human verification requirement for every served-as-current legal fact | corpus schema `source.verifier` + roster validation | Live (mechanism); content not launch-verified |
| Review-gated human sign-offs (DPO, counsel, threat model, a11y walkthrough, ethics) | `residual-risk.md` §"Open (review-gated) sign-offs", `dpia.md` | **All PENDING** |
| Decision records | `docs/adr/` (MADR) | Live |

## MAP / MEASURE / MANAGE — the register, by risk

IDs, ratings, and statuses are `residual-risk.md`'s, verbatim. "MEASURE" names the
mechanical measurement that exists; "MANAGE" names the response posture. RMF subcategory
references are indicative anchors for a reviewer, not a completeness claim.

| ID | Risk (verbatim from the register) | MAP — context & who is impacted | MEASURE — how it is measured today | MANAGE — response in place | Status (register) |
|---|---|---|---|---|---|
| R1 | Wrong/stale guidance harms a user | Trans/nonbinary individuals acting on legal-process guidance, incl. in hostile jurisdictions (MAP 1.1, 5.1) | Groundedness / accuracy / refusal / citation-coverage eval gates (`make eval`, thresholds in `eval/`); freshness gate; source-fidelity audit against snapshots (MEASURE 2.3, 2.5) | Retrieval-mandatory generation + `citation.enforce()` refuse-over-invent; stale records served only as honestly degraded; launch gate blocks unverified content (MANAGE 1.3) | mitigated (mechanism); **content not launch-verified** |
| R2 | Request or identity exposure endangers a user in a hostile jurisdiction | Same population; adversary assumed to hold subpoena/breach power (MAP 1.1) | `make privacy` static gate; runtime sentinel non-reflection test; allowlist-logger tests; relocation privacy tests (MEASURE 2.10) | Minimization by construction — see [`dpia.md`](./dpia.md) §1–3; bounded log retention; no accounts | partial — provider/browser records remain |
| R3 | Inequitable accuracy/coverage across states & languages | EN/ES users across 5 states + federal; coverage is uneven by fact (MAP 1.6) | Disaggregated per-jurisdiction / per-language accuracy gates; EN/ES parity gates (MEASURE 2.11) | Gaps rendered honestly ("not yet verified"), never hidden; expansion gated on verification capacity | partial — Spanish coverage thin, few states |
| R4 | Seed corpus mistaken for verified content | All users of the preview (MAP 1.1) | `launch-gates` derivation counts named-human-verified records (currently 0) and forces README/STATUS to state it (MEASURE 2.13) | Unmissable disclaimers (corpus README, data-card, model-card); `launch_cleared` machine-blocked for placeholder-verified records | mitigated by labeling |
| R5 | Future Bedrock generator hallucinates a legal fact | Users of a future Bedrock-enabled deployment (MAP 2.3) | Same eval gates run against the generator seam; a real-Bedrock eval run is itself an OPEN launch gate | Identical post-generation citation enforcement; refuse-on-no-support; content-free GenAI telemetry (`api/genai-telemetry.ts`) observes usage without capturing content | designed |
| R8 | UPL (unauthorized practice of law) exposure | Users + the project itself (MAP 3.5) | `scripts/disclosure-check.ts` gates the visible "information, not legal advice" + "AI-assisted" banner on every rendered page (EN/ES) | No individualized legal conclusions by design; counsel review is a launch gate | **counsel review PENDING** |

R6 (GET-URL/provider records) and R7 (supply chain) are tracked in the register and the
DPIA/security controls respectively; they are privacy/security risks rather than
AI-behavior risks, and are not re-mapped here to avoid duplicating their source of truth.

## What this register does NOT claim

- No launch gate is closed by this document; all eight remain OPEN
  (machine-derived — see the README launch-gates block).
- No accuracy numbers are restated here: thresholds and current results live in
  [`eval-report.md`](./eval-report.md), regenerated by `make eval`, so this file cannot
  drift from them.
- The mapping itself has had **no human review**. Open sign-offs, unchanged:
  STRIDE threat-model review · counsel review of disclaimers (R8) · DPIA sign-off ·
  per-release ethics sign-off.
