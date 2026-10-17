// What a visitor sees once records lapse their recheck SLA (all 436 EN+ES jurisdiction
// records did on 2026-10-12). The freshness contract itself (the URL crosses, the claim
// does not) is pinned in degraded-citations.test.ts; this file pins the parts a reader
// meets first and could misread:
//   * a page-level note says what is and is not shown, and does not imply a person
//     re-checked anything;
//   * "documents with nothing to show" no longer calls a lapsed document "Not yet covered";
//   * /compare withholds a lapsed record's claim, "no path" claims included, the way the
//     checklist does;
//   * the home page states the lapse before the intake form, from a live count;
//   * every new string exists, differently, in Spanish.
// Dates are pinned literals so the real clock cannot rot this file.

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildChecklist } from "../api/checklist.ts";
import { buildCompareTable } from "../api/compare.ts";
import { loadCorpus } from "../api/corpus.ts";
import { handleRoute, lapseCounts } from "../api/router.ts";
import { TEST_TODAY } from "../api/freshness.ts";
import { escapeHtml } from "../src/render.ts";
import { renderChecklistPage, renderPacketPage, renderIntakePage } from "../src/pages.ts";
import { renderCompareResultsPage } from "../src/compare.ts";
import { renderGuidePage } from "../src/guide.ts";
import { t as locale } from "../src/i18n/index.ts";
import type { Intake, Language } from "../api/types.ts";

const corpus = loadCorpus();
/** After every jurisdiction record has lapsed (see degraded-citations.test.ts). */
const LAPSED_DAY = "2026-10-17";

function intake(language: Language): Intake {
  return { jurisdiction: "US-CA", change_types: ["name", "gender-marker"], documents: [], language };
}

for (const lang of ["en", "es"] as const) {
  const ui = locale(lang).ui;

  test(`[${lang}] checklist, packet and guide carry the page-level lapse note when steps lapsed`, () => {
    const cl = buildChecklist(intake(lang), LAPSED_DAY);
    assert.ok(cl.steps.every((s) => s.needs_reverification), "fixture: every step should be lapsed on this day");
    const note = escapeHtml(ui.lapseNote);
    assert.ok(renderChecklistPage(cl, corpus, lang, "jurisdiction=US-CA").includes(note), "checklist");
    assert.ok(renderPacketPage(cl, corpus, lang, LAPSED_DAY).includes(note), "packet");
    // The guide reads the real clock; it is lapsed whenever the real date is past the cliff.
    const guide = renderGuidePage("california", "name-change", lang) ?? "";
    assert.ok(guide.includes(note) === (buildChecklist({ ...intake(lang), change_types: ["name"] }).steps.some((s) => s.needs_reverification)), "guide note tracks the live state");
  });

  test(`[${lang}] no lapse note on a page where nothing has lapsed`, () => {
    // California birth certificate has a current record on the pinned date (see
    // degraded-citations.test.ts); the other California documents were already flagged.
    const cl = buildChecklist({ ...intake(lang), documents: ["birth-certificate"] }, TEST_TODAY);
    assert.ok(cl.steps.length > 0 && cl.steps.every((s) => !s.needs_reverification), "fixture: nothing lapsed");
    const html = renderChecklistPage(cl, corpus, lang, "jurisdiction=US-CA");
    assert.ok(!html.includes(escapeHtml(ui.lapseNote)));
  });

  test(`[${lang}] a lapsed document is listed under its own heading, not "Not yet covered"`, () => {
    const cl = buildChecklist(intake(lang), LAPSED_DAY);
    assert.ok(cl.gaps.some((g) => g.reason === "all-degraded"), "fixture: expected lapsed gaps");
    const html = renderChecklistPage(cl, corpus, lang, "jurisdiction=US-CA");
    assert.ok(html.includes(`<h2>${escapeHtml(ui.gapsLapsedHeading)}</h2>`));
    assert.ok(!html.includes(`<h2>${escapeHtml(ui.notCovered)}</h2>`), "lapsed documents were filed under 'not yet covered'");
  });

  test(`[${lang}] the lapse copy never claims a re-check happened and is not the English text`, () => {
    for (const s of [ui.lapseNote, ui.staleSourcesNote, ui.needsRecheck, ui.gapAllDegraded]) {
      assert.doesNotMatch(s, /(have|has) not re-checked|last checked|no hemos vuelto|verificó por última/i, s);
    }
    if (lang === "es") {
      const en = locale("en").ui;
      for (const k of ["lapseNote", "staleSourcesNote", "needsRecheck", "gapAllDegraded", "gapsLapsedHeading", "costWithheld"] as const) {
        assert.notEqual(ui[k], en[k], `${k} is identical to English`);
      }
      assert.notEqual(ui.homeLapseNote(3, 3), en.homeLapseNote(3, 3));
      assert.notEqual(locale("es").compare.lapsedMark, locale("en").compare.lapsedMark);
    }
  });

  test(`[${lang}] the home page states the lapse from a live count, and says nothing when none`, () => {
    const all = renderIntakePage(lang, { lapsed: 344, total: 344 });
    assert.ok(all.includes(escapeHtml(ui.homeLapseNote(344, 344))));
    const some = renderIntakePage(lang, { lapsed: 10, total: 344 });
    assert.ok(some.includes(escapeHtml(ui.homeLapseNote(10, 344))));
    assert.notEqual(ui.homeLapseNote(344, 344), ui.homeLapseNote(10, 344));
    assert.equal(ui.homeLapseNote(0, 344), "");
    assert.ok(!renderIntakePage(lang).includes('role="note"') || !renderIntakePage(lang).includes(escapeHtml(ui.homeLapseNote(1, 1))));
  });
}

test("lapseCounts counts English records only, against the date given", () => {
  const en = corpus.filter((r) => r.language === "en").length;
  assert.deepEqual(lapseCounts(LAPSED_DAY), { lapsed: en, total: en });
  assert.equal(lapseCounts(TEST_TODAY).total, en);
  assert.ok(lapseCounts(TEST_TODAY).lapsed < en, "some records are current on the pinned test date");
});

test("/ shows the lapse note on the live route", () => {
  const r = handleRoute("GET", new URL("http://l/"), LAPSED_DAY);
  const { lapsed, total } = lapseCounts(LAPSED_DAY);
  assert.ok(r.body.includes(escapeHtml(locale("en").ui.homeLapseNote(lapsed, total))));
});

test("/compare withholds the claim of every lapsed cell, 'no path' cells included", () => {
  const table = buildCompareTable({ documents: ["court-order", "drivers-license", "birth-certificate"], change_types: ["name", "gender-marker"] }, LAPSED_DAY, corpus);
  const cells = table.rows.flatMap((r) => r.cells);
  const noPath = cells.filter((c) => c.status === "no_path_documented");
  assert.ok(noPath.length > 0, "fixture: expected at least one no-path cell");
  assert.ok(cells.filter((c) => c.status !== "not_covered").every((c) => c.lapsed === true), "every cell with records is lapsed on this day");

  const html = renderCompareResultsPage(table, corpus, "en");
  const byId = new Map(corpus.map((r) => [r.id, r]));
  for (const c of cells) {
    for (const id of c.record_ids) {
      const rec = byId.get(id)!;
      assert.ok(!html.includes(escapeHtml(rec.statement)), `${id}: a lapsed statement leaked into /compare`);
      assert.ok(html.includes(escapeHtml(rec.source.url)), `${id}: the official page must still be linked`);
    }
  }
  assert.ok(html.includes(escapeHtml(locale("en").compare.lapsedMark)));
});

test("/compare still shows a current cell's claim, with no lapsed mark", () => {
  const table = buildCompareTable({ documents: ["court-order"], change_types: ["name"], jurisdictions: ["US-CA"] }, TEST_TODAY, corpus);
  const cell = table.rows[0]!.cells[0]!;
  assert.equal(cell.lapsed, false);
  const html = renderCompareResultsPage(table, corpus, "en");
  const rec = corpus.find((r) => r.id === cell.record_ids[0])!;
  assert.ok(html.includes(escapeHtml(rec.statement)));
  assert.ok(!html.includes(escapeHtml(locale("en").compare.lapsedMark)));
});

// ── #311: /answer prints one freshness statement, not one per lapsed rule ───────────────
// On the day every record had lapsed, a California question printed about 25 near-identical
// "may have changed" paragraphs. The same facts now arrive as one block that names the
// affected rules, the span of dates they were recorded on, and the official sources.

for (const lang of ["en", "es"] as const) {
  test(`[${lang}] /answer collapses the lapsed-rule paragraphs into one statement that lists them`, () => {
    const url = `http://l/answer?jurisdiction=US-CA&change=name&q=how%20much%20does%20it%20cost&language=${lang}`;
    const r = handleRoute("GET", new URL(url), LAPSED_DAY);
    assert.equal(r.status, 200);
    const g = locale(lang).generator;
    const single = escapeHtml(g.freshness("TOPIC", "DATE", "TITLE")).split("TOPIC")[0]!;
    const grouped = escapeHtml(g.freshnessGroup(2, "RULES", "D1", "D2", "SOURCES")).split("RULES")[0]!.replace(/^2/, "");
    assert.equal(r.body.split(single).length - 1, 0, "a per-rule paragraph was printed");
    assert.equal(r.body.split(grouped).length - 1, 1, "expected exactly one grouped statement");
    const text = /<p class="flag">([^<]*)<\/p>/.exec(r.body.slice(r.body.indexOf(grouped) - 20))?.[1] ?? "";
    assert.ok(text.includes("California"), "the grouped statement names the affected California rules");
    assert.ok(text.split(";").length > 5, "and lists more than a handful of them");
  });

  test(`[${lang}] the grouped statement names each rule and source once and never implies a re-check`, () => {
    const g = locale(lang).generator;
    const text = g.freshnessGroup(3, "Rule A; Rule B; Rule C", "2026-05-31", "2026-07-13", "Source 1; Source 2");
    for (const part of ["Rule A", "Rule B", "Rule C", "Source 1", "Source 2", "2026-05-31", "2026-07-13", "3"]) {
      assert.ok(text.includes(part), `${part} missing from: ${text}`);
    }
    assert.doesNotMatch(text, /re-?checked|last checked|verified on|verificamos|verificó/i);
    const same = g.freshnessGroup(3, "A", "2026-07-13", "2026-07-13", "S");
    assert.equal(same.split("2026-07-13").length - 1, 1, "a single date is not printed as a range");
  });
}
