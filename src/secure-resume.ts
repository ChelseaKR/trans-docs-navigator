// Client-side encrypted save/resume (ROADMAP §3 "Should"; audit §C).
//
// THREAT MODEL: in a hostile jurisdiction, even the *fact* that someone is pursuing a
// gender-marker change in a given state is sensitive. So saved state is:
//   • LOCAL ONLY — never sent to a server (there is no endpoint that receives it);
//   • ENCRYPTED with a key derived from a user passphrase (PBKDF2 → AES-GCM), so a
//     forensic/shoulder read of localStorage reveals nothing without the passphrase;
//   • DELETABLE — a one-click clear, and closing the tab without saving leaves nothing;
//   • NON-IDENTIFYING — only the plan SELECTIONS (jurisdiction/change/docs/language) are
//     ever saved. Identity fields (names) live only on the form-fill page and are NEVER
//     persisted — `toResumeState` strips anything outside the allowlist.
//
// The crypto itself lives in public/assets/resume-crypto.js — ONE implementation,
// imported here for the test suite and by the browser panel (resume-panel.js)
// directly, so the two can't drift. This module adds the allowlist strip, which is
// server-side-only.

export { encryptState, decryptState, PBKDF2_ITERATIONS } from "../public/assets/resume-crypto.js";

const ALLOWED_KEYS = ["jurisdiction", "change", "doc", "language"] as const;

/** Strip an intake/query object down to the non-PII selection keys that may be saved. */
export function toResumeState(params: URLSearchParams): URLSearchParams {
  const out = new URLSearchParams();
  for (const key of ALLOWED_KEYS) {
    for (const v of params.getAll(key)) out.append(key, v);
  }
  return out;
}
