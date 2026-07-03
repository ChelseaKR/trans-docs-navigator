import { test } from "node:test";
import assert from "node:assert/strict";
import {
  claimIsFaithful,
  decomposeClaim,
  deterministicPrefilter,
  SemanticJudge,
} from "../eval/faithfulness.ts";
import type { CorpusRecord } from "../api/types.ts";

const baseRec: CorpusRecord = {
  id: "t",
  jurisdiction: "US-CA",
  document_type: "court-order",
  change_type: ["name"],
  topic: "t",
  statement: "File a petition with the county court clerk to begin the name-change process.",
  source: { url: "https://e", title: "T", last_verified: "2026-05-31", verifier: "A" },
  verification_status: "verified",
  recheck_sla_days: 90,
  language: "en",
};

const judge = new SemanticJudge();

test("exact extractive match passes", () => {
  const claim = "File a petition with the county court clerk to begin the name-change process.";
  assert.equal(claimIsFaithful(claim, baseRec, judge), true);
});

test("a genuine paraphrase with full token support passes", () => {
  const claim = "The county court clerk requires you to file a petition to begin the name-change process.";
  assert.equal(claimIsFaithful(claim, baseRec, judge), true);
});

test("substring-superset false-positive now FAILS: one true sentence can't carry an unsupported one", () => {
  // The block literally contains the record's statement as a substring (old code
  // would pass this outright), but it is glued to a wholly unrelated, unsupported
  // second sentence. Decomposition + per-sub-claim judging must catch that.
  const claim =
    "File a petition with the county court clerk to begin the name-change process. " +
    "The lunar surface has an average daytime temperature of 260 degrees Fahrenheit.";
  assert.equal(claimIsFaithful(claim, baseRec, judge), false);
});

test("a negated paraphrase against an affirmative source FAILS (polarity guard)", () => {
  const affirmative: CorpusRecord = {
    ...baseRec,
    statement: "You must file a petition with the county court clerk for this step.",
  };
  const negatedClaim = "You do not need to file a petition with the county court clerk for this step.";
  assert.equal(claimIsFaithful(negatedClaim, affirmative, judge), false);
});

test("decomposeClaim splits multi-sentence blocks on ./;/newline and drops empties", () => {
  const block = "First claim here.  Second claim; third clause\nFourth on its own line.  ";
  assert.deepEqual(decomposeClaim(block), [
    "First claim here",
    "Second claim",
    "third clause",
    "Fourth on its own line",
  ]);
});

test("decomposeClaim drops empty fragments from trailing/adjacent punctuation", () => {
  assert.deepEqual(decomposeClaim("Only one sentence..."), ["Only one sentence"]);
  assert.deepEqual(decomposeClaim(""), []);
});

test("prefilter rejects low-coverage before the judge ever runs", () => {
  const unrelatedClaim = "Bring your government-issued photo identification to the appointment.";
  assert.equal(deterministicPrefilter(unrelatedClaim, baseRec.statement), false);
  // claimIsFaithful must short-circuit on the prefilter and never even ask the judge.
  assert.equal(claimIsFaithful(unrelatedClaim, baseRec, judge), false);
});

test("prefilter accepts high token-coverage paraphrases (the cheap gate still works)", () => {
  const claim = "You must file a petition with the county court clerk to begin the name-change process.";
  assert.equal(deterministicPrefilter(claim, baseRec.statement), true);
});

test("SemanticJudge.judge reports score and reason", () => {
  const result = judge.judge("File a petition with the county court clerk", [baseRec.statement]);
  assert.equal(result.entailed, true);
  assert.ok(result.score > 0.5);
  assert.equal(typeof result.reason, "string");
});
