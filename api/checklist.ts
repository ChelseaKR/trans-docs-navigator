// Checklist engine (M3). Produces a personalized, ordered checklist from the
// corpus — court order → SSA → DMV → passport → birth certificate → financial/records —
// with prerequisites, costs, and timelines drawn only from verified records.

import type {
  Intake,
  Checklist,
  ChecklistStep,
  DocumentType,
  CorpusRecord,
  Cost,
  Timeline,
} from "./types.ts";
import { loadCorpus } from "./corpus.ts";
import { isCurrent } from "./freshness.ts";
import { t } from "../src/i18n/index.ts";

/** Canonical ordering of documents. Index = order; also the dependency backbone. */
const CANONICAL_ORDER: DocumentType[] = [
  "court-order",
  "ssa-card",
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

export function buildChecklist(intake: Intake, today?: string, corpus = loadCorpus()): Checklist {
  const wanted = intake.documents.length > 0 ? intake.documents : STANDARD_SET;
  const orderedDocs = CANONICAL_ORDER.filter((d) => wanted.includes(d));

  const steps: ChecklistStep[] = [];
  const gaps: Checklist["gaps"] = [];
  let order = 1;

  for (const doc of orderedDocs) {
    const matching = corpus.filter(
      (r) =>
        r.document_type === doc &&
        (r.jurisdiction === intake.jurisdiction || r.jurisdiction === "US") &&
        r.change_type.some((c) => intake.change_types.includes(c)) &&
        r.language === intake.language,
    );

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

    const formRef = (currentRecords[0] ?? degraded[0])?.form_ref;

    // has_court_order intake: annotate the court-order step done rather than dropping it
    // (its citations stay visible), and don't leave it counted against the plan cost.
    const done = doc === "court-order" && intake.has_court_order === true;

    steps.push({
      key: doc,
      order: order++,
      document_type: doc,
      title: TITLES[doc],
      record_ids: currentRecords.map((r) => r.id),
      prerequisites,
      cost: pickCost(currentRecords),
      timeline: pickTimeline(currentRecords),
      discretionary: currentRecords.some((r) => r.discretionary),
      needs_reverification: currentRecords.length === 0 || degraded.length > 0,
      ...(formRef ? { form_ref: formRef } : {}),
      ...(done ? { done: true } : {}),
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
