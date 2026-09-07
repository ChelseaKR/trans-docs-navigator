// EN/ES record linkage (FIX-03, docs/ideation/02-large-scale-fixes.md; #229).
//
// THE GAP THIS CLOSES. Every Spanish record is an independent JSON object living in
// `corpus/jurisdictions/spanish.json`, and its English canonical lives in a state file.
// Measured on the corpus as it stands: 344 English records, 344 Spanish records, a clean
// 1:1 match on the `<en-id>.es` id convention, and **nothing anywhere that requires any
// of that**. Add an English record and forget its Spanish twin, delete one side, change a
// record's jurisdiction or its verification status on one side only, and every gate stays
// green. The pairing is correct today by care alone, and care does not fail a build.
//
// That matters more here than the same gap would elsewhere. A Spanish reader who is shown
// a step is shown it with the same confidence an English reader gets; if the two sides
// have silently diverged, the Spanish reader is the one who finds out in a clerk's office.
//
// WHAT IS DELIBERATELY NOT HERE. #229 proposes a schema v2 that adds `canonical_id` and
// `translation_of` fields to every record. This module derives exactly the same linkage
// from the id convention already in the data and enforces it, touching not one record.
// That is on purpose: a half-migrated corpus is worse than an unmigrated one, and the
// honesty value of #229's item (1) is the *enforcement*, not the field. When the schema
// migration lands, `canonicalIdOf` reads the declared field instead of the suffix and
// every invariant below is unchanged.
//
// THE TRANSLATION-STATUS DECLARATION, and why the gate is not "every English record must
// have Spanish". Requiring a twin unconditionally would make adding one English record
// require inventing Spanish for it, which is how a corpus acquires machine-drafted legal
// text nobody has read. So an English record may instead be *declared* untranslated in
// `corpus/translation-status.json`, with a reason. The gap becomes a committed, countable
// fact rather than an absence, and `hasThinnerLanguageCoverage` can read it instead of
// inferring it. A record that is neither translated nor declared fails the gate.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { CorpusRecord, Language } from "./types.ts";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const STATUS_FILE = join(REPO_ROOT, "corpus", "translation-status.json");

/** The suffix a Spanish record's id carries after its English canonical's id. */
export const TRANSLATION_SUFFIX = ".es";

/**
 * Fields a translation must copy from its canonical exactly.
 *
 * These are facts about the world or about this project's own verification state, not
 * about language: which jurisdiction the rule belongs to, which document it concerns,
 * which changes it covers, who it is for, which official form backs it, whether the
 * record is currently serveable, and how long it may go unchecked. A translation that
 * disagrees on any of them is not a translation of that record; it is a second, quieter
 * record making a different claim.
 *
 * `source.url` and `source.title` are deliberately absent. A Spanish record may — and in
 * three places already does — cite the same agency's Spanish-language page, which is
 * better sourcing rather than drift. `sameSourceHost` below keeps that from becoming a
 * licence to cite a different agency.
 */
export const MIRRORED_FIELDS = [
  "jurisdiction",
  "document_type",
  "change_type",
  "verification_status",
  "recheck_sla_days",
  "audience",
  "form_ref",
] as const;

export interface TranslationLink {
  canonicalId: string;
  translationId: string;
}

export interface TranslationIssue {
  recordId: string;
  field: string;
  message: string;
}

/** The English canonical id a Spanish record claims, or `null` if it claims none. */
export function canonicalIdOf(record: Pick<CorpusRecord, "id" | "language">): string | null {
  if (record.language === "en") return null;
  return record.id.endsWith(TRANSLATION_SUFFIX)
    ? record.id.slice(0, -TRANSLATION_SUFFIX.length)
    : null;
}

/** The id a translation of `canonicalId` into `language` must carry. */
export function translationIdFor(canonicalId: string, language: Language): string {
  return language === "en" ? canonicalId : `${canonicalId}.${language}`;
}

function host(url: string): string | null {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Do a canonical and its translation cite the same agency?
 *
 * An unparseable URL on either side is **not** a match. The corpus validator already
 * refuses a malformed source, so reaching this with one means something upstream changed;
 * answering "yes, same host" from two values we could not read would turn a broken URL
 * into a passing check.
 */
export function sameSourceHost(canonical: CorpusRecord, translation: CorpusRecord): boolean {
  const left = host(canonical.source.url);
  const right = host(translation.source.url);
  return left !== null && right !== null && left === right;
}

function fieldValue(record: CorpusRecord, field: (typeof MIRRORED_FIELDS)[number]): string {
  const value = (record as unknown as Record<string, unknown>)[field];
  return value === undefined ? "(unset)" : JSON.stringify(value);
}

/**
 * Every way a canonical and its translation can disagree, named per record.
 *
 * Returns an empty list when the pair is consistent. Never throws: a caller gating a
 * build needs every problem at once, not the first one.
 */
export function twinIssues(canonical: CorpusRecord, translation: CorpusRecord): TranslationIssue[] {
  const issues: TranslationIssue[] = [];
  for (const field of MIRRORED_FIELDS) {
    const left = fieldValue(canonical, field);
    const right = fieldValue(translation, field);
    if (left !== right) {
      issues.push({
        recordId: translation.id,
        field,
        message:
          `disagrees with its English canonical ${canonical.id}: ${left} vs ${right}. ` +
          "This field is a fact about the rule, not about the language, so the two sides " +
          "have drifted.",
      });
    }
  }
  if (canonical.source.last_verified !== translation.source.last_verified) {
    issues.push({
      recordId: translation.id,
      field: "source.last_verified",
      message:
        `is ${translation.source.last_verified} but its English canonical ${canonical.id} ` +
        `is ${canonical.source.last_verified}. A translation inherits verification from ` +
        "the English source check, so the two dates are one fact and must match.",
    });
  }
  if (!sameSourceHost(canonical, translation)) {
    issues.push({
      recordId: translation.id,
      field: "source.url",
      message:
        `cites ${translation.source.url}, a different host from its English canonical ` +
        `${canonical.id} (${canonical.source.url}). Citing the same agency's ` +
        "Spanish-language page is expected and allowed; citing a different agency is not.",
    });
  }
  return issues;
}

export interface TranslationAudit {
  links: TranslationLink[];
  /** English records with no translation and no declared reason for that. */
  undeclaredGaps: string[];
  /** English records declared untranslated, which is a stated gap rather than a failure. */
  declaredGaps: string[];
  /** Declared gaps for records that DO have a translation: a stale declaration. */
  staleDeclarations: string[];
  issues: TranslationIssue[];
}

/**
 * Audit the EN/ES linkage across a whole corpus.
 *
 * `declaredUntranslated` is the set of canonical ids `corpus/translation-status.json`
 * records as deliberately not yet translated. It is checked in both directions: a record
 * that is neither translated nor declared is a gap nobody wrote down, and a declaration
 * for a record that has since been translated is a stale claim about our own coverage.
 * Both fail, because a coverage statement that drifts from the corpus is exactly the
 * thing this file exists to stop.
 */
export function auditTranslations(
  corpus: CorpusRecord[],
  declaredUntranslated: ReadonlySet<string> = new Set(),
): TranslationAudit {
  const english = new Map<string, CorpusRecord>();
  const translations: CorpusRecord[] = [];
  for (const record of corpus) {
    if (record.language === "en") english.set(record.id, record);
    else translations.push(record);
  }

  const issues: TranslationIssue[] = [];
  const links: TranslationLink[] = [];
  const translated = new Set<string>();

  for (const translation of translations.sort((a, b) => a.id.localeCompare(b.id))) {
    const canonicalId = canonicalIdOf(translation);
    if (canonicalId === null) {
      issues.push({
        recordId: translation.id,
        field: "id",
        message:
          `is a ${translation.language} record whose id does not end in ` +
          `"${TRANSLATION_SUFFIX}", so it names no English canonical. A translation that ` +
          "cannot be linked to its source record cannot be kept in step with it.",
      });
      continue;
    }
    const canonical = english.get(canonicalId);
    if (canonical === undefined) {
      issues.push({
        recordId: translation.id,
        field: "id",
        message:
          `names English canonical ${canonicalId}, which is not in the corpus. An ` +
          "orphaned translation is served to Spanish readers with no English record " +
          "behind it, so nothing checks or re-verifies it.",
      });
      continue;
    }
    translated.add(canonicalId);
    links.push({ canonicalId, translationId: translation.id });
    issues.push(...twinIssues(canonical, translation));
  }

  const undeclaredGaps: string[] = [];
  const declaredGaps: string[] = [];
  for (const id of [...english.keys()].sort()) {
    if (translated.has(id)) continue;
    if (declaredUntranslated.has(id)) declaredGaps.push(id);
    else undeclaredGaps.push(id);
  }
  const staleDeclarations = [...declaredUntranslated].filter((id) => translated.has(id)).sort();

  return { links, undeclaredGaps, declaredGaps, staleDeclarations, issues };
}


/**
 * The canonical ids `corpus/translation-status.json` declares untranslated.
 *
 * A missing or malformed file is an EMPTY set, never a permissive one: an unreadable
 * declaration must make the gate stricter, not silently excuse every gap it was supposed
 * to account for. `dir` is injectable so the gate's own tests can point it at a fixture.
 */
export function declaredUntranslated(file: string = STATUS_FILE): ReadonlySet<string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return new Set();
  }
  if (typeof parsed !== "object" || parsed === null) return new Set();
  const raw = (parsed as Record<string, unknown>).untranslated;
  if (!Array.isArray(raw)) return new Set();
  return new Set(raw.filter((id): id is string => typeof id === "string"));
}
