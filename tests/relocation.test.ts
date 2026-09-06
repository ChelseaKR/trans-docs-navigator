// Relocation planner tests (docs/RELOCATION.md).
//
// The tests that matter most here are the NEGATIVE ones: the planner's value is not that it
// emits steps, it's that it refuses to invent the ones it cannot source. So we assert what
// it does NOT say (no interstate-recognition claim, no residency window the source never
// mentions, no estimated fee) as carefully as what it does.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

import { buildRelocationPlan, relocationAnswer, PORTABILITY, costModel } from "../api/relocation.ts";
import { loadCorpus, validateRecord } from "../api/corpus.ts";
import { checkCoverage } from "../api/citation.ts";
import { handleRoute } from "../api/router.ts";
import { renderPlanPage, renderMovePage } from "../src/relocation.ts";
import { escapeHtml } from "../src/render.ts";
import { NPPES_HOST, CARE_DENSITY_DEFERRAL } from "../api/care-density.ts";
import type { ChangeType, DocumentType, RelocationIntake } from "../api/types.ts";

const TODAY = "2026-07-13";
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const corpus = loadCorpus();

const BOTH: ChangeType[] = ["name", "gender-marker"];
function intake(over: Partial<RelocationIntake> = {}): RelocationIntake {
  return { origin: "US-TX", destination: "US-WA", held: [], change_types: BOTH, language: "en", ...over };
}

// ── Classification: what the move actually does to each document ────────────────────

test("federal documents carry over; the destination's own documents are redone there", () => {
  const plan = buildRelocationPlan(intake(), TODAY, corpus);
  const byKey = new Map(plan.steps.map((s) => [s.key, s]));

  // SSA card + passport are federal: the same records govern in both states.
  for (const key of ["ssa-card", "passport"]) {
    const step = byKey.get(key);
    assert.ok(step, `${key} step missing`);
    assert.equal(step.step_class, "carries-over");
    assert.equal(step.jurisdiction, "US");
    assert.equal(step.phase, "either");
  }

  // A driver's license is issued by the state you live in — Washington's rules apply.
  const dl = byKey.get("drivers-license");
  assert.ok(dl);
  assert.equal(dl.step_class, "redo-in-destination");
  assert.equal(dl.jurisdiction, "US-WA");
  assert.equal(dl.phase, "after-you-arrive");
});

test("a document you already hold is never dropped from the plan, and never re-billed", () => {
  const plan = buildRelocationPlan(intake({ held: ["court-order"] }), TODAY, corpus);
  const co = plan.steps.find((s) => s.key === "court-order");
  assert.ok(co);
  assert.equal(co.step_class, "keep-from-origin");
  assert.equal(co.jurisdiction, "US-TX", "a court order stays with the state whose court issued it");
  assert.equal(co.held, true);

  // Declaring a held document must ADD context, never NARROW the plan: the license step
  // (the thing the move actually forces) has to survive.
  assert.ok(plan.steps.some((s) => s.key === "drivers-license"), "held court order hid the license step");

  // And it is not part of the move's cost — it is already paid for.
  assert.ok(!plan.costs.lines.some((l) => l.step_key === "court-order"));
});

test("a held document is grouped as context — never under a heading that misdescribes it", () => {
  // Regression: `keep-from-origin` used to fall into the "Any time" phase, whose lead reads
  // "These are federal documents" — flatly false of a Texas court order. It gets its own
  // group now. Caught by driving the real page, not by a unit test.
  const plan = buildRelocationPlan(intake({ held: ["court-order"] }), TODAY, corpus);
  const co = plan.steps.find((s) => s.key === "court-order")!;
  assert.equal(co.phase, "already-have");

  const html = renderPlanPage(plan, corpus, "en");
  assert.match(html, /What you already have/);
  // The federal lead must not be attached to a Texas court order.
  const haveSection = html.slice(html.indexOf("What you already have"), html.indexOf("Any time"));
  assert.doesNotMatch(haveSection, /These are federal documents/);
});

test("a held document shows no cost, timeline, or discretionary flag", () => {
  // Those describe the process of OBTAINING it, which is done. Suppressed in the ENGINE so
  // the cost model and the page cannot disagree about whether a held document is billable.
  const plan = buildRelocationPlan(intake({ held: ["court-order"] }), TODAY, corpus);
  const co = plan.steps.find((s) => s.key === "court-order")!;
  assert.equal(co.cost, undefined);
  assert.equal(co.timeline, undefined);
  assert.equal(co.discretionary, false);
  assert.ok(!plan.costs.lines.some((l) => l.step_key === "court-order"));
});

test("the unverified-rule warning does not overclaim", () => {
  // The SSA step DOES carry a current name-change rule; only the federal gender-marker
  // record is stale. The warning must say "at least one rule behind this step", not "we
  // cannot show a current rule for this step" — which would contradict the rule shown above it.
  const html = renderPlanPage(buildRelocationPlan(intake(), TODAY, corpus), corpus, "en");
  assert.match(html, /At least one rule behind this step/);
  assert.doesNotMatch(html, /We cannot show a current rule for this step/);
});

test("the engine never claims the destination honours an origin-issued document", () => {
  // The corpus contains no record about interstate recognition, so no step may assert it.
  // The held court order is classified `keep-from-origin` — "you have this; we don't know
  // what Washington does with it" — and the UI says exactly that, rather than guessing.
  const plan = buildRelocationPlan(intake({ held: ["court-order"] }), TODAY, corpus);
  const co = plan.steps.find((s) => s.key === "court-order")!;
  assert.notEqual(co.step_class, "carries-over", "a state court order is not a federal document");

  const html = renderPlanPage(plan, corpus, "en");
  assert.match(html, /do not say what the new state does/i, "the unknown must be stated, not hidden");
});

// ── The birth certificate: the document a move does NOT touch ──────────────────────

test("a birth certificate is never 'redo it in the new state'", () => {
  // The failure this guards: telling someone leaving Texas that Washington will re-issue their
  // Texas birth record. No source says that, because it is false — a birth record belongs to the
  // state you were BORN in, and moving does not change where you were born.
  const plan = buildRelocationPlan(intake(), TODAY, corpus);
  const birth = plan.steps.filter((s) => s.document_type === "birth-certificate");
  assert.equal(birth.length, 2, "both states in the plan should have their own birth-record step");

  for (const step of birth) {
    assert.equal(step.portability, "state-of-birth");
    assert.equal(step.step_class, "governed-by-birth-state");
    assert.notEqual(step.step_class, "redo-in-destination");
    assert.equal(step.phase, "birth-state", "a birth record is not gated on the move in either direction");
  }
  assert.deepEqual(birth.map((s) => s.jurisdiction).sort(), ["US-TX", "US-WA"]);

  // And the page says whose rules they are, and that the move does not change that.
  const html = renderPlanPage(plan, corpus, "en");
  assert.match(html, /Where you were born/);
  assert.match(html, /Handled by the state you were born in/);
  assert.doesNotMatch(
    html.slice(html.indexOf('data-step="birth:US-TX"'), html.indexOf('data-step="birth:US-WA"')),
    /The new state has its own requirements/,
  );
});

test("the birth-certificate route does not close when you move", () => {
  // The court order's does (Texas files it "in the county where you live"). A birth record is
  // keyed to where you were BORN, so leaving the state closes nothing — and the planner must not
  // manufacture a deadline that no source states.
  const plan = buildRelocationPlan(intake(), TODAY, corpus);
  assert.ok(!plan.steps.some((s) => s.key === "origin:birth-certificate"));
  assert.equal(
    plan.hazards.filter((h) => h.kind === "origin-window-closes" && h.step_key.startsWith("birth:")).length,
    0,
    "invented a closing window for a document the move cannot close",
  );
});

test("the two birth-certificate steps are not an either/or choice", () => {
  // Two routes to a court order ARE alternatives ("do this one or that one"). The two birth
  // steps are not: which applies is decided by where you were born, not by a choice you make.
  const plan = buildRelocationPlan(intake(), TODAY, corpus);
  for (const step of plan.steps.filter((s) => s.document_type === "birth-certificate")) {
    assert.equal(step.alternative_to, undefined, "a birth record was offered as an either/or route");
  }
});

test("Texas's closed sex-marker route is stated plainly, with its citation", () => {
  // The single most valuable thing this corpus can say about a hostile state: the door is shut.
  // Silence here would leave someone believing a Texas amendment is merely bureaucratic.
  const plan = buildRelocationPlan(intake({ origin: "US-TX", destination: "US-WA" }), TODAY, corpus);
  const tx = plan.steps.find((s) => s.key === "birth:US-TX");
  assert.ok(tx);
  assert.ok(tx.record_ids.includes("tx.birth-certificate.gender-marker"));

  const rec = corpus.find((r) => r.id === "tx.birth-certificate.gender-marker")!;
  assert.equal(rec.verification_status, "verified", "a cited 'this is not available' must be served, not degraded");
  const html = renderPlanPage(plan, corpus, "en");
  assert.ok(html.includes(escapeHtml(rec.statement)));
  assert.ok(html.includes(escapeHtml(rec.source.url)), "the restriction must carry its official source");
});

test("holding a birth certificate does not mark the amendment done", () => {
  // "I have my birth certificate" says nothing about whether the sex or name on it was amended,
  // and nothing about which state issued it. Treating it as a completed step (the way a held
  // court order is) would silently drop the one step that may be impossible where they were born.
  const plan = buildRelocationPlan(intake({ held: ["birth-certificate"] }), TODAY, corpus);
  const birth = plan.steps.filter((s) => s.document_type === "birth-certificate");
  assert.equal(birth.length, 2);
  for (const step of birth) {
    assert.notEqual(step.step_class, "keep-from-origin");
    assert.equal(step.phase, "birth-state", "a held birth certificate must not be filed under 'what you already have'");
  }
  // It is still an application, so it is still costed and still carries the government-record caution.
  assert.ok(plan.costs.lines.some((l) => l.step_key === "birth:US-WA"));
  assert.ok(
    plan.hazards.some((h) => h.kind === "creates-government-record" && h.step_key.startsWith("birth:")),
    "a held birth certificate suppressed the caution about applying",
  );
});

test("the court-order → birth-certificate prerequisite edge is cited to the record that states it", () => {
  // Washington's own page: to change the name on a birth certificate you send a certified copy of
  // the court order. The edge exists because a source says so — never because it sounds right.
  const plan = buildRelocationPlan(intake({ origin: "US-CA", destination: "US-WA" }), TODAY, corpus);
  const wa = plan.steps.find((s) => s.key === "birth:US-WA")!;
  assert.ok(wa.prerequisites.length > 0);

  const hazard = plan.hazards.find((h) => h.kind === "prerequisite-order" && h.step_key === "birth:US-WA");
  assert.ok(hazard, "the birth-record step must warn that it needs the court order first");
  assert.ok(hazard.citations.length > 0);
  for (const id of hazard.citations) {
    assert.ok((corpus.find((r) => r.id === id)!.prerequisites ?? []).includes("court-order"));
  }
  const blocker = plan.steps.find((s) => s.key === hazard.blocked_by)!;
  assert.ok(blocker.order < wa.order, "the birth-record step was ordered before the court order it needs");
});

test("no birth-certificate record claims a residency rule its source never states", () => {
  // Birth records are keyed to place of BIRTH, not residence. Not one of the sources says "where
  // you live" — so not one of these records may carry the residency annotation.
  for (const rec of corpus.filter((r) => r.document_type === "birth-certificate")) {
    assert.notEqual(rec.relocation?.residency_bound, true, `${rec.id} claims a residency rule`);
  }
});

// ── Ordering hazards: the part that actually strands people ─────────────────────────

test("the origin's closing window fires only where the origin's OWN source says 'where you live'", () => {
  // Texas: "the district court of the county where you live" → residency-bound → the route
  // closes when you leave. The hazard cites that record.
  const fromTx = buildRelocationPlan(intake({ origin: "US-TX", destination: "US-WA" }), TODAY, corpus);
  const window = fromTx.hazards.find((h) => h.kind === "origin-window-closes");
  assert.ok(window, "Texas's residency-bound court order should raise a closing-window hazard");
  assert.deepEqual(window.citations, ["tx.court-order.name"]);
  assert.equal(fromTx.steps.find((s) => s.key === window.step_key)!.phase, "before-you-move");

  // Washington: its source never conditions filing on residency, so we must NOT invent one.
  const fromWa = buildRelocationPlan(intake({ origin: "US-WA", destination: "US-CA" }), TODAY, corpus);
  assert.equal(
    fromWa.hazards.filter((h) => h.kind === "origin-window-closes").length,
    0,
    "asserted a residency window Washington's cited source never mentions",
  );
});

test("a document already in hand has no closing window", () => {
  const plan = buildRelocationPlan(intake({ origin: "US-TX", held: ["court-order"] }), TODAY, corpus);
  assert.equal(
    plan.hazards.filter((h) => h.kind === "origin-window-closes").length,
    0,
    "warned about a deadline to obtain something the person already has",
  );
});

test("the two routes to one document are alternatives, not two things to do", () => {
  const plan = buildRelocationPlan(intake(), TODAY, corpus);
  const originRoute = plan.steps.find((s) => s.key === "origin:court-order");
  const destRoute = plan.steps.find((s) => s.key === "court-order");
  assert.ok(originRoute && destRoute, "TX→WA should offer both a Texas and a Washington route");
  assert.equal(originRoute.alternative_to, destRoute.key);
  assert.equal(destRoute.alternative_to, originRoute.key);

  const html = renderPlanPage(plan, corpus, "en");
  assert.match(html, /not both/i, "the page must say to do one route or the other, not both");
});

test("the origin route is labelled as the OLD state's rules, not the new state's", () => {
  // Regression: the origin route carried `redo-in-destination`, so it rendered as "The new
  // state has its own requirements · Texas" — false, and exactly backwards. Caught by
  // reading the real page.
  const plan = buildRelocationPlan(intake(), TODAY, corpus);
  const originRoute = plan.steps.find((s) => s.key === "origin:court-order")!;
  assert.equal(originRoute.step_class, "do-in-origin");
  assert.equal(originRoute.jurisdiction, "US-TX");

  const html = renderPlanPage(plan, corpus, "en");
  const stepStart = html.indexOf('data-step="origin:court-order"');
  const badge = html.slice(stepStart, stepStart + 400);
  assert.match(badge, /Done under the rules of the state you are leaving/);
  assert.doesNotMatch(badge, /The new state has its own requirements/);
});

test("prerequisites are cited to the record that names them, and order the plan", () => {
  const plan = buildRelocationPlan(intake(), TODAY, corpus);
  const dl = plan.steps.find((s) => s.key === "drivers-license")!;
  assert.ok(dl.prerequisites.length > 0, "WA's license record names a court order; the plan must reflect it");

  // The dependency edge must come from a record's own `prerequisites` field...
  const hazard = plan.hazards.find((h) => h.kind === "prerequisite-order" && h.step_key === "drivers-license");
  assert.ok(hazard);
  assert.ok(hazard.citations.length > 0, "a prerequisite hazard must cite the record that states it");
  for (const id of hazard.citations) {
    const rec = corpus.find((r) => r.id === id)!;
    assert.ok((rec.prerequisites ?? []).includes("court-order"));
  }

  // ...and the blocking step must actually come first in the rendered order.
  const blocker = plan.steps.find((s) => s.key === hazard.blocked_by)!;
  assert.ok(blocker.order < dl.order, "a step was ordered before its own prerequisite");
});

test("every step that needs a prerequisite is ordered after it (topological invariant)", () => {
  for (const origin of ["US-TX", "US-CA", "US-NY", "US-IL", "US-WA"]) {
    for (const destination of ["US-TX", "US-CA", "US-NY", "US-IL", "US-WA"]) {
      if (origin === destination) continue;
      const plan = buildRelocationPlan(intake({ origin, destination }), TODAY, corpus);
      const order = new Map(plan.steps.map((s) => [s.key, s.order]));
      for (const step of plan.steps) {
        for (const p of step.prerequisites) {
          assert.ok(
            (order.get(p) ?? 0) < step.order,
            `${origin}→${destination}: ${step.key} (order ${step.order}) precedes its prerequisite ${p}`,
          );
        }
      }
    }
  }
});

test("a prerequisite cycle in the corpus cannot hang the planner", () => {
  // Defense in depth: the corpus is human-edited, and a mutual prerequisite is a plausible
  // mistake. The planner must degrade, not spin.
  const cyclic = corpus.map((r) =>
    r.id === "wa.court-order.name"
      ? { ...r, prerequisites: ["drivers-license"] }
      : r.id === "wa.drivers-license.name"
        ? { ...r, prerequisites: ["court-order"] }
        : r,
  );
  const plan = buildRelocationPlan(intake({ origin: "US-CA", destination: "US-WA" }), TODAY, cyclic);
  assert.ok(plan.steps.length > 0);
  assert.equal(new Set(plan.steps.map((s) => s.key)).size, plan.steps.length, "a cycle duplicated a step");
});

test("a rule we cannot verify is surfaced as unverified, never quietly served", () => {
  // Texas's DMV gender-marker record is `needs_reverification` (volatile, contested).
  const plan = buildRelocationPlan(intake({ origin: "US-WA", destination: "US-TX" }), TODAY, corpus);
  const hazard = plan.hazards.find((h) => h.kind === "unverified-destination-rule" && h.step_key === "drivers-license");
  assert.ok(hazard, "Texas's volatile DMV marker rule must raise an unverified-rule hazard");

  const html = renderPlanPage(plan, corpus, "en");
  assert.match(html, /At least one rule behind this step/i);
});

test("the 'applying creates a government record' caution is a caution, not a claim", () => {
  const plan = buildRelocationPlan(intake(), TODAY, corpus);
  const cautions = plan.hazards.filter((h) => h.kind === "creates-government-record");
  assert.ok(cautions.length > 0);
  // It asserts no jurisdiction-specific fact, so it carries no citation — and must not.
  for (const c of cautions) assert.deepEqual(c.citations, []);

  // It must not name any alleged database or agency practice. The Erin in the Morning
  // reporting that Texas may be building a list of marker applicants is SINGLE-SOURCED;
  // it is recorded in docs/RELOCATION.md and deliberately never rendered as fact.
  const html = renderPlanPage(plan, corpus, "en");
  assert.doesNotMatch(html, /database|watch ?list|registry of applicants/i);
});

// ── Cost model: the #1 barrier, so it must not lie by rounding ──────────────────────

test("the cost floor sums only stated fees, and counts what it cannot price", () => {
  const plan = buildRelocationPlan(intake({ origin: "US-CA", destination: "US-WA" }), TODAY, corpus);
  const c = plan.costs;

  // Every line is either a stated amount or an explicit unknown — never an estimate.
  for (const line of c.lines) {
    if (line.amount_usd === null) {
      assert.ok(
        c.variable_step_keys.includes(line.step_key) || c.unpriced_step_keys.includes(line.step_key),
        `${line.step_key}: a null amount must be counted as variable or unpriced`,
      );
    }
  }
  // The floor is exactly the sum of the known amounts — nothing extrapolated in.
  const expected = c.lines.reduce((n, l) => n + (l.amount_usd ?? 0), 0);
  assert.equal(c.known_total_usd, expected);

  // California's filing fee "varies by county" → it must land in `variable`, not be
  // silently guessed at the "commonly around $435–$480" the note mentions.
  assert.ok(c.variable_step_keys.length > 0);
  assert.ok(!c.lines.some((l) => l.amount_usd !== null && l.amount_usd > 400));
});

test("fee waivers are surfaced, because cost is the barrier", () => {
  const plan = buildRelocationPlan(intake({ origin: "US-TX", destination: "US-CA" }), TODAY, corpus);
  assert.ok(plan.costs.fee_waiver_step_keys.length > 0, "TX and CA both document a fee waiver");
  const html = renderPlanPage(plan, corpus, "en");
  assert.match(html, /fee waiver is documented/i);
});

test("potentially_waivable_usd is a SUBTOTAL of the known floor, never money added on top", () => {
  // Synthetic fixture: one step with a KNOWN, fee-waiver-documented amount, and one step
  // with a known amount but NO waiver — isolating the arithmetic from which real corpus
  // records happen to disagree on a figure (see costModel's own "varies" merge elsewhere).
  const waivedRecord = {
    id: "synthetic.waived",
    jurisdiction: "US-ZZ",
    document_type: "court-order" as const,
    change_type: ["name"] as ChangeType[],
    topic: "t",
    statement: "s",
    cost: { amount_usd: 252, fee_waiver: true as const },
    source: { url: "https://e.test", title: "T", last_verified: "2026-07-13", verifier: "A" },
    verification_status: "verified" as const,
    recheck_sla_days: 90,
    language: "en" as const,
  };
  const unwaivedRecord = {
    ...waivedRecord,
    id: "synthetic.unwaived",
    document_type: "drivers-license" as const,
    cost: { amount_usd: 30 },
  };
  const steps = [
    {
      key: "court-order",
      order: 1,
      document_type: "court-order" as const,
      jurisdiction: "US-ZZ",
      portability: "state-of-residence" as const,
      step_class: "redo-in-destination" as const,
      phase: "either" as const,
      title: "Court order",
      record_ids: [waivedRecord.id],
      prerequisites: [] as string[],
      cost: waivedRecord.cost,
      discretionary: false,
      needs_reverification: false,
      held: false,
    },
    {
      key: "drivers-license",
      order: 2,
      document_type: "drivers-license" as const,
      jurisdiction: "US-ZZ",
      portability: "state-of-residence" as const,
      step_class: "redo-in-destination" as const,
      phase: "either" as const,
      title: "License",
      record_ids: [unwaivedRecord.id],
      prerequisites: [] as string[],
      cost: unwaivedRecord.cost,
      discretionary: false,
      needs_reverification: false,
      held: false,
    },
  ];
  const model = costModel(steps, [waivedRecord, unwaivedRecord]);
  assert.equal(model.known_total_usd, 282, "the floor sums BOTH known amounts");
  assert.equal(model.potentially_waivable_usd, 252, "the subtotal counts only the fee-waiver-documented amount");
  assert.ok(
    model.potentially_waivable_usd <= model.known_total_usd,
    "the subtotal can never exceed the floor it is a slice of",
  );

  // Rendered on a real plan page, clearly labelled as a fact about the fee, not the reader's
  // odds (California's name-change AND gender-marker records both carry a known-shaped cost
  // note but an unstated amount, so use a real move where the corpus states one instead).
  const plan = buildRelocationPlan(intake({ origin: "US-CA", destination: "US-MI", held: [] }), TODAY, corpus);
  assert.ok(plan.costs.potentially_waivable_usd > 0, "Michigan's $175 court-order fee is both known and waivable");
  const html = renderPlanPage(plan, corpus, "en");
  assert.match(html, /potentially waivable/i);
});

test("potentially_waivable_usd is 0 when no priced step documents a waiver", () => {
  // A move with no fee-waiver-documented step at all (or only variable/unpriced ones) must
  // not report a nonzero subtotal — there is nothing to be a slice of.
  const noWaiverSteps = [
    {
      key: "ssa-card",
      order: 1,
      document_type: "ssa-card" as const,
      jurisdiction: "US" as const,
      portability: "federal" as const,
      step_class: "carries-over" as const,
      phase: "either" as const,
      title: "SSA",
      record_ids: [] as string[],
      prerequisites: [] as string[],
      cost: { amount_usd: 0 },
      discretionary: false,
      needs_reverification: false,
      held: false,
    },
  ];
  const model = costModel(noWaiverSteps, corpus);
  assert.equal(model.potentially_waivable_usd, 0);
});

test("the cost panel states its own incompleteness", () => {
  const plan = buildRelocationPlan(intake(), TODAY, corpus);
  const html = renderPlanPage(plan, corpus, "en");
  assert.match(html, /floor, not a total/i, "the cost model must admit it is a floor");
});

test("costModel skips held documents but prices everything else", () => {
  const plan = buildRelocationPlan(intake({ held: ["court-order"] }), TODAY, corpus);
  const model = costModel(plan.steps, corpus);
  const priced = new Set(model.lines.map((l) => l.step_key));
  assert.ok(!priced.has("court-order"), "a document already in hand is not a cost of moving");
  assert.ok(priced.has("drivers-license"), "the license the move forces IS a cost of moving");
});

// ── Guardrail #1 on the new surface ────────────────────────────────────────────────

test("every relocation plan passes the SAME citation gate as /answer", () => {
  const states = ["US-CA", "US-FL", "US-IL", "US-NY", "US-TX", "US-WA"];
  let checked = 0;
  for (const origin of states) {
    for (const destination of states) {
      if (origin === destination) continue;
      for (const language of ["en", "es"] as const) {
        // relocationAnswer() calls citation.enforce() internally: an uncited or stale-cited
        // claim throws rather than rendering.
        const ans = relocationAnswer(intake({ origin, destination, language }), TODAY, corpus);
        const report = checkCoverage(ans, corpus, TODAY);
        assert.equal(report.coverage, 1, `${origin}→${destination}/${language}: coverage ${report.coverage}`);
        assert.deepEqual(report.violations, []);
        // Every claim block must resolve to a real, current record.
        for (const b of ans.blocks.filter((x) => x.kind === "claim")) {
          assert.ok(b.citations.length > 0, "a claim block with no citation reached the answer");
          for (const id of b.citations) assert.ok(corpus.some((r) => r.id === id));
        }
        checked++;
      }
    }
  }
  assert.equal(checked, 60);
});

test("every substantive sentence on a plan page comes from a corpus record", () => {
  const plan = buildRelocationPlan(intake(), TODAY, corpus);
  const html = renderPlanPage(plan, corpus, "en");
  // Each step's claim bullets are record statements; each carries its source + date. The
  // URL is compared ESCAPED — one WA source carries a `&` query separator, and the renderer
  // is right to escape it.
  for (const step of plan.steps) {
    for (const id of step.record_ids) {
      const rec = corpus.find((r) => r.id === id)!;
      assert.ok(html.includes(escapeHtml(rec.statement)), `${id}: statement not rendered on the page`);
      assert.ok(html.includes(escapeHtml(rec.source.url)), `${id}: step rendered without its source link`);
      assert.ok(html.includes(rec.source.last_verified), `${id}: step rendered without a last-verified date`);
    }
  }
});

// ── The corpus annotation cannot outrun its source ─────────────────────────────────

test("residency_bound is rejected unless the record's own text says where you live", () => {
  const ny = corpus.find((r) => r.id === "ny.court-order.name")!;
  // NY's cited statement says "in civil court (or supreme court)" — it never mentions
  // residency. Annotating it would be a new, uncited legal claim wearing metadata's clothes.
  const issues = validateRecord({ ...ny, relocation: { residency_bound: true } });
  assert.equal(issues.length, 1);
  assert.equal(issues[0]!.field, "relocation.residency_bound");

  // Texas's statement DOES say "the county where you live", so the flag is supported.
  const tx = corpus.find((r) => r.id === "tx.court-order.name")!;
  assert.deepEqual(validateRecord({ ...tx, relocation: { residency_bound: true } }), []);
});

test("the residency rule holds in Spanish too", () => {
  const txEs = corpus.find((r) => r.id === "tx.court-order.name.es")!;
  assert.deepEqual(validateRecord(txEs), [], "'del condado donde vive' supports the flag");

  const nyEs = corpus.find((r) => r.id === "ny.court-order.name.es")!;
  assert.equal(validateRecord({ ...nyEs, relocation: { residency_bound: true } }).length, 1);
});

test("an unknown relocation trait is a content violation, not a silent pass", () => {
  const tx = corpus.find((r) => r.id === "tx.court-order.name")!;
  const issues = validateRecord({ ...tx, relocation: { portability: "federal" } });
  assert.equal(issues.length, 1);
  assert.match(issues[0]!.message, /unknown relocation trait/);
});

// ── Routing + the privacy posture that makes this mode safe to ship ────────────────

test("/move and /plan render, and a same-state 'move' explains itself", () => {
  const move = handleRoute("GET", new URL("http://x/move"), TODAY);
  assert.equal(move.status, 200);

  const plan = handleRoute("GET", new URL("http://x/plan?origin=US-TX&destination=US-WA&hold=court-order"), TODAY);
  assert.equal(plan.status, 200);
  assert.match(plan.body, /Moving from Texas to Washington/);

  const same = handleRoute("GET", new URL("http://x/plan?origin=US-TX&destination=US-TX"), TODAY);
  assert.equal(same.status, 200);
  assert.match(same.body, /two different states/i);

  const bad = handleRoute("GET", new URL("http://x/plan?origin=NOPE&destination=US-WA"), TODAY);
  assert.equal(bad.status, 400);
});

test("PRIVACY: a relocation plan is never logged", () => {
  // An (origin → destination) pair is intent to leave a hostile state, timestamped. The
  // route emits NO log descriptor at all — not a redacted one. api/log.ts's allowlist would
  // drop the fields anyway; that is the second lock, not the first.
  const plan = handleRoute("GET", new URL("http://x/plan?origin=US-TX&destination=US-WA"), TODAY);
  assert.equal(plan.log, undefined, "the plan route emitted a log descriptor");

  const move = handleRoute("GET", new URL("http://x/move"), TODAY);
  assert.equal(move.log, undefined);
});

test("PRIVACY: a plan is never written to the device unencrypted", () => {
  // The checklist offers an unencrypted "save for offline" copy and an encrypted resume
  // blob. A relocation plan gets NEITHER: an on-device artifact saying "leaving Texas for
  // Washington" is a forensic risk on a phone that may be searched. Print-and-go instead.
  const plan = buildRelocationPlan(intake(), TODAY, corpus);
  const html = renderPlanPage(plan, corpus, "en");
  assert.doesNotMatch(html, /offline-save|offline-cfg|assets\/offline\.js/, "plan offered an unencrypted local copy");
  assert.doesNotMatch(html, /resume-cfg|assets\/resume-panel\.js/, "plan offered a saved-state blob");
});

test("PRIVACY: the plan page is noindex and carries no share card", () => {
  const plan = buildRelocationPlan(intake(), TODAY, corpus);
  const html = renderPlanPage(plan, corpus, "en");
  assert.match(html, /content="noindex,follow"/);
  assert.doesNotMatch(html, /property="og:/, "a relocation plan must never be a social share surface");
  assert.doesNotMatch(html, /rel="canonical"/);
});

// ── The deferred care-density signal stays deferred ────────────────────────────────

test("no runtime module reaches the NPPES registry", () => {
  // The care-continuity signal is deliberately NOT shipped (see api/care-density.ts): asking
  // NPPES about a destination would disclose the relocation, and a provider-density count
  // cannot tell you whether a provider is affirming. This test is what stops "just call the
  // API" from landing quietly — the host may appear ONLY in the module that records the
  // deferral.
  const offenders: string[] = [];
  for (const dir of ["api", "src"]) {
    const walk = (d: string): string[] =>
      readdirSync(join(REPO_ROOT, d), { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(join(d, e.name)) : e.name.endsWith(".ts") ? [join(d, e.name)] : [],
      );
    for (const rel of walk(dir)) {
      if (rel === join("api", "care-density.ts")) continue;
      if (readFileSync(join(REPO_ROOT, rel), "utf8").includes(NPPES_HOST)) offenders.push(rel);
    }
  }
  assert.deepEqual(offenders, [], `NPPES host referenced outside the deferral record: ${offenders.join(", ")}`);
  assert.equal(CARE_DENSITY_DEFERRAL.status, "deferred");
  assert.equal(CARE_DENSITY_DEFERRAL.blockers.length, 2);
});

// ── Taxonomy sanity ───────────────────────────────────────────────────────────────

test("every document type has a portability class", () => {
  const docs: DocumentType[] = [
    "court-order",
    "ssa-card",
    "drivers-license",
    "passport",
    "birth-certificate",
    "financial-records",
    "green-card",
    "naturalization-certificate",
    "ead",
    "selective-service",
    "military-records",
    "trusted-traveler",
    "federal-employment-records",
  ];
  for (const d of docs) assert.ok(PORTABILITY[d], `${d} has no portability class`);
  assert.equal(PORTABILITY["passport"], "federal");
  assert.equal(PORTABILITY["drivers-license"], "state-of-residence");
  assert.equal(PORTABILITY["court-order"], "state-of-record");
});

test("the new federal immigration/military/employment document types are all federal — a move never changes which rules govern them", () => {
  // Unlike ssa-card/passport, none of these are on the relocation intake today (not in
  // CANONICAL_ORDER/DEFAULT_SET in api/relocation.ts), so this only pins the taxonomy
  // fact — that they are federally portable — for whenever that surface is extended.
  const federalDocs: DocumentType[] = [
    "green-card",
    "naturalization-certificate",
    "ead",
    "selective-service",
    "military-records",
    "trusted-traveler",
    "federal-employment-records",
  ];
  for (const d of federalDocs) assert.equal(PORTABILITY[d], "federal", `${d} should be federal`);
});

test("a Spanish plan never cites an English record — it reports a gap instead of falling back", () => {
  // The durable invariant: a plan in Spanish may only ever cite Spanish records. Silently
  // falling back to the English record would be an uncited claim in the wrong language.
  // Washington's Spanish records now exist (it was the last ES gap), so this is asserted
  // across EVERY origin×destination pair rather than resting on one state's missing corpus.
  const states = ["US-CA", "US-NY", "US-IL", "US-TX", "US-WA"];
  for (const origin of states) {
    for (const destination of states) {
      if (origin === destination) continue;
      const plan = buildRelocationPlan(intake({ origin, destination, language: "es" }), TODAY, corpus);
      for (const step of plan.steps) {
        for (const id of step.record_ids) {
          assert.equal(
            corpus.find((r) => r.id === id)!.language,
            "es",
            `a Spanish plan (${origin}→${destination}) cited an English record: ${id}`,
          );
        }
      }
    }
  }
});

test("a destination with no records in the user's language reports a gap, not a guess", () => {
  // The gap mechanism itself. The real corpus now has full EN/ES parity, so no live pair can
  // exercise it — but a future language-thin destination must still SAY so rather than
  // silently serving the English record. Synthetic corpus: EN-only driver's-licence records.
  const enOnly = corpus.filter((r) => r.language === "en");
  const plan = buildRelocationPlan(intake({ destination: "US-WA", language: "es" }), TODAY, enOnly);
  assert.ok(plan.gaps.length > 0, "missing Spanish coverage must surface as a gap");
  for (const step of plan.steps) {
    for (const id of step.record_ids) {
      assert.equal(enOnly.find((r) => r.id === id)!.language, "es", "a Spanish plan cited an English record");
    }
  }
});

test("the move intake and plan render in Spanish", () => {
  assert.match(renderMovePage("es"), /Mudarse a otro estado/);
  const plan = buildRelocationPlan(intake({ origin: "US-TX", destination: "US-CA", language: "es" }), TODAY, corpus);
  const html = renderPlanPage(plan, corpus, "es");
  assert.match(html, /Mudanza de Texas a California/);
  assert.match(html, /Antes de mudarse/);
});

// ── Minors pilot: audience exclusivity in the relocation planner ─────────────────────
// The default intake() here is Texas → Washington — both minors-pilot states — so a
// for_minor plan has real minor records to prefer over the adult ones on both ends.

test("a minor plan's court-order step cites the DESTINATION'S minor record, not the adult one", () => {
  const plan = buildRelocationPlan(intake({ for_minor: true }), TODAY, corpus);
  const courtOrder = plan.steps.find((s) => s.key === "court-order")!;
  assert.equal(courtOrder.jurisdiction, "US-WA");
  assert.ok(courtOrder.record_ids.includes("wa.court-order.name.minor"), courtOrder.record_ids.join(","));
  assert.ok(!courtOrder.record_ids.includes("wa.court-order.name"), courtOrder.record_ids.join(","));
});

test("the SAME origin/destination pair without for_minor cites the adult record instead", () => {
  const plan = buildRelocationPlan(intake(), TODAY, corpus);
  const courtOrder = plan.steps.find((s) => s.key === "court-order")!;
  assert.ok(courtOrder.record_ids.includes("wa.court-order.name"));
  assert.ok(!courtOrder.record_ids.includes("wa.court-order.name.minor"));
});

test("a minor plan never has an origin-window step for a record with no residency_bound annotation", () => {
  // The adult Texas court-order record is residency_bound (relocation.residency_bound:
  // true), so an adult plan gets an origin:court-order step warning that door closes when
  // you move. The minor Texas record makes no such claim — the corpus content gate would
  // reject it if it did, since the minor record's own prose never says "where you live",
  // only "where the child lives" — so a minor plan must not invent that hazard either.
  const adultPlan = buildRelocationPlan(intake(), TODAY, corpus);
  const minorPlan = buildRelocationPlan(intake({ for_minor: true }), TODAY, corpus);
  assert.ok(adultPlan.steps.some((s) => s.key === "origin:court-order"), "adult plan precondition");
  assert.ok(!minorPlan.steps.some((s) => s.key === "origin:court-order"), "minor plan must not invent the hazard");
  assert.ok(!minorPlan.hazards.some((h) => h.kind === "origin-window-closes" && h.step_key.startsWith("origin:court-order")));
});

test("a minor relocation plan still passes the identical citation gate as an adult one", () => {
  const ans = relocationAnswer(intake({ for_minor: true }), TODAY, corpus);
  const report = checkCoverage(ans, corpus, TODAY);
  assert.equal(report.coverage, 1, "every claim in a minor plan must resolve to a current, cited record");
  assert.equal(report.violations.length, 0);
});

test("/plan discloses no-minor-coverage when either side of the move lacks minor records", () => {
  // Florida is fully covered for adults but outside the five-state minors pilot.
  const html = handleRoute(
    "GET",
    new URL("http://localhost:8080/plan?origin=US-FL&destination=US-WA&for_minor=1"),
    TODAY,
  ).body;
  assert.match(html, /for adults/i);
});

test("/plan shows no no-minor-coverage note for a pilot-to-pilot move", () => {
  const html = handleRoute(
    "GET",
    new URL("http://localhost:8080/plan?origin=US-TX&destination=US-WA&for_minor=1"),
    TODAY,
  ).body;
  assert.doesNotMatch(html, /for adults/i);
});

// ── Referrals: the destination's help block, never the origin's ─────────────────────

test("the plan carries the DESTINATION's referrals (A4TE guide + legal aid) — static links only, nothing queried", () => {
  const html = renderPlanPage(buildRelocationPlan(intake(), TODAY, corpus), corpus, "en");
  assert.match(html, /id="help-h">Where to get help</);
  assert.match(html, /washington-identity-documents/);
  assert.doesNotMatch(html, /texas-identity-documents/); // the origin is not what the reader needs help with next
  // Outbound referral links never carry the plan URL along (global no-referrer policy is the
  // second lock; this is the per-link one).
  for (const m of html.matchAll(/<a href="https:\/\/transequality\.org[^"]*"([^>]*)>/g)) assert.match(m[1] ?? "", /rel="noopener noreferrer"/);
});
