// Single source of truth for the save/resume crypto: PBKDF2-HMAC-SHA256 (600k
// iterations, OWASP 2023) deriving an AES-256-GCM key. Plain-JS ES module so the
// SAME code runs in the browser (imported by resume-panel.js) and under Node for
// the test suite (re-exported by src/secure-resume.ts). There is no second copy
// to drift.
//
// Blob layout: [16-byte salt][12-byte IV][ciphertext], base64-encoded.

export const PBKDF2_ITERATIONS = 600000;

function bytesToB64(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function b64ToBytes(b64) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function deriveKey(passphrase, salt) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Encrypt a plain-text payload (the canonical query string) → a portable base64 blob. */
export async function encryptState(plaintext, passphrase) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext)));
  const blob = new Uint8Array(salt.length + iv.length + ct.length);
  blob.set(salt, 0);
  blob.set(iv, salt.length);
  blob.set(ct, salt.length + iv.length);
  return bytesToB64(blob);
}

/** Decrypt a blob produced by encryptState. Throws on a wrong passphrase or tampering. */
export async function decryptState(blob, passphrase) {
  const bytes = b64ToBytes(blob);
  const salt = bytes.slice(0, 16);
  const iv = bytes.slice(16, 28);
  const ct = bytes.slice(28);
  const key = await deriveKey(passphrase, salt);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(pt);
}
