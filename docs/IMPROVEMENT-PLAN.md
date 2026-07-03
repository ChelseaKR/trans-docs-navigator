# Improvement Plan — Trans Docs Navigator

> A comprehensive, prioritized plan across every quality dimension — user-facing and
> technical. Drafted 2026-06-05 against the M6-in-progress build (`make verify` green, 11 gates).
>
> **Framing.** This is a strong codebase: the safety architecture (retrieval-mandatory
> generation, citation enforcement, freshness SLA, zero-server-PII) is real and CI-enforced.
> The biggest risks are not missing features — they are **gates that are green for the wrong
> reason**. Several "passing" metrics are mechanically guaranteed by the reference build's
> deterministic stand-ins (extractive composer, co-authored gold set, lexical retriever) and
> will not hold once the production seams (Bedrock, vector store, independent verification)
> are plugged in. The plan below is sequenced to convert false confidence into earned
> confidence *before* widening coverage or launching.

## Execution status (updated 2026-06-05)

A hardening pass executed every item that code can deliver; `make verify` is green at
**12 gates**. What remains is genuinely human work, not code.

**Done (code/tests/gates landed):**
- §1.1 verifier roster + placeholder enforcement · §1.2 gold-provenance gate · §1.3
  adversarial/injection eval suite + paraphrase-tolerant faithfulness, now upgraded to
  claim-decomposition + per-claim semantic entailment with a pluggable LLM-judge interface
  (`eval/faithfulness.ts`) · §1.5 calendar-date
  validation + conflicting-cost detection · §2.1 PII-egress test *(caught & fixed a real
  query-string reflection bug)* · §2.2 HTTP hardening (testable router, input bounds,
  security headers, rate limit, timeouts) · §2.4 vendored-asset SRI + pinned hash · §3.1
  contrast assertions + pa11y/SAST made blocking · §3.2 readability gate · §3.3 form-fill
  failure feedback + field caps · §4.1 full Spanish answer localization · §4.2
  language-aware retrieval · §6.1 router/render now tested & coverage-gated · §6.2 non-PII
  observability counters · §6.3 runtime corpus quarantine · §7.2 CONTRIBUTING + templates.

**Still OPEN — requires humans, not code** (each now has an enforcing gate that blocks a
launch claim until the human step is signed; see `docs/STATUS.md`):
- §1.1 actual named-human verification of records · §1.2 an independently-authored expert
  gold set · §2.3 DPIA/STRIDE sign-off · §3.1 manual SR/keyboard/zoom walkthrough · §7.1
  counsel review of disclaimers.

**Previously deferred — now landed as code (2026-06-05, second pass):**
- §1.3 **Bedrock model path** — `BedrockGenerator` (grounded prompt build + tagged-output
  parsing) behind an injectable transport; `answerAsync` runs it through the *identical*
  `citation.enforce()` gate. A real AWS adapter (`api/bedrock-transport.ts`, dynamic
  import — no bundled SDK) + an offline grounded stub. `tests/bedrock.test.ts` proves a
  hallucinating / injection-obeying / fabricated-citation / stale-citation model output is
  **rejected**, never rendered. `make eval-bedrock` runs the gold set through the model
  path (offline stub by default; real Bedrock with `TDN_BEDROCK=aws` + creds), asserting
  the safety invariants. *Still needs creds for a real-content accuracy pass.*
- §5.1 **Embedding retriever** — `api/embedding-retrieval.ts`, same `Retriever` signature
  and the identical mandatory structured filter, deterministic local embeddings (hashed
  bag-of-words + char-trigrams + cosine), pluggable via `answer(_, { retriever })`; lexical
  stays the eval-stable default. The pgvector/OpenSearch swap is now a backend change
  behind this interface. **Load test:** `loadtest/p95.k6.js` (network p95 < 1.5 s) +
  `make loadtest` (deterministic in-process latency guard).
- §2.5 **Encrypted save/resume** — `src/secure-resume.ts` (PBKDF2 → AES-GCM, tested:
  round-trip, wrong-passphrase, tamper, identity-field stripping) + a checklist-page panel
  that saves ONLY non-PII selections, local-only, deletable. Identity data is never persisted.

**Still deferred (genuinely external):**
- A real Bedrock accuracy pass (needs AWS credentials) · standing up the actual
  pgvector/OpenSearch index + running k6 in CI against a deployed instance.

## How to read this

- **Priority:** `P0` launch-blocking · `P1` pre-launch · `P2` post-launch hardening · `P3` opportunistic.
- Every item names the **dimension**, the **concern (user/technical)**, the **evidence**, and a
  **concrete action**. Items map to the OPEN review-gates in `docs/STATUS.md` and the ADRs in
  `docs/ROADMAP.md §6` where relevant.
- "Safety property" is used in the project's sense: correctness and privacy here protect
  people who may be in hostile jurisdictions. Treat P0/P1 correctness work as security work.

---

## 0. The honest-confidence audit (read this first)

These are the places where a green check overstates real-world assurance. Closing the gap is
the spine of the pre-launch plan.

| Green signal today | Why it overstates assurance | Where addressed |
|---|---|---|
| Factual accuracy `1.00`, groundedness `1.00` | Gold set is **co-authored with the corpus** (`eval/gold.ts:4-7`); the oracle was written to match the data it grades. It tests the *harness*, not the *content*. | §1.1, §1.2 |
| Citation coverage `100%` | The default `GroundedComposer` is *extractive* (`api/generator.ts`) — it can only emit text it copied from a record, so coverage is true by construction. A real LLM (`BedrockGenerator`) can fail this. | §1.3 |
| Groundedness `≥0.95` | ~~Faithfulness was a **substring match**~~ — **DONE**: `eval/faithfulness.ts` now decomposes each claim into sub-claims and requires per-claim source support + a negation/polarity guard, with the old substring/token check demoted to a fast deterministic pre-filter and a pluggable `FaithfulnessJudge` seam for a real LLM judge. See §1.3. | §1.3 |
| `0 axe violations` / a11y gate green | Mechanical lint covers only ~30–40% of WCAG (ADR-4). Manual SR/keyboard/zoom walkthrough is **review-gated and PENDING**. | §3.1 |
| `make verify` green = "ready" | `verifier` fields are placeholders (ADR-3); **no jurisdiction is launch-cleared**. Mechanical readiness ≠ legal correctness. | §1.1 |
| Privacy gate green | Regex scan catches *direct* PII references; it can miss obfuscated/derived flows (`scripts/privacy-lint.ts`). Defense-in-depth, not proof. | §2.1 |
| Retrieval "works" | Lexical token-overlap (ADR-2) with no IDF/field-weighting and **English stop-words applied to Spanish** (`api/retrieval.ts`). Fine at 32 records, degrades with scale and hurts ES relevance. | §5.1, §4.2 |

**Principle:** never widen jurisdiction coverage ahead of verification (ROADMAP §8 already
says this). The same rule applies to *confidence*: don't let a deterministic stand-in's
green check be cited as evidence the production system is safe.

---

## 1. Correctness & content integrity — *the core safety property*

This is where wrong work hurts people. It is the highest-value dimension.

### 1.1 — `P0` Replace placeholder verification with named human verification
- **Dimension:** Correctness · **Concern:** user safety, trust · **Evidence:** ADR-3; `verifier` is a placeholder, corpus is "illustrative seed data"; STATUS open-gate #1.
- **Action:** Establish a real verification workflow: each `CorpusRecord` gets a named human verifier who checked the claim against the cited primary source on a dated pass. Strengthen `validateRecord` (`api/corpus.ts`) to reject the literal placeholder set, require a verifier identity that resolves to a real reviewer roster, and require the `source_url` to have been fetched/snapshotted. Gate launch per-jurisdiction, not globally.

### 1.2 — `P0` Independent, expert-authored gold set
- **Dimension:** Correctness/eval validity · **Concern:** technical, trust · **Evidence:** `eval/gold.ts:4-7`; STATUS open-gate #2.
- **Action:** Commission a gold set written by someone who did **not** author the corpus (ideally a trans legal-aid partner per ROADMAP §9). Keep it version-controlled and separate. This is what turns the accuracy number from "self-consistent" into "verified." Expand from 14 items toward statistical meaning (see §1.4).

### 1.3 — `P1` Make the eval real, not mechanically-true
- **Dimension:** Eval rigor · **Concern:** technical · **Evidence:** §0 rows 2–3; `eval/harness.ts`.
- **Actions:**
  - Run at least one eval pass through the **real `BedrockGenerator`** (Haiku) — not only the extractive composer — so citation coverage and groundedness are tested against a model that *can* hallucinate. This is STATUS open-gate #6. **OPEN** (needs AWS credentials).
  - ~~Upgrade faithfulness from substring match to a semantic check...~~ **DONE**: `eval/faithfulness.ts` adds a claim-decomposition + per-claim source-support layer (deterministic `SemanticJudge`, with a per-sub-claim negation/polarity guard) on top of the old substring/token check, which is now a fast pre-filter (`deterministicPrefilter`). The judge is exposed via a `FaithfulnessJudge` interface (`eval/harness.ts`'s `isFaithful`/`runEval` take an optional `judge`, defaulting to the deterministic one) so a real LLM-judge (e.g. Bedrock-backed entailment) can be injected later without touching the harness's control flow — no credentials are required for the default path or `npm test`/`npm run eval`. See `tests/faithfulness.test.ts`.
  - Add an **adversarial suite**: typo'd questions, ambiguous queries, jurisdiction-not-in-corpus, prompt-injection in the question field, mixed-language input. Assert *refusal/degradation*, not answers.

### 1.4 — `P1` Grow gold-set coverage to match claims
- **Dimension:** Eval coverage · **Concern:** technical · **Evidence:** 14 items across 5 jurisdictions × 2 change-types × 2 languages → a single failure swings accuracy ~7 points.
- **Action:** Target enough items per `(jurisdiction × change_type × document × language)` segment that the per-segment ≥0.95 bar is meaningful (rule of thumb: ≥8–10 per active segment). Track segment coverage as its own metric so an empty segment can't masquerade as "passing."

### 1.5 — `P2` Corpus integrity hardening
- **Dimension:** Correctness/security · **Concern:** technical · **Evidence:** `api/corpus.ts` ISO-date regex accepts `2099-13-45`; single bad record fails the whole load (fail-closed — correct, but coarse).
- **Actions:** Validate real calendar dates (not just `\d{4}-\d{2}-\d{2}`). Add a source-URL liveness/snapshot check in CI (link-rot is a freshness failure mode). Add a structured "conflicting cost/timeline across records" detector so the checklist's first-wins pick (`api/checklist.ts pickCost`) surfaces "varies" instead of silently choosing one.

### 1.6 — `P2` Strengthen the disclosure gate beyond string-presence
- **Dimension:** Transparency · **Concern:** user, legal · **Evidence:** `scripts/disclosure-check.ts` only `.includes()` the strings and samples one answer.
- **Action:** Assert disclosures render on **every** user path and are *visible* (not in a hidden node / comment), positioned relative to claims. Pair with the rendered-DOM a11y harness (§3.1) so "present" means "presented."

---

## 2. Privacy & security — *user safety in a hostile-jurisdiction threat model*

The architecture is privacy-first and genuinely good. The gaps are HTTP-surface hardening
and proving the privacy invariant rather than spot-checking it.

### 2.1 — `P1` Data-flow proof, not just regex scan
- **Dimension:** Privacy · **Concern:** user safety · **Evidence:** `scripts/privacy-lint.ts` is regex-based; RESPONSIBLE-TECH §C promises a "data-flow test asserting no PII egress."
- **Action:** Add the promised egress test: drive the server with PII-laden inputs and assert nothing PII-shaped appears in any log sink or response the server emits. Keep the allowlist logger (`api/log.ts`) as the single sink. This upgrades the guarantee from "no obvious reference" to "no observed egress."

### 2.2 — `P1` HTTP-server hardening (production surface)
- **Dimension:** Security/reliability · **Concern:** technical · **Evidence:** `api/server.ts` has no request-size limit, no rate limiting, no socket timeout, no method guard, no security headers.
- **Actions (in the reference server and/or the production Next.js target):**
  - Bound input: cap the `q` question length (~2 KB) before tokenization (`api/retrieval.ts` tokenizes unbounded today); cap `change_types`/`documents` array sizes; validate `jurisdiction` against the known set and return a clear empty-state rather than a silent no-match.
  - Add request-size/`Content-Length` limits, socket timeouts, and a basic per-IP rate limit (token bucket) — abuse/DoS protection for a public service.
  - Send security headers: `Content-Security-Policy` (tight; the only inline script is the client-side fill — move it to a hashed/nonce'd external file), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`. A strict referrer policy matters here: it prevents leaking which jurisdiction/step a user viewed.
  - Explicitly reject non-GET methods.

### 2.3 — `P1` STRIDE threat-model + DPIA sign-off
- **Dimension:** Security/privacy governance · **Concern:** user, legal · **Evidence:** STATUS open-gate #5; RESPONSIBLE-TECH §C/§F say review-gated.
- **Action:** Complete and sign `docs/audits/dpia.md` and the STRIDE threat-model on the real data flows, including the corpus-poisoning asset (a malicious corpus PR = harmful guidance). Tie corpus PRs to required source + named verifier + review (already the intent in ROADMAP §9 — make it a branch-protection reality).

### 2.4 — `P2` Supply-chain & SAST gates that actually block
- **Dimension:** Security · **Concern:** technical · **Evidence:** Semgrep SAST and pa11y run in CI but `continue-on-error` / advisory in the reference repo (`.github/workflows/ci.yml`).
- **Action:** Make SAST blocking for production; pin/verify the vendored `public/vendor/pdf-lib.min.js` (subresource integrity + a check that it matches a known release hash — a vendored minified bundle is an untracked supply-chain surface). Add Dependabot/renovate.

### 2.5 — `P2` Optional encrypted save/resume — build it safely or not at all
- **Dimension:** Privacy/UX · **Concern:** user · **Evidence:** ROADMAP §3 "Should: save/resume via local-only encrypted state" — not implemented.
- **Action:** If built, local-only, client-encrypted (passphrase-derived key), with an unmissable deletion path and an explicit "this stays on your device" affordance. Never a server-side default. If it can't be done safely, document the decision to omit it.

---

## 3. Accessibility & inclusive experience — *primary tasks must be completable by everyone*

### 3.1 — `P0` Real-browser axe + manual SR/keyboard/zoom walkthrough
- **Dimension:** Accessibility · **Concern:** user · **Evidence:** ADR-4; STATUS open-gate #4; mechanical lint ≠ axe.
- **Actions:** Make the pa11y/axe CI job **blocking**, not advisory. Run the committed manual walkthrough (`docs/audits/accessibility-YYYY-MM-DD.md`): keyboard-only completion of intake→checklist→form-fill, VoiceOver + NVDA, 200% zoom, 320 px reflow, programmatic form-error announcement, reduced-motion. Sign it. Add automated color-contrast assertions (the mechanical lint doesn't check contrast today).

### 3.2 — `P1` Readability target enforced, not aspirational
- **Dimension:** Inclusive content · **Concern:** user · **Evidence:** ROADMAP §5 targets ~8th-grade readability; no gate measures it.
- **Action:** Add a readability gate (e.g., Flesch-Kincaid) over rendered guidance and corpus `statement`/`detail`, in **both** EN and ES. Surface failures per record so content can be simplified.

### 3.3 — `P1` Form-fill failure feedback
- **Dimension:** UX/reliability · **Concern:** user · **Evidence:** `api/forms.ts` silently skips fields it can't fill; flat scans degrade to download (good), but partial fills give no signal.
- **Action:** Collect unfilled/failed fields and tell the user which ones to complete by hand. Bound field-value length client-side so a pasted blob can't corrupt the local PDF.

---

## 4. Internationalization & localization — *Spanish parity is shallow today*

### 4.1 — `P1` True corpus localization, not just UI strings
- **Dimension:** i18n · **Concern:** user · **Evidence:** UI has EN/ES (`src/render.ts`), but cost/timeline sentences are hardcoded English in the generator (`api/generator.ts`), and corpus records are largely English.
- **Action:** Move cost/timeline/disclosure formatting into the language table so ES answers are fully Spanish; ensure each launched record has a verified ES translation (translation is a *content-correctness* concern, so it rides the same verifier gate as §1.1).

### 4.2 — `P2` Language-aware retrieval
- **Dimension:** i18n/relevance · **Concern:** technical · **Evidence:** `api/retrieval.ts` applies English stop-words to all languages.
- **Action:** Pass `query.language` into `tokenize()`; use language-appropriate stop-words. Add ES queries to the adversarial/eval suites so relevance regressions are caught.

### 4.3 — `P3` Language expansion path
- **Dimension:** i18n · **Concern:** user · **Evidence:** `Language` is a closed enum.
- **Action:** Document the process to add a language (UI strings + verified corpus translations + gold items + readability pass) so growth doesn't outrun verification.

---

## 5. Performance & scalability — *fine at 32 records, plan for the real store*

### 5.1 — `P2` Land the production retrieval seam
- **Dimension:** Performance/relevance · **Concern:** technical · **Evidence:** ADR-2; lexical full-corpus scan with no IDF; ROADMAP §6 specifies pgvector/OpenSearch behind the same `retrieve()` signature.
- **Action:** Implement the embedding-backed retriever behind the existing interface; keep the lexical one as a deterministic test/eval fallback. Re-run the eval through it to prove the safety contract holds across the swap. Add a `p95 first-token < 1.5 s` load test (ROADMAP §7 names k6; no harness exists yet) — currently an *unmeasured* target.

### 5.2 — `P3` Caching & render reuse
- **Dimension:** Performance/cost · **Concern:** technical · **Evidence:** pages re-render per request; ROADMAP §11 wants common-jurisdiction answer caching for Bedrock cost.
- **Action:** Cache common `(jurisdiction × change_type)` answers and static checklist HTML (it's stateless and PII-free, so cacheable). Add corpus cache-invalidation on file change for dev ergonomics (`api/corpus.ts` caches for process lifetime).

---

## 6. Reliability & operations

### 6.1 — `P1` Test the untested I/O shells
- **Dimension:** Testability/reliability · **Concern:** technical · **Evidence:** coverage gate **excludes** `api/server.ts` and `src/render.ts` (`scripts/run-tests.ts`), yet both hold real logic (routing, parsing, escaping, page assembly).
- **Action:** Add integration tests for every route incl. error paths and static-file traversal; add render/escaping tests (XSS-shaped corpus values must escape). Then fold these modules back into the coverage gate so "90% coverage" stops excluding the HTTP surface.

### 6.2 — `P2` Observability without PII
- **Dimension:** Operations · **Concern:** technical · **Evidence:** OPERATIONS.md lists alarms (freshness, eval regression, citation-gate 500 spike, p95) but there's no metrics/alerting wiring.
- **Action:** Emit structured counters through the safe logger (citation-gate rejections, refusals, per-jurisdiction request volume, freshness-degraded hits) and wire the OPERATIONS alarms to them. Add a scheduled freshness job (not just CI-time) so SLA breaches alarm in production.

### 6.3 — `P2` Graceful corpus degradation
- **Dimension:** Reliability · **Concern:** technical · **Evidence:** one invalid record fails `loadCorpus()` → whole server down.
- **Action:** For a *single* malformed record, prefer quarantining it (and alarming) over taking the whole service down — provided the quarantine itself is loud and gated in CI. Keep fail-closed in CI; consider fail-degraded at runtime.

---

## 7. Product, trust & governance — *the launch-readiness wrapper*

### 7.1 — `P0` Counsel review of disclaimers (UPL)
- **Dimension:** Legal/trust · **Concern:** user, legal · **Evidence:** ROADMAP §10; STATUS open-gate #3.
- **Action:** Have counsel review the "information, not legal advice" framing and the absence of individualized legal conclusions before any public claim. This is a true launch blocker for a legal-adjacent tool.

### 7.2 — `P1` Community contribution path made real
- **Dimension:** Sustainability/governance · **Concern:** technical, community · **Evidence:** ROADMAP §9 describes verified-corpus PRs + "law changed in X" issue templates; not present in repo.
- **Action:** Add `CONTRIBUTING.md`, PR template (requires source + named verifier), and issue templates. Wire branch protection so corpus PRs can't merge without the verification fields. Partner review (trans legal-aid) is the trust story — operationalize it.

### 7.3 — `P2` Jurisdiction-change & reminders (deferred scope, but plan it)
- **Dimension:** Product · **Concern:** user · **Evidence:** ROADMAP §3 "Could" — moved-states mid-process, legal-aid referral directory, reminders.
- **Action:** Keep out of v1. Document the design so they don't get bolted on in a way that breaks the privacy invariant (reminders especially imply contact info → server-side PII → re-opens the threat model).

### 7.4 — `P3` Accessibility statement & methodology publication
- **Dimension:** Transparency · **Concern:** user, GTM · **Evidence:** ROADMAP §9/§10 — publish sourcing/verification methodology and a WCAG statement as the trust story.
- **Action:** Publish both once §1 and §3.1 are signed.

---

## Sequenced roadmap

**P0 — launch-blocking (close the false-confidence gaps):**
- §1.1 named human verification per record · §1.2 independent gold set · §3.1 real axe + manual a11y sign-off · §7.1 counsel review.
- *Gate to add:* no jurisdiction flips to `launch_cleared` until its records are independently verified **and** covered by the independent gold set.

**P1 — pre-launch hardening:**
- §1.3 real-model + semantic eval · §1.4 gold-set depth · §2.1 egress proof · §2.2 HTTP hardening · §2.3 DPIA/STRIDE sign-off · §3.2 readability gate · §3.3 fill feedback · §4.1 corpus localization · §6.1 test the HTTP/render shells.

**P2 — post-launch / scale:**
- §1.5 corpus integrity · §1.6 disclosure rigor · §2.4 supply-chain/SAST blocking · §2.5 safe save/resume · §4.2 language-aware retrieval · §5.1 vector retriever + load test · §6.2 observability · §6.3 graceful degradation · §7.2 contribution path.

**P3 — opportunistic:**
- §4.3 language-expansion process · §5.2 caching · §7.3 deferred product scope · §7.4 published statements.

## Suggested new/strengthened CI gates (net-new assurance)
1. **Real-model eval lane** — at least one Bedrock-backed eval pass (§1.3).
2. **Independent-gold drift check** — fails if gold-set authorship overlaps corpus authorship (§1.2).
3. **PII-egress data-flow test** — promised in RESPONSIBLE-TECH §C, not yet present (§2.1).
4. **Blocking axe/pa11y + contrast** — promote from advisory (§3.1).
5. **Readability gate (EN+ES)** — new (§3.2).
6. **Server/render coverage included** — stop excluding the HTTP surface (§6.1).
7. **Vendored-asset integrity** — SRI/hash check on `pdf-lib.min.js` (§2.4).
8. **p95 first-token load test** — named in ROADMAP §7, unmeasured today (§5.1).

---

*This plan deliberately front-loads converting mechanically-green metrics into independently-earned ones. The build's discipline is its strength; the remaining work is making the assurances as honest as the architecture already is.*
