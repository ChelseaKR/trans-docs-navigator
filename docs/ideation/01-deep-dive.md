# Deep Dive — Current State (as read 2026-07-01)

> A from-the-code assessment of `main` (HEAD `f187289`, PR #37) plus the unmerged
> branches. Working tree clean. Everything below cites real files; where something is
> inferred rather than observed, it says so.

## 1. Architecture as built

The system is a zero-build TypeScript app on Node ≥22.6 native type-stripping — no
bundler, no framework, dev deps only (`package.json`: typescript, @types/node,
playwright, stylelint). The layering is unusually clean:

- **HTTP shell** — `api/server.ts` (154 lines): strict CSP with no `unsafe-inline`
  anywhere, per-IP fixed-window rate limiter with bounded IP map, URL-length cap,
  socket timeouts, allowlisted static dirs, and a structured access log that never
  logs query strings. Deliberately excluded from coverage; all logic lives below it.
- **Router** — `api/router.ts`: pure `(method, URL, today?) → RouteResponse`, fully
  unit-tested (`tests/router.test.ts`), with input bounds (`LIMITS`), canonical
  query-string reconstruction (`intakeQuery()` — the fix for a real reflected-params
  bug), and fail-closed `/readyz` that refuses traffic when zero records are current.
- **Safety core** — `api/retrieval.ts` (mandatory structured filter `filterByQuery()`
  shared by all retrievers) → `api/generator.ts` (`GroundedComposer` extractive
  default; `BedrockGenerator` seam with linear-time tagged-output parsing) →
  `api/citation.ts` (`enforce()` rejects any uncited/stale/off-grounding/unfaithful
  claim) — orchestrated only through `api/guidance.ts`, so no answer path can skip the
  gate. `api/embedding-retrieval.ts` is a deterministic hashed-BoW+trigram stand-in
  behind the same `Retriever` signature.
- **Corpus** — `corpus/jurisdictions/*.json` (32 records: CA/IL/NY/TX/WA + federal,
  EN + ES), validated by `api/corpus.ts` (real calendar dates, verifier-roster check
  against `corpus/VERIFIERS.json`, fail-closed in CI / quarantine-and-alarm at
  runtime). `corpus/source-hashes.json` baselines source-page content for drift
  detection (`scripts/source-watch.ts`, weekly `content-watch.yml`).
- **Freshness** — `api/freshness.ts`: verified + within per-record SLA, with
  future-date rejection. The one state that would serve stale law as current is
  merge-blocked (`scripts/freshness.ts`).
- **Rendering** — `src/render.ts` (typed `PALETTE` → single `STYLE` served at
  `/assets/app.css`), `src/pages.ts`, `src/guide.ts` (indexable SEO surface),
  `src/seo.ts` (noindex-by-default contract), `src/legal.ts`, all no-JS-first with
  JSON-island progressive enhancement (`public/assets/*.js`).
- **Privacy machinery** — allowlist logger `api/log.ts`; `scripts/privacy-lint.ts`
  (static PII scan); `tests/privacy-egress.test.ts` (sentinel-PII data-flow proof);
  `src/secure-resume.ts` + `public/assets/resume-crypto.js` (PBKDF2→AES-GCM,
  local-only, allowlist-stripped selections, single crypto implementation shared by
  browser and tests).
- **Eval** — `eval/harness.ts` (inlined govchat-eval mechanism; deterministic,
  fail-closed metrics, per-segment accuracy, per-jurisdiction readiness with
  `launch_cleared` hard-wired false, gold-provenance gate) over `eval/gold.ts`
  (~14 items + adversarial suite).
- **CI** — `.github/workflows/ci.yml`: `make verify` (lint → … → eval →
  pseudolocale-overflow; the Makefile now runs **19** stages), plus blocking
  smoke-journey, real-browser pa11y, Semgrep, container build + Terraform validate;
  sibling workflows: CodeQL, Trivy, weekly content-watch, release (SBOM + GHCR),
  OIDC AWS preview deploy. Actions SHA-pinned, `persist-credentials: false`.
- **Deploy** — live Lambda preview (`infra/preview/`, budget-alarmed, scale-to-zero),
  Render one-click, closed-VPC ECS skeleton (`infra/main.tf`).

## 2. What is genuinely strong

- **The safety property is architectural, not aspirational.** There is literally one
  answer path (`api/guidance.ts`), and the model path is *more* constrained than the
  deterministic one (grounding-set resolution + faithfulness precision in
  `citation.ts` `CoverageOptions`). `tests/bedrock.test.ts` proves hallucinating /
  injection-obeying / fabricated-citation model outputs are rejected.
- **Honesty is machine-enforced.** Placeholder verifiers can never launch-clear
  (`eval/harness.ts` `verification_complete`); co-authored gold blocks launch claims
  (`gold.provenance.json`); Spanish gaps render as honest notices
  (`hasThinnerLanguageCoverage()` in `api/checklist.ts`) instead of silent holes.
- **The privacy invariant is proven three ways** (static lint, allowlist logger,
  runtime egress test) and the design removes the data rather than protecting it —
  GET-only intake, client-side name handling, no accounts, noindex on user-state
  routes, `referrer-policy: no-referrer`.
- **Ops posture is real**: fail-closed readiness, quarantine-with-alarm corpus
  loading, a genuinely usable runbook (`docs/OPERATIONS.md`), and weekly content-ops
  that convert drift into issues rather than silent edits.

## 3. Structural debt and gaps actually observed (not recorded elsewhere)

1. **The 2026-06-30 research pass is not on `main`.** `docs/USER-RESEARCH.md`,
   `docs/RESEARCH-ROADMAP.md`, and the implemented top items (lifeline-before-risk,
   per-step report-an-error, privacy-safe `.ics` reminders in
   `public/assets/reminders.js`, plus the earlier `src/referrals.ts`, `src/states.ts`
   coverage front door, fee-waiver framing, and `tests/client-dom.test.ts`) live on
   `research-panel-and-roadmap` (7 commits, atop `panel-remediation`), which diverged
   from `main` at PR #22. `main` has since advanced through #27–#37 (standards CI,
   structured logging `/livez` `/readyz`, i18n gates G1/G3/G9/G10/G12), touching the
   same files (`src/i18n/*`, `src/render.ts`, `src/pages.ts`, `scripts/run-tests.ts`).
   The portfolio index describes this work as done; on `main` it is not. This is the
   single most important reconciliation item in the repo (→ FIX-01).
2. **The runtime freshness clock is frozen.** `api/server.ts:116` calls
   `handleRoute(req.method ?? "GET", url)` without `today`, so every serving-path
   freshness verdict resolves against `DEFAULT_TODAY = "2026-06-16"`
   (`api/freshness.ts:8`). The weekly `content-watch.yml` sweep *does* run the SLA
   against the real date (`NAV_TODAY=$(date +%F)`), but it only opens issues — the
   deployed Lambda will keep serving a record as "current" indefinitely even after
   its SLA lapses in real time. Guardrail #4 currently holds at merge time and in
   weekly alerts, but not on the serving path (→ FIX-02).
3. **The faithfulness gate is blind to negation and numbers.** `api/citation.ts`
   `FAITH_STOP` includes `"not"` and `"no"`, and the check is bag-of-words precision
   at 0.6 — a model output that flips "does **not** require a physician's statement"
   to "requires a physician's statement", or alters a fee figure inside a long
   faithful sentence, passes `requireFaithful`. The block-level append residual is
   documented (IMPROVEMENT-PLAN-2 pointer in the code comment); the
   polarity/numeric blindness is not (→ FIX-04).
4. **Modeled-but-dead personalization.** `Intake.has_court_order` exists in
   `api/types.ts:108` but is never parsed (`api/router.ts parseIntake()`), never
   rendered (`src/pages.ts renderIntakePage()`), and never used by
   `api/checklist.ts` — a user who already has their court order gets the same plan
   as one who doesn't (→ FIX-07).
5. **Jurisdiction knowledge is triplicated.** `src/pages.ts:13` (`JURISDICTIONS`),
   `src/guide.ts:27` (`STATES` with slugs + ES names), and the corpus files each
   independently encode the covered states; `scripts/coverage-matrix.ts` derives a
   fourth view. Adding a state touches ≥3 hand-maintained lists (the unmerged
   branch's `src/states.ts` adds a partial fifth) (→ FIX-06).
6. **Spanish records are forked copies, not translations.** `corpus/jurisdictions/spanish.json`
   (360 lines — the largest corpus file) holds independent records with their own
   ids, sources, dates, and verifiers. A law change requires editing two records with
   nothing tying them together; divergence would be silent. The EN/ES parity gates
   cover UI strings, not corpus semantics (→ FIX-03).
7. **The forms layer is shallow and un-cached.** `api/forms.ts loadForms()` re-reads
   `forms/registry.json` from disk on every call, and `renderChecklist()` calls
   `formById()` per step per request. The registry holds 4 forms with no fillability
   metadata, no version pinning of the official PDF, and no "what you'll need"
   structure (→ FIX-10).
8. **Gate scripts are themselves untested.** The 19 `scripts/*.ts` gates and the
   audit-generating code have no negative controls — nothing proves that
   `privacy-lint` still fails on a PII log call or that `citation-coverage` still
   fails on an uncited claim. A refactor could quietly lobotomize a gate while CI
   stays green (→ FIX-05).
9. **Small doc drift.** `README.md` says "14 automated merge gates"; the Makefile
   runs 19 stages with stage-number comments that disagree (`[1/17]` … `[12/19]`).
   Harmless, but this repo's brand is precision (→ FIX-12).
10. **Promised-but-absent offline shell.** ROADMAP §6 specifies an "offline-capable
    PWA shell"; `public/assets/site.webmanifest` exists but there is no service
    worker and no plan item anywhere covers it (→ EXP-01).

None of these contradict the repo's own honesty — STATUS/IMPROVEMENT-PLAN are candid
about the big open gates — but items 1–4 are real safety-adjacent debt that no
existing document names.

## 4. Strategic position in the portfolio

This is the flagship of a 21-repo civic/responsible-tech portfolio: it is where the
portfolio's shared standards (`/STANDARDS`, fetched pinned at CI time per PR #27) are
instantiated most completely, where the civic-rag-starter-kit patterns
(retrieval-mandatory generation, citation enforcement, eval harness) are proven on the
highest-stakes domain, and where the govchat-eval mechanism is inlined as the accuracy
oracle (`eval/harness.ts` header; note the canonical eval repo is `govchat-eval` —
`civic-ai-eval-harness` is a stale clone). Its differentiation claim — personalized +
cited + privacy-by-design + bilingual + freshness-gated, which no comparable tool
offers (RESEARCH-ROADMAP evidence section) — is credible *architecturally* today and
*content-wise* only after R1/R2/R3 close. The strategic risk is therefore not
engineering: it is that the verification bottleneck (named humans, counsel, partners)
stalls while the codebase keeps compounding polish. The highest-leverage ideas in this
folder are the ones that lower the cost of the human gates (FIX-01, EXP-04, EXP-05)
and the ones that convert the privacy posture from strong to categorical
(FIX-09, EXP-01, EXP-02, EXP-16).
