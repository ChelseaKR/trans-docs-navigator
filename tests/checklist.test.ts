import { test } from "node:test";
import assert from "node:assert/strict";
import { buildChecklist } from "../api/checklist.ts";
import type { Intake, CorpusRecord } from "../api/types.ts";
import { TEST_TODAY } from "../api/freshness.ts";

const today = TEST_TODAY; // the corpus's frozen as-of date; see tests/bedrock.test.ts

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
    { jurisdiction: "US-AL", change_types: ["name"], documents: ["court-order"], language: "en" },
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
  // California's own NC-100 form page says a name change "related to gender identity" uses
  // NC-200 instead — so this app's users get NC-200. (Found by the source-fidelity gate.)
  assert.deepEqual(step.form_refs, ["ca-nc-200"]);
});

test("has_court_order marks the court-order step done and prunes it from dependents' prerequisites (FIX-07)", () => {
  const withFlag = buildChecklist(
    { jurisdiction: "US-CA", change_types: ["name"], documents: ["court-order", "ssa-card"], language: "en", has_court_order: true },
    today,
  );
  const courtOrder = withFlag.steps.find((s) => s.document_type === "court-order")!;
  const ssa = withFlag.steps.find((s) => s.document_type === "ssa-card")!;
  assert.equal(courtOrder.done, true);
  // Citations stay visible — the step is annotated, not deleted.
  assert.ok(courtOrder.record_ids.length > 0);
  // The dependent is unblocked: the satisfied prerequisite is pruned from its list.
  assert.ok(!ssa.prerequisites.includes("court-order"));

  // Without the flag, the same plan still shows the ordinary blocked/undone shape.
  const withoutFlag = buildChecklist(
    { jurisdiction: "US-CA", change_types: ["name"], documents: ["court-order", "ssa-card"], language: "en" },
    today,
  );
  const courtOrder2 = withoutFlag.steps.find((s) => s.document_type === "court-order")!;
  const ssa2 = withoutFlag.steps.find((s) => s.document_type === "ssa-card")!;
  assert.equal(courtOrder2.done, undefined);
  assert.ok(ssa2.prerequisites.includes("court-order"));
});

test("picks up a form reference declared on ANY backing record, not just the first", () => {
  // In the real corpus, the US-TX birth-certificate step is backed by four records and only
  // the THIRD (tx.birth-certificate.name) declares a form (tx-vs-170). An engine that read
  // form_ref off the first backing record only would hand the user nothing here.
  // (This previously used US-CA drivers-license + ca-dl-329; the CA DMV retired that form
  // route in 2026, so the fixture moved to a case the live corpus still exercises.)
  const cl = buildChecklist(
    { jurisdiction: "US-TX", change_types: ["name", "gender-marker"], documents: ["birth-certificate"], language: "en" },
    today,
  );
  assert.deepEqual(cl.steps[0]!.form_refs, ["tx-vs-170"]);
});

test("a step needing TWO official forms links both — not just the first (birth-certificate)", () => {
  // California's birth-record step legitimately takes two forms: VS 24B amends the sex
  // field, VS 23 applies a court-ordered name change. An engine that emitted only the
  // first would name VS 23 in the step's prose and then never hand it over.
  const ca = buildChecklist(
    { jurisdiction: "US-CA", change_types: ["name", "gender-marker"], documents: ["birth-certificate"], language: "en" },
    "2026-07-13",
  );
  assert.deepEqual(ca.steps[0]!.form_refs, ["ca-vs-24b", "ca-vs-23"]);

  // Same shape in Spanish, and in Washington (DOH 422-143 + DOH 422-126).
  const wa = buildChecklist(
    { jurisdiction: "US-WA", change_types: ["name", "gender-marker"], documents: ["birth-certificate"], language: "es" },
    "2026-07-13",
  );
  assert.deepEqual(wa.steps[0]!.form_refs, ["wa-doh-422-143", "wa-doh-422-126"]);

  // New York's gender-designation route needs the DOH-5305 application AND the notarized
  // DOH-5303 affidavit — both are required by the cited source, so both must be linked.
  const ny = buildChecklist(
    { jurisdiction: "US-NY", change_types: ["gender-marker"], documents: ["birth-certificate"], language: "en" },
    "2026-07-13",
  );
  assert.deepEqual(ny.steps[0]!.form_refs, ["ny-doh-5305", "ny-doh-5303"]);
});

test("duplicate form references across a step's records collapse to one CTA (Illinois)", () => {
  // Illinois uses ONE form (the Affidavit and Certificate of Correction Request) for both
  // the sex designation and the name, so the step must not link it twice.
  const il = buildChecklist(
    { jurisdiction: "US-IL", change_types: ["name", "gender-marker"], documents: ["birth-certificate"], language: "en" },
    "2026-07-13",
  );
  assert.deepEqual(il.steps[0]!.form_refs, ["il-affidavit-correction"]);
});

test("Texas's birth-certificate sex-field route links no form — the source provides none", () => {
  // Texas publishes VS-170 for a court-ordered NAME change, but lists no gender-marker
  // amendment route at all. The gender-only step must therefore link no form; inventing
  // one (or reusing VS-170) would imply a route the state does not offer.
  const genderOnly = buildChecklist(
    { jurisdiction: "US-TX", change_types: ["gender-marker"], documents: ["birth-certificate"], language: "en" },
    "2026-07-13",
  );
  assert.equal(genderOnly.steps[0]!.form_refs, undefined);

  const nameOnly = buildChecklist(
    { jurisdiction: "US-TX", change_types: ["name"], documents: ["birth-certificate"], language: "en" },
    "2026-07-13",
  );
  assert.deepEqual(nameOnly.steps[0]!.form_refs, ["tx-vs-170"]);
});
