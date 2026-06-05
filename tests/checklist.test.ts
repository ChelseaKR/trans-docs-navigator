import { test } from "node:test";
import assert from "node:assert/strict";
import { buildChecklist } from "../api/checklist.ts";
import type { Intake, CorpusRecord } from "../api/types.ts";

const today = "2026-05-31";

function rec(over: Partial<CorpusRecord>): CorpusRecord {
  return {
    id: "x", jurisdiction: "US-CA", document_type: "court-order", change_type: ["name"],
    topic: "t", statement: "A sufficiently long statement.",
    source: { url: "https://e.gov", title: "T", last_verified: today, verifier: "Pilot Seed Reviewer" },
    verification_status: "verified", recheck_sla_days: 90, language: "en", ...over,
  };
}

test("builds an ordered checklist with the canonical document order", () => {
  const intake: Intake = {
    jurisdiction: "US-CA",
    change_types: ["name", "gender-marker"],
    documents: ["passport", "court-order", "ssa-card", "drivers-license"],
    language: "en",
  };
  const cl = buildChecklist(intake, today);
  const order = cl.steps.map((s) => s.document_type);
  assert.deepEqual(order, ["court-order", "ssa-card", "drivers-license", "passport"]);
  assert.deepEqual(
    cl.steps.map((s) => s.order),
    [1, 2, 3, 4],
  );
});

test("derives prerequisites from records (SSA/DMV depend on court-order)", () => {
  const cl = buildChecklist(
    { jurisdiction: "US-CA", change_types: ["name"], documents: ["court-order", "ssa-card"], language: "en" },
    today,
  );
  const ssa = cl.steps.find((s) => s.document_type === "ssa-card")!;
  assert.ok(ssa.prerequisites.includes("court-order"));
});

test("empty document selection uses the recommended standard set", () => {
  const cl = buildChecklist({ jurisdiction: "US-CA", change_types: ["name"], documents: [], language: "en" }, today);
  assert.deepEqual(
    cl.steps.map((s) => s.document_type),
    ["court-order", "ssa-card", "drivers-license", "passport"],
  );
});

test("records a gap for an unsupported jurisdiction/document", () => {
  const cl = buildChecklist(
    { jurisdiction: "US-NV", change_types: ["name"], documents: ["court-order"], language: "en" },
    today,
  );
  assert.equal(cl.steps.length, 0);
  assert.ok(cl.gaps.some((g) => g.document_type === "court-order"));
});

test("flags a step needing reverification when only degraded records back it", () => {
  // Federal passport gender-marker is degraded → step shows needs_reverification.
  const cl = buildChecklist(
    { jurisdiction: "US-CA", change_types: ["gender-marker"], documents: ["passport"], language: "en" },
    today,
  );
  const passport = cl.steps.find((s) => s.document_type === "passport");
  assert.ok(passport);
  assert.equal(passport!.needs_reverification, true);
  assert.equal(passport!.record_ids.length, 0);
  assert.ok(cl.gaps.some((g) => g.document_type === "passport"));
});

test("marks discretionary steps", () => {
  const cl = buildChecklist(
    { jurisdiction: "US-CA", change_types: ["name"], documents: ["court-order"], language: "en" },
    today,
  );
  assert.equal(cl.steps[0]!.discretionary, true);
});

test("builds a Spanish checklist from ES records", () => {
  const cl = buildChecklist(
    { jurisdiction: "US-CA", change_types: ["name"], documents: ["court-order"], language: "es" },
    today,
  );
  assert.equal(cl.steps[0]!.record_ids[0], "ca.court-order.name.es");
});

test("conflicting costs across records surface as 'varies' instead of a silent first-wins", () => {
  const corpus: CorpusRecord[] = [
    rec({ id: "a", cost: { amount_usd: 100 }, timeline: { typical: "2 weeks" } }),
    rec({ id: "b", cost: { amount_usd: 250 }, timeline: { typical: "6 weeks" } }),
  ];
  const cl = buildChecklist({ jurisdiction: "US-CA", change_types: ["name"], documents: ["court-order"], language: "en" }, today, corpus);
  const step = cl.steps[0]!;
  assert.equal(step.cost!.amount_usd, null);
  assert.match(step.cost!.note!, /varies/);
  assert.equal(step.timeline!.typical, "varies");
});

test("agreeing costs across records are passed through unchanged", () => {
  const corpus: CorpusRecord[] = [
    rec({ id: "a", cost: { amount_usd: 100 } }),
    rec({ id: "b", cost: { amount_usd: 100 } }),
  ];
  const cl = buildChecklist({ jurisdiction: "US-CA", change_types: ["name"], documents: ["court-order"], language: "en" }, today, corpus);
  assert.equal(cl.steps[0]!.cost!.amount_usd, 100);
});

test("carries cost, timeline, and a form reference onto steps", () => {
  const cl = buildChecklist(
    { jurisdiction: "US-CA", change_types: ["name"], documents: ["court-order"], language: "en" },
    today,
  );
  const step = cl.steps[0]!;
  assert.ok(step.cost);
  assert.ok(step.timeline);
  assert.equal(step.form_ref, "ca-nc-100");
});
