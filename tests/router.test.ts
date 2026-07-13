import { test } from "node:test";
import assert from "node:assert/strict";
import {
  handleRoute,
  parseIntake,
  intakeQuery,
  validJurisdiction,
  sanitizeQuestion,
  asLanguage,
  LIMITS,
} from "../api/router.ts";

const u = (path: string) => new URL(path, "http://localhost:8080");

test("validJurisdiction: defaults when omitted, accepts well-formed, rejects malformed", () => {
  assert.equal(validJurisdiction(null), "US-CA");
  assert.equal(validJurisdiction("US"), "US");
  assert.equal(validJurisdiction("US-NY"), "US-NY");
  assert.equal(validJurisdiction("nope"), null);
  assert.equal(validJurisdiction("US-California"), null);
  assert.equal(validJurisdiction("'; DROP TABLE--"), null);
});

test("sanitizeQuestion truncates to the input bound", () => {
  assert.equal(sanitizeQuestion(null), undefined);
  assert.equal(sanitizeQuestion(""), undefined);
  const long = "a".repeat(LIMITS.questionMaxLen + 500);
  assert.equal(sanitizeQuestion(long)!.length, LIMITS.questionMaxLen);
});

test("asLanguage maps only 'es' to Spanish", () => {
  assert.equal(asLanguage("es"), "es");
  assert.equal(asLanguage("en"), "en");
  assert.equal(asLanguage("fr"), "en");
  assert.equal(asLanguage(null), "en");
});

test("parseIntake filters enums and caps array sizes", () => {
  const url = u("/checklist?jurisdiction=US-CA&change=name&change=bogus&doc=passport&doc=evil");
  const intake = parseIntake(url)!;
  assert.deepEqual(intake.change_types, ["name"]);
  assert.deepEqual(intake.documents, ["passport"]);

  const many = new URL("http://localhost/checklist?jurisdiction=US-CA");
  for (let i = 0; i < 50; i++) many.searchParams.append("change", "name");
  assert.equal(parseIntake(many)!.change_types.length, LIMITS.maxArrayItems);
});

test("parseIntake defaults change_types to both when none valid", () => {
  const intake = parseIntake(u("/checklist?jurisdiction=US-CA&change=bogus"))!;
  assert.deepEqual(intake.change_types, ["name", "gender-marker"]);
});

test("parseIntake returns null for malformed jurisdiction", () => {
  assert.equal(parseIntake(u("/checklist?jurisdiction=Mars")), null);
});

test("parseIntake/intakeQuery round-trip court_order=1 (FIX-07 has_court_order intake)", () => {
  const intake = parseIntake(u("/checklist?jurisdiction=US-CA&court_order=1"))!;
  assert.equal(intake.has_court_order, true);
  const q = intakeQuery(intake);
  assert.match(q, /(^|&)court_order=1(&|$)/);
  // Re-parsing the emitted query reproduces the same flag — the annotation survives
  // round-tripping into /checklist, /packet, and resume links.
  assert.equal(parseIntake(u(`/checklist?${q}`))!.has_court_order, true);
});

test("parseIntake omits has_court_order when the flag is absent or not '1'", () => {
  assert.equal(parseIntake(u("/checklist?jurisdiction=US-CA"))!.has_court_order, undefined);
  assert.equal(parseIntake(u("/checklist?jurisdiction=US-CA&court_order=0"))!.has_court_order, undefined);
  assert.equal(intakeQuery(parseIntake(u("/checklist?jurisdiction=US-CA"))!).includes("court_order"), false);
});

test("GET / renders the intake page", () => {
  const r = handleRoute("GET", u("/"));
  assert.equal(r.status, 200);
  assert.match(r.body, /Plan your legal name/);
});

test("non-GET methods are rejected with 405", () => {
  for (const m of ["POST", "PUT", "DELETE", "PATCH"]) {
    const r = handleRoute(m, u("/"));
    assert.equal(r.status, 405);
    assert.equal(r.log?.fields.status, 405);
  }
  assert.equal(handleRoute("HEAD", u("/")).status, 200);
});

test("healthz reports corpus size as JSON", () => {
  const r = handleRoute("GET", u("/healthz"));
  assert.equal(r.status, 200);
  const json = JSON.parse(r.body);
  assert.equal(json.status, "ok");
  assert.ok(json.corpus_records > 5);
});

test("checklist route returns a checklist and a non-PII log", () => {
  const r = handleRoute("GET", u("/checklist?jurisdiction=US-CA&change=name"));
  assert.equal(r.status, 200);
  assert.equal(r.log?.event, "checklist");
  assert.equal(r.log?.fields.jurisdiction, "US-CA");
  assert.match(r.body, /checklist/i);
});

test("checklist with malformed jurisdiction returns 400", () => {
  const r = handleRoute("GET", u("/checklist?jurisdiction=XX"));
  assert.equal(r.status, 400);
});

test("packet route renders with a deterministic generated-on date when today is injected", () => {
  const r = handleRoute("GET", u("/packet?jurisdiction=US-CA&change=name"), "2026-05-31");
  assert.equal(r.status, 200);
  assert.match(r.body, /2026-05-31/);
});

test("answer route returns a grounded answer and logs refusal flag", () => {
  const r = handleRoute("GET", u("/answer?jurisdiction=US-CA&change=name&q=how%20do%20I%20change%20my%20name"), "2026-05-31");
  assert.equal(r.status, 200);
  assert.equal(r.log?.event, "answer");
  assert.equal(typeof r.log?.fields.refused, "boolean");
});

test("answer route 400s on malformed jurisdiction", () => {
  assert.equal(handleRoute("GET", u("/answer?jurisdiction=zzz")).status, 400);
});

test("answer route with no change param defaults to both change types (like /checklist) instead of refusing", () => {
  const r = handleRoute("GET", u("/answer?jurisdiction=US-CA&q=how%20much%20does%20it%20cost"), "2026-05-31");
  assert.equal(r.status, 200);
  assert.equal(r.log?.fields.refused, false);
  assert.ok((r.log?.fields.claims as number) > 0);
});

test("form route renders a known form and 404s an unknown one", () => {
  assert.equal(handleRoute("GET", u("/forms/us-ss-5")).status, 200);
  assert.equal(handleRoute("GET", u("/forms/nope")).status, 404);
});

test("unknown route 404s with a not_found log", () => {
  const r = handleRoute("GET", u("/whatever"));
  assert.equal(r.status, 404);
  assert.equal(r.log?.fields.route, "_unmatched");
});
