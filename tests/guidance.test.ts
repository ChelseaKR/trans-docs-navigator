import { test } from "node:test";
import assert from "node:assert/strict";
import { answer } from "../api/guidance.ts";
import { loadCorpus } from "../api/corpus.ts";
import { checkCoverage } from "../api/citation.ts";
import { TEST_TODAY } from "../api/freshness.ts";

const today = TEST_TODAY;
const corpus = loadCorpus();

test("answer is grounded, cited, and passes the citation gate (CA name)", () => {
  const ans = answer({ jurisdiction: "US-CA", change_types: ["name"], documents: ["court-order"], today });
  assert.equal(ans.refused, false);
  assert.ok(ans.cited_records.some((r) => r.id === "ca.court-order.name"));
  assert.equal(checkCoverage(ans, corpus, today).coverage, 1);
});

test("answer refuses when no current record backs the request (no fabrication)", () => {
  // US-AK: genuinely uncovered (see tests/coverage-honesty.test.ts's UNCOVERED) after this
  // PR's US-AL/MS/LA addition — no state record, no federal court-order → genuine refusal.
  const ans = answer({ jurisdiction: "US-AK", change_types: ["name"], documents: ["court-order"], today });
  assert.equal(ans.refused, true);
  assert.equal(ans.cited_records.length, 0);
  assert.ok(ans.blocks[0]!.text.toLowerCase().includes("don't have verified"));
});

test("unsupported state still gets valid federal guidance (SSA/passport)", () => {
  const ans = answer({ jurisdiction: "US-AK", change_types: ["name"], today });
  assert.equal(ans.refused, false);
  assert.ok(ans.cited_records.every((r) => r.jurisdiction === "US"));
  assert.ok(ans.cited_records.some((r) => r.id === "us.ssa-card.name"));
});

test("answer degrades volatile federal gender-marker policy (never served as fact)", () => {
  const ans = answer({ jurisdiction: "US", change_types: ["gender-marker"], documents: ["passport"], today });
  assert.equal(ans.refused, true);
  assert.ok(ans.blocks.some((b) => b.kind === "freshness"));
});

test("answer threads through the default generator and enforce()", () => {
  // Every supported path returns without enforce() throwing.
  for (const ct of ["name", "gender-marker"] as const) {
    assert.doesNotThrow(() => answer({ jurisdiction: "US-CA", change_types: [ct], today }));
  }
});
