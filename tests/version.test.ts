// Build-identity tests (api/version.ts, served at /version).
//
// The property under test is not "the endpoint answers" — it is that the endpoint
// never answers with something that LOOKS like a commit and is not one. Every
// almost-a-SHA input below must come back as `commit: null, stamped: false`, because a
// deploy check that trusts /version has to be able to tell "this image was not stamped"
// apart from "this image is at commit X", and a placeholder collapses that distinction.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildInfo } from "../api/version.ts";
import { handleRoute } from "../api/router.ts";
import { metricRoute } from "../api/metrics.ts";
import { indexablePaths } from "../src/guide.ts";
import { sitemapXml } from "../src/seo.ts";

const u = (path: string) => new URL(path, "http://localhost:8080");
const SHA = "0123456789abcdef0123456789abcdef01234567";

/** A repo root holding only the two files buildInfo() reads, so nothing else varies. */
function fixtureRoot(files: Record<string, unknown>): string {
  const root = mkdtempSync(join(tmpdir(), "tdn-version-"));
  for (const [name, contents] of Object.entries(files)) {
    writeFileSync(join(root, name), JSON.stringify(contents), "utf8");
  }
  return root;
}

// ── the stamp is accepted only in the exact shape of a git object name ──────

test("a full 40-hex commit is reported, lowercased", () => {
  const root = fixtureRoot({});
  const info = buildInfo({ BUILD_COMMIT: SHA.toUpperCase() }, root);
  assert.equal(info.commit, SHA);
  assert.equal(info.stamped, true);
});

test("every almost-a-SHA stamp is reported as absent, never as a value", () => {
  const root = fixtureRoot({});
  const notCommits = [
    undefined, // the env var was never set
    "", // set but empty — a shell expansion of an unset variable
    "   ",
    "unknown", // the placeholder this endpoint exists to avoid
    "dev",
    "null",
    SHA.slice(0, 7), // an abbreviated SHA is not a git object name
    `${SHA}0`, // too long
    SHA.replace("0", "g"), // not hex
    "main", // a branch name, which is what a careless --build-arg would pass
    "refs/heads/main",
  ];
  for (const value of notCommits) {
    const info = buildInfo(value === undefined ? {} : { BUILD_COMMIT: value }, root);
    assert.equal(info.commit, null, `BUILD_COMMIT=${JSON.stringify(value)} must not be reported`);
    assert.equal(info.stamped, false, `BUILD_COMMIT=${JSON.stringify(value)} must not read as stamped`);
  }
});

// ── build time is normalised, and an unparseable one is absent ──────────────

test("a parseable build time is normalised to ISO-8601", () => {
  const root = fixtureRoot({});
  const info = buildInfo({ BUILD_TIME: "2026-09-06T12:00:00Z" }, root);
  assert.equal(info.built_at, "2026-09-06T12:00:00.000Z");
});

test("an unparseable or missing build time is null, not passed through", () => {
  const root = fixtureRoot({});
  for (const value of [undefined, "", "not a date", "yesterday"]) {
    const info = buildInfo(value === undefined ? {} : { BUILD_TIME: value }, root);
    assert.equal(info.built_at, null, `BUILD_TIME=${JSON.stringify(value)} must not be reported`);
  }
});

// ── the files it reads are optional, and a broken one is absent, not fatal ──

test("version and corpus_hash come from the baked files when present", () => {
  const root = fixtureRoot({
    "package.json": { version: "1.2.3" },
    "corpus.manifest.json": { hash: "abc123" },
  });
  const info = buildInfo({}, root);
  assert.equal(info.version, "1.2.3");
  assert.equal(info.corpus_hash, "abc123");
});

test("a missing, malformed or wrongly-typed file yields null rather than throwing", () => {
  const missing = fixtureRoot({});
  assert.equal(buildInfo({}, missing).version, null);
  assert.equal(buildInfo({}, missing).corpus_hash, null);

  const broken = mkdtempSync(join(tmpdir(), "tdn-version-broken-"));
  writeFileSync(join(broken, "package.json"), "{not json", "utf8");
  writeFileSync(join(broken, "corpus.manifest.json"), JSON.stringify({ hash: 42 }), "utf8");
  assert.equal(buildInfo({}, broken).version, null);
  assert.equal(buildInfo({}, broken).corpus_hash, null);
});

// ── the route ───────────────────────────────────────────────────────────────

test("/version answers JSON carrying the build-identity fields", () => {
  const r = handleRoute("GET", u("/version"));
  assert.equal(r.status, 200);
  assert.equal(r.contentType, "application/json");
  const body = JSON.parse(r.body);
  for (const field of ["version", "commit", "built_at", "stamped", "corpus_hash"]) {
    assert.ok(field in body, `/version must report ${field}`);
  }
  assert.equal(typeof body.stamped, "boolean");
  // Whatever this process was started with, the two must agree: `stamped` is exactly
  // "a commit is being reported", never a separate claim that could contradict it.
  assert.equal(body.stamped, body.commit !== null);
});

test("/version is a bounded metric label, not _unmatched", () => {
  assert.equal(metricRoute("/version"), "/version");
});

test("/version is not offered to crawlers", () => {
  assert.ok(!indexablePaths().includes("/version"));
  assert.ok(!sitemapXml(indexablePaths()).includes("/version"));
});
