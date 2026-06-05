# Data Protection Impact Assessment (DPIA) — Trans Docs Navigator

> Instantiates RESPONSIBLE-TECH-FRAMEWORK §C for a hostile-jurisdiction threat model.
> Last verified: 2026-05-31 · Recheck cadence: per data-flow change.
> **Review-gated sign-off: PENDING** (no DPO signature in this build).

## 1. Data inventory (default mode)

| Data | Where it lives | Retention | Who can access |
|------|----------------|-----------|----------------|
| Intake answers (state, change types, documents, language) | Client memory + URL query on GET `/checklist` | None — not persisted | Nobody server-side |
| Identity data for form-fill (current/new legal name, court-order flag) | **Client memory only**; filled into the PDF in-browser | None — never transmitted | The user, on their device |
| Server logs | stdout, structured JSON via `api/log.ts` | Ephemeral | Operators |

**Server-side PII fields: 0.** Form-fill is client-side (`src/pages.ts` + vendored
`pdf-lib`); identity data never reaches the server.

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
| Optional saved state (Should, not built) | local-only + encrypted + deletion path (design commitment) |

## 4. Subject rights
Default mode collects nothing, so there is nothing to access or delete. Any future
opt-in saved state must ship a deletion path and a plain-language notice.

## 5. Residual risk
- URL query parameters (state/documents) may appear in browser history or upstream
  proxy logs. These are non-identifying, but the privacy notice should state it.
- A future Bedrock-backed generator sends the (non-PII) question + retrieved chunks to
  AWS; the prompt must continue to exclude identity data. Tracked in `residual-risk.md`.
