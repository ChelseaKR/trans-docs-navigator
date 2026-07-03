import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync, readdirSync, statSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadCorpus, validateRecord, validateCorpus, recordById, loadVerifierRoster, isPlaceholderVerifier, isValidIsoDate, LAST_QUARANTINE, REPO_ROOT } from "../api/corpus.ts";
import { memoize } from "../api/cache.ts";

const valid = {
  id: "x.court-order.name",
  jurisdiction: "US-CA",
  document_type: "court-order",
  change_type: ["name"],
  topic: "t",
  statement: "This is a sufficiently long statement.",
  source: { url: "https://e.gov", title: "T", last_verified: "2026-05-31", verifier: "A Person" },
  verification_status: "verified",
  recheck_sla_days: 90,
  language: "en",
};

test("loadCorpus loads and caches the real corpus", () => {
  const a = loadCorpus();
  const b = loadCorpus();
  assert.ok(a.length > 5);
  assert.equal(a, b); // cached identity
  assert.ok(loadCorpus({ force: true }).length === a.length);
});

test("corpus watch (IP §5.2, dev ergonomics): an on-disk edit's mtime forces a reload and cascades a downstream cache clear", () => {
  const dir = join(REPO_ROOT, "corpus", "jurisdictions");
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  assert.ok(files.length > 0);
  const target = join(dir, files[0]!);
  const before = statSync(target);

  const prevWatch = process.env.CORPUS_WATCH;
  process.env.CORPUS_WATCH = "1";
  try {
    const a = loadCorpus({ force: true }); // establish a fresh cached baseline under the watch flag

    // A downstream cache (mirrors how api/router.ts wraps rendered HTML in api/cache.ts's
    // memoize) must be cleared when the corpus reloads — this proves the cascade, not
    // just that loadCorpus() itself reloaded.
    let computeCalls = 0;
    const downstream = memoize((k: string) => {
      computeCalls++;
      return k;
    });
    downstream("x");
    downstream("x");
    assert.equal(computeCalls, 1);

    // Touch the file's mtime forward (content unchanged) to simulate an edit on disk.
    const future = new Date(before.mtimeMs + 10_000);
    utimesSync(target, future, future);

    const b = loadCorpus(); // a plain cached call must detect the newer mtime and reload
    assert.notEqual(b, a); // a fresh array — not the stale cached reference
    assert.equal(b.length, a.length); // same content, just reloaded

    downstream("x"); // the corpus reload must have cascaded clearAllCaches()
    assert.equal(computeCalls, 2);
  } finally {
    utimesSync(target, before.atime, before.mtime); // restore exactly — don't leave the repo dirty
    if (prevWatch === undefined) delete process.env.CORPUS_WATCH;
    else process.env.CORPUS_WATCH = prevWatch;
    loadCorpus({ force: true }); // reset the process cache/baseline for later tests
  }
});

test("corpus watch is inert on a custom dir (the cached path only applies to the default corpus dir)", () => {
  const dir = mkdtempSync(join(tmpdir(), "corpus-watch-"));
  try {
    const rec = { ...valid, source: { ...valid.source, verifier: "Pilot Seed Reviewer" } };
    writeFileSync(join(dir, "one.json"), JSON.stringify(rec));
    const a = loadCorpus({ dir });
    const b = loadCorpus({ dir });
    assert.equal(a.length, 1);
    assert.equal(b.length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("recordById finds known and misses unknown", () => {
  assert.equal(recordById("ca.court-order.name")?.jurisdiction, "US-CA");
  assert.equal(recordById("nope.nope"), undefined);
});

test("validateRecord accepts a valid record", () => {
  assert.deepEqual(validateRecord(valid), []);
});

test("validateRecord rejects a non-object", () => {
  assert.equal(validateRecord(42).length, 1);
});

test("validateRecord catches each required-field violation", () => {
  const bad = (patch: Record<string, unknown>) => validateRecord({ ...valid, ...patch });
  assert.ok(bad({ id: "" }).some((i) => i.field === "id"));
  assert.ok(bad({ jurisdiction: "CA" }).some((i) => i.field === "jurisdiction"));
  assert.ok(bad({ document_type: "weird" }).some((i) => i.field === "document_type"));
  assert.ok(bad({ change_type: [] }).some((i) => i.field === "change_type"));
  assert.ok(bad({ change_type: ["bogus"] }).some((i) => i.field === "change_type"));
  assert.ok(bad({ topic: "" }).some((i) => i.field === "topic"));
  assert.ok(bad({ statement: "short" }).some((i) => i.field === "statement"));
  assert.ok(bad({ verification_status: "??" }).some((i) => i.field === "verification_status"));
  assert.ok(bad({ recheck_sla_days: 0 }).some((i) => i.field === "recheck_sla_days"));
  assert.ok(bad({ language: "fr" }).some((i) => i.field === "language"));
});

test("validateRecord enforces source provenance (guardrail #1)", () => {
  assert.ok(validateRecord({ ...valid, source: undefined }).some((i) => i.field === "source"));
  const badSrc = (s: unknown) => validateRecord({ ...valid, source: s });
  assert.ok(badSrc({ url: "ftp://x", title: "T", last_verified: "2026-05-31", verifier: "A" }).some((i) => i.field === "source.url"));
  assert.ok(badSrc({ url: "https://x", title: "", last_verified: "2026-05-31", verifier: "A" }).some((i) => i.field === "source.title"));
  assert.ok(badSrc({ url: "https://x", title: "T", last_verified: "2026/05/31", verifier: "A" }).some((i) => i.field === "source.last_verified"));
  assert.ok(badSrc({ url: "https://x", title: "T", last_verified: "2026-05-31", verifier: "" }).some((i) => i.field === "source.verifier"));
  assert.ok(badSrc({ url: "https://x", title: "T", last_verified: "2026-05-31", verifier: "UNVERIFIED" }).some((i) => i.field === "source.verifier"));
});

test("validateRecord validates optional cost/prerequisites", () => {
  assert.ok(validateRecord({ ...valid, cost: 5 }).some((i) => i.field === "cost"));
  assert.ok(validateRecord({ ...valid, cost: { amount_usd: null } }).some((i) => i.field === "cost.note"));
  assert.deepEqual(validateRecord({ ...valid, cost: { amount_usd: null, note: "varies" } }), []);
  assert.ok(validateRecord({ ...valid, prerequisites: "x" }).some((i) => i.field === "prerequisites"));
});

test("validateCorpus on the real corpus reports zero issues", () => {
  const { records, issues } = validateCorpus();
  assert.ok(records > 5);
  assert.deepEqual(issues, []);
});

test("validateCorpus catches duplicate ids and parse errors in a temp dir", () => {
  const dir = mkdtempSync(join(tmpdir(), "corpus-"));
  try {
    writeFileSync(join(dir, "dupes.json"), JSON.stringify([valid, valid]));
    writeFileSync(join(dir, "broken.json"), "{ not json");
    const { issues } = validateCorpus(dir);
    assert.ok(issues.some((i) => i.message === "duplicate id"));
    assert.ok(issues.some((i) => i.field === "(json)"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("verifier roster: unknown verifier fails at corpus load but passes the pure schema validator", () => {
  // The pure schema validator (ADR-3 boundary) does not know the roster.
  assert.deepEqual(validateRecord(valid), []);
  // The corpus-load layer enforces roster membership.
  const dir = mkdtempSync(join(tmpdir(), "corpus-roster-"));
  try {
    writeFileSync(join(dir, "unknown.json"), JSON.stringify(valid)); // verifier "A Person" not in roster
    const { issues } = validateCorpus(dir);
    assert.ok(issues.some((i) => i.field === "source.verifier" && /not in corpus\/VERIFIERS\.json/.test(i.message)));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("verifier roster: placeholder reviewers are flagged and counted as not-launch-cleared", () => {
  const roster = loadVerifierRoster();
  assert.ok(roster.has("Pilot Seed Reviewer"));
  assert.equal(isPlaceholderVerifier("Pilot Seed Reviewer"), true);
  assert.equal(isPlaceholderVerifier("Some Real Human"), false);
  // The real seed corpus is entirely placeholder-verified today (ADR-3).
  const { records, placeholderVerified } = validateCorpus();
  assert.equal(placeholderVerified, records);
});

test("isValidIsoDate accepts real dates and rejects impossible ones", () => {
  assert.equal(isValidIsoDate("2026-05-31"), true);
  assert.equal(isValidIsoDate("2099-13-45"), false); // month 13, day 45
  assert.equal(isValidIsoDate("2026-02-30"), false); // Feb 30 rolls over
  assert.equal(isValidIsoDate("2026/05/31"), false); // wrong separator
  assert.equal(isValidIsoDate(42), false);
});

test("validateRecord rejects an impossible calendar date", () => {
  const bad = validateRecord({ ...valid, source: { ...valid.source, last_verified: "2099-13-45" } });
  assert.ok(bad.some((i) => i.field === "source.last_verified"));
});

test("loadCorpus throws (fail-closed) when a record is invalid", () => {
  const dir = mkdtempSync(join(tmpdir(), "corpus-bad-"));
  try {
    writeFileSync(join(dir, "bad.json"), JSON.stringify({ ...valid, source: undefined }));
    assert.throws(() => loadCorpus({ dir }), /Corpus validation failed/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("loadCorpus quarantine mode drops a bad record, keeps the good, and records why", () => {
  const dir = mkdtempSync(join(tmpdir(), "corpus-quar-"));
  try {
    const good = { ...valid, id: "good.court-order.name", source: { ...valid.source, verifier: "Pilot Seed Reviewer" } };
    const bad = { ...valid, id: "bad.court-order.name", statement: "short" }; // too short
    writeFileSync(join(dir, "mix.json"), JSON.stringify([good, bad]));
    const records = loadCorpus({ dir, quarantine: true });
    assert.deepEqual(records.map((r) => r.id), ["good.court-order.name"]);
    assert.ok(LAST_QUARANTINE.some((i) => i.recordId === "bad.court-order.name"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
