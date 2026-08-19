// Coverage honesty: an ABSENCE must never render as an ANSWER.
//
// Two distinct ways this app could tell someone a step does not exist when the truth is
// only that we have not checked:
//
//   1. A well-formed but uncovered jurisdiction. `validJurisdiction` in api/router.ts
//      checks the SHAPE of the id (/^US(-[A-Z]{2})?$/), not whether the corpus has it, so
//      `/checklist?jurisdiction=US-FL` is a 200. Federal records match inside every state,
//      so the page used to render a confident two-step plan (SSA → passport) with nothing
//      anywhere saying the state layer was missing. A reader could not tell "we have not
//      checked Florida" from "Florida requires nothing beyond the federal steps".
//
//   2. A step no cited source prices. The plan summary added up the fees it knew and
//      silently skipped steps with no `cost` at all, printing a floor as though it were a
//      total — on cost, which the project's own research names the #1 reported barrier.
//
// Both are the same defect: something we do not know, rendered as a value. These tests
// pin the honest behaviour on every surface a person can reach.

import { test } from "node:test";
import assert from "node:assert/strict";

import { buildChecklist, hasNoStateCoverage } from "../api/checklist.ts";
import { loadCorpus } from "../api/corpus.ts";
import { answer } from "../api/guidance.ts";
import { handleRoute } from "../api/router.ts";
import { renderChecklistPage, renderPacketPage } from "../src/pages.ts";
import { escapeHtml } from "../src/render.ts";
import { t as locale } from "../src/i18n/index.ts";
import type { CorpusRecord, Intake, Language } from "../api/types.ts";

const corpus = loadCorpus();

/** A state that is deliberately NOT in the corpus. Shape-valid, so the router accepts it. */
const UNCOVERED = "US-FL";
/** A state the corpus does cover. */
const COVERED = "US-CA";

// Raw form for answer-block text; escaped form for anything asserted against rendered HTML
// (the copy contains apostrophes, which the renderer escapes).
const noteEn = locale("en").ui.noStateCoverage;
const noteEs = locale("es").ui.noStateCoverage;
const noteEnHtml = escapeHtml(noteEn);
const noteEsHtml = escapeHtml(noteEs);
const unpricedHtml = (n: number) => escapeHtml(locale("en").ui.costIncomplete(n));

function intakeFor(jurisdiction: string, language: Language = "en"): Intake {
  return { jurisdiction, change_types: ["name", "gender-marker"], documents: [], language };
}

function bodyOf(path: string): string {
  const r = handleRoute("GET", new URL("http://localhost:8080" + path), "2026-08-18");
  assert.equal(r?.status, 200, `${path} should render, not error`);
  return String(r?.body ?? "");
}

// ── The predicate itself ──────────────────────────────────────────────────────

test("hasNoStateCoverage is true for a shape-valid state absent from the corpus", () => {
  assert.equal(hasNoStateCoverage(UNCOVERED, corpus), true);
});

test("hasNoStateCoverage is false for every state the intake form actually offers", () => {
  for (const j of ["US-CA", "US-IL", "US-NY", "US-TX", "US-WA"]) {
    assert.equal(hasNoStateCoverage(j, corpus), false, `${j} is covered and must not be flagged`);
  }
});

test("hasNoStateCoverage is false for the federal jurisdiction itself", () => {
  // "US" is not an uncovered state — the federal records ARE its records. Flagging it
  // would be a false alarm telling a user we lack data we in fact have.
  assert.equal(hasNoStateCoverage("US", corpus), false);
});

test("a state present only in a NON-CURRENT or non-English record still counts as covered", () => {
  // Freshness and language have their own honest signals (per-step "needs reverification"
  // and the thinner-language note). Narrowing this predicate by either would make it fire
  // on states we do cover — a false "we know nothing" is its own harm.
  const base = corpus[0] as CorpusRecord;
  const stale: CorpusRecord = {
    ...base,
    id: "zz.stale",
    jurisdiction: "US-ZZ",
    language: "es",
    source: { ...base.source, last_verified: "1999-01-01" },
  };
  assert.equal(hasNoStateCoverage("US-ZZ", [...corpus, stale]), false);
});

// ── The checklist surface ─────────────────────────────────────────────────────

test("an uncovered state says so ABOVE its steps, not only in the gaps list", () => {
  const cl = buildChecklist(intakeFor(UNCOVERED), undefined, corpus);
  // Precondition: federal records really do produce a plausible-looking plan here.
  assert.ok(cl.steps.length > 0, "federal steps still render for an uncovered state");

  const html = renderChecklistPage(cl, corpus, "en", `jurisdiction=${UNCOVERED}`, { noStateCoverage: true });
  assert.ok(html.includes(noteEnHtml), "the uncovered-state disclosure must render");
  // Placement is the point: after the steps the page already reads as a finished plan.
  assert.ok(
    html.indexOf(noteEnHtml) < html.indexOf('class="step'),
    "the disclosure must appear before the first step, not after the plan",
  );
});

test("the disclosure asserts nothing about what the state requires", () => {
  // It may only describe THIS corpus. A sentence like "your state requires a court order"
  // would be an unsourced legal claim; so would "no further steps are needed".
  for (const note of [noteEn, noteEs]) {
    assert.doesNotMatch(note, /\bno (further|additional|other) steps\b/i);
    assert.doesNotMatch(note, /\bnothing (else|more) is (needed|required)\b/i);
  }
  // And it must actively rule out the dangerous reading.
  assert.match(noteEn, /not a sign that your state asks nothing of you/i);
});

test("a COVERED state gets no uncovered-state note (no false 'we know nothing')", () => {
  const cl = buildChecklist(intakeFor(COVERED), undefined, corpus);
  const html = renderChecklistPage(cl, corpus, "en", `jurisdiction=${COVERED}`, { noStateCoverage: false });
  assert.ok(!html.includes(noteEnHtml));
});

test("the router wires the disclosure onto /checklist and /packet for an uncovered state", () => {
  const q = `jurisdiction=${UNCOVERED}&change=name&change=gender-marker`;
  assert.ok(bodyOf(`/checklist?${q}`).includes(noteEnHtml), "/checklist must disclose");
  // The packet is what people print and carry to a clerk, so the caveat must reach paper.
  assert.ok(bodyOf(`/packet?${q}`).includes(noteEnHtml), "/packet must disclose");
});

test("the router does NOT show the disclosure for a covered state", () => {
  const q = `jurisdiction=${COVERED}&change=name&change=gender-marker`;
  assert.ok(!bodyOf(`/checklist?${q}`).includes(noteEnHtml));
  assert.ok(!bodyOf(`/packet?${q}`).includes(noteEnHtml));
});

test("the packet disclosure is printable, not a screen-only affordance", () => {
  const cl = buildChecklist(intakeFor(UNCOVERED), undefined, corpus);
  const html = renderPacketPage(cl, corpus, "en", "2026-08-18", `jurisdiction=${UNCOVERED}`, {
    noStateCoverage: true,
  });
  const idx = html.indexOf(noteEnHtml);
  assert.ok(idx > -1, "the packet must carry the disclosure");
  // A printed packet that silently drops the caveat is the harm this guards. `no-print`
  // would do exactly that, so the disclosure must not be marked with it.
  assert.match(html.slice(idx - 40, idx), /class="flag" role="note"/);
  assert.ok(!html.slice(idx - 40, idx).includes("no-print"));
});

// ── The /answer surface ───────────────────────────────────────────────────────

test("/answer for an uncovered state discloses it, and still passes the citation gate", () => {
  // enforce() runs inside answer(); it throws rather than returning on a violation, so
  // reaching this assertion at all proves the uncited disclosure block is legal.
  const ans = answer({ jurisdiction: UNCOVERED, change_types: ["name", "gender-marker"], today: "2026-08-18" });
  const disclosure = ans.blocks.find((b) => b.text === noteEn);
  assert.ok(disclosure, "the disclosure block must be present");
  assert.equal(disclosure.kind, "uncertainty", "it is something we do not know, not a claim");
  assert.deepEqual(disclosure.citations, [], "it asserts no rule, so it cites nothing");
  assert.equal(ans.blocks[0], disclosure, "it must come first, before the cited federal claims");
});

test("/answer for a covered state carries no disclosure", () => {
  const ans = answer({ jurisdiction: COVERED, change_types: ["name", "gender-marker"], today: "2026-08-18" });
  assert.ok(!ans.blocks.some((b) => b.text === noteEn));
});

test("the /answer route renders the disclosure for an uncovered state", () => {
  const html = bodyOf(`/answer?jurisdiction=${UNCOVERED}&change=name&change=gender-marker`);
  assert.ok(html.includes(noteEnHtml));
});

test("the disclosure is localized — a Spanish page shows no English chrome", () => {
  for (const path of [`/checklist?jurisdiction=${UNCOVERED}&change=name&language=es`, `/answer?jurisdiction=${UNCOVERED}&change=name&language=es`]) {
    const html = bodyOf(path);
    assert.ok(html.includes(noteEsHtml), `${path} must carry the Spanish disclosure`);
    assert.ok(!html.includes(noteEnHtml), `${path} must not leak the English one`);
  }
});

// ── The cost total ────────────────────────────────────────────────────────────

/** A synthetic state: two steps priced with a real number, two with no cost at all. */
function costFixture(): CorpusRecord[] {
  const base = corpus[0] as CorpusRecord;
  const make = (id: string, document_type: string, cost?: { amount_usd: number | null }): CorpusRecord => {
    const r = {
      ...base,
      id,
      jurisdiction: "US-ZZ",
      document_type,
      change_type: ["name"],
      language: "en",
    } as unknown as Record<string, unknown>;
    if (cost) r["cost"] = cost;
    else delete r["cost"];
    return r as unknown as CorpusRecord;
  };
  return [
    make("zz.court-order", "court-order", { amount_usd: 435 }),
    make("zz.ssa", "ssa-card"), // no cited source prices this step
    make("zz.dl", "drivers-license"), // nor this one
    make("zz.passport", "passport", { amount_usd: 145 }),
  ];
}

test("an unpriced step is never silently treated as $0 in the plan total", () => {
  const fx = costFixture();
  const cl = buildChecklist(
    { jurisdiction: "US-ZZ", change_types: ["name"], documents: [], language: "en" },
    undefined,
    fx,
  );
  const unpriced = cl.steps.filter((s) => !s.cost);
  assert.equal(unpriced.length, 2, "fixture precondition: two steps carry no cost");

  const html = renderChecklistPage(cl, fx, "en", "jurisdiction=US-ZZ");
  const summary = html.match(/<p class="plan-summary">[\s\S]*?<\/p>/)?.[0] ?? "";

  // The regression: this used to read exactly "$580", a floor presented as a total.
  assert.ok(!/\$580(?!\+)/.test(summary), "a bare $580 would claim the plan costs $580");
  assert.match(summary, /\$580\+/, "the known fees are still shown, marked incomplete");
  assert.ok(html.includes(unpricedHtml(2)), "and the count of unpriced steps is stated");
});

test("REGRESSION: the live intake path that printed a bare total (birth certificate + SSA)", () => {
  // Not hypothetical and not URL-surgery: "Birth certificate" and "Social Security card"
  // are both checkboxes on the intake form (DOCUMENT_IDS in src/pages.ts). Twelve corpus
  // records carry a numeric fee and all of them are birth-certificate or WA driver's
  // licence records, so this selection is exactly where a stated amount meets an unpriced
  // sibling. Measured on the parent commit, `/checklist?jurisdiction=US-CA&change=name&
  // doc=birth-certificate&doc=ssa-card` rendered "2 steps · Estimated cost: $26" — the
  // $26 birth-record fee presented as the price of the plan, while nothing in the corpus
  // prices the SSA step at all. Texas printed "$15" the same way.
  for (const [j, amount] of [
    ["US-CA", 26],
    ["US-TX", 15],
  ] as const) {
    const html = bodyOf(`/checklist?jurisdiction=${j}&change=name&doc=birth-certificate&doc=ssa-card`);
    const summary = html.match(/<p class="plan-summary">[\s\S]*?<\/p>/)?.[0] ?? "";
    assert.ok(
      !new RegExp(`\\$${amount}(?!\\+)`).test(summary),
      `${j}: a bare $${amount} claims the whole plan costs that`,
    );
    assert.match(summary, new RegExp(`\\$${amount}\\+`), `${j}: the stated fee survives, marked incomplete`);
    assert.ok(html.includes(unpricedHtml(1)), `${j}: the unpriced step must be named`);
  }
});

test("REGRESSION: a $0 fee beside an unpriced step no longer erases the cost line entirely", () => {
  // Washington's driver's-licence record states $0. On the parent commit, pairing it with
  // the unpriced SSA step gave known=0, anyVaries=false and unpriced skipped — so the
  // summary rendered "2 steps" with NO cost line at all. Absence and $0 collapsed together.
  const html = bodyOf("/checklist?jurisdiction=US-WA&change=name&change=gender-marker&doc=drivers-license&doc=ssa-card");
  assert.ok(html.includes(unpricedHtml(1)), "the unpriced step must be disclosed, not silently dropped");
});

test("every real state's checklist states how many of its steps are unpriced", () => {
  // Not a hypothetical: no cited source in this corpus prices the SSA step for ANY state,
  // so today every single plan is a floor. Saying so is the honest default, and it matches
  // what the relocation planner already tells people (api/relocation.ts costModel).
  for (const j of ["US-CA", "US-IL", "US-NY", "US-TX", "US-WA"]) {
    const cl = buildChecklist(intakeFor(j), undefined, corpus);
    const unpriced = cl.steps.filter((s) => !s.cost && !s.done).length;
    const html = renderChecklistPage(cl, corpus, "en", `jurisdiction=${j}`);
    if (unpriced > 0) {
      assert.ok(html.includes(unpricedHtml(unpriced)), `${j}: ${unpriced} unpriced step(s) must be disclosed`);
    }
  }
});

test("a fully priced plan shows a plain total with no incompleteness note", () => {
  const base = corpus[0] as CorpusRecord;
  const priced = (id: string, document_type: string, amount_usd: number) =>
    ({ ...base, id, jurisdiction: "US-ZY", document_type, change_type: ["name"], language: "en", cost: { amount_usd } }) as unknown as CorpusRecord;
  const fx = [priced("zy.court-order", "court-order", 100), priced("zy.ssa", "ssa-card", 20)];
  const cl = buildChecklist(
    { jurisdiction: "US-ZY", change_types: ["name"], documents: ["court-order", "ssa-card"], language: "en" },
    undefined,
    fx,
  );
  const html = renderChecklistPage(cl, fx, "en", "jurisdiction=US-ZY");
  const summary = html.match(/<p class="plan-summary">[\s\S]*?<\/p>/)?.[0] ?? "";
  assert.match(summary, /\$120(?!\+)/, "nothing is unknown here, so no '+'");
  assert.ok(!html.includes(unpricedHtml(1)));
});
