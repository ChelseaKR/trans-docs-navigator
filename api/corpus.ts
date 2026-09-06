// Corpus loader + schema validation.
// The corpus is version-controlled structured JSON under corpus/jurisdictions/.
// Validation here is the single source of truth used by both the runtime and the
// content-validation CI gate (scripts/content-validate.ts).

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { clearAllCaches } from "./cache.ts";
import type {
  CorpusRecord,
  DocumentType,
  ChangeType,
  RecordAudience,
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
const RECORD_AUDIENCES: readonly RecordAudience[] = ["adult", "minor"];
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

/**
 * Drop the default verifier roster cache when the default corpus is explicitly or
 * watch-reloaded. Keeping this separate from the general render-cache registry is
 * important: the roster is an input to corpus validation, not a derived page value.
 */
function clearVerifierRosterCache(): void {
  ROSTER_CACHE = null;
}

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

/**
 * Where-you-live phrases, per language. A record may only claim `relocation.residency_bound`
 * if its OWN cited prose says the action happens where the person lives — the annotation
 * must be readable straight off the source that is already on the page, never asserted
 * about it. Anything else would be a new, uncited legal claim smuggled in as metadata.
 */
const RESIDENCY_PHRASES: Record<Language, RegExp> = {
  en: /where you live|county where you (?:live|reside)|where you reside/i,
  es: /donde (?:usted )?(?:vive|reside)|condado donde (?:usted )?(?:vive|reside)/i,
};

/**
 * Validate the optional relocation annotation (api/types.ts:RelocationTraits). Fails closed:
 * an unknown key, a non-boolean flag, or a `residency_bound: true` that the record's own
 * text does not support is a content violation, not a warning.
 */
function relocationIssues(raw: Record<string, unknown>, push: (f: string, m: string) => void): void {
  const rel = raw.relocation;
  if (rel === undefined) return;
  if (!isObj(rel)) {
    push("relocation", "must be an object");
    return;
  }
  for (const k of Object.keys(rel)) {
    if (k !== "residency_bound") push(`relocation.${k}`, "unknown relocation trait");
  }
  if (rel.residency_bound === undefined) return;
  if (typeof rel.residency_bound !== "boolean") {
    push("relocation.residency_bound", "must be a boolean");
    return;
  }
  if (rel.residency_bound !== true) return;

  const lang = raw.language as Language;
  const re = RESIDENCY_PHRASES[lang];
  if (!re) return; // an invalid language is already flagged by the schema check
  const prose = `${typeof raw.statement === "string" ? raw.statement : ""} ${typeof raw.detail === "string" ? raw.detail : ""}`;
  if (!re.test(prose)) {
    push(
      "relocation.residency_bound",
      "asserted true, but the record's own statement/detail never says the action happens where you live — " +
        "the annotation may only restate what the cited source already says",
    );
  }
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

  if (raw.audience !== undefined && !RECORD_AUDIENCES.includes(raw.audience as RecordAudience))
    push("audience", `must be one of ${RECORD_AUDIENCES.join(", ")} when present`);

  relocationIssues(raw, push);

  return issues;
}

let CACHE: CorpusRecord[] | null = null;
// mtime (ms) captured when CACHE was last built, for the dev-ergonomics watch below.
let CACHE_VERSION: string | null = null;

/** Issues from the most recent quarantine load — for runtime alarming. */
export let LAST_QUARANTINE: ValidationIssue[] = [];

/**
 * Dev-ergonomics watch gate (IP §5.2): production keeps the zero-syscall process-lifetime
 * cache; dev (or CORPUS_WATCH=1) pays one extra stat-per-call so editing the corpus on
 * disk is picked up without a server restart.
 */
function corpusWatchEnabled(): boolean {
  return process.env.CORPUS_WATCH === "1" || process.env.NODE_ENV !== "production";
}

/**
 * Cheap version signature across every corpus file and the verifier roster. Tracking
 * each file's mtime and size (rather than only the newest mtime) catches edits to an
 * older file, backwards timestamp changes after a checkout, additions, and removals.
 */
function corpusVersion(dir: string): string {
  const files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  const entries = files.map((file) => {
    const stat = statSync(join(dir, file));
    return `${file}:${stat.mtimeMs}:${stat.size}`;
  });
  const roster = statSync(VERIFIERS_FILE);
  entries.push(`VERIFIERS.json:${roster.mtimeMs}:${roster.size}`);
  return entries.join("|");
}

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
  let force = opts.force === true;

  if (!useCache || force) {
    // A custom dir bypasses the process cache entirely, and an explicit force reload
    // both start fresh — neither should carry a stale watch baseline forward.
    CACHE_VERSION = null;
    if (useCache && force) {
      clearVerifierRosterCache();
      clearAllCaches();
    }
  } else if (CACHE && corpusWatchEnabled()) {
    // On each cached call, check whether the corpus changed on disk since CACHE was
    // built; if so, force a reload AND drop every cache derived from it (answers,
    // checklist HTML — api/router.ts) so stale renders can't survive a corpus edit.
    const current = corpusVersion(dir);
    if (CACHE_VERSION !== null && current !== CACHE_VERSION) {
      force = true;
      clearVerifierRosterCache();
      clearAllCaches();
    }
  }

  if (CACHE && useCache && !force) return CACHE;
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
  if (useCache) {
    CACHE = records;
    CACHE_VERSION = corpusWatchEnabled() ? corpusVersion(dir) : null;
  }
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
 * `npm run corpus:manifest`) is distinguished from an invalid manifest. The pure
 * `corpusIntegrityAllowsStartup` policy below permits that absence only for explicitly
 * declared development/test processes; production and undeclared environments fail closed.
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

/**
 * Pure startup policy for the corpus attestation. A missing manifest is permitted only
 * in an explicitly declared development/test process. Production and undeclared
 * environments fail closed, so deleting a baked manifest cannot bypass attestation.
 */
export function corpusIntegrityAllowsStartup(
  result: CorpusIntegrityResult,
  nodeEnv: string | undefined,
): boolean {
  if (result.status !== "absent") return result.ok;
  return nodeEnv === "development" || nodeEnv === "test";
}

/**
 * True only when a record's claim was verified by a REAL named human: the verifier
 * must exist in the roster and must not be a placeholder entry. Seed/placeholder
 * reviewers (roster `placeholder: true`) must never read as verification in any
 * user-facing surface — a source link plus a date next to a placeholder name is
 * exactly the false-assurance shape the methodology page warns about.
 */
export function isHumanVerified(
  verifier: string,
  roster: Map<string, VerifierEntry> = loadVerifierRoster(),
): boolean {
  const entry = roster.get(verifier);
  return entry !== undefined && entry.placeholder !== true;
}

/** Count of records whose source.verifier is a real (non-placeholder) roster human. */
export function humanVerifiedCount(
  records: ReadonlyArray<{ source: { verifier: string } }>,
  roster: Map<string, VerifierEntry> = loadVerifierRoster(),
): number {
  return records.reduce((n, r) => n + (isHumanVerified(r.source.verifier, roster) ? 1 : 0), 0);
}
