// Corpus integrity attestation (FIX-09 §A): computeCorpusManifest determinism,
// verifyCorpusManifest's ok/expected/actual contract, and the dev-mode
// absent-manifest path. Uses a throwaway temp REPO_ROOT (corpus/jurisdictions/*.json
// + forms/registry.json), mirroring the existing opts.dir test-only isolation style
// used for loadCorpus in tests/corpus.test.ts.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { computeCorpusManifest, manifestPath } from "../scripts/corpus-manifest.ts";
import { corpusIntegrityAllowsStartup, verifyCorpusManifest } from "../api/corpus.ts";

/** A minimal fake repo root with the two content trees the manifest hashes. */
function makeTempRepoRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "corpus-manifest-"));
  mkdirSync(join(root, "corpus", "jurisdictions"), { recursive: true });
  mkdirSync(join(root, "forms"), { recursive: true });
  writeFileSync(join(root, "corpus", "jurisdictions", "alpha.json"), JSON.stringify([{ id: "alpha" }]));
  writeFileSync(join(root, "corpus", "jurisdictions", "beta.json"), JSON.stringify([{ id: "beta" }]));
  writeFileSync(join(root, "forms", "registry.json"), JSON.stringify([{ id: "form-alpha" }]));
  return root;
}

test("computeCorpusManifest is deterministic across two calls", () => {
  const root = makeTempRepoRoot();
  try {
    const first = computeCorpusManifest(root);
    const second = computeCorpusManifest(root);
    assert.equal(first.hash, second.hash);
    assert.deepEqual(first.files, second.files);
    assert.equal(first.hash.length, 64); // sha256 hex digest
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("computeCorpusManifest changes when any hashed file's bytes change", () => {
  const root = makeTempRepoRoot();
  try {
    const before = computeCorpusManifest(root);
    writeFileSync(join(root, "forms", "registry.json"), JSON.stringify([{ id: "form-alpha", changed: true }]));
    const after = computeCorpusManifest(root);
    assert.notEqual(before.hash, after.hash);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("verifyCorpusManifest returns ok=true against a freshly written manifest", () => {
  const root = makeTempRepoRoot();
  try {
    const manifest = computeCorpusManifest(root);
    writeFileSync(manifestPath(root), JSON.stringify(manifest, null, 2) + "\n");
    const result = verifyCorpusManifest({ repoRoot: root });
    assert.equal(result.ok, true);
    assert.equal(result.status, "valid");
    assert.equal(result.expected, manifest.hash);
    assert.equal(result.actual, manifest.hash);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("verifyCorpusManifest returns ok=false with expected!=actual after the corpus is mutated post-manifest", () => {
  const root = makeTempRepoRoot();
  try {
    const manifest = computeCorpusManifest(root);
    writeFileSync(manifestPath(root), JSON.stringify(manifest, null, 2) + "\n");
    // Simulate tampering / drift: a corpus file changes AFTER the manifest was baked.
    writeFileSync(join(root, "corpus", "jurisdictions", "alpha.json"), JSON.stringify([{ id: "alpha", tampered: true }]));
    const result = verifyCorpusManifest({ repoRoot: root });
    assert.equal(result.ok, false);
    assert.equal(result.status, "mismatch");
    assert.notEqual(result.expected, result.actual);
    assert.equal(result.expected, manifest.hash); // the baked-in digest is unchanged
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("verifyCorpusManifest classifies a missing build artifact as absent", () => {
  const root = makeTempRepoRoot();
  try {
    const result = verifyCorpusManifest({ repoRoot: root });
    assert.equal(result.ok, true);
    assert.equal(result.status, "absent");
    assert.equal(result.expected, null);
    assert.equal(result.actual.length, 64);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("startup policy allows an absent manifest only in explicit development/test environments", () => {
  const root = makeTempRepoRoot();
  try {
    const absent = verifyCorpusManifest({ repoRoot: root });
    assert.equal(corpusIntegrityAllowsStartup(absent, "development"), true);
    assert.equal(corpusIntegrityAllowsStartup(absent, "test"), true);
    assert.equal(corpusIntegrityAllowsStartup(absent, "production"), false);
    assert.equal(corpusIntegrityAllowsStartup(absent, undefined), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("startup policy accepts a valid manifest in production and rejects tampering in every environment", () => {
  const root = makeTempRepoRoot();
  try {
    const manifest = computeCorpusManifest(root);
    writeFileSync(manifestPath(root), JSON.stringify(manifest, null, 2) + "\n");
    assert.equal(corpusIntegrityAllowsStartup(verifyCorpusManifest({ repoRoot: root }), "production"), true);

    writeFileSync(join(root, "forms", "registry.json"), JSON.stringify([{ id: "tampered" }]));
    const mismatch = verifyCorpusManifest({ repoRoot: root });
    assert.equal(corpusIntegrityAllowsStartup(mismatch, "production"), false);
    assert.equal(corpusIntegrityAllowsStartup(mismatch, "development"), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("verifyCorpusManifest treats an unparseable manifest file as a mismatch, never throws", () => {
  const root = makeTempRepoRoot();
  try {
    writeFileSync(manifestPath(root), "{ not valid json");
    const result = verifyCorpusManifest({ repoRoot: root });
    assert.equal(result.ok, false);
    assert.equal(result.status, "invalid");
    assert.equal(result.expected, null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("computeCorpusManifest against the real repo corpus succeeds and lists every jurisdiction + the form registry", () => {
  const manifest = computeCorpusManifest();
  assert.ok(manifest.files.some((f) => f.endsWith("forms/registry.json") || f.endsWith("forms\\registry.json")));
  assert.ok(manifest.files.length > 5);
  assert.equal(manifest.hash, computeCorpusManifest().hash); // stable against the real tree too
});
