// Freshness gate (guardrail #4) — merge-blocking + runtime alarm.
// Fails the build if any record is BOTH `verified` AND past its recheck SLA: that
// is the one state in which stale law would be served as current. Records that are
// correctly marked `needs_reverification` are reported (they degrade at runtime)
// but do not fail the build.

import { loadCorpus } from "../api/corpus.ts";
import { freshnessOf, staleButMarkedCurrent, TEST_TODAY } from "../api/freshness.ts";
import { lapsingWithin, parseHorizonDays, stalenessHorizon } from "../api/horizon.ts";
import { pass, fail } from "./util.ts";

const today = process.env.NAV_TODAY ?? TEST_TODAY;
// Test-only override (tests/gate-efficacy): point the gate at a poisoned corpus
// directory. Omitting `dir` is loadCorpus()'s existing default-to-CORPUS_DIR path,
// so production behavior is unchanged whenever CORPUS_DIR is unset.
const corpus = loadCorpus(process.env.CORPUS_DIR ? { dir: process.env.CORPUS_DIR } : {});

const violations: string[] = [];
const degraded: string[] = [];

for (const rec of corpus) {
  const f = freshnessOf(rec, today);
  if (staleButMarkedCurrent(rec, today)) {
    violations.push(`${rec.id} — verified but ${f.ageDays}d old > ${rec.recheck_sla_days}d SLA (re-mark needs_reverification)`);
  } else if (rec.verification_status === "verified" && f.reason === "future-date") {
    // A verified record dated in the future is a data-entry error that would otherwise
    // read as permanently "current" — fail closed rather than trust the date.
    violations.push(`${rec.id} — last_verified is in the FUTURE (${rec.source.last_verified}); fix the date`);
  } else if (f.reason === "needs-reverification") {
    degraded.push(rec.id);
  }
}

if (degraded.length > 0) {
  console.log(`  ℹ️  ${degraded.length} record(s) intentionally degraded (served as "needs reverification"): ${degraded.join(", ")}`);
}

// ── Forward-looking horizon (api/horizon.ts) ────────────────────────────────────────────
// Everything above answers "is anything stale NOW". That question reads clean right up to
// the morning a uniformly-seeded corpus lapses. This corpus is uniformly seeded: as of
// 2026-09-07, 436 of the 438 serving records shared one `last_verified` and one 90-day
// SLA, so they lapse together on 2026-10-12 and the count above goes from 0 to 436 in a
// day. The horizon is therefore printed on EVERY run, including the merge gate's pinned
// one, because the interesting number is never today's.
const horizon = stalenessHorizon(corpus, today);
if (horizon.serving_records === 0) {
  console.log(`  ⚠️  horizon: NOTHING in the corpus is serveable as current as of ${today}.`);
} else {
  console.log(
    `  ℹ️  horizon: ${horizon.serving_records}/${horizon.total_records} record(s) serving; ` +
      `first lapse ${horizon.next_lapse_date} (${horizon.days_to_next_lapse}d), ` +
      `last ${horizon.total_lapse_date} (${horizon.days_to_total_lapse}d)`,
  );
  if (horizon.cliff) {
    console.log(
      `  ⚠️  horizon: ${horizon.cliff.count} of ${horizon.serving_records} serving record(s) ` +
        `(${(horizon.cliff.share * 100).toFixed(1)}%) lapse on the SAME day, ${horizon.cliff.date}, ` +
        `${horizon.cliff.days_away}d away. After that /readyz reports 503 and every step renders degraded.`,
    );
  }
}

// `--horizon-days=N` turns the lookahead into a failure, and is passed ONLY by the weekly
// content-watch sweep, which runs against the real calendar. The merge gate deliberately
// does not pass it: a merge-blocking check that goes red on a date rather than on a commit
// stops every unrelated PR in the repository and teaches people to bypass it. The weekly
// sweep is the right place for a calendar alarm, because its whole job is to turn one into
// an issue a human can act on.
const horizonDays = parseHorizonDays(process.argv.slice(2));

if (violations.length > 0) fail("freshness", `${violations.length} stale record(s) served as current`, violations);

if (horizonDays !== null) {
  const imminent = lapsingWithin(horizon, horizonDays);
  const affected = imminent.reduce((n, b) => n + b.count, 0);
  if (affected > 0) {
    fail(
      "freshness",
      `${affected} serving record(s) lapse within ${horizonDays} day(s) of ${today} — re-verify them before they do`,
      imminent.map(
        (b) => `${b.date}: ${b.count} record(s) lapse; ${b.serving_after} of today's ${horizon.serving_records} still serving after`,
      ),
    );
  }
  pass("freshness", `0 past SLA and nothing lapsing within ${horizonDays} day(s) (as of ${today})`);
}

pass("freshness", `0 jurisdictions past SLA served as current (as of ${today})`);
