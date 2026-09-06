import { test } from "node:test";
import assert from "node:assert/strict";
import { retrieve } from "../api/retrieval.ts";
import { TEST_TODAY } from "../api/freshness.ts";

const today = TEST_TODAY;

test("filters by jurisdiction and includes federal records", () => {
  const r = retrieve({ jurisdiction: "US-CA", change_types: ["name"], today });
  const jurs = new Set(r.map((x) => x.record.jurisdiction));
  assert.ok(jurs.has("US-CA"));
  assert.ok(jurs.has("US")); // federal SSA/passport name records pulled in
  assert.ok(!jurs.has("US-NY"));
});

test("filters by change type", () => {
  const r = retrieve({ jurisdiction: "US-CA", change_types: ["gender-marker"], today });
  assert.ok(r.every((x) => x.record.change_type.includes("gender-marker")));
});

test("filters by document type when given", () => {
  const r = retrieve({ jurisdiction: "US-CA", change_types: ["name"], documents: ["court-order"], today });
  assert.ok(r.length > 0);
  assert.ok(r.every((x) => x.record.document_type === "court-order"));
});

test("filters by language (Spanish)", () => {
  const en = retrieve({ jurisdiction: "US-CA", change_types: ["name"], documents: ["court-order"], today });
  const es = retrieve({ jurisdiction: "US-CA", change_types: ["name"], documents: ["court-order"], language: "es", today });
  assert.ok(en.every((x) => x.record.language === "en"));
  assert.ok(es.some((x) => x.record.id === "ca.court-order.name.es"));
});

test("question tokens raise the score of matching records", () => {
  const r = retrieve({ jurisdiction: "US-CA", change_types: ["name"], question: "petition superior court name", today });
  assert.ok(r.length > 0);
  assert.equal(r[0]!.record.document_type, "court-order");
  assert.ok(r[0]!.score > 1);
});

test("degraded federal records are returned but marked not current", () => {
  const r = retrieve({ jurisdiction: "US", change_types: ["gender-marker"], documents: ["passport"], today });
  assert.ok(r.length > 0);
  assert.ok(r.every((x) => x.current === false));
});

// US-PR is a territory, deliberately outside the 50-state expansion, so these
// no-coverage cases stay genuine as the corpus grows (see #174). US-AL was used
// here until Alabama was added.
test("unsupported state still surfaces federal records, but no state records", () => {
  const r = retrieve({ jurisdiction: "US-PR", change_types: ["name"], today });
  assert.ok(r.length > 0);
  assert.ok(r.every((x) => x.record.jurisdiction === "US")); // federal only; no Puerto Rico records exist
});

test("unsupported state with a state-only document (court-order) returns nothing", () => {
  // There is no federal court-order, so an unsupported state court-order query is a genuine gap.
  const r = retrieve({ jurisdiction: "US-PR", change_types: ["name"], documents: ["court-order"], today });
  assert.equal(r.length, 0);
});
