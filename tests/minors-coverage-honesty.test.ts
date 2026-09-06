// Minors-pilot coverage honesty: an absence of MINOR guidance must never render as if the
// adult rule simply applied. Modeled directly on tests/coverage-honesty.test.ts (PR #119's
// uncovered-state honesty), one dimension narrower: a state can be fully covered for
// ADULTS (hasNoStateCoverage false) and still have no minor-audience record at all — every
// state outside the five-state pilot (California, Illinois, New York, Texas, Washington).
//
// Two distinct absences this file keeps distinguishable, exactly like the parent test:
//   1. A pilot state, for a document/change the pilot covers: retrieval serves the
//      MINOR record and ONLY the minor record — never the adult one alongside it.
//   2. A non-pilot state (or a pilot state's uncovered document/change): retrieval falls
//      through to the adult record, and the app says so, above the steps, in both
//      languages — "these are for adults and may not apply" — never silently.

import { test } from "node:test";
import assert from "node:assert/strict";

import { buildChecklist, hasNoMinorCoverage } from "../api/checklist.ts";
import { loadCorpus } from "../api/corpus.ts";
import { answer } from "../api/guidance.ts";
import { handleRoute } from "../api/router.ts";
import { renderChecklistPage, renderPacketPage } from "../src/pages.ts";
import { escapeHtml } from "../src/render.ts";
import { t as locale } from "../src/i18n/index.ts";
import type { Intake, Language } from "../api/types.ts";

const corpus = loadCorpus();

/** The five-state minors pilot. Every other US state/territory must degrade. */
const PILOT_STATES = ["US-CA", "US-IL", "US-NY", "US-TX", "US-WA"];
/** A state fully covered for adults, but — like the other 45 — outside the pilot. */
const NON_PILOT_COVERED = "US-FL";

const noteEn = locale("en").ui.noMinorCoverage;
const noteEs = locale("es").ui.noMinorCoverage;
const noteEnHtml = escapeHtml(noteEn);
const noteEsHtml = escapeHtml(noteEs);

function minorIntake(jurisdiction: string, language: Language = "en"): Intake {
  return { jurisdiction, change_types: ["name", "gender-marker"], documents: [], language, for_minor: true };
}

function bodyOf(path: string): string {
  const r = handleRoute("GET", new URL("http://localhost:8080" + path), "2026-08-18");
  assert.equal(r?.status, 200, `${path} should render, not error`);
  return String(r?.body ?? "");
}

// ── The predicate itself ──────────────────────────────────────────────────────

test("hasNoMinorCoverage is false for every pilot state", () => {
  for (const j of PILOT_STATES) {
    assert.equal(hasNoMinorCoverage(j, corpus), false, `${j} is a minors-pilot state and must not be flagged`);
  }
});

test("hasNoMinorCoverage is true for a state fully covered for adults but outside the pilot", () => {
  assert.equal(hasNoMinorCoverage(NON_PILOT_COVERED, corpus), true);
});

test("hasNoMinorCoverage is false for the federal jurisdiction itself", () => {
  assert.equal(hasNoMinorCoverage("US", corpus), false);
});

test("a pilot state with only a STALE minor record still counts as covered (freshness has its own signal)", () => {
  const base = corpus.find((r) => r.id === "ca.court-order.name.minor")!;
  const stale = { ...base, id: "zz.stale.minor", jurisdiction: "US-ZZ", source: { ...base.source, last_verified: "1999-01-01" } };
  assert.equal(hasNoMinorCoverage("US-ZZ", [...corpus, stale]), false);
});

// ── The checklist surface ─────────────────────────────────────────────────────

test("a non-pilot state + minor says so ABOVE its steps, and the steps below are the adult ones", () => {
  const cl = buildChecklist(minorIntake(NON_PILOT_COVERED), undefined, corpus);
  assert.ok(cl.steps.length > 0, "adult/federal steps still render for a non-pilot state's minor query");
  assert.ok(
    cl.steps.every((s) => !s.record_ids.some((id) => corpus.find((r) => r.id === id)?.audience === "minor")),
    "a non-pilot state has no minor records to serve in the first place",
  );

  const html = renderChecklistPage(cl, corpus, "en", `jurisdiction=${NON_PILOT_COVERED}&for_minor=1`, { noMinorCoverage: true });
  assert.ok(html.includes(noteEnHtml), "the no-minor-coverage disclosure must render");
  assert.ok(
    html.indexOf(noteEnHtml) < html.indexOf('class="step'),
    "the disclosure must appear before the first step, not after the plan",
  );
});

test("the disclosure asserts nothing about what the state requires or permits for a minor", () => {
  for (const note of [noteEn, noteEs]) {
    assert.doesNotMatch(note, /\bno (further|additional|other) steps\b/i);
    assert.doesNotMatch(note, /\ballowed\b|\bpermitted\b|\bbanned\b|\bprohibited\b/i);
  }
  // And it must actively flag the dangerous reading: the steps below are for adults.
  assert.match(noteEn, /for adults/i);
});

test("a PILOT state's checklist gets no no-minor-coverage note, and its court-order step cites the MINOR record", () => {
  const cl = buildChecklist(
    { jurisdiction: "US-CA", change_types: ["name"], documents: ["court-order"], language: "en", for_minor: true },
    undefined,
    corpus,
  );
  const html = renderChecklistPage(cl, corpus, "en", "jurisdiction=US-CA&doc=court-order&for_minor=1", { noMinorCoverage: false });
  assert.ok(!html.includes(noteEnHtml));

  const step = cl.steps.find((s) => s.document_type === "court-order")!;
  assert.ok(step.record_ids.includes("ca.court-order.name.minor"), step.record_ids.join(","));
  assert.ok(!step.record_ids.includes("ca.court-order.name"), step.record_ids.join(","));
});

test("the SAME California query without for_minor never cites the minor record", () => {
  const cl = buildChecklist(
    { jurisdiction: "US-CA", change_types: ["name"], documents: ["court-order"], language: "en" },
    undefined,
    corpus,
  );
  const step = cl.steps.find((s) => s.document_type === "court-order")!;
  assert.ok(step.record_ids.includes("ca.court-order.name"));
  assert.ok(!step.record_ids.includes("ca.court-order.name.minor"));
});

test("an adult (non-minor) query gets no no-minor-coverage note regardless of state coverage", () => {
  const cl = buildChecklist({ jurisdiction: NON_PILOT_COVERED, change_types: ["name"], documents: [], language: "en" }, undefined, corpus);
  const html = renderChecklistPage(cl, corpus, "en", `jurisdiction=${NON_PILOT_COVERED}`, { noMinorCoverage: false });
  assert.ok(!html.includes(noteEnHtml));
});

// ── The router: /checklist and /packet ────────────────────────────────────────

test("the router wires the no-minor-coverage disclosure onto /checklist and /packet for a non-pilot state + minor", () => {
  const q = `jurisdiction=${NON_PILOT_COVERED}&change=name&for_minor=1`;
  assert.ok(bodyOf(`/checklist?${q}`).includes(noteEnHtml), "/checklist must disclose");
  assert.ok(bodyOf(`/packet?${q}`).includes(noteEnHtml), "/packet must disclose (it is printed and carried to a clerk)");
});

test("the router does NOT show the no-minor-coverage disclosure for a pilot state + minor", () => {
  const q = "jurisdiction=US-CA&change=name&for_minor=1";
  assert.ok(!bodyOf(`/checklist?${q}`).includes(noteEnHtml));
  assert.ok(!bodyOf(`/packet?${q}`).includes(noteEnHtml));
});

test("the router does NOT show the no-minor-coverage disclosure when for_minor is absent, even for a non-pilot state", () => {
  const q = `jurisdiction=${NON_PILOT_COVERED}&change=name`;
  assert.ok(!bodyOf(`/checklist?${q}`).includes(noteEnHtml));
});

test("the packet's no-minor-coverage disclosure is printable, not a screen-only affordance", () => {
  const cl = buildChecklist(minorIntake(NON_PILOT_COVERED), undefined, corpus);
  const html = renderPacketPage(cl, corpus, "en", "2026-08-18", `jurisdiction=${NON_PILOT_COVERED}&for_minor=1`, {
    noMinorCoverage: true,
  });
  const idx = html.indexOf(noteEnHtml);
  assert.ok(idx > -1, "the packet must carry the disclosure");
  assert.match(html.slice(idx - 40, idx), /class="flag" role="note"/);
  assert.ok(!html.slice(idx - 40, idx).includes("no-print"));
});

// ── The /answer surface ───────────────────────────────────────────────────────

test("/answer for a non-pilot state + minor discloses it, first, and still passes the citation gate", () => {
  const ans = answer({ jurisdiction: NON_PILOT_COVERED, change_types: ["name"], for_minor: true, today: "2026-08-18" });
  const disclosure = ans.blocks.find((b) => b.text === noteEn);
  assert.ok(disclosure, "the disclosure block must be present");
  assert.equal(disclosure.kind, "uncertainty", "it is something we do not know, not a claim");
  assert.deepEqual(disclosure.citations, [], "it asserts no rule, so it cites nothing");
  assert.equal(ans.blocks[0], disclosure, "it must come first, before the cited adult claims");
});

test("/answer for a pilot state + minor carries no no-minor-coverage disclosure, and cites the minor record", () => {
  const ans = answer({ jurisdiction: "US-CA", change_types: ["name"], documents: ["court-order"], for_minor: true, today: "2026-08-18" });
  assert.ok(!ans.blocks.some((b) => b.text === noteEn));
  assert.ok(ans.cited_records.some((r) => r.id === "ca.court-order.name.minor"));
  assert.ok(!ans.cited_records.some((r) => r.id === "ca.court-order.name"));
});

test("/answer for the SAME state without for_minor carries no no-minor-coverage disclosure", () => {
  const ans = answer({ jurisdiction: NON_PILOT_COVERED, change_types: ["name"], today: "2026-08-18" });
  assert.ok(!ans.blocks.some((b) => b.text === noteEn));
});

test("the /answer route renders the disclosure for a non-pilot state + minor", () => {
  const html = bodyOf(`/answer?jurisdiction=${NON_PILOT_COVERED}&change=name&for_minor=1`);
  assert.ok(html.includes(noteEnHtml));
});

// ── Localization ───────────────────────────────────────────────────────────────

test("the no-minor-coverage disclosure is localized — a Spanish page shows no English chrome", () => {
  for (const path of [
    `/checklist?jurisdiction=${NON_PILOT_COVERED}&change=name&for_minor=1&language=es`,
    `/answer?jurisdiction=${NON_PILOT_COVERED}&change=name&for_minor=1&language=es`,
  ]) {
    const html = bodyOf(path);
    assert.ok(html.includes(noteEsHtml), `${path} must carry the Spanish disclosure`);
    assert.ok(!html.includes(noteEnHtml), `${path} must not leak the English one`);
  }
});

// ── Ordering with the (broader) uncovered-state disclosure ────────────────────

test("a wholly uncovered territory + minor shows the state-coverage note before the minor-coverage note", () => {
  // US-PR carries neither adult nor minor records — both disclosures are true statements,
  // and the broader one (nothing at all) reads first.
  const html = bodyOf("/answer?jurisdiction=US-PR&change=name&for_minor=1");
  const stateNote = escapeHtml(locale("en").ui.noStateCoverage);
  assert.ok(html.includes(stateNote));
  assert.ok(html.includes(noteEnHtml));
  assert.ok(html.indexOf(stateNote) < html.indexOf(noteEnHtml));
});
