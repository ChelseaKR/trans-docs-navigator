import { test } from "node:test";
import assert from "node:assert/strict";
import { embeddingRetrieve, embed } from "../api/embedding-retrieval.ts";
import { answer } from "../api/guidance.ts";
import { loadCorpus } from "../api/corpus.ts";
import { TEST_TODAY } from "../api/freshness.ts";

const today = TEST_TODAY;
const corpus = loadCorpus();

test("embeddingRetrieve applies the same structured filter (jurisdiction + federal, change, language)", () => {
  const got = embeddingRetrieve({ jurisdiction: "US-CA", change_types: ["name"], language: "en", today }, corpus);
  assert.ok(got.length > 0);
  for (const r of got) {
    assert.ok(r.record.jurisdiction === "US-CA" || r.record.jurisdiction === "US");
    assert.ok(r.record.change_type.includes("name"));
    assert.equal(r.record.language, "en");
  }
});

test("a question ranks the most semantically relevant record first", () => {
  const got = embeddingRetrieve(
    { jurisdiction: "US-CA", change_types: ["name", "gender-marker"], language: "en", question: "petition to change my name in superior court", today },
    corpus,
  );
  assert.equal(got[0]!.record.document_type, "court-order");
});

test("embedding is typo-tolerant via character trigrams", () => {
  // 'courtt' (typo) should still sit closer to 'court' than to an unrelated word.
  const a = embed("court order petition");
  const typo = embed("courtt orderr petitionn");
  const unrelated = embed("passport renewal photo");
  const sim = (x: Float64Array, y: Float64Array) => x.reduce((s, v, i) => s + v * y[i]!, 0);
  assert.ok(sim(a, typo) > sim(a, unrelated));
});

test("the embedding retriever is drop-in: guidance produces a grounded, cited answer with it", () => {
  const ans = answer(
    { jurisdiction: "US-CA", change_types: ["name"], documents: ["court-order"], question: "how do I change my name", today },
    { retriever: embeddingRetrieve },
  );
  assert.equal(ans.refused, false);
  assert.ok(ans.cited_records.some((r) => r.id === "ca.court-order.name"));
});

test("unsupported jurisdiction still refuses under the embedding retriever", () => {
  const ans = answer(
    { jurisdiction: "US-NV", change_types: ["name"], documents: ["court-order"], today },
    { retriever: embeddingRetrieve },
  );
  assert.equal(ans.refused, true);
});
