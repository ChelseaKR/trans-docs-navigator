import { test } from "node:test";
import assert from "node:assert/strict";
import {
  handleRoute,
  parseIntake,
  parseCompareInput,
  intakeQuery,
  validJurisdiction,
  sanitizeQuestion,
  asLanguage,
  languageParam,
  LIMITS,
} from "../api/router.ts";
import { DEFAULT_COMPARE_DOCUMENTS, DEFAULT_COMPARE_CHANGES, COMPARE_JURISDICTIONS } from "../api/compare.ts";

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

// `?lang=` is a common convention elsewhere on the web; a typed or shared link built
// from muscle memory should resolve, not silently fall back to English.
test("languageParam: accepts ?lang= as an alias for ?language=, which takes precedence", () => {
  assert.equal(languageParam(u("/checklist?lang=es")), "es");
  assert.equal(languageParam(u("/checklist?language=es")), "es");
  assert.equal(languageParam(u("/checklist?language=es&lang=en")), "es", "?language= wins when both are present");
  assert.equal(languageParam(u("/checklist")), null);
});

test("GET /?lang=es renders the intake page in Spanish, same as ?language=es", () => {
  const viaLang = handleRoute("GET", u("/?lang=es"));
  const viaLanguage = handleRoute("GET", u("/?language=es"));
  assert.equal(viaLang.status, 200);
  assert.equal(viaLang.body, viaLanguage.body, "?lang=es and ?language=es must render identically");
});

test("parseIntake honors ?lang= when ?language= is absent", () => {
  const intake = parseIntake(u("/checklist?jurisdiction=US-CA&lang=es"))!;
  assert.equal(intake.language, "es");
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

test("checklist route returns a checklist and a bounded selection-metadata log", () => {
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

// The simulated "today" must be on/after the corpus's last_verified dates, or this test
// stops testing what it says. freshnessOf() deliberately treats a FUTURE last_verified as
// not-current ("future-date"), so a clock set before the corpus was verified makes EVERY
// record non-current and the answer refuses for freshness reasons — which would pass/fail
// for nothing to do with the change-param defaulting this test exists to pin. This clock
// was 2026-05-31 and silently decayed into exactly that state: after the SSA records were
// re-verified to 2026-07-13, `us.ssa-card.name` (the last record still dated 2026-05-31)
// stopped being the one current record propping the assertion up, and it went red.
test("answer route with no change param defaults to both change types (like /checklist) instead of refusing", () => {
  const r = handleRoute("GET", u("/answer?jurisdiction=US-CA&q=how%20much%20does%20it%20cost"), "2026-07-13");
  assert.equal(r.status, 200);
  assert.equal(r.log?.fields.refused, false);
  assert.ok((r.log?.fields.claims as number) > 0);
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
  assert.equal(r.log?.fields.route, "_unmatched");
});

// ── /compare: the "which state?" comparison (api/compare.ts) ──────────────────────────

test("parseCompareInput: a bare visit wants the form, not results", () => {
  const q = parseCompareInput(u("/compare"));
  assert.equal(q.wantsResults, false);
});

test("parseCompareInput: presence of doc OR change alone is enough to want results", () => {
  assert.equal(parseCompareInput(u("/compare?doc=drivers-license")).wantsResults, true);
  assert.equal(parseCompareInput(u("/compare?change=name")).wantsResults, true);
});

test("parseCompareInput: filters enums and never reflects an unrecognized current-state shape", () => {
  const q = parseCompareInput(u("/compare?doc=drivers-license&doc=evil&change=name&change=bogus&current=nope"));
  assert.deepEqual(q.documents, ["drivers-license"]);
  assert.deepEqual(q.change_types, ["name"]);
  assert.equal(q.current, undefined, "a shape-invalid current value is dropped, never reflected");
});

test("parseCompareInput: a well-formed current is kept; sort defaults to alpha and only 'count' overrides it", () => {
  assert.equal(parseCompareInput(u("/compare?current=US-CA")).current, "US-CA");
  assert.equal(parseCompareInput(u("/compare")).sort, "alpha");
  assert.equal(parseCompareInput(u("/compare?sort=count")).sort, "count");
  assert.equal(parseCompareInput(u("/compare?sort=bogus")).sort, "alpha");
});

test("GET /compare with no query renders the form (indexable, not logged as a result)", () => {
  const r = handleRoute("GET", u("/compare"));
  assert.equal(r.status, 200);
  assert.match(r.body, /action="\/compare"/);
  assert.equal(r.log, undefined, "the form itself carries no selection to log");
});

test("GET /compare?doc=...&change=... renders the results table and logs bounded selection metadata", () => {
  const r = handleRoute("GET", u("/compare?doc=drivers-license&change=name"), "2026-07-13");
  assert.equal(r.status, 200);
  assert.equal(r.log?.event, "compare");
  assert.deepEqual(r.log?.fields.documents, ["drivers-license"]);
  assert.deepEqual(r.log?.fields.change_types, ["name"]);
  assert.equal(r.log?.fields.current, undefined);
  assert.match(r.body, /<table class="compare-table"/);
});

test("GET /compare defaults an empty document or change list, exactly like /checklist defaults, rather than showing an empty table", () => {
  // Only `change` present, no `doc` at all — the router must still treat this as "wants
  // results" and hand buildCompareTable an empty documents array, which it defaults.
  const r = handleRoute("GET", u("/compare?change=name"));
  assert.equal(r.status, 200);
  assert.deepEqual(r.log?.fields.documents, DEFAULT_COMPARE_DOCUMENTS);
  assert.deepEqual(r.log?.fields.change_types, ["name"]);
});

test("GET /compare with only invalid doc/change values still renders (never a 400) and falls back to defaults", () => {
  const r = handleRoute("GET", u("/compare?doc=nonsense&change=nonsense"));
  assert.equal(r.status, 200);
  assert.deepEqual(r.log?.fields.documents, DEFAULT_COMPARE_DOCUMENTS);
  assert.deepEqual(r.log?.fields.change_types, DEFAULT_COMPARE_CHANGES);
});

test("GET /compare logs the optional current-state selection, at the same sensitivity class as /checklist's jurisdiction", () => {
  const r = handleRoute("GET", u("/compare?doc=drivers-license&change=name&current=US-CA"));
  assert.equal(r.log?.fields.current, "US-CA");
});

test("GET /compare never carries an origin/destination pair — it is not the relocation planner", () => {
  const r = handleRoute("GET", u("/compare?doc=drivers-license&change=name"));
  assert.equal(r.log?.fields.origin, undefined);
  assert.equal(r.log?.fields.destination, undefined);
});

test("GET /compare renders every covered jurisdiction as a row, regardless of selection", () => {
  const r = handleRoute("GET", u("/compare?doc=financial-records&change=name"));
  assert.equal((r.body.match(/<th scope="row" role="rowheader">/g) ?? []).length, COMPARE_JURISDICTIONS.length);
});

test("GET /compare?sort=count changes the row order relative to the alphabetical default", () => {
  const alpha = handleRoute("GET", u("/compare?doc=birth-certificate&change=gender-marker"), "2026-07-13");
  const byCount = handleRoute("GET", u("/compare?doc=birth-certificate&change=gender-marker&sort=count"), "2026-07-13");
  assert.notEqual(alpha.body, byCount.body);
});

test("GET /compare?lang=es renders in Spanish, same alias support as the rest of the router", () => {
  const r = handleRoute("GET", u("/compare?lang=es"));
  assert.match(r.body, /Comparar estados/);
});
