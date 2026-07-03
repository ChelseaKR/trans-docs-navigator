# Data Protection Impact Assessment (DPIA) — Trans Docs Navigator

> Instantiates RESPONSIBLE-TECH-FRAMEWORK §C for a hostile-jurisdiction threat model.
> Last verified: 2026-05-31 · Recheck cadence: per data-flow change.
> **Review-gated sign-off: PENDING** (no DPO signature in this build).

> ⚠️ **STALENESS NOTE (added 2026-07-05, remediation pass — not a re-verification):**
> This DPIA's own recheck cadence is "per data-flow change," and two data-flow changes
> have landed since 2026-05-31 without triggering that recheck: client-side encrypted
> save/resume (`src/secure-resume.ts`, 2026-06-05) and the offline-capable PWA shell
> (`src/offline.ts`, EXP-01, merged 2026-07-01, commit `1bd85c4`). The data-inventory rows
> below for both features were added on 2026-07-05 by reading the actual implementation
> (`src/offline.ts`, `src/secure-resume.ts`, `public/assets/resume-crypto.js`) — they are
> **mechanically-verified facts about what the code does**, not a substitute for the
> human DPO/privacy sign-off this document has always required. **Do not treat this note
> as that sign-off.** The review-gate remains PENDING and must now additionally cover the
> two rows added below before any launch-gate approval.

## 1. Data inventory (default mode)

| Data | Where it lives | Retention | Who can access |
|------|----------------|-----------|----------------|
| Intake answers (state, change types, documents, language) | Client memory + URL query on GET `/checklist` | None — not persisted | Nobody server-side |
| Identity data for form-fill (current/new legal name, court-order flag) | **Client memory only**; filled into the PDF in-browser | None — never transmitted | The user, on their device |
| Server logs | stdout, structured JSON via `api/log.ts` | Ephemeral | Operators |
| **[Added 2026-07-05] Save/resume selections** (jurisdiction, change types, documents, language — `ALLOWED_KEYS` in `src/secure-resume.ts`) | Browser `localStorage`, **AES-GCM encrypted** with a PBKDF2 (600k-iteration) passphrase-derived key (`public/assets/resume-crypto.js`) | Until the user clears it (one-click "clear" in the resume panel) or clears site data | The user, on their device; a forensic/shoulder read of `localStorage` sees only ciphertext without the passphrase. Identity fields are stripped server-side by `toResumeState()` before anything is offered to save — names never enter this path. |
| **[Added 2026-07-05] Offline-saved pages** (explicit "Save for offline" only — `src/offline.ts`) | Browser **Cache Storage** (`tdn-saved-v1`), **NOT encrypted** (unlike the row above) | Until the user presses the "delete all saved pages" control, which clears every cache and unregisters the service worker | The user, on their device; also **device-discoverable to anyone with access to the device/browser profile** — this is a real, explicitly-documented trade-off (stated in the save panel copy and on `/privacy`), not an oversight. No network egress: the service worker only ever caches on an explicit user tap, never in its `fetch` handler, and has no background sync/push/periodic-sync listeners (enforced by `tests/offline.test.ts`). |

**Server-side PII fields: 0.** Form-fill is client-side (`src/pages.ts` + vendored
`pdf-lib`); identity data never reaches the server. Both rows added above are also
**zero server-side PII** — both are local-only, client-side persistence with no endpoint
that ever receives them.

## 2. Threat model (hostile jurisdiction)
Assume an adversary with subpoena power or breach access. **The defense is to have
nothing to take.** No accounts, ephemeral by default, client-side form-fill, no PII in
logs or analytics. The intake form submits via **GET with only non-identifying fields**
— no request body, no identity data on the wire.

## 3. Controls & enforcement
| Control | Enforcement |
|---------|-------------|
| No PII reaches the server | **Auto-gated:** `make privacy` asserts `api/server.ts` references no identity PII field |
| No PII in logs | **Auto-gated:** `make privacy` scans all log calls; `api/log.ts` allowlists only non-PII fields (unit-tested) |
| Ephemeral by default | **Auto-gated:** `.gitignore` blocks session artifacts; no server-side persistence exists |
| Secrets never committed | **Auto-gated:** `make security` secret scan |
| Save/resume: local-only + encrypted + non-identifying selections only | **Shipped, code-enforced:** `tests/secure-resume.test.ts` proves wrong-passphrase and tampered-ciphertext both fail closed; `toResumeState()` allowlists only non-identity keys |
| Offline shell: explicit-save-only, no background caching, no egress | **Shipped, code-enforced:** `tests/offline.test.ts` asserts the fetch handler never writes a cache and no sync/push/periodicsync listener exists |

## 4. Subject rights
Default mode collects nothing, so there is nothing to access or delete. The two opt-in,
local-only features now shipped each have a one-click deletion path: the resume panel's
"clear" control (secure-resume) and the "delete all saved pages" control (offline shell),
both device-local operations with nothing server-side to reconcile. Whether the
plain-language notice and the unencrypted-cache trade-off copy are adequate is a content/
counsel-review question, not a mechanical one — tracked as an open review gate (§3.1 of
`docs/IMPROVEMENT-PLAN.md`), not resolved by this note.

## 5. Residual risk
- URL query parameters (state/documents) may appear in browser history or upstream
  proxy logs. These are non-identifying, but the privacy notice should state it.
- A future Bedrock-backed generator sends the (non-PII) question + retrieved chunks to
  AWS; the prompt must continue to exclude identity data. Tracked in `residual-risk.md`.
- **[Added 2026-07-05]** Offline-saved pages are device-discoverable in cleartext (by
  design — see §1). For a user in a hostile jurisdiction, a device search or forced
  unlock could reveal *that* the user saved checklist/guidance content, even though it
  reveals no identity data. This is a materially different risk shape than the encrypted
  save/resume feature, and the human review-gate sign-off for this DPIA needs to
  explicitly weigh whether the in-product disclosure of that trade-off is sufficient
  before launch — this note identifies the question; it does not answer it.

## 6. STRIDE — edge/CDN-log seam and the build→serve corpus-tamper seam (FIX-09)
Two seams outside the request-handling code covered in §1–5: the network edge in front
of the app, and the pipeline stage between "CI's content gate cleared this corpus" and
"this is what's actually being served." Neither is exercised by unit tests, so they're
recorded here rather than only in code comments.

### 6a. Edge / CDN-log seam
The app itself never logs PII (§3), but a real deploy sits behind an edge (ALB access
logs, a CDN, or the Lambda Function URL's own request logging) that this repo does not
control and that may retain more than the app does.

| STRIDE | Threat | Mitigation / status |
|---|---|---|
| Spoofing | Edge/DNS hijack intercepts traffic before it reaches the real origin | TLS-only origin (ALB/Function URL are HTTPS); HSTS is a residual gap — not yet set at the edge layer (tracked below) |
| Tampering | A compromised or misconfigured edge cache serves stale/altered HTML to some users | `Cache-Control` policy for HTML responses is not yet explicit — residual risk; static assets are content-addressed via the service-worker version hash (`SW_VERSION`) |
| Repudiation | No per-request identity exists to repudiate (no accounts), but edge log access itself is unaudited by this repo | Out of scope for the app; the hosting account's edge-log IAM/access policy is the operator's responsibility, not code-enforced here |
| Information disclosure | The GET-only intake (`state`, `documents`, `language` — non-identifying by design, §2) still lands in edge access logs, which retain independently of and typically longer than this app's ephemeral posture | **Known residual risk**, already flagged in §5. The privacy notice must say query params can appear in upstream logs; retention there is the hosting provider's, not this app's |
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
| Spoofing | An attacker publishes an image under the project's name/registry, impersonating a real build | ECR images are immutable-tagged per git SHA (`infra/preview/main.tf`); GHCR release pushes use `GITHUB_TOKEN` only (no long-lived keys). No image-signing (cosign/sigstore) yet — residual |
| Tampering | Corpus content mutated between CI's content gate and what's actually served — a tampered image layer, a bad deploy, a stray hand-edit on the runtime host | **Auto-gated (FIX-09, new):** `corpus.manifest.json` bakes a SHA-256 of `corpus/jurisdictions/*.json` + `forms/registry.json` into the image at build time; `api/server.ts` recomputes it live at boot and loudly refuses to start on mismatch (`safeLog("corpus_integrity", …, "error")` + non-zero exit) rather than silently serving unverified content |
| Repudiation | No cryptographic provenance ties a running image back to the CI run/commit that produced it | A CycloneDX SBOM is attached on release (`release.yml`); no signed build provenance (SLSA/in-toto) attestation yet — residual, tracked for a future pass |
| Information disclosure | N/A — the corpus is public legal information, not secret; the manifest itself only exposes a hash + filenames, never content | No mitigation needed; low/no risk by data classification |
| Denial of service | A false-positive integrity mismatch (e.g. a build step that legitimately touches corpus files post-hash) takes the whole service down by design | **Accepted trade, by design:** FIX-09 is intentionally fail-closed/loud here — availability is sacrificed for integrity on this one signal. `scripts/corpus-manifest.ts` must run as the LAST content-touching build step so this doesn't false-positive in normal operation |
| Elevation of privilege | Whoever controls the CI build step controls both the corpus content AND the manifest that attests to it — a compromised pipeline can ship a malicious corpus with a self-consistent (and therefore "valid") manifest | The manifest proves build-time bytes equal serve-time bytes; it does **not** prove the build-time bytes were trustworthy. That trust still rests entirely on branch protection + required CI checks (content/citation/privacy gates) on `main`. Documented here as an explicit non-goal of FIX-09, not an oversight |
