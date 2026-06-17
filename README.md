# Trans Docs Navigator

**A state-by-state navigator for legal name and gender-marker changes.** It turns the bureaucratic maze (vital records, courts, DMV, SSA, passport) into a personalized, ordered checklist, pre-fills the actual forms in your browser, and explains each step in plain language with a citation and a last-checked date. Information, never legal advice. Built privacy-first, for users who may be in hostile jurisdictions.

**Status:** in build (M6). Five jurisdictions (CA, IL, NY, TX, WA) plus federal, in English and Spanish. All 13 automated merge gates pass: lint, typecheck, tests with coverage, security scan, content validation, citation coverage, privacy, freshness, disclosure, readability, accessibility, SEO, and eval. The remaining launch gates need human judgment, not code: named-human verification of every corpus record, counsel review of the legal pages, a manual screen-reader walkthrough, and a real-Bedrock eval run. Those are tracked openly in [`docs/IMPROVEMENT-PLAN.md`](./docs/IMPROVEMENT-PLAN.md); keeping them open is a decision, not a gap.

## Why it matters

The rules for changing your name and gender marker differ by state and by document, they change often, and the guidance that exists is scattered across PDFs, court clerks, and forum lore. People pay for incomplete help or give up. A current, cited, accessible navigator is a public good. And correctness here is a safety property: wrong guidance costs people money, time, and sometimes safety.

## What it looks like

| Intake | Checklist | Client-side form fill |
|---|---|---|
| ![Intake form: state, what you're changing, documents, language](./docs/screenshots/intake.png) | ![Personalized checklist with citations and last-checked dates](./docs/screenshots/checklist.png) | ![Form SS-5 filled entirely in the browser](./docs/screenshots/form-fill.png) |

## Live preview

**▶ [Live demo](https://7cddozrk6sfpsq7foszis7tcza0boyka.lambda-url.us-west-2.on.aws/)** — runs the real app (every route works, not a static export) on AWS Lambda. It's a serverless, scale-to-zero deploy chosen as a cost guardrail: no always-on compute, a per-month budget alarm, no paid LLM calls by default. First request after idle takes a few seconds to wake. (AWS setup and cost-guardrail breakdown: [`docs/DEPLOY-AWS-PREVIEW.md`](./docs/DEPLOY-AWS-PREVIEW.md).)

Prefer your own host? One click deploys the same image to Render's free tier:
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/ChelseaKR/trans-docs-navigator) — see [`docs/DEPLOY-PREVIEW.md`](./docs/DEPLOY-PREVIEW.md).

It's a demonstration, not a launched service: the corpus is illustrative seed content with corrected official sources but placeholder verifiers, and every page carries the "information, not legal advice" disclosure. It also runs locally in one command (see Quickstart).

## What it does

- Asks a short, respectful intake: your state, which documents, your language. There is no account, and an ephemeral mode that saves nothing at all.
- Produces an **ordered, personalized checklist** (court order → SSA → DMV → passport → records), with prerequisites, realistic costs, and timelines.
- **Pre-fills the actual government forms** on your device, for you to download and file yourself.
- Answers questions with **inline citations** to the governing source and a last-verified date, and says plainly when it doesn't know.

## Design guarantees

Four properties are enforced by merge-blocking CI gates, not by convention:

1. **No claim without a citation.** Every substantive statement renders with a source and a last-verified date, or it does not render. This applies to model-generated text too: output passes through the same post-generation enforcement, so a hallucinated sentence cannot reach a user.
2. **Information, not legal advice.** Every page carries the disclosure, persistently and in both languages. The service makes no representations about individual legal outcomes.
3. **Privacy is a safety property.** Zero server-side PII by default. Form-fill runs entirely in the browser. The optional save-progress feature encrypts only your selections (never names) with a passphrase, on your own device. The threat model assumes a hostile jurisdiction; the strongest protection is having nothing to hand over.
4. **Stale law is broken law.** Every record has a freshness SLA. Expired data is shown as "needs reverification," never silently served as current.

The privacy invariant is proven three ways: a static lint over the codebase, a runtime allowlist logger, and a data-flow test that injects sentinel PII into every request field and asserts none of it reaches a log or response.

## Quickstart

```sh
npm install        # deps: pdf-lib (form-fill) + typescript/@types/node (dev)
make verify        # the full 12-gate pipeline
make dev           # http://localhost:8080 → intake → checklist → client-side form-fill
make eval          # regenerates docs/audits/eval-report.{md,json}
```

Requires Node ≥ 22.6 (TypeScript runs via native type-stripping; no build step). The server is plain `node:http` with one production dependency, pdf-lib.

Operations runbook: [`docs/OPERATIONS.md`](./docs/OPERATIONS.md). Build log and status: [`docs/STATUS.md`](./docs/STATUS.md). Audit artifacts (DPIA, eval reports, accessibility audit, residual-risk register) live in [`docs/audits/`](./docs/audits/).

## Architecture in one paragraph

Retrieval-mandatory generation over a hand-verified corpus of jurisdiction records. The HTTP layer (`api/server.ts`) does plumbing only; routing and validation live in unit-tested `api/router.ts`; the checklist engine, retrieval, and citation enforcement are separate modules under `api/`. Rendering is server-side, accessible HTML (`src/`) that works with JavaScript disabled; the form-fill page progressively enhances. All user-facing strings live in per-language bundles under `src/i18n/`; adding a language means writing one bundle module and registering it. A deterministic extractive composer is the default generator; a Bedrock-backed generator is the production seam, subject to identical citation enforcement.

## Internationalization

English and Spanish ship with full parity, enforced twice: the compiler checks every locale bundle against the same interface, and an end-to-end test suite asserts no English chrome leaks into Spanish pages. Where Spanish coverage is thinner than English for a state, the page says so honestly instead of pretending.

## Contributing and conduct

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) and [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md). Accessibility barriers are treated as bugs.

## Provenance

This project was built AI-assisted (the disclosure on every page says so too) within a portfolio that shares a common quality standard: every project ships with merge-blocking gates for its core safety properties, and audit artifacts are committed to the repo rather than claimed. Related scaffolding (a civic-RAG starter and an eval harness) lives in separate repos of the same portfolio.

## License

[AGPL-3.0-or-later](./LICENSE).
