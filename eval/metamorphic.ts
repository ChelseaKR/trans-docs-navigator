// Metamorphic property layer (FIX-11).
//
// Point-wise gold checks (eval/gold.ts) assert "this exact query answers this exact
// way." Metamorphic properties instead assert RELATIONS between paired queries —
// invariants that must hold regardless of which retriever seam is plugged into
// answer(). This is what actually gates a retriever swap (ADR-1): a new retriever can
// pass every gold item and still, say, leak a different jurisdiction's citations into
// a filtered query. These properties catch that class of regression.
//
// Deterministic and reproducible, same as the rest of the harness: fixed `today`
// (EVAL_TODAY), no randomness, a fixed hand-authored set of paired base queries whose
// jurisdiction/change-type/document coverage was verified against the corpus (see
// corpus/jurisdictions/*.json) so every pair below is expected to produce non-trivial,
// non-refused citations. Fails CLOSED via runEval()'s report.passed gate — a property
// failure on EITHER retriever fails the whole eval run.

import type { GroundedAnswer } from "../api/types.ts";
import type { RetrievalQuery, Retriever } from "../api/retrieval.ts";
import { answer } from "../api/guidance.ts";
import { EVAL_TODAY } from "./harness.ts";

export interface NamedRetriever {
  name: string;
  retriever: Retriever;
}

export interface MetamorphicResult {
  /** Property name, e.g. "paraphrase-stability". */
  name: string;
  /** Which retriever this run exercised. */
  retrieverName: string;
  passed: boolean;
  detail: string;
}

/** The set of record ids a grounded answer actually cites, sorted for set comparison. */
export function citedIds(ans: GroundedAnswer): string[] {
  return ans.cited_records.map((r) => r.id).sort();
}

function sameSet(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function isSubset(sub: string[], sup: string[]): boolean {
  const s = new Set(sup);
  return sub.every((id) => s.has(id));
}

function isDisjoint(a: string[], b: string[]): boolean {
  const s = new Set(a);
  return b.every((id) => !s.has(id));
}

function ask(retriever: Retriever, query: RetrievalQuery): GroundedAnswer {
  return answer({ ...query, today: EVAL_TODAY }, { retriever });
}

// ── Paired base queries ──────────────────────────────────────────────────────────
// Coverage was verified directly against corpus/jurisdictions/*.json before authoring
// these (see the FIX-11 implementation notes): CA and NY both carry court-order/name
// and drivers-license/name records in EN and ES; CA and IL both carry
// drivers-license/gender-marker; CA and TX both carry court-order/name. Every pair
// below is expected to be non-refused with a non-empty cited set on both retrievers.

interface ParaphrasePair {
  id: string;
  a: RetrievalQuery;
  b: RetrievalQuery;
}

const PARAPHRASE_PAIRS: ParaphrasePair[] = [
  {
    id: "ca-name-court-en",
    a: { jurisdiction: "US-CA", change_types: ["name"], documents: ["court-order"], language: "en", question: "how do I change my name in California" },
    b: { jurisdiction: "US-CA", change_types: ["name"], documents: ["court-order"], language: "en", question: "what is the process to legally change my name through a California court" },
  },
  {
    id: "ny-name-court-en",
    a: { jurisdiction: "US-NY", change_types: ["name"], documents: ["court-order"], language: "en", question: "New York name change publication waiver" },
    b: { jurisdiction: "US-NY", change_types: ["name"], documents: ["court-order"], language: "en", question: "how can I get my New York name change petition without publishing it in the newspaper" },
  },
  {
    id: "ca-name-court-es",
    a: { jurisdiction: "US-CA", change_types: ["name"], documents: ["court-order"], language: "es", question: "cómo cambio mi nombre en California" },
    b: { jurisdiction: "US-CA", change_types: ["name"], documents: ["court-order"], language: "es", question: "cuál es el proceso para cambiar legalmente mi nombre en un tribunal de California" },
  },
];

interface JurisdictionPair {
  id: string;
  base: RetrievalQuery; // jurisdiction is the "a" jurisdiction
  otherJurisdiction: string;
}

const JURISDICTION_PAIRS: JurisdictionPair[] = [
  {
    id: "ca-vs-tx-name-court",
    base: { jurisdiction: "US-CA", change_types: ["name"], documents: ["court-order"], language: "en", question: "name change court process" },
    otherJurisdiction: "US-TX",
  },
  {
    id: "ca-vs-il-gender-marker-dl",
    base: { jurisdiction: "US-CA", change_types: ["gender-marker"], documents: ["drivers-license"], language: "en", question: "gender marker on drivers license" },
    otherJurisdiction: "US-IL",
  },
];

interface FilterPair {
  id: string;
  withoutFilter: RetrievalQuery; // no `documents`
  documents: RetrievalQuery["documents"];
}

const FILTER_PAIRS: FilterPair[] = [
  {
    id: "ca-name-documents-filter",
    withoutFilter: { jurisdiction: "US-CA", change_types: ["name"], language: "en" },
    documents: ["court-order"],
  },
  {
    id: "ny-name-documents-filter",
    withoutFilter: { jurisdiction: "US-NY", change_types: ["name"], language: "en", question: "New York name change process" },
    documents: ["court-order"],
  },
];

interface LanguagePair {
  id: string;
  en: RetrievalQuery;
  es: RetrievalQuery;
}

const LANGUAGE_PAIRS: LanguagePair[] = [
  {
    id: "ca-name-court",
    en: { jurisdiction: "US-CA", change_types: ["name"], documents: ["court-order"], language: "en", question: "how do I change my name in California" },
    es: { jurisdiction: "US-CA", change_types: ["name"], documents: ["court-order"], language: "es", question: "cómo cambio mi nombre en California" },
  },
  {
    id: "ny-name-court",
    en: { jurisdiction: "US-NY", change_types: ["name"], documents: ["court-order"], language: "en", question: "New York name change publication waiver" },
    es: { jurisdiction: "US-NY", change_types: ["name"], documents: ["court-order"], language: "es", question: "cambio de nombre Nueva York publicación" },
  },
];

// ── Properties ───────────────────────────────────────────────────────────────────

function paraphraseStability(retriever: Retriever, retrieverName: string): MetamorphicResult[] {
  return PARAPHRASE_PAIRS.map((p) => {
    const idsA = citedIds(ask(retriever, p.a));
    const idsB = citedIds(ask(retriever, p.b));
    const passed = idsA.length > 0 && sameSet(idsA, idsB);
    return {
      name: `paraphrase-stability:${p.id}`,
      retrieverName,
      passed,
      detail: passed
        ? `both phrasings cite {${idsA.join(", ")}}`
        : `phrasing A cited {${idsA.join(", ")}}, phrasing B cited {${idsB.join(", ")}} — must be equal and non-empty`,
    };
  });
}

function jurisdictionSensitivity(retriever: Retriever, retrieverName: string): MetamorphicResult[] {
  return JURISDICTION_PAIRS.map((p) => {
    const ansA = ask(retriever, p.base);
    const ansB = ask(retriever, { ...p.base, jurisdiction: p.otherJurisdiction });
    // Exclude federal (jurisdiction === "US") records — those legitimately overlap
    // across every state query, so only the STATE-level ids must be disjoint.
    const stateIdsA = ansA.cited_records.filter((r) => r.jurisdiction !== "US").map((r) => r.id).sort();
    const stateIdsB = ansB.cited_records.filter((r) => r.jurisdiction !== "US").map((r) => r.id).sort();
    const passed = stateIdsA.length > 0 && stateIdsB.length > 0 && isDisjoint(stateIdsA, stateIdsB);
    return {
      name: `jurisdiction-sensitivity:${p.id}`,
      retrieverName,
      passed,
      detail: passed
        ? `${p.base.jurisdiction} cited {${stateIdsA.join(", ")}}, ${p.otherJurisdiction} cited {${stateIdsB.join(", ")}} — disjoint`
        : `${p.base.jurisdiction} cited {${stateIdsA.join(", ")}}, ${p.otherJurisdiction} cited {${stateIdsB.join(", ")}} — must be non-empty and disjoint`,
    };
  });
}

function filterMonotonicity(retriever: Retriever, retrieverName: string): MetamorphicResult[] {
  return FILTER_PAIRS.map((p) => {
    const without = citedIds(ask(retriever, p.withoutFilter));
    const withFilter = citedIds(ask(retriever, { ...p.withoutFilter, documents: p.documents }));
    const passed = isSubset(withFilter, without);
    return {
      name: `filter-monotonicity:${p.id}`,
      retrieverName,
      passed,
      detail: passed
        ? `filtered {${withFilter.join(", ")}} ⊆ unfiltered {${without.join(", ")}}`
        : `filtered {${withFilter.join(", ")}} is NOT a subset of unfiltered {${without.join(", ")}} — adding a documents filter added a citation`,
    };
  });
}

/**
 * FIX-03-DEPENDENT: canonical EN↔ES record linkage is not in the corpus yet (each
 * language's records are separate ids, e.g. "ca.court-order.name" vs
 * "ca.court-order.name.es"), so we deliberately do NOT assert equal cited-id sets
 * across languages here. Once FIX-03 lands a canonical id/family field, tighten this
 * to assert citedIds(en) and citedIds(es) resolve to the same canonical family. For
 * now we assert the weaker structural invariant: both languages agree on
 * emptiness/non-emptiness and on WHICH change_types/document_types got cited.
 */
function languageConsistency(retriever: Retriever, retrieverName: string): MetamorphicResult[] {
  return LANGUAGE_PAIRS.map((p) => {
    const ansEn = ask(retriever, p.en);
    const ansEs = ask(retriever, p.es);
    const emptyMatches = (ansEn.cited_records.length === 0) === (ansEs.cited_records.length === 0);

    const shapeOf = (ans: GroundedAnswer) =>
      new Set(ans.cited_records.map((r) => `${r.document_type}|${[...r.change_type].sort().join(",")}`));
    const shapeEn = shapeOf(ansEn);
    const shapeEs = shapeOf(ansEs);
    const sameShape =
      shapeEn.size === shapeEs.size && [...shapeEn].every((k) => shapeEs.has(k));

    const passed = emptyMatches && sameShape;
    return {
      name: `language-consistency:${p.id}`,
      retrieverName,
      passed,
      detail: passed
        ? `EN {${citedIds(ansEn).join(", ")}} and ES {${citedIds(ansEs).join(", ")}} agree on emptiness and document/change-type shape (FIX-03-dependent: not asserting equal id sets)`
        : `EN {${citedIds(ansEn).join(", ")}} and ES {${citedIds(ansEs).join(", ")}} disagree on emptiness or document/change-type shape`,
    };
  });
}

/**
 * Run every metamorphic property against every retriever supplied. Each returned
 * entry is one (property, retriever) pair; the eval harness folds `passed` across
 * all of them into a single fail-closed gate.
 */
export function runMetamorphic(retrievers: NamedRetriever[]): MetamorphicResult[] {
  const results: MetamorphicResult[] = [];
  for (const { name: retrieverName, retriever } of retrievers) {
    results.push(...paraphraseStability(retriever, retrieverName));
    results.push(...jurisdictionSensitivity(retriever, retrieverName));
    results.push(...filterMonotonicity(retriever, retrieverName));
    results.push(...languageConsistency(retriever, retrieverName));
  }
  return results;
}
