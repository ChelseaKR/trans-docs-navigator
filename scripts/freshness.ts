// Freshness gate (guardrail #4) — merge-blocking + runtime alarm.
// Fails the build if any record is BOTH `verified` AND past its recheck SLA: that
// is the one state in which stale law would be served as current. Records that are
// correctly marked `needs_reverification` are reported (they degrade at runtime)
// but do not fail the build.

import { loadCorpus } from "../api/corpus.ts";
import { freshnessOf, staleButMarkedCurrent, TEST_TODAY } from "../api/freshness.ts";
import { pass, fail } from "./util.ts";

const today = process.env.NAV_TODAY ?? TEST_TODAY;
// Test-only override (tests/gate-efficacy): point the gate at a poisoned corpus
// directory. `dir: undefined` is loadCorpus()'s existing default-to-CORPUS_DIR path,
// so production behavior is unchanged whenever CORPUS_DIR is unset.
const corpus = loadCorpus({ dir: process.env.CORPUS_DIR });

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
if (violations.length > 0) fail("freshness", `${violations.length} stale record(s) served as current`, violations);
pass("freshness", `0 jurisdictions past SLA served as current (as of ${today})`);
