// Staleness horizon — when does what we are serving today stop being serveable?
//
// `api/freshness.ts` answers "is this record current *now*". Nothing answered "for how
// much longer", and the difference is not academic here. Measured on 2026-09-07: 438 of
// 688 records were serving, every one of them on a 90-day SLA, and 436 of them shared the
// same `last_verified` of 2026-07-13. They therefore lapse on the same day —
//
//   2026-10-11   436 records serving
//   2026-10-12     0 records serving
//
// — and on that day `readiness()` (which requires at least one current record) starts
// answering 503, every checklist step in every state renders degraded, and nothing
// anywhere in this repository had said it was coming. A corpus seeded in one pass and
// given a uniform SLA does not decay; it falls off a cliff, and the shape of the failure
// is invisible to a "how many records are stale today" check, which reads 0 right up to
// the last morning.
//
// This module is the forward-looking half. It is deliberately read-only and pure: it
// changes no serving decision, and `freshnessOf` remains the only thing that decides
// whether a record may be served as current.

import type { CorpusRecord } from "./types.ts";
import { freshnessOf, isValidIsoDate, servingToday } from "./freshness.ts";

const DAY_MS = 86_400_000;

function addDays(iso: string, n: number): string {
  return new Date(Date.parse(iso + "T00:00:00Z") + n * DAY_MS).toISOString().slice(0, 10);
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(toIso + "T00:00:00Z") - Date.parse(fromIso + "T00:00:00Z")) / DAY_MS);
}

/**
 * The first date on which `rec` is no longer serveable as current.
 *
 * `freshnessOf` degrades when `ageDays > recheck_sla_days`, so the last serving day is
 * `last_verified + sla` and the record lapses the day after. That arithmetic is a
 * restatement of a rule that lives in another module, which is exactly the kind of copy
 * that drifts — so `tests/horizon.test.ts` asserts, for every record in the real corpus,
 * that `isCurrent` is true on the day before this date and false on it. If the SLA rule
 * ever changes, that test fails rather than this function quietly lying.
 *
 * Returns null when the record is not serving today, because a record that is already
 * degraded has no *remaining* serving life to measure — and reporting one would be the
 * absence-as-a-value mistake this repository keeps finding elsewhere.
 */
export function lapseDate(rec: CorpusRecord, today: string): string | null {
  if (!freshnessOf(rec, today).current) return null;
  return addDays(rec.source.last_verified, rec.recheck_sla_days + 1);
}

export interface LapseBucket {
  /** The day these records stop serving. */
  date: string;
  /** How many currently-serving records lapse on it. */
  count: number;
  /** How many of today's serving records are still serving after this date. */
  serving_after: number;
}

export interface StalenessHorizon {
  today: string;
  total_records: number;
  /** Records serveable as current today. */
  serving_records: number;
  /** Every distinct date on which at least one of them lapses, in order. */
  schedule: LapseBucket[];
  /** The first such date, and how far away it is. Null when nothing is serving. */
  next_lapse_date: string | null;
  days_to_next_lapse: number | null;
  /**
   * The date after which NOTHING serves, and how far away it is. Null when nothing is
   * serving today — an already-empty corpus has no future date to name, and naming
   * today's date would read as "it happens today" rather than "it already happened".
   */
  total_lapse_date: string | null;
  days_to_total_lapse: number | null;
  /**
   * The single date on which the largest number of records lapse, when that is at least
   * `CLIFF_SHARE` of everything serving. A corpus that decays evenly has no cliff and
   * this is null; one seeded in a single pass has exactly one, and it is the only number
   * on this report that is worth waking someone up for.
   */
  cliff: { date: string; count: number; share: number; days_away: number } | null;
}

/** A single day taking at least this share of everything serving is a cliff, not decay. */
export const CLIFF_SHARE = 0.5;

export function stalenessHorizon(corpus: CorpusRecord[], today: string = servingToday()): StalenessHorizon {
  const serving: { rec: CorpusRecord; lapse: string }[] = [];
  for (const rec of corpus) {
    const lapse = lapseDate(rec, today);
    if (lapse !== null) serving.push({ rec, lapse });
  }

  const counts = new Map<string, number>();
  for (const s of serving) counts.set(s.lapse, (counts.get(s.lapse) ?? 0) + 1);

  const dates = [...counts.keys()].sort();
  let remaining = serving.length;
  const schedule: LapseBucket[] = dates.map((date) => {
    const count = counts.get(date)!;
    remaining -= count;
    return { date, count, serving_after: remaining };
  });

  const first = schedule[0];
  const last = schedule[schedule.length - 1];

  let cliff: StalenessHorizon["cliff"] = null;
  if (serving.length > 0) {
    const biggest = schedule.reduce((a, b) => (b.count > a.count ? b : a));
    const share = biggest.count / serving.length;
    if (share >= CLIFF_SHARE) {
      cliff = { date: biggest.date, count: biggest.count, share, days_away: daysBetween(today, biggest.date) };
    }
  }

  return {
    today,
    total_records: corpus.length,
    serving_records: serving.length,
    schedule,
    next_lapse_date: first ? first.date : null,
    days_to_next_lapse: first ? daysBetween(today, first.date) : null,
    total_lapse_date: last ? last.date : null,
    days_to_total_lapse: last ? daysBetween(today, last.date) : null,
    cliff,
  };
}

/**
 * The horizon fields `/healthz` publishes beside its record count.
 *
 * `/healthz` is the CONTAINER liveness path — the Dockerfile HEALTHCHECK, the AWS Lambda
 * Web Adapter readiness variable and `render.yaml`'s `healthCheckPath` all point at it —
 * so its `status` stays a statement about the process and this function never changes it.
 * What it does change is that `corpus_records: 688` no longer stands alone. That number is
 * the count of records on disk, and on 2026-10-12 it will still read 688 while zero of
 * them can be served: a monitor watching this endpoint would see nothing wrong through a
 * total content blackout. The freshness verdict itself lives at `/readyz`.
 */
export function healthHorizon(corpus: CorpusRecord[], today: string = servingToday()): {
  corpus_records: number;
  serving_records: number;
  serving_until: string | null;
  days_until_none_serving: number | null;
} {
  const h = stalenessHorizon(corpus, today);
  return {
    corpus_records: h.total_records,
    serving_records: h.serving_records,
    // The last day something still serves, i.e. the day BEFORE everything has lapsed.
    serving_until: h.total_lapse_date === null ? null : addDays(h.total_lapse_date, -1),
    days_until_none_serving: h.days_to_total_lapse === null ? null : h.days_to_total_lapse - 1,
  };
}

/** Prometheus gauges for the horizon, appended to /metrics by api/metrics.ts. */
export function horizonMetrics(corpus: CorpusRecord[], today: string = servingToday()): string[] {
  const h = stalenessHorizon(corpus, today);
  const lines = [
    "# HELP tdn_corpus_records Corpus records on disk, regardless of whether they can be served.",
    "# TYPE tdn_corpus_records gauge",
    `tdn_corpus_records ${h.total_records}`,
    "# HELP tdn_corpus_serving_records Records serveable as current right now.",
    "# TYPE tdn_corpus_serving_records gauge",
    `tdn_corpus_serving_records ${h.serving_records}`,
  ];
  // Emitted ONLY when there is something to measure. A corpus that serves nothing has no
  // days remaining, and publishing `0` for it would be indistinguishable from "everything
  // lapses today" — two different facts that must not share a number. An absent series is
  // an absent series; an alert on it should use `absent()`, not a threshold.
  if (h.days_to_total_lapse !== null) {
    lines.push(
      "# HELP tdn_corpus_days_until_none_serving Days until no corpus record can be served as current. Absent when none can already.",
      "# TYPE tdn_corpus_days_until_none_serving gauge",
      `tdn_corpus_days_until_none_serving ${h.days_to_total_lapse - 1}`,
    );
  }
  return lines;
}

/**
 * Parse `--horizon-days=N`. Returns null when the flag is absent, and throws on a value
 * that is not a non-negative integer rather than defaulting: a lookahead silently
 * defaulting to 0 would report "nothing lapses within 0 days" and pass forever, which is
 * the alarm that cannot fire.
 */
export function parseHorizonDays(argv: readonly string[]): number | null {
  const arg = argv.find((a) => a.startsWith("--horizon-days="));
  if (arg === undefined) return null;
  const raw = arg.slice("--horizon-days=".length);
  if (!/^\d+$/.test(raw)) throw new Error(`--horizon-days expects a non-negative integer, got ${JSON.stringify(raw)}`);
  return Number(raw);
}

/** Currently-serving records that lapse on or before `today + days`. */
export function lapsingWithin(horizon: StalenessHorizon, days: number): LapseBucket[] {
  if (!isValidIsoDate(horizon.today)) throw new Error(`horizon.today is not an ISO date: ${horizon.today}`);
  const cutoff = addDays(horizon.today, days);
  return horizon.schedule.filter((b) => b.date <= cutoff);
}
