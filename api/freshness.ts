// Freshness SLA logic — guardrail #4: "stale law is broken law".
// A record is serveable-as-current only when it is `verified` AND within its
// per-record recheck SLA. Everything else degrades to "needs reverification"
// and is never silently served as fact.

import type { CorpusRecord } from "./types.ts";

// The frozen "as of" date for DETERMINISTIC OFFLINE consumers ONLY — the freshness gate,
// the coverage matrix, and the eval harness — so those stay reproducible run-to-run.
// The LIVE SERVING PATH must NEVER resolve currency against this constant (FIX-02): it
// uses servingToday()/the real clock, or "stale law is broken law" only holds at merge
// time. Named TEST_* (not DEFAULT_*) so any serving-path import is trivially grep-able
// and can be rejected in review.
//
// It advances when the corpus does: a record verified against its source AFTER this date reads
// as FUTURE-dated to the freshness gate, which fails closed on future dates and is right to. So
// moving it forward is part of a re-verification pass — and it is safe by construction, because
// advancing it can only ever make MORE records stale, never fewer.
export const TEST_TODAY = "2026-07-13";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Is `s` a well-formed, real calendar date in YYYY-MM-DD (rejects 2026-13-40)?
 *
 * The `Date.parse` guard is not redundant. A shape-valid but impossible date splits into
 * two cases: JavaScript rolls some of them over (2026-02-30 becomes 2026-03-02, caught by
 * the round-trip comparison) and rejects others outright (2026-13-45 yields an Invalid
 * Date). Calling `.toISOString()` on an Invalid Date THROWS a RangeError, so without this
 * guard the function does not return false for that class — it throws, and every caller
 * treating it as a predicate inherits the throw. That mattered in two places: the
 * `NAV_TODAY` override below, whose own contract is that a malformed pin is *ignored*
 * rather than fatal, and `changes.parseSince`, where the string is user-supplied and a
 * throw would be a 500 instead of a 400.
 */
export function isValidIsoDate(s: string): boolean {
  if (!ISO_DATE_RE.test(s)) return false;
  const parsed = Date.parse(s + "T00:00:00Z");
  if (Number.isNaN(parsed)) return false;
  return new Date(parsed).toISOString().slice(0, 10) === s;
}

/** The real "as of" date (UTC, YYYY-MM-DD). `now` is injectable for deterministic tests. */
export function isoToday(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * The date the SERVING path evaluates freshness/expiry against. Defaults to the REAL clock
 * (isoToday) so a record whose SLA lapses degrades within a day of real time crossing it —
 * not "never", the way a compile-time constant would. An explicit NAV_TODAY override (the
 * same ops/demo pin the freshness gate honors) is used ONLY when it's a well-formed ISO
 * date; a malformed pin is ignored, because a non-parseable date yields NaN ages that would
 * silently pass every SLA and make stale records look current. Never returns TEST_TODAY.
 */
export function servingToday(env: NodeJS.ProcessEnv = process.env, now: Date = new Date()): string {
  const pin = env.NAV_TODAY;
  if (pin && isValidIsoDate(pin)) return pin;
  return isoToday(now);
}

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

/**
 * The only fields freshness actually reads. Typed as a `Pick` rather than as `CorpusRecord`
 * so the sibling record types that carry the same three fields — ReferralRecord, and the
 * projections api/public-api.ts builds — can be judged by the SAME function instead of a
 * near-copy of it. Widening what is accepted, never what is asserted: every existing
 * CorpusRecord caller still satisfies this exactly as before.
 */
export type FreshnessSubject = Pick<CorpusRecord, "source" | "verification_status" | "recheck_sla_days">;

export function freshnessOf(rec: FreshnessSubject, today: string = servingToday()): FreshnessVerdict {
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

export function isCurrent(rec: FreshnessSubject, today: string = servingToday()): boolean {
  return freshnessOf(rec, today).current;
}

/**
 * The runtime contract the freshness CI job enforces: a record may never be
 * BOTH marked `verified` AND past its SLA. That state means stale data would be
 * served as current. Such records must be re-marked `needs_reverification`.
 */
export function staleButMarkedCurrent(rec: FreshnessSubject, today: string = servingToday()): boolean {
  return rec.verification_status === "verified" && freshnessOf(rec, today).reason === "past-sla";
}
