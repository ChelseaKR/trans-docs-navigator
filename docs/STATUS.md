# Build Status — Trans Docs Navigator

> Snapshot of what the ROADMAP §8 implementation plan has produced.
> Last updated: 2026-07-12. `make verify` is green (22/22 gates).
>
> **2026-07-12 observability and lifecycle pass** — added W3C trace-context
> continuation and correlated server/Bedrock client records, bounded-route RED metrics
> at `/metrics`, formal request-based availability/response-latency SLOs with fast/slow
> multi-window burn-alert definitions, and content-free GenAI usage/duration/cost telemetry pinned
> to the portfolio's immutable semantic-convention/pricing shim. `make slo` is stage 22;
> the real-server smoke journey also checks trace continuity and metrics. Loading alert
> rules into a monitoring backend and running recurring real-Bedrock evals remain honest
> deployment/credential dependencies.
>
> **2026-06-05 hardening pass** (see `docs/IMPROVEMENT-PLAN.md` for the full plan):
> added a named-verifier roster + placeholder enforcement (§1.1), a gold-set provenance
> gate (§1.2), HTTP hardening with a testable router + input bounds + security headers
> + rate limiting (§2.2), a runtime request-content non-reflection test (§2.1, which caught and
> fixed a query-string reflection bug), a readability gate (§3.2), colour-contrast
> assertions + blocking pa11y/SAST in CI (§3.1), full Spanish localization of generated
> answers (§4.1), an adversarial/prompt-injection eval suite (§1.3), form-fill failure
> feedback (§3.3), real calendar-date validation + conflicting-cost detection (§1.5),
> language-aware retrieval (§4.2), runtime corpus quarantine (§6.3), vendored-asset SRI
> (§2.4), content-free observability counters (§6.2), and a contribution path (§7.2). The
> HTTP/render surface is now covered by tests rather than excluded.
>
> **2026-06-05 second pass** — landed the previously-deferred code items: a real
> **Bedrock model path** (`BedrockGenerator` + injectable transport, run through the same
> `citation.enforce()` gate; `tests/bedrock.test.ts` proves a hallucinating model is
> rejected; `make eval-bedrock`), a pluggable **embedding retriever** seam
> (`api/embedding-retrieval.ts`) + a load test (`make loadtest`, `loadtest/p95.k6.js`),
> and client-side **encrypted save/resume** (`src/secure-resume.ts`, PBKDF2→AES-GCM,
> local-only, identity never persisted). The OPEN review-gates below are unchanged — they
> require humans, not code.

## Milestones

| Milestone | Status | Evidence |
|-----------|--------|----------|
| **M0 — Scaffold & gates** | ✅ Done | `make verify` runs the 22-stage blocking pipeline; CI in `.github/workflows/ci.yml`; `Dockerfile`; `infra/`. |
| **M1 — Corpus & data model** | ✅ Done (seed) | 32 schema-validated records (CA/IL/NY/TX/WA + federal, EN + ES); `make content` + `make freshness` green. Content is **seed data**, not launch-verified (ADR-3). |
| **M2 — Retrieval-mandatory guidance** | ✅ Done | `api/retrieval.ts` → `api/generator.ts` → `api/citation.enforce()`; groundedness 100%, citation coverage 100% on the gold set. |
| **M3 — Checklist engine** | ✅ Done | `api/checklist.ts`; ordered, prerequisite-aware, freshness-flagged; matches gold expectations. |
| **M4 — Client-side form pre-fill** | ✅ Done | The current form helper in `src/pages.ts` keeps current/new legal-name fields on-device and links to official forms; no direct identity-form fields are read by the runtime API. |
| **M5 — Experience & a11y hardening** | ✅ Done (auto-gated parts) | Full flow + no saved browser session by default (explicit "private mode" affordance) + **printable packet** (`/packet`, print CSS, no-JS-friendly) + **Spanish parity** (13 ES records, EN/ES both 100% on the gold set) + keyboard-path tests; mechanical a11y auto-gated across 7 templates. Manual SR/keyboard/zoom walkthrough remains **review-gated (PENDING)**. |
| **M6 — Expand jurisdictions** | ◑ In progress | 5 jurisdictions live (added TX + WA through the gates). Each carries a **mechanical readiness** row in `eval-report.md`; **launch-clearance is review-gated and OPEN** for all. TX DMV gender-marker is `needs_reverification` (volatile) — demonstrates per-jurisdiction degradation. |

## Hard guardrails — how each is enforced

| Guardrail | Enforcement | Gate |
|-----------|-------------|------|
| #1 No claim without a citation | `citation.enforce()` rejects uncited answers at runtime; `make citation` proves 100% coverage across all paths | ✅ auto |
| #2 Information, not legal advice | persistent banner on every page + trailing disclaimer on every answer; `make disclosure` | ✅ auto |
| #3 Privacy is a safety property | no runtime identity-field handling; local form helper/resume blob; allowlist logger; request-content non-reflection; `make privacy` | ✅ auto |
| #4 Stale law is broken law | `freshness.ts` degrades stale/volatile records; `make freshness` blocks "verified-but-past-SLA" | ✅ auto |

## Merge-blocking metrics (ROADMAP §7) — current

| Metric | Target | Now |
|--------|--------|-----|
| Citation coverage | 100% | 100% ✅ |
| Groundedness | ≥ 0.95 | 1.00 ✅ |
| Factual accuracy (gold) | ≥ 0.98 | 1.00 ✅ (12 items; co-authored gold — see caveat) |
| Per-segment accuracy (jurisdiction × language) | ≥ 0.95 each | 100% all 8 segments ✅ |
| Refusal safety | 1.0 | 1.00 ✅ |
| Corpus freshness | 0 stale-as-current | 0 ✅ (5 records correctly degraded) |
| Mechanical a11y violations | 0 | 0 ✅ |
| Runtime API references to direct identity-form fields | 0 | 0 ✅ |
| Sentinel request content reflected in app logs/responses | 0 | 0 ✅ |
| Core-logic coverage | ≥ 90% / ≥ 85% | 99.7% lines / 94.6% branches ✅ (now incl. router + render surface) |
| Adversarial/injection safety | 1.0 | 1.00 ✅ (5 stress cases) |
| HTTP availability SLO | 99.9% / 30 d | Request-based and drift-gated ✅; probes/scrapes excluded; PromQL parser + page/ticket delivery await deployment |
| HTTP response-latency SLO | 99% ≤ 1.5 s / 30 d | Request-based and drift-gated ✅; probes/scrapes excluded; process-local RED counters exported at `/metrics` |
| GenAI content capture | Off | `content_captured: false`; prompt/completion fields structurally absent ✅ |

## Explicitly OPEN review-gates (not signed — required before any real launch)
Each now has machine-checkable scaffolding that *blocks a launch claim until the human
step is done* — the gate is enforced; the human sign-off is what's outstanding.
- [ ] Named-human verification of every corpus record. *Enforced:* verifier must be in
  `corpus/VERIFIERS.json`; placeholder-verified records can never be `launch_cleared`
  (eval `verification_complete` = ❌ for all jurisdictions today).
- [ ] **Independently authored** expert gold set. *Enforced:* `eval/gold.provenance.json`
  declares `independent_author: false`; the eval forbids `launch_cleared` while it is false.
- [ ] Counsel review of disclaimers (UPL).
- [ ] Manual screen-reader / keyboard / 200%-zoom / 320px walkthrough sign-off. *Enforced:*
  mechanical a11y + contrast auto-gated; real-browser pa11y/axe now **blocking** in CI.
- [ ] DPIA + STRIDE threat-model sign-off. *Enforced:* privacy lint + runtime request-content non-reflection test.
- [ ] Real Bedrock-backed eval (default build uses the deterministic composer, ADR-1).
  *Scaffolding:* the offline harness decomposes claim blocks into atomic assertions and
  rejects unsupported numeric/date literals, form IDs, scoped-negation flips, and short
  fabricated fragments. Its lexical support score is not represented as a semantic judge;
  the real Bedrock/semantic-judge run remains explicitly open.

## Repo map
```
api/      retrieval, grounded generation, citation enforcement, checklist, forms, log;
          trace + RED metrics + pinned GenAI telemetry; router (pure routing + input
          hardening) + server (thin HTTP shell)
src/      accessible rendering + intake/checklist/form-fill pages (client-side fill)
corpus/   structured jurisdiction records + VERIFIERS.json (named-verifier roster)
forms/    form field maps + generated fillable fixtures
eval/     gold set + provenance + deterministic harness + report writer
scripts/  CI gates (lint/test/security/content/citation/privacy/freshness/disclosure/readability/a11y/SLO)
slos/     30-day objectives + Prometheus multi-window burn-alert definitions
tests/    unit + integration (node:test) incl. router, render, and request non-reflection proof
infra/    terraform (closed VPC option, bounded app-log retention) ; Dockerfile at root
docs/     ROADMAP, IMPROVEMENT-PLAN, audits, OPERATIONS, this file
```
