import { test } from "node:test";
import assert from "node:assert/strict";
import {
  claimIsFaithful,
  decomposeClaim,
  deterministicPrefilter,
  DeterministicSupportJudge,
  recordSupportSources,
} from "../eval/faithfulness.ts";
import type { CorpusRecord } from "../api/types.ts";

const record: CorpusRecord = {
  id: "test.record",
  jurisdiction: "US-CA",
  document_type: "court-order",
  change_type: ["name"],
  topic: "Name change",
  statement: "File a petition with the county court clerk to begin the name-change process.",
  detail: "Use Form NC-100 for this filing.",
  cost: { amount_usd: 435, fee_waiver: true },
  timeline: { typical: "6–12 weeks" },
  source: { url: "https://example.test", title: "Example", last_verified: "2026-05-31", verifier: "A" },
  verification_status: "verified",
  recheck_sla_days: 90,
  language: "en",
};

const judge = new DeterministicSupportJudge();

test("exact record-derived claim is faithful", () => {
  assert.equal(claimIsFaithful(record.statement, record, judge), true);
});

test("high-support paraphrase is faithful", () => {
  const claim = "The county court clerk requires you to file a petition to begin the name-change process.";
  assert.equal(claimIsFaithful(claim, record, judge), true);
});

test("supported sentence cannot carry an unrelated second sentence", () => {
  const claim = `${record.statement} The lunar surface reaches 260 degrees Fahrenheit.`;
  assert.equal(claimIsFaithful(claim, record, judge), false);
});

test("multiple independently supported sentences pass", () => {
  const claim = `${record.statement} ${record.detail}`;
  assert.equal(claimIsFaithful(claim, record, judge), true);
});

test("short fabricated cost claim has no scaffolding bypass", () => {
  const claim = `${record.statement} Cost is $0.`;
  assert.equal(claimIsFaithful(claim, record, judge), false);
});

test("negation flip is rejected", () => {
  const claim = "Do not file a petition with the county court clerk to begin the name-change process.";
  assert.equal(claimIsFaithful(claim, record, judge), false);
});

test("numeric mutation is rejected", () => {
  assert.equal(claimIsFaithful("The typical cost is about $50", record, judge), false);
});

test("form-id mutation is rejected", () => {
  assert.equal(claimIsFaithful("Use Form DL 329 for this filing", record, judge), false);
});

test("record-derived cost and timeline scaffolding are supported", () => {
  const sources = recordSupportSources(record);
  assert.equal(claimIsFaithful("The typical cost is about $435", record, judge), true);
  assert.equal(claimIsFaithful("Typical timeline: 6–12 weeks", record, judge), true);
  assert.ok(sources.some((source) => source.includes("fee waiver")));
});

test("decomposition preserves abbreviations and decimal amounts", () => {
  assert.deepEqual(decomposeClaim("Update your U.S. passport. The fee is $12.50; then file."), [
    "Update your U.S. passport",
    "The fee is $12.50",
    "then file",
  ]);
});

test("prefilter rejects unrelated text and accepts supported text", () => {
  const sources = recordSupportSources(record);
  assert.equal(deterministicPrefilter("Bring a dragon to the moon", sources), false);
  assert.equal(deterministicPrefilter("Use Form NC-100 for this filing", sources), true);
});

test("judge returns an inspectable score and reason", () => {
  const result = judge.judge(record.statement, recordSupportSources(record));
  assert.equal(result.entailed, true);
  assert.equal(result.score, 1);
  assert.match(result.reason, /supported/);
});
