// Checklist engine (M3). Produces a personalized, ordered checklist from the
// corpus — court order → SSA → DMV → passport → birth certificate → financial/records —
// with prerequisites, costs, and timelines drawn only from verified records.

import type {
  Intake,
  Checklist,
  ChecklistStep,
  DocumentType,
  JurisdictionId,
  CorpusRecord,
  Cost,
  Timeline,
} from "./types.ts";
import { loadCorpus } from "./corpus.ts";
import { isCurrent } from "./freshness.ts";
import { selectAudience } from "./retrieval.ts";
// The one place that records how each document travels. Imported rather than restated:
// two lists of "which documents are governed by the state that issued them" would drift,
// and the drift would be silent — a document quietly losing its scope disclosure.
import { PORTABILITY } from "./relocation.ts";
import { t } from "../src/i18n/index.ts";

/** Canonical ordering of documents. Index = order; also the dependency backbone. */
const CANONICAL_ORDER: DocumentType[] = [
  "court-order",
  "ssa-card",
  // Federal immigration/military/employment records (M7) — opt-in only (not in
  // STANDARD_SET below), so they render only when a person selects them. Placed after
  // ssa-card so a declared "court-order" prerequisite is always earlier in this order,
  // and before drivers-license/passport/birth-certificate/financial-records so those
  // five keep their original relative order.
  "green-card",
  "naturalization-certificate",
  "ead",
  "selective-service",
  "military-records",
  "trusted-traveler",
  "federal-employment-records",
  "drivers-license",
  "passport",
  "birth-certificate",
  "financial-records",
];

/**
 * Canonical step titles are the English ones from the locale registry
 * (src/i18n); the view layer localizes display via each bundle's docTitles.
 */
const TITLES: Record<DocumentType, string> = t("en").docTitles;

/** The default set recommended when the user doesn't pick specific documents. */
const STANDARD_SET: DocumentType[] = ["court-order", "ssa-card", "drivers-license", "passport"];

/**
 * Pick the step cost. If multiple backing records declare DIFFERENT costs, don't
 * silently take the first — surface "varies (sources differ)" so the user isn't shown
 * one figure as if it were authoritative.
 */
function pickCost(records: CorpusRecord[]): Cost | undefined {
  const costs = records.map((r) => r.cost).filter((c): c is Cost => !!c);
  if (costs.length === 0) return undefined;
  const distinct = new Set(costs.map((c) => `${c.amount_usd}`));
  if (distinct.size > 1) {
    return { amount_usd: null, note: "varies (sources differ — see each step's source)" };
  }
  return costs[0];
}
function pickTimeline(records: CorpusRecord[]): Timeline | undefined {
  const times = records.map((r) => r.timeline).filter((t): t is Timeline => !!t);
  if (times.length === 0) return undefined;
  const distinct = new Set(times.map((t) => t.typical));
  if (distinct.size > 1) return { typical: "varies", note: "sources differ — see each step's source" };
  return times[0];
}

/**
 * True when the user's language has THINNER coverage than English for this request — i.e.
 * some wanted document has a current English record but none in the user's language. Lets
 * the UI be honest ("full Spanish steps for this state aren't ready yet") instead of
 * silently showing gaps that are really just missing translations.
 */
export function hasThinnerLanguageCoverage(intake: Intake, today?: string, corpus = loadCorpus()): boolean {
  if (intake.language === "en") return false;
  const wanted = intake.documents.length > 0 ? intake.documents : STANDARD_SET;
  const hasCurrent = (doc: DocumentType, lang: Intake["language"]) =>
    corpus.some(
      (r) =>
        r.document_type === doc &&
        (r.jurisdiction === intake.jurisdiction || r.jurisdiction === "US") &&
        r.change_type.some((c) => intake.change_types.includes(c)) &&
        r.language === lang &&
        isCurrent(r, today),
    );
  return wanted.some((doc) => hasCurrent(doc, "en") && !hasCurrent(doc, intake.language));
}

/**
 * True when the corpus holds NO record specific to this jurisdiction — every step we can
 * build for it comes from federal ("US") records instead.
 *
 * This exists because a well-formed but uncovered state (`/checklist?jurisdiction=US-FL`)
 * is accepted by the router, not rejected: `validJurisdiction` only checks the SHAPE of
 * the id. Federal records match every state, so such a request still renders a plausible,
 * confident-looking two-step plan (SSA → passport). Without this flag, "we have nothing
 * for your state" is indistinguishable from "your state requires nothing" — the reader is
 * shown an absence as though it were an answer. Callers use it to say so out loud.
 *
 * Deliberately NOT filtered by language or freshness: a Spanish-only or an expired record
 * still means the state IS in the corpus, and those two axes already have their own honest
 * signals (the thinner-language note and the per-step "needs reverification" flag).
 * Narrowing this predicate would make it fire on states we do cover, which would be its own
 * false alarm.
 */
export function hasNoStateCoverage(jurisdiction: JurisdictionId, corpus = loadCorpus()): boolean {
  // "US" is the federal jurisdiction itself, and it is covered — the federal records ARE
  // its records. Only a state/territory id can be uncovered in the sense meant here.
  if (jurisdiction === "US") return false;
  return !corpus.some((r) => r.jurisdiction === jurisdiction);
}

/**
 * True when the corpus holds NO minor-audience record (api/types.ts `RecordAudience`) for
 * this jurisdiction — i.e. every state outside the minors pilot (California, Illinois, New
 * York, Texas, Washington today). Mirrors `hasNoStateCoverage` exactly, one level narrower:
 * a state can be fully covered for adults (`hasNoStateCoverage` false) and still have no
 * minor guidance at all, and the two absences must stay distinguishable — "we haven't
 * checked this state" is a different, and differently dangerous, gap from "we have adult
 * steps for this state, but nothing that says whether they apply to a minor."
 *
 * Deliberately per-JURISDICTION, not per-document-type: the disclosure this predicate
 * drives (`ui.noMinorCoverage`) says "the steps below are for adults and may not apply",
 * which stays true even where the pilot state happens to cover one document (e.g. a minor
 * court-order name change) but not another (e.g. a passport, which this app never asks a
 * state-specific record for anyway) — the caller still needs to say the caveat once.
 */
export function hasNoMinorCoverage(jurisdiction: JurisdictionId, corpus = loadCorpus()): boolean {
  if (jurisdiction === "US") return false;
  return !corpus.some((r) => r.jurisdiction === jurisdiction && r.audience === "minor");
}

export function buildChecklist(intake: Intake, today?: string, corpus = loadCorpus()): Checklist {
  const wanted = intake.documents.length > 0 ? intake.documents : STANDARD_SET;
  const orderedDocs = CANONICAL_ORDER.filter((d) => wanted.includes(d));

  const steps: ChecklistStep[] = [];
  const gaps: Checklist["gaps"] = [];
  let order = 1;

  for (const doc of orderedDocs) {
    const structural = corpus.filter(
      (r) =>
        r.document_type === doc &&
        (r.jurisdiction === intake.jurisdiction || r.jurisdiction === "US") &&
        r.change_type.some((c) => intake.change_types.includes(c)) &&
        r.language === intake.language,
    );
    // Audience exclusivity (api/retrieval.ts `selectAudience`): a minor query sees ONLY
    // the minor record where one exists for this (jurisdiction × document) cell, never
    // both; everywhere else it falls through to the same adult records a non-minor query
    // sees, disclosed by `hasNoMinorCoverage` rather than hidden.
    const matching = selectAudience(structural, intake.for_minor === true);

    const currentRecords = matching.filter((r) => isCurrent(r, today));
    const degraded = matching.filter((r) => !isCurrent(r, today));

    if (currentRecords.length === 0 && degraded.length === 0) {
      gaps.push({ document_type: doc, reason: "no-records" });
      continue;
    }
    if (currentRecords.length === 0) {
      gaps.push({ document_type: doc, reason: "all-degraded" });
      // Still emit a step so the user sees the gap, flagged.
    }

    // Prerequisites: union of record-declared prereqs (as step keys) that are also in this plan.
    const declaredPrereqs = new Set<string>();
    for (const r of [...currentRecords, ...degraded]) {
      for (const p of r.prerequisites ?? []) declaredPrereqs.add(p);
    }
    const prerequisites = orderedDocs.filter(
      (d) => d !== doc && declaredPrereqs.has(d) && orderedDocs.indexOf(d) < orderedDocs.indexOf(doc),
    );

    // EVERY form declared by the backing records (current first), deduped — not just the
    // first, which silently dropped a form the step's own prose names. A birth-record step
    // routinely needs two (e.g. California VS 24B for the sex field AND VS 23 for the
    // court-ordered name change), and handing over only one is the "told, not handed" bug.
    const formRefs = [
      ...new Set([...currentRecords, ...degraded].map((r) => r.form_ref).filter((f): f is string => !!f)),
    ];

    // has_court_order intake: annotate the court-order step done rather than dropping it
    // (its citations stay visible), and don't leave it counted against the plan cost.
    const done = doc === "court-order" && intake.has_court_order === true;

    steps.push({
      key: doc,
      order: order++,
      document_type: doc,
      title: TITLES[doc],
      record_ids: currentRecords.map((r) => r.id),
      // Citations survive the degrade. `record_ids` still gates every substantive field
      // below, so nothing a lapsed record asserts is rendered; only its source URL is,
      // and only when the step has no current source at all (src/render.ts).
      unverified_record_ids: degraded.map((r) => r.id),
      prerequisites,
      cost: pickCost(currentRecords),
      timeline: pickTimeline(currentRecords),
      discretionary: currentRecords.some((r) => r.discretionary),
      needs_reverification: currentRecords.length === 0 || degraded.length > 0,
      ...(formRefs.length > 0 ? { form_refs: formRefs } : {}),
      ...(done ? { done: true } : {}),
      // A birth record is amended by the state that ISSUED it. This engine resolves every
      // step against the residence jurisdiction, which for a birth certificate is the right
      // state only for someone who never moved. The records are still the residence state's
      // — routing them elsewhere would need a birth state this app deliberately never asks
      // for — but the step now carries the fact that they apply only if that state issued
      // the certificate. Measured on the corpus: 26 of 51 jurisdictions carry no such
      // conditioning in any of their own birth-certificate records' prose, so on those the
      // page said nothing at all about it.
      ...(PORTABILITY[doc] === "state-of-birth" ? { governed_by_issuing_jurisdiction: true } : {}),
    });
  }

  // Prerequisite pruning: once the court-order step is satisfied (already done), it no
  // longer blocks anything — remove it from dependents' prerequisite lists so SSA/DMV/
  // passport/etc. read as immediately actionable instead of gated behind a step the
  // person already completed.
  if (intake.has_court_order) {
    for (const step of steps) {
      if (step.key === "court-order") continue;
      step.prerequisites = step.prerequisites.filter((p) => p !== "court-order");
    }
  }

  return {
    jurisdiction: intake.jurisdiction,
    change_types: intake.change_types,
    language: intake.language,
    steps,
    gaps,
  };
}
