// Freshness gate (guardrail #4) — merge-blocking + runtime alarm.
// Fails the build if any record is BOTH `verified` AND past its recheck SLA: that
// is the one state in which stale law would be served as current. Records that are
// correctly marked `needs_reverification` are reported (they degrade at runtime)
// but do not fail the build.

import { loadCorpus } from "../api/corpus.ts";
import { freshnessOf, staleButMarkedCurrent, DEFAULT_TODAY } from "../api/freshness.ts";
import { pass, fail } from "./util.ts";

const today = process.env.NAV_TODAY ?? DEFAULT_TODAY;
const corpus = loadCorpus();

const violations: string[] = [];
const degraded: string[] = [];

for (const rec of corpus) {
  if (staleButMarkedCurrent(rec, today)) {
    const f = freshnessOf(rec, today);
    violations.push(`${rec.id} — verified but ${f.ageDays}d old > ${rec.recheck_sla_days}d SLA (re-mark needs_reverification)`);
  } else if (freshnessOf(rec, today).reason === "needs-reverification") {
    degraded.push(rec.id);
  }
}

if (degraded.length > 0) {
  console.log(`  ℹ️  ${degraded.length} record(s) intentionally degraded (served as "needs reverification"): ${degraded.join(", ")}`);
}
if (violations.length > 0) fail("freshness", `${violations.length} stale record(s) served as current`, violations);
pass("freshness", `0 jurisdictions past SLA served as current (as of ${today})`);
