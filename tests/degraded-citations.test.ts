// A step whose backing records have all lapsed their recheck SLA must still hand the
// reader the official page. Before this, `record_ids` carried only CURRENT records and
// every source list rendered from it, so a fully-degraded step printed "Needs
// reverification, so we don't show it as current", the gaps section said "Check the
// official source." — and the page contained no official source to check.
//
// The freshness contract itself is unchanged and is asserted here as well: a lapsed
// record still contributes no statement, no cost, no timeline and no prerequisite.
// Only its URL crosses the line, and only when the step would otherwise cite nothing.

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildChecklist } from "../api/checklist.ts";
import { loadCorpus } from "../api/corpus.ts";
import { isCurrent } from "../api/freshness.ts";
import { escapeHtml, renderChecklist, renderPacket, staleSourceList } from "../src/render.ts";
import { handleRoute } from "../api/router.ts";
import { t as locale } from "../src/i18n/index.ts";
import type { CorpusRecord, DocumentType, Intake, Language } from "../api/types.ts";

const corpus = loadCorpus();

/** Real clock is irrelevant here: both dates are pinned so this test cannot rot. */
const TODAY = "2026-09-07";
/**
 * The day the corpus stops serving anything. 436 of the 438 records serving on TODAY
 * share `last_verified: 2026-07-13` with a 90-day SLA, so they lapse together. Pinned as
 * a LITERAL rather than derived from the corpus: a fixture computed from the value under
 * test moves with it and can never catch a wrong one.
 */
const AFTER_CLIFF = "2026-10-12";

/**
 * Every comparison against rendered HTML goes through escapeHtml first. A raw comparison
 * silently cannot fail for any record whose text contains an apostrophe or an ampersand —
 * which is most of them, and which is how the first run of negative control 3 below left
 * two leak assertions green while the statement was visibly on the page.
 *
 * That sentence was written about the RECORD text and was not true of the whole file: eight
 * comparisons against the locale bundle's own copy (`ui.sources`, `ui.staleSources`,
 * `ui.staleSourcesNote`) were still raw, including the leak assertion that the Spanish page
 * must not carry the English heading. They passed for a reason that has nothing to do with
 * what they assert — none of those strings happens to contain a character escapeHtml
 * rewrites — while `src/render.ts:305` escapes all of them. An editor adding an apostrophe
 * to any one ("Check the state's official pages…") would have disarmed them in the same
 * commit, with nothing to say so.
 *
 * Two of the eight were found by running that exact change and not by reading, because they
 * go through a local alias (`const t = locale("en").ui`) and a grep for the spelled-out
 * `locale("en").ui.staleSources` does not see them. If you add a comparison here, escape it;
 * do not rely on finding the unescaped ones later.
 */
function externalLinks(html: string): string[] {
  return [...html.matchAll(/href="(https?:[^"]+)"/g)].map((m) => m[1]!);
}

/** Every (jurisdiction × document) cell the corpus can build an English step for. */
function englishCells(): { jurisdiction: string; document_type: DocumentType }[] {
  const seen = new Map<string, { jurisdiction: string; document_type: DocumentType }>();
  for (const r of corpus) {
    if (r.language !== "en") continue;
    seen.set(`${r.jurisdiction}|${r.document_type}`, { jurisdiction: r.jurisdiction, document_type: r.document_type });
  }
  return [...seen.values()];
}

function intakeFor(jurisdiction: string, doc: DocumentType, language: Language = "en"): Intake {
  return { jurisdiction, change_types: ["name", "gender-marker"], documents: [doc], language };
}

test("every rendered checklist step carries at least one official source link", () => {
  // The page's own lede promises "Each links to its official source and the date it was
  // last checked." This asserts that promise for every cell in the corpus, on the day the
  // corpus is healthiest AND on the day every record in it has lapsed. A step that cannot
  // link a source is the defect; there is no acceptable count of them above zero.
  for (const day of [TODAY, AFTER_CLIFF]) {
    const offenders: string[] = [];
    for (const cell of englishCells()) {
      const checklist = buildChecklist(intakeFor(cell.jurisdiction, cell.document_type), day);
      for (const step of checklist.steps) {
        const html = renderChecklist({ ...checklist, steps: [step] }, corpus, "en");
        if (externalLinks(html).length === 0) {
          offenders.push(`${day} ${cell.jurisdiction}/${cell.document_type}`);
        }
      }
    }
    assert.deepEqual(offenders, [], `steps with no source link on ${day}`);
  }
});

test("a step whose every record lapsed still links the official page, labelled as unchecked", () => {
  // Alabama birth certificates were one of exactly three cells already in this state on
  // 2026-09-07 — measured, not hypothetical.
  const checklist = buildChecklist(intakeFor("US-AL", "birth-certificate"), TODAY);
  const step = checklist.steps.find((s) => s.document_type === "birth-certificate");
  assert.ok(step, "expected a birth-certificate step for Alabama");
  assert.deepEqual(step.record_ids, [], "fixture is wrong: this cell is not fully degraded");
  assert.ok(step.unverified_record_ids.length > 0, "the lapsed records must still be named");

  const html = renderChecklist(checklist, corpus, "en");
  const t = locale("en").ui;
  assert.ok(html.includes(escapeHtml(t.staleSources)), "the unchecked-sources heading is missing");
  assert.ok(html.includes(escapeHtml(t.staleSourcesNote)), "the note saying what the link is not is missing");

  const lapsed = step.unverified_record_ids.map((id) => corpus.find((r) => r.id === id)!);
  for (const r of lapsed) {
    assert.ok(html.includes(escapeHtml(r.source.url)), `${r.id}'s source URL is not on the page`);
    // The freshness contract: the URL crosses, the CLAIM does not.
    assert.ok(!html.includes(escapeHtml(r.statement)), `${r.id}'s statement leaked onto a degraded step`);
    if (r.detail) assert.ok(!html.includes(escapeHtml(r.detail)), `${r.id}'s detail leaked onto a degraded step`);
  }
  // Nothing substantive is derived from a lapsed record either.
  assert.equal(step.cost, undefined);
  assert.equal(step.timeline, undefined);
  assert.equal(step.discretionary, false);
  assert.equal(step.needs_reverification, true);
});

test("the packet degrades the same way the checklist does", () => {
  const checklist = buildChecklist(intakeFor("US-AL", "birth-certificate"), TODAY);
  const html = renderPacket(checklist, corpus, "en", TODAY);
  const step = checklist.steps.find((s) => s.document_type === "birth-certificate")!;
  const lapsed = step.unverified_record_ids.map((id) => corpus.find((r) => r.id === id)!);
  assert.ok(html.includes(escapeHtml(locale("en").ui.staleSources)));
  for (const r of lapsed) {
    assert.ok(html.includes(escapeHtml(r.source.url)), `${r.id}'s source URL is missing from the packet`);
    assert.ok(!html.includes(escapeHtml(r.statement)), `${r.id}'s statement leaked into the packet`);
  }
});

test("a step that still has a current source does NOT also print the unchecked list", () => {
  // A live citation and a stale one side by side blurs which is which. The stale list is
  // for the case where the reader would otherwise be told to check nothing.
  const checklist = buildChecklist(intakeFor("US-CA", "birth-certificate"), TODAY);
  const step = checklist.steps.find((s) => s.document_type === "birth-certificate");
  assert.ok(step && step.record_ids.length > 0, "fixture is wrong: this cell has no current record");
  const html = renderChecklist(checklist, corpus, "en");
  assert.ok(html.includes(escapeHtml(locale("en").ui.sources)));
  assert.ok(!html.includes(escapeHtml(locale("en").ui.staleSources)));
});

test("the Spanish checklist degrades in Spanish", () => {
  // The reader least able to check us gets the same link and the same caveat, in their
  // own language — the ES strings, never the EN ones leaking through.
  const es = locale("es").ui;
  const en = locale("en").ui;
  const cells = englishCells();
  let asserted = 0;
  for (const cell of cells) {
    const checklist = buildChecklist(intakeFor(cell.jurisdiction, cell.document_type, "es"), AFTER_CLIFF);
    for (const step of checklist.steps) {
      if (step.record_ids.length > 0 || step.unverified_record_ids.length === 0) continue;
      const html = renderChecklist({ ...checklist, steps: [step] }, corpus, "es");
      assert.ok(html.includes(escapeHtml(es.staleSources)), `${cell.jurisdiction}/${cell.document_type} lost its ES heading`);
      assert.ok(!html.includes(escapeHtml(en.staleSources)), `${cell.jurisdiction}/${cell.document_type} leaked the EN heading`);
      asserted++;
    }
  }
  assert.ok(asserted > 0, "no Spanish step reached the degraded path — widen the fixture");
});

test("the relocation plan hands over a lapsed step's official page too", () => {
  // /plan builds its own step type and its own source list; it had the same defect.
  const res = handleRoute(
    "GET",
    new URL("http://x/plan?origin=US-MT&destination=US-CA&change=name&change=gender-marker&language=en"),
    AFTER_CLIFF,
  );
  assert.equal(res.status, 200);
  const html = res.body ?? "";
  assert.ok(html.includes(escapeHtml(locale("en").ui.staleSources)), "the plan printed no unchecked-sources block");
  assert.ok(externalLinks(html).some((u) => u.endsWith(".gov") || u.includes(".gov/")), "no .gov page survived");
});

test("staleSourceList renders nothing for an empty list, and never invents a heading", () => {
  // An empty list must be an empty string, not a heading over nothing — a bare "Check
  // these official pages yourself" with no pages under it is an absence dressed as help.
  assert.equal(staleSourceList([], "en"), "");
  assert.equal(staleSourceList([], "es"), "");
});

test("a lapsed record's URL is the only field that crosses, corpus-wide", () => {
  // Generalizes the Alabama case: on the post-cliff date EVERY step is degraded, so this
  // sweeps the whole corpus for a statement or detail leaking through the stale path.
  const byId = new Map(corpus.map((r) => [r.id, r] as const));
  let degradedSteps = 0;
  for (const cell of englishCells()) {
    const checklist = buildChecklist(intakeFor(cell.jurisdiction, cell.document_type), AFTER_CLIFF);
    for (const step of checklist.steps) {
      if (step.record_ids.length > 0) continue;
      degradedSteps++;
      const html = renderChecklist({ ...checklist, steps: [step] }, corpus, "en");
      for (const id of step.unverified_record_ids) {
        const r = byId.get(id) as CorpusRecord;
        assert.ok(html.includes(escapeHtml(r.source.url)), `${id}: URL missing`);
        assert.ok(!html.includes(escapeHtml(r.statement)), `${id}: statement leaked`);
      }
    }
  }
  assert.ok(degradedSteps > 100, `expected the whole corpus degraded after the cliff, saw ${degradedSteps}`);
});

test("nothing currently serving survives the 2026-10-12 cliff", () => {
  // The premise the two dates above rest on. If a re-verification pass moves the corpus
  // forward, this fails and the pinned dates in this file need re-reading — which is the
  // point: the cliff is a fact about the data, and a test that quietly tracked it would
  // stop being able to report that the data had changed.
  const servingToday = corpus.filter((r) => isCurrent(r, TODAY));
  const servingAfter = corpus.filter((r) => isCurrent(r, AFTER_CLIFF));
  assert.ok(servingToday.length > 0, `nothing serves on ${TODAY}`);
  assert.equal(servingAfter.length, 0, `${servingAfter.length} records still serve on ${AFTER_CLIFF}`);
});
