// Unit tests for the source-fidelity gate's matching primitives (scripts/source-fidelity.ts).
//
// This gate exists because the citation chain had no bottom link: `make citation` proves an
// answer cites a record; NOTHING proved the record matched the source it cites. But a gate
// like this fails in two directions, and BOTH are dangerous:
//
//   • a FALSE PASS silently blesses a wrong record — the harm the gate was built to stop;
//   • a FALSE FAILURE makes the gate cry wolf, and a gate that cries wolf gets switched off.
//
// The false-failure cases below are not hypothetical. Every one of them was produced by the
// real corpus during development, and each would have been "fixed" by weakening a record to
// match a naive matcher. They are pinned here so that can't happen quietly.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractMoney,
  extractDurations,
  extractRecordFormIds,
  extractSourceFormIds,
  sourceHasFormId,
  statesFree,
  isNegated,
  canonicalAmount,
  extractAssertions,
  checkAssertion,
  viewOf,
  auditRecord,
} from "../scripts/source-fidelity.ts";
import type { CorpusRecord, FormDef } from "../api/types.ts";

const rec = (over: Partial<CorpusRecord> = {}): CorpusRecord =>
  ({
    id: "t.1",
    jurisdiction: "US-CA",
    document_type: "court-order",
    change_type: ["name"],
    topic: "T",
    statement: "You file papers in court.",
    source: { url: "https://e.test", title: "T", last_verified: "2026-07-13", verifier: "A" },
    verification_status: "verified",
    recheck_sla_days: 90,
    language: "en",
    ...over,
  }) as CorpusRecord;

// ── Money ───────────────────────────────────────────────────────────────────────────────

test("money normalizes currency formatting in both directions", () => {
  // The source writes "$435.00"; the record writes "$435". Same fee.
  assert.deepEqual(extractMoney("the fee is $435.00"), ["435"]);
  assert.deepEqual(extractMoney("the fee is $435"), ["435"]);
  assert.equal(canonicalAmount("$1,234.50"), "1234.5");
  // A range yields both endpoints, so a record claiming only one of them still matches.
  assert.deepEqual(extractMoney("you pay a $435-$450 filing fee"), ["435", "450"]);
});

test("a fee the source never states is UNSUPPORTED (the $480 that was never there)", () => {
  const view = viewOf("you pay a $435-$450 filing fee. if you can not afford the fee, ask the court.");
  const a = extractAssertions(rec({ cost: { amount_usd: null, note: "commonly around $435–$480" } }), []);
  const results = a.filter((x) => x.kind === "money").map((x) => checkAssertion(x, view));
  assert.equal(results.find((r) => r.key === "435")?.verdict, "supported");
  assert.equal(results.find((r) => r.key === "480")?.verdict, "unsupported");
});

test("amount_usd: 0 demands the source actually SAY it is free — not merely omit a fee", () => {
  // The California DMV bug in one assertion: the page said nothing about a fee, and the
  // record turned that silence into "$0". Silence is not "free".
  const silent = viewOf("bring your documents to a field office and be ready to pay the licensing fee.");
  const free = viewOf("there is no fee to amend the record.");
  const zero = extractAssertions(rec({ cost: { amount_usd: 0 } }), []).find((x) => x.kind === "money")!;
  assert.equal(checkAssertion(zero, silent).verdict, "unsupported");
  assert.equal(checkAssertion(zero, free).verdict, "supported");
  assert.equal(statesFree("no se cobra: el trámite es gratis"), true);
});

test("a bare number in the source is NOT money (no substring false-pass)", () => {
  // The whole reason matching is token-level: "15" occurs in "2015", "$150" and phone numbers.
  const view = viewOf("in 2015 we processed 150 requests. call 360-236-4300.");
  const fee = extractAssertions(rec({ cost: { amount_usd: 15 } }), []).find((x) => x.kind === "money")!;
  assert.equal(checkAssertion(fee, view).verdict, "unsupported");
});

// ── Durations ───────────────────────────────────────────────────────────────────────────

test("durations normalize number-words, ranges, and the '(N)' idiom official pages use", () => {
  // Source: "three (3) business days". Record: "3 business days". Identical claim — but the
  // parenthesis sat between the digit and its unit, so nothing was extracted at all and
  // Washington's perfectly well-sourced record read as unsupported. Brackets are flattened.
  assert.deepEqual(extractDurations("we are processing requests in three (3) business days"), ["3 business-day"]);
  assert.deepEqual(extractDurations("please allow up to two (2) weeks"), ["2 week"]);
  assert.deepEqual(extractDurations("a ten (10) month processing turnaround time"), ["10 month"]);
  assert.deepEqual(extractDurations("about 3 business days"), ["3 business-day"]);
  assert.deepEqual(extractDurations("two to four weeks"), ["2 week", "4 week"]);
  assert.deepEqual(extractDurations("2–4 weeks"), ["2 week", "4 week"]);
  // Spanish record, English source: the canonical unit is language-neutral by design,
  // because ES records legitimately cite EN-only official pages.
  assert.deepEqual(extractDurations("unos 3 días hábiles"), ["3 business-day"]);
  assert.deepEqual(extractDurations("de 2 a 4 semanas"), ["2 week", "4 week"]);
  assert.deepEqual(extractDurations("about ten months"), ["10 month"]);
});

test("durations are NOT converted across units (12 weeks is not 3 months)", () => {
  // The real California bug: the record said "6–12 weeks"; the page said "2 to 3 months".
  // A gate that silently converted units would have called that supported. It is not — the
  // low end (6 weeks) is nowhere near 2 months, and the record was simply wrong.
  const view = viewOf("a judge will make a decision in about 2 to 3 months");
  const a = extractAssertions(rec({ timeline: { typical: "roughly 6–12 weeks" } }), []);
  for (const d of a.filter((x) => x.kind === "duration")) {
    assert.equal(checkAssertion(d, view).verdict, "unsupported");
  }
  const ok = extractAssertions(rec({ timeline: { typical: "about 2 to 3 months" } }), []);
  for (const d of ok.filter((x) => x.kind === "duration")) {
    assert.equal(checkAssertion(d, view).verdict, "supported");
  }
});

// ── Form identifiers ────────────────────────────────────────────────────────────────────

test("form ids are matched as whole tokens, not substrings (MV-44 ≠ MV-44NC)", () => {
  assert.deepEqual(extractRecordFormIds("mail form MV-44NC with a copy"), ["MV44NC"]);
  assert.deepEqual(extractRecordFormIds("bring form MV-44 to an office"), ["MV44"]);
  // A source naming only MV-44NC must NOT satisfy a record that names MV-44.
  const ids = new Set(extractSourceFormIds("complete form mv-44nc and mail it"));
  assert.equal(sourceHasFormId("MV44NC", "complete form mv-44nc", ids), true);
  assert.equal(sourceHasFormId("MV44", "complete form mv-44nc", ids), false);
  // Multi-part numbers stay distinct: DOH 422-143 is not DOH 422-126.
  assert.deepEqual(extractRecordFormIds("use form DOH 422-143"), ["DOH422143"]);
  assert.notDeepEqual(extractRecordFormIds("use form DOH 422-126"), ["DOH422143"]);
  assert.deepEqual(extractRecordFormIds("file Form VS 24B by mail"), ["VS24B"]);
  assert.deepEqual(extractRecordFormIds("Form SS-5"), ["SS5"]);
});

test("ordinary prose is never mistaken for a form id (the 'Ley 229' false failure)", () => {
  // The Spanish record says "la Ley 229 de la Cámara". A case-insensitive matcher extracted
  // that as the form id "LEY229" and then demanded it of an English source page — a pure
  // false failure. Official ids are capitalized; prose is not. That asymmetry is the fix.
  assert.deepEqual(extractRecordFormIds("Texas promulgó la Ley 229 de la Cámara"), []);
  assert.deepEqual(extractRecordFormIds("Texas enacted House Bill 229 in 2025"), []);
  assert.deepEqual(extractRecordFormIds("Executive Order 14168"), []);
});

test("a spelled-out statute name in the source satisfies its abbreviation in the record", () => {
  // Source: "house bill 229". Record: "HB 229". Normalization, not interpretation.
  const source = "the library says texas enacted house bill 229 in 2025";
  const ids = new Set(extractSourceFormIds(source));
  assert.equal(sourceHasFormId("HB229", source, ids), true);
  assert.equal(sourceHasFormId("HB230", source, ids), false);
});

test("a form_ref whose form the cited source never names is UNSUPPORTED", () => {
  // This is the DL 329 harm in its structured form: the record hands the user an official
  // form, under a citation to a page that does not mention that form.
  const forms: FormDef[] = [
    {
      id: "ca-dl-329",
      jurisdiction: "US-CA",
      document_type: "drivers-license",
      change_type: ["gender-marker"],
      title: "Form DL 329 — Gender Category Request",
      source: { url: "https://e.test/dl329.pdf", title: "DL 329", last_verified: "2026-07-13", verifier: "A" },
    },
  ];
  const view = viewOf("apply with the online dl/id application and finish at a field office.");
  const a = extractAssertions(rec({ form_ref: "ca-dl-329" }), forms).find((x) => x.kind === "form-id")!;
  assert.equal(checkAssertion(a, view).verdict, "unsupported");
});

test("an official form with no identifier at all is UNCHECKABLE, never silently passed", () => {
  // Illinois' "Affidavit and Certificate of Correction Request" has no form number. There is
  // nothing to match on — so the gate says so, rather than quietly counting it as verified.
  const forms: FormDef[] = [
    {
      id: "il-affidavit-correction",
      jurisdiction: "US-IL",
      document_type: "birth-certificate",
      change_type: ["gender-marker"],
      title: "Affidavit and Certificate of Correction Request",
      source: { url: "https://e.test/a.pdf", title: "A", last_verified: "2026-07-13", verifier: "A" },
    },
  ];
  const a = extractAssertions(rec({ form_ref: "il-affidavit-correction" }), forms).find((x) => x.kind === "form-id")!;
  assert.equal(checkAssertion(a, viewOf("send the signed, notarized form")).verdict, "uncheckable");
});

// ── Requirements, negation, residency ───────────────────────────────────────────────────

test("a requirement whose topic the source never mentions is UNSUPPORTED", () => {
  // The passport bug generalized: a record citing a page with ZERO content on the subject.
  const landing = viewOf("driver licenses and id cards. renew online. pay registration fees.");
  const a = extractAssertions(
    rec({ statement: "Bring proof of your legal name change, such as your court order." }),
    [],
  ).find((x) => x.kind === "requirement" && x.key === "court-order-required")!;
  assert.equal(checkAssertion(a, landing).verdict, "unsupported");
});

test("plural/participle inflection does not cause a false failure ('court orders')", () => {
  // /\bcourt order\b/ does NOT match "court orders" — that regex read the Texas State Law
  // Library page (which says "court orders" four times) as having zero court-order content.
  const view = viewOf("dps stopped accepting court orders that change a person's sex.");
  const a = extractAssertions(rec({ statement: "A district court order can direct the agency." }), []).find(
    (x) => x.kind === "requirement" && x.key === "court-order-required",
  )!;
  assert.equal(checkAssertion(a, view).verdict, "supported");
});

test("a NEGATED claim is never run through the affirmative check, and never passed", () => {
  // "You do NOT need a court order" is not an assertion that a court order is required, and
  // keyword presence can neither confirm nor refute an absence. It must not be checked as if
  // it could. It is counted as an unverifiable negation instead.
  assert.equal(isNegated("You do not need a court order."), true);
  assert.equal(isNegated("The guide no longer lists a newspaper publication step."), true);
  assert.equal(isNegated("No se acepta una orden judicial."), true);
  const r = rec({ statement: "In California you can change the marker without a court order." });
  const a = extractAssertions(r, []);
  assert.equal(a.some((x) => x.kind === "requirement" && x.key === "court-order-required"), false);
  assert.equal(auditRecord(r, viewOf("anything"), []).negatedClaims, 1);
});

test("residency_bound must be supported by the SOURCE, not by the record's own prose", () => {
  // api/corpus.ts validates this annotation against the RECORD'S OWN sentence — i.e. it
  // validates the claim against the claim. That is this whole bug class in miniature, and it
  // is why the relocation planner warned "this door closes when you move" on three records
  // whose cited pages never said anything of the kind.
  const r = rec({
    statement: "You file in the district court of the county where you live.",
    relocation: { residency_bound: true },
  });
  const a = extractAssertions(r, []).find((x) => x.kind === "residency")!;
  assert.equal(
    checkAssertion(a, viewOf("you file a petition in the texas county where you live")).verdict,
    "supported",
  );
  assert.equal(
    checkAssertion(a, viewOf("you can legally change your name by filing papers in court")).verdict,
    "unsupported",
  );
});

// ── Honest accounting ───────────────────────────────────────────────────────────────────

test("a record whose source has no snapshot is UNCHECKABLE — never supported, never failed", () => {
  // SSA and NY Courts 403 every automated client. Their records cannot be checked by any
  // gate. Reporting that is the whole point; passing it would be a lie with a green tick.
  const audit = auditRecord(rec({ cost: { amount_usd: 0 }, timeline: { typical: "2–4 weeks" } }), null, []);
  assert.ok(audit.results.length > 0);
  assert.ok(audit.results.every((r) => r.verdict === "uncheckable"));
});

test("prose with no extractable literal is counted as UNCHECKED, not as passing", () => {
  const audit = auditRecord(
    rec({
      statement: "You must go in person and confirm your gender designation out loud.",
      detail: "The office may ask for more paperwork.",
    }),
    viewOf("a source that says something else entirely"),
    [],
  );
  assert.equal(audit.totalSentences, 2);
  assert.equal(audit.uncheckedProse, 2, "both sentences carry no literal — the gate vouches for neither");
});
