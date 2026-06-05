import { test } from "node:test";
import assert from "node:assert/strict";
import { GroundedComposer, BedrockGenerator, defaultGenerator } from "../api/generator.ts";
import type { Retrieved } from "../api/retrieval.ts";
import type { CorpusRecord } from "../api/types.ts";
import { DISCLOSURE } from "../api/citation.ts";

function rec(patch: Partial<CorpusRecord> = {}): CorpusRecord {
  return {
    id: "r1",
    jurisdiction: "US-CA",
    document_type: "court-order",
    change_type: ["name"],
    topic: "Name change",
    statement: "File a Petition for Change of Name in superior court.",
    cost: { amount_usd: null, note: "varies by county", fee_waiver: true },
    timeline: { typical: "6–12 weeks" },
    source: { url: "https://e", title: "T", last_verified: "2026-05-31", verifier: "A" },
    verification_status: "verified",
    recheck_sla_days: 90,
    language: "en",
    ...patch,
  };
}

const composer = new GroundedComposer();

test("composes a cited claim from a current record, with disclosure last", () => {
  const retrieved: Retrieved[] = [{ record: rec(), score: 3, current: true }];
  const ans = composer.generate({ retrieved });
  assert.equal(ans.refused, false);
  const claim = ans.blocks.find((b) => b.kind === "claim");
  assert.ok(claim);
  assert.deepEqual(claim!.citations, ["r1"]);
  assert.ok(claim!.text.includes("Petition for Change of Name"));
  assert.ok(claim!.text.includes("varies by county")); // cost folded in, same citation
  assert.ok(claim!.text.includes("6–12 weeks")); // timeline folded in
  const last = ans.blocks[ans.blocks.length - 1]!;
  assert.ok(last.text.includes(DISCLOSURE.notLegalAdvice));
});

test("flat-amount cost and fee waiver render", () => {
  const r = rec({ cost: { amount_usd: 0, fee_waiver: true } });
  const ans = composer.generate({ retrieved: [{ record: r, score: 1, current: true }] });
  const claim = ans.blocks.find((b) => b.kind === "claim")!;
  assert.ok(claim.text.includes("$0"));
  assert.ok(claim.text.toLowerCase().includes("fee waiver"));
});

test("discretionary records add an uncertainty block (not a claim)", () => {
  const r = rec({ discretionary: true });
  const ans = composer.generate({ retrieved: [{ record: r, score: 1, current: true }] });
  const unc = ans.blocks.find((b) => b.kind === "uncertainty");
  assert.ok(unc);
  assert.equal(unc!.citations[0], "r1");
});

test("refuses when nothing is current and surfaces degraded sources", () => {
  const r = rec({ verification_status: "needs_reverification" });
  const ans = composer.generate({ retrieved: [{ record: r, score: 1, current: false }] });
  assert.equal(ans.refused, true);
  assert.ok(ans.blocks.some((b) => b.kind === "refusal"));
  assert.ok(ans.blocks.some((b) => b.kind === "freshness"));
  assert.deepEqual(ans.cited_records, []);
});

test("respects maxRecords", () => {
  const retrieved: Retrieved[] = [
    { record: rec({ id: "a" }), score: 3, current: true },
    { record: rec({ id: "b" }), score: 2, current: true },
  ];
  const ans = composer.generate({ retrieved, maxRecords: 1 });
  assert.equal(ans.blocks.filter((b) => b.kind === "claim").length, 1);
});

test("composes Spanish scaffolding (cost/timeline/intro/disclosure) for es", () => {
  const r = rec({ language: "es", cost: { amount_usd: 435 }, timeline: { typical: "6–12 semanas" } });
  const ans = composer.generate({ retrieved: [{ record: r, score: 1, current: true }], language: "es" });
  const intro = ans.blocks.find((b) => b.kind === "boilerplate")!;
  assert.match(intro.text, /fuentes oficiales/);
  const claim = ans.blocks.find((b) => b.kind === "claim")!;
  assert.match(claim.text, /El costo típico/);
  assert.match(claim.text, /Tiempo estimado: 6–12 semanas/);
  const last = ans.blocks[ans.blocks.length - 1]!;
  assert.match(last.text, /Información, no asesoramiento legal/);
});

test("Spanish refusal + freshness scaffolding", () => {
  const r = rec({ language: "es", verification_status: "needs_reverification", topic: "marcador de género" });
  const ans = composer.generate({ retrieved: [{ record: r, score: 1, current: false }], language: "es" });
  assert.match(ans.blocks.find((b) => b.kind === "refusal")!.text, /información verificada/);
  assert.match(ans.blocks.find((b) => b.kind === "freshness")!.text, /necesita reverificación/);
});

test("BedrockGenerator is the async production seam (full behavior in bedrock.test.ts)", async () => {
  const g = new BedrockGenerator(); // no transport configured
  await assert.rejects(
    () => g.generateAsync({ retrieved: [{ record: { id: "r1", statement: "s" } as never, score: 1, current: true }] }),
    /no transport configured/,
  );
});

test("defaultGenerator is a GroundedComposer", () => {
  assert.ok(defaultGenerator instanceof GroundedComposer);
});
