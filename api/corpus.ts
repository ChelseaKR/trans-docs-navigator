// Corpus loader + schema validation.
// The corpus is version-controlled structured JSON under corpus/jurisdictions/.
// Validation here is the single source of truth used by both the runtime and the
// content-validation CI gate (scripts/content-validate.ts).

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type {
  CorpusRecord,
  DocumentType,
  ChangeType,
  VerificationStatus,
  Language,
} from "./types.ts";
import { computeCorpusManifest, manifestPath } from "../scripts/corpus-manifest.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(HERE, "..");
const CORPUS_DIR = join(REPO_ROOT, "corpus", "jurisdictions");
const VERIFIERS_FILE = join(REPO_ROOT, "corpus", "VERIFIERS.json");

const DOCUMENT_TYPES: readonly DocumentType[] = [
  "court-order",
  "ssa-card",
  "drivers-license",
  "passport",
  "birth-certificate",
  "financial-records",
];
const CHANGE_TYPES: readonly ChangeType[] = ["name", "gender-marker"];
const VERIFICATION_STATUSES: readonly VerificationStatus[] = [
  "verified",
  "needs_reverification",
  "unverified",
];
const LANGUAGES: readonly Language[] = ["en", "es"];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Real ISO calendar date — format AND a valid day (rejects e.g. 2099-13-45). */
export function isValidIsoDate(d: unknown): boolean {
  if (typeof d !== "string" || !ISO_DATE.test(d)) return false;
  const dt = new Date(d + "T00:00:00Z");
  return !Number.isNaN(dt.getTime()) && dt.toISOString().slice(0, 10) === d;
}

export interface ValidationIssue {
  recordId: string;
  field: string;
  message: string;
}

export interface VerifierEntry {
  name: string;
  role?: string;
  affiliation?: string;
  /** True for illustrative seed reviewers; records they verify are never launch-cleared. */
  placeholder?: boolean;
  note?: string;
}

let ROSTER_CACHE: Map<string, VerifierEntry> | null = null;

/** Load the named-verifier roster (corpus/VERIFIERS.json). Cached per process. */
export function loadVerifierRoster(file: string = VERIFIERS_FILE): Map<string, VerifierEntry> {
  if (ROSTER_CACHE && file === VERIFIERS_FILE) return ROSTER_CACHE;
  const parsed = JSON.parse(readFileSync(file, "utf8")) as { roster?: VerifierEntry[] };
  const map = new Map<string, VerifierEntry>();
  for (const e of parsed.roster ?? []) {
    if (e && typeof e.name === "string") map.set(e.name, e);
  }
  if (file === VERIFIERS_FILE) ROSTER_CACHE = map;
  return map;
}

/** True when this verifier is an illustrative placeholder (not a real human verification). */
export function isPlaceholderVerifier(name: string, roster = loadVerifierRoster()): boolean {
  return roster.get(name)?.placeholder === true;
}

/**
 * Roster check, applied at corpus-load time (kept out of the pure schema validator so
 * unit tests can exercise validateRecord with ad-hoc verifiers). Every record's
 * source.verifier must appear by exact name in corpus/VERIFIERS.json.
 */
function verifierIssues(rec: unknown, roster: Map<string, VerifierEntry>): ValidationIssue[] {
  if (!isObj(rec) || !isObj(rec.source)) return [];
  const id = typeof rec.id === "string" ? rec.id : "?";
  const verifier = rec.source.verifier;
  if (typeof verifier !== "string" || verifier.length === 0) return []; // schema validator already flags this
  if (!roster.has(verifier)) {
    return [{ recordId: id, field: "source.verifier", message: `verifier "${verifier}" is not in corpus/VERIFIERS.json roster` }];
  }
  return [];
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Validate one parsed record. Returns the list of issues (empty = valid). */
export function validateRecord(raw: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isObj(raw)) {
    return [{ recordId: "?", field: "(root)", message: "record is not an object" }];
  }
  const id = typeof raw.id === "string" ? raw.id : "?";
  const push = (field: string, message: string) => issues.push({ recordId: id, field, message });

  if (typeof raw.id !== "string" || raw.id.length === 0) push("id", "missing/empty");
  if (typeof raw.jurisdiction !== "string" || !/^US(-[A-Z]{2})?$/.test(raw.jurisdiction as string))
    push("jurisdiction", "must match US or US-XX");
  if (!DOCUMENT_TYPES.includes(raw.document_type as DocumentType))
    push("document_type", `must be one of ${DOCUMENT_TYPES.join(", ")}`);
  if (
    !Array.isArray(raw.change_type) ||
    raw.change_type.length === 0 ||
    !(raw.change_type as unknown[]).every((c) => CHANGE_TYPES.includes(c as ChangeType))
  )
    push("change_type", "must be a non-empty array of name|gender-marker");
  if (typeof raw.topic !== "string" || raw.topic.length === 0) push("topic", "missing/empty");
  if (typeof raw.statement !== "string" || raw.statement.trim().length < 10)
    push("statement", "missing or too short to be a substantive claim");

  // Source (guardrail #1: no claim without a citation).
  if (!isObj(raw.source)) {
    push("source", "missing source block — every claim must carry provenance");
  } else {
    const s = raw.source;
    if (typeof s.url !== "string" || !/^https?:\/\//.test(s.url as string))
      push("source.url", "must be an http(s) URL");
    if (typeof s.title !== "string" || (s.title as string).length === 0)
      push("source.title", "missing/empty");
    if (!isValidIsoDate(s.last_verified))
      push("source.last_verified", "must be a real ISO calendar date YYYY-MM-DD");
    if (typeof s.verifier !== "string" || (s.verifier as string).length === 0)
      push("source.verifier", "missing/empty");
    if (s.verifier === "UNVERIFIED")
      push("source.verifier", "literal 'UNVERIFIED' may not render; set verification_status instead");
  }

  if (!VERIFICATION_STATUSES.includes(raw.verification_status as VerificationStatus))
    push("verification_status", `must be one of ${VERIFICATION_STATUSES.join(", ")}`);
  if (typeof raw.recheck_sla_days !== "number" || (raw.recheck_sla_days as number) <= 0)
    push("recheck_sla_days", "must be a positive number of days");
  if (!LANGUAGES.includes(raw.language as Language))
    push("language", `must be one of ${LANGUAGES.join(", ")}`);

  if (raw.cost !== undefined) {
    if (!isObj(raw.cost)) push("cost", "must be an object");
    else if (raw.cost.amount_usd === null && typeof raw.cost.note !== "string")
      push("cost.note", "a null amount must carry a note explaining the variability");
  }
  if (raw.prerequisites !== undefined && !Array.isArray(raw.prerequisites))
    push("prerequisites", "must be an array of ids/step keys");

  return issues;
}

let CACHE: CorpusRecord[] | null = null;

/** Issues from the most recent quarantine load — for runtime alarming. */
export let LAST_QUARANTINE: ValidationIssue[] = [];

/**
 * Load + validate every record.
 * - Default (CI / fail-closed): throws on ANY schema violation — a bad corpus must
 *   never ship; the content gate relies on this.
 * - `quarantine: true` (runtime / fail-degraded): a single malformed record is dropped
 *   (recorded in LAST_QUARANTINE for alarming) and the rest still serve, so one bad
 *   edit can't take the whole service down. Still loud — never silent.
 */
export function loadCorpus(opts: { force?: boolean; dir?: string; quarantine?: boolean } = {}): CorpusRecord[] {
  const dir = opts.dir ?? CORPUS_DIR;
  const useCache = !opts.dir; // a custom dir is never cached (test-only path)
  if (CACHE && useCache && !opts.force) return CACHE;
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  const roster = loadVerifierRoster();
  const records: CorpusRecord[] = [];
  const allIssues: ValidationIssue[] = [];
  const seenIds = new Set<string>();

  for (const file of files) {
    const parsed: unknown = JSON.parse(readFileSync(join(dir, file), "utf8"));
    const list = Array.isArray(parsed) ? parsed : [parsed];
    for (const raw of list) {
      const issues = [...validateRecord(raw), ...verifierIssues(raw, roster)];
      if (issues.length === 0) {
        const rec = raw as CorpusRecord;
        if (seenIds.has(rec.id)) allIssues.push({ recordId: rec.id, field: "id", message: "duplicate id" });
        else {
          seenIds.add(rec.id);
          records.push(rec);
        }
      } else {
        allIssues.push(...issues);
      }
    }
  }
  if (allIssues.length > 0 && !opts.quarantine) {
    const detail = allIssues.map((i) => `  ${i.recordId} · ${i.field}: ${i.message}`).join("\n");
    throw new Error(`Corpus validation failed (${allIssues.length} issue(s)):\n${detail}`);
  }
  LAST_QUARANTINE = opts.quarantine ? allIssues : [];
  // Cache the valid record set in both modes (a fail-closed load with issues already
  // threw above, so reaching here means the records are safe to serve).
  if (useCache) CACHE = records;
  return records;
}

/** Validate without throwing — used by the content gate to report all issues. */
export function validateCorpus(dir: string = CORPUS_DIR): {
  records: number;
  issues: ValidationIssue[];
  /** Count of records verified only by a placeholder reviewer (mechanically valid, never launch-cleared). */
  placeholderVerified: number;
} {
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  const roster = loadVerifierRoster();
  const issues: ValidationIssue[] = [];
  const seenIds = new Set<string>();
  let count = 0;
  let placeholderVerified = 0;
  for (const file of files) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(join(dir, file), "utf8"));
    } catch (e) {
      issues.push({ recordId: file, field: "(json)", message: `parse error: ${(e as Error).message}` });
      continue;
    }
    const list = Array.isArray(parsed) ? parsed : [parsed];
    for (const raw of list) {
      count++;
      issues.push(...validateRecord(raw), ...verifierIssues(raw, roster));
      if (isObj(raw) && isObj(raw.source) && typeof raw.source.verifier === "string" && isPlaceholderVerifier(raw.source.verifier, roster)) {
        placeholderVerified++;
      }
      if (isObj(raw) && typeof raw.id === "string") {
        if (seenIds.has(raw.id)) issues.push({ recordId: raw.id, field: "id", message: "duplicate id" });
        seenIds.add(raw.id);
      }
    }
  }
  return { records: count, issues, placeholderVerified };
}

export function recordById(id: string, corpus = loadCorpus()): CorpusRecord | undefined {
  return corpus.find((r) => r.id === id);
}

export interface CorpusIntegrityResult {
  ok: boolean;
  status: "absent" | "valid" | "mismatch" | "invalid";
  /** Digest baked into corpus.manifest.json at build time. `null` if the file is absent. */
  expected: string | null;
  /** Digest recomputed live from the corpus/forms files on disk right now. */
  actual: string;
}

/**
 * Corpus integrity attestation (FIX-09 §A): recompute the live corpus hash and compare
 * it against the digest baked into corpus.manifest.json at build/image time. A
 * mismatch means the corpus-backed content being served right now is not the content
 * the image was built and gated on — the caller (api/server.ts) loudly quarantines
 * rather than serving corpus-backed routes.
 *
 * An absent manifest (the normal case in local dev, where nothing runs
 * `npm run corpus:manifest`) is distinguished from an invalid manifest. That distinction
 * is security-significant: malformed build metadata must fail closed at startup, while
 * a genuinely absent local-development artifact remains allowed.
 */
export function verifyCorpusManifest(opts: { repoRoot?: string } = {}): CorpusIntegrityResult {
  const repoRoot = opts.repoRoot ?? REPO_ROOT;
  const actual = computeCorpusManifest(repoRoot).hash;
  const path = manifestPath(repoRoot);
  if (!existsSync(path)) {
    return { ok: true, status: "absent", expected: null, actual };
  }
  let expected: string | null = null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as { hash?: unknown };
    expected = typeof parsed.hash === "string" ? parsed.hash : null;
  } catch {
    expected = null;
  }
  if (expected === null) return { ok: false, status: "invalid", expected: null, actual };
  const ok = expected === actual;
  return { ok, status: ok ? "valid" : "mismatch", expected, actual };
}
