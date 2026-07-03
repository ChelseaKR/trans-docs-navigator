# Large-Scale Fixes (FIX-01 … FIX-12)

> Drafted 2026-07-01. Deep structural fixes only — not features, not restatements of
> R1–R12 / IMPROVEMENT-PLAN items. Effort tiers: **S** ≈ hours · **M** ≈ 1–3 days ·
> **L** ≈ 1–2 weeks · **XL** ≈ multi-week. **[counsel-gated]** marks anything touching
> legal content or its presentation.

---

## FIX-01 — Land and reconcile the research-pass branches
**Pitch:** `main` is missing the safety layer the portfolio already reports as shipped.
- **Why it matters:** The lifeline-before-risky-steps surfacing, per-step
  report-an-error links, `.ics` reminders, referral layer (`src/referrals.ts`),
  coverage front door (`src/states.ts`), and both research documents live only on
  `research-panel-and-roadmap` / `panel-remediation`, diverged from `main` at PR #22.
  Users of the live Lambda preview (built from `main`) get none of it, and the repo's
  own RESEARCH-ROADMAP is unreachable from `main`'s docs. Honesty-as-a-feature is
  violated by drift, not by intent.
- **Shape of work:** Rebase (or merge) the two branches over #27–#37. Conflict
  surface is known: `src/i18n/{en,es,types}.ts` (both sides added keys — union them,
  key-parity gate G6 verifies), `src/pages.ts`/`src/render.ts` (research side adds
  sections; main side changed CSP/logical-CSS — re-run G10), `scripts/run-tests.ts`
  and `package.json`/lock. Then run the full 19-stage `make verify` + pa11y +
  smoke-journey. Land as one reviewed PR series, updating `docs/STATUS.md`.
- **Effort:** M. **Risks/deps:** i18n key collisions; the branch's `smoke-live.ts`
  assumes the deployed URL; the new referral/lifeline *copy* is user-facing safety
  text — **[counsel-gated]** for the copy, structural merge is not.
- **Excellent looks like:** `git branch --no-merged main` shows no research branches;
  `make verify` green; USER-RESEARCH/RESEARCH-ROADMAP render on main; live preview
  shows the lifeline and report-error links in EN and ES.

## FIX-02 — Un-pin the runtime freshness clock
**Pitch:** Guardrail #4 must hold at serve time, not just at merge time and in weekly issues.
- **Why it matters:** `api/server.ts:116` never passes `today`, so freshness resolves
  against `DEFAULT_TODAY = "2026-06-16"` (`api/freshness.ts:8`) forever. A record
  whose 90-day SLA lapses in August 2026 will still be served as current by the
  deployed preview. For a project whose motto is "stale law is broken law," the
  serving path is the one place the clock actually matters.
- **Shape of work:** Inject a clock at the shell boundary: `handleRoute(method, url,
  process.env.NAV_TODAY ?? isoToday())` in `api/server.ts`; keep `DEFAULT_TODAY` for
  tests/eval only (rename to `TEST_TODAY` to make misuse grep-able). Align
  `/packet`'s `generatedOn` (already real-clock) and guide pages' `reviewed` date.
  Add a regression test that freezes fake timers and asserts a past-SLA record
  degrades on the live route. Decide and document the determinism trade: eval and
  `make freshness` stay pinned; runtime does not.
- **Effort:** S. **Risks/deps:** none technical; the visible effect is that some
  seed records will *immediately* degrade to "needs reverification" on the preview —
  which is the honest state. Coordinate with the seed-content story (ADR-3) so the
  demo doesn't look broken; a banner explaining degradation is **[counsel-gated]**
  only if it re-words legal framing.
- **Excellent looks like:** a test proving SLA lapse degrades a record at runtime
  within 24h of real time crossing it; zero code paths where user-visible currency
  derives from a compile-time constant.

## FIX-03 — Corpus schema v2: canonical records, language variants, structured facets, changelogs
**Pitch:** Make the corpus a real legal-data model instead of parallel prose files.
- **Why it matters:** Three observed weaknesses share one root: (a) ES records are
  independent forks (`spanish.json`) that can silently diverge from EN; (b) legally
  decisive facts — publication requirement, X-marker availability, residency/age
  prerequisites, in-person vs mail vs online — exist only inside free-text
  `statement`/`detail`, so they can't be filtered, matrixed, or gated; (c) record
  edits have no history, so "what changed since date D" is unanswerable. This blocks
  R10/R12/E3/E8 from scaling past 5 states and blocks EXP-03/EXP-06 entirely.
- **Shape of work:** Extend `api/types.ts`/`api/corpus.ts`: `canonical_id` +
  `translation_of` linkage (verification state and source inherited from the
  canonical record; translation carries its own translator/reviewer field);
  optional typed `facets` block (`publication_required`, `x_marker`,
  `residency_days`, `min_age`, `filing_channel[]`) validated by enum; append-only
  `changelog: [{date, change, by}]` per record. Migrate the 32 seed records
  mechanically; update `scripts/content-validate.ts`, `coverage-matrix.ts`,
  `new-record.ts`, and the ES-parity logic in `api/checklist.ts
  hasThinnerLanguageCoverage()` to use the linkage instead of heuristics.
- **Effort:** L (schema + migration + gates), XL if facet backfill is included.
- **Risks/deps:** facet *values* are legal claims — populating them is named-human
  verification work under R1 and **[counsel-gated]** for how they render; the schema
  and migration are structural. Don't let typed facets tempt anyone into
  auto-generating advice ("you are eligible") — facets render as cited facts only.
- **Excellent looks like:** editing an EN canonical record automatically flags its ES
  variant for re-translation (gate fails until reconciled); coverage matrix gains
  facet columns; every record answers "changed since X?" from its changelog.

## FIX-04 — Harden the faithfulness gate against polarity and quantity drift
**Pitch:** Close the two cheapest hallucination channels the model path still has.
- **Why it matters:** `api/citation.ts` treats `not`/`no` as stop words
  (`FAITH_STOP`) and scores bag-of-words precision — a negation flip ("does not
  require" → "requires") or a changed dollar figure/form number inside a long
  sentence passes `requireFaithful` at 0.6 precision. In this domain a flipped
  negation *is* the worst-case harm (e.g., inventing a physician's-letter
  requirement, cf. `ca.court-order.gender-marker` in
  `corpus/jurisdictions/california.json`).
- **Shape of work:** Add deterministic invariant classes to `isFaithfulTo()`:
  (1) numeric/dollar/date literals in a claim must appear in the cited record;
  (2) form identifiers (`NC-100`, `DL 329`, `SS-5` — regexable) must match;
  (3) polarity check — negation particles are removed from the stop list and a
  claim/record negation-scope mismatch on a shared verb/noun stem rejects. Extend
  `tests/bedrock.test.ts` with negation-flip, fee-mutation, and form-swap probes;
  add matching adversarial gold items so `eval/run-bedrock.ts` exercises them.
- **Effort:** M. **Risks/deps:** false positives on legitimate paraphrase — keep the
  classes narrow and measure rejection rate on the offline stub; this is the
  deterministic complement to (not a replacement for) IMPROVEMENT-PLAN §1.3's
  LLM-judge entailment idea. No content changes; not counsel-gated.
- **Excellent looks like:** the three probe classes are provably rejected in
  `make eval-bedrock`; documented residual shrinks from "any semantic drift ≤40% of
  tokens" to "paraphrase without polarity/quantity/identifier change".

## FIX-05 — Gate-efficacy negative controls ("the gates must be able to fail")
**Pitch:** Prove each of the 19 gates still rejects the harm it exists to catch.
- **Why it matters:** The gates are the product's trust story, but
  `scripts/*.ts` themselves have no tests. A refactor that accidentally
  short-circuits `privacy-lint.ts` or widens `disclosure-check.ts` would keep CI
  green while the guarantee silently dies. This is the same honest-confidence logic
  as IMPROVEMENT-PLAN §0, applied to the enforcement layer itself.
- **Shape of work:** A `tests/gate-efficacy/` suite with a poison-fixture set: a
  corpus record missing a source, an uncited claim answer, a PII-logging line, a
  stale-but-verified record, a page missing the disclosure, an unlabeled form
  input, an EN/ES key gap, a non-logical CSS property. A meta-runner invokes each
  gate against its fixture (gates already take dir/file overrides in several cases;
  add injection points where they don't — e.g. `validateCorpus(dir)` already
  supports it) and asserts non-zero exit with the expected message. Run inside the
  normal test stage.
- **Effort:** M. **Risks/deps:** some gates (pa11y, Playwright overflow) are
  browser-bound — cover those with one intentionally-broken fixture page each in CI
  rather than locally. Not counsel-gated.
- **Excellent looks like:** every merge-blocking gate has ≥1 negative control;
  mutating any gate to `return pass()` fails the build.

## FIX-06 — Single source of truth for jurisdictions
**Pitch:** One states registry, everything else derived.
- **Why it matters:** Covered states are hand-listed in `src/pages.ts:13`,
  `src/guide.ts:27`, and implicitly in the corpus; the unmerged branch adds
  `src/states.ts`. Every future state (E8) multiplies drift risk — a state could be
  selectable but guide-less, or covered but not selectable, with no gate noticing.
- **Shape of work:** Promote (post-FIX-01) `src/states.ts` to the single registry:
  `{id, slug, names: Record<Language,string>}` for all 50+DC, with coverage
  *derived* from `loadCorpus()` at render time. Intake select, guide index,
  `guideLinksFor()`, sitemap, and `coverage-matrix.ts` all consume it. Add a lint:
  any corpus jurisdiction absent from the registry (or vice versa where coverage is
  claimed) fails `make content`.
- **Effort:** S–M. **Risks/deps:** FIX-01 first. State display names in ES are
  content but not legal content; not counsel-gated.
- **Excellent looks like:** adding a state's corpus file makes it appear everywhere
  (picker, guides, sitemap, matrix) with zero non-corpus edits.

## FIX-07 — Use the intake the type system already models
**Pitch:** `has_court_order` personalization, client-side and privacy-safe.
- **Why it matters:** `Intake.has_court_order` (`api/types.ts:108`) is dead code.
  People mid-process — a large real segment (USTS: many stall between court order
  and document updates) — currently get a checklist that starts from zero, hiding
  that SSA/DMV/passport are immediately actionable. Prerequisite pruning is the
  cheapest personalization the data model already supports.
- **Shape of work:** Render the question in `renderIntakePage()` (skippable, neutral
  copy), parse it in `parseIntake()` (it is a boolean selection, same privacy class
  as `change_types` — extend `toResumeState`'s allowlist deliberately or exclude
  it), and teach `buildChecklist()` to mark the court-order step "already done"
  (annotate, don't delete — the citations stay visible) and unblock dependents.
  Reflect it in `/packet` and the plan summary cost total.
- **Effort:** M. **Risks/deps:** the *framing* ("you can skip this step") edges
  toward individualized guidance — keep it as prerequisite bookkeeping, and the
  copy is **[counsel-gated]**. Query param adds one non-identifying bit to R6's
  accepted history-leak surface; document in the DPIA.
- **Excellent looks like:** a user with a court order sees steps 1..n annotated
  correctly with no server-side state and no new PII class; eval gains a gold item
  for the pruned path.

## FIX-08 — Safety-UX hardening: quick exit and history hygiene
**Pitch:** Adopt the DV/LGBTQ-resource-sector safety patterns the threat model implies.
- **Why it matters:** The threat model already assumes shoulder-surfing and device
  inspection (`src/secure-resume.ts` header), but the UI has no quick-exit
  affordance, no guidance about browser history, and the tab title announces the
  purpose to anyone glancing at the screen. Sector norm for at-risk audiences
  (shelter/DV sites) is an escape button + history warning.
- **Shape of work:** A dismissible, keyboard-accessible quick-exit control in
  `page()` (`src/render.ts`) that replaces the tab with a neutral site and clears
  in-memory panel state (`location.replace` so the page drops from tab history; be
  honest that full history clearing is impossible from a website — say so rather
  than imply safety). A short "browsing safely" note on `/privacy` (`src/legal.ts`)
  covering private windows and shared devices. Optional neutral-title mode is worth
  prototyping but must be evaluated for whether discovery-of-disguise is worse than
  disclosure.
- **Effort:** M. **Risks/deps:** **must be validated with community orgs before
  shipping** — wrong safety affordances create false confidence (the project's own
  rule: defer and report honestly). Copy is **[counsel-gated]** where it touches
  legal risk framing. No server state involved.
- **Excellent looks like:** quick exit reachable in ≤1 interaction from every page,
  works without JS degradation lies (hidden when JS is off), and the privacy page
  states exactly what it does and does not protect against.

## FIX-09 — Deployment threat-model closure: zero-egress runtime + corpus integrity attestation
**Pitch:** Make "nothing to hand over" true of the infrastructure, not just the code.
- **Why it matters:** RESEARCH-ROADMAP R5 names the edge/CDN-log seam; what no plan
  covers is making the *runtime* incapable of egress: today the privacy invariant is
  a code property (allowlist logger) on infrastructure that could, if compromised,
  exfiltrate. Similarly, corpus integrity is enforced at merge time (reviewed PRs)
  but nothing detects tampering between build and serve.
- **Shape of work:** In `infra/main.tf` (production skeleton): no NAT/IGW route for
  the service unless the Bedrock VPC endpoint is enabled; security groups
  deny-all-egress by default; document Lambda-preview limits honestly in
  `docs/DEPLOY-AWS-PREVIEW.md`. At build: write a manifest hash of
  `corpus/jurisdictions/` + `forms/registry.json` into the image; at boot,
  `loadCorpus()` verifies and alarms via `safeLog("corpus_integrity", …)` on
  mismatch (extends the existing quarantine pattern in `api/server.ts:143`). Extend
  `docs/audits/dpia.md` STRIDE rows for the edge-log and tamper seams.
- **Effort:** M–L. **Risks/deps:** real verification requires the AWS account
  (PRODUCTIONIZATION "blocked on accounts"); the Terraform and attestation code are
  writable now, provable later — report that split honestly. Not counsel-gated.
- **Excellent looks like:** a deploy-time test demonstrating an outbound connection
  attempt from the task fails; boot refuses (or loudly quarantines) a corpus whose
  hash mismatches the build manifest.

## FIX-10 — Forms layer depth: caching, version pinning, and preparation metadata
**Pitch:** Treat official forms as first-class, drift-watched artifacts.
- **Why it matters:** `api/forms.ts` re-reads `forms/registry.json` from disk on
  every `formById()` call (per step, per request — trivial now, wasteful at scale),
  and the registry knows nothing beyond title + URL. Official PDFs get revised;
  users arrive at a form with no idea what documents/copies/payments to bring. The
  honest-forms decision (PR #21/#22 — link, never fake-fill) is right; the layer
  around the link is thin.
- **Shape of work:** Cache the registry like `loadCorpus()` does. Extend `FormDef`
  with `version_hint` (revision string on the official page), `pdf_sha256` +
  `checked` (populated by extending `scripts/source-watch.ts` to fetch form URLs —
  it already hashes source pages), and a typed `preparation` list ("certified copy
  of court order", "payment accepted: …") rendered on `renderFormFillPage()` with
  citations. Weekly content-watch flags form-hash drift as its own issue class.
- **Effort:** M. **Risks/deps:** `preparation` values are legal content —
  **[counsel-gated]** and verifier-gated like any record; hashing/caching is
  structural. PDFs may be served via anti-bot CDNs; tolerate fetch failures the way
  `link-check.ts` does.
- **Excellent looks like:** a revised NC-100 PDF produces a labeled issue within a
  week; every form page lists what to bring, cited; zero per-request disk reads.

## FIX-11 — Metamorphic eval suite: invariance and sensitivity properties
**Pitch:** Test the *relationships* between answers, not just fixed gold points.
- **Why it matters:** IMPROVEMENT-PLAN §1.4 grows gold items; what point-based gold
  can't catch is relational failure: a paraphrased question changing the answer, a
  jurisdiction swap *not* changing it (CA guidance leaking into TX), EN and ES
  citing different record sets for the same query, or `documents` filtering
  widening results. These are the failure shapes retrieval swaps (embedding
  backend, D3) will introduce.
- **Shape of work:** A property layer in `eval/` that runs paired queries through
  `answer()` and asserts invariants: paraphrase-stability (same cited record ids),
  jurisdiction-sensitivity (disjoint state-level citations), language-consistency
  (EN/ES cite canonical-linked records — depends on FIX-03 linkage),
  filter-monotonicity (adding a `documents` filter never adds citations). Run for
  both retrievers (`retrieve`, `embeddingRetrieve`) so the seam swap is gated on
  preserved properties, extending the harness's fail-closed reporting.
- **Effort:** M. **Risks/deps:** paraphrase sets are cheap to author and are *not*
  legal claims (not counsel-gated); language-consistency needs FIX-03.
- **Excellent looks like:** the embedding-retriever swap (PRODUCTIONIZATION Phase
  2.2) cannot merge unless all metamorphic properties hold on both backends.

## FIX-12 — Truth-in-numbers cleanup and a gate-count self-check
**Pitch:** Make the repo's self-description as precise as its enforcement.
- **Why it matters:** `README.md` claims "14 automated merge gates"; `make verify`
  runs 19 stages; Makefile stage comments disagree with themselves (`[1/17]` …
  `[12/19]`). Tiny, but this project's differentiator is that its claims audit
  clean — reviewers *will* count.
- **Shape of work:** Derive the number: a tiny script (or extension of
  `scripts/lint.ts`) parses the `verify:` prerequisite list in the `Makefile`,
  regenerates the stage banners, and fails if README's stated count differs.
  Sweep `docs/STATUS.md` (says 12 gates), `.github/PULL_REQUEST_TEMPLATE.md`, and
  workflow comments in the same pass.
- **Effort:** S. **Risks/deps:** none; not counsel-gated.
- **Excellent looks like:** one authoritative gate count that cannot drift, and a
  CI failure if anyone hard-codes it again.

**Status: ✅ Done** (`roadmap/fix-12-derive-the-gate-count-and-fix-sel`). New
`scripts/gate-count.ts` gate parses the `verify:` prerequisite list straight off the
Makefile (handling backslash line-continuation), fails if it can't find itself in that
list, and cross-checks the derived count against `README.md`'s "N automated merge
gates" line, `docs/STATUS.md`'s "N/N gates" and "N-stage blocking pipeline" strings,
and any hard-coded gate/stage count in `.github/PULL_REQUEST_TEMPLATE.md`. Wired in as
stage 1 of `verify:` so drift is caught before anything else runs. Makefile stage
banners renumbered uniformly to `[n/21]` (was a `[n/17]`/`[n/19]` split, then `main`
independently added the `loadtest` stage); README and STATUS corrected from the stale
14/12/11 counts to the true 21. Verified the gate fails on a reverted count and passes
clean; `make verify` is green end-to-end at 21/21.
