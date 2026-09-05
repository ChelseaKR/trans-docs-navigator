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
  // Flip one base64 character of the ciphertext/tag region. The character that is
  // inspected and the character that is replaced must be the same one: this used to
  // test blob.endsWith("A") — the LAST character — while substituting at index
  // length-4. Whenever the character at length-4 was already "A" and the blob did
  // not end in "A", the substitute was "A" too, so the "tampered" blob was
  // identical to the original, decryption correctly succeeded, and the test failed
  // with "Missing expected rejection". Base64 is 64 symbols, so that landed on
  // roughly 1 run in 64 and turned an integrity assertion into a coin flip.
  const i = blob.length - 4;
  const tampered = blob.slice(0, i) + (blob[i] === "A" ? "B" : "A") + blob.slice(i + 1);
  // Guards the above: if the mutation is ever a no-op again, this fails loudly and
  // deterministically instead of intermittently.
  assert.notEqual(tampered, blob, "the test must actually alter the blob");
  await assert.rejects(() => decryptState(tampered, "pw"));
});

test("two encryptions of the same data differ (random salt + IV)", async () => {
  const a = await encryptState("jurisdiction=US-CA", "pw");
  const b = await encryptState("jurisdiction=US-CA", "pw");
  assert.notEqual(a, b);
});

test("toResumeState keeps only selection keys and drops direct identity fields", () => {
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
