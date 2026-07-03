// Dataset release builder (ROADMAP EXP-08): assembles the corpus into a versioned,
// signed public-dataset bundle — schema, records, verifier roster, and per-jurisdiction
// labels — so a third party can validate a release entirely offline.
//
//   node --experimental-strip-types scripts/dataset-build.ts [outDir]
//   (default outDir: dist/dataset — already git-ignored)
//
// The JSON Schema below is a hand-authored, reviewed mirror of api/types.ts's
// CorpusRecord (deliberately not codegen'd — no new deps, and a human reviews any
// shape change to the released schema same as any other source file). Record
// validation reuses api/corpus.ts's loadCorpus(), the same fail-closed validator the
// `content` gate (scripts/content-validate.ts) runs — a release can never ship a
// record the content gate would have rejected.
//
// labels.json is mechanically derived from `verification_status` counts and the
// `placeholder:true` flag in corpus/VERIFIERS.json — no legal wording is invented
// here; the launch-readiness framing mirrors docs/audits/data-card.md.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { loadCorpus, loadVerifierRoster, isPlaceholderVerifier, REPO_ROOT } from "../api/corpus.ts";
import type { CorpusRecord } from "../api/types.ts";
import { pass, fail } from "./util.ts";

const VERIFIERS_FILE = join(REPO_ROOT, "corpus", "VERIFIERS.json");
const SOURCE_HASHES_FILE = join(REPO_ROOT, "corpus", "source-hashes.json");
const PACKAGE_JSON_FILE = join(REPO_ROOT, "package.json");

const outDir = process.argv[2] ?? join(REPO_ROOT, "dist", "dataset");

// ---------------------------------------------------------------------------
// schema.json — hand-authored JSON Schema for CorpusRecord (api/types.ts).
// ---------------------------------------------------------------------------
const DOCUMENT_TYPES = [
  "court-order",
  "ssa-card",
  "drivers-license",
  "passport",
  "birth-certificate",
  "financial-records",
] as const;
const CHANGE_TYPES = ["name", "gender-marker"] as const;
const VERIFICATION_STATUSES = ["verified", "needs_reverification", "unverified"] as const;
const LANGUAGES = ["en", "es"] as const;

const SCHEMA = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://github.com/ChelseaKR/trans-docs-navigator/dataset/corpus-record.schema.json",
  title: "CorpusRecord",
  description:
    "One citable corpus record: a single requirement/fact for a (jurisdiction x document x " +
    "change) triple. This is the retrieval unit and the citation unit of the Trans Docs " +
    "Navigator corpus. Mirrors api/types.ts:CorpusRecord.",
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "jurisdiction",
    "document_type",
    "change_type",
    "topic",
    "statement",
    "source",
    "verification_status",
    "recheck_sla_days",
    "language",
  ],
  properties: {
    id: { type: "string", minLength: 1 },
    jurisdiction: {
      type: "string",
      pattern: "^US(-[A-Z]{2})?$",
      description: "\"US\" for a federal-level document, or \"US-XX\" for a state.",
    },
    document_type: { type: "string", enum: [...DOCUMENT_TYPES] },
    change_type: {
      type: "array",
      minItems: 1,
      items: { type: "string", enum: [...CHANGE_TYPES] },
    },
    topic: { type: "string", minLength: 1 },
    statement: {
      type: "string",
      minLength: 10,
      description: "The substantive, plain-language claim (~8th-grade readability).",
    },
    detail: { type: "string" },
    cost: {
      type: "object",
      additionalProperties: false,
      required: ["amount_usd"],
      properties: {
        amount_usd: { type: ["number", "null"] },
        note: { type: "string" },
        fee_waiver: { type: "boolean" },
      },
    },
    timeline: {
      type: "object",
      additionalProperties: false,
      required: ["typical"],
      properties: {
        typical: { type: "string" },
        note: { type: "string" },
      },
    },
    prerequisites: { type: "array", items: { type: "string" } },
    discretionary: { type: "boolean" },
    source: {
      type: "object",
      additionalProperties: false,
      required: ["url", "title", "last_verified", "verifier"],
      properties: {
        url: { type: "string", format: "uri", pattern: "^https?://" },
        title: { type: "string", minLength: 1 },
        last_verified: {
          type: "string",
          pattern: "^\\d{4}-\\d{2}-\\d{2}$",
          description: "ISO date a named human last verified the claim against the source.",
        },
        verifier: {
          type: "string",
          minLength: 1,
          not: { const: "UNVERIFIED" },
          description: "The named human verifier; must appear in verifiers.json's roster by exact name.",
        },
      },
    },
    verification_status: {
      type: "string",
      enum: [...VERIFICATION_STATUSES],
      description:
        "verified: a named human confirmed it against the source, within SLA. " +
        "needs_reverification: stale or volatile; never served as current fact. " +
        "unverified: ingested but not yet human-checked; never served.",
    },
    recheck_sla_days: { type: "number", exclusiveMinimum: 0 },
    form_ref: { type: "string" },
    language: { type: "string", enum: [...LANGUAGES] },
  },
} as const;

// ---------------------------------------------------------------------------
// records.json — every corpus record, validated + sorted by id.
// loadCorpus() (no `quarantine`) is fail-closed: it throws on ANY schema/roster
// violation, so reaching the write below means every record already passed the
// same validator the `content` gate runs.
// ---------------------------------------------------------------------------
let records: CorpusRecord[];
try {
  records = [...loadCorpus({ force: true })].sort((a, b) => a.id.localeCompare(b.id));
} catch (e) {
  fail("dataset-build", "corpus failed validation — refusing to publish a release", [(e as Error).message]);
}

// ---------------------------------------------------------------------------
// verifiers.json — copy of the named-verifier roster.
// ---------------------------------------------------------------------------
const verifiersRaw = JSON.parse(readFileSync(VERIFIERS_FILE, "utf8"));

// ---------------------------------------------------------------------------
// labels.json — per-jurisdiction mechanical labeling, derived purely from
// verification_status counts and the roster's placeholder flag. No legal wording
// is authored here; phrasing mirrors docs/audits/data-card.md's factual framing.
// ---------------------------------------------------------------------------
const roster = loadVerifierRoster();
type Label = {
  verified: number;
  needs_reverification: number;
  unverified: number;
  launch_cleared: boolean;
};
const labels: Record<string, Label> = {};
for (const rec of records) {
  const l = (labels[rec.jurisdiction] ??= {
    verified: 0,
    needs_reverification: 0,
    unverified: 0,
    launch_cleared: true,
  });
  l[rec.verification_status]++;
  if (isPlaceholderVerifier(rec.source.verifier, roster)) l.launch_cleared = false;
}

// ---------------------------------------------------------------------------
// manifest.json — version, generation time, source-hash provenance, and a sha256
// of each emitted file (so a third party can validate a release offline).
// ---------------------------------------------------------------------------
const pkg = JSON.parse(readFileSync(PACKAGE_JSON_FILE, "utf8")) as { version: string };
const sourceHashes = JSON.parse(readFileSync(SOURCE_HASHES_FILE, "utf8"));
const version = process.env.DATASET_VERSION ?? process.env.GITHUB_REF_NAME ?? pkg.version;
const generatedAt = process.env.NAV_TODAY
  ? `${process.env.NAV_TODAY}T00:00:00Z`
  : new Date().toISOString();

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

const files: Record<string, string> = {
  "schema.json": JSON.stringify(SCHEMA, null, 2) + "\n",
  "records.json": JSON.stringify(records, null, 2) + "\n",
  "verifiers.json": JSON.stringify(verifiersRaw, null, 2) + "\n",
  "labels.json": JSON.stringify(labels, null, 2) + "\n",
};

const fileHashes: Record<string, string> = {};
for (const [name, content] of Object.entries(files)) fileHashes[name] = sha256(content);

const manifest = {
  version,
  generated_at: generatedAt,
  record_count: records.length,
  source_hashes: sourceHashes,
  files: fileHashes,
};

// ---------------------------------------------------------------------------
// Write the bundle.
// ---------------------------------------------------------------------------
mkdirSync(outDir, { recursive: true });
for (const [name, content] of Object.entries(files)) writeFileSync(join(outDir, name), content, "utf8");
writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");

const unlabeled = Object.values(labels).filter((l) => !l.launch_cleared).length;
pass(
  "dataset-build",
  `wrote ${records.length} record(s) across ${Object.keys(labels).length} jurisdiction(s) to ` +
    `${outDir.replace(REPO_ROOT + "/", "")} (${unlabeled} jurisdiction(s) not launch-cleared — see labels.json)`,
);
