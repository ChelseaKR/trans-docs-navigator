# EU AI Act Classification — Trans Docs Navigator

> **DRAFT — 2026-07-17 · [human-only to finalize] — this analysis is NOT legal advice
> and has NOT been reviewed by counsel.** It is an engineering-side classification
> working paper for RESPONSIBLE-TECH-FRAMEWORK RTF-12, written so the eventual counsel
> conversation starts from the system's actual architecture instead of from scratch.
> Every conclusion below is provisional; counsel review is the same OPEN gate tracked in
> `residual-risk.md` (R8) and may overturn any of it.

## 0. Threshold question: does the Act even apply?

The service targets **US jurisdictions (CA/IL/NY/TX/WA + federal) in EN/ES** and is not
placed on the EU market. Regulation (EU) 2024/1689 applies by its Art. 2 scope rules
(providers placing systems on the EU market; deployers in the EU; providers/deployers
whose system's *output is used* in the EU). None of those plainly hold today. The
classification below is therefore **contingency analysis** — written down per the
conformance standard so the answer exists *before* any EU-relevant distribution (e.g. a
public dataset or a portable edition circulating beyond the US) rather than after.
Whether any of those future channels trigger Art. 2 is a counsel question.

## 1. Is it an "AI system" (Art. 3(1))?

Two modes, one gate — and they classify differently:

- **Default build (`GroundedComposer`):** a deterministic, explicitly-programmed
  extractive composer over lexical retrieval. It infers nothing beyond its fixed rules
  and exhibits no adaptiveness. Under Art. 3(1) as read with Recital 12 (systems
  operating exclusively on rules defined by natural persons are outside the definition),
  the default build is **arguably not an AI system at all**. This is a provisional
  engineering reading, not a legal conclusion.
- **Bedrock seam enabled (`BedrockGenerator`, Claude via AWS Bedrock — currently
  unconfigured in every environment):** the composed system embeds a general-purpose AI
  model and is then plainly an **AI system**. The rest of this analysis assumes this
  mode, as the binding case.

**Role analysis (provisional):** with the seam enabled, the project would act as
**provider of an AI system built on a third-party GPAI model** (and its operator as
deployer). GPAI *model* obligations (Chapter V) sit with the model's provider, not here;
downstream AI-*system* obligations would sit with this project. Counsel to confirm.

## 2. Prohibited practices (Art. 5)

Reviewed against each Art. 5(1) practice: no subliminal/manipulative techniques, no
exploitation of vulnerabilities to cause harm, no social scoring, no predictive
policing, no untargeted facial scraping, no emotion recognition in work/education, no
biometric categorization, no real-time remote biometric identification. The system's
design goal — accurate, cited, refusal-capable information for a vulnerable population,
with aggressive data minimization — is the opposite posture. **Provisional conclusion:
no prohibited practice.**

## 3. High-risk classification (Art. 6 / Annex III)

The two Annex III areas worth examining honestly, rather than waving at:

- **Annex III 5(a) — evaluation of eligibility for essential public assistance
  benefits/services:** the system *informs individuals* about legal document-change
  procedures (including fee-waiver forms' existence). It does not evaluate anyone's
  eligibility, produce recommendations to an authority, or feed any authority's
  decision. The user's own government submits/decides entirely outside the system.
- **Annex III 8(a) — administration of justice:** the system is not intended for use
  *by or on behalf of* a judicial authority in researching/interpreting facts or law;
  it is a self-help informational tool for individuals.

Even were an Annex III reading attempted, the Art. 6(3) derogation for systems
performing narrow procedural/preparatory tasks would be the natural frame — but we do
not rely on it, because the primary reading is that no Annex III category is engaged.
**Provisional conclusion: not high-risk.**

**Standing re-check trigger:** if legal-aid organizations begin using the system *in
their casework decisions* (roadmap F9/F12 partner path), or any feature begins
producing individualized eligibility assessments, this section must be re-analyzed
before that feature ships — the current "no individualized conclusions" design rule is
also what keeps this classification stable.

## 4. Transparency obligations (Art. 50)

The expected landing zone: **limited-risk / transparency obligations**, in the
Bedrock-enabled mode.

| Obligation | Provision | Posture today |
|---|---|---|
| Inform persons they are interacting with / reading output of an AI system | Art. 50(1), 50(4) | Already shipped and machine-gated: every rendered page's visible banner carries "AI-assisted" + "information, not legal advice" in EN and ES (`scripts/disclosure-check.ts`, merge-blocking), with citations + last-verified dates on every substantive claim. Whether the current wording satisfies Art. 50's specific notice requirements is part of the counsel review |
| Machine-readable marking of synthetic content | Art. 50(2) | Not implemented; becomes relevant only if/when Bedrock-generated text ships. Record the decision (marking approach or reasoned inapplicability) before enabling the seam |

In the default deterministic build, if §1's reading holds, Art. 50 does not attach —
the disclosure banner ships anyway, because honesty about AI assistance is a project
rule independent of regulatory reach.

## 5. Summary (all provisional, all counsel-gated)

| Question | Provisional answer |
|---|---|
| Act applicable today? | Not evidently (no EU placement/use); re-check on any EU-relevant distribution |
| AI system? | Default build: arguably no (Recital 12). Bedrock-enabled: yes |
| Prohibited practice? | No |
| High-risk (Annex III)? | No category engaged; standing re-check trigger defined |
| Transparency tier? | Art. 50 obligations in Bedrock-enabled mode; disclosure banner already machine-gated |

**Finalization is [human-only]:** counsel review of this classification is tracked with
the R8 counsel gate and recorded, when it happens, via `docs/signoffs/` — never by
editing this file. Until then, treat every conclusion here as unreviewed engineering
analysis.
