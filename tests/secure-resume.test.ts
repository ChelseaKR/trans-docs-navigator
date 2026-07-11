import { test } from "node:test";
import assert from "node:assert/strict";
import { encryptState, decryptState, toResumeState } from "../src/secure-resume.ts";

test("round-trips an encrypted payload with the correct passphrase", async () => {
  const plain = "jurisdiction=US-CA&change=name&change=gender-marker&language=es";
  const blob = await encryptState(plain, "correct horse battery staple");
  assert.doesNotMatch(blob, /US-CA/); // ciphertext reveals nothing
  const back = await decryptState(blob, "correct horse battery staple");
  assert.equal(back, plain);
});

test("a wrong passphrase fails to decrypt (does not leak plaintext)", async () => {
  const blob = await encryptState("jurisdiction=US-TX&change=gender-marker", "right-passphrase");
  await assert.rejects(() => decryptState(blob, "wrong-passphrase"));
});

test("tampered ciphertext is rejected (AES-GCM integrity)", async () => {
  const blob = await encryptState("jurisdiction=US-WA", "pw");
  const tampered = blob.slice(0, -4) + (blob.endsWith("A") ? "B" : "A") + blob.slice(-3);
  await assert.rejects(() => decryptState(tampered, "pw"));
});

test("two encryptions of the same data differ (random salt + IV)", async () => {
  const a = await encryptState("jurisdiction=US-CA", "pw");
  const b = await encryptState("jurisdiction=US-CA", "pw");
  assert.notEqual(a, b);
});

test("toResumeState keeps only the non-PII selection keys (never identity fields)", () => {
  const params = new URLSearchParams("jurisdiction=US-CA&change=name&doc=passport&language=en&current_legal_name=Alex&ssn=123");
  const safe = toResumeState(params);
  assert.equal(safe.get("jurisdiction"), "US-CA");
  assert.equal(safe.get("doc"), "passport");
  assert.equal(safe.get("current_legal_name"), null); // PII never persisted
  assert.equal(safe.get("ssn"), null);
});

test("toResumeState keeps court_order (FIX-07: same privacy class as change/doc, not identity data)", () => {
  const params = new URLSearchParams("jurisdiction=US-CA&court_order=1&current_legal_name=Alex");
  const safe = toResumeState(params);
  assert.equal(safe.get("court_order"), "1");
  assert.equal(safe.get("current_legal_name"), null);
});
