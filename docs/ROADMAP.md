# Trans Docs Navigator — Implementation Roadmap

> The buildable spec. Reads top-to-bottom as product → research → design → architecture → quality → build plan → GTM → legal → ops. Generic enforcement lives in `/STANDARDS`; this document carries the decisions and the project-specific values.
>
> **Last verified: 2026-05-31 · Recheck cadence: quarterly for legal content; per-API for integrations.** Legal requirements change; treat every jurisdiction fact as needing reverification before launch.

## 1. Snapshot
A privacy-first, fully-cited PWA that generates a personalized, ordered checklist and pre-filled forms for legal name and gender-marker changes, jurisdiction by jurisdiction. Correctness is a safety property; the system is built on the civic RAG starter kit and gated by the civic AI eval harness.

## 2. Problem & users
- **Problem.** Rules differ by state and document, change frequently, and live in scattered PDFs and clerk lore. Existing help is incomplete, paywalled, or risky. Mistakes cost money, months, and sometimes safety.
- **Primary users.** Trans and nonbinary people initiating or mid-way through legal changes; secondarily, the people helping them (partners, case workers, legal-aid volunteers).
- **Jobs to be done.** "Tell me exactly what to do, in order, for *my* situation." · "Give me the right forms, filled in." · "Help me understand each step without a lawyer's fee." · "Don't put me at risk by storing my data."
- **Evidence basis.** Public state vital-records and court rules, federal SSA/State Dept guidance, and the documented patchwork of state policies. The research plan (§4) validates coverage and accuracy against ground truth before any public claim.

## 3. Product definition
- **Vision.** The trustworthy front door to legal gender/name change in the US: current, cited, accessible, and safe to use.
- **Scope (MoSCoW).**
  - *Must:* intake; jurisdiction + document selection; ordered checklist with prerequisites, costs, timelines; cited plain-language explanations; client-side form pre-fill (PDF); ephemeral/no-account mode; freshness/verification surfacing.
  - *Should:* save/resume via local-only encrypted state; multi-document orchestration (court → SSA → DMV → passport); printable packet; Spanish.
  - *Could:* jurisdiction-change handling (moved states mid-process); legal-aid referral directory; reminders.
  - *Won't (v1):* submitting filings on the user's behalf; storing identity documents server-side; any feature that requires an account by default.
- **Non-goals.** Not a law firm; not a representation of outcomes; not a data collector.

## 4. Research & evidence
- **Corpus construction.** Build a curated, sourced knowledge base: per jurisdiction × document type, capture the requirement, the governing citation, the official form, cost, and timeline. Each entry is a structured record with `source_url`, `source_title`, `last_verified`, and a named human verifier.
- **Ground-truth set.** Assemble a gold dataset of Q→A pairs and checklist expectations for a starting set of ~5 jurisdictions, expert-reviewed, used by the eval harness as the accuracy oracle.
- **Validation before launch.** No jurisdiction goes live until its corpus passes accuracy eval against ground truth and a human reviewer signs the freshness check.
- **Risks/assumptions to validate.** Form fillability varies (some are flat scans → degrade gracefully to "download + instructions"); some steps are court-discretionary (must be framed as "varies by court"); name + gender changes sometimes share filings and sometimes don't.

## 5. Experience & design
- **Flow.** Welcome + privacy posture → respectful intake (minimal, skippable fields, inclusive language) → generated checklist (collapsible steps, each with cost/time/citation) → per-step detail + form pre-fill → printable/downloadable packet.
- **Tone & content.** Plain language (target ~8th-grade readability), affirming and non-clinical, never assuming a single "right" path. Content style guide committed in repo.
- **Design system.** Inherit the starter kit's tokens; calm, high-contrast, low-stimulation default; dark mode; no dark patterns; no urgency manipulation.
- **Accessibility.** WCAG 2.2 AA as floor (see §7 and audits). Forms with explicit labels, programmatic error messaging, and keyboard-complete flows. Readability and screen-reader walkthrough are release gates.

## 6. Architecture
- **Shape.** Next.js PWA (offline-capable shell) + a thin retrieval/guidance API built on the starter kit. Claude on AWS Bedrock (Haiku for cost, Sonnet for harder synthesis) for grounded explanation; **retrieval is mandatory** — the model only speaks from retrieved, cited corpus chunks.
- **RAG.** Vector store (pgvector or OpenSearch) over the curated corpus; retrieval returns source-tagged chunks; the generation prompt forbids unsupported claims and requires citation tags; a post-generation check rejects any answer with an uncited claim.
- **Form pre-fill.** Client-side PDF form filling (e.g. `pdf-lib`) so identity data never leaves the device by default. A field-mapping config per official form.
- **Data model.** `Jurisdiction`, `DocumentType`, `Requirement(source, last_verified, verifier)`, `Form(field_map, fillable?)`, `ChecklistTemplate`, and an ephemeral client-side `Session` (never persisted server-side in default mode).
- **Deployment.** Containerized; can run in a constrained VPC (parity with the gov-grade posture of the starter kit). IaC via Terraform.
- **Key decisions (ADRs).** Retrieval-mandatory generation (rejected: free-form LLM — unsafe for legal facts). Client-side form-fill (rejected: server-side — unacceptable PII exposure). Per-record human verification (rejected: fully-automated scraping — accuracy/safety risk).

### ADRs recorded during the M0–M4 build
- **ADR-1 — Generator is a pluggable seam; default is a deterministic grounded composer.** The build runs with no AWS credentials, so generation defaults to `GroundedComposer` (extractive composition from retrieved records). It is faithful by construction and makes the eval reproducible. `BedrockGenerator` is the production seam and its output passes through the *identical* `citation.enforce()` gate, so the safety property holds regardless of generator. *Rejected:* requiring Bedrock to run the gates — would make CI non-deterministic and uncloseable.
- **ADR-2 — Retrieval is a deterministic lexical filter in this build.** `api/retrieval.ts` filters by jurisdiction + change-type + document + language and ranks by token overlap. The pgvector/OpenSearch embedding store from §6 plugs in behind the same `retrieve()` signature. *Rejected:* standing up a vector DB for the reference build — adds infra without changing the safety contract.
- **ADR-3 — Corpus is illustrative seed data; launch verification is an explicit, currently-OPEN review-gate.** The mechanical gates (schema, citation, freshness, eval) run green on seed data, but `verifier` is a placeholder and the gold set is co-authored with the corpus. No jurisdiction is launch-cleared. See `docs/audits/data-card.md`. *Rejected:* fabricating named human verifiers — dishonest and unsafe.
- **ADR-4 — a11y is split: mechanical checks auto-gated locally, full axe + manual SR walkthrough in CI/review.** `make a11y` enforces the mechanical WCAG subset without a headless browser (dependency-free, fast). Real-browser pa11y/axe runs in CI and the manual screen-reader/keyboard/zoom walkthrough is review-gated in `docs/audits/accessibility-*.md`. *Rejected:* claiming the static linter equals axe — the standard itself says automation covers only ~30–40%.
- **ADR-5 — Stack is TypeScript run via Node's native type-stripping (no build step), not Next.js, for the reference build.** Delivers a runnable, fully-tested, accessible server-rendered PWA shell + client-side form-fill with zero bundler. The Next.js PWA from §6 remains the production target; the core engine (`api/`) is framework-agnostic and ports directly. *Rejected:* a full Next.js app — heavy to make `make verify`-green end-to-end in one pass, and the safety-critical logic lives in `api/`, not the framework.

## 7. Quality attributes & metrics
Targets specialize `/STANDARDS/QUALITY-AND-METRICS-STANDARD.md`.

| Metric | Target | Measured by | Gate |
|--------|--------|-------------|------|
| Citation coverage | 100% of substantive claims cited | post-gen checker + eval harness | merge-blocking |
| Groundedness / faithfulness | ≥ 0.95 on gold set | civic-ai-eval-harness | merge-blocking |
| Factual accuracy vs ground truth | ≥ 0.98 on live jurisdictions | eval harness | merge-blocking |
| Corpus freshness | 0 jurisdictions past recheck SLA served as "current" | freshness job | merge-blocking + runtime alarm |
| axe violations | 0 | pa11y-ci | merge-blocking |
| Server-side PII fields | 0 in default mode | privacy lint + data-flow test | merge-blocking |
| Request-path p95 (in-process) | < 15 ms | `scripts/latency-bench.ts` (`make loadtest`) | **merge-blocking** — wired into `make verify` step 20/20 (2026-07-05) |
| p95 first-token, network/deployed (< 1.5 s) | < 1.5 s | `loadtest/p95.k6.js` (k6, against a live instance) | **opt-in**, not merge-blocking — needs k6 + a running server; corrected from a prior "merge-blocking" claim that wasn't actually wired anywhere (2026-07-05) |
| Line / branch coverage | ≥ 90% / ≥ 85% (safety-critical) | coverage | merge-blocking |
| Retrieval context recall@8 | ≥ 0.80 | `eval/harness.ts` `retrievalQuality()` (`make eval`) | **merge-blocking** — added 2026-07-05 (AIEV-03). K=8 (not the standard's @20) because this corpus has 32 records total; @20 is tautological at this scale. Must gate before any embedding-retrieval swap (ADR-2) lands. |
| Retrieval precision@1 | ≥ 0.70 | Same harness function (AIEV-04 analogue) | **merge-blocking** — added 2026-07-05. The gold set names exactly one expected-relevant record per accuracy item, so "precision" here is Precision@1 (top-ranked-result accuracy), the standard IR analogue for single-relevant-document ground truth, not Precision@20 (which has a hard ceiling of 1/20 at this gold-set shape). |

**Testing strategy.** Unit (logic, field-mapping), integration (retrieval→generation→citation check), eval (groundedness/accuracy/refusal via the harness), a11y (axe + keyboard + screen-reader), privacy (no-PII-in-logs, ephemeral-by-default), and content tests (every corpus record has source + verifier + date).

## 8. Implementation plan for Claude Code
Repo layout:
```
src/  (app: intake, checklist, step-detail, form-fill)
api/  (retrieval + grounded generation, citation enforcement)
corpus/ (structured jurisdiction records + sources, version-controlled)
forms/  (form field maps + fixtures)
eval/   (gold sets + harness config)
infra/  (terraform)
docs/   (this + audits + generated reports)
```
- **M0 — Scaffold & gates.** Fork starter kit; wire CI (all `/STANDARDS` gates), citation-coverage check, eval harness, axe, secret scan. *Done when `make verify` runs green on an empty app.*
- **M1 — Corpus & data model.** Structured records for ~3 pilot jurisdictions with sources + verifiers; ingest validation; freshness job. *Done when every record validates and freshness alarms work.*
- **M2 — Retrieval-mandatory guidance.** RAG pipeline; generation that only speaks from retrieved chunks; post-gen uncited-claim rejection. *Done when groundedness ≥ target on the gold set.*
- **M3 — Checklist engine.** Personalized, ordered checklist with prerequisites/costs/timelines from corpus. *Done when checklist matches expert expectations on gold set.*
- **M4 — Client-side form pre-fill.** Field-mapped fill for fillable forms; graceful "download + steps" fallback for flat PDFs. *Done when fill works for pilot forms and no PII touches the server.*
- **M5 — Experience & a11y hardening.** Full flow, ephemeral mode, printable packet, Spanish; screen-reader + keyboard sign-off. *Done when all §7 gates pass and audits sign off.*
- **M6 — Expand jurisdictions.** Add jurisdictions only as each passes accuracy + freshness review.
- **Claude Code approach.** Work corpus-first per jurisdiction; never widen coverage ahead of verification; keep the citation gate and eval gate on from M0.

## 9. Go-to-market & community
- **Positioning.** "Current, cited, and safe." Differentiator vs forum lore and paywalled help: transparency (sources + dates) and privacy.
- **Launch.** Soft-launch with a few pilot jurisdictions; partner with trans legal-aid and community orgs for review and distribution; publish the methodology (sourcing + verification) as the trust story.
- **Marketing/comms.** Lead with the responsible-tech posture; the project also reads as portfolio evidence of grounded, audited, accessible public-interest AI.
- **Community.** Contribution path for *verified* corpus updates (PRs require a source + named verifier); issue templates for "law changed in X."

## 10. Legal & compliance
- **Unauthorized-practice-of-law.** Persistent "information, not legal advice" framing; no individualized legal conclusions; route edge cases to legal aid. Counsel review of disclaimers recommended pre-launch.
- **Content licensing.** Government forms/text are generally public; record provenance regardless.
- **Privacy law.** Design exceeds CCPA/GDPR by collecting essentially nothing server-side; still publish a plain-language notice and deletion path for any optional saved state.
- **Accessibility law.** WCAG 2.2 AA conformance + published accessibility statement.

## 11. Operations & sustainability
- **Hosting/cost.** Bedrock token cost dominated by retrieval-grounded short answers; Haiku-first keeps per-session cost low; cache common jurisdiction answers.
- **Observability.** Health endpoint, eval-regression alarms, freshness alarms, error budget; **no PII in logs** (enforced).
- **Maintenance.** The real cost is legal currency: a quarterly reverification cycle per jurisdiction, surfaced as issues; expired data degrades to "needs reverification."
- **Sustainability/sunset.** Corpus is portable structured data; if the project winds down, the verified corpus + methodology remain a reusable public asset.

## Observability

Specializes `/STANDARDS/OBSERVABILITY-STANDARD.md`. **Tier declaration: Tier A** (hosted
service — deployed to AWS Lambda scale-to-zero preview and Render per
`docs/DEPLOY-AWS-PREVIEW.md` / `docs/DEPLOY-PREVIEW.md`), plus the Tier-B Core-Web-Vitals
surface for the rendered pages. This heading is the explicit tier declaration the standard
requires (OBS-21) — previously undeclared, which made every unimplemented Tier-A control
below a *silent* skip rather than a stated gap.

| Area | Status | Note |
|---|---|---|
| Structured JSON logs | **Live** | `api/log.ts`, allowlist-only fields, fail-closed; `tests/observability.test.ts` |
| `/livez` + `/readyz` (+ legacy `/healthz`) | **Live** | Fail-closed readiness (corpus/freshness dependency); no dependency calls on `/livez` |
| Distributed tracing (OTel spans, `traceparent`) | **Not implemented** | Open gap. The only outbound call is the opt-in Bedrock generator seam (unconfigured by default); tracing has a real target once that path is live in production |
| Metrics (`/metrics`, RED per endpoint, UCUM naming) | **Not implemented** | Open gap — no Prometheus/OTel metrics endpoint exists today |
| SLO definitions + burn-rate alerts | **Not implemented** | Open gap — no `slos/*.yaml`; ROADMAP mentions an "error budget" aspirationally below, not yet formalized |
| RUM (Real User Monitoring beacon) | **N/A — reason: privacy posture.** This repo's core safety property is zero client-side telemetry to a third party (see "Design guarantees" in the README and the DPIA). A RUM beacon would ship page/route data off-device to a monitoring vendor by design, which conflicts directly with the hostile-jurisdiction threat model. Core Web Vitals are instead measured in CI (lab data), not from real users. |
| Continuous profiling | **N/A** | Alpha-stage signal, not required at this repo's scale; revisit if traffic/perf work warrants it |

The Lighthouse-CI lab gate for the Tier-B Core-Web-Vitals budgets (LCP/INP/CLS) is tracked
as an open P1 item in the remediation plan — the near-zero-client-JS server-rendered pages
are expected to pass it immediately once wired.

## 12. Responsible-tech summary
Top risks: (1) wrong/stale guidance harming users → citation + eval + freshness gates; (2) PII exposure endangering users in hostile jurisdictions → zero-server-PII, ephemeral default, client-side fill; (3) inequitable coverage/quality across jurisdictions and identities → disaggregated accuracy and inclusive content. Full treatment in [`RESPONSIBLE-TECH-AUDITS.md`](./RESPONSIBLE-TECH-AUDITS.md).
