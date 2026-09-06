import { test } from "node:test";
import assert from "node:assert/strict";
import { retrieve, selectAudience } from "../api/retrieval.ts";
import { TEST_TODAY } from "../api/freshness.ts";
import type { CorpusRecord } from "../api/types.ts";

const today = TEST_TODAY;

function rec(over: Partial<CorpusRecord>): CorpusRecord {
  return {
    id: "x", jurisdiction: "US-CA", document_type: "court-order", change_type: ["name"],
    topic: "t", statement: "A sufficiently long statement.",
    source: { url: "https://e.gov", title: "T", last_verified: today, verifier: "Pilot Seed Reviewer" },
    verification_status: "verified", recheck_sla_days: 90, language: "en", ...over,
  };
}

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

// ── Minors pilot: audience exclusivity (api/types.ts RecordAudience) ─────────────────

test("selectAudience: a non-minor query never sees a minor-audience record", () => {
  const records = [rec({ id: "adult" }), rec({ id: "minor", audience: "minor" })];
  const out = selectAudience(records, false);
  assert.deepEqual(out.map((r) => r.id), ["adult"]);
});

test("selectAudience: a minor query sees ONLY the minor record for a cell that has one", () => {
  const records = [rec({ id: "adult" }), rec({ id: "minor", audience: "minor" })];
  const out = selectAudience(records, true);
  assert.deepEqual(out.map((r) => r.id), ["minor"]);
});

test("selectAudience: a minor query falls through to the adult record where no minor record exists for that cell", () => {
  const records = [rec({ id: "adult", jurisdiction: "US-TX" })];
  const out = selectAudience(records, true);
  assert.deepEqual(out.map((r) => r.id), ["adult"]);
});

test("selectAudience: exclusivity is scoped to (jurisdiction × document_type) — an unrelated cell's adult record is untouched", () => {
  const records = [
    rec({ id: "ca-court-adult", jurisdiction: "US-CA", document_type: "court-order" }),
    rec({ id: "ca-court-minor", jurisdiction: "US-CA", document_type: "court-order", audience: "minor" }),
    rec({ id: "ca-dl-adult", jurisdiction: "US-CA", document_type: "drivers-license" }),
  ];
  const out = selectAudience(records, true);
  assert.deepEqual(
    out.map((r) => r.id).sort(),
    ["ca-court-minor", "ca-dl-adult"],
  );
});

test("retrieve: a minor query in a pilot state (California) returns the minor court-order record, not the adult one", () => {
  const r = retrieve({ jurisdiction: "US-CA", change_types: ["name"], documents: ["court-order"], for_minor: true, today });
  const ids = r.map((x) => x.record.id);
  assert.ok(ids.includes("ca.court-order.name.minor"), ids.join(","));
  assert.ok(!ids.includes("ca.court-order.name"), ids.join(","));
});

test("retrieve: an adult query never surfaces California's minor court-order record", () => {
  const r = retrieve({ jurisdiction: "US-CA", change_types: ["name"], documents: ["court-order"], today });
  const ids = r.map((x) => x.record.id);
  assert.ok(ids.includes("ca.court-order.name"), ids.join(","));
  assert.ok(!ids.includes("ca.court-order.name.minor"), ids.join(","));
});

test("retrieve: a minor query in a non-pilot state (Florida) falls through to the adult record — not silently empty", () => {
  const r = retrieve({ jurisdiction: "US-FL", change_types: ["name"], documents: ["court-order"], for_minor: true, today });
  assert.ok(r.length > 0);
  assert.ok(r.every((x) => x.record.audience !== "minor"));
});
