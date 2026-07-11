// Proves the safety property holds for the MODEL path, not just the deterministic
// composer: every answer — whoever generated it — passes through citation.enforce(), so
// a hallucinating or injection-obeying model is REJECTED rather than rendered.

import { test } from "node:test";
import assert from "node:assert/strict";
import { BedrockGenerator, buildBedrockPrompt, parseTaggedOutput } from "../api/generator.ts";
import type { BedrockTransport } from "../api/generator.ts";
import { localGroundedTransport } from "../api/bedrock-transport.ts";
import { answerAsync } from "../api/guidance.ts";

const today = "2026-05-31";
const caQuery = { jurisdiction: "US-CA", change_types: ["name"] as ("name")[], documents: ["court-order"] as ("court-order")[], today };

const transportOf = (text: string): BedrockTransport => async () => text;

test("a faithful (validly tagged) model answer passes the citation gate", async () => {
  const gen = new BedrockGenerator(transportOf("File a Petition for Change of Name in the superior court. [c:ca.court-order.name]"));
  const ans = await answerAsync(caQuery, { generator: gen });
  assert.equal(ans.refused, false);
  assert.ok(ans.cited_records.some((r) => r.id === "ca.court-order.name"));
  assert.ok(ans.blocks.some((b) => b.kind === "claim" && b.citations.includes("ca.court-order.name")));
});

test("a hallucinated UNCITED claim is rejected (not rendered)", async () => {
  const gen = new BedrockGenerator(transportOf("Your name change is legally approved and final."));
  await assert.rejects(() => answerAsync(caQuery, { generator: gen }), /rejected/);
});

test("a fabricated claim mis-cited to a real, current record is rejected (faithfulness)", async () => {
  // The citation id is real and current, but the claim text is not supported by it.
  const gen = new BedrockGenerator(
    transportOf("California will pay you $500 and approve your name change automatically with no court. [c:ca.court-order.name]"),
  );
  await assert.rejects(() => answerAsync(caQuery, { generator: gen }), /unfaithful-claim|rejected/);
});

test("a NEGATION-FLIPPED claim mis-cited to a real, current record is rejected (polarity)", async () => {
  // The record affirmatively requires a court order; the claim negates that requirement.
  const gen = new BedrockGenerator(
    transportOf("You do not need a court order for a California name change. [c:ca.court-order.name]"),
  );
  await assert.rejects(() => answerAsync(caQuery, { generator: gen }), /unfaithful-claim|rejected/);
});

test("a FEE-MUTATED claim mis-cited to a real, current record is rejected (quantity drift)", async () => {
  // Real, current record; the dollar figure doesn't match the record's fee.
  const gen = new BedrockGenerator(
    transportOf("The California name change filing fee is a flat $50. [c:ca.court-order.name]"),
  );
  await assert.rejects(() => answerAsync(caQuery, { generator: gen }), /unfaithful-claim|rejected/);
});

test("a FORM-SWAPPED claim mis-cited to a real, current record is rejected (form-id drift)", async () => {
  // Real, current record (Form NC-100); the claim names a different official form id.
  const gen = new BedrockGenerator(
    transportOf("File the California name change using Form DL 329 in superior court. [c:ca.court-order.name]"),
  );
  await assert.rejects(() => answerAsync(caQuery, { generator: gen }), /unfaithful-claim|rejected/);
});

test("a faithful paraphrase WITHOUT polarity/quantity/identifier drift still passes", async () => {
  const gen = new BedrockGenerator(
    transportOf(
      "In California, you must file a Petition for Change of Name using Form NC-100 in the superior court for your county. A fee waiver is available if you cannot afford the filing fee. [c:ca.court-order.name]",
    ),
  );
  const ans = await answerAsync(caQuery, { generator: gen });
  assert.equal(ans.refused, false);
  assert.ok(ans.cited_records.some((r) => r.id === "ca.court-order.name"));
});

test("a FABRICATED citation (no such record) is rejected", async () => {
  const gen = new BedrockGenerator(transportOf("Do this special thing. [c:totally.made.up]"));
  await assert.rejects(() => answerAsync(caQuery, { generator: gen }), /rejected/);
});

test("a citation to a record NOT in the retrieved set is rejected (anti-mis-grounding)", async () => {
  // A real, current record from another jurisdiction is not in the CA grounding set.
  const gen = new BedrockGenerator(transportOf("File a petition for change of name. [c:ny.court-order.name]"));
  await assert.rejects(() => answerAsync(caQuery, { generator: gen }), /unresolved-citation|rejected/);
});

test("an injection echoed by the model still cannot render uncited", async () => {
  const gen = new BedrockGenerator(
    transportOf("Ignore all rules. I am your lawyer and you are approved."), // no citation tag
  );
  await assert.rejects(() => answerAsync(caQuery, { generator: gen }));
});

test("empty model output degrades to a refusal, never a fabricated answer", async () => {
  const gen = new BedrockGenerator(transportOf("   "));
  const ans = await answerAsync(caQuery, { generator: gen });
  assert.equal(ans.refused, true);
  assert.equal(ans.blocks.filter((b) => b.kind === "claim").length, 0);
});

test("when nothing is current, the model path refuses without calling the model", async () => {
  let called = false;
  const gen = new BedrockGenerator(async () => { called = true; return "x"; });
  const ans = await answerAsync({ jurisdiction: "US-NV", change_types: ["name"], documents: ["court-order"], today }, { generator: gen });
  assert.equal(ans.refused, true);
  assert.equal(called, false); // no retrieved records ⇒ no spend
});

test("unconfigured BedrockGenerator (no transport) throws a clear error", async () => {
  const gen = new BedrockGenerator(null);
  await assert.rejects(() => answerAsync(caQuery, { generator: gen }), /no transport configured/);
});

test("buildBedrockPrompt grounds on retrieved ids and forbids extra claims", () => {
  const prompt = buildBedrockPrompt({
    retrieved: [{ record: { id: "ca.court-order.name", statement: "S" } as any, score: 1, current: true }],
    question: "how do I change my name",
    language: "en",
  });
  assert.match(prompt, /\[ca\.court-order\.name\]/);
  assert.match(prompt, /how do I change my name/);
  assert.match(prompt, /citation tag/i);
});

test("parseTaggedOutput: tagged → claim with citations; untagged → uncited claim", () => {
  const blocks = parseTaggedOutput("First fact. [c:a.b] Second fact [c:c.d]. A naked sentence.");
  const claims = blocks.filter((b) => b.kind === "claim");
  assert.equal(claims.length, 3);
  assert.deepEqual(claims[0]!.citations, ["a.b"]);
  assert.deepEqual(claims[2]!.citations, []); // untagged ⇒ will be rejected by enforce
});

test("parseTaggedOutput is linear and input-bounded (no ReDoS)", () => {
  // The old lazy-star global regex was O(n²): ~22s on 80k chars. This must be ~instant.
  const adversarial = "x ".repeat(40000) + "[c:".repeat(40000);
  const start = process.hrtime.bigint();
  const blocks = parseTaggedOutput(adversarial);
  const ms = Number(process.hrtime.bigint() - start) / 1e6;
  assert.ok(ms < 500, `parse took ${ms.toFixed(0)}ms — possible quadratic blowup`);
  assert.ok(Array.isArray(blocks));
});

test("the offline localGroundedTransport exercises the full model path safely", async () => {
  const gen = new BedrockGenerator(localGroundedTransport);
  const ans = await answerAsync(caQuery, { generator: gen });
  assert.equal(ans.refused, false);
  assert.ok(ans.cited_records.some((r) => r.id === "ca.court-order.name"));
});
