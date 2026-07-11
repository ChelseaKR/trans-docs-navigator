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
  language: Language;
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
export interface FormDef {
  id: string;
  jurisdiction: JurisdictionId;
  document_type: DocumentType;
  change_type: ChangeType[];
  title: string;
  /** Official source for the blank form (the link the user follows). */
  source: Source;
}

/** Minimal, respectful intake. Lives only in client memory/session — never persisted server-side. */
export interface Intake {
  jurisdiction: JurisdictionId;
  change_types: ChangeType[];
  /** Documents the user wants to update; empty means "recommend the standard set". */
  documents: DocumentType[];
  language: Language;
  /** Optional, all skippable — used only client-side for form pre-fill. */
  current_legal_name?: string;
  new_legal_name?: string;
  has_court_order?: boolean;
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
  form_ref?: string;
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
