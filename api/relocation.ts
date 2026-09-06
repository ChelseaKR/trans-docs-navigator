// Relocation planner — the destination-delta engine (docs/RELOCATION.md).
//
// Existing tools stop at a risk RATING for a state. This turns "I am moving from Texas to
// Washington, and I hold a court order and a license" into an ordered, costed, cited plan:
// what the move leaves alone, what the destination re-issues on its own terms, in what
// order, what it costs, and which doors close the day you stop being a resident of the
// origin state.
//
// ── The one rule this file exists to keep ───────────────────────────────────────────
// The engine COMPOSES; it never AUTHORS. Every substantive sentence a user reads comes
// out of a corpus record's own `statement`/`detail`, carrying that record's id, source
// and last-verified date — exactly as api/checklist.ts already does. What this file adds
// is STRUCTURE over those records (which jurisdiction's records apply, in what order,
// what they sum to). Structure is not a legal claim, so it needs no citation; the moment
// structure would have to become a legal claim ("your Texas order is valid in
// Washington"), the engine says it does not know instead. See `unknown` / `keep-from-origin`
// below and docs/RELOCATION.md §"What the engine will not say".
//
// `relocationAnswer()` at the bottom pushes every plan through the SAME citation.enforce()
// gate as /answer, so an uncited claim in a relocation plan cannot render — structurally,
// not by convention. scripts/citation-coverage.ts exercises it across every state pair.

import type {
  ChangeType,
  CorpusRecord,
  Cost,
  CostLine,
  CostModel,
  DocumentType,
  GroundedAnswer,
  AnswerBlock,
  JurisdictionId,
  OrderingHazard,
  Portability,
  RelocationIntake,
  RelocationPhase,
  RelocationPlan,
  RelocationStep,
  StepClass,
  Timeline,
} from "./types.ts";
import { loadCorpus } from "./corpus.ts";
import { isCurrent } from "./freshness.ts";
import { selectAudience } from "./retrieval.ts";
import { enforce } from "./citation.ts";
import { t } from "../src/i18n/index.ts";

/**
 * How each document travels. DEFINITIONAL — what kind of thing the document is, not a
 * rule about what anyone must do. It decides only which jurisdiction's records the engine
 * reads for a step; no user-visible sentence is generated from it. (Same class as
 * api/checklist.ts's CANONICAL_ORDER, which is likewise taxonomy, not law.)
 */
export const PORTABILITY: Record<DocumentType, Portability> = {
  "court-order": "state-of-record",
  "ssa-card": "federal",
  "drivers-license": "state-of-residence",
  passport: "federal",
  // A birth certificate is held by the state you were BORN in, not the state you live in and
  // not the state you are leaving. Moving does not move it, and moving does not give the
  // destination the power to re-issue it. That asymmetry is the whole reason this class exists.
  "birth-certificate": "state-of-birth",
  "financial-records": "non-government",
  // Federal immigration/military/employment records (M7). All are federal authority —
  // the same records govern wherever the person lives, exactly like the SSA card and
  // passport above. None of these are asked about on the relocation intake today (they
  // are not in CANONICAL_ORDER/DEFAULT_SET below), so this entry exists only to satisfy
  // this map's exhaustive typing over DocumentType — it never changes a rendered plan.
  "green-card": "federal",
  "naturalization-certificate": "federal",
  ead: "federal",
  "selective-service": "federal",
  "military-records": "federal",
  "trusted-traveler": "federal",
  "federal-employment-records": "federal",
};

/** Canonical order, shared with the checklist engine: the dependency backbone. */
const CANONICAL_ORDER: DocumentType[] = [
  "court-order",
  "ssa-card",
  "drivers-license",
  "passport",
  "birth-certificate",
  "financial-records",
];

/**
 * The documents every plan considers. The birth certificate is here even though a move does
 * NOT touch it — precisely because people assume it does. Leaving it out would have the plan
 * say nothing about the one document whose rules a move cannot change, in a corpus where one
 * covered state (Texas) lists no way to change its sex field at all. Silence there is the
 * expensive failure; the step itself says the move changes nothing about it.
 */
const DEFAULT_SET: DocumentType[] = [
  "court-order",
  "ssa-card",
  "drivers-license",
  "passport",
  "birth-certificate",
];

/** Government-issued documents — the ones where APPLYING is itself an act on a state record. */
const GOVERNMENT_DOCS = new Set<DocumentType>([
  "court-order",
  "ssa-card",
  "drivers-license",
  "passport",
  "birth-certificate",
]);

const TITLES: Record<DocumentType, string> = t("en").docTitles;

/** Records for one (jurisdiction × document × change × language) cell. */
function cell(
  corpus: CorpusRecord[],
  jurisdiction: JurisdictionId,
  doc: DocumentType,
  changes: ChangeType[],
  language: RelocationIntake["language"],
  forMinor: boolean,
): CorpusRecord[] {
  const structural = corpus.filter(
    (r) =>
      r.jurisdiction === jurisdiction &&
      r.document_type === doc &&
      r.change_type.some((c) => changes.includes(c)) &&
      r.language === language,
  );
  // Same audience exclusivity as the checklist/retrieval surfaces (api/retrieval.ts
  // selectAudience): a minor plan sees only a minor-audience record where this single
  // (jurisdiction × doc) cell has one, and falls through to the adult record otherwise.
  return selectAudience(structural, forMinor);
}

/**
 * Step cost. Identical policy to api/checklist.ts:pickCost — when backing records disagree
 * we surface "varies", never one figure dressed up as authoritative.
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
  const times = records.map((r) => r.timeline).filter((x): x is Timeline => !!x);
  if (times.length === 0) return undefined;
  const distinct = new Set(times.map((x) => x.typical));
  if (distinct.size > 1) return { typical: "varies", note: "sources differ — see each step's source" };
  return times[0];
}

/**
 * Which jurisdiction's records govern this document after the move — or `null` when that is
 * NOT derivable from an (origin, destination) pair. A birth certificate is the null case: it is
 * governed by the state you were born in, which this app deliberately never asks for. Returning
 * the origin or the destination there would be a guess dressed as a fact, so the engine returns
 * null and `birthStateSteps()` handles it explicitly instead.
 */
function governingJurisdiction(doc: DocumentType, intake: RelocationIntake): JurisdictionId | null {
  switch (PORTABILITY[doc]) {
    case "federal":
      return "US";
    case "state-of-residence":
      return intake.destination;
    case "state-of-record":
      // The state that issued it keeps it. For a document the person already holds that is
      // the ORIGIN; for one they have yet to obtain it is wherever they will be living.
      return intake.held.includes(doc) ? intake.origin : intake.destination;
    case "state-of-birth":
      return null;
    case "non-government":
      return intake.destination;
  }
}

interface Resolved {
  current: CorpusRecord[];
  degraded: CorpusRecord[];
}

function resolve(
  corpus: CorpusRecord[],
  jurisdiction: JurisdictionId,
  doc: DocumentType,
  intake: RelocationIntake,
  today: string | undefined,
): Resolved {
  const matching = cell(corpus, jurisdiction, doc, intake.change_types, intake.language, intake.for_minor === true);
  return {
    current: matching.filter((r) => isCurrent(r, today)),
    degraded: matching.filter((r) => !isCurrent(r, today)),
  };
}

/**
 * Classify what the move does to one document. Note what is NOT here: there is no branch
 * that concludes "your origin document is accepted in the destination". That is a legal
 * question about interstate recognition, no corpus record answers it, so the engine
 * classifies a held state-of-record document as `keep-from-origin` — "you hold this; our
 * sources do not describe what the destination does with it" — and lets the UI say so.
 */
function classify(doc: DocumentType, intake: RelocationIntake, resolved: Resolved): StepClass {
  if (resolved.current.length === 0) return "unknown";
  switch (PORTABILITY[doc]) {
    case "federal":
      return "carries-over";
    case "state-of-residence":
      return "redo-in-destination";
    case "state-of-record":
      return intake.held.includes(doc) ? "keep-from-origin" : "redo-in-destination";
    case "state-of-birth":
      // Never "redo-in-destination": moving to Washington does not let Washington re-issue a
      // Texas birth record, and no source says otherwise.
      return "governed-by-birth-state";
    case "non-government":
      return "redo-in-destination";
  }
}

/**
 * The genuinely valuable bit. A step belongs to "before-you-move" when the records that
 * govern it are the ORIGIN's AND at least one of them is `residency_bound` — i.e. the
 * origin's own cited source says you file where you live. Once the person is no longer a
 * resident, that route is not available to them; the corpus says so in the origin
 * record's own words, and the hazard cites it.
 *
 * A document the person ALREADY HOLDS is not an action, so it has no window to catch and
 * no phase — it is context ("either"), shown so its citations stay on the page.
 *
 * Everything else is "after-you-arrive" (destination rules) or "either" (federal).
 */
function phaseOf(step: Omit<RelocationStep, "phase" | "order">, intake: RelocationIntake, corpus: CorpusRecord[]): RelocationPhase {
  if (step.step_class === "keep-from-origin") return "already-have";
  // A birth record is not gated on the move in either direction: the route does not close when
  // you leave (it is keyed to where you were born, not where you live), and arriving does not
  // open a new one. It gets its own phase so it can never be captioned as if it were.
  if (step.step_class === "governed-by-birth-state") return "birth-state";
  if (step.jurisdiction === "US") return "either";
  if (step.jurisdiction === intake.origin && residencyBoundIds(step.record_ids, corpus).length > 0) {
    return "before-you-move";
  }
  return "after-you-arrive";
}

/** Ids among `ids` whose record carries the (content-gated) residency_bound annotation. */
function residencyBoundIds(ids: string[], corpus: CorpusRecord[]): string[] {
  return ids.filter((id) => corpus.find((r) => r.id === id)?.relocation?.residency_bound === true);
}

/**
 * "Do this before you leave" for a document the person does NOT yet hold and whose origin
 * records are residency-bound. This is the strand: the destination will name (say) a court
 * order as something to bring, and the origin's route to one closes when you move — but so
 * does nothing automatically, so the plan must present BOTH the origin option (while it is
 * still open) and the destination one, each in its own source's words.
 */
function originWindowStep(
  doc: DocumentType,
  intake: RelocationIntake,
  corpus: CorpusRecord[],
  today: string | undefined,
): RelocationStep | null {
  if (intake.held.includes(doc)) return null; // they already have it; no window to catch
  if (PORTABILITY[doc] !== "state-of-record") return null;
  const origin = resolve(corpus, intake.origin, doc, intake, today);
  if (origin.current.length === 0) return null;
  const bound = residencyBoundIds(origin.current.map((r) => r.id), corpus);
  if (bound.length === 0) return null; // the origin's source never conditions it on residency

  const records = origin.current.filter((r) => bound.includes(r.id));
  return {
    key: `origin:${doc}`,
    order: 0,
    document_type: doc,
    jurisdiction: intake.origin,
    portability: PORTABILITY[doc],
    step_class: "do-in-origin", // an action under the OLD state's rules — not the new one's
    phase: "before-you-move",
    title: TITLES[doc],
    record_ids: records.map((r) => r.id),
    prerequisites: [],
    cost: pickCost(records),
    timeline: pickTimeline(records),
    discretionary: records.some((r) => r.discretionary),
    needs_reverification: origin.degraded.length > 0,
    held: false,
    alternative_to: doc, // linked to its destination twin once that step exists
  };
}

/**
 * The birth-certificate case, which no other document in this corpus shares.
 *
 * A birth record belongs to the state you were BORN in. That state is not necessarily the one
 * you are leaving, it is certainly not the one you are moving to, and this app never asks for it
 * (a birth state is an identity field, and the relocation surface holds none). So the engine
 * does the only honest thing available to it: it emits the rules of each state IN THIS PLAN,
 * labelled with whose rules they are, and lets the records — whose own cited prose says "if you
 * were born in Illinois", "people who were born in Washington state" — do the conditioning. The
 * phase copy says the rest: the move does not change which state's rules apply, and if you were
 * born outside these two states, neither set applies to you.
 *
 * What this deliberately does NOT do is classify a birth certificate as `redo-in-destination`.
 * That would tell someone leaving Texas that Washington will re-issue their Texas birth record.
 * No source says that, because it is false — and it is exactly the kind of plausible-sounding
 * structural lie this engine exists to refuse.
 */
function birthStateSteps(
  doc: DocumentType,
  intake: RelocationIntake,
  corpus: CorpusRecord[],
  today: string | undefined,
  gaps: RelocationPlan["gaps"],
): RelocationStep[] {
  const steps: RelocationStep[] = [];
  for (const jurisdiction of [intake.origin, intake.destination]) {
    const resolved = resolve(corpus, jurisdiction, doc, intake, today);
    if (resolved.current.length === 0 && resolved.degraded.length === 0) {
      gaps.push({ document_type: doc, jurisdiction, reason: "no-records" });
      continue;
    }
    if (resolved.current.length === 0) gaps.push({ document_type: doc, jurisdiction, reason: "all-degraded" });

    const declared = new Set<string>();
    for (const r of [...resolved.current, ...resolved.degraded]) {
      for (const p of r.prerequisites ?? []) declared.add(p);
    }
    const formRefs = [
      ...new Set([...resolved.current, ...resolved.degraded].map((r) => r.form_ref).filter((f): f is string => !!f)),
    ];

    steps.push({
      key: `birth:${jurisdiction}`,
      order: 0,
      document_type: doc,
      jurisdiction,
      portability: PORTABILITY[doc],
      step_class: classify(doc, intake, resolved),
      phase: "birth-state",
      title: TITLES[doc],
      record_ids: resolved.current.map((r) => r.id),
      prerequisites: [...declared] as DocumentType[],
      // Cost and timeline describe AMENDING the record, which holding a copy of it does not do,
      // so neither is suppressed the way a `keep-from-origin` document's is.
      cost: pickCost(resolved.current),
      timeline: pickTimeline(resolved.current),
      discretionary: resolved.current.some((r) => r.discretionary),
      needs_reverification: resolved.current.length === 0 || resolved.degraded.length > 0,
      ...(formRefs.length > 0 ? { form_refs: formRefs } : {}),
      // The intake's "birth certificate" checkbox says the person HAS a birth certificate. It
      // does not say the sex or the name on it has been amended, and it does not say which state
      // issued it — so it is never grounds for marking the amendment done.
      held: intake.held.includes(doc),
    });
  }
  return steps;
}

/** Build the destination-delta plan. Pure: `today` and `corpus` are injectable for tests. */
export function buildRelocationPlan(
  intake: RelocationIntake,
  today?: string,
  corpus = loadCorpus(),
): RelocationPlan {
  // A move touches the standard set whether or not the person already holds any of it.
  // `held` ADDS to what we consider (and marks those steps as already in hand) — it must
  // never NARROW the plan, or saying "I have a court order" would hide the license step.
  const held = intake.held;
  const considered = CANONICAL_ORDER.filter((d) => DEFAULT_SET.includes(d) || held.includes(d));

  const steps: RelocationStep[] = [];
  const gaps: RelocationPlan["gaps"] = [];

  for (const doc of considered) {
    // (a) The closing-door step, if the origin still offers a residency-bound route.
    const before = originWindowStep(doc, intake, corpus, today);
    if (before) steps.push(before);

    // (b) The step under whichever jurisdiction governs this document after the move.
    const jurisdiction = governingJurisdiction(doc, intake);
    if (jurisdiction === null) {
      // No (origin, destination) answer exists — a birth certificate is governed by the state
      // of birth. Show each covered state's rules as its own step; never route it to either.
      steps.push(...birthStateSteps(doc, intake, corpus, today, gaps));
      continue;
    }
    const resolved = resolve(corpus, jurisdiction, doc, intake, today);
    const stepClass = classify(doc, intake, resolved);

    if (resolved.current.length === 0 && resolved.degraded.length === 0) {
      gaps.push({ document_type: doc, jurisdiction, reason: "no-records" });
      continue;
    }
    if (resolved.current.length === 0) {
      gaps.push({ document_type: doc, jurisdiction, reason: "all-degraded" });
    }

    // Prerequisites come from the records' own `prerequisites` field — the destination's
    // source naming what to bring. They are resolved against the steps in THIS plan only.
    const declared = new Set<string>();
    for (const r of [...resolved.current, ...resolved.degraded]) {
      for (const p of r.prerequisites ?? []) declared.add(p);
    }

    const formRefs = [
      ...new Set([...resolved.current, ...resolved.degraded].map((r) => r.form_ref).filter((f): f is string => !!f)),
    ];

    // A document already in hand carries NO cost, timeline or discretionary flag: those
    // describe the process of OBTAINING it, which is done. Suppressing them in the engine
    // (rather than in the view) means the cost model and the page cannot disagree about
    // whether a held document is billable — they read the same field.
    const alreadyHeld = stepClass === "keep-from-origin";
    const partial: Omit<RelocationStep, "phase" | "order"> = {
      key: doc,
      document_type: doc,
      jurisdiction,
      portability: PORTABILITY[doc],
      step_class: stepClass,
      title: TITLES[doc],
      record_ids: resolved.current.map((r) => r.id),
      prerequisites: [...declared] as DocumentType[],
      cost: alreadyHeld ? undefined : pickCost(resolved.current),
      timeline: alreadyHeld ? undefined : pickTimeline(resolved.current),
      discretionary: alreadyHeld ? false : resolved.current.some((r) => r.discretionary),
      needs_reverification: resolved.current.length === 0 || resolved.degraded.length > 0,
      ...(formRefs.length > 0 ? { form_refs: formRefs } : {}),
      held: held.includes(doc),
    };
    steps.push({ ...partial, phase: phaseOf(partial, intake, corpus), order: 0 });
  }

  // Cross-link the two routes to the same document (origin-while-you-still-live-there vs.
  // destination-once-you-arrive) as ALTERNATIVES, so neither renders as a step you must
  // also do. Where only one route exists there is nothing to link.
  const byDoc = new Map<DocumentType, RelocationStep[]>();
  for (const s of steps) {
    byDoc.set(s.document_type, [...(byDoc.get(s.document_type) ?? []), s]);
  }
  for (const [, routes] of byDoc) {
    if (routes.length !== 2) continue;
    const [a, b] = routes as [RelocationStep, RelocationStep];
    // Only an origin-vs-destination pair for the SAME document is a genuine either/or. The two
    // birth-certificate steps in a plan are not: which one applies is decided by where you were
    // born, not by a choice you get to make, and "do this one or that one — not both" would be a
    // lie of structure in the other direction.
    if (a.step_class !== "do-in-origin" && b.step_class !== "do-in-origin") continue;
    a.alternative_to = b.key;
    b.alternative_to = a.key;
  }

  // Resolve each step's declared document prerequisites to step keys in THIS plan. When a
  // prerequisite document has two routes, point at the one that comes first (the origin
  // route, which is the one with a deadline); the alternative link on that step tells the
  // reader the other route also satisfies it, so the arrow is a schedule, not a mandate.
  for (const s of steps) {
    const resolvedPrereqs: string[] = [];
    for (const p of s.prerequisites) {
      const candidates = (byDoc.get(p as DocumentType) ?? []).filter((c) => c.key !== s.key);
      const pick = candidates.find((c) => c.phase === "before-you-move") ?? candidates[0];
      if (pick) resolvedPrereqs.push(pick.key);
    }
    s.prerequisites = resolvedPrereqs;
  }

  const ordered = orderSteps(steps);
  ordered.forEach((s, i) => (s.order = i + 1));

  return {
    origin: intake.origin,
    destination: intake.destination,
    change_types: intake.change_types,
    language: intake.language,
    steps: ordered,
    hazards: hazardsFor(ordered, corpus),
    costs: costModel(ordered, corpus),
    gaps,
  };
}

/**
 * Order the plan: "before you move" first (those doors close), then federal (portable, do
 * it whenever), then destination steps — and within all of that, never before a step it
 * depends on. A stable insertion-order tiebreak keeps the output deterministic (the eval
 * and the render cache both need that).
 */
function orderSteps(steps: RelocationStep[]): RelocationStep[] {
  const PHASE_RANK: Record<RelocationPhase, number> = {
    "already-have": 0, // what you're starting from — and often a prerequisite of the rest
    "before-you-move": 1,
    either: 2,
    "birth-state": 3, // not gated on the move; ranked after the steps that are
    "after-you-arrive": 4,
  };
  const byKey = new Map(steps.map((s) => [s.key, s]));
  const seen = new Set<string>();
  const out: RelocationStep[] = [];

  const visit = (step: RelocationStep, stack: Set<string>): void => {
    if (seen.has(step.key) || stack.has(step.key)) return; // cycle-safe: a corpus prereq loop can't hang the planner
    stack.add(step.key);
    for (const p of step.prerequisites) {
      const dep = byKey.get(p);
      if (dep) visit(dep, stack);
    }
    stack.delete(step.key);
    if (!seen.has(step.key)) {
      seen.add(step.key);
      out.push(step);
    }
  };

  const roots = [...steps].sort((a, b) => {
    const phase = PHASE_RANK[a.phase] - PHASE_RANK[b.phase];
    if (phase !== 0) return phase;
    return CANONICAL_ORDER.indexOf(a.document_type) - CANONICAL_ORDER.indexOf(b.document_type);
  });
  for (const s of roots) visit(s, new Set());
  return out;
}

/**
 * The ordering hazards. Three are corpus-backed claims (they cite the record that says so);
 * the fourth, `creates-government-record`, is a CAUTION about the act of applying, not a
 * fact about any jurisdiction — it names no agency, alleges no database, and asserts no
 * rule, so it is uncited, exactly like the existing "check this against the official
 * source" note. (See docs/RELOCATION.md §Safety for why the single-sourced Texas database
 * allegation is documented there and NOT rendered to users.)
 */
function hazardsFor(steps: RelocationStep[], corpus: CorpusRecord[]): OrderingHazard[] {
  const hazards: OrderingHazard[] = [];
  const byKey = new Map(steps.map((s) => [s.key, s]));

  for (const step of steps) {
    // (1) Prerequisite order — cited to the record whose own source names what to bring.
    for (const p of step.prerequisites) {
      const dep = byKey.get(p);
      if (!dep) continue;
      const citations = step.record_ids.filter((id) => {
        const rec = corpus.find((r) => r.id === id);
        return (rec?.prerequisites ?? []).includes(dep.document_type);
      });
      if (citations.length > 0) {
        hazards.push({ kind: "prerequisite-order", step_key: step.key, blocked_by: dep.key, citations });
      }
    }

    // (2) The closing door — cited to the origin record that says you file where you live.
    //     Only for something they have yet to do: a document already in hand has no window.
    if (step.phase === "before-you-move" && !step.held) {
      const citations = residencyBoundIds(step.record_ids, corpus);
      if (citations.length > 0) {
        hazards.push({ kind: "origin-window-closes", step_key: step.key, citations });
      }
    }

    // (3) A destination rule we cannot state as current. Never guessed, always shown.
    if (step.needs_reverification) {
      hazards.push({ kind: "unverified-destination-rule", step_key: step.key, citations: step.record_ids });
    }

    // (4) Applying is itself an act on a government record. Uncited caution, never a claim.
    //     `held` suppresses it because a document you already have is one you are not applying
    //     for — with one exception: holding a birth certificate says nothing about whether the
    //     sex or the name printed on it has been amended, so the application (and this caution)
    //     still stands.
    const stillAnApplication = !step.held || step.portability === "state-of-birth";
    if (GOVERNMENT_DOCS.has(step.document_type) && stillAnApplication) {
      hazards.push({ kind: "creates-government-record", step_key: step.key, citations: [] });
    }
  }
  return hazards;
}

/**
 * The cost model. Cost is the #1 reported barrier to relocation, so this is deliberately
 * NOT a tidy single number: it is a floor built only from amounts the corpus actually
 * states, plus an explicit count of what it cannot price. A step whose records say
 * "varies by county" is `variable`; a step whose records price nothing is `unpriced`.
 * Neither is ever silently rolled into the total, and nothing is extrapolated.
 */
export function costModel(steps: RelocationStep[], corpus: CorpusRecord[]): CostModel {
  const lines: CostLine[] = [];
  let knownTotal = 0;
  const variable: string[] = [];
  const unpriced: string[] = [];
  const waivers: string[] = [];

  for (const step of steps) {
    if (step.held && step.step_class === "keep-from-origin") continue; // already paid for; not part of the move's cost

    const priced = step.record_ids
      .map((id) => corpus.find((r) => r.id === id))
      .filter((r): r is CorpusRecord => !!r && !!r.cost);

    const citations = priced.map((r) => r.id);
    const feeWaiver = priced.some((r) => r.cost?.fee_waiver === true);
    if (feeWaiver) waivers.push(step.key);

    if (!step.cost) {
      unpriced.push(step.key);
      lines.push({
        step_key: step.key,
        document_type: step.document_type,
        jurisdiction: step.jurisdiction,
        amount_usd: null,
        fee_waiver: feeWaiver,
        citations,
      });
      continue;
    }
    if (step.cost.amount_usd === null) variable.push(step.key);
    else knownTotal += step.cost.amount_usd;

    lines.push({
      step_key: step.key,
      document_type: step.document_type,
      jurisdiction: step.jurisdiction,
      amount_usd: step.cost.amount_usd,
      note: step.cost.note,
      fee_waiver: feeWaiver,
      citations,
    });
  }

  return {
    lines,
    known_total_usd: knownTotal,
    variable_step_keys: variable,
    unpriced_step_keys: unpriced,
    fee_waiver_step_keys: waivers,
  };
}

/**
 * The plan as a GroundedAnswer, so it goes through the IDENTICAL citation gate as /answer.
 *
 * Every substantive block is a record's own statement carrying that record's id. Structure
 * (phase labels, ordering, totals) is `boilerplate`; things we do not know are
 * `uncertainty`. There is no third category — if a sentence would be a legal claim without
 * a record behind it, there is nowhere in this function to put it, and enforce() rejects
 * the plan rather than rendering it. That is the structural version of "no claim without a
 * citation" for the relocation surface.
 */
export function relocationAnswer(
  intake: RelocationIntake,
  today?: string,
  corpus = loadCorpus(),
): GroundedAnswer {
  const plan = buildRelocationPlan(intake, today, corpus);
  const blocks: AnswerBlock[] = [];
  const cited: CorpusRecord[] = [];

  for (const step of plan.steps) {
    for (const id of step.record_ids) {
      const rec = corpus.find((r) => r.id === id);
      if (!rec) continue;
      const text = rec.detail ? `${rec.statement.trim()} ${rec.detail.trim()}` : rec.statement.trim();
      blocks.push({ kind: "claim", citations: [rec.id], text });
      cited.push(rec);
    }
  }

  const s = t(intake.language).generator;
  blocks.push({ kind: "boilerplate", citations: [], text: s.disclosure });
  return enforce({ blocks, cited_records: cited, refused: blocks.length === 1 }, corpus, today);
}
