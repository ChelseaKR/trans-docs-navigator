// Domain types for the Trans Docs Navigator.
// Mirrors ROADMAP.md §6 data model: Jurisdiction, DocumentType, Requirement
// (source, last_verified, verifier), Form (field_map, fillable?), ChecklistTemplate,
// and an ephemeral client-side Session (never persisted server-side in default mode).

/** A US jurisdiction. "US" denotes a federal-level document (SSA, passport). */
export type JurisdictionId = string; // e.g. "US-CA", "US-NY", "US-IL", "US"

/** The official documents a person may need to update. */
export type DocumentType =
  | "court-order"
  | "ssa-card"
  | "drivers-license"
  | "passport"
  | "birth-certificate"
  | "financial-records";

/** Which kind of legal change a record/step addresses. */
export type ChangeType = "name" | "gender-marker";

export type Language = "en" | "es";

/**
 * Who a record's rule is written for. Absent (the default on every pre-existing record)
 * means the record describes the ADULT process. `"minor"` marks a record that states the
 * rule for someone under 18 specifically — a different petitioner, a different consent/
 * notice regime, sometimes a different form, and sometimes no route at all. The minors
 * pilot (California, Illinois, New York, Texas, Washington) is the only place `"minor"`
 * records exist today; see docs/audits and tests/coverage-honesty.test.ts for the
 * every-other-state degradation this field drives (api/retrieval.ts `selectAudience`,
 * api/checklist.ts `hasNoMinorCoverage`). Never inferred — set only when the record's own
 * cited source is actually about someone under 18.
 */
export type RecordAudience = "adult" | "minor";

/**
 * Verification state of a corpus record.
 * - verified:            a named human confirmed it against the source, within SLA.
 * - needs_reverification: stale or volatile; degraded to "needs reverification", never served as current fact.
 * - unverified:          ingested but not yet human-checked; never served.
 */
export type VerificationStatus = "verified" | "needs_reverification" | "unverified";

/** Provenance for a single substantive claim. Guardrail #1: no claim without this. */
export interface Source {
  url: string;
  title: string;
  /** ISO date (YYYY-MM-DD) a named human last verified the claim against the source. */
  last_verified: string;
  /** The named human verifier. "UNVERIFIED" is not allowed to render. */
  verifier: string;
}

export interface Cost {
  /** Dollar amount, or null when the cost is variable/unknown (must then carry a note). */
  amount_usd: number | null;
  note?: string;
  /** True when a documented fee-waiver path exists. */
  fee_waiver?: boolean;
}

export interface Timeline {
  typical: string; // plain-language, e.g. "2–8 weeks"
  note?: string;
}

/**
 * Relocation semantics for a single record, used by the destination-delta engine
 * (api/relocation.ts). This is an ANNOTATION over a record that is already sourced and
 * verified — it never introduces a new claim, and it may only assert what the record's
 * own cited text already says.
 *
 * `residency_bound` means: this record's own statement/detail conditions the action on
 * living in that jurisdiction (e.g. "the district court of the county where you live").
 * The content gate (api/corpus.ts:validateRecord) REJECTS the annotation unless the
 * record's own prose actually contains a where-you-live phrase in its language, so the
 * flag cannot be asserted about a source that does not support it.
 */
export interface RelocationTraits {
  residency_bound?: boolean;
}

/**
 * One citable corpus record: a single requirement/fact for a (jurisdiction × document × change).
 * This IS the retrieval unit and the citation unit.
 */
export interface CorpusRecord {
  id: string;
  jurisdiction: JurisdictionId;
  document_type: DocumentType;
  change_type: ChangeType[];
  topic: string;
  /** The substantive, plain-language claim (~8th-grade readability). */
  statement: string;
  detail?: string;
  cost?: Cost;
  timeline?: Timeline;
  /** Record ids or step keys that must be completed first. */
  prerequisites?: string[];
  /** True when the outcome varies by court/clerk and must be framed as "varies". */
  discretionary?: boolean;
  source: Source;
  verification_status: VerificationStatus;
  /** Per-record freshness SLA in days. Legal content defaults to 90. */
  recheck_sla_days: number;
  /** id into the forms registry, when an official form backs this step. */
  form_ref?: string;
  /** Relocation annotation, supported by this record's OWN cited text (see RelocationTraits). */
  relocation?: RelocationTraits;
  language: Language;
  /** Who this record's rule is for. Absent = adult (the historical default); see RecordAudience. */
  audience?: RecordAudience;
}

/**
 * A legal-aid / official referral: a pointer to an organization or government resource
 * that can help a person with their name/gender-marker change, rather than a fact about
 * the process itself. Sibling record type to CorpusRecord (api/referrals.ts) — it rides
 * the SAME verifier gate (named verifier in corpus/VERIFIERS.json, http(s) source,
 * ISO last_verified) but is never conflated with CorpusRecord's document_type schema.
 */
export interface ReferralRecord {
  id: string;
  jurisdiction: JurisdictionId;
  /** The organization or program name, e.g. "Sylvia Rivera Law Project". */
  name: string;
  /** The referral link itself — where the user goes for help. */
  url: string;
  /** Short plain-language description of what this referral offers, per language. */
  note: Record<Language, string>;
  source: Source;
  verification_status: VerificationStatus;
  /** Per-record freshness SLA in days. */
  recheck_sla_days: number;
}

/**
 * An official government form referenced by a step. The app links the user to the
 * real blank form at its official source — it does NOT auto-fill it. (These are XFA/
 * LiveCycle PDFs that browser PDF tooling can't fill, and a mis-filled legal form is a
 * real harm; we send people to the authoritative form instead. See docs/STATUS.md.)
 */
/** One "what to bring" item for a form's preparation checklist — always cited. */
export interface PreparationItem {
  item: string;
  citation: string;
}

export interface FormDef {
  id: string;
  jurisdiction: JurisdictionId;
  document_type: DocumentType;
  change_type: ChangeType[];
  title: string;
  /** Official source for the blank form (the link the user follows). */
  source: Source;
  /** Revision string scraped/entered from the official page (e.g. "Rev. 2024-11"). */
  version_hint?: string;
  /** SHA-256 of raw PDF bytes when this source is a directly linked PDF. */
  pdf_sha256?: string;
  /** ISO date (YYYY-MM-DD) the form source was last checked. */
  checked?: string;
  /**
   * "What to bring" checklist (certified copies, payment types, etc.), each item
   * cited. Legal content here is [counsel-gated] — left empty/absent until
   * verified content is authored; the field is typed and rendered ahead of that.
   */
  preparation?: PreparationItem[];
}

/** Minimal, respectful selection shape; request/cache/log handling is documented in the DPIA. */
export interface Intake {
  jurisdiction: JurisdictionId;
  change_types: ChangeType[];
  /** Documents the user wants to update; empty means "recommend the standard set". */
  documents: DocumentType[];
  language: Language;
  /** Optional legacy/client-only form-helper fields; runtime API code must not read them. */
  current_legal_name?: string;
  new_legal_name?: string;
  has_court_order?: boolean;
  /**
   * True when the person the checklist is for is under 18. Same privacy class as
   * `change_types`/`has_court_order` — a single selection-only bookkeeping bit, never an
   * identity field (docs/audits/dpia.md). Read by retrieval (api/retrieval.ts
   * `selectAudience`) to serve minor-audience records instead of adult ones where the
   * corpus has them, and by the checklist/answer honesty note (api/checklist.ts
   * `hasNoMinorCoverage`) where it does not.
   */
  for_minor?: boolean;
}

/** One step in a generated, ordered checklist. */
export interface ChecklistStep {
  key: string;
  order: number;
  document_type: DocumentType;
  title: string;
  /** Record ids backing this step's substantive content. */
  record_ids: string[];
  prerequisites: string[]; // step keys
  cost?: Cost | undefined;
  timeline?: Timeline | undefined;
  discretionary: boolean;
  /** True when at least one backing record is degraded → step shows "needs reverification". */
  needs_reverification: boolean;
  /**
   * Official forms backing this step, in record order, deduped. A step can legitimately need
   * MORE than one: California's birth-record amendment takes VS 24B for the sex field and VS 23
   * for a court-ordered name change; Washington's takes DOH 422-143 and DOH 422-126; New York's
   * takes the DOH-5305 application AND the notarized DOH-5303 affidavit. Emitting only the first
   * would name a form in the step's prose and then not hand it over — the exact failure the forms
   * gate exists to prevent.
   */
  form_refs?: string[];
  /**
   * True when intake bookkeeping (e.g. Intake.has_court_order) says this step is
   * already complete. The step is still emitted with its citations — never deleted —
   * it's just annotated done, and dependents that listed it as a prerequisite are
   * unblocked (the satisfied prerequisite is pruned from their list).
   */
  done?: boolean;
}

export interface Checklist {
  jurisdiction: JurisdictionId;
  change_types: ChangeType[];
  language: Language;
  steps: ChecklistStep[];
  /** Documents we couldn't produce verified steps for, with a language-neutral reason code. */
  gaps: { document_type: DocumentType; reason: "no-records" | "all-degraded" }[];
}

/** A single rendered unit of a grounded answer. */
export interface AnswerBlock {
  text: string;
  /** Record ids cited by this block. Empty only when `kind` is non-substantive. */
  citations: string[];
  /** substantive claims must be cited; boilerplate/uncertainty/refusal need not be. */
  kind: "claim" | "boilerplate" | "uncertainty" | "refusal" | "freshness";
}

export interface GroundedAnswer {
  blocks: AnswerBlock[];
  /** Records actually used, deduped, for rendering the source list. */
  cited_records: CorpusRecord[];
  /** True when retrieval found nothing serveable and the system refused. */
  refused: boolean;
}

// ── Relocation planner (docs/RELOCATION.md) ──────────────────────────────────────────
// A "moving from X to Y" plan is a DESTINATION DELTA over the same corpus the checklist
// reads: which held documents the move leaves alone, which the destination re-issues on
// its own terms, in what order, what it costs, and — the part that actually strands
// people — which doors close the day you stop being a resident of the origin state.

/**
 * Relocation intake. Deliberately the same shape-class as `Intake`: bounded enums only,
 * no account, no identity fields. `held` is the documents the person says they already
 * have; it is a selection, exactly like `Intake.documents`.
 *
 * PRIVACY: an (origin → destination) pair is among the most sensitive facts about a
 * trans person in a hostile state. It is never logged (api/log.ts drops it: there is no
 * `origin`/`destination` field on the allowlist) and never persisted server-side.
 */
export interface RelocationIntake {
  origin: JurisdictionId;
  destination: JurisdictionId;
  /** Documents the person currently holds, issued under the origin/federal regime. */
  held: DocumentType[];
  change_types: ChangeType[];
  language: Language;
  /** Same bit as `Intake.for_minor`; see that doc comment. */
  for_minor?: boolean;
}

/**
 * How a document travels when a person moves. A definitional property of the DOCUMENT
 * (what kind of thing it is), not a legal rule about what anyone must do — it only
 * decides which jurisdiction's records the delta engine reads. No user-visible sentence
 * is ever generated from it; see docs/RELOCATION.md §"What the engine will not say".
 */
export type Portability =
  /** Federal authority; the same records govern wherever you live (SSA card, passport). */
  | "federal"
  /** Issued by the state you live in, so the destination's rules apply (driver's license). */
  | "state-of-residence"
  /** Held by the state that issued it; moving does not move it (a court order). */
  | "state-of-record"
  /**
   * Held by the state you were BORN in — which is neither the origin nor the destination of a
   * move, and which this app never asks for (a birth certificate). This is the asymmetry that
   * makes a birth certificate unlike every other document here: moving does not change where
   * you were born, so it cannot change whose rules apply. The engine must therefore never
   * route one to the destination ("redo it there") — see api/relocation.ts:birthStateSteps.
   */
  | "state-of-birth"
  /** Not a government-issued document (bank/employer/school records). */
  | "non-government";

/** What the move does to one document. */
export type StepClass =
  /** Federal document: the move does not change which records govern it. */
  | "carries-over"
  /** State-of-residence document: the destination has its own cited requirements. */
  | "redo-in-destination"
  /**
   * An action taken under the ORIGIN's rules, while the person still lives there. Distinct
   * from `redo-in-destination`: labelling this one "the new state has its own requirements"
   * would be plainly false — it is the OLD state's requirements, and that is the whole point
   * of the step (it is the route with a deadline).
   */
  | "do-in-origin"
  /** A document you already hold from the origin, which the destination does not re-issue. */
  | "keep-from-origin"
  /**
   * A `state-of-birth` document: the state that issued it is the one you were born in, so the
   * move changes nothing about it. Deliberately NOT `redo-in-destination` (the destination does
   * not re-issue someone else's birth record) and NOT `keep-from-origin` (the state you are
   * leaving is not necessarily the state you were born in). The plan shows the rules of the
   * states it covers, and says plainly that the state of birth is the one that governs.
   */
  | "governed-by-birth-state"
  /** We have no serveable record for this in the destination. Say so; never guess. */
  | "unknown";

/**
 * When a step can be done, relative to the move itself. `already-have` is not a time at all —
 * it is the context you are starting from, and it gets its own group so a document you hold
 * is never filed under a heading that describes an action (or, worse, under "federal").
 */
export type RelocationPhase =
  | "already-have"
  | "before-you-move"
  | "either"
  /**
   * Not a time either: a `state-of-birth` step is not gated on the move at all. It gets its own
   * group so it can never be filed under "before you move" (the route does not close when you
   * leave) or "after you arrive" (the destination is not the state that governs it).
   */
  | "birth-state"
  | "after-you-arrive";

/**
 * An ordering hazard: doing things in the wrong order strands people. Every hazard is
 * either backed by corpus record ids (a substantive claim) or is a non-substantive
 * CAUTION about the act of applying (`creates-government-record`), which asserts no
 * jurisdiction-specific fact and therefore carries no citation — the same class as the
 * existing "verify this against the official source" note.
 */
export interface OrderingHazard {
  kind:
    /** Step B's own source names document A as something to bring. Do A first. */
    | "prerequisite-order"
    /** The origin's source says you file where you live — that door closes when you move. */
    | "origin-window-closes"
    /** The destination's record for this step is stale/volatile: we cannot state the rule. */
    | "unverified-destination-rule"
    /** Applying to a government agency may itself create a government record. */
    | "creates-government-record";
  /** The step this hazard is attached to. */
  step_key: string;
  /** For `prerequisite-order`: the step that must come first. */
  blocked_by?: string;
  /** Record ids that support this hazard. Empty ONLY for `creates-government-record`. */
  citations: string[];
}

/** One line of the cost model. `amount_usd: null` means UNKNOWN — never estimated. */
export interface CostLine {
  step_key: string;
  document_type: DocumentType;
  jurisdiction: JurisdictionId;
  amount_usd: number | null;
  note?: string | undefined;
  fee_waiver: boolean;
  /** Record ids the amount/note came from. Empty when nothing in the corpus prices it. */
  citations: string[];
}

/**
 * Cost is the #1 reported barrier to relocation, so the model is explicit rather than
 * tidy: a floor built only from amounts the corpus actually states, a count of the steps
 * it cannot price, and the steps whose sources record a fee waiver.
 */
export interface CostModel {
  lines: CostLine[];
  /** Sum of the KNOWN amounts. A floor, never a total. */
  known_total_usd: number;
  /** Steps whose cost the corpus states as variable ("varies by county"). */
  variable_step_keys: string[];
  /** Steps for which the corpus prices nothing at all. */
  unpriced_step_keys: string[];
  /** Steps whose sources record a fee-waiver path. */
  fee_waiver_step_keys: string[];
}

export interface RelocationStep {
  key: string;
  order: number;
  document_type: DocumentType;
  /** Whose rules this step follows: the destination, the origin, or "US" (federal). */
  jurisdiction: JurisdictionId;
  portability: Portability;
  step_class: StepClass;
  phase: RelocationPhase;
  title: string;
  /** Backing, current corpus records — the ONLY source of this step's substantive text. */
  record_ids: string[];
  /** Step keys that this step's own records name as prerequisites. */
  prerequisites: string[];
  cost?: Cost | undefined;
  timeline?: Timeline | undefined;
  discretionary: boolean;
  needs_reverification: boolean;
  /** Official forms backing this step, in record order, deduped. See ChecklistStep.form_refs. */
  form_refs?: string[];
  /** True when the person already holds this document (from the intake). */
  held: boolean;
  /**
   * The OTHER route to the same document, when one exists. A state-of-record document the
   * person does not yet hold can often be obtained under the origin's rules (while they
   * still live there) OR under the destination's — those are alternatives, not two
   * separate things to do, and presenting them as a sequence would be a lie of structure.
   */
  alternative_to?: string;
}

export interface RelocationPlan {
  origin: JurisdictionId;
  destination: JurisdictionId;
  change_types: ChangeType[];
  language: Language;
  /** Ordered: everything gated on origin residency first, then the destination steps. */
  steps: RelocationStep[];
  hazards: OrderingHazard[];
  costs: CostModel;
  /** Documents we cannot produce a verified destination step for. Shown, never hidden. */
  gaps: { document_type: DocumentType; jurisdiction: JurisdictionId; reason: "no-records" | "all-degraded" }[];
}
