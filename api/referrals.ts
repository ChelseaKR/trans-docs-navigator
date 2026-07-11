// Legal-aid / official referral loader + schema validation.
//
// Referrals (legal-aid orgs, official self-help resources) are cited records that ride
// the SAME verifier gate as the corpus (api/corpus.ts) — a named verifier in
// corpus/VERIFIERS.json, an http(s) source, a real ISO last_verified date — but they are
// NOT corpus facts: they carry no document_type/change_type/statement, so they are kept
// as a sibling record type (ReferralRecord, api/types.ts) rather than extending
// CorpusRecord's document_type enum. This keeps the existing corpus schema untouched.
//
// Mirrors api/corpus.ts's load/validate split so both files stay easy to read side by
// side: a pure schema validator (validateRecord) plus a roster check (verifierIssues)
// that's kept separate so unit tests can exercise validateRecord with ad-hoc verifiers.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT, loadVerifierRoster, isValidIsoDate, type VerifierEntry } from "./corpus.ts";
import type { ReferralRecord, VerificationStatus, Language, JurisdictionId } from "./types.ts";

const REFERRALS_DIR = join(REPO_ROOT, "corpus", "referrals");

const VERIFICATION_STATUSES: readonly VerificationStatus[] = [
  "verified",
  "needs_reverification",
  "unverified",
];
const LANGUAGES: readonly Language[] = ["en", "es"];

export interface ValidationIssue {
  recordId: string;
  field: string;
  message: string;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Roster check, applied at load time (kept out of the pure schema validator so unit
 * tests can exercise validateRecord with ad-hoc verifiers) — same pattern as
 * api/corpus.ts. Every referral's source.verifier must appear by exact name in
 * corpus/VERIFIERS.json.
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

/** Validate one parsed referral record. Returns the list of issues (empty = valid). */
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
  if (typeof raw.name !== "string" || raw.name.length === 0) push("name", "missing/empty");
  if (typeof raw.url !== "string" || !/^https?:\/\//.test(raw.url as string))
    push("url", "must be an http(s) URL");

  if (!isObj(raw.note)) {
    push("note", "missing note block — must carry en and es text");
  } else {
    const note = raw.note;
    for (const lang of LANGUAGES) {
      if (typeof note[lang] !== "string" || (note[lang] as string).length === 0)
        push(`note.${lang}`, "missing/empty");
    }
  }

  // Source (same guardrail as the corpus: no referral without a citation for why it's listed).
  if (!isObj(raw.source)) {
    push("source", "missing source block — every referral must carry provenance");
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

  return issues;
}

let CACHE: ReferralRecord[] | null = null;

/**
 * Load + validate every referral record. Fails closed (throws) on ANY schema
 * violation, same as loadCorpus — a bad referral must never ship.
 */
export function loadReferrals(opts: { force?: boolean; dir?: string } = {}): ReferralRecord[] {
  const dir = opts.dir ?? REFERRALS_DIR;
  const useCache = !opts.dir;
  if (CACHE && useCache && !opts.force) return CACHE;
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  const roster = loadVerifierRoster();
  const records: ReferralRecord[] = [];
  const allIssues: ValidationIssue[] = [];
  const seenIds = new Set<string>();

  for (const file of files) {
    const parsed: unknown = JSON.parse(readFileSync(join(dir, file), "utf8"));
    const list = Array.isArray(parsed) ? parsed : [parsed];
    for (const raw of list) {
      const issues = [...validateRecord(raw), ...verifierIssues(raw, roster)];
      if (issues.length === 0) {
        const rec = raw as ReferralRecord;
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
  if (allIssues.length > 0) {
    const detail = allIssues.map((i) => `  ${i.recordId} · ${i.field}: ${i.message}`).join("\n");
    throw new Error(`Referral validation failed (${allIssues.length} issue(s)):\n${detail}`);
  }
  if (useCache) CACHE = records;
  return records;
}

/** Validate without throwing — used by the content gate to report all issues. */
export function validateReferrals(dir: string = REFERRALS_DIR): {
  records: number;
  issues: ValidationIssue[];
} {
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  const roster = loadVerifierRoster();
  const issues: ValidationIssue[] = [];
  const seenIds = new Set<string>();
  let count = 0;
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
      if (isObj(raw) && typeof raw.id === "string") {
        if (seenIds.has(raw.id)) issues.push({ recordId: raw.id, field: "id", message: "duplicate id" });
        seenIds.add(raw.id);
      }
    }
  }
  return { records: count, issues };
}

/** Referrals for a jurisdiction, including federal ("US") referrals alongside any state-specific ones. */
export function referralsFor(jurisdiction: JurisdictionId, referrals = loadReferrals()): ReferralRecord[] {
  return referrals.filter((r) => r.jurisdiction === jurisdiction || r.jurisdiction === "US");
}
