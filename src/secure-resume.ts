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
// This module is the tested reference implementation; the checklist page mirrors the same
// algorithm inline (WebCrypto) so it runs with no bundler. Keep the two in sync.

const ALLOWED_KEYS = ["jurisdiction", "change", "doc", "language"] as const;
// OWASP 2023 guidance for PBKDF2-HMAC-SHA256. The threat model (hostile-jurisdiction
// forensic read + offline brute-force of a chosen passphrase) is exactly what this
// defends. Must stay in lockstep with the inline mirror in src/pages.ts.
const PBKDF2_ITERATIONS = 600_000;

/** Strip an intake/query object down to the non-PII selection keys that may be saved. */
export function toResumeState(params: URLSearchParams): URLSearchParams {
  const out = new URLSearchParams();
  for (const key of ALLOWED_KEYS) {
    for (const v of params.getAll(key)) out.append(key, v);
  }
  return out;
}

function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function b64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

// lib.dom types BufferSource as backed by ArrayBuffer; our byte views are generic over
// ArrayBufferLike, so we assert at the WebCrypto boundary (the values are always plain
// ArrayBuffer-backed at runtime).
const bs = (u: Uint8Array): BufferSource => u as unknown as BufferSource;

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", bs(new TextEncoder().encode(passphrase)), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: bs(salt), iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Encrypt a plain-text payload (the canonical query string) → a portable base64 blob. */
export async function encryptState(plaintext: string, passphrase: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: bs(iv) }, key, bs(new TextEncoder().encode(plaintext))));
  const blob = new Uint8Array(salt.length + iv.length + ct.length);
  blob.set(salt, 0);
  blob.set(iv, salt.length);
  blob.set(ct, salt.length + iv.length);
  return bytesToB64(blob);
}

/** Decrypt a blob produced by encryptState. Throws on a wrong passphrase or tampering. */
export async function decryptState(blob: string, passphrase: string): Promise<string> {
  const bytes = b64ToBytes(blob);
  const salt = bytes.slice(0, 16);
  const iv = bytes.slice(16, 28);
  const ct = bytes.slice(28);
  const key = await deriveKey(passphrase, salt);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bs(iv) }, key, bs(ct));
  return new TextDecoder().decode(pt);
}
