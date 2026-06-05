# Residual-Risk Register — Trans Docs Navigator

> RESPONSIBLE-TECH-FRAMEWORK §F. Auto-gated scanners are merge-blocking; the
> threat-model sign-off is review-gated.
> Last verified: 2026-05-31 · **Threat-model sign-off: PENDING.**

| # | Risk | Likelihood | Impact | Mitigation | Status | Owner |
|---|------|-----------|--------|------------|--------|-------|
| R1 | Wrong/stale guidance harms a user | Med | High | retrieval-mandatory + citation gate + accuracy eval + freshness degradation | mitigated (mechanism); **content not launch-verified** | — |
| R2 | PII exposure endangers a user in a hostile jurisdiction | Low | High | zero server-side PII; ephemeral; client-side fill; no PII in logs (auto-gated) | mitigated | — |
| R3 | Inequitable accuracy/coverage across states & languages | Med | Med | disaggregated accuracy gate; gaps shown, not hidden | partial — Spanish coverage thin, few states | — |
| R4 | Seed corpus mistaken for verified content | Med | High | unmissable disclaimers in corpus/README, data-card, model-card; launch gate UNSIGNED | mitigated by labeling | — |
| R5 | Future Bedrock generator hallucinates a legal fact | Med | High | identical post-gen citation enforcement on model output; refuse-on-no-support | designed | — |
| R6 | Query params leak via browser history / proxy logs | Med | Low | params are non-identifying; document in privacy notice | accepted | — |
| R7 | Dependency or supply-chain vulnerability | Low | Med | `npm audit` (high/critical merge-blocking) + secret scan + minimal deps | mitigated | — |
| R8 | UPL (unauthorized practice of law) exposure | Low | High | persistent "information, not legal advice"; no individualized conclusions; counsel review | **counsel review PENDING** | — |

## Auto-gated security controls (merge-blocking)
- Dependency advisories: `make security` fails on any high/critical.
- Secret scan: `make security` fails on committed credentials.
- Production CI additionally runs SAST (semgrep/CodeQL) — see `.github/workflows/ci.yml`.

## Open (review-gated) sign-offs
- [ ] STRIDE threat-model review
- [ ] Counsel review of disclaimers (R8)
- [ ] DPIA sign-off (`dpia.md`)
