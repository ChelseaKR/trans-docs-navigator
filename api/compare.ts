// "Which state?" comparison engine (docs/RELOCATION.md's inverse question).
//
// The relocation planner answers "I'm moving from X to Y, what changes." The more common
// question is the other direction: "I haven't picked a state yet — which ones have a
// documented path for the document/change I need, and which don't?" This file answers
// that, over every jurisdiction at once, from the SAME corpus and the SAME freshness
// rules the checklist and relocation planner already use — it reuses `PORTABILITY` from
// api/relocation.ts rather than re-deriving which jurisdiction governs a document.
//
// ── The rule that matters most here: no editorial ranking ──────────────────────────────
// This module computes a STATUS per cell, never a score, a rank, or a label like "safe"
// or "hostile". `CoverageStatus` (api/types.ts) has exactly four values, each one a fact
// about the CORPUS ("do we have a record, and what kind"), never a claim about the
// jurisdiction. See src/compare.ts for the same discipline applied to copy/labels.
//
// ── Distinguishing "no path" from "not covered" ─────────────────────────────────────────
// A `verified` record can itself assert an ABSENCE — e.g. Texas's own cited source says
// its birth-certificate page "lists no way to change the sex ... to match your gender
// identity." That is a documented fact (the source was read and it says there's no
// route), and it must render differently from a cell where this project simply has not
// found/reviewed a source at all. `describesNoPath()` below is how that distinction is
// detected: a narrow, conservative reading of the record's own `statement` (the
// reviewed, canonical top-line claim — see CorpusRecord's own doc comment), not the
// looser `detail` field, which more often carries hedges/cautions than the core claim.
// It is intentionally biased toward CATCHING a genuine "no path" assertion rather than
// missing one: showing "documented" for a source that actually says there is no route
// is the harmful direction (an absence rendered as an answer); the opposite mistake
// (a cell reads "no path documented" when the record actually describes one, with a
// caveat) is recoverable by the reader clicking through to the record's own text, which
// every cell links to. It was validated by hand against every EN record in the corpus
// at the time this was written (26 true positives, 0 false positives on manual review);
// tests/compare.test.ts pins known examples so a wording drift is caught, not silently
// swallowed.

import type { ChangeType, CorpusRecord, DocumentType, JurisdictionId, CompareCell, CompareRow, CompareTable } from "./types.ts";
import { loadCorpus } from "./corpus.ts";
import { isCurrent } from "./freshness.ts";
import { PORTABILITY } from "./relocation.ts";

/**
 * The 50 states + DC this feature compares. Deliberately a fixed list (like the
 * relocation planner's own picker, src/relocation.ts:RELOCATION_JURISDICTIONS) rather
 * than "whatever jurisdictions happen to be in the corpus right now": a state with
 * nothing yet for a given document/change should still appear as a `not_covered` ROW,
 * not silently disappear from the table. A territory (e.g. US-PR) is out of scope for
 * this comparison, same as the relocation planner's own picker.
 */
export const COMPARE_JURISDICTIONS: JurisdictionId[] = [
  "US-AL", "US-AK", "US-AZ", "US-AR", "US-CA", "US-CO", "US-CT", "US-DE", "US-DC", "US-FL",
  "US-GA", "US-HI", "US-ID", "US-IL", "US-IN", "US-IA", "US-KS", "US-KY", "US-LA", "US-ME",
  "US-MD", "US-MA", "US-MI", "US-MN", "US-MS", "US-MO", "US-MT", "US-NE", "US-NV", "US-NH",
  "US-NJ", "US-NM", "US-NY", "US-NC", "US-ND", "US-OH", "US-OK", "US-OR", "US-PA", "US-RI",
  "US-SC", "US-SD", "US-TN", "US-TX", "US-UT", "US-VT", "US-VA", "US-WA", "US-WV", "US-WI",
  "US-WY",
];

/**
 * Classification is always computed against the ENGLISH record for a cell, even when the
 * page will be shown in Spanish — the same choice api/checklist.ts:hasThinnerLanguageCoverage
 * makes: English is this corpus's authored-in language, Spanish entries are translations
 * of it, so English is the canonical signal for "does a record exist / what does it say".
 * A missing Spanish translation is a presentation gap (the renderer falls back to the
 * English record's citation), never a coverage gap.
 */
const CLASSIFICATION_LANGUAGE = "en";

// ── "Describes no route" detection ──────────────────────────────────────────────────────
// Two branches. BRANCH_NOUN needs an explicit denial ("does not describe/list/offer/
// include/name/find/publish", "cannot", "lists no", "names no", "found no", "makes no
// mention of") followed by a route-shaped noun (way/route/process/path/form/option/
// provision/mechanism/topic/page) followed by an action phrase ("to change", "for
// changing", "to update a nonbinary marker", etc. — up to two filler words are allowed
// between "to/for" and the verb, e.g. "a way to NEWLY change"). BRANCH_DIRECT catches the
// smaller set of records that deny the ACTION directly, with no noun in between
// ("does not let you amend...", "cannot be amended...", "does not update ... to match
// your gender identity").
const ROUTE_NOUN = "(?:way|route|process|path|form|option|provision|mechanism|topic|page)";
const ACTION = "(?:to|for)\\s+(?:\\w+\\s+){0,2}(?:chang\\w*|updat\\w*|correct\\w*|amend\\w*)";
const DENY =
  "(?:does(?:n't| not)|is not|are not|no longer (?:offers|lets|allows)|cannot|" +
  "lists no|names no|found no|makes no mention of|has not published|not published)";
const BRANCH_NOUN = new RegExp(`\\b${DENY}\\b[^.]{0,80}?\\b${ROUTE_NOUN}\\b[^.]{0,40}?\\b${ACTION}\\b`, "i");
const BRANCH_DIRECT = new RegExp(
  "\\bdoes(?:n't| not) let (?:you|someone)\\b[^.]{0,40}?\\b(?:amend|chang\\w*|updat\\w*|correct\\w*)\\b" +
    "|\\bcan(?:not|'t| not) be (?:amend\\w*|chang\\w*|updat\\w*|correct\\w*)\\b" +
    "|\\bdoes(?:n't| not) update\\b[^.]{0,80}?\\bto (?:match|reflect|align)\\b",
  "i",
);

/**
 * True when this record's OWN `statement` asserts that its cited official source
 * describes no route for the document/change it covers — the "source is silent" case,
 * distinct from this project simply not having looked (`not_covered`). See the file
 * header for the detection rationale and its known bias (toward catching a real
 * "no path" assertion rather than missing one).
 */
export function describesNoPath(record: CorpusRecord): boolean {
  return BRANCH_NOUN.test(record.statement) || BRANCH_DIRECT.test(record.statement);
}

/** Which jurisdiction's records answer "can THIS state's resident do this" for a
 *  document — reuses api/relocation.ts's PORTABILITY rather than re-deriving it. A
 *  federal document (SSA card, passport) is governed by the SAME record everywhere, so
 *  every state's cell for it resolves to the federal ("US") record; every other
 *  document is governed by the state's own record, directly — there is no "move" here
 *  to resolve an origin/destination through. */
function governingJurisdiction(doc: DocumentType, state: JurisdictionId): JurisdictionId {
  return PORTABILITY[doc] === "federal" ? "US" : state;
}

/** Records for one (jurisdiction × document × change) cell, in the classification language. */
function recordsFor(corpus: CorpusRecord[], jurisdiction: JurisdictionId, doc: DocumentType, change: ChangeType): CorpusRecord[] {
  return corpus.filter(
    (r) =>
      r.jurisdiction === jurisdiction &&
      r.document_type === doc &&
      r.change_type.includes(change) &&
      r.language === CLASSIFICATION_LANGUAGE,
  );
}

/**
 * Classify one cell. Mirrors api/checklist.ts's own `needs_reverification` formula
 * (`currentRecords.length === 0 || degraded.length > 0`) so the same facts read the
 * same way on both surfaces: a cell backed ONLY by degraded records, or by a mix of
 * current and degraded ones, both read `needs_reverification`.
 */
export function classifyCell(
  corpus: CorpusRecord[],
  jurisdiction: JurisdictionId,
  doc: DocumentType,
  change: ChangeType,
  today?: string,
): CompareCell {
  const matching = recordsFor(corpus, jurisdiction, doc, change);
  if (matching.length === 0) {
    return { jurisdiction, document_type: doc, change_type: change, status: "not_covered", record_ids: [] };
  }

  const ids = matching.map((r) => r.id);
  if (matching.some(describesNoPath)) {
    return { jurisdiction, document_type: doc, change_type: change, status: "no_path_documented", record_ids: ids };
  }

  const current = matching.filter((r) => isCurrent(r, today));
  const degraded = matching.filter((r) => !isCurrent(r, today));
  const status = current.length === 0 || degraded.length > 0 ? "needs_reverification" : "documented";
  return { jurisdiction, document_type: doc, change_type: change, status, record_ids: ids };
}

/**
 * Default documents when the caller (the /compare form) selected none: the three
 * document types whose governing jurisdiction is the state itself (court order,
 * driver's license, birth certificate) — the ones a "which state" comparison actually
 * differentiates on. SSA card and passport are federal (api/relocation.ts:PORTABILITY),
 * so every state's cell for them is identical; a person can still select them
 * explicitly, but they are not the useful default for THIS question.
 */
export const DEFAULT_COMPARE_DOCUMENTS: DocumentType[] = ["court-order", "drivers-license", "birth-certificate"];
export const DEFAULT_COMPARE_CHANGES: ChangeType[] = ["name", "gender-marker"];

export interface CompareInput {
  /** Empty defaults to DEFAULT_COMPARE_DOCUMENTS — mirrors api/checklist.ts's STANDARD_SET default. */
  documents: DocumentType[];
  /** Empty defaults to DEFAULT_COMPARE_CHANGES (both) — mirrors buildRelocationPlan/buildChecklist. */
  change_types: ChangeType[];
  /** Row universe override — tests only; production always compares COMPARE_JURISDICTIONS. */
  jurisdictions?: JurisdictionId[];
}

/**
 * Build the full comparison table: one row per jurisdiction, one cell per (document ×
 * change) pair requested, ordered documents-major (all of one document's change-type
 * columns are adjacent) so a reader scanning one document's column doesn't have to hunt
 * across the row. Pure and injectable, like buildRelocationPlan.
 */
export function buildCompareTable(input: CompareInput, today?: string, corpus = loadCorpus()): CompareTable {
  const jurisdictions = input.jurisdictions ?? COMPARE_JURISDICTIONS;
  const documents = input.documents.length > 0 ? input.documents : DEFAULT_COMPARE_DOCUMENTS;
  const changeTypes = input.change_types.length > 0 ? input.change_types : DEFAULT_COMPARE_CHANGES;
  const rows: CompareRow[] = jurisdictions.map((jurisdiction) => {
    const cells: CompareCell[] = [];
    for (const doc of documents) {
      const governing = governingJurisdiction(doc, jurisdiction);
      for (const change of changeTypes) {
        cells.push(classifyCell(corpus, governing, doc, change, today));
      }
    }
    return { jurisdiction, cells };
  });
  return { documents, change_types: changeTypes, rows };
}

/** Count of a row's cells whose status affirmatively documents a path (current or
 *  needing reverification) — "number of documented paths", a count, never a rank. */
export function documentedPathCount(row: CompareRow): number {
  return row.cells.filter((c) => c.status === "documented" || c.status === "needs_reverification").length;
}
