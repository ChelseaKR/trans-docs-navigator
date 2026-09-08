/**
 * A birth certificate is amended by the state that ISSUED it.
 *
 * `buildChecklist` resolves every step against `Intake.jurisdiction` — where the reader
 * lives — which for a birth record is the right state only for someone who never moved.
 * Roughly a quarter to a third of US residents live outside the state they were born in,
 * and the share is higher among people who moved for safety, which is the situation this
 * project exists for.
 *
 * The records shown are still the residence state's; routing them elsewhere would need a
 * birth state this app deliberately never asks for (#250). What these tests hold is the
 * disclosure: that every surface rendering a birth-certificate step says the rules apply
 * only if that state issued the certificate, in both languages, on the screen and on the
 * paper packet, and that it says nothing about one state honouring another's document.
 *
 * Escaping note, measured in this repo on 2026-09-07: a raw-substring assertion against
 * rendered HTML cannot fail for most real prose, because `'` renders as `&#39;`. Every
 * assertion below compares the ESCAPED form.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildChecklist } from "../api/checklist.ts";
import { buildCompareTable, DEFAULT_COMPARE_DOCUMENTS } from "../api/compare.ts";
import { loadCorpus } from "../api/corpus.ts";
import { TEST_TODAY } from "../api/freshness.ts";
import { PORTABILITY } from "../api/relocation.ts";
import type { DocumentType, Intake, JurisdictionId, Language } from "../api/types.ts";
import { renderChecklist, renderPacket, escapeHtml } from "../src/render.ts";
import { renderCompareResultsPage } from "../src/compare.ts";
import { t as locale } from "../src/i18n/index.ts";

const today = TEST_TODAY;
const corpus = loadCorpus();

function intake(over: Partial<Intake> = {}): Intake {
  return {
    jurisdiction: "US-TX",
    change_types: ["name", "gender-marker"],
    documents: ["birth-certificate"],
    language: "en",
    ...over,
  };
}

const birthJurisdictions = [
  ...new Set(
    corpus.filter((r) => r.document_type === "birth-certificate").map((r) => r.jurisdiction),
  ),
].sort() as JurisdictionId[];

test("the corpus really does hold birth-certificate records for many states", () => {
  // Floor: without this, every jurisdiction loop below would pass over an empty set.
  assert.ok(birthJurisdictions.length >= 50, `only ${birthJurisdictions.length} jurisdictions`);
});

test("only the birth certificate is governed by the jurisdiction that issued it", () => {
  const documents = Object.keys(PORTABILITY) as DocumentType[];
  const cl = buildChecklist(intake({ jurisdiction: "US-CA", documents }), today);
  assert.ok(cl.steps.length > 1, "expected several steps to compare against");
  const flagged = cl.steps.filter((s) => s.governed_by_issuing_jurisdiction).map((s) => s.document_type);
  assert.deepEqual(flagged, ["birth-certificate"]);
  // And the flag tracks the taxonomy rather than a second hand-kept list.
  const byPortability = documents.filter((d) => PORTABILITY[d] === "state-of-birth");
  assert.deepEqual(byPortability, ["birth-certificate"]);
});

test("every jurisdiction's birth-certificate step carries the flag, in both languages", () => {
  for (const lang of ["en", "es"] as Language[]) {
    let seen = 0;
    for (const jurisdiction of birthJurisdictions) {
      const cl = buildChecklist(intake({ jurisdiction, language: lang }), today);
      const step = cl.steps.find((s) => s.document_type === "birth-certificate");
      if (!step) continue; // no current or lapsed record in this language: a gap, not a step
      seen += 1;
      assert.equal(
        step.governed_by_issuing_jurisdiction,
        true,
        `${jurisdiction} (${lang}) birth-certificate step is unflagged`,
      );
    }
    assert.ok(seen >= 40, `${lang}: only ${seen} birth-certificate steps built`);
  }
});

test("the rendered checklist names the state whose certificate the steps apply to", () => {
  for (const [jurisdiction, name] of [
    ["US-TX", "Texas"],
    ["US-CA", "California"],
  ] as [JurisdictionId, string][]) {
    const cl = buildChecklist(intake({ jurisdiction }), today);
    const html = renderChecklist(cl, corpus, "en");
    const expected = escapeHtml(locale("en").ui.issuingJurisdictionScope(name));
    assert.ok(html.includes(expected), `${jurisdiction}: scope line missing from /checklist`);
    // The apostrophe in "that state's rules" is why the comparison is against the escaped
    // form; a raw one would pass over a page that never contained the sentence.
    assert.ok(expected.includes("&#39;"), "the escaped form is the one being compared");
  }
});

test("Texas is covered even though no Texas record's own prose conditions on birth", () => {
  // The measurement behind #250: 26 of 51 jurisdictions carry no birth conditioning in any
  // of their own birth-certificate records, so on those states the page said nothing at all.
  const texasRecords = corpus.filter(
    (r) => r.jurisdiction === "US-TX" && r.document_type === "birth-certificate" && r.language === "en",
  );
  assert.ok(texasRecords.length > 0, "Texas has English birth-certificate records");
  const conditions = /\bborn\b|\bissued (?:by|in)\b/i;
  assert.ok(
    !texasRecords.some((r) => conditions.test(`${r.statement} ${r.detail ?? ""}`)),
    "Texas prose now conditions on birth; re-check whether this test still measures the gap",
  );
  const html = renderChecklist(buildChecklist(intake({ jurisdiction: "US-TX" }), today), corpus, "en");
  assert.ok(html.includes(escapeHtml(locale("en").ui.issuingJurisdictionScope("Texas"))));
});

test("the paper packet says it too — a printed plan must not say less than the screen", () => {
  const cl = buildChecklist(intake({ jurisdiction: "US-TX" }), today);
  const packet = renderPacket(cl, corpus, "en", "2026-09-08");
  assert.ok(packet.includes(escapeHtml(locale("en").ui.issuingJurisdictionScope("Texas"))));
});

test("Spanish gets the Spanish sentence, not the English one", () => {
  const cl = buildChecklist(intake({ jurisdiction: "US-CA", language: "es" }), today);
  const html = renderChecklist(cl, corpus, "es");
  const es = locale("es").ui.issuingJurisdictionScope("California");
  const en = locale("en").ui.issuingJurisdictionScope("California");
  assert.notEqual(es, en);
  assert.ok(html.includes(escapeHtml(es)));
  assert.ok(!html.includes(escapeHtml(en)));
});

test("a plan with no birth certificate in it says nothing about one", () => {
  const cl = buildChecklist(
    intake({ jurisdiction: "US-TX", documents: ["court-order", "ssa-card", "drivers-license"] }),
    today,
  );
  assert.ok(!cl.steps.some((s) => s.governed_by_issuing_jurisdiction));
  const html = renderChecklist(cl, corpus, "en");
  const packet = renderPacket(cl, corpus, "en", "2026-09-08");
  for (const surface of [html, packet]) {
    assert.ok(!surface.includes(escapeHtml(locale("en").ui.issuingJurisdictionScope("Texas"))));
    assert.ok(!surface.includes("issued your birth certificate"));
  }
});

test("the scope line is exactly the locale string — it makes no recognition claim", () => {
  // Structure, not a denylist of forbidden words: the rendered sentence has to BE the
  // reviewed string, so nothing can be assembled around it at render time. Whether one
  // state honours another's document is #241's question and is not answered anywhere here.
  const cl = buildChecklist(intake({ jurisdiction: "US-TX" }), today);
  const html = renderChecklist(cl, corpus, "en");
  const rendered = html.match(/<p class="flag" role="note">([^<]*)<\/p>/g) ?? [];
  assert.ok(rendered.length > 0, "no note paragraphs rendered; this assertion would prove nothing");
  const scope = rendered.filter((p) => p.includes("birth certificate"));
  assert.equal(scope.length, 1);
  assert.equal(
    scope[0],
    `<p class="flag" role="note">${escapeHtml(locale("en").ui.issuingJurisdictionScope("Texas"))}</p>`,
  );
});

test("/compare footnotes the birth-certificate column, and only when it shows one", () => {
  for (const lang of ["en", "es"] as Language[]) {
    const note = escapeHtml(locale(lang).compare.birthCertificateScopeNote);
    assert.ok(DEFAULT_COMPARE_DOCUMENTS.includes("birth-certificate"));

    const withColumn = renderCompareResultsPage(
      buildCompareTable({ documents: DEFAULT_COMPARE_DOCUMENTS, change_types: ["name"] }, today, corpus),
      corpus,
      lang,
    );
    assert.ok(withColumn.includes(note), `${lang}: the footnote is missing from /compare`);

    const withoutColumn = renderCompareResultsPage(
      buildCompareTable({ documents: ["court-order"], change_types: ["name"] }, today, corpus),
      corpus,
      lang,
    );
    assert.ok(!withoutColumn.includes(note), `${lang}: the footnote appears with no column to explain`);
  }
});
