// Issue #251, the /compare surface: the flagship "which state?" grid renders affirmative
// `Documented` cells from records no human has read, and carried no human-verification
// signal anywhere on the page.
//
// `classifyCell` reads `verification_status` and the freshness clock. Neither says a
// person opened the source — that is `source.verifier`, and every one of the 688 records
// in this corpus carries the `Pilot Seed Reviewer` placeholder. The cell's own legend
// reads "an official source we cite describes a way to do this", which is a statement
// about a reading nobody did.
//
// WHAT THIS DELIBERATELY DOES NOT DO. It does not add a `CoverageStatus`, does not make
// `verified` unwritable, and does not change what a single cell renders. Those are
// decision 1 of #251 and belong to the owner. This states a computed fact beside the
// table and leaves that decision exactly as open as it was — the same non-destructive
// half PR #258 took on the birth-certificate column.

import { test } from "node:test";
import assert from "node:assert/strict";

import { buildCompareTable, humanBackedCellCounts } from "../api/compare.ts";
import { renderCompareResultsPage } from "../src/compare.ts";
import { escapeHtml } from "../src/render.ts";
import { loadCorpus, loadVerifierRoster, type VerifierEntry } from "../api/corpus.ts";
import { t as locale } from "../src/i18n/index.ts";
import { TEST_TODAY } from "../api/freshness.ts";
import type { CompareTable, CorpusRecord, Language } from "../api/types.ts";

const LANGS: readonly Language[] = ["en", "es"];
const PLACEHOLDER = "Pilot Seed Reviewer";
const REAL_HUMAN = "Jane Reviewer";

function rosterWithAHuman(): Map<string, VerifierEntry> {
  const roster = new Map(loadVerifierRoster());
  roster.set(REAL_HUMAN, { name: REAL_HUMAN });
  return roster;
}

function rec(id: string, verifier: string, over: Partial<CorpusRecord> = {}): CorpusRecord {
  return {
    id,
    jurisdiction: "US-CA",
    document_type: "court-order",
    change_type: ["name"],
    topic: "t",
    statement: "The court describes a way to change your name.",
    source: { url: "https://e.gov", title: "T", last_verified: TEST_TODAY, verifier },
    verification_status: "verified",
    recheck_sla_days: 90,
    language: "en",
    ...over,
  } as CorpusRecord;
}

/** A one-row, one-cell table over `corpus`, so the counts are readable by hand. */
function oneCellTable(corpus: CorpusRecord[]): CompareTable {
  return buildCompareTable(
    { jurisdictions: ["US-CA"], documents: ["court-order"], change_types: ["name"] },
    TEST_TODAY,
    corpus,
  );
}

// ── The counts ───────────────────────────────────────────────────────────────────────

test("a cell counts as human-backed only when EVERY record it cites was read by a human", () => {
  // A cell's status is computed from all of its records together, so one unread record
  // is enough to make the status a machine's conclusion. "At least one" would let a
  // single human reading vouch for records nobody opened.
  const roster = rosterWithAHuman();

  const mixed = oneCellTable([rec("a", REAL_HUMAN), rec("b", PLACEHOLDER)]);
  assert.deepEqual(humanBackedCellCounts(mixed, [rec("a", REAL_HUMAN), rec("b", PLACEHOLDER)], roster), {
    citing: 1,
    humanBacked: 0,
  });

  const allHuman = [rec("a", REAL_HUMAN), rec("b", REAL_HUMAN)];
  assert.deepEqual(humanBackedCellCounts(oneCellTable(allHuman), allHuman, roster), {
    citing: 1,
    humanBacked: 1,
  });
});

test("a cell that cites nothing is not counted as a cell a reviewer failed to check", () => {
  // `not_covered` cites no record at all. Folding it into the denominator would make the
  // ratio move for a reason that has nothing to do with verification.
  const table = buildCompareTable(
    { jurisdictions: ["US-CA"], documents: ["court-order"], change_types: ["name"] },
    TEST_TODAY,
    [],
  );
  assert.deepEqual(humanBackedCellCounts(table, [], loadVerifierRoster()), { citing: 0, humanBacked: 0 });
});

test("an unresolvable record id is absence, not a pass", () => {
  // The cell cites an id the corpus cannot resolve. Reading that as human-verified is
  // the defect this whole issue is about, one level down.
  const corpus = [rec("a", REAL_HUMAN)];
  const table = oneCellTable(corpus);
  assert.equal(table.rows[0]!.cells[0]!.record_ids.length, 1);
  assert.deepEqual(humanBackedCellCounts(table, [], rosterWithAHuman()), { citing: 1, humanBacked: 0 });
});

test("the real corpus backs none of the cells the live table shows", () => {
  const corpus = loadCorpus();
  const table = buildCompareTable(
    { documents: ["court-order", "drivers-license"], change_types: ["name"] },
    TEST_TODAY,
    corpus,
  );
  const counts = humanBackedCellCounts(table, corpus);
  assert.ok(counts.citing > 0, "the live table must cite records for this test to mean anything");
  assert.equal(counts.humanBacked, 0, "no corpus record is human-verified today");
});

// ── The page says so ─────────────────────────────────────────────────────────────────

for (const lang of LANGS) {
  test(`the results page states the computed human-verification count (${lang})`, () => {
    const corpus = loadCorpus();
    const table = buildCompareTable(
      { documents: ["court-order", "drivers-license"], change_types: ["name"] },
      TEST_TODAY,
      corpus,
    );
    const { citing, humanBacked } = humanBackedCellCounts(table, corpus);
    const html = renderCompareResultsPage(table, corpus, lang);
    // Through escapeHtml, always. The English sentence contains an apostrophe, which
    // renders as `&#39;`, so a raw comparison here fails on correct output — and the
    // Spanish one, which has no apostrophe, passes either way. That asymmetry is how a
    // comparison in this repo has already been wrong in both directions.
    assert.ok(
      html.includes(escapeHtml(locale(lang).compare.humanVerificationNote(humanBacked, citing))),
      `the page must carry the computed note (${humanBacked} of ${citing})`,
    );
  });

  test(`all four branches are reachable and distinct (${lang})`, () => {
    // A note that can only ever print one string is a constant, not a reading of the
    // table — and it would be wrong in the other direction the day reviewers arrive.
    const n = locale(lang).compare.humanVerificationNote;
    const branches = [n(0, 0), n(0, 4), n(2, 4), n(4, 4)];
    assert.equal(new Set(branches).size, 4, `four distinct sentences required: ${branches.join(" | ")}`);
    for (const b of branches) assert.ok(b.trim().length > 0);
  });

  test(`the "all checked" branch actually renders when the records are human-verified (${lang})`, () => {
    // The accepted case. Without it, a note that refused to credit any table at all
    // would satisfy every other assertion here.
    const corpus = [rec("a", REAL_HUMAN)];
    const table = oneCellTable(corpus);
    const html = renderCompareResultsPage(table, corpus, lang, { roster: rosterWithAHuman() });
    assert.ok(html.includes(escapeHtml(locale(lang).compare.humanVerificationNote(1, 1))));
    assert.ok(!html.includes(escapeHtml(locale(lang).compare.humanVerificationNote(0, 1))));
  });
}

test("the note does not change any cell's status", () => {
  // Decision 1 of #251 stays open: this adds a statement beside the table, it does not
  // make `verified` unwritable and it does not reclassify anything. Pinned so a later
  // change that quietly reclassifies cells cannot land under this PR's framing.
  const corpus = loadCorpus();
  const table = buildCompareTable(
    { documents: ["court-order"], change_types: ["name"] },
    TEST_TODAY,
    corpus,
  );
  const statuses = new Set(table.rows.flatMap((r) => r.cells.map((c) => c.status)));
  assert.ok(statuses.has("documented"), "documented cells must still render as documented");
});
