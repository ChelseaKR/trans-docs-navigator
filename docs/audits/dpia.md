# Data Protection Impact Assessment (DPIA) — Trans Docs Navigator

> **DRAFT — re-issued 2026-07-17 · Human review-gated sign-off: PENDING. No DPO/privacy
> signature exists for this document, and no human judgment was simulated in producing
> this draft: every inventory and control row below is mechanically derived from the
> cited implementation files and tests. Signing off remains a human act, recorded only
> via `docs/signoffs/` (see `scripts/launch-gates.ts`) — never by editing this file.**
>
> Instantiates RESPONSIBLE-TECH-FRAMEWORK §C for a hostile-jurisdiction threat model.
> Recheck cadence: per data-flow change.
> This re-issue supersedes the 2026-05-31 document plus its appended notes (2026-07-05
> staleness note, 2026-07-09 feature rows, 2026-07-12 accuracy correction) — see §0.

## 0. Revision history (provenance of this draft)

| Date | Change | Nature |
|---|---|---|
| 2026-05-31 | Original DPIA issued | Baseline; never human-signed |
| 2026-07-05 | Staleness note + rows for encrypted save/resume (`src/secure-resume.ts`) and the offline shell (`src/offline.ts`) | Mechanically derived from code; not a re-verification |
| 2026-07-09 | Rows for client-side `.ics` reminders and the per-step report-an-error link | Mechanically derived from code; not a re-verification |
| 2026-07-12 | Accuracy correction: earlier "nobody server-side"/"collects nothing" wording was too broad for a server-rendered app; request/cache/log boundaries restated factually | Factual correction |
| 2026-07-17 | **This re-issue**: the stacked notes above folded into one coherent document; inventory re-derived from source, adding the surfaces landed 2026-07-12..14 — relocation planner (`/move`, `/plan`), `/metrics` endpoint, W3C trace context, content-free GenAI telemetry, bounded render memoization (`api/cache.ts`), and the recorded decision **not** to ship the NPPES care-density lookup | Mechanical re-inventory; **not** a sign-off |
| 2026-09-05 | Row for the "which state?" comparison (`/compare`, `api/compare.ts`) — the relocation planner's inverse: documents/change types plus an optional single "current state" (no origin→destination pair, so it does not get the relocation posture; `current` joins `jurisdiction` on the `api/log.ts` allowlist at the same sensitivity class) | Mechanically derived from code; not a re-verification |

The companion stale artifact named alongside this one in the 2026-07-05 remediation —
the manual accessibility walkthrough (`docs/audits/accessibility-2026-05-31.md`) —
requires a real person at a screen reader and is **not** advanced by this draft.

## 1. Data inventory (default mode)

| Data | Where it lives | Retention | Who can access |
|------|----------------|-----------|----------------|
| Checklist selections (state, change types, documents, language, has-court-order bookkeeping bit) | Browser memory/history + GET URL; transient server processing; selection-only checklist/answer output and canonical selection key may enter the bounded process-memory render cache (`api/cache.ts`: hard size cap, oldest-first eviction, process-local, cleared on corpus change); allowlisted fields enter application logs | Cache: until eviction or process restart. Application logs: 14 days in the live preview (`infra/preview/main.tf`); 30 days in the production template (`infra/main.tf`). Browser/edge-provider retention is independent | Application process/operators; hosting or edge providers may see request/network metadata |
| Compare selections (documents, change types, optional single current-state, sort preference — GET `/compare`, `api/compare.ts`) | Browser memory/history + GET URL; transient server processing only — **not memoized** (unlike the checklist row above, kept simple rather than cached); allowlisted fields (including `current` and `sort`) enter application logs | No render-cache entry. Application logs: 14 days in the live preview; 30 days in the production template. Browser/edge-provider retention is independent | Application process/operators; hosting or edge providers may see request/network metadata |
| Optional free-text question (`q` on GET `/answer`) | Browser memory/history + GET URL; transient server processing. It deliberately bypasses the render cache and raw text is excluded from application logs and rendered responses. A configured Bedrock path would also send the question and retrieved public corpus context to AWS | No application persistence. Browser, proxy, edge, or model-provider retention may exist under separate policies | Application process while handling the request; infrastructure/model providers where configured |
| **Relocation intake (`origin`, `destination`, held documents, change types, language — GET `/plan`; form at `/move`)**. An (origin → destination) pair is timestamped intent to leave a state — the single most sensitive selection this app can process, and it gets the strictest posture in the app | Browser memory/history + GET URL; transient server processing only. **No route-level log descriptor is emitted at all** (not a redacted one — none; `api/log.ts`'s allowlist additionally has no `origin`/`destination` field, a second independent lock). The generic per-request access-log line and the `/metrics` counters record these requests only under the bounded route template, which does not include the relocation routes — they serialize as `_unmatched` (`api/metrics.ts` `metricRoute`), so neither the route name nor any query content enters logs or metrics. **The plan render is deliberately not memoized** (a memo key is retention), and the page offers **neither** the unencrypted offline save **nor** the encrypted save/resume blob — print-and-go instead. `noindex` + `robots.txt` `Disallow` | No application persistence of the pair in any form. The GET URL may still persist in browser history and upstream proxy/edge/provider access records under their own retention | Application process while handling the request; hosting/edge providers may see the full URL and network metadata. In-product disclosure on `/move` states the no-save/no-log posture (copy PENDING counsel review, like all user-facing legal/safety copy) |
| Identity data typed into the on-device form helper (current/new legal name and other form details) | **Browser memory only**; copied locally into the official form workflow | None — the helper does not transmit it | The user, on their device. This boundary does not cover text voluntarily entered into `q` |
| Application logs | stdout structured JSON via `api/log.ts`, then CloudWatch in the provided deployments. Fixed fail-closed allowlist: route/status/latency and selection metadata; plus (2026-07-12..13 additions, all content-free) W3C trace identifiers (`trace_id`/`span_id`/`parent_span_id` — random hex or supplied by fronting infrastructure via `traceparent`; `api/trace.ts`), GenAI usage telemetry (token counts, model ids, finish reason, estimated cost — the record type structurally accepts no content fields and stamps `content_captured: false`; `api/genai-telemetry.ts`), and corpus-integrity digests (hex hashes only). `path`/`route`/`method`/span names are normalized to bounded templates before serialization so attacker-controlled URL segments cannot become a content side channel. Excludes raw `q`, identity-form fields, client IP, and all relocation fields | 14 days in `infra/preview/main.tf`; 30 days in `infra/main.tf` | Operators and the hosting provider. Trace ids exist to correlate one request across operator systems; they carry no user content |
| **Operational metrics (GET `/metrics`)** | Process-local aggregate RED counters in Prometheus text format, keyed by (method, bounded route template, status) plus latency sums and an active-request gauge (`api/metrics.ts`). No per-request records, no query content, no identifiers; relocation routes aggregate into `_unmatched` | Process lifetime only (in-memory; reset on restart). Anything a scraper stores is under the operator's retention | Anyone who can reach the endpoint (it is unauthenticated in-app): operators, and network neighbors in a deployment that does not restrict it at the edge. Exposes aggregate traffic patterns only |
| Client IP address | Read per-request for the in-process rate limiter (bounded in-memory map, `api/server.ts`); **not** on the log allowlist, so it never enters application logs | Process memory only, bounded map | The application process transiently; hosting/edge providers record IPs independently under their own policies |
| Save/resume selections (jurisdiction, change types, documents, language, court-order bit — `ALLOWED_KEYS` in `src/secure-resume.ts`) | Browser `localStorage`, **AES-GCM encrypted** with a PBKDF2 (600k-iteration) passphrase-derived key (`public/assets/resume-crypto.js`) | Until the user clears it (one-click "clear" in the resume panel) or clears site data | The user, on their device; a forensic/shoulder read of `localStorage` sees only ciphertext without the passphrase. Identity fields are stripped server-side by `toResumeState()` before anything is offered to save — names never enter this path. Not offered on relocation plans |
| Offline-saved pages (explicit "Save for offline" only — `src/offline.ts`) | On an explicit tap, worker installation fetches same-origin shell assets and `public/assets/offline.js` fetches the configured checklist/packet URLs. Those requests receive normal server/provider handling. Resulting pages live **unencrypted** in browser Cache Storage (`tdn-saved-v1`) | Local copies remain until the user presses "delete all saved pages," which clears every cache and unregisters the worker. Application/provider records from the save requests follow their own retention | The application/provider can observe the explicit save fetches; afterward the user and anyone with device/browser-profile access can read the unencrypted copies. The worker never writes during its fetch handler and has no background sync/push/periodic-sync listeners (enforced by `tests/offline.test.ts`). Not offered on relocation plans |
| Downloadable `.ics` reminders (explicit button tap only — `public/assets/reminders.js`): an unencrypted calendar/to-do file holding the checklist **step names only** — no dates, no contact fields, no identity data, built entirely in-page via a `data:` URL | The user's own filesystem/Downloads (this app never stores or receives it; zero egress from the app, backstopped by CSP `connect-src 'self'` and `tests/reminders.test.ts`) | Until the user deletes the file — outside this system's control once saved | The user; anyone with device access (file is cleartext); **and — the file's purpose is calendar import — if imported into a cloud-synced calendar (the common case), the step names replicate to the calendar provider and to anyone with calendar visibility or shared-calendar access.** Mitigations: neutral filename (`reminders.ics`), neutral `PRODID`/`UID` (no product branding on the artifact), disclosure note beside the button stating the cloud-calendar consequence (copy PENDING counsel review) |
| Per-step "report an error / law changed" link (OFF by default — renders only when the operator sets `REPORT_ERROR_LINKS=on`; see `reportErrorLinksEnabled()` in `src/render.ts`). When enabled, each checklist step carries an outbound link to a prefilled GitHub issue whose title holds jurisdiction + document type only — selection metadata with no direct identity fields or session free text, but still sensitive context | Nothing is stored by this app and nothing is sent by this app on page render. **If the user clicks:** github.com receives the prefilled URL and logs it against the visitor's IP/session; a filed issue is **public** and permanently tied to the reporter's GitHub identity. Mitigations: global `referrer-policy: no-referrer` (the user's checklist URL never accompanies the click), `rel="noopener noreferrer"`, and a destination-disclosure note rendered structurally beside the link (copy PENDING counsel review) | GitHub's retention — outside this system's control | GitHub, and (for a filed issue) the public. Flow is inactive while the repo is private; enabling it is an owner decision coupled to the repo-visibility decision |

**Response metadata:** every rendered HTML response carries a `Content-Language` header
declaring the resolved rendered language (`api/server.ts`, added 2026-07-05 — see
`docs/I18N.md` G11). It restates the `?language=` selection already present in the URL
and introduces no new collection.

**Rejected data flow, recorded so it stays rejected:** a care-continuity provider-density
signal (NPPES/CMS lookup by destination) was considered for the relocation planner and
**deliberately not shipped** — querying it would disclose the plan's destination to a
third party at the moment of planning, and the signal cannot support the inference users
would draw from it. The decision, its two blockers, and the unblock condition are held in
`api/care-density.ts` (inert by construction), and `tests/relocation.test.ts` asserts no
runtime module reaches the NPPES host, so the flow cannot be added quietly.

**Dedicated server-side identity fields: 0; arbitrary request text is not guaranteed
PII-free.** Form-fill identity inputs are client-side (`src/pages.ts` and
`public/assets/form-copy.js`) and that feature never transmits them. The optional `q`
parameter is free text and can contain identifying data if a user types it, so the server
cannot honestly be described as categorically PII-free. The controls instead prove that
raw `q` is not cached, application-logged, or echoed, and the UI warns users not to enter
identity details there.

## 2. Threat model (hostile jurisdiction)
Assume an adversary with subpoena power or breach access. **The defense is aggressive
minimization, not a promise that no record exists.** There are no accounts or identity
database; form-fill is client-side; raw questions and identity-form fields are excluded
from application logs. Checklist selections and questions still travel in GET URLs, and
selection metadata is retained in bounded application logs as described above. The
relocation planner tightens this further for its (origin → destination) pair — zero
application-side retention in logs, metrics, caches, or offered on-device copies — but
cannot remove the GET-URL transit surface (browser history, provider access records).

## 3. Controls & enforcement
| Control | Enforcement |
|---------|-------------|
| Runtime API code does not read dedicated identity-form fields; raw `q` is not cached or echoed | **Auto-gated:** `make privacy` rejects direct identity-field references across runtime API code; route tests prove free-text questions bypass the cache; the sentinel data-flow test proves request text is not reflected |
| No raw question or identity-form field in application logs | **Auto-gated:** `make privacy` scans log calls; `api/log.ts` uses a fixed fail-closed allowlist; the runtime sentinel test injects identity-shaped fields and raw question text and proves neither reaches log descriptors/output |
| Relocation plans: no log descriptor, no render-cache entry, no offline/save-resume offer, `noindex` + no share card | **Shipped, code-enforced:** `tests/relocation.test.ts` ("PRIVACY: a relocation plan is never logged", "PRIVACY: a plan is never written to the device unencrypted", "PRIVACY: the plan page is noindex and carries no share card"). Second lock: `api/log.ts`'s allowlist has no `origin`/`destination` field |
| Log/metric label cardinality is bounded — attacker-controlled paths and methods cannot become a content side channel | **Shipped, code-enforced:** `metricRoute`/`metricMethod` templating applied before serialization in both `api/metrics.ts` and `api/log.ts` (`sanitizeAllowedValue`); unknown paths collapse to `_unmatched` |
| GenAI telemetry is content-free | **Shipped, code-enforced:** `api/genai-telemetry.ts` record type accepts no content fields and stamps `content_captured: false`; emission goes through the same allowlist logger |
| No third-party care-density (NPPES) query ships | **Shipped, code-enforced:** `tests/relocation.test.ts` asserts the NPPES host appears in no runtime module outside the deferral record (`api/care-density.ts`) |
| No account/profile database or durable application session | **Auto-gated:** `.gitignore` blocks session artifacts. Bounded render caches and retained application/provider logs are explicitly inventoried rather than described as nonexistent |
| Secrets never committed | **Auto-gated:** `make security` secret scan |
| Save/resume: local encrypted blob with selection-only fields | **Shipped, code-enforced:** `tests/secure-resume.test.ts` proves wrong-passphrase and tampered-ciphertext both fail closed; `toResumeState()` allowlists only no-direct-identity selection keys |
| Offline shell: disclosed user-initiated same-origin fetch; no background caching/sync | **Shipped, code-enforced:** `public/assets/offline.js` shows the explicit fetch boundary; `tests/offline.test.ts` asserts the worker fetch handler never writes a cache and no sync/push/periodicsync listener exists |

## 4. Subject rights
The Service has no account or user-profile database. Its server-side records are the
bounded in-memory selection cache and application/infrastructure logs described in §1;
those are not user-profile records and cannot be looked up reliably by an application
account identifier that does not exist. The opt-in local features each have a one-click
deletion path: the resume panel's "clear" control and the "delete all saved pages"
control. Whether this notice, the log-retention posture, and the unencrypted-cache
trade-off satisfy applicable subject-rights obligations is a counsel/DPO question and
remains an open review gate, not resolved by this draft.

## 5. Residual risk — including the questions the human reviewer must answer

Mechanical mitigations are listed in §1/§3. The items below are the open judgment calls
this draft **cannot** close; they are carried forward explicitly so the eventual sign-off
addresses each one.

- **URL transit surface (R6 class).** Query parameters (state/documents, court-order
  bookkeeping, optional free-text `q`) may appear in browser history or upstream
  proxy/edge logs. Selection fields do not directly request a name, but they reveal
  sensitive context and can be associated with network/account metadata upstream. The
  privacy notice states this explicitly.
- **[Reviewer question, added 2026-07-17] Relocation pair in the URL.** `/plan`'s
  (origin → destination) pair rides the same GET-URL surface. The app retains nothing
  (§1), but browser history and provider access records can still hold "someone planned
  a move from X to Y, at this time" — the most sensitive selection datum in the app,
  outside its control. Is the `/move` in-product disclosure (plus print-and-go, no-save
  posture) adequate for this population, or does this route need a different transport
  (e.g. POST-without-log, at the cost of the shareable-URL property) before launch?
- **Bedrock activation precondition.** A configured Bedrock-backed generator sends the
  question plus retrieved public corpus chunks to AWS. A free-text question is not
  guaranteed non-identifying, so activation requires provider-retention review and
  stronger user warning/redaction. Tracked in `residual-risk.md` (R5) — the content-free
  GenAI telemetry (§1) does not change this: telemetry never carries content, but the
  provider still receives the question itself.
- **[Reviewer question, carried from 2026-07-05] Offline cleartext cache vs device
  forensics.** Offline-saved pages are device-discoverable in cleartext (by design —
  §1). For a user in a hostile jurisdiction, a device search or forced unlock could
  reveal *that* the user saved checklist/guidance content, even though it reveals no
  identity data. Mitigations that exist: the one-click delete-all control, the save-panel
  disclosure copy, and the `/privacy` notice. The sign-off must explicitly weigh whether
  that in-product disclosure of the trade-off is sufficient before launch — this draft
  identifies the question; it does not answer it.
- **[Reviewer question, carried from 2026-07-09] `.ics` calendar replication.** The
  reminders file is a local artifact *designed to leave the app boundary*: once imported
  into a cloud-synced calendar, the step names (which reveal the nature of the legal
  process, though no identity data) live under the calendar provider's retention and are
  visible to calendar-sharing relationships — a real record under the subpoena/breach
  threat model, created off-device by user action. The in-product disclosure states
  this; whether that notice is adequate for this population is a counsel/human question
  for this DPIA's sign-off.
- **[Reviewer question, carried from 2026-07-09] Report-an-error self-outing.** The
  per-step report link (inactive by default; §1) is a self-outing vector when enabled:
  filing the prefilled issue publicly associates the reporter's GitHub identity with a
  trans-related legal process. The disclosure note beside the link states the
  destination, publicness, and account requirement, but the adequacy of that notice —
  and whether an anonymous intake should exist instead — is a counsel/human question for
  this DPIA's sign-off, not answered here.
- **[Operator question, added 2026-07-17] `/metrics` exposure.** The endpoint serves
  aggregate counters only (no user content, no identifiers, relocation routes collapsed
  to `_unmatched`), but it is unauthenticated in-app: a deployment that leaves it
  network-reachable exposes traffic patterns. Deployment guidance should restrict it at
  the edge; whether the current posture is acceptable pre-launch is part of the
  deployment review already flagged under R6.
- **FIX-07 scope note (carried).** `court_order=1` adds one more bit to the
  selection-only query surface: whether the user already has a court order. It is the
  same privacy class as `change`/`doc` (a plan-selection bookkeeping bit, not an
  identity field), deliberately added to `secure-resume.ts`'s save/resume allowlist
  alongside them, and carries the same history/proxy-log exposure noted above — flagged
  here rather than silently expanding R6's accepted surface.

## 6. STRIDE — edge/CDN-log seam and the build→serve corpus-tamper seam (FIX-09)
Two seams outside the request-handling code covered in §1–5: the network edge in front
of the app, and the pipeline stage between "CI's content gate cleared this corpus" and
"this is what's actually being served." Neither is exercised by unit tests, so they're
recorded here rather than only in code comments.

### 6a. Edge / CDN-log seam
Application logs exclude raw questions and direct identity-form fields (§3), but contain
bounded selection metadata. A real deploy also sits behind an edge (ALB access logs, a
CDN, or the Lambda Function URL's own request logging) that this repo does not control
and that may retain more than the app does.

| STRIDE | Threat | Mitigation / status |
|---|---|---|
| Spoofing | Edge/DNS hijack intercepts traffic before it reaches the real origin | TLS-only origin (ALB/Function URL are HTTPS); HSTS is a residual gap — not yet set at the edge layer (tracked below) |
| Tampering | A compromised or misconfigured edge cache serves stale/altered HTML to some users | `Cache-Control` policy for HTML responses is not yet explicit — residual risk; static assets are content-addressed via the service-worker version hash (`SW_VERSION`) |
| Repudiation | No per-request identity exists to repudiate (no accounts), but edge log access itself is unaudited by this repo | Out of scope for the app; the hosting account's edge-log IAM/access policy is the operator's responsibility, not code-enforced here |
| Information disclosure | GET URLs carry selections and optional `q`; even selection-only fields reveal sensitive context, and an edge can associate them with IP/account metadata. Full URLs may land in access logs retained independently of this application's 14/30-day log settings | **Known residual risk**, flagged in §5 and disclosed on `/privacy`. Raw `q` is excluded from application logs/cache/response, but only an on-device answer path can eliminate URL transit entirely (EXP-16) |
| Denial of service | The in-process rate limiter (`api/server.ts`) is per-instance and stateless — a distributed spray defeats it | **Auto-gated? No — residual.** A real deploy needs an edge-level limiter (ALB/WAF or CDN); the in-app limiter is explicitly documented as best-effort only |
| Elevation of privilege | N/A — there are no privileged roles or accounts in the app; the edge console itself is a privileged surface for the operator, not modeled here | Out of scope (infra/account-level IAM, not app code) |

### 6b. Build → serve corpus-tamper seam
The corpus is version-controlled and gated by `make content`/`make citation` in CI, but
nothing previously proved that the bytes CI validated are the same bytes a running
instance is actually serving. FIX-09 closes part of this gap with a build-time content
hash (`corpus.manifest.json`, `scripts/corpus-manifest.ts`) re-verified at boot
(`api/corpus.ts` `verifyCorpusManifest`, wired in `api/server.ts`).

| STRIDE | Threat | Mitigation / status |
|---|---|---|
| Spoofing | An attacker publishes an image under the project's name/registry, impersonating a real build | Tagged GHCR releases are keyless-signed with cosign (GitHub Actions OIDC/Fulcio/Rekor) at an immutable digest, and `verify-published` verifies that signature against this repository's workflow identity before booting the pulled digest. Preview ECR builds are immutable-tagged per git SHA but are not covered by that release signature; downstream deployments also need digest pinning/signature verification or admission control to preserve the identity claim. |
| Tampering | Corpus content mutated between CI's content gate and what's actually served — a tampered image layer, a bad deploy, a stray hand-edit on the runtime host | **Auto-gated (FIX-09):** `corpus.manifest.json` bakes a SHA-256 of `corpus/jurisdictions/*.json` + `forms/registry.json` into the image at build time; `api/server.ts` recomputes it live at boot and loudly refuses to start on mismatch, an invalid manifest, or an absent manifest in production (`safeLog("corpus_integrity", …, "error")` + non-zero exit) rather than silently serving unverified content. Absence is allowed only in an explicitly declared development/test process. |
| Repudiation | No cryptographic provenance ties a running image back to the CI run/commit that produced it | `release.yml` attaches a schema-validated CycloneDX SBOM and GitHub SLSA Build L2 provenance to the exact GHCR digest, in addition to its cosign signature. The pullback gate verifies the image signature but not the provenance attestation itself, private-repository visibility may limit third-party inspection, and no runtime admission control proves that a deployed instance is that attested digest — residual. |
| Information disclosure | N/A — the corpus is public legal information, not secret; the manifest itself only exposes a hash + filenames, never content | No mitigation needed; low/no risk by data classification |
| Denial of service | A false-positive integrity mismatch (e.g. a build step that legitimately touches corpus files post-hash) takes the whole service down by design | **Accepted trade, by design:** FIX-09 is intentionally fail-closed/loud here — availability is sacrificed for integrity on this one signal. `scripts/corpus-manifest.ts` must run as the LAST content-touching build step so this doesn't false-positive in normal operation |
| Elevation of privilege | Whoever controls the authorized CI build step controls both the corpus content and the manifest that attests to it — a compromised pipeline can ship and keyless-sign a malicious, self-consistent image | The manifest proves build-time bytes equal serve-time bytes; cosign/provenance bind the artifact to the repository workflow and commit, but do **not** prove the content was correct. Trust still depends on branch protection, required content/citation/privacy checks, GitHub Actions identity, and operator-side digest verification; there is no independent hermetic builder or deployment admission policy. |
