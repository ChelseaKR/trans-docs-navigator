import { test } from "node:test";
import assert from "node:assert/strict";
import { checkCoverage, enforce, DISCLOSURE } from "../api/citation.ts";
import type { CorpusRecord, GroundedAnswer } from "../api/types.ts";

const rec: CorpusRecord = {
  id: "good.rec",
  jurisdiction: "US-CA",
  document_type: "court-order",
  change_type: ["name"],
  topic: "t",
  statement: "A long enough statement to be substantive.",
  source: { url: "https://e", title: "T", last_verified: "2026-05-31", verifier: "A" },
  verification_status: "verified",
  recheck_sla_days: 90,
  language: "en",
};
const staleRec: CorpusRecord = {
  ...rec,
  id: "stale.rec",
  verification_status: "needs_reverification",
};
const corpus = [rec, staleRec];
const today = "2026-05-31";

const answerWith = (blocks: GroundedAnswer["blocks"]): GroundedAnswer => ({
  blocks,
  cited_records: [],
  refused: false,
});

test("100% coverage when every claim is cited and current", () => {
  const ans = answerWith([
    { kind: "boilerplate", citations: [], text: "intro" },
    { kind: "claim", citations: ["good.rec"], text: "fact" },
  ]);
  const r = checkCoverage(ans, corpus, today);
  assert.equal(r.coverage, 1);
  assert.equal(r.claims, 1);
  assert.equal(r.cited, 1);
  assert.doesNotThrow(() => enforce(ans, corpus, today));
});

test("uncited claim fails coverage and enforce throws", () => {
  const ans = answerWith([{ kind: "claim", citations: [], text: "unsupported fact" }]);
  const r = checkCoverage(ans, corpus, today);
  assert.equal(r.coverage, 0);
  assert.ok(r.violations.some((v) => v.reason === "uncited-claim"));
  assert.throws(() => enforce(ans, corpus, today), /rejected/);
});

test("unresolved citation fails", () => {
  const ans = answerWith([{ kind: "claim", citations: ["ghost"], text: "fact" }]);
  const r = checkCoverage(ans, corpus, today);
  assert.ok(r.violations.some((v) => v.reason === "unresolved-citation"));
  assert.equal(r.coverage, 0);
});

test("stale-only citation fails (cannot serve stale as fact)", () => {
  const ans = answerWith([{ kind: "claim", citations: ["stale.rec"], text: "fact" }]);
  const r = checkCoverage(ans, corpus, today);
  assert.ok(r.violations.some((v) => v.reason === "stale-citation"));
});

test("enforce rejects a claim that mixes a valid and a stale citation (no smuggling)", () => {
  const ans = answerWith([{ kind: "claim", citations: ["good.rec", "stale.rec"], text: "fact" }]);
  // Coverage counts the claim cited (it has one valid id), but a stale citation is a
  // violation — enforce must still reject so a stale source can't ride along.
  assert.equal(checkCoverage(ans, corpus, today).coverage, 1);
  assert.throws(() => enforce(ans, corpus, today), /rejected/);
});

test("grounding restricts which records a citation may resolve to", () => {
  const ans = answerWith([{ kind: "claim", citations: ["good.rec"], text: "fact" }]);
  // good.rec is in the corpus but NOT in the grounding set → unresolved.
  const r = checkCoverage(ans, corpus, today, { grounding: [staleRec] });
  assert.ok(r.violations.some((v) => v.reason === "unresolved-citation"));
  assert.equal(r.coverage, 0);
});

test("requireFaithful rejects a claim whose text isn't supported by the cited record", () => {
  const faithful = answerWith([{ kind: "claim", citations: ["good.rec"], text: "A long enough statement to be substantive." }]);
  const r1 = checkCoverage(faithful, corpus, today, { requireFaithful: true });
  assert.equal(r1.coverage, 1);
  assert.equal(r1.violations.length, 0);

  const hallucinated = answerWith([{ kind: "claim", citations: ["good.rec"], text: "Completely unrelated invented nonsense about dragons and spaceships." }]);
  const r2 = checkCoverage(hallucinated, corpus, today, { requireFaithful: true });
  assert.ok(r2.violations.some((v) => v.reason === "unfaithful-claim"));
});

test("empty answer (refusal) has trivially full coverage", () => {
  const ans = answerWith([{ kind: "refusal", citations: [], text: "I don't have verified info" }]);
  assert.equal(checkCoverage(ans, corpus, today).coverage, 1);
  assert.doesNotThrow(() => enforce(ans, corpus, today));
});

test("disclosure strings are non-empty", () => {
  assert.ok(DISCLOSURE.notLegalAdvice.length > 0);
  assert.ok(DISCLOSURE.aiAssisted.length > 0);
});
