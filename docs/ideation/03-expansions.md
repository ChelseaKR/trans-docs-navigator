# Expansions (EXP-01 … EXP-16)

> Drafted 2026-07-01. Three horizons: **H1** deepen the core · **H2** adjacent
> capabilities/audiences/integrations · **H3** transformative bets. Net-new relative to
> ROADMAP.md §3/§8 and RESEARCH-ROADMAP R/E items; where an idea builds on one, the ID
> is cited. Effort: S/M/L/XL. Gates: **[counsel-gated]** = counsel/UPL review before
> shipping · **[verifier-gated]** = named-human verification of content ·
> **[community-gated]** = validation with real trans users/orgs.

---

## Horizon 1 — deepen the core

### EXP-01 — Offline-capable shell, threat-model-first
**Pitch:** Deliver ROADMAP §6's promised offline PWA — as a privacy feature, not a
convenience feature. (`site.webmanifest` exists; no service worker or plan item does.)
- **Impact:** Users in hostile jurisdictions or with poor connectivity can re-read
  a saved checklist while offline without generating fresh network traffic. The
  initial explicit save does make disclosed same-origin page/shell requests; clinics
  can then use the local copies without background synchronization.
- **Shape:** Service worker with cache-only strategy plus an explicit, user-initiated
  "save for offline" action whose initial same-origin fetch is disclosed — never
  background sync or push (new observability
  surfaces). Cached pages carry a burned-in "saved on DATE — laws change" banner
  keyed to `api/freshness.ts`. Document the forensic trade-off (cached content is
  device-discoverable) on `/privacy`, alongside the threat-model note in
  `src/secure-resume.ts`.
- **Effort:** L. **Risks/deps:** FIX-02 first (frozen clock makes staleness banners
  meaningless); cache-vs-forensics question goes to the DPIA and is
  **[community-gated]**; banner copy **[counsel-gated]**.
- **Excellence bar:** intake→checklist→packet works airplane-mode after one visit;
  every offline render shows save date + expiry warning; DPIA row signed.

### EXP-02 — Single-file portable edition ("sneakernet build")
**Pitch:** `make portable` emits one self-contained HTML file of the whole navigator.
- **Impact:** Strongest possible posture for the most at-risk users — no request to
  any server, ever; shareable via USB/AirDrop channels community orgs already use.
  Feasible today: the corpus is 32 records. No existing plan touches this.
- **Shape:** Build script inlining `STYLE` (`src/render.ts`), the corpus, and the
  checklist engine (`api/checklist.ts` is pure) into one file. Burn in build date +
  integrity hash; evaluate freshness against the *device* clock so records degrade
  even offline. Publish per-release as a signed artifact in `release.yml`.
- **Effort:** L. **Risks/deps:** engine-drift risk — bundle the same TS source and
  run the gold set against the portable build in CI; stale copies circulating is
  the real hazard → aggressive built-in expiry messaging **[counsel-gated]**;
  distribution guidance **[community-gated]**.
- **Excellence bar:** `file://` with network disabled matches the server's checklist
  and citations on all gold queries; a copy older than the longest SLA visibly
  refuses to present itself as current.

### EXP-03 — "Has the law changed since my packet?" staleness checker
**Pitch:** A privacy-safe re-check surface keyed to the packet's `generatedOn` date.
- **Impact:** The printable packet starts rotting when it prints; users mid-process
  have no way to ask "is this still right?" short of redoing intake and diffing by
  eye.
- **Shape:** Print a compact URL/QR on the packet (`/changes?since=DATE&` + the
  existing selection-only `intakeQuery()` fields). The route compares `since` against
  per-record changelogs (FIX-03) and renders "unchanged / re-verified / CHANGED —
  see step N" with citations. No server state.
- **Effort:** M (after FIX-03). **Risks/deps:** FIX-03 changelog is a hard
  dependency; change summaries are legal content **[counsel-gated]**
  **[verifier-gated]**; adds one low-sensitivity bit to the R6 query-param surface.
- **Excellence bar:** any changelogged corpus edit reflects in `/changes` the same
  deploy; a packet QR answers in one page.

### EXP-04 — Verifier workbench: make named-human verification cheap
**Pitch:** Purpose-built tooling for the R1 bottleneck — the gate everything waits on.
- **Impact:** R1 is expensive partly because the workflow is raw JSON plus manual
  source reading; asking a legal-aid partner (E4) to verify 32+ records in a text
  editor stalls the partnership. Making one verification a 5-minute act converts
  the scarcest resource — expert attention — into signed records.
- **Shape:** Local-only CLI/mini-app (never deployed): record vs live source
  side-by-side (reusing `scripts/source-watch.ts` fetching and
  `corpus/source-hashes.json`), snapshot capture, then one-step write of
  `last_verified`, roster-validated verifier, and changelog entry (FIX-03),
  emitting a ready-to-review PR branch. Partner onboarding docs.
- **Effort:** L. **Risks/deps:** must never auto-approve — the human reads, the tool
  does bookkeeping; verification itself stays **[verifier-gated]** by definition.
- **Excellence bar:** a pilot verifier completes a jurisdiction (~6 records) in
  under an hour, producing a PR that passes `make content` untouched.

### EXP-05 — Policy-change sentinel: watch the watchers ✅ Implemented
**Pitch:** Monitor authoritative trackers (MAP, A4TE, legislative feeds) as an
early-warning layer beside per-URL source-watch.
- **Status:** done — `scripts/policy-watch.ts` mirrors `source-watch.ts`'s normalize
  + hash + baseline-diff pattern against `corpus/policy-trackers.json` (a hand-curated
  MAP/A4TE tracker config, seeded with 3 real URLs), comparing against the committed
  baseline `corpus/policy-hashes.json`. On drift it reports every record whose
  `jurisdiction` matches the tracker's, e.g. "tracker '…' changed for US — records
  …, … may be affected." Wired into `content-watch.yml` as a fourth `continue-on-error`
  step (`policy`) with its own `## policy-watch` issue section and `make policy-watch`
  / `make policy-baseline` Makefile targets. Humans decide; nothing auto-edits.
- **Impact:** `content-watch.yml` only sees drift on *cited* pages; law often changes
  upstream (statute amended, fee schedule moved) while the cited page sits
  stale-but-unchanged. RESEARCH-ROADMAP's evidence leans on MAP's daily tracker;
  the repo never operationalized it.
- **Shape:** `scripts/policy-watch.ts` in the weekly workflow: fetch a small config
  of per-jurisdiction tracker URLs, diff against baselines (the `source-watch.ts`
  pattern), and annotate the content-watch issue with "tracker changed for US-TX —
  records X,Y may be affected." Humans decide; nothing auto-edits.
- **Effort:** M. **Risks/deps:** third-party page churn (tolerate, like
  `link-check.ts`); respect trackers' ToS. No user-facing surface — not
  counsel-gated; responses to alerts are R1 work.
- **Excellence bar:** a simulated tracker change yields a correctly-scoped issue
  within one weekly cycle; false-alarm rate stays actionable over a quarter.

### EXP-06 — Structured requirement facets surfaced honestly
**Pitch:** Render FIX-03's typed facets (publication requirement, X-marker,
fee-waiver path, filing channel) as cited fact chips and coverage-matrix dimensions.
- **Impact:** Goes beyond R12 (per-record wording): typed facts give at-a-glance
  "publication: required (waivable — source)" instead of prose excavation, and
  `docs/audits/coverage.md` gains facet columns — a public, honest "what we don't
  know yet" grid.
- **Shape:** Facet chips in `renderChecklist()`/`renderPacket()` under the same
  `enforce()` discipline — a facet without a backing record does not render;
  matrix columns in `scripts/coverage-matrix.ts`; gold items for known cases (IL
  publication waiver, CA X-marker).
- **Effort:** M (after FIX-03). **Risks/deps:** facet values are
  **[verifier-gated]** **[counsel-gated]** content; rendering is structural. An
  absent facet renders "not yet verified", never "no".
- **Excellence bar:** zero chips render without a resolvable citation; matrix shows
  facet completeness per jurisdiction.

## Horizon 2 — adjacent capabilities, audiences, integrations

### EXP-07 — Partner read-API and embeddable cited-checklist widget
**Pitch:** Let legal-aid orgs consume the corpus machine-readably and embed the
checklist with the guarantees structurally attached.
- **Impact:** E4 plans a partner *page*; the bigger prize is distribution through
  partners' own sites with citations, freshness, and disclaimers inseparable from
  the content — reach multiplied without this project holding all the trust alone.
- **Shape:** Versioned read-only JSON (`/api/v1/corpus`, `/api/v1/checklist?…` with
  the `parseIntake()` query grammar); responses embed source, `last_verified`,
  verification status, and disclosure strings as required fields; a web-component
  widget rendering via `renderChecklist()`. Existing rate limiter applies.
- **Effort:** L. **Risks/deps:** **[counsel-gated]** — terms must bind consumers to
  information-not-advice framing and forbid stripping citations; serving unverified
  seed data repeats residual risk R4 — gate on per-jurisdiction `launch_cleared`
  or label responses machine-readably as unverified.
- **Excellence bar:** an embedded checklist visibly degrades when a record does;
  provenance fields are non-optional keys in every response.

### EXP-08 — Corpus as a versioned, signed public dataset — ✅ DONE
**Pitch:** Publish the corpus — schema, changelog, signatures — as a first-class
open-data artifact.
- **Impact:** ROADMAP §11's "the verified corpus + methodology remain a reusable
  public asset" is currently only true via git archaeology. A released dataset lets
  researchers, journalists (persona A3), and other tools build on the verification
  work, and makes the trust story inspectable.
- **Shape:** Per release: JSON Schema derived from `api/types.ts`, records,
  `VERIFIERS.json`, changelog (FIX-03), diff-since-last-release, and a signature/
  provenance attestation — extending `release.yml`'s SBOM pattern. `CITATION.cff`
  exists; add a dataset DOI (Zenodo) later.
- **Effort:** M. **Risks/deps:** must carry the data-card's per-jurisdiction
  verified/unverified labeling — releasing seed data unlabeled would be the exact
  dishonesty the repo defines itself against; labeling text lightly
  **[counsel-gated]**.
- **Excellence bar:** a third party can validate any release offline and diff two
  releases to see exactly which legal facts changed and who verified them.
- **Status:** Release pipeline shipped; public distribution awaits repository
  visibility. `scripts/dataset-build.ts` assembles a release bundle
  (`schema.json`, `records.json`, `verifiers.json`, `labels.json`, `manifest.json`
  with per-file sha256 + `corpus/source-hashes.json` provenance) under `dist/dataset/`,
  reusing `api/corpus.ts`'s fail-closed validator so a release can never ship a record
  the `content` gate would reject. `labels.json` is mechanically derived per
  jurisdiction from `verification_status` counts and the `placeholder:true` roster
  flag (`mechanical_verification_complete:false` wherever any record is unverified or
  uses a placeholder); `launch_cleared` always remains false because a build script
  cannot grant a human/counsel gate. No new legal wording is introduced, matching
  `docs/audits/data-card.md`. `scripts/dataset-diff.ts`
  diffs two releases (dirs, records.json paths, or a `git:<ref>` snapshot of
  `corpus/jurisdictions/`) keyed by record `id` into `changelog.md`/`diff.json`,
  surfacing which `statement`/`verification_status`/`verifier` fields changed and by
  whom — satisfying the excellence bar. `.github/workflows/release.yml`'s new
  `dataset` job runs the build on the same `tags: v*` trigger after full verification,
  uploads each file to the tagged GitHub Release (and as a workflow artifact), and
  attests keyless build provenance via
  `actions/attest-build-provenance` (OIDC; only `id-token: write` +
  `attestations: write`, no secrets) — mirroring the SBOM job. `npm run dataset:build`
  / `dataset:diff` and `make dataset` wrap the same scripts locally. Tests in
  `tests/dataset.test.ts` assert the bundle's shape, schema-validity, verifier-roster
  membership, mechanical-verification labels, and the never-auto-grant-launch invariant.
  GitHub Release assets inherit this repository's current private visibility, so calling
  them a public download today would be false. Zenodo DOI minting and the repository-
  visibility decision remain open — this ships the build/sign/diff/release pipeline
  those distribution steps attach to.

### EXP-09 — Clinic mode for legal-aid workshops
**Pitch:** A facilitation view for people who already run name-change clinics.
- **Impact:** TLDEF-style clinics (persona S1) process many people in one room; a
  projector walkthrough + batch packet printing fits their real workflow and is the
  natural first distribution channel — while collecting nothing about attendees.
- **Shape:** `/clinic`: large-type walkthrough (a display stylesheet mode in
  `src/render.ts`), N-copies printing over `/packet`, and a facilitator crib sheet
  generated from corpus records only. No attendee inputs, no roster, no accounts.
- **Effort:** M–L. **Risks/deps:** **[community-gated]** — build with a real clinic
  partner or not at all (RESEARCH-ROADMAP validation question #1); crib-sheet
  content **[counsel-gated]** **[verifier-gated]**.
- **Excellence bar:** a real clinic runs a session and reports it beat their current
  handouts; privacy gates prove zero new data flows.

### EXP-10 — Supporter view for the people helping
**Pitch:** A mode for partners/parents/case-workers — ROADMAP §2's named-but-unserved
secondary audience.
- **Impact:** Helpers get first-person UI ("your state") that is wrong for a parent
  or case worker — and helper-mediated use is how low-literacy/low-connectivity
  users (personas S3, U5) actually reach tools like this.
- **Shape:** A view toggle (selection-only query param) switching to supporter-framed
  strings (the `LocaleBundle` structure in `src/i18n/types.ts` makes a parallel
  message set cheap), plus "how to help without taking over" guidance and prominent
  referrals. Explicitly not a caseload tool; no storage.
- **Effort:** M. **Risks/deps:** minor/parental-consent adjacency —
  **[counsel-gated]**; defer minor-specific facts to E3; **[community-gated]**.
- **Excellence bar:** copy tested with at least one navigator/case worker; gates
  prove no new PII surface.

### EXP-11 — Tor onion mirror and censorship-resilient distribution
**Pitch:** An official `.onion` deployment plus documented mirroring.
- **Impact:** For users whose network is observed, even TLS metadata to this domain
  is a disclosure. The threat model names hostile jurisdictions; no existing plan
  addresses network-level observability.
- **Shape:** The app is stateless with CSP `'self'` everywhere
  (`api/server.ts SECURITY_HEADERS`), so mirroring is simple: Tor sidecar in
  `infra/`, `Onion-Location` header on clearnet, key-custody runbook in
  `docs/OPERATIONS.md`. Pairs with EXP-02 as the two ends of the
  censorship-resilience spectrum.
- **Effort:** M. **Risks/deps:** onion key becomes a new operational secret;
  **[community-gated]** on whether target users actually use Tor. Not
  counsel-gated.
- **Excellence bar:** the mirror passes the full `scripts/smoke-journey.ts`; uptime
  tracked like the clearnet preview.

### EXP-12 — Transparency report and legal-demand canary — **Status: Shipped**
**Pitch:** Publish a fixed-cadence architecture inventory of what records the reference
build may create, what remains local-only, and which provider boundaries remain.
- **Shipped:** `/transparency` (`src/transparency.ts`, routed in `api/router.ts`,
  linked from every page footer) with a dated Q2 2026 architecture snapshot. It lists
  request URLs, bounded process-local caches, allowlisted application logs and retention,
  possible provider metadata, plus identity-form/resume local boundaries and the explicit
  same-origin fetch that creates offline copies. It does not publish legal-demand statistics and makes no "could not be
  produced" promise. No canary wording shipped; counsel approval remains open. Future
  quarters are appended by PR to the locale bundles (`src/i18n/en.ts`/`es.ts`).
- **Impact:** A standing transparency page makes the minimization architecture and its
  residual provider/browser boundaries independently checkable by users and partners.
- **Shape:** A `/transparency` page (static, in-repo like `src/legal.ts` pages) with
  dated quarterly entries via PR, each tied to the current DPIA and residual-risk
  register revisions.
- **Effort:** S. **Risks/deps:** canary wording is legally delicate —
  **[counsel-gated]** hard, and counsel may veto the canary (accept that; ship the
  report without it). A canary you can't update honestly is worse than none.
- **Excellence bar:** cadence kept for a year without a missed or fudged entry; the
  page states exactly what *could* be produced under compulsion (edge logs, host
  metadata) per FIX-09's DPIA work.

### EXP-13 — Language-justice pipeline (beyond ES parity)
**Pitch:** Turn "a new language is one bundle + records" into a governed workflow
with translation memory and verified-translation gates.
- **Impact:** R10/E7 are content items; the missing piece is the *system* keeping
  translations correct over time. With FIX-03's canonical/variant linkage,
  translation staleness becomes machine-checkable — the difference between "we
  shipped Spanish" and "Spanish cannot silently rot."
- **Shape:** Gate: editing a canonical record fails `make content` until each
  variant carries a fresh reviewer + date. Tooling: per-record translation
  worksheets and a reviewed legal-term glossary per language; wire
  `scripts/readability.ts` per-variant.
- **Effort:** M (after FIX-03). **Risks/deps:** translations are content
  correctness — **[verifier-gated]** (IMPROVEMENT-PLAN §4.1 already rides them on
  the verifier gate); the pipeline itself is structural.
- **Excellence bar:** a PR editing one EN record is unmergeable until its ES variant
  reconciles; onboarding a translator needs no repo knowledge beyond the worksheet.

## Horizon 3 — transformative bets

### EXP-14 — Extract the engine: a grounded-checklist kit for civic domains
**Pitch:** Generalize the retrieval-mandatory + citation-enforced + freshness-gated
checklist engine and feed it back into the portfolio's starter kit.
- **Impact:** `api/` is already framework-agnostic (ADR-5) and domain logic is
  data-shaped. The same machinery fits other high-stakes navigators (expungement,
  benefits documentation, voter ID). Exporting the pattern is the portfolio
  flagship's strategic multiplier — and forces clean seams here.
- **Shape:** Extract `types/corpus/retrieval/citation/freshness/checklist` as a
  package (or upstream into civic-rag-starter-kit) with the domain supplied as
  schema + data; this repo remains the reference consumer with gates unchanged.
  The kit ships the gate scaffolding, not just the engine.
- **Effort:** XL. **Risks/deps:** premature abstraction — wait for FIX-03 to settle
  the schema; every consuming domain is independently **[counsel-gated]**
  **[verifier-gated]**, and the kit must make those gates non-optional in code.
- **Excellence bar:** a second domain reaches `make verify`-green with zero engine
  forks; this repo's gate suite passes unchanged on the extracted kit.

### EXP-15 — Federated verification: multi-org co-signing of records
**Pitch:** Several independent organizations attest the same record, with a public
transparency log — trust that scales past one roster.
- **Impact:** One named verifier per record (`corpus/VERIFIERS.json`) is both a
  bottleneck and a fragile point at 50-state scale. Threshold attestation ("2 of 3
  orgs re-verified on 2026-09-01") is how the corpus becomes civic infrastructure
  other tools cite, and upgrades E4's partners from "helps us" to "co-owns the
  truth."
- **Shape:** Extend `Source` to multiple attestations
  `{verifier, org, date, snapshot_hash, signature}`; verify signatures in
  `make content` (sigstore-style keyless fits the SHA-pinned supply-chain posture);
  publish an append-only attestation log with releases (EXP-08); UI renders
  "verified by N organizations."
- **Effort:** XL. **Risks/deps:** requires ≥2 real partner orgs; disagreement
  between attesters must surface honestly, never be picked silently (the
  `pickCost()` principle in `api/checklist.ts`); **[verifier-gated]** by
  construction, presentation **[counsel-gated]**.
- **Excellence bar:** a record's attestation chain verifies offline; a lapsed org's
  attestations age out via the SLA machinery instead of lingering as false
  confidence.

### EXP-16 — Fully client-side question answering (on-device model path)
**Pitch:** Port retrieval, generation, and `citation.enforce()` into the browser so
even *questions* never leave the device.
- **Impact:** The free-text `q` on `/answer` is the one expressive user input that
  reaches the server (the R6 residual). An on-device path reduces the server to
  static delivery — the categorical endpoint of the privacy architecture and a
  novel demonstration for the responsible-AI portfolio.
- **Shape:** Stage 1 (deterministic): port `retrieve()` + `GroundedComposer` +
  `enforce()` to a browser module over the embedded corpus — feasible now; pairs
  with EXP-01/EXP-02. Stage 2 (model): a small local model behind the *identical*
  post-generation gate (the `Generator` seam in `api/generator.ts` was built for
  substitution), degrading to Stage 1 on weak devices. Docs stay honest: the gate
  guarantees groundedness, not helpfulness, and small-model quality is unproven.
- **Effort:** XL (Stage 1 alone: L). **Risks/deps:** double-implementation drift
  (same mitigation as EXP-02); model download size is itself a network observable
  for the DPIA; eval must run against the client path (extend FIX-11). Output
  framing **[counsel-gated]**; **[community-gated]** for trust.
- **Excellence bar:** Stage 1 — `/answer` parity on the gold set with the network
  tab empty after load. Stage 2 — the `tests/bedrock.test.ts` rejection analogues
  pass against the on-device model in CI.
