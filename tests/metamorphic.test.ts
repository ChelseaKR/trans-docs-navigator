import { test } from "node:test";
import assert from "node:assert/strict";
import { runMetamorphic } from "../eval/metamorphic.ts";
import { retrieve } from "../api/retrieval.ts";
import { embeddingRetrieve } from "../api/embedding-retrieval.ts";

const RETRIEVERS = [
  { name: "retrieve", retriever: retrieve },
  { name: "embeddingRetrieve", retriever: embeddingRetrieve },
];

test("metamorphic properties pass for every (property, retriever) pair", () => {
  const results = runMetamorphic(RETRIEVERS);
  assert.ok(results.length > 0, "expected at least one metamorphic result");
  for (const r of results) {
    assert.equal(r.passed, true, `${r.name} [${r.retrieverName}] failed: ${r.detail}`);
  }
});

test("both retrievers are exercised by every property", () => {
  const results = runMetamorphic(RETRIEVERS);
  const byRetriever = new Map<string, number>();
  for (const r of results) {
    byRetriever.set(r.retrieverName, (byRetriever.get(r.retrieverName) ?? 0) + 1);
  }
  assert.equal(byRetriever.get("retrieve"), byRetriever.get("embeddingRetrieve"));
  assert.ok((byRetriever.get("retrieve") ?? 0) > 0);
});

test("paraphrase-stability: same-set citations, not just same-size", () => {
  const results = runMetamorphic([{ name: "retrieve", retriever: retrieve }]);
  const p = results.filter((r) => r.name.startsWith("paraphrase-stability:"));
  assert.ok(p.length > 0);
  for (const r of p) assert.equal(r.passed, true);
});

test("jurisdiction-sensitivity: state-level ids are disjoint across a jurisdiction swap", () => {
  const results = runMetamorphic([{ name: "retrieve", retriever: retrieve }]);
  const p = results.filter((r) => r.name.startsWith("jurisdiction-sensitivity:"));
  assert.ok(p.length > 0);
  for (const r of p) assert.equal(r.passed, true);
});

test("filter-monotonicity: adding a documents filter never adds a citation", () => {
  const results = runMetamorphic([{ name: "retrieve", retriever: retrieve }]);
  const p = results.filter((r) => r.name.startsWith("filter-monotonicity:"));
  assert.ok(p.length > 0);
  for (const r of p) assert.equal(r.passed, true);
});

test("language-consistency: EN/ES agree on emptiness and cited shape (FIX-03-dependent, not equal ids)", () => {
  const results = runMetamorphic([{ name: "retrieve", retriever: retrieve }]);
  const p = results.filter((r) => r.name.startsWith("language-consistency:"));
  assert.ok(p.length > 0);
  for (const r of p) assert.equal(r.passed, true);
});
