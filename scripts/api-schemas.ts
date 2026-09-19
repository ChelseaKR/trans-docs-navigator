// Publishes the JSON Schema for every partner-API response under docs/api/ (issue #232).
//
//   node --experimental-strip-types scripts/api-schemas.ts --write   # regenerate
//
// The schemas are DERIVED here rather than hand-written next to the code they describe,
// for the same reason scripts/launch-gates.ts derives the launch-gate block: a schema a
// human maintains by hand drifts away from the responses it claims to describe, and a
// schema that has drifted is worse than none — a consumer validates against it, passes,
// and ships something the service never sends.
//
// Two things keep it honest, both in tests/public-api.test.ts (merge-blocking via the
// `test` gate, so no separate Makefile stage is needed):
//   1. every committed file must be byte-identical to what this module builds; and
//   2. every real response from api/public-api.ts must validate against its schema.
//
// The enums come from api/router.ts's own accepted lists, so a schema can never advertise
// a document type the router rejects.

import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "../api/corpus.ts";
import { CHANGE_TYPES, DOCUMENT_TYPES } from "../api/router.ts";
import { API_VERSION } from "../api/public-api.ts";

export const SCHEMA_DIR = join(REPO_ROOT, "docs", "api");

const BASE_ID = "https://github.com/ChelseaKR/trans-docs-navigator/api/v1";
const VERIFICATION_STATUSES = ["verified", "needs_reverification", "unverified"] as const;
const LANGUAGES = ["en", "es"] as const;
const SERVING_REASONS = [
  "verified-within-sla",
  "past-sla",
  "needs-reverification",
  "unverified",
  "future-date",
] as const;

type Json = Record<string, unknown>;

function obj(properties: Json, opts: { required?: string[]; description?: string } = {}): Json {
  return {
    type: "object",
    ...(opts.description ? { description: opts.description } : {}),
    properties,
    required: opts.required ?? Object.keys(properties),
    additionalProperties: false,
  };
}

const str = (description?: string): Json => ({ type: "string", ...(description ? { description } : {}) });
const bool = (description?: string): Json => ({ type: "boolean", ...(description ? { description } : {}) });
const int = (description?: string): Json => ({ type: "integer", ...(description ? { description } : {}) });
const strArray = (): Json => ({ type: "array", items: { type: "string" } });
const nullableStr = (description?: string): Json => ({
  type: ["string", "null"],
  ...(description ? { description } : {}),
});

/**
 * The provenance block. EVERY key is in `required` — that is the load-bearing property of
 * this whole schema set, and the reason `human_verified` sits beside `verification_status`
 * rather than being inferable from it. A consumer cannot construct a valid object that
 * carries a claim without its sourcing, and cannot receive `verification_status: "verified"`
 * without also receiving the fact that no named human has checked it.
 */
const PROVENANCE: Json = {
  source: obj(
    {
      url: str("The official page this claim is cited to."),
      title: str(),
      last_verified: str("ISO date (YYYY-MM-DD)."),
      verifier: str("The name recorded as verifier. May be a placeholder — see verifier_is_placeholder."),
    },
    { description: "Provenance for a single substantive claim. Guardrail 1: no claim without this." },
  ),
  verification_status: {
    enum: [...VERIFICATION_STATUSES],
    description:
      "What a reviewer wrote down about this record. NOT, by itself, evidence that a human " +
      "checked it — read human_verified for that.",
  },
  human_verified: bool(
    "True only when source.verifier is a real, non-placeholder human on the project's roster. " +
      "False for every record in the corpus today.",
  ),
  verifier_is_placeholder: bool("True when source.verifier is a roster placeholder such as 'Pilot Seed Reviewer'."),
  serving_status: {
    enum: ["current", "degraded"],
    description:
      "What freshness says as of generated_on. A 'degraded' record must not be republished " +
      "as a current statement of the law.",
  },
  serving_reason: { enum: [...SERVING_REASONS] },
  age_days: int("Days between source.last_verified and generated_on. Negative means a future-dated record."),
  recheck_sla_days: int(),
  drift_watchable: bool(
    "False when nothing can automatically detect this cited page changing — no committed " +
      "drift baseline, or a source the pipeline cannot fetch.",
  ),
};

const COST: Json = {
  type: ["object", "null"],
  properties: {
    amount_usd: { type: ["number", "null"], description: "null means the corpus states no amount. Never estimated." },
    note: nullableStr(),
    fee_waiver: { type: "boolean" },
  },
  required: ["amount_usd", "note", "fee_waiver"],
  additionalProperties: false,
};

const TIMELINE: Json = {
  type: ["object", "null"],
  properties: { typical: { type: "string" }, note: { type: ["string", "null"] } },
  required: ["typical", "note"],
  additionalProperties: false,
};

const RECORD: Json = obj(
  {
    id: str(),
    jurisdiction: str(),
    document_type: { enum: [...DOCUMENT_TYPES] },
    change_type: { type: "array", items: { enum: [...CHANGE_TYPES] } },
    topic: str(),
    statement: str(),
    detail: nullableStr(),
    cost: COST,
    timeline: TIMELINE,
    prerequisites: strArray(),
    discretionary: bool(),
    form_refs: strArray(),
    language: { enum: [...LANGUAGES] },
    audience: { enum: ["adult", "minor"] },
    ...PROVENANCE,
  },
  { description: "One citable corpus record, with mandatory provenance." },
);

const REFERRAL: Json = obj(
  {
    id: str(),
    jurisdiction: str(),
    name: str(),
    url: str(),
    note: obj({ en: str(), es: str() }),
    scope: {
      enum: ["jurisdiction", "national"],
      description:
        "'national' means this organization is returned for every jurisdiction. A non-empty " +
        "list of national referrals is not evidence of local coverage.",
    },
    ...PROVENANCE,
  },
  { description: "A legal-aid or official referral, with the same mandatory provenance as a record." },
);

const DISCLOSURE: Json = obj(
  {
    not_legal_advice: str(),
    ai_assisted: str(),
    terms_path: str(),
    consumer_terms: {
      type: "null",
      description:
        "Always null. Terms for API consumers are a legal judgement this project has not " +
        "obtained; an explicit absence is published rather than invented wording.",
    },
    consumer_terms_status: { const: "pending-counsel-review" },
    license: str(),
  },
  { description: "Guarantees that travel with the data. A consumer must display these." },
);

const VERIFICATION_SUMMARY: Json = obj(
  {
    human_verified_records: int("Records in this response verified by a named human. Zero today."),
    total_records: int(),
    readiness: { enum: ["demonstration", "partially-verified", "verified"] },
  },
  { description: "Corpus-wide honesty header, present on every response." },
);

/** Wrap an endpoint's `data` shape in the standard envelope and emit a complete schema file. */
function envelopeSchema(name: string, title: string, description: string, data: Json, defs: Json): Json {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: `${BASE_ID}/${name}.schema.json`,
    title,
    description,
    type: "object",
    properties: {
      api_version: { const: API_VERSION },
      generated_on: str("ISO date this response's freshness was evaluated against."),
      disclosure: { $ref: "#/$defs/disclosure" },
      verification: { $ref: "#/$defs/verification" },
      data,
    },
    required: ["api_version", "generated_on", "disclosure", "verification", "data"],
    additionalProperties: false,
    $defs: { disclosure: DISCLOSURE, verification: VERIFICATION_SUMMARY, ...defs },
  };
}

const CHECKLIST_STEP: Json = obj({
  key: str(),
  order: int(),
  document_type: { enum: [...DOCUMENT_TYPES] },
  title: str(),
  record_ids: strArray(),
  prerequisites: strArray(),
  cost: COST,
  timeline: TIMELINE,
  discretionary: bool(),
  needs_reverification: bool("True when a backing record is degraded. A consumer must render the step degraded too."),
  form_refs: strArray(),
  done: bool(),
});

/** Every published schema, keyed by the file basename it is written to. */
export function schemas(): Record<string, Json> {
  return {
    corpus: envelopeSchema(
      "corpus",
      "GET /api/v1/corpus",
      "Every corpus record, optionally narrowed by jurisdiction and/or language.",
      obj({
        filters: obj({ jurisdiction: nullableStr(), language: { type: ["string", "null"], enum: [...LANGUAGES, null] } }),
        records: { type: "array", items: { $ref: "#/$defs/record" } },
      }),
      { record: RECORD },
    ),
    jurisdictions: envelopeSchema(
      "jurisdictions",
      "GET /api/v1/jurisdictions",
      "The coverage index: every jurisdiction the corpus holds at least one record for.",
      obj({
        jurisdictions: {
          type: "array",
          items: obj({ jurisdiction: str(), record_count: int(), human_verified_records: int() }),
        },
      }),
      {},
    ),
    jurisdiction: envelopeSchema(
      "jurisdiction",
      "GET /api/v1/jurisdictions/{code}",
      "One jurisdiction. A well-formed but unresearched jurisdiction returns HTTP 200 with " +
        "status 'not_covered' — never an empty record list, and never a 404.",
      obj({
        jurisdiction: str(),
        status: {
          enum: ["covered", "not_covered"],
          description:
            "'not_covered' is an absence of research, not a finding that no legal path exists. " +
            "Never present it as either.",
        },
        not_covered_reason: nullableStr("Non-null exactly when status is 'not_covered'."),
        records: { type: "array", items: { $ref: "#/$defs/record" } },
      }),
      { record: RECORD },
    ),
    checklist: envelopeSchema(
      "checklist",
      "GET /api/v1/checklist",
      "A personalized, ordered checklist over the same bounded selection grammar as /checklist.",
      obj({
        jurisdiction: str(),
        change_types: { type: "array", items: { enum: [...CHANGE_TYPES] } },
        language: { enum: [...LANGUAGES] },
        steps: { type: "array", items: { $ref: "#/$defs/step" } },
        gaps: {
          type: "array",
          items: obj({
            document_type: { enum: [...DOCUMENT_TYPES] },
            reason: { enum: ["no-records", "all-degraded"] },
          }),
        },
        coverage: obj(
          {
            no_state_coverage: bool(),
            thinner_language_coverage: bool(),
            no_minor_coverage: bool(),
          },
          {
            description:
              "The coverage-honesty flags the HTML checklist renders as banners. A consumer " +
              "that drops these shows a thinner checklist as if it were the whole answer.",
          },
        ),
        records: { type: "array", items: { $ref: "#/$defs/record" } },
      }),
      { record: RECORD, step: CHECKLIST_STEP },
    ),
    referrals: envelopeSchema(
      "referrals",
      "GET /api/v1/referrals/{code}",
      "Referrals for one jurisdiction, in this project's shape and in Open Referral HSDS shape.",
      obj({
        jurisdiction: str(),
        status: {
          enum: ["covered", "national-only", "not_covered"],
          description:
            "'national-only' means the list is non-empty but holds only national organizations: " +
            "no referral scoped to this jurisdiction has been researched.",
        },
        coverage_note: nullableStr("Non-null for 'national-only' and 'not_covered'."),
        local_referral_count: int("Referrals scoped to this jurisdiction specifically."),
        referrals: { type: "array", items: { $ref: "#/$defs/referral" } },
        hsds: obj({
          organizations: {
            type: "array",
            items: obj({
              id: str(),
              name: str(),
              description: str(),
              url: str(),
              email: {
                type: "null",
                description: "Always null: this project holds no contact data, and an invented one would be a lie.",
              },
            }),
          },
        }),
      }),
      { referral: REFERRAL },
    ),
    error: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: `${BASE_ID}/error.schema.json`,
      title: "API error",
      description:
        "A machine-readable error. `message` is a fixed string: nothing from the request is " +
        "ever copied into a response.",
      type: "object",
      properties: {
        api_version: { const: API_VERSION },
        error: obj({
          code: { enum: ["invalid_jurisdiction", "unsupported_language", "unknown_endpoint"] },
          message: str(),
        }),
      },
      required: ["api_version", "error"],
      additionalProperties: false,
    },
  };
}

export function schemaPath(name: string, dir = SCHEMA_DIR): string {
  return join(dir, `${name}.schema.json`);
}

/** The exact bytes a schema file must contain. One definition, used by the writer AND the test. */
export function schemaBytes(schema: Json): string {
  return JSON.stringify(schema, null, 2) + "\n";
}

function main(): void {
  const write = process.argv.includes("--write");
  const all = schemas();
  const drifted: string[] = [];
  if (write && !existsSync(SCHEMA_DIR)) mkdirSync(SCHEMA_DIR, { recursive: true });
  for (const [name, schema] of Object.entries(all)) {
    const path = schemaPath(name);
    const want = schemaBytes(schema);
    if (write) {
      writeFileSync(path, want);
      continue;
    }
    const have = existsSync(path) ? readFileSync(path, "utf8") : null;
    if (have !== want) drifted.push(`docs/api/${name}.schema.json ${have === null ? "is missing" : "does not match the generator"}`);
  }
  if (write) {
    process.stdout.write(`wrote ${Object.keys(all).length} schema(s) to docs/api/\n`);
    return;
  }
  if (drifted.length > 0) {
    process.stderr.write(`api-schemas: ${drifted.length} drifted\n${drifted.map((d) => `  - ${d}`).join("\n")}\n`);
    process.stderr.write("Run: node --experimental-strip-types scripts/api-schemas.ts --write\n");
    process.exitCode = 1;
    return;
  }
  process.stdout.write("api-schemas: docs/api/ matches the generator\n");
}

// Only run the CLI when executed directly, so importing this module from a test is inert.
if (process.argv[1] !== undefined && process.argv[1].endsWith("api-schemas.ts")) main();
