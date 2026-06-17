// Freshness SLA logic — guardrail #4: "stale law is broken law".
// A record is serveable-as-current only when it is `verified` AND within its
// per-record recheck SLA. Everything else degrades to "needs reverification"
// and is never silently served as fact.

import type { CorpusRecord } from "./types.ts";

export const DEFAULT_TODAY = "2026-06-16"; // "as of" date; overridable for deterministic tests/eval

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(fromIso + "T00:00:00Z");
  const to = Date.parse(toIso + "T00:00:00Z");
  return Math.floor((to - from) / 86_400_000);
}

export interface FreshnessVerdict {
  /** Safe to serve as a current, authoritative fact. */
  current: boolean;
  ageDays: number;
  /** Why it is or isn't current. */
  reason: "verified-within-sla" | "past-sla" | "needs-reverification" | "unverified" | "future-date";
}

export function freshnessOf(rec: CorpusRecord, today: string = DEFAULT_TODAY): FreshnessVerdict {
  const ageDays = daysBetween(rec.source.last_verified, today);
  if (rec.verification_status === "unverified") {
    return { current: false, ageDays, reason: "unverified" };
  }
  if (rec.verification_status === "needs_reverification") {
    return { current: false, ageDays, reason: "needs-reverification" };
  }
  // verified:
  // A last_verified date in the FUTURE (data-entry typo, e.g. 2027 for 2025) would yield a
  // negative age and otherwise pass the SLA forever. Never trust a future verification date.
  if (ageDays < 0) {
    return { current: false, ageDays, reason: "future-date" };
  }
  if (ageDays > rec.recheck_sla_days) {
    return { current: false, ageDays, reason: "past-sla" };
  }
  return { current: true, ageDays, reason: "verified-within-sla" };
}

export function isCurrent(rec: CorpusRecord, today: string = DEFAULT_TODAY): boolean {
  return freshnessOf(rec, today).current;
}

/**
 * The runtime contract the freshness CI job enforces: a record may never be
 * BOTH marked `verified` AND past its SLA. That state means stale data would be
 * served as current. Such records must be re-marked `needs_reverification`.
 */
export function staleButMarkedCurrent(rec: CorpusRecord, today: string = DEFAULT_TODAY): boolean {
  return rec.verification_status === "verified" && freshnessOf(rec, today).reason === "past-sla";
}
