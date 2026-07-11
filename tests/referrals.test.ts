import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadReferrals, validateRecord, validateReferrals, referralsFor } from "../api/referrals.ts";

const valid = {
  id: "x.referral.example",
  jurisdiction: "US-CA",
  name: "Example Legal Aid",
  url: "https://example-legal-aid.org",
  note: { en: "Free legal help with name changes.", es: "Ayuda legal gratuita con cambios de nombre." },
  source: { url: "https://example-legal-aid.org", title: "Example Legal Aid", last_verified: "2026-06-01", verifier: "Pilot Seed Reviewer" },
  verification_status: "verified",
  recheck_sla_days: 90,
};

test("validateRecord accepts a valid referral record", () => {
  assert.deepEqual(validateRecord(valid), []);
});

test("validateRecord rejects a non-object", () => {
  assert.equal(validateRecord(42).length, 1);
});

test("validateRecord catches each required-field violation", () => {
  const bad = (patch: Record<string, unknown>) => validateRecord({ ...valid, ...patch });
  assert.ok(bad({ id: "" }).some((i) => i.field === "id"));
  assert.ok(bad({ jurisdiction: "CA" }).some((i) => i.field === "jurisdiction"));
  assert.ok(bad({ name: "" }).some((i) => i.field === "name"));
  assert.ok(bad({ url: "ftp://x" }).some((i) => i.field === "url"));
  assert.ok(bad({ note: undefined }).some((i) => i.field === "note"));
  assert.ok(bad({ note: { en: "only english" } }).some((i) => i.field === "note.es"));
  assert.ok(bad({ note: { en: "", es: "hola" } }).some((i) => i.field === "note.en"));
  assert.ok(bad({ verification_status: "??" }).some((i) => i.field === "verification_status"));
  assert.ok(bad({ recheck_sla_days: 0 }).some((i) => i.field === "recheck_sla_days"));
});

test("validateRecord enforces source provenance", () => {
  assert.ok(validateRecord({ ...valid, source: undefined }).some((i) => i.field === "source"));
  const badSrc = (s: unknown) => validateRecord({ ...valid, source: s });
  assert.ok(badSrc({ url: "ftp://x", title: "T", last_verified: "2026-06-01", verifier: "A" }).some((i) => i.field === "source.url"));
  assert.ok(badSrc({ url: "https://x", title: "", last_verified: "2026-06-01", verifier: "A" }).some((i) => i.field === "source.title"));
  assert.ok(badSrc({ url: "https://x", title: "T", last_verified: "2026/06/01", verifier: "A" }).some((i) => i.field === "source.last_verified"));
  assert.ok(badSrc({ url: "https://x", title: "T", last_verified: "2026-06-01", verifier: "" }).some((i) => i.field === "source.verifier"));
  assert.ok(badSrc({ url: "https://x", title: "T", last_verified: "2026-06-01", verifier: "UNVERIFIED" }).some((i) => i.field === "source.verifier"));
});

test("validateReferrals on the real corpus/referrals reports zero issues and covers every guide state + federal", () => {
  const { records, issues } = validateReferrals();
  assert.deepEqual(issues, []);
  assert.ok(records >= 12); // federal + CA + IL + NY + TX + WA, 2 each
});

test("validateReferrals catches duplicate ids and parse errors in a temp dir", () => {
  const dir = mkdtempSync(join(tmpdir(), "referrals-"));
  try {
    writeFileSync(join(dir, "dupes.json"), JSON.stringify([valid, valid]));
    writeFileSync(join(dir, "broken.json"), "{ not json");
    const { issues } = validateReferrals(dir);
    assert.ok(issues.some((i) => i.message === "duplicate id"));
    assert.ok(issues.some((i) => i.field === "(json)"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("verifier roster: unknown verifier fails at referral load but passes the pure schema validator", () => {
  assert.deepEqual(validateRecord(valid), []);
  const dir = mkdtempSync(join(tmpdir(), "referrals-roster-"));
  try {
    const unknown = { ...valid, source: { ...valid.source, verifier: "Some Rando" } };
    writeFileSync(join(dir, "unknown.json"), JSON.stringify(unknown));
    const { issues } = validateReferrals(dir);
    assert.ok(issues.some((i) => i.field === "source.verifier" && /not in corpus\/VERIFIERS\.json/.test(i.message)));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("validateRecord rejects an impossible calendar date", () => {
  const bad = validateRecord({ ...valid, source: { ...valid.source, last_verified: "2099-13-45" } });
  assert.ok(bad.some((i) => i.field === "source.last_verified"));
});

test("loadReferrals throws (fail-closed) when a record is invalid", () => {
  const dir = mkdtempSync(join(tmpdir(), "referrals-bad-"));
  try {
    writeFileSync(join(dir, "bad.json"), JSON.stringify({ ...valid, source: undefined }));
    assert.throws(() => loadReferrals({ dir }), /Referral validation failed/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("loadReferrals throws on a duplicate id within a fail-closed load", () => {
  const dir = mkdtempSync(join(tmpdir(), "referrals-dupe-"));
  try {
    writeFileSync(join(dir, "dupes.json"), JSON.stringify([valid, valid]));
    assert.throws(() => loadReferrals({ dir }), /Referral validation failed/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("referralsFor filters by jurisdiction, including federal alongside state-specific", () => {
  const ca = { ...valid, id: "ca.referral.one", jurisdiction: "US-CA" };
  const ny = { ...valid, id: "ny.referral.one", jurisdiction: "US-NY" };
  const fed = { ...valid, id: "us.referral.one", jurisdiction: "US" };
  const all = [ca, ny, fed] as unknown as Parameters<typeof referralsFor>[1];

  const caResults = referralsFor("US-CA", all);
  assert.deepEqual(caResults.map((r) => r.id).sort(), ["ca.referral.one", "us.referral.one"]);

  const nyResults = referralsFor("US-NY", all);
  assert.deepEqual(nyResults.map((r) => r.id).sort(), ["ny.referral.one", "us.referral.one"]);

  const fedResults = referralsFor("US", all);
  assert.deepEqual(fedResults.map((r) => r.id), ["us.referral.one"]);

  const txResults = referralsFor("US-TX", all);
  assert.deepEqual(txResults.map((r) => r.id), ["us.referral.one"]);
});

test("referralsFor on the real corpus/referrals returns federal + state records", () => {
  const results = referralsFor("US-CA", loadReferrals());
  assert.ok(results.some((r) => r.jurisdiction === "US-CA"));
  assert.ok(results.some((r) => r.jurisdiction === "US"));
  assert.ok(results.every((r) => r.jurisdiction === "US-CA" || r.jurisdiction === "US"));
});
