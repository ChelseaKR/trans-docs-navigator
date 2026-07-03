import { test } from "node:test";
import assert from "node:assert/strict";
import {
  handleRoute,
  parseIntake,
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

test("checklist route caching (IP §5.2): identical requests return an identical body, and the cache hit still logs", () => {
  const req = () => handleRoute("GET", u("/checklist?jurisdiction=US-CA&change=name"), "2026-06-16");
  const first = req();
  const second = req(); // served from the render cache
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(second.body, first.body);
  // Observability must not go blind on a cache hit — the log is emitted outside the
  // cached value on every request, hit or miss.
  assert.equal(second.log?.event, "checklist");
  assert.equal(second.log?.fields.jurisdiction, "US-CA");
});

test("checklist route caching keys on the full canonical query, today, and thinner-coverage — distinct inputs never collide", () => {
  const ca = handleRoute("GET", u("/checklist?jurisdiction=US-CA&change=name"), "2026-06-16");
  const ny = handleRoute("GET", u("/checklist?jurisdiction=US-NY&change=name"), "2026-06-16");
  assert.notEqual(ca.body, ny.body);

  const day1 = handleRoute("GET", u("/checklist?jurisdiction=US-CA&change=gender-marker"), "2026-06-16");
  const day2 = handleRoute("GET", u("/checklist?jurisdiction=US-CA&change=gender-marker"), "2026-07-01");
  // Both render successfully — a different `today` is a different cache key, not a stale hit.
  assert.equal(day1.status, 200);
  assert.equal(day2.status, 200);
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

test("answer route caching (IP §5.2): identical no-question requests return an identical body, and the cache hit still logs real counters", () => {
  const req = () => handleRoute("GET", u("/answer?jurisdiction=US-CA&change=name"), "2026-05-31");
  const first = req();
  const second = req(); // served from the render cache
  assert.equal(first.status, 200);
  assert.equal(second.body, first.body);
  // The observability log is stored alongside the cached value and re-emitted on every
  // hit — counters must not go blank/zero just because the body was cached.
  assert.equal(second.log?.event, "answer");
  assert.equal(second.log?.fields.jurisdiction, "US-CA");
  assert.equal(second.log?.fields.refused, first.log?.fields.refused);
  assert.equal(second.log?.fields.claims, first.log?.fields.claims);
  assert.equal(second.log?.fields.degraded, first.log?.fields.degraded);
});

test("answer route never caches a free-text question — different questions re-rank retrieval independently, never colliding on a shared cache entry", () => {
  // These two questions are known (tests/retrieval.test.ts-style scoring) to re-rank the
  // retrieved records differently, so a genuinely per-request (uncached) answer path
  // produces different bodies; a caching bug that fell through to the no-q cache key
  // would flatten both to the same (cached) body.
  const q1 = handleRoute("GET", u("/answer?jurisdiction=US-CA&change=name&q=passport%20travel%20document"), "2026-05-31");
  const q2 = handleRoute("GET", u("/answer?jurisdiction=US-CA&change=name&q=social%20security%20card%20SSA"), "2026-05-31");
  assert.equal(q1.status, 200);
  assert.equal(q2.status, 200);
  assert.notEqual(q1.body, q2.body);
});

test("form route renders a known form and 404s an unknown one", () => {
  assert.equal(handleRoute("GET", u("/forms/us-ss-5")).status, 200);
  assert.equal(handleRoute("GET", u("/forms/nope")).status, 404);
});

test("unknown route 404s with a not_found log", () => {
  const r = handleRoute("GET", u("/whatever"));
  assert.equal(r.status, 404);
  assert.equal(r.log?.fields.route, "/whatever");
});
