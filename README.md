# Trans Docs Navigator

**A state-by-state navigator for legal name and gender-marker changes** — a grounded, fully-cited assistant that turns the bureaucratic maze (vital records, courts, DMV, SSA, passport) into a personalized, ordered checklist with the right forms pre-filled, and explains each step in plain language. Information, never legal advice. Privacy-first by design, for users who may be in hostile jurisdictions.

**Status:** `In build (M6)` — M0–M5 done; M6 in progress (5 jurisdictions: CA/IL/NY/TX/WA + federal, EN + Spanish). `make verify` green (12 gates: + readability; a11y now also asserts colour contrast); 32 cited corpus records on a named-verifier roster; an adversarial/injection eval suite; printable packet + ephemeral mode shipped. Content verification (named humans), counsel review, manual a11y walkthrough, and real-Bedrock eval are explicit, currently-OPEN review-gates — see `docs/IMPROVEMENT-PLAN.md`. · **Track:** Civic (flagship) · **License:** AGPL-3.0 (proposed)

This is the cleanest fusion of a grounded-conversational-AI playbook (RAG over real source documents, a responsible-AI audit suite, WCAG 2.2 AA) with a community the paperwork system actively punishes. It is also a serious technical artifact: correctness here is a safety property, because wrong guidance costs people money, time, and sometimes safety.

## Why it matters
Name and gender-marker changes differ by state and by document, the rules change, and the existing guidance is scattered across PDFs, court clerks, and forum lore. People pay for incomplete help or give up. A grounded, cited, current, accessible navigator is a genuine public good.

## What it does
- Asks a short, respectful intake (current jurisdiction, which documents, constraints) — with a no-account, ephemeral mode.
- Produces an **ordered, personalized checklist** (e.g. court order → SSA → DMV → passport → financial/records), with prerequisites and realistic costs/timelines.
- **Pre-fills the actual forms** the user can download and file themselves.
- Answers questions with **inline citations** to the governing source and a `last-verified` date, signposting uncertainty and the limits of what it can say.

## For Claude Code
- **Build entrypoint:** [`docs/ROADMAP.md`](./docs/ROADMAP.md) → *Implementation Plan*. Execute phases in order; each is CI-gated.
- **Built on:** the [`civic-rag-starter-kit`](../civic-rag-starter-kit/) scaffold; depends on [`civic-ai-eval-harness`](../civic-ai-eval-harness/) for groundedness/accuracy gates.
- **Hard guardrails (never cross):**
  1. **No claim without a citation.** Every substantive statement renders a source + `last-verified` date or it does not render. Citation coverage is a merge-blocking metric.
  2. **Information, not legal advice.** Persistent, unmissable labeling; no representations about individual legal outcomes.
  3. **Privacy is a safety property.** Default to zero server-side PII; ephemeral by default; form-fill runs client-side; the threat model assumes a hostile jurisdiction. See `RESPONSIBLE-TECH-AUDITS.md` §C.
  4. **Stale law is broken law.** Content has a freshness SLA; expired jurisdiction data is shown as "needs reverification," never silently served.
- **Commands:** `make dev` · `make verify` (runs the full gate set incl. citation-coverage and eval) · `make eval` · `make a11y`.
- **Definition of done:** see `STANDARDS/DOCUMENTATION-STANDARD.md`. Plus: groundedness eval ≥ target, zero uncited claims, zero `axe` violations, DPIA signed.

## Quickstart
```sh
npm install        # deps: pdf-lib (form-fill) + typescript/@types/node (dev)
make verify        # the full 12-gate pipeline (lint, typecheck, tests+coverage,
                   # security, content, citation, privacy, freshness, disclosure,
                   # readability, a11y, eval)
make dev           # http://localhost:8080  → intake → checklist → client-side form-fill
make eval          # regenerates docs/audits/eval-report.{md,json}
```
Requires Node ≥ 22.6 (TypeScript runs via native type-stripping; no build step).
Operations runbook: [`docs/OPERATIONS.md`](./docs/OPERATIONS.md). Build log & status: [`docs/STATUS.md`](./docs/STATUS.md).

## Standards
This repo inherits [`/STANDARDS`](../STANDARDS/). Project-specific quality values are in `docs/ROADMAP.md` §Quality; audit findings in `docs/RESPONSIBLE-TECH-AUDITS.md`.
