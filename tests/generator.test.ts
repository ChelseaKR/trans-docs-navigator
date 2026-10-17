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

test("several unservable records become one freshness block that lists each rule and source once (#311)", () => {
  const degraded: Retrieved[] = [
    { record: rec({ id: "a", topic: "Rule A", source: { url: "https://a", title: "Source 1", last_verified: "2026-07-13", verifier: "A" } }), score: 3, current: false },
    { record: rec({ id: "b", topic: "Rule B", source: { url: "https://b", title: "Source 1", last_verified: "2026-05-31", verifier: "A" } }), score: 2, current: false },
    { record: rec({ id: "c", topic: "Rule C", source: { url: "https://c", title: "Source 2", last_verified: "2026-06-16", verifier: "A" } }), score: 1, current: false },
    // The same record retrieved twice must not be listed twice.
    { record: rec({ id: "c", topic: "Rule C", source: { url: "https://c", title: "Source 2", last_verified: "2026-06-16", verifier: "A" } }), score: 1, current: false },
  ];
  for (const retrieved of [degraded, [{ record: rec({ id: "ok" }), score: 4, current: true } as Retrieved, ...degraded]]) {
    const ans = composer.generate({ retrieved });
    const fresh = ans.blocks.filter((b) => b.kind === "freshness");
    assert.equal(fresh.length, 1);
    const f = fresh[0]!;
    assert.deepEqual(f.citations, []);
    for (const part of ["3 related rules", "Rule A; Rule B; Rule C", "between 2026-05-31 and 2026-07-13", "Source 1; Source 2"]) {
      assert.ok(f.text.includes(part), `${part} missing from: ${f.text}`);
    }
    assert.equal(f.text.match(/Rule C/g)?.length, 1);
    assert.doesNotMatch(f.text, /re-?checked|last checked/i);
    // Placement is unchanged: before the closing disclosure.
    assert.equal(ans.blocks[ans.blocks.length - 1]!.kind, "boilerplate");
  }
});

test("one unservable record keeps its own sentence, and Spanish groups the same way (#311)", () => {
  const one = composer.generate({ retrieved: [{ record: rec({ topic: "Rule A" }), score: 1, current: false }] });
  assert.match(one.blocks.find((b) => b.kind === "freshness")!.text, /^One related rule \(Rule A\) may have changed/);
  const many = composer.generate({
    language: "es",
    retrieved: [
      { record: rec({ id: "a", topic: "Regla A", language: "es" }), score: 2, current: false },
      { record: rec({ id: "b", topic: "Regla B", language: "es" }), score: 1, current: false },
    ],
  });
  const fresh = many.blocks.filter((b) => b.kind === "freshness");
  assert.equal(fresh.length, 1);
  assert.match(fresh[0]!.text, /^2 reglas relacionadas pueden haber cambiado y necesitan reverificación: Regla A; Regla B\./);
  assert.match(fresh[0]!.text, /Las registramos el 2026-05-31/);
});
