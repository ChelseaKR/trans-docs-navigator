// Partner read-API contract tests (api/public-api.ts, issue #232).
//
// The API's whole value is that its guarantees travel with the data, so these tests are
// about the guarantees rather than about the plumbing:
//
//   1. the committed schemas in docs/api/ are what the generator produces (no drift);
//   2. every real response validates against its schema;
//   3. every provenance key is REQUIRED in every schema that carries a claim;
//   4. a placeholder verifier can never be published as human verification;
//   5. a record declared `verified` but past its SLA is published as degraded;
//   6. an unresearched jurisdiction is `not_covered`, not an empty list;
//   7. nothing from a request is reflected into a response.
//
// The validator below is a deliberately small draft-2020-12 subset — enough for the
// hand-authored schemas in docs/api/ and nothing more. Writing it out is the point: a
// dependency-free gate that actually validates beats a claim that the schemas are correct.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { handleRoute, CHANGE_TYPES, DOCUMENT_TYPES } from "../api/router.ts";
import {
  API_VERSION,
  getChecklist,
  getCorpus,
  getJurisdiction,
  getJurisdictions,
  getReferrals,
} from "../api/public-api.ts";
import { loadCorpus, loadVerifierRoster, type VerifierEntry } from "../api/corpus.ts";
import { loadReferrals } from "../api/referrals.ts";
import { schemas, schemaPath, schemaBytes } from "../scripts/api-schemas.ts";
import type { CorpusRecord, Intake } from "../api/types.ts";

const TODAY = "2026-09-06";

// ── A small JSON Schema (draft 2020-12 subset) validator ──────────────────────────────

type Schema = Record<string, unknown>;

function typeOf(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (Number.isInteger(v)) return "integer";
  return typeof v;
}

function typeMatches(want: string, actual: unknown): boolean {
  if (want === "integer") return typeOf(actual) === "integer";
  if (want === "number") return typeof actual === "number";
  return typeOf(actual) === want || (want === "number" && typeOf(actual) === "integer");
}

/** Collect every validation error for `value` against `schema`. Empty array means valid. */
function validate(value: unknown, schema: Schema, root: Schema, path = "$"): string[] {
  const errors: string[] = [];

  if (typeof schema["$ref"] === "string") {
    const ref = schema["$ref"];
    const key = ref.replace("#/$defs/", "");
    const defs = root["$defs"] as Record<string, Schema> | undefined;
    const target = defs?.[key];
    assert.ok(target, `${path}: schema has an unresolvable $ref ${ref}`);
    return validate(value, target, root, path);
  }

  if ("const" in schema && value !== schema["const"]) {
    errors.push(`${path}: expected const ${JSON.stringify(schema["const"])}, got ${JSON.stringify(value)}`);
  }

  if (Array.isArray(schema["enum"])) {
    const allowed = schema["enum"] as unknown[];
    if (!allowed.some((a) => a === value)) {
      errors.push(`${path}: ${JSON.stringify(value)} is not one of ${JSON.stringify(allowed)}`);
    }
  }

  const t = schema["type"];
  if (typeof t === "string" && !typeMatches(t, value)) {
    errors.push(`${path}: expected type ${t}, got ${typeOf(value)}`);
  } else if (Array.isArray(t) && !(t as string[]).some((one) => typeMatches(one, value))) {
    errors.push(`${path}: expected one of ${JSON.stringify(t)}, got ${typeOf(value)}`);
  }

  if (typeOf(value) === "object" && (schema["properties"] || schema["required"])) {
    const props = (schema["properties"] ?? {}) as Record<string, Schema>;
    const obj = value as Record<string, unknown>;
    for (const key of (schema["required"] as string[] | undefined) ?? []) {
      if (!(key in obj)) errors.push(`${path}.${key}: required key is missing`);
    }
    if (schema["additionalProperties"] === false) {
      for (const key of Object.keys(obj)) {
        if (!(key in props)) errors.push(`${path}.${key}: additional property not allowed by the schema`);
      }
    }
    for (const [key, sub] of Object.entries(props)) {
      if (key in obj) errors.push(...validate(obj[key], sub, root, `${path}.${key}`));
    }
  }

  if (Array.isArray(value) && schema["items"]) {
    const items = schema["items"] as Schema;
    value.forEach((item, i) => errors.push(...validate(item, items, root, `${path}[${i}]`)));
  }

  return errors;
}

function assertValid(value: unknown, schemaName: string): void {
  const schema = schemas()[schemaName] as Schema;
  assert.ok(schema, `no schema named ${schemaName}`);
  const errors = validate(value, schema, schema);
  assert.deepEqual(errors, [], `${schemaName}: ${errors.length} schema violation(s)\n  ${errors.join("\n  ")}`);
}

// ── 1. The committed schemas are what the generator produces ──────────────────────────

test("docs/api/ is byte-identical to the schema generator", () => {
  for (const [name, schema] of Object.entries(schemas())) {
    const committed = readFileSync(schemaPath(name), "utf8");
    assert.equal(
      committed,
      schemaBytes(schema),
      `docs/api/${name}.schema.json has drifted — run: node --experimental-strip-types scripts/api-schemas.ts --write`,
    );
  }
});

test("the published enums are exactly what the router accepts", () => {
  const record = (schemas()["corpus"] as Schema)["$defs"] as Record<string, Schema>;
  const props = record["record"]!["properties"] as Record<string, Schema>;
  assert.deepEqual(props["document_type"]!["enum"], [...DOCUMENT_TYPES]);
  assert.deepEqual((props["change_type"]!["items"] as Schema)["enum"], [...CHANGE_TYPES]);
});

// ── 2/3. Provenance is structurally mandatory ─────────────────────────────────────────

/** Every key of ApiProvenance. A schema that carries a claim must require all of them. */
const PROVENANCE_KEYS = [
  "source",
  "verification_status",
  "human_verified",
  "verifier_is_placeholder",
  "serving_status",
  "serving_reason",
  "age_days",
  "recheck_sla_days",
  "drift_watchable",
];

test("every claim-bearing schema requires every provenance key", () => {
  const all = schemas();
  const carriers: [string, string][] = [
    ["corpus", "record"],
    ["jurisdiction", "record"],
    ["checklist", "record"],
    ["referrals", "referral"],
  ];
  for (const [schemaName, defName] of carriers) {
    const defs = (all[schemaName] as Schema)["$defs"] as Record<string, Schema>;
    const def = defs[defName];
    assert.ok(def, `${schemaName}: no $defs.${defName}`);
    const required = def["required"] as string[];
    for (const key of PROVENANCE_KEYS) {
      assert.ok(required.includes(key), `${schemaName}.$defs.${defName}: provenance key "${key}" is not required`);
    }
    // Optional is the failure mode this test exists to prevent: a key present in
    // `properties` but absent from `required` validates fine when it is simply missing.
    const props = def["properties"] as Record<string, Schema>;
    for (const key of PROVENANCE_KEYS) assert.ok(key in props, `${schemaName}.$defs.${defName}: no property "${key}"`);
  }
});

test("the disclosure block is required on every envelope, and its consumer terms are an explicit absence", () => {
  for (const [name, schema] of Object.entries(schemas())) {
    if (name === "error") continue;
    const required = (schema as Schema)["required"] as string[];
    assert.ok(required.includes("disclosure"), `${name}: disclosure is not a required key`);
    assert.ok(required.includes("verification"), `${name}: verification is not a required key`);
  }
  const body = getCorpus({ jurisdiction: "US-CA", today: TODAY });
  assert.equal(body.disclosure.consumer_terms, null);
  assert.equal(body.disclosure.consumer_terms_status, "pending-counsel-review");
  assert.equal(body.disclosure.not_legal_advice, "Information, not legal advice.");
});

// ── Real responses validate ───────────────────────────────────────────────────────────

test("every endpoint's real response validates against its published schema", () => {
  assertValid(getCorpus({ jurisdiction: "US-CA", today: TODAY }), "corpus");
  assertValid(getCorpus({ jurisdiction: "US-CA", language: "es", today: TODAY }), "corpus");
  assertValid(getJurisdictions({ today: TODAY }), "jurisdictions");
  assertValid(getJurisdiction("US-CA", { today: TODAY }), "jurisdiction");
  assertValid(getJurisdiction("US-PR", { today: TODAY }), "jurisdiction");
  assertValid(getChecklist({ jurisdiction: "US-TX", change_types: ["name"], documents: [], language: "en" }, { today: TODAY }), "checklist");
  assertValid(getReferrals("US-CA", { today: TODAY }), "referrals");
  assertValid(getReferrals("US-PR", { today: TODAY }), "referrals");
});

test("the unfiltered corpus dump validates too — every record, not a sample", () => {
  const body = getCorpus({ today: TODAY });
  assert.ok(body.data.records.length > 100, "expected the full corpus, got a suspiciously small set");
  assertValid(body, "corpus");
  assert.equal(body.data.filters.jurisdiction, null);
  assert.equal(body.data.filters.language, null);
});

test("every error response validates against the error schema", () => {
  for (const path of ["/api/v1/nope", "/api/v1/jurisdictions/NOT-A-STATE", "/api/v1/corpus?language=fr"]) {
    const r = handleRoute("GET", new URL(path, "http://localhost:8080"), TODAY);
    assert.equal(r.contentType, "application/json");
    assertValid(JSON.parse(r.body), "error");
  }
});

// ── 4. A placeholder verifier is never published as human verification ────────────────

test("no record is published as human-verified while its verifier is a roster placeholder", () => {
  const body = getCorpus({ today: TODAY });
  const roster = loadVerifierRoster();
  let placeholders = 0;
  let declaredVerified = 0;
  for (const rec of body.data.records) {
    if (rec.verifier_is_placeholder) {
      placeholders++;
      assert.equal(rec.human_verified, false, `${rec.id}: placeholder verifier published as human-verified`);
    }
    if (rec.verification_status === "verified") declaredVerified++;
    assert.equal(rec.human_verified, roster.get(rec.source.verifier)?.placeholder !== true && roster.has(rec.source.verifier));
  }
  // The state this API exists to be honest about: many records SAY "verified", and none of
  // them has been checked by a named human. If this ever stops holding it is because real
  // verification landed — update the assertion then, deliberately.
  assert.ok(declaredVerified > 0, "expected some records to declare verification_status: verified");
  assert.equal(placeholders, body.data.records.length, "expected every record to still carry a placeholder verifier");
  assert.equal(body.verification.human_verified_records, 0);
  assert.equal(body.verification.readiness, "demonstration");
});

test("readiness reports partial and full verification once a real verifier exists", () => {
  // Unreachable against the live roster (its only entry is a placeholder), so inject one.
  const roster: Map<string, VerifierEntry> = new Map([
    ["Pilot Seed Reviewer", { name: "Pilot Seed Reviewer", placeholder: true } as VerifierEntry],
    ["A Real Reviewer", { name: "A Real Reviewer" } as VerifierEntry],
  ]);
  const corpus = loadCorpus().filter((r) => r.jurisdiction === "US-CA").slice(0, 2);
  assert.equal(corpus.length, 2, "fixture needs two California records");

  const partial: CorpusRecord[] = [
    corpus[0]!,
    { ...corpus[1]!, source: { ...corpus[1]!.source, verifier: "A Real Reviewer" } },
  ];
  const p = getCorpus({ today: TODAY, roster }, partial);
  assert.equal(p.verification.human_verified_records, 1);
  assert.equal(p.verification.readiness, "partially-verified");
  assert.equal(p.data.records[1]!.human_verified, true);
  assert.equal(p.data.records[1]!.verifier_is_placeholder, false);

  const allReal = partial.map((r) => ({ ...r, source: { ...r.source, verifier: "A Real Reviewer" } }));
  assert.equal(getCorpus({ today: TODAY, roster }, allReal).verification.readiness, "verified");
});

// ── 5. Declared status and serving status are never collapsed ─────────────────────────

test("a record declared verified but past its SLA is published as degraded", () => {
  const far = "2030-01-01"; // past every record's recheck SLA
  const body = getCorpus({ jurisdiction: "US-CA", today: far });
  const stale = body.data.records.filter((r) => r.verification_status === "verified");
  assert.ok(stale.length > 0, "expected California to declare some verified records");
  for (const rec of stale) {
    assert.equal(rec.serving_status, "degraded", `${rec.id}: stale record published as current`);
    assert.equal(rec.serving_reason, "past-sla");
    assert.ok(rec.age_days > rec.recheck_sla_days);
  }
  // …and the same records are `current` when read at a date inside their SLA, so the
  // assertion above is about the clock, not about a field that is always degraded.
  const fresh = getCorpus({ jurisdiction: "US-CA", today: TODAY }).data.records;
  assert.ok(fresh.some((r) => r.serving_status === "current"), "expected some current records today");
});

test("a future-dated record is never published as current", () => {
  const rec = loadCorpus().find((r) => r.jurisdiction === "US-CA" && r.verification_status === "verified")!;
  const future: CorpusRecord = { ...rec, source: { ...rec.source, last_verified: "2031-05-05" } };
  const out = getCorpus({ today: TODAY }, [future]).data.records[0]!;
  assert.equal(out.serving_status, "degraded");
  assert.equal(out.serving_reason, "future-date");
});

// ── 6. An absence is published as an absence ──────────────────────────────────────────

test("an unresearched jurisdiction is not_covered with HTTP 200 and no records", () => {
  const r = handleRoute("GET", new URL("/api/v1/jurisdictions/US-PR", "http://localhost:8080"), TODAY);
  assert.equal(r.status, 200);
  const body = JSON.parse(r.body) as ReturnType<typeof getJurisdiction>;
  assert.equal(body.data.status, "not_covered");
  assert.deepEqual(body.data.records, []);
  assert.ok(body.data.not_covered_reason);
  assert.match(body.data.not_covered_reason!, /absence of research/);
});

test("a covered jurisdiction reports covered, with a non-null record list and a null reason", () => {
  const body = getJurisdiction("US-CA", { today: TODAY });
  assert.equal(body.data.status, "covered");
  assert.equal(body.data.not_covered_reason, null);
  assert.ok(body.data.records.length > 0);
});

test("a translation gap is never published as an uncovered jurisdiction", () => {
  // Coverage must be decided before the language filter, or a state we cover only in
  // English would tell a Spanish consumer we do not cover it — turning a missing
  // translation into a claim about the state.
  const enOnly = loadCorpus().filter((r) => r.jurisdiction === "US-CA" && r.language === "en");
  assert.ok(enOnly.length > 0);
  const body = getJurisdiction("US-CA", { language: "es", today: TODAY }, enOnly);
  assert.equal(body.data.status, "covered");
  assert.deepEqual(body.data.records, []);
  assert.equal(body.data.not_covered_reason, null);
});

test("a jurisdiction with only national referrals is not reported as locally covered", () => {
  // The bug this test was written against: api/referrals.ts folds the two NATIONAL records
  // into every jurisdiction's result, so an uncovered jurisdiction came back non-empty and
  // a naive `length > 0` check called it "covered". Puerto Rico has no local referral.
  const national = getReferrals("US-PR", { today: TODAY });
  assert.equal(national.data.status, "national-only");
  assert.equal(national.data.local_referral_count, 0);
  assert.ok(national.data.referrals.length > 0, "national orgs do serve PR and are still returned");
  assert.ok(national.data.referrals.every((r) => r.scope === "national"));
  assert.match(national.data.coverage_note!, /no referral scoped to this jurisdiction/i);
  assertValid(national, "referrals");
});

test("a jurisdiction with a local referral is covered, and national ones stay labelled", () => {
  const some = getReferrals("US-CA", { today: TODAY });
  assert.equal(some.data.status, "covered");
  assert.ok(some.data.local_referral_count > 0);
  assert.equal(some.data.coverage_note, null);
  assert.equal(
    some.data.referrals.filter((r) => r.scope === "jurisdiction").length,
    some.data.local_referral_count,
  );
  assert.ok(some.data.referrals.some((r) => r.scope === "national"), "the national orgs are still included");
  for (const r of some.data.referrals) {
    assert.equal(r.scope === "jurisdiction", r.jurisdiction === "US-CA");
  }
});

test("an empty referral set is reported as not_covered, not as an empty success", () => {
  // Unreachable against the live data (the national records match everything), so inject.
  const none = getReferrals("US-PR", { today: TODAY }, []);
  assert.equal(none.data.status, "not_covered");
  assert.equal(none.data.local_referral_count, 0);
  assert.deepEqual(none.data.referrals, []);
  assert.deepEqual(none.data.hsds.organizations, []);
  assert.match(none.data.coverage_note!, /absence of research/);
  assertValid(none, "referrals");
});

test("HSDS mirrors the referral list exactly, in the requested language", () => {
  const some = getReferrals("US-CA", { today: TODAY });
  assert.equal(some.data.hsds.organizations.length, some.data.referrals.length);
  assert.equal(some.data.hsds.organizations[0]!.id, some.data.referrals[0]!.id);
  // HSDS holds only fields this project actually has; contact fields are an explicit null.
  assert.equal(some.data.hsds.organizations[0]!.email, null);

  const es = getReferrals("US-CA", { language: "es", today: TODAY });
  assert.equal(es.data.hsds.organizations[0]!.description, es.data.referrals[0]!.note.es);
  assert.notEqual(es.data.referrals[0]!.note.es, es.data.referrals[0]!.note.en);
});

test("the jurisdiction index counts what it says it counts", () => {
  const corpus = loadCorpus();
  const body = getJurisdictions({ today: TODAY });
  assert.ok(body.data.jurisdictions.length > 10);
  const sorted = [...body.data.jurisdictions].sort((a, b) => a.jurisdiction.localeCompare(b.jurisdiction));
  assert.deepEqual(body.data.jurisdictions, sorted, "index must be sorted");
  for (const row of body.data.jurisdictions) {
    assert.equal(row.record_count, corpus.filter((r) => r.jurisdiction === row.jurisdiction).length);
    assert.equal(row.human_verified_records, 0);
  }
});

// ── The checklist endpoint mirrors /checklist's honesty ───────────────────────────────

test("the API checklist carries the coverage banners the HTML checklist renders", () => {
  const intake: Intake = { jurisdiction: "US-TX", change_types: ["name"], documents: [], language: "en" };
  const body = getChecklist(intake, { today: TODAY });
  assert.equal(body.data.jurisdiction, "US-TX");
  assert.ok(body.data.steps.length > 0);
  assert.equal(typeof body.data.coverage.no_state_coverage, "boolean");
  assert.equal(body.data.coverage.no_state_coverage, false);
  // Every record id a step cites must be resolvable inside the same response — a consumer
  // must never have to guess what a citation points at.
  const ids = new Set(body.data.records.map((r) => r.id));
  for (const step of body.data.steps) {
    for (const id of step.record_ids) assert.ok(ids.has(id), `${step.key}: cites unresolvable record ${id}`);
  }
});

test("an uncovered jurisdiction's checklist says so rather than returning a bare empty list", () => {
  const intake: Intake = { jurisdiction: "US-PR", change_types: ["name"], documents: [], language: "en" };
  const body = getChecklist(intake, { today: TODAY });
  assert.equal(body.data.coverage.no_state_coverage, true);
  assertValid(body, "checklist");
});

test("the minor-coverage flag is only claimed when the request is about a minor", () => {
  const base: Intake = { jurisdiction: "US-OH", change_types: ["name"], documents: [], language: "en" };
  assert.equal(getChecklist(base, { today: TODAY }).data.coverage.no_minor_coverage, false);
  const asMinor = getChecklist({ ...base, for_minor: true }, { today: TODAY });
  assert.equal(asMinor.data.coverage.no_minor_coverage, true);
});

test("a Spanish request whose state has thinner Spanish coverage says so", () => {
  // Every one of the 52 covered jurisdictions currently has BOTH languages, so this state
  // is not reachable from the live corpus — injecting an English-only one is the only way
  // to exercise the flag rather than to assert a fixture that cannot fail.
  const corpus = loadCorpus();
  const enOnly = corpus.filter((r) => r.jurisdiction === "US-CA" && r.language === "en");
  assert.ok(enOnly.length > 0);
  const body = getChecklist(
    { jurisdiction: "US-CA", change_types: ["name"], documents: ["court-order"], language: "es" },
    { today: TODAY },
    enOnly,
  );
  assert.equal(body.data.coverage.thinner_language_coverage, true);

  // …and false when the Spanish records are present, so the assertion above is about
  // coverage rather than about a flag that is always on.
  const both = corpus.filter((r) => r.jurisdiction === "US-CA");
  const ok = getChecklist(
    { jurisdiction: "US-CA", change_types: ["name"], documents: ["court-order"], language: "es" },
    { today: TODAY },
    both,
  );
  assert.equal(ok.data.coverage.thinner_language_coverage, false);
});

// ── Router wiring ─────────────────────────────────────────────────────────────────────

test("the API routes are wired, JSON-typed, and never fall through to an HTML page", () => {
  const paths = [
    "/api/v1/corpus?jurisdiction=US-CA",
    "/api/v1/jurisdictions",
    "/api/v1/jurisdictions/US-CA",
    "/api/v1/checklist?jurisdiction=US-CA",
    "/api/v1/referrals/US-CA",
  ];
  for (const p of paths) {
    const r = handleRoute("GET", new URL(p, "http://localhost:8080"), TODAY);
    assert.equal(r.status, 200, p);
    assert.equal(r.contentType, "application/json", p);
    assert.doesNotThrow(() => JSON.parse(r.body), p);
    assert.equal((JSON.parse(r.body) as { api_version: string }).api_version, API_VERSION, p);
  }
});

test("trailing slashes and the bare prefix resolve without falling into an HTML 404", () => {
  for (const p of ["/api/v1", "/api/v1/", "/api/v1/corpus/", "/api/v1/jurisdictions/US-CA/"]) {
    const r = handleRoute("GET", new URL(p, "http://localhost:8080"), TODAY);
    assert.equal(r.contentType, "application/json", p);
  }
  assert.equal(handleRoute("GET", new URL("/api/v1/corpus/", "http://localhost:8080"), TODAY).status, 200);
  assert.equal(handleRoute("GET", new URL("/api/v1/", "http://localhost:8080"), TODAY).status, 404);
});

test("a malformed jurisdiction is a 400 and an unresearched one is a 200", () => {
  const bad = handleRoute("GET", new URL("/api/v1/jurisdictions/xx", "http://localhost:8080"), TODAY);
  assert.equal(bad.status, 400);
  assert.equal(handleRoute("GET", new URL("/api/v1/referrals/xx", "http://localhost:8080"), TODAY).status, 400);
  assert.equal(handleRoute("GET", new URL("/api/v1/corpus?jurisdiction=xx", "http://localhost:8080"), TODAY).status, 400);
  assert.equal(handleRoute("GET", new URL("/api/v1/checklist?jurisdiction=xx", "http://localhost:8080"), TODAY).status, 400);
  assert.equal(handleRoute("GET", new URL("/api/v1/jurisdictions/US-PR", "http://localhost:8080"), TODAY).status, 200);
});

test("an unsupported language is refused rather than silently answered in English", () => {
  const r = handleRoute("GET", new URL("/api/v1/corpus?language=fr", "http://localhost:8080"), TODAY);
  assert.equal(r.status, 400);
  assert.equal((JSON.parse(r.body) as { error: { code: string } }).error.code, "unsupported_language");
  // `lang` is accepted as an alias on the HTML routes; it must behave identically here.
  assert.equal(handleRoute("GET", new URL("/api/v1/corpus?lang=fr", "http://localhost:8080"), TODAY).status, 400);
  assert.equal(handleRoute("GET", new URL("/api/v1/corpus?lang=es&jurisdiction=US-CA", "http://localhost:8080"), TODAY).status, 200);
});

test("the API is read-only: a write method gets 405, not a write", () => {
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    const r = handleRoute(method, new URL("/api/v1/corpus", "http://localhost:8080"), TODAY);
    assert.equal(r.status, 405, method);
  }
});

test("the API is excluded from the crawl surface", async () => {
  const { robotsTxt } = await import("../src/seo.ts");
  assert.match(robotsTxt(), /^Disallow: \/api\/$/m);
  const { indexablePaths } = await import("../src/guide.ts");
  assert.ok(!indexablePaths().some((p) => p.startsWith("/api")), "no API path may be indexable");
});

test("API paths are bounded to low-cardinality metric labels", async () => {
  const { metricRoute } = await import("../api/metrics.ts");
  assert.equal(metricRoute("/api/v1/corpus"), "/api/v1/corpus");
  assert.equal(metricRoute("/api/v1/jurisdictions"), "/api/v1/jurisdictions");
  assert.equal(metricRoute("/api/v1/checklist"), "/api/v1/checklist");
  assert.equal(metricRoute("/api/v1/jurisdictions/US-CA"), "/api/v1/jurisdictions/:jurisdiction");
  assert.equal(metricRoute("/api/v1/referrals/US-CA"), "/api/v1/referrals/:jurisdiction");
});

// ── 7. Non-reflection ─────────────────────────────────────────────────────────────────

const SENTINEL = "PIISENTINEL_API_DO_NOT_LEAK_77";

function assertNoLeak(label: string, url: URL): void {
  const r = handleRoute("GET", url, TODAY);
  assert.ok(!r.body.includes(SENTINEL), `${label}: sentinel leaked into the response body`);
  const logStr = r.log ? JSON.stringify(r.log) : "";
  assert.ok(!logStr.includes(SENTINEL), `${label}: sentinel leaked into log fields`);
}

test("query-borne content is never reflected into an API response or log descriptor", () => {
  const paths = [
    "/api/v1/corpus",
    "/api/v1/jurisdictions",
    "/api/v1/jurisdictions/US-CA",
    "/api/v1/checklist",
    "/api/v1/referrals/US-CA",
    "/api/v1/nope",
  ];
  for (const p of paths) {
    const url = new URL(p, "http://localhost:8080");
    url.searchParams.set("jurisdiction", "US-CA");
    url.searchParams.set("q", `my name is ${SENTINEL}`);
    for (const k of ["current_legal_name", "new_legal_name", "ssn", "date_of_birth", "email", "language"]) {
      url.searchParams.set(k, SENTINEL);
    }
    assertNoLeak(p, url);
  }
});

test("PATH-borne content is never reflected into an API error", () => {
  // Kept separate from the query sweep on purpose. Poisoning `language` in the same
  // request makes apiRoute return `unsupported_language` on its FIRST branch, so the
  // request never reaches the jurisdiction/endpoint handlers and a reflection there
  // would sail through — the fixture would sit where the failure is impossible.
  // A negative control (echoing the path segment into the 400 message) confirmed exactly
  // that: it went undetected until these cases were split apart.
  for (const p of [
    `/api/v1/jurisdictions/${SENTINEL}`,
    `/api/v1/referrals/${SENTINEL}`,
    `/api/v1/${SENTINEL}`,
    `/api/v1/corpus/${SENTINEL}`,
  ]) {
    assertNoLeak(p, new URL(p, "http://localhost:8080"));
  }
  // Prove these cases actually reach the handlers they are meant to probe, rather than
  // being deflected by an earlier guard the way the query sweep was.
  const r = handleRoute("GET", new URL(`/api/v1/jurisdictions/${SENTINEL}`, "http://localhost:8080"), TODAY);
  assert.equal(r.status, 400);
  assert.equal((JSON.parse(r.body) as { error: { code: string } }).error.code, "invalid_jurisdiction");
});

test("every field an API route logs survives safeLog's allowlist", async () => {
  // safeLog silently DROPS a key that is not on api/log.ts's allowlist, so a descriptor
  // naming an unlisted field logs nothing and nobody finds out. Assert that each field
  // SURVIVES — asserting "no error" would be a check that cannot fail.
  const { safeLog } = await import("../api/log.ts");
  const paths = ["/api/v1/corpus", "/api/v1/jurisdictions/US-CA", "/api/v1/checklist", "/api/v1/referrals/US-CA"];
  const descriptors: { path: string; fields: Record<string, unknown> }[] = [];
  const original = console.log;
  const lines: string[] = [];
  console.log = (s?: unknown) => void lines.push(String(s));
  try {
    for (const p of paths) {
      const r = handleRoute("GET", new URL(p, "http://localhost:8080"), TODAY);
      assert.ok(r.log, `${p}: no log descriptor`);
      descriptors.push({ path: p, fields: r.log!.fields });
      safeLog(r.log!.event, r.log!.fields);
    }
  } finally {
    console.log = original;
  }
  assert.equal(lines.length, paths.length);
  lines.forEach((line, i) => {
    const parsed = JSON.parse(line) as Record<string, unknown>;
    const { path, fields } = descriptors[i]!;
    assert.ok(Object.keys(fields).length > 0, `${path}: an empty log descriptor proves nothing`);
    for (const key of Object.keys(fields)) {
      assert.ok(key in parsed, `${path}: safeLog dropped "${key}" — it is not on api/log.ts's allowlist`);
    }
  });
});

// ── Sanity: the population summary describes the response, not the whole corpus ───────

test("the verification summary counts the records actually in the response", () => {
  const ca = getJurisdiction("US-CA", { today: TODAY });
  assert.equal(ca.verification.total_records, loadCorpus().filter((r) => r.jurisdiction === "US-CA").length);
  const refs = getReferrals("US-CA", { today: TODAY });
  assert.equal(refs.verification.total_records, refs.data.referrals.length);
  assert.ok(loadReferrals().length >= refs.data.referrals.length);
});
