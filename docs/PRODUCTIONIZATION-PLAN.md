# Productionization Plan — everything left that does not need a human

> Drafted 2026-06-12 against the M6 build (12 gates green, modular i18n landed,
> readability target met corpus-wide). This plan covers the remaining work that code,
> infrastructure, and automation can deliver on their own. It deliberately excludes the
> open review gates that need human judgment — named-human record verification, counsel
> review of the legal pages, the manual screen-reader walkthrough, and an independently
> authored gold set. Those stay tracked in `docs/IMPROVEMENT-PLAN.md` and `docs/STATUS.md`
> and nothing here substitutes for them.
>
> Priorities: `P0` = before any public deployment, `P1` = first weeks after,
> `P2` = hardening that can trail.

## Execution status (updated 2026-06-12)

**Landed (this pass):**
- Phase 4.1+4.2 — no inline scripts or styles anywhere: client JS now lives in
  `public/assets/` (config via JSON islands), the stylesheet is served from the typed
  palette at `/assets/app.css`, and the CSP is `script-src 'self'; style-src 'self'`
  with no `unsafe-inline`. The resume crypto is one module
  (`public/assets/resume-crypto.js`) imported by both the browser panel and the test
  suite — drift is impossible.
- Phase 4.3+4.4 — Dependabot (npm, actions, docker), CodeQL scheduled scan,
  `SECURITY.md` with a private-disclosure route, every workflow action pinned by
  commit SHA, and branch protection on `main` requiring all five CI jobs.
- Phase 3.1–3.4 — `make link-check` (link rot), `make source-watch` +
  `corpus/source-hashes.json` baseline (source-content drift), a weekly
  `content-watch` workflow that runs both plus a live-date freshness sweep and opens a
  labeled issue when a human needs to re-verify, and `make new-record` (schema-valid
  record scaffold).
- Phase 5.3 — `make smoke`: a real-server synthetic journey (EN+ES pages, every
  static asset, strict-CSP assertion on each HTML response), run on every push as a
  required check.
- Phase 6.1 — `make coverage` regenerates `docs/audits/coverage.md`
  (jurisdiction × document × change type × language).
- Phase 6.3 — `tests/i18n-parity.test.ts` enforces locale-registry shape parity at
  runtime, the rail that keeps "a new language is one bundle + one registration" true.
- Phase 1.3 (packaging half) — `release.yml` builds the container on a `v*` tag,
  pushes to GHCR with `GITHUB_TOKEN` only, and attaches a CycloneDX SBOM.

**First content-watch finding (needs the human pass):** the initial link-check run
found 14 of 24 corpus source URLs returning 404. The seed corpus's citations have
rotted; re-pointing legal citations is named-human verification work by design, so
the records stay as they are until that pass happens. The weekly workflow will keep
the issue open.

**Still blocked on accounts/credentials (not on code):**
- Phase 1.1, 1.2, 1.4, 1.5 — an AWS (or interim Fly/Railway) account to apply the
  Terraform and host staging; a domain; an uptime probe; then the README demo link.
- Phase 2.1 — AWS credentials to run `make eval-bedrock` against real Claude on
  Bedrock and commit the report.
- Phase 2.2 — a provisioned pgvector/OpenSearch instance for the real retrieval index.
- Phase 5.1–5.2 — CloudWatch alarms and scheduled k6 both presuppose the deployed
  staging environment.

## Phase 1 — Stand up a real deployment (P0)

The app currently runs only on a laptop. Everything below is scripted work.

1. **Deploy a staging instance.** The Terraform skeleton (`infra/main.tf`) already
   describes the closed-VPC ECS posture. Add the missing pieces: ECR repository, ECS
   service + task definition wired to the existing Dockerfile, ALB with TLS (ACM cert),
   and a small `terraform.tfvars.example`. Apply to a staging account. Until the AWS
   account exists, a free-tier host (Fly.io or Railway) running the same container is an
   acceptable interim demo target; the container has no state, so moving later is cheap.
2. **Edge rate limiting and TLS termination.** The in-process limiter is best-effort by
   design (`api/server.ts` says so). Front the deployment with Cloudflare or the ALB +
   AWS WAF with a per-IP rule, and document the numbers in `docs/OPERATIONS.md`.
3. **Continuous deployment.** Extend `.github/workflows/ci.yml`: on a tagged release,
   build the image, generate an SBOM (syft), push to the registry with provenance
   attestation, and deploy to staging via OIDC role assumption. No long-lived AWS keys
   in GitHub secrets.
4. **Domain + uptime probe.** Point a subdomain at staging, add an external uptime check
   against `/healthz`, and alert on failure. `/healthz` is already non-PII.
5. **Live-demo link in the README.** Once staging is stable, replace the "no hosted demo
   yet" line. This is the single highest-leverage portfolio improvement left.

## Phase 2 — Close the honest-confidence gaps that don't need a reviewer (P0–P1)

`docs/IMPROVEMENT-PLAN.md §0` lists the places a green check overstates assurance. Two of
them fall to automation, not humans:

1. **Real-Bedrock eval pass.** `make eval-bedrock` already runs the gold set through the
   model path with the offline stub. Provision AWS credentials, run it against actual
   Claude on Bedrock (`TDN_BEDROCK=aws`), and commit the report to `docs/audits/`. Add a
   weekly scheduled CI job so the model path is exercised continuously, with results
   published, not gating (cost control: small gold set, one model).
2. **Stand up the real vector index.** `api/embedding-retrieval.ts` is a deterministic
   stand-in behind the production `Retriever` interface. Provision pgvector (RDS) or
   OpenSearch Serverless, write the index-build script from the corpus, and run the same
   retrieval test suite against it in a nightly job. Lexical retrieval stays the default
   until the swap proves equal-or-better recall on the gold queries.

## Phase 3 — Content operations on autopilot (P1)

Humans verify content; machines should detect when verification is needed.

1. **Source-change detection.** Nightly job that fetches every `source.url` in the
   corpus, normalizes the page, and compares a content hash against the last stored one.
   On change: open a GitHub issue naming the record, flip nothing automatically. This
   converts the freshness SLA from a calendar guess into an evidence-based trigger.
2. **Link-rot gate.** CI step that HEAD-requests every source URL weekly and fails on
   404/410/redirect-to-homepage. A dead citation is a broken safety property.
3. **Live-date freshness run.** The merge gate pins its date for determinism. Add a
   scheduled (not merge-blocking) run that evaluates the SLA against the actual current
   date and opens an issue when a record will expire within 14 days, so expiry is never
   a surprise.
4. **Corpus authoring checks.** A `make new-record` scaffold that emits a schema-valid
   record skeleton with today's date and the placeholder verifier, so contributors can't
   mis-shape records. The existing content gate already catches the rest.

## Phase 4 — Security hardening that is pure code (P1)

From the pre-publication security review:

1. **Nonce-based CSP.** Replace `'unsafe-inline'` for scripts/styles with per-response
   nonces. The two inline scripts (resume panel, form-fill) get the nonce; the CSP
   header tightens to `script-src 'self' 'nonce-…'`. Already flagged as a follow-up in
   `api/server.ts`.
2. **Single-source the resume crypto.** The encryption logic exists twice: typed in
   `src/secure-resume.ts` and minified inline in `src/pages.ts`, kept in sync by
   comment. Generate the inline script from the TypeScript source at startup (read,
   strip, embed) or serve it as a static module, so drift is impossible.
3. **Supply-chain posture.** Enable Dependabot (npm + GitHub Actions ecosystems), pin
   action versions by SHA in `ci.yml`, add CodeQL as a scheduled scan, and add a
   `SECURITY.md` with a private-disclosure route (GitHub security advisories).
4. **Branch protection.** Require the CI workflow and at least the verify job on `main`;
   forbid force-push. One `gh api` call.

## Phase 5 — Observability and performance (P1–P2)

1. **Ship the counters.** `api/log.ts` already emits non-PII structured events. In the
   deployed environment, route them to CloudWatch Logs with metric filters for the
   alarm conditions `docs/OPERATIONS.md` names (5xx rate, refusal spike, corpus
   quarantine). Wire the alarms to email. The runbook's alarm→action table is already
   written; this makes it real.
2. **k6 against staging.** `loadtest/p95.k6.js` exists. Run it weekly against staging
   with the documented p95 < 1.5 s budget, publishing results as a CI artifact.
3. **Synthetic user journey.** A scheduled headless-browser run of intake → checklist →
   packet in both languages, asserting status codes and the disclosure banner. Catches
   regressions a unit test can't, like a CSP change breaking the form-fill script.

## Phase 6 — Coverage growth scaffolding (P2)

Adding states is content work (human), but the rails for it are code:

1. **Jurisdiction completeness matrix.** A script that renders, per state × document ×
   language, whether a current record exists, is degraded, or is missing, written to
   `docs/audits/coverage.md`. Makes the "what's next" conversation concrete and shows
   honest gaps publicly.
2. **Spanish parity for Texas state records.** The ES coverage note exists because TX
   has no Spanish state records. The pipeline supports them already; this is corpus
   authoring plus the existing parity tests. Flagged here because the machinery needs
   zero changes, only content.
3. **Third-language dry run.** The i18n registry claims a new language is one bundle +
   one registration. Prove it with a CI-only smoke locale (or a real one when a
   translator exists) to keep the claim true as the app grows.

## Explicitly out of scope (needs humans)

Named-human verification of all 32 records · independently authored expert gold set ·
counsel review of Terms/Privacy/disclaimers · DPIA/STRIDE sign-off · manual
screen-reader, keyboard-only, and zoom walkthrough · community/partner review with trans
legal-aid organizations before anything is promoted to real users. Each already has a
blocking review gate in `docs/STATUS.md`; this plan does not weaken them.

## Suggested order of execution

Phase 1 items 1–2 → Phase 4 items 3–4 (cheap, immediate) → Phase 2 item 1 → Phase 3
items 1–2 → Phase 1 items 3–5 → Phase 4 items 1–2 → Phase 5 → Phase 2 item 2 → Phase 6.
The thread through all of it: every new behavior lands with a gate or a scheduled check,
same as the existing twelve.
