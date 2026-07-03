# Improvement Plan — Round 3

> Forward-looking plan, building on `docs/IMPROVEMENT-PLAN.md` (rounds 1–2, landed).
> Drafted 2026-06-05. Priorities: `P0` launch-blocking · `P1` pre-launch · `P2` post-launch
> / scale · `P3` opportunistic.

## Context

Rounds 1–2 converted most mechanically-green metrics into earned ones and added the model
path, embedding seam, encrypted save/resume, and the legal/policy pages (Terms, Privacy,
Accessibility) with site-wide disclaimers. `make verify` is green at 12 gates.

What's left is mostly the **human launch gates** (correctness here is a safety property) plus
a focused set of net-new engineering/content assurances. The throughline is unchanged:
never widen coverage ahead of verification, and keep turning "pending/placeholder" postures
into signed, verifiable ones.

---

## A. Launch-readiness gates (human sign-off — highest value)
The OPEN gates from `docs/STATUS.md`; each now has concrete artifacts to act on.

- **A1 `P0` Counsel review** of the drafted Terms/Privacy (`src/legal.ts`) and the per-page
  UPL disclaimers. Finalize liability/governing-law, remove the "pending review" caveats.
- **A2 `P0` Named-human corpus verification.** Replace `Pilot Seed Reviewer` in
  `corpus/VERIFIERS.json` with real reviewers, per jurisdiction. `verification_complete`
  (in `eval/harness.ts`) flips per jurisdiction as this is done.
- **A3 `P0` Independent expert gold set** (ideally via a trans legal-aid partner); flip
  `independent_author: true` in `eval/gold.provenance.json`. The eval withholds
  launch-clearance until then.
- **A4 `P1` DPIA + STRIDE sign-off** (`docs/audits/dpia.md`), aligned with the published
  Privacy Notice and the runtime PII-egress test.
- **A5 `P1` Manual SR / keyboard / 200%-zoom / 320px walkthrough** — now including the three
  legal pages — committed as `docs/audits/accessibility-YYYY-MM-DD.md`.

## B. Content correctness & freshness (ongoing safety; new gates)
- **B1 `P1` Source-liveness / link-rot gate** (`scripts/source-liveness.ts`): fetch each
  `source.url`, flag non-2xx/redirected links. Follow the `pass`/`fail` pattern in
  `scripts/util.ts`; network-tolerant like the npm-audit step in `scripts/security-scan.ts`.
- **B2 `P2` Source snapshotting:** store a content hash (and optionally an archive link) of
  each source at verification time, so silent upstream edits are detectable.
- **B3 `P2` Readability simplification** of the 10 records below the ease-50 target surfaced
  by `scripts/readability.ts`.
- **B4 `P2` Scheduled freshness + eval in CI** (cron), so SLA breaches alarm on a production
  cadence, not only on PRs.

## C. Product / UX (new user value, privacy-preserving)
- **C1 `P2` Per-step "report an error / law changed" link** deep-linking to
  `.github/ISSUE_TEMPLATE/law-changed.md`, prefilled with jurisdiction/document/record id.
- **C2 `P2` Privacy-safe reminders:** downloadable `.ics` / printable next-step reminders,
  entirely client-side — NO server, NO contact info (preserves the threat model).
- **C3 `P2` Legal-aid referral directory:** static per-jurisdiction official/legal-aid links
  as cited corpus records (same verifier gate). No PII.
- **C4 `P3` Jurisdiction-change handling** (moved states mid-process) — ROADMAP §3 "Could".
- **C5 `P3` Light theme + `prefers-color-scheme`** (currently dark-only via `PALETTE.screen`).

## D. Engineering / security hardening
- **D1 `P1` CSP nonce hardening:** externalize the two inline scripts (form-fill in
  `src/pages.ts`, the resume panel) to SRI'd `/vendor/*.js`, then drop `'unsafe-inline'` from
  `script-src` in `api/server.ts`. Reuse the vendored-asset hash check in
  `scripts/security-scan.ts`.
- **D2 `P2` Playwright E2E:** intake → checklist → form-fill download → encrypted
  save/resume round-trip in a real browser (complements the unit-tested `src/secure-resume.ts`).
- **D3 `P2` Real retrieval backend:** wire a real embedding model + pgvector/OpenSearch
  behind the `Retriever` seam (`api/embedding-retrieval.ts`); run `loadtest/p95.k6.js` in CI
  against a docker-compose instance for the §7 p95 target.
- **D4 `P2` Supply chain:** pin GitHub Actions by SHA, add SBOM + Dependabot, generalize SRI.
- **D5 `P3` Edge protection & observability — ✅ Done.** `aws_wafv2_web_acl.edge` (coarse
  IP rate limit, deploy-optional via empty `alb_arn` + `count` guard) fronts the
  best-effort in-process limiter; `aws_cloudwatch_log_metric_filter` resources route the
  non-PII `safeLog` events to CloudWatch metrics, with `aws_cloudwatch_metric_alarm`
  wiring each OPERATIONS.md "Alarms → actions" row (500s spike, quarantine, degraded
  answers, rate-limit abuse) — see `infra/main.tf` and the updated alarm names in
  `docs/OPERATIONS.md`.

## E. Governance / sustainability
- **E1 `P2` Funding & maintenance plan** for the quarterly per-jurisdiction reverification
  cycle (ROADMAP §11 — the real ongoing cost).
- **E2 `P2` DONE — Published methodology/trust page + partner-review cadence** (the GTM
  trust story). Live at `/methodology` (`src/legal.ts` `renderMethodologyPage`, content in
  `src/i18n/{en,es}.ts` `legal.methodology`), mirroring the terms/privacy/accessibility
  pattern: sourcing principle (official government sources only), the verification
  workflow, "last checked" freshness dates, a report-an-error path, and a documented
  **quarterly partner review** with trans legal-aid partners for corrections. Linked from
  every page footer and included in the sitemap/indexable-paths set.

---

## Sequencing
1. **Round 3a (pre-launch, code):** B1 link-rot · D1 CSP nonce · B3 readability · C1
   report-an-error links. Each a PR, `make verify` green, net-new assurance.
2. **Round 3b (launch gates, human-led):** A1–A5. The true launch blockers; code prepares
   the artifacts, humans sign them.
3. **Round 3c (scale/product):** B2/B4, C2/C3, D2–D4, E1/E2 as capacity allows.

## New/strengthened CI gates this round adds
1. Source-liveness (link-rot) gate (B1) · 2. CSP without script `'unsafe-inline'` + SRI on
the externalized bundles (D1) · 3. Scheduled freshness/eval cron (B4) · 4. Playwright E2E (D2).

---

_Already landed in this same change: the legal/policy pages and site-wide disclaimers — see
`src/legal.ts`, the `/terms` `/privacy` `/accessibility` routes, the footer legal nav in
`src/render.ts`, and the contextual notes on the checklist/packet/form-fill pages. Counsel
review of that text is gate A1 above._
