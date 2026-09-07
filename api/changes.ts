// Packet staleness (EXP-03, docs/ideation/03-expansions.md).
//
// A packet starts going stale the moment it prints, and guardrail 4 ("stale law is
// broken law") has no way to reach paper. Someone three months into a
// court-order-then-DMV sequence could only find out by redoing intake and comparing by
// eye. This module answers "is this still right?" from one low-sensitivity bit on the
// request surface the DPIA already bounds: the date the packet was generated.
//
// WHAT THIS CAN AND CANNOT SAY, which is the whole design.
//
// EXP-03 wants three states per step: `unchanged`, `re-verified`, and
// `CHANGED — see step N` with the changelog entries after `since`. The third needs
// per-record changelogs, which are corpus schema v2 (FIX-03) and are not built. EXP-03
// names that dependency and specifies the degraded mode: until changelogs land, answer
// from `last_verified` alone and say that changelog detail is unavailable.
//
// So the degraded mode has two states, not three, and the missing one is NOT `unchanged`.
// Without changelogs this repository cannot know whether the law changed; it knows only
// whether anyone re-checked the page. Rendering "unchanged" would publish an absence of
// evidence as a reassurance, on the one artifact a person carries into a clerk's office.
// The honest statement is narrower and is a fact about this repository rather than about
// the law: NO_RECHECK_RECORDED, "no re-verification has been recorded since your packet
// printed". When changelogs exist, a real `changed` state joins these and the wording of
// the third can finally become a claim about the law.
//
// Nothing here reads a record's prose or re-derives a legal fact. It compares dates.

import type { ChangeType, DocumentType, Intake, JurisdictionId, Language, CorpusRecord } from "./types.ts";
import { buildChecklist } from "./checklist.ts";
import { loadCorpus } from "./corpus.ts";
import { freshnessOf, isValidIsoDate, servingToday } from "./freshness.ts";

/**
 * What one step of a printed packet can honestly be told about itself today.
 *
 * `re-verified` is a positive fact: a named date moved forward after the packet
 * printed. `needs-reverification` is the degraded state the checklist already shows.
 * `no-recheck-recorded` is deliberately NOT `unchanged` — see the module note.
 */
export type StepChangeState = "re-verified" | "needs-reverification" | "no-recheck-recorded";

export interface StepChange {
  key: string;
  order: number;
  document_type: DocumentType;
  title: string;
  state: StepChangeState;
  record_ids: string[];
  /**
   * The most recent `last_verified` across this step's backing records, or "" when the
   * step has no backing record at all. Empty is rendered as its own absence, never as a
   * date and never as a reason to call the step settled.
   */
  last_verified: string;
}

export interface PacketChanges {
  since: string;
  today: string;
  jurisdiction: JurisdictionId;
  change_types: ChangeType[];
  language: Language;
  steps: StepChange[];
  /**
   * True when the packet is older than the longest recheck SLA in the corpus, so no step
   * in it can still be within its own SLA and the whole packet needs a fresh run. Derived
   * from the corpus rather than a hard-coded number, so it cannot drift away from the
   * data (EXP-03).
   */
  packet_expired: boolean;
  longest_sla_days: number;
  ageDays: number;
  /**
   * False until corpus schema v2 (FIX-03) lands per-record changelogs. Carried in the
   * result rather than assumed by the view, so the page can say what it cannot tell you
   * instead of quietly answering a narrower question than the one that was asked.
   */
  changelog_available: boolean;
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.floor(
    (Date.parse(toIso + "T00:00:00Z") - Date.parse(fromIso + "T00:00:00Z")) / 86_400_000,
  );
}

/**
 * The `since` date a packet printed, or `null` when it is unusable.
 *
 * Rejects a missing param, a malformed date (`2026-13-45`), and a date in the future.
 * A future `since` is not a harmless typo: every comparison below is "did anything happen
 * after this date", so a `since` in 2027 would report every step as un-rechecked and read
 * as "nothing has moved". Refusing is the same direction `freshnessOf` already fails on a
 * future `last_verified`.
 *
 * There is deliberately no floor. A very old packet is a real thing someone may be
 * holding, and it is handled by `packet_expired` telling them to run a fresh checklist —
 * not by a 400 that tells them nothing.
 */
export function parseSince(raw: string | null, today: string = servingToday()): string | null {
  if (raw === null || !isValidIsoDate(raw)) return null;
  if (daysBetween(raw, today) < 0) return null;
  return raw;
}

/** The longest recheck SLA any record in the corpus declares. */
export function longestSlaDays(corpus: CorpusRecord[]): number {
  return corpus.reduce((max, r) => (r.recheck_sla_days > max ? r.recheck_sla_days : max), 0);
}

function stepState(records: CorpusRecord[], since: string, today: string): StepChangeState {
  // A step with no backing record cannot have been re-verified and is not settled.
  // buildChecklist emits such a step only as a `gap`, but the state is defined here so a
  // future caller cannot reach a silent default.
  if (records.length === 0) return "needs-reverification";
  if (records.some((r) => !freshnessOf(r, today).current)) return "needs-reverification";
  return records.some((r) => daysBetween(since, r.source.last_verified) > 0)
    ? "re-verified"
    : "no-recheck-recorded";
}

function newestVerification(records: CorpusRecord[]): string {
  return records.reduce((newest, r) => (r.source.last_verified > newest ? r.source.last_verified : newest), "");
}

/**
 * Compare a printed packet against the corpus as it stands today.
 *
 * Pure: same intake, same `since`, same `today`, same corpus gives the same result. The
 * steps are exactly `buildChecklist`'s, in the same order, so a step number a person
 * reads off their paper packet refers to the same step here.
 */
export function buildPacketChanges(
  intake: Intake,
  since: string,
  today: string = servingToday(),
  corpus: CorpusRecord[] = loadCorpus(),
): PacketChanges {
  const checklist = buildChecklist(intake, today, corpus);
  const byId = new Map(corpus.map((r) => [r.id, r]));
  const steps: StepChange[] = checklist.steps.map((step) => {
    const records = step.record_ids
      .map((id) => byId.get(id))
      .filter((r): r is CorpusRecord => r !== undefined);
    return {
      key: step.key,
      order: step.order,
      document_type: step.document_type,
      title: step.title,
      state: stepState(records, since, today),
      record_ids: step.record_ids,
      last_verified: newestVerification(records),
    };
  });
  const longest = longestSlaDays(corpus);
  const ageDays = daysBetween(since, today);
  return {
    since,
    today,
    jurisdiction: checklist.jurisdiction,
    change_types: checklist.change_types,
    language: checklist.language,
    steps,
    longest_sla_days: longest,
    ageDays,
    packet_expired: longest > 0 && ageDays > longest,
    // FIX-03 has not landed. Hard-coded false rather than probed, so this flips only
    // when someone builds changelogs and changes it deliberately.
    changelog_available: false,
  };
}
