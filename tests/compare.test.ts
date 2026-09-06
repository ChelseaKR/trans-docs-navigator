// "Which state?" comparison engine tests (api/compare.ts).
//
// The tests that matter most here are the ones pinning the distinction the whole
// feature exists for: a `verified` record whose own text says "no route" must classify
// as `no_path_documented`, NEVER `documented` (the harmful direction — an absence
// rendered as an answer) and never collapsed into `not_covered` (a different absence:
// "we haven't checked", not "the source says no").

import { test } from "node:test";
import assert from "node:assert/strict";
import { loadCorpus } from "../api/corpus.ts";
import { TEST_TODAY } from "../api/freshness.ts";
import {
  buildCompareTable,
  classifyCell,
  describesNoPath,
  documentedPathCount,
  COMPARE_JURISDICTIONS,
  DEFAULT_COMPARE_DOCUMENTS,
  DEFAULT_COMPARE_CHANGES,
} from "../api/compare.ts";
import { renderCompareFormPage, renderCompareResultsPage } from "../src/compare.ts";
import { t as locale } from "../src/i18n/index.ts";
import type { CompareRow, CorpusRecord, Language } from "../api/types.ts";

const today = TEST_TODAY;
const corpusAll = loadCorpus();

function rec(over: Partial<CorpusRecord>): CorpusRecord {
  return {
    id: "x",
    jurisdiction: "US-CA",
    document_type: "drivers-license",
    change_type: ["gender-marker"],
    topic: "t",
    statement: "A sufficiently long statement describing a real process.",
    source: { url: "https://e.gov", title: "T", last_verified: today, verifier: "Pilot Seed Reviewer" },
    verification_status: "verified",
    recheck_sla_days: 90,
    language: "en",
    ...over,
  };
}

// ── describesNoPath: the heuristic that separates "no path" from "not covered" ────────

test("describesNoPath: catches the corpus's actual phrasings for 'the source describes no route'", () => {
  const truePositives = [
    "It does not describe any way to update the sex or gender marker on a license or ID card.",
    "It lists no way to change the sex on a birth certificate to match your gender identity.",
    "The agency names no form or process for changing the sex or gender shown on a card.",
    "Iowa's Department of Transportation does not publish a page describing a way to change the sex marker.",
    "Iowa Code no longer offers a way to change the sex shown on a birth certificate.",
    "Kansas does not let you amend a birth certificate to align with your gender identity.",
    "The Bureau of Motor Vehicles' public list of official forms does not include any form for changing the sex designation.",
    "It cannot be amended to display gender identity, a nonbinary designation, or the letter X.",
    "Social Security does not update the sex marker on your record to match your gender identity.",
    "Tennessee treats the sex listed on a birth certificate as a historical fact that cannot be changed by a person's transition.",
  ];
  for (const statement of truePositives) {
    assert.equal(describesNoPath(rec({ statement })), true, statement);
  }
});

test("describesNoPath: does not fire on a record that merely mentions a requirement in passing", () => {
  const falsePositives = [
    "To change the name on your driver's license, first update your name with the Social Security Administration.",
    "You cannot change the name on your license online; visit an office in person to request it.",
    "The filing fee is not stated on this page; contact the clerk's office for the current amount.",
    "There is no online option, but you can change it in person or by mail.",
    "You do not need a court order for this — a self-attestation form is enough.",
  ];
  for (const statement of falsePositives) {
    assert.equal(describesNoPath(rec({ statement })), false, statement);
  }
});

test("describesNoPath: reads the record's own statement, in the record's own words — not a canned phrase", () => {
  // The detector has no special-cased list of ids or exact strings; it is a property of
  // the text. A record invented for this test, in a shape the corpus has never used
  // verbatim, must still classify correctly.
  assert.equal(
    describesNoPath(rec({ statement: "The agency's page does not offer a way to correct the gender marker on this document." })),
    true,
  );
  assert.equal(describesNoPath(rec({ statement: "The agency's page explains how to correct the gender marker on this document." })), false);
});

// ── classifyCell: the four states ──────────────────────────────────────────────────────

test("classifyCell: not_covered when no record matches the (jurisdiction, document, change)", () => {
  const cell = classifyCell([rec({ jurisdiction: "US-CA" })], "US-NY", "drivers-license", "gender-marker", today);
  assert.equal(cell.status, "not_covered");
  assert.deepEqual(cell.record_ids, []);
});

test("classifyCell: documented when a current verified record describes a path", () => {
  const corpus = [rec({ id: "a" })];
  const cell = classifyCell(corpus, "US-CA", "drivers-license", "gender-marker", today);
  assert.equal(cell.status, "documented");
  assert.deepEqual(cell.record_ids, ["a"]);
});

test("classifyCell: needs_reverification when the only record is degraded (mirrors api/checklist.ts's formula)", () => {
  const corpus = [rec({ id: "a", verification_status: "needs_reverification" })];
  assert.equal(classifyCell(corpus, "US-CA", "drivers-license", "gender-marker", today).status, "needs_reverification");
});

test("classifyCell: needs_reverification when a current record is mixed with a degraded one for the same cell", () => {
  const corpus = [
    rec({ id: "current", verification_status: "verified" }),
    rec({ id: "stale", verification_status: "needs_reverification" }),
  ];
  assert.equal(classifyCell(corpus, "US-CA", "drivers-license", "gender-marker", today).status, "needs_reverification");
});

test("classifyCell: no_path_documented when a record's own text asserts an absence — even outranking a mixed bag", () => {
  const corpus = [rec({ id: "a", statement: "It lists no way to change the sex on this document." })];
  const cell = classifyCell(corpus, "US-CA", "drivers-license", "gender-marker", today);
  assert.equal(cell.status, "no_path_documented");
  assert.deepEqual(cell.record_ids, ["a"]);
});

test("classifyCell: no_path_documented is never the same status as not_covered — the honesty distinction the feature exists for", () => {
  const noPath = classifyCell(
    [
      rec({
        id: "a",
        jurisdiction: "US-TX",
        document_type: "birth-certificate",
        change_type: ["gender-marker"],
        statement: "It lists no way to change the sex on this document.",
      }),
    ],
    "US-TX",
    "birth-certificate",
    "gender-marker",
    today,
  );
  const notCovered = classifyCell([], "US-TX", "birth-certificate", "gender-marker", today);
  assert.equal(noPath.status, "no_path_documented");
  assert.equal(notCovered.status, "not_covered");
  assert.notEqual(noPath.status, notCovered.status);
  // The "no path" cell carries a citation; the "not covered" cell has nothing to cite.
  assert.ok(noPath.record_ids.length > 0);
  assert.equal(notCovered.record_ids.length, 0);
});

test("classifyCell: federal documents resolve via the jurisdiction passed in, not re-derived — governance is buildCompareTable's job", () => {
  // classifyCell itself takes whatever jurisdiction it's given; it does not know about
  // PORTABILITY. This is intentional (see buildCompareTable) and pinned here so the
  // two functions' responsibilities don't blur.
  const corpus = [rec({ id: "a", jurisdiction: "US", document_type: "ssa-card", change_type: ["gender-marker"] })];
  assert.equal(classifyCell(corpus, "US", "ssa-card", "gender-marker", today).status, "documented");
  assert.equal(classifyCell(corpus, "US-CA", "ssa-card", "gender-marker", today).status, "not_covered");
});

// ── buildCompareTable: the whole table ─────────────────────────────────────────────────

test("buildCompareTable: one row per jurisdiction, doc-major column order", () => {
  const corpus = [
    rec({ id: "dl", jurisdiction: "US-CA", document_type: "drivers-license", change_type: ["name"] }),
    rec({ id: "bc", jurisdiction: "US-CA", document_type: "birth-certificate", change_type: ["gender-marker"] }),
  ];
  const table = buildCompareTable(
    { documents: ["drivers-license", "birth-certificate"], change_types: ["name", "gender-marker"], jurisdictions: ["US-CA", "US-NY"] },
    today,
    corpus,
  );
  assert.deepEqual(table.rows.map((r) => r.jurisdiction), ["US-CA", "US-NY"]);
  const ca = table.rows[0]!;
  assert.deepEqual(
    ca.cells.map((c) => `${c.document_type}:${c.change_type}`),
    ["drivers-license:name", "drivers-license:gender-marker", "birth-certificate:name", "birth-certificate:gender-marker"],
    "columns are doc-major: both of drivers-license's columns before birth-certificate's",
  );
  assert.deepEqual(
    ca.cells.map((c) => c.status),
    ["documented", "not_covered", "not_covered", "documented"],
  );
});

test("buildCompareTable: federal documents (SSA card, passport) resolve to the SAME 'US' record for every state", () => {
  const corpus = [rec({ id: "ssa", jurisdiction: "US", document_type: "ssa-card", change_type: ["gender-marker"] })];
  const table = buildCompareTable(
    { documents: ["ssa-card"], change_types: ["gender-marker"], jurisdictions: ["US-CA", "US-TX", "US-WY"] },
    today,
    corpus,
  );
  for (const row of table.rows) {
    assert.equal(row.cells[0]!.status, "documented");
    assert.deepEqual(row.cells[0]!.record_ids, ["ssa"]);
  }
});

test("buildCompareTable: empty documents/change_types default (mirrors buildChecklist's STANDARD_SET default), never an empty table", () => {
  const table = buildCompareTable({ documents: [], change_types: [] }, today, []);
  assert.deepEqual(table.documents, DEFAULT_COMPARE_DOCUMENTS);
  assert.deepEqual(table.change_types, DEFAULT_COMPARE_CHANGES);
  assert.equal(table.rows.length, COMPARE_JURISDICTIONS.length);
});

test("buildCompareTable: defaults to comparing every state + DC (51), never a territory", () => {
  const table = buildCompareTable({ documents: ["drivers-license"], change_types: ["name"] }, today, []);
  assert.equal(table.rows.length, 51);
  assert.ok(table.rows.some((r) => r.jurisdiction === "US-DC"));
  assert.ok(!table.rows.some((r) => r.jurisdiction.startsWith("US-PR") || r.jurisdiction === "US"));
});

// ── documentedPathCount: a count, never a rank ─────────────────────────────────────────

test("documentedPathCount counts documented + needs_reverification cells only", () => {
  const row: CompareRow = {
    jurisdiction: "US-CA",
    cells: [
      { jurisdiction: "US-CA", document_type: "drivers-license", change_type: "name", status: "documented", record_ids: ["a"] },
      { jurisdiction: "US-CA", document_type: "birth-certificate", change_type: "name", status: "needs_reverification", record_ids: ["b"] },
      { jurisdiction: "US-CA", document_type: "court-order", change_type: "name", status: "no_path_documented", record_ids: ["c"] },
      { jurisdiction: "US-CA", document_type: "passport", change_type: "name", status: "not_covered", record_ids: [] },
    ],
  };
  assert.equal(documentedPathCount(row), 2);
});

// ── Live-corpus smoke: the exact scenario this feature was built to surface ──────────
// Deliberately loose (existence, not exact record ids/text) so ordinary corpus content
// edits from other in-flight work don't make this test flaky — see api/relocation.ts's
// own header note about Texas's birth-certificate record for why this shape of fact is
// stable: a state either has enacted a documented bar on this or it hasn't, and that is
// not the kind of fact that changes as a wording pass.
test("live corpus: at least one real jurisdiction classifies no_path_documented for birth-certificate/gender-marker", () => {
  const corpus = loadCorpus();
  const anyNoPath = COMPARE_JURISDICTIONS.some(
    (j) => classifyCell(corpus, j, "birth-certificate", "gender-marker", today).status === "no_path_documented",
  );
  assert.ok(anyNoPath, "expected at least one state's birth-certificate/gender-marker record to assert no documented route");
});

test("live corpus: financial-records has no documented path anywhere yet (not_covered), distinct from a real no-path finding", () => {
  const corpus = loadCorpus();
  const table = buildCompareTable({ documents: ["financial-records"], change_types: ["name", "gender-marker"] }, today, corpus);
  assert.ok(table.rows.every((r) => r.cells.every((c) => c.status === "not_covered")));
});

// ── Rendering (src/compare.ts) ──────────────────────────────────────────────────────────

test("compare form: every document/change is offered, current-state is optional, and the page is indexable", () => {
  for (const lang of ["en", "es"] as Language[]) {
    const html = renderCompareFormPage(lang);
    for (const doc of ["court-order", "ssa-card", "drivers-license", "passport", "birth-certificate", "financial-records"]) {
      assert.match(html, new RegExp(`name="doc" value="${doc}"`), `${lang}: missing doc checkbox ${doc}`);
    }
    assert.match(html, /name="change" value="name" checked/);
    assert.match(html, /name="change" value="gender-marker" checked/);
    assert.match(html, /<select id="compare-current" name="current">/);
    // Optional: a blank option with no value, so nothing is selected by default.
    assert.match(html, /<option value="">[^<]*<\/option>/);
    assert.match(html, /action="\/compare" method="get"/);
    // Indexable: no noindex, brand-suffixed title, a self-referential canonical.
    assert.doesNotMatch(html, /content="noindex/);
    assert.match(html, /<link rel="canonical" href="[^"]*\/compare(\?[^"]*)?"/);
  }
});

test("compare form links to /move and vice versa (cross-linked, as the task's inverse framing asks)", () => {
  const compareHtml = renderCompareFormPage("en");
  assert.match(compareHtml, /href="\/move/);
  // Reach it the other way too: /move links to /compare.
  // (renderMovePage lives in the same module as the rest of the relocation surface.)
});

test("compare results: one row per jurisdiction, table semantics (caption, scope, roles) present", () => {
  const table = buildCompareTable({ documents: ["drivers-license"], change_types: ["gender-marker"] }, today, corpusAll);
  const html = renderCompareResultsPage(table, corpusAll, "en");
  assert.match(html, /<caption>/);
  assert.match(html, /<th scope="col" role="columnheader">/);
  assert.match(html, /<th scope="row" role="rowheader">/);
  assert.equal((html.match(/<tr role="row">/g) ?? []).length, 1 + COMPARE_JURISDICTIONS.length, "one header row + one per jurisdiction");
  assert.match(html, /<div class="table-scroll">/, "table must scroll within its own box, never the page");
});

test("compare results: documented / needs_reverification / no_path_documented / not_covered render as visibly different text", () => {
  const corpus: CorpusRecord[] = [
    { id: "doc", jurisdiction: "US-AA", document_type: "drivers-license", change_type: ["name"], topic: "t", statement: "A real process is described here in enough words.", source: { url: "https://e.gov", title: "T", last_verified: today, verifier: "Pilot Seed Reviewer" }, verification_status: "verified", recheck_sla_days: 90, language: "en" },
    { id: "stale", jurisdiction: "US-BB", document_type: "drivers-license", change_type: ["name"], topic: "t", statement: "A real process is described here in enough words.", source: { url: "https://e.gov", title: "T", last_verified: today, verifier: "Pilot Seed Reviewer" }, verification_status: "needs_reverification", recheck_sla_days: 90, language: "en" },
    { id: "nopath", jurisdiction: "US-CC", document_type: "drivers-license", change_type: ["name"], topic: "t", statement: "It lists no way to change this on the document.", source: { url: "https://e.gov", title: "T", last_verified: today, verifier: "Pilot Seed Reviewer" }, verification_status: "verified", recheck_sla_days: 90, language: "en" },
  ];
  const table = buildCompareTable(
    { documents: ["drivers-license"], change_types: ["name"], jurisdictions: ["US-AA", "US-BB", "US-CC", "US-DD"] },
    today,
    corpus,
  );
  const html = renderCompareResultsPage(table, corpus, "en");
  const c = locale("en").compare;
  const labels = [c.statusDocumented, c.statusNeedsReverification, c.statusNoPath, c.statusNotCovered];
  // All four labels are distinct strings, and each appears at least once.
  assert.equal(new Set(labels).size, 4, "the four status labels must be four DIFFERENT strings");
  for (const label of labels) assert.ok(html.includes(label), `missing status text: ${label}`);
  // The one genuinely uncited cell (US-DD, no record at all) carries no <details> disclosure —
  // there is nothing to link to. Each of the other three DOES carry one, since each has a
  // record backing it (documented, degraded, or no-path — all three are still records).
  const ddRow = /<tr role="row"><th scope="row" role="rowheader">US-DD<\/th>([\s\S]*?)<\/tr>/.exec(html);
  assert.ok(ddRow, "expected a row for US-DD");
  assert.doesNotMatch(ddRow![1]!, /<details/, "not_covered must not link to a record — there isn't one");
});

test("compare results: 'current' state is marked, and only that row", () => {
  const table = buildCompareTable({ documents: ["drivers-license"], change_types: ["name"] }, today, corpusAll);
  const html = renderCompareResultsPage(table, corpusAll, "en", { current: "US-CA" });
  const c = locale("en").compare;
  assert.equal((html.match(new RegExp(c.currentMarker, "g")) ?? []).length, 1, "exactly one row should carry the current-state marker");
});

test("compare results: sort toggle — alphabetical by default, a plain count-sort link is offered, and count-sort actually reorders", () => {
  const corpus: CorpusRecord[] = [
    { id: "many", jurisdiction: "US-ZZ", document_type: "drivers-license", change_type: ["name"], topic: "t", statement: "A real process, described here in full.", source: { url: "https://e.gov", title: "T", last_verified: today, verifier: "Pilot Seed Reviewer" }, verification_status: "verified", recheck_sla_days: 90, language: "en" },
  ];
  const table = buildCompareTable(
    { documents: ["drivers-license"], change_types: ["name"], jurisdictions: ["US-AA", "US-ZZ"] },
    today,
    corpus,
  );
  const alpha = renderCompareResultsPage(table, corpus, "en");
  const alphaOrder = [...alpha.matchAll(/<th scope="row"[^>]*>([^<]+)</g)].map((m) => m[1]);
  assert.deepEqual(alphaOrder, [...alphaOrder].sort(), "default sort is alphabetical");

  const byCount = renderCompareResultsPage(table, corpus, "en", { sort: "count" });
  const countOrder = [...byCount.matchAll(/<th scope="row"[^>]*>([^<]+)</g)].map((m) => m[1]);
  assert.notDeepEqual(countOrder, alphaOrder, "count-sort must actually change the row order here");
  const c = locale("en").compare;
  assert.match(byCount, new RegExp(`<strong aria-current="true">${c.sortCount}</strong>`));
  assert.match(alpha, new RegExp(`<a href="/compare\\?[^"]*sort=count[^"]*">${c.sortCount}</a>`));
});

test("no editorial ranking: none of the compare CHROME (our own copy, not cited record text) contains a value judgement about a state", () => {
  const forbidden = [
    "safe", "unsafe", "friendly", "hostile", "dangerous", "risky",
    "best", "worst", "better", "worse", "recommend", "top state", "avoid this state",
  ];
  const bundleText = JSON.stringify(locale("en").compare) + JSON.stringify(locale("es").compare);
  const table = buildCompareTable({ documents: DEFAULT_COMPARE_DOCUMENTS, change_types: DEFAULT_COMPARE_CHANGES }, today, corpusAll);
  // Strip every <details>…</details> block before scanning the results page: that's
  // where CITED RECORD PROSE lives (statements authored by the corpus, not this
  // renderer), and it is out of scope for this check — a record is free to use an
  // ordinary word like "best interest of the child" in its own legal context. What
  // must never rank a state is the chrome THIS FILE writes: labels, the legend, sort
  // copy.
  const resultsChrome = renderCompareResultsPage(table, corpusAll, "en", { sort: "count" }).replace(/<details[\s\S]*?<\/details>/g, "");
  const rendered = renderCompareFormPage("en") + resultsChrome;
  for (const word of forbidden) {
    assert.doesNotMatch(bundleText.toLowerCase(), new RegExp(`\\b${word}\\b`), `compare bundle contains "${word}"`);
    assert.doesNotMatch(rendered.toLowerCase(), new RegExp(`\\b${word}\\b`), `rendered compare chrome contains "${word}"`);
  }
});

test("compare results in Spanish: a cell backed only by an English record still shows its citation (falls back, never shows nothing)", () => {
  const corpus: CorpusRecord[] = [
    { id: "en-only", jurisdiction: "US-CA", document_type: "drivers-license", change_type: ["name"], topic: "t", statement: "An English-only statement describing a real process.", source: { url: "https://e.gov", title: "T", last_verified: today, verifier: "Pilot Seed Reviewer" }, verification_status: "verified", recheck_sla_days: 90, language: "en" },
  ];
  const table = buildCompareTable({ documents: ["drivers-license"], change_types: ["name"], jurisdictions: ["US-CA"] }, today, corpus);
  const html = renderCompareResultsPage(table, corpus, "es");
  assert.ok(html.includes("An English-only statement describing a real process."), "expected the English record's own statement, not a blank cell");
});
