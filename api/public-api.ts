// Versioned, read-only partner API (EXP-07, issue #232).
//
// WHY THIS EXISTS, AND WHY IT LOOKS PARANOID
// -------------------------------------------
// Legal-aid organizations are this project's distribution channel, and until now the only
// ways to reuse the corpus were to scrape rendered HTML or read the JSON files out of git.
// Both strip the guarantees off the data. A checklist without its citations, without its
// "information, not legal advice" line, or without the fact that NO record has been checked
// by a named human yet, is precisely the harm this project exists to avoid.
//
// So every response here carries provenance as REQUIRED, non-optional keys. A consumer
// cannot accidentally receive a claim with no source attached, because there is no shape
// in which that is expressible.
//
// THE ONE THING THIS FILE IS MOST CAREFUL ABOUT
// ---------------------------------------------
// A record's on-disk `verification_status` is `"verified"` for 530 of 688 records. Zero of
// them have been verified by a named human — every one carries the `Pilot Seed Reviewer`
// placeholder from corpus/VERIFIERS.json. The HTML UI never lets that read as verification
// (src/render.ts:verificationCaption), and neither may this API. Emitting
// `verification_status: "verified"` ALONE would publish a placeholder as if it were a human
// check: an absence rendered as a value, on the single most consequential field in the
// dataset. So `human_verified` and `verifier_is_placeholder` are mandatory siblings of it,
// and `verification.human_verified_records` sits in the envelope of EVERY response.
//
// The second absence this file refuses to collapse: a record's declared status is what a
// reviewer wrote down; its SERVING status is what freshness says today. 92 records are
// currently declared `verified` and past their recheck SLA — the serving path degrades them
// (api/freshness.ts) and so does this API, in `serving_status`/`serving_reason`. A consumer
// reading only the declared field would republish stale law as current.
//
// The third: an uncovered jurisdiction returns an explicit `not_covered` object, never an
// empty `records` list. "We have no record" and "there is no path" are different facts and
// must never be collapsed — the same distinction api/compare.ts draws per cell.
//
// NOT IN SCOPE HERE: writes of any kind (there is no POST), free-text questions, and any
// consumer-facing terms text — that is counsel-gated behind #163 and is emitted as an
// explicit `null` with a status, never as invented wording.

import { loadCorpus, loadVerifierRoster, isHumanVerified, isPlaceholderVerifier, type VerifierEntry } from "./corpus.ts";
import { loadReferrals, referralsFor } from "./referrals.ts";
import { buildChecklist, hasThinnerLanguageCoverage, hasNoStateCoverage, hasNoMinorCoverage } from "./checklist.ts";
import { freshnessOf, servingToday } from "./freshness.ts";
import { isDriftWatchable } from "./watchability.ts";
import { DISCLOSURE } from "./citation.ts";
import type {
  Checklist,
  CorpusRecord,
  Intake,
  JurisdictionId,
  Language,
  ReferralRecord,
  VerificationStatus,
} from "./types.ts";

/** Wire version of this API. Bumped only for a breaking shape change; see docs/api/README.md. */
export const API_VERSION = "1";

/** Path prefix every endpoint in this module lives under. */
export const API_PREFIX = "/api/v1";

// ── Provenance ────────────────────────────────────────────────────────────────────────

/**
 * The provenance block attached to every citable object this API emits. Every key is
 * REQUIRED — a consumer can never receive a claim whose sourcing is merely absent, and
 * `tests/public-api.test.ts` asserts each key is in its schema's `required` list so a
 * future edit cannot quietly demote one to optional.
 */
export interface ApiProvenance {
  /** The official page the claim is cited to. */
  source: { url: string; title: string; last_verified: string; verifier: string };
  /** What a reviewer WROTE DOWN about this record. Not, by itself, evidence of a human check. */
  verification_status: VerificationStatus;
  /** True only when `source.verifier` is a real, non-placeholder roster human. Today: always false. */
  human_verified: boolean;
  /** True when `source.verifier` is a roster placeholder (e.g. "Pilot Seed Reviewer"). */
  verifier_is_placeholder: boolean;
  /** What freshness says TODAY. `degraded` records must not be republished as current fact. */
  serving_status: "current" | "degraded";
  /** Why `serving_status` is what it is — the same reason codes api/freshness.ts emits. */
  serving_reason: "verified-within-sla" | "past-sla" | "needs-reverification" | "unverified" | "future-date";
  /** Days between `source.last_verified` and the date this response was generated. */
  age_days: number;
  recheck_sla_days: number;
  /**
   * Can an automated watcher even detect this cited page changing? False for sources with
   * no committed drift baseline and for sources the pipeline cannot fetch (api/watchability.ts).
   * A consumer that mirrors this corpus needs to know which rows nothing is watching.
   */
  drift_watchable: boolean;
}

function provenanceOf(
  source: CorpusRecord["source"],
  verification_status: VerificationStatus,
  recheck_sla_days: number,
  today: string,
  roster: Map<string, VerifierEntry>,
): ApiProvenance {
  const verdict = freshnessOf({ source, verification_status, recheck_sla_days }, today);
  return {
    source: {
      url: source.url,
      title: source.title,
      last_verified: source.last_verified,
      verifier: source.verifier,
    },
    verification_status,
    human_verified: isHumanVerified(source.verifier, roster),
    verifier_is_placeholder: isPlaceholderVerifier(source.verifier, roster),
    serving_status: verdict.current ? "current" : "degraded",
    serving_reason: verdict.reason,
    age_days: verdict.ageDays,
    recheck_sla_days,
    drift_watchable: isDriftWatchable(source.url),
  };
}

// ── Envelope ──────────────────────────────────────────────────────────────────────────

/**
 * Corpus-wide honesty header, on EVERY response. A partner who reads nothing else still
 * cannot miss that the human-verification count is zero — the number is derived from the
 * roster at request time (api/corpus.ts:humanVerifiedCount's rule), never typed.
 */
export interface ApiVerificationSummary {
  /** Records in this response's population whose verifier is a real, named human. */
  human_verified_records: number;
  /** Size of that population. */
  total_records: number;
  /** Machine-readable launch state: `demonstration` until a named human has checked a record. */
  readiness: "demonstration" | "partially-verified" | "verified";
}

export interface ApiDisclosure {
  not_legal_advice: string;
  ai_assisted: string;
  /** Path to the human-readable terms this service publishes. */
  terms_path: string;
  /**
   * Terms for API CONSUMERS specifically (what a partner may republish, and under what
   * attribution) are a legal judgement this project has not obtained yet — issue #163.
   * Emitted as an explicit null with a status rather than as invented wording, because a
   * plausible-looking placeholder is worse than a stated absence.
   */
  consumer_terms: null;
  consumer_terms_status: "pending-counsel-review";
  /** The corpus licence, which does travel with the data. */
  license: string;
}

export interface ApiEnvelope<T> {
  api_version: string;
  /** ISO date this response's freshness was evaluated against. */
  generated_on: string;
  disclosure: ApiDisclosure;
  verification: ApiVerificationSummary;
  data: T;
}

const LICENSE = "AGPL-3.0-or-later";

/**
 * Options every endpoint accepts. `roster` exists so a test can exercise the
 * human-verified branches against a roster with a REAL verifier on it — the live roster
 * (corpus/VERIFIERS.json) holds exactly one entry and it is a placeholder, so those
 * branches are otherwise unreachable and would go untested until the day they first
 * matter. Production never passes it.
 */
export interface ApiOptions {
  today?: string | undefined;
  roster?: Map<string, VerifierEntry> | undefined;
}

function disclosure(): ApiDisclosure {
  return {
    not_legal_advice: DISCLOSURE.notLegalAdvice,
    ai_assisted: DISCLOSURE.aiAssisted,
    terms_path: "/terms",
    consumer_terms: null,
    consumer_terms_status: "pending-counsel-review",
    license: LICENSE,
  };
}

function verificationSummary(
  population: ReadonlyArray<{ source: { verifier: string } }>,
  roster: Map<string, VerifierEntry>,
): ApiVerificationSummary {
  const human = population.reduce((n, r) => n + (isHumanVerified(r.source.verifier, roster) ? 1 : 0), 0);
  const readiness: ApiVerificationSummary["readiness"] =
    human === 0 ? "demonstration" : human === population.length ? "verified" : "partially-verified";
  return { human_verified_records: human, total_records: population.length, readiness };
}

function envelope<T>(
  data: T,
  population: ReadonlyArray<{ source: { verifier: string } }>,
  today: string,
  roster: Map<string, VerifierEntry>,
): ApiEnvelope<T> {
  return {
    api_version: API_VERSION,
    generated_on: today,
    disclosure: disclosure(),
    verification: verificationSummary(population, roster),
    data,
  };
}

// ── Record projection ─────────────────────────────────────────────────────────────────

/** A corpus record as this API publishes it: the claim, plus mandatory provenance. */
export interface ApiRecord extends ApiProvenance {
  id: string;
  jurisdiction: JurisdictionId;
  document_type: string;
  change_type: string[];
  topic: string;
  statement: string;
  detail: string | null;
  cost: { amount_usd: number | null; note: string | null; fee_waiver: boolean } | null;
  timeline: { typical: string; note: string | null } | null;
  prerequisites: string[];
  discretionary: boolean;
  form_refs: string[];
  language: Language;
  /** `"adult"` on records that carry no explicit audience — the historical default. */
  audience: "adult" | "minor";
}

function projectRecord(rec: CorpusRecord, today: string, roster: Map<string, VerifierEntry>): ApiRecord {
  return {
    id: rec.id,
    jurisdiction: rec.jurisdiction,
    document_type: rec.document_type,
    change_type: [...rec.change_type],
    topic: rec.topic,
    statement: rec.statement,
    detail: rec.detail ?? null,
    cost: rec.cost
      ? {
          amount_usd: rec.cost.amount_usd,
          note: rec.cost.note ?? null,
          fee_waiver: rec.cost.fee_waiver === true,
        }
      : null,
    timeline: rec.timeline ? { typical: rec.timeline.typical, note: rec.timeline.note ?? null } : null,
    prerequisites: [...(rec.prerequisites ?? [])],
    discretionary: rec.discretionary === true,
    form_refs: rec.form_ref ? [rec.form_ref] : [],
    language: rec.language,
    audience: rec.audience ?? "adult",
    ...provenanceOf(rec.source, rec.verification_status, rec.recheck_sla_days, today, roster),
  };
}

/** A referral as this API publishes it. Same mandatory provenance as a corpus record. */
export interface ApiReferral extends ApiProvenance {
  id: string;
  jurisdiction: JurisdictionId;
  name: string;
  url: string;
  note: Record<Language, string>;
  /**
   * Whether this referral is scoped to the requested jurisdiction or is a NATIONAL
   * organization that api/referrals.ts returns for every jurisdiction.
   *
   * This field exists because leaving it out made the endpoint dishonest in a way that was
   * invisible: `referralsFor()` folds the two national records (A4TE, Lambda Legal) into
   * every jurisdiction's result, so a state with no local legal-aid record at all still
   * came back non-empty. A partner would read that as "this state is covered". It is the
   * national fallback, and the consumer has to be able to tell.
   */
  scope: "jurisdiction" | "national";
}

function projectReferral(
  ref: ReferralRecord,
  requested: JurisdictionId,
  today: string,
  roster: Map<string, VerifierEntry>,
): ApiReferral {
  return {
    id: ref.id,
    jurisdiction: ref.jurisdiction,
    name: ref.name,
    url: ref.url,
    note: { ...ref.note },
    scope: ref.jurisdiction === requested ? "jurisdiction" : "national",
    ...provenanceOf(ref.source, ref.verification_status, ref.recheck_sla_days, today, roster),
  };
}

// ── Endpoint payloads ─────────────────────────────────────────────────────────────────

export interface CorpusPayload {
  /** Applied filters, echoed back from the BOUNDED parse only — never the raw query string. */
  filters: { jurisdiction: JurisdictionId | null; language: Language | null };
  records: ApiRecord[];
}

/**
 * Every record, optionally narrowed by jurisdiction and/or language.
 *
 * Unlike `getJurisdiction`, this endpoint has no `not_covered` state: a filter that matches
 * nothing is a query result, not an absence of research, and the caller supplied the filter.
 * `getJurisdiction` is the endpoint that answers "do you cover this state at all".
 */
export function getCorpus(
  opts: ApiOptions & { jurisdiction?: JurisdictionId | undefined; language?: Language | undefined } = {},
  corpus = loadCorpus(),
): ApiEnvelope<CorpusPayload> {
  const today = opts.today ?? servingToday();
  const roster = opts.roster ?? loadVerifierRoster();
  const records = corpus.filter(
    (r) =>
      (opts.jurisdiction === undefined || r.jurisdiction === opts.jurisdiction) &&
      (opts.language === undefined || r.language === opts.language),
  );
  return envelope(
    {
      filters: { jurisdiction: opts.jurisdiction ?? null, language: opts.language ?? null },
      records: records.map((r) => projectRecord(r, today, roster)),
    },
    records,
    today,
    roster,
  );
}

export interface JurisdictionsPayload {
  /** Every jurisdiction id the corpus holds at least one record for, sorted. */
  jurisdictions: { jurisdiction: JurisdictionId; record_count: number; human_verified_records: number }[];
}

export function getJurisdictions(
  opts: ApiOptions = {},
  corpus = loadCorpus(),
): ApiEnvelope<JurisdictionsPayload> {
  const today = opts.today ?? servingToday();
  const roster = opts.roster ?? loadVerifierRoster();
  const byId = new Map<JurisdictionId, CorpusRecord[]>();
  for (const r of corpus) byId.set(r.jurisdiction, [...(byId.get(r.jurisdiction) ?? []), r]);
  const jurisdictions = [...byId.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([jurisdiction, recs]) => ({
      jurisdiction,
      record_count: recs.length,
      human_verified_records: recs.reduce((n, r) => n + (isHumanVerified(r.source.verifier, roster) ? 1 : 0), 0),
    }));
  return envelope({ jurisdictions }, corpus, today, roster);
}

/**
 * One jurisdiction. `status` is the load-bearing field:
 *   - `covered`     — we hold records for it; `records` is non-empty.
 *   - `not_covered` — we hold NO record for it. An absence of research, not a statement
 *                     about the jurisdiction, and explicitly NOT an empty result set.
 */
export interface JurisdictionPayload {
  jurisdiction: JurisdictionId;
  status: "covered" | "not_covered";
  /** Present and human-readable only for `not_covered`; null when covered. */
  not_covered_reason: string | null;
  records: ApiRecord[];
}

const NOT_COVERED_REASON =
  "This corpus holds no record for this jurisdiction. That is an absence of research, " +
  "not a finding that no legal path exists there. Do not present it as either.";

export function getJurisdiction(
  jurisdiction: JurisdictionId,
  opts: ApiOptions & { language?: Language | undefined } = {},
  corpus = loadCorpus(),
): ApiEnvelope<JurisdictionPayload> {
  const today = opts.today ?? servingToday();
  const roster = opts.roster ?? loadVerifierRoster();
  // Coverage is decided over ALL records for the jurisdiction, before any language filter:
  // a state we cover only in English must not report itself `not_covered` to a Spanish
  // consumer. That would turn a translation gap into a claim about the state.
  const all = corpus.filter((r) => r.jurisdiction === jurisdiction);
  const covered = all.length > 0;
  const shown = opts.language === undefined ? all : all.filter((r) => r.language === opts.language);
  return envelope(
    {
      jurisdiction,
      status: covered ? "covered" : "not_covered",
      not_covered_reason: covered ? null : NOT_COVERED_REASON,
      records: shown.map((r) => projectRecord(r, today, roster)),
    },
    all,
    today,
    roster,
  );
}

export interface ApiChecklistStep {
  key: string;
  order: number;
  document_type: string;
  title: string;
  /** Ids of the records backing this step; resolve them in `records` below. */
  record_ids: string[];
  prerequisites: string[];
  cost: { amount_usd: number | null; note: string | null; fee_waiver: boolean } | null;
  timeline: { typical: string; note: string | null } | null;
  discretionary: boolean;
  /** True when a backing record is degraded. A consumer MUST render the step as degraded too. */
  needs_reverification: boolean;
  form_refs: string[];
  done: boolean;
}

export interface ChecklistPayload {
  jurisdiction: JurisdictionId;
  change_types: string[];
  language: Language;
  steps: ApiChecklistStep[];
  /** Documents no serveable step could be produced for, with a language-neutral reason code. */
  gaps: { document_type: string; reason: "no-records" | "all-degraded" }[];
  /**
   * The three coverage-honesty flags the HTML checklist renders as banners. A partner that
   * drops these shows a thinner Spanish checklist as if it were the whole answer.
   */
  coverage: {
    no_state_coverage: boolean;
    thinner_language_coverage: boolean;
    no_minor_coverage: boolean;
  };
  /** Every record cited by a step, so a consumer never has to re-fetch to show a citation. */
  records: ApiRecord[];
}

export function getChecklist(
  intake: Intake,
  opts: ApiOptions = {},
  corpus = loadCorpus(),
): ApiEnvelope<ChecklistPayload> {
  const today = opts.today ?? servingToday();
  const roster = opts.roster ?? loadVerifierRoster();
  const checklist: Checklist = buildChecklist(intake, today, corpus);
  const cited = new Set(checklist.steps.flatMap((s) => s.record_ids));
  const records = corpus.filter((r) => cited.has(r.id));
  return envelope(
    {
      jurisdiction: checklist.jurisdiction,
      change_types: [...checklist.change_types],
      language: checklist.language,
      steps: checklist.steps.map((s) => ({
        key: s.key,
        order: s.order,
        document_type: s.document_type,
        title: s.title,
        record_ids: [...s.record_ids],
        prerequisites: [...s.prerequisites],
        cost: s.cost
          ? { amount_usd: s.cost.amount_usd, note: s.cost.note ?? null, fee_waiver: s.cost.fee_waiver === true }
          : null,
        timeline: s.timeline ? { typical: s.timeline.typical, note: s.timeline.note ?? null } : null,
        discretionary: s.discretionary,
        needs_reverification: s.needs_reverification,
        form_refs: [...(s.form_refs ?? [])],
        done: s.done === true,
      })),
      gaps: checklist.gaps.map((g) => ({ document_type: g.document_type, reason: g.reason })),
      coverage: {
        no_state_coverage: hasNoStateCoverage(intake.jurisdiction, corpus),
        thinner_language_coverage: hasThinnerLanguageCoverage(intake, today, corpus),
        no_minor_coverage: intake.for_minor === true && hasNoMinorCoverage(intake.jurisdiction, corpus),
      },
      records: records.map((r) => projectRecord(r, today, roster)),
    },
    records,
    today,
    roster,
  );
}

/**
 * One Open Referral HSDS 3.0 `organization`, so a legal-aid directory can ingest these
 * without writing a custom mapping. Deliberately a NARROW subset: only fields this project
 * actually holds are emitted. HSDS has `service`, `location`, `phone` and `schedule`
 * objects; inventing empty ones would tell a directory we hold contact data we do not.
 */
export interface HsdsOrganization {
  id: string;
  name: string;
  description: string;
  url: string;
  /** HSDS 3.0 requires this key; null is its documented "not held" value. */
  email: null;
}

export interface ReferralsPayload {
  jurisdiction: JurisdictionId;
  /**
   * Three states, because two would hide the common one:
   *   - `covered`       — at least one referral is scoped to this jurisdiction.
   *   - `national-only` — only national organizations matched. They do serve this
   *                       jurisdiction, but no LOCAL referral has been researched, and a
   *                       consumer must not read the non-empty list as local coverage.
   *   - `not_covered`   — nothing matched at all.
   */
  status: "covered" | "national-only" | "not_covered";
  /** Non-null for `national-only` and `not_covered`; null when a local referral exists. */
  coverage_note: string | null;
  /** Referrals scoped to this jurisdiction specifically. */
  local_referral_count: number;
  referrals: ApiReferral[];
  /** The same referrals in Open Referral HSDS shape. Always the same length as `referrals`. */
  hsds: { organizations: HsdsOrganization[] };
}

const NO_REFERRALS_REASON =
  "This corpus holds no referral record for this jurisdiction. That is an absence of " +
  "research, not a finding that no organization serves this jurisdiction.";

const NATIONAL_ONLY_REASON =
  "Only national organizations matched this jurisdiction. They serve it, but no referral " +
  "scoped to this jurisdiction has been researched — do not present this as local coverage.";

export function getReferrals(
  jurisdiction: JurisdictionId,
  opts: ApiOptions & { language?: Language | undefined } = {},
  referrals = loadReferrals(),
): ApiEnvelope<ReferralsPayload> {
  const today = opts.today ?? servingToday();
  const roster = opts.roster ?? loadVerifierRoster();
  const matched = referralsFor(jurisdiction, referrals);
  const local = matched.filter((r) => r.jurisdiction === jurisdiction);
  const status: ReferralsPayload["status"] =
    local.length > 0 ? "covered" : matched.length > 0 ? "national-only" : "not_covered";
  const lang: Language = opts.language ?? "en";
  return envelope(
    {
      jurisdiction,
      status,
      coverage_note:
        status === "covered" ? null : status === "national-only" ? NATIONAL_ONLY_REASON : NO_REFERRALS_REASON,
      local_referral_count: local.length,
      referrals: matched.map((r) => projectReferral(r, jurisdiction, today, roster)),
      hsds: {
        organizations: matched.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.note[lang],
          url: r.url,
          email: null,
        })),
      },
    },
    matched,
    today,
    roster,
  );
}
