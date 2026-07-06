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
