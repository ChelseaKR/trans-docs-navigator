// api/horizon.ts — how much serving life the corpus has left, and when it runs out.
//
// The horizon restates one rule that lives in api/freshness.ts (a record degrades when its
// age exceeds its SLA), and a restatement is exactly the kind of copy that drifts. The
// first test below therefore checks the derivation against `isCurrent` itself, for every
// record in the real corpus, on the day before its lapse date and on the day of it. If the
// SLA rule ever changes, that test fails rather than the horizon quietly reporting a date
// nothing else agrees with.

import { test } from "node:test";
import assert from "node:assert/strict";
import { loadCorpus } from "../api/corpus.ts";
import { isCurrent } from "../api/freshness.ts";
import {
  CLIFF_SHARE,
  healthHorizon,
  horizonMetrics,
  lapseDate,
  lapsingWithin,
  parseHorizonDays,
  stalenessHorizon,
} from "../api/horizon.ts";
import { handleRoute } from "../api/router.ts";
import type { CorpusRecord } from "../api/types.ts";

const corpus = loadCorpus();

/** Both dates are literals, never derived from the corpus: a fixture computed from the
 *  value under test moves with it and can never catch a wrong one. */
const TODAY = "2026-09-07";
const AFTER_CLIFF = "2026-10-12";

function addDays(iso: string, n: number): string {
  return new Date(Date.parse(iso + "T00:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);
}

const rec = (over: Partial<CorpusRecord> = {}): CorpusRecord => ({
  id: "x.court-order.name",
  jurisdiction: "US-CA",
  document_type: "court-order",
  change_type: ["name"],
  topic: "name change",
  statement: "File a petition.",
  source: { url: "https://x.gov", title: "X", last_verified: "2026-09-01", verifier: "Pilot Seed Reviewer" },
  verification_status: "verified",
  recheck_sla_days: 90,
  language: "en",
  ...over,
});

test("a lapse date is the first day isCurrent turns false — checked against isCurrent itself", () => {
  let checked = 0;
  for (const r of corpus) {
    const lapse = lapseDate(r, TODAY);
    if (lapse === null) continue;
    checked++;
    assert.equal(isCurrent(r, addDays(lapse, -1)), true, `${r.id} was already degraded the day before ${lapse}`);
    assert.equal(isCurrent(r, lapse), false, `${r.id} was still current on its stated lapse date ${lapse}`);
  }
  assert.ok(checked > 100, `expected the live corpus to have serving records, saw ${checked}`);
});

test("a record that is not serving today has no remaining serving life to report", () => {
  // Reporting a lapse date for an already-degraded record would publish an absence as a
  // value — the same defect class this repository keeps finding elsewhere.
  const stale = rec({ source: { ...rec().source, last_verified: "2020-01-01" } });
  assert.equal(isCurrent(stale, TODAY), false);
  assert.equal(lapseDate(stale, TODAY), null);

  const future = rec({ source: { ...rec().source, last_verified: "2099-01-01" } });
  assert.equal(lapseDate(future, TODAY), null, "a future-dated record is not serving and has no horizon");

  assert.equal(lapseDate(rec({ verification_status: "needs_reverification" }), TODAY), null);
  assert.equal(lapseDate(rec({ verification_status: "unverified" }), TODAY), null);
});

test("the live corpus lapses in bulk on one day, and the horizon says so", () => {
  const h = stalenessHorizon(corpus, TODAY);
  assert.ok(h.serving_records > 0);
  assert.equal(h.total_lapse_date, AFTER_CLIFF);
  assert.ok(h.cliff, "a corpus this uniformly seeded must report a cliff");
  assert.equal(h.cliff.date, AFTER_CLIFF);
  assert.ok(h.cliff.share >= CLIFF_SHARE);
  // The schedule must actually account for everything serving, with nothing left over.
  assert.equal(h.schedule.reduce((n, b) => n + b.count, 0), h.serving_records);
  assert.equal(h.schedule[h.schedule.length - 1]!.serving_after, 0);
  // Ordered, and each bucket's remainder is consistent with the ones before it.
  const dates = h.schedule.map((b) => b.date);
  assert.deepEqual(dates, [...dates].sort());
});

test("an evenly-decaying corpus reports NO cliff", () => {
  // The cliff must be a real property of the data, not something the report always emits.
  // Four records lapsing on four different days is decay, and 1/4 is below CLIFF_SHARE.
  // Verification dates in the PAST — a future `last_verified` is never serving (it is a
  // data-entry error, and freshnessOf rejects it), so a future-dated fixture would sit
  // where the property under test is unreachable.
  const even = [0, 10, 20, 30].map((n, i) =>
    rec({ id: `r${i}`, source: { ...rec().source, last_verified: addDays("2026-09-01", -n) } }),
  );
  const h = stalenessHorizon(even, TODAY);
  assert.equal(h.serving_records, 4);
  assert.equal(h.cliff, null);
  assert.equal(h.schedule.length, 4);
});

test("an empty horizon names no dates rather than naming today", () => {
  // Nothing serving is a different fact from "everything lapses today". Reporting today's
  // date, or 0 days, would collapse the two.
  const h = stalenessHorizon([], TODAY);
  assert.equal(h.serving_records, 0);
  assert.equal(h.next_lapse_date, null);
  assert.equal(h.days_to_next_lapse, null);
  assert.equal(h.total_lapse_date, null);
  assert.equal(h.days_to_total_lapse, null);
  assert.equal(h.cliff, null);
  assert.deepEqual(h.schedule, []);
});

test("/healthz publishes what is SERVING beside what is on disk", () => {
  // The defect: `corpus_records: 688` on a day when zero of them can be served. A monitor
  // reading only that number sees nothing wrong through a total content blackout.
  const before = JSON.parse(handleRoute("GET", new URL("http://x/healthz"), TODAY).body!);
  assert.equal(before.status, "ok");
  assert.equal(before.corpus_records, corpus.length);
  assert.ok(before.serving_records > 0);
  assert.equal(before.serving_until, "2026-10-11");
  assert.equal(before.days_until_none_serving, 34);

  const after = JSON.parse(handleRoute("GET", new URL("http://x/healthz"), AFTER_CLIFF).body!);
  // Still 200 and still `ok`: /healthz is the CONTAINER liveness path (Dockerfile
  // HEALTHCHECK, AWS_LWA_READINESS_CHECK_PATH, render.yaml healthCheckPath), so its status
  // is about the process. The freshness verdict is /readyz's, and it is unchanged.
  assert.equal(handleRoute("GET", new URL("http://x/healthz"), AFTER_CLIFF).status, 200);
  assert.equal(after.status, "ok");
  assert.equal(after.corpus_records, corpus.length, "the on-disk count is unchanged — that is the point");
  assert.equal(after.serving_records, 0);
  assert.equal(after.serving_until, null);
  assert.equal(after.days_until_none_serving, null);
});

test("/readyz still fails closed on the day the corpus lapses", () => {
  // Recorded, not changed: whether the service should go dark or serve everything degraded
  // is a product decision, and this test pins today's answer so a change to it is visible.
  assert.equal(handleRoute("GET", new URL("http://x/readyz"), TODAY).status, 200);
  assert.equal(handleRoute("GET", new URL("http://x/readyz"), AFTER_CLIFF).status, 503);
});

test("the countdown gauge is ABSENT when nothing serves, never zero", () => {
  // Zero days remaining and no days remaining are different facts. A gauge that reports 0
  // for both makes "it lapses today" indistinguishable from "it lapsed already", and an
  // alert written against the first would fire forever on the second.
  const live = horizonMetrics(corpus, TODAY).join("\n");
  assert.match(live, /^tdn_corpus_records \d+$/m);
  assert.match(live, /^tdn_corpus_serving_records \d+$/m);
  assert.match(live, /^tdn_corpus_days_until_none_serving 34$/m);

  const dead = horizonMetrics(corpus, AFTER_CLIFF).join("\n");
  assert.match(dead, /^tdn_corpus_serving_records 0$/m);
  assert.doesNotMatch(dead, /tdn_corpus_days_until_none_serving/);
});

test("/metrics carries the corpus gauges alongside the request ones", () => {
  const body = handleRoute("GET", new URL("http://x/metrics"), TODAY).body!;
  assert.match(body, /^tdn_corpus_serving_records \d+$/m);
  assert.match(body, /^tdn_http_server_active_requests \d+$/m);
});

test("--horizon-days refuses a value it cannot use rather than defaulting", () => {
  // A lookahead silently defaulting to 0 reports "nothing lapses within 0 days" and passes
  // forever: the alarm that cannot fire.
  assert.equal(parseHorizonDays([]), null);
  assert.equal(parseHorizonDays(["--horizon-days=30"]), 30);
  assert.equal(parseHorizonDays(["--horizon-days=0"]), 0);
  for (const bad of ["--horizon-days=", "--horizon-days=x", "--horizon-days=-1", "--horizon-days=1.5"]) {
    assert.throws(() => parseHorizonDays([bad]), /non-negative integer/, bad);
  }
});

test("lapsingWithin is inclusive of the cutoff day and excludes the day after", () => {
  const h = stalenessHorizon(corpus, TODAY);
  const total = h.schedule.reduce((n, b) => n + b.count, 0);
  assert.equal(lapsingWithin(h, 0).length, 0, "nothing lapses on the day it is still serving");
  // 2026-10-12 is 35 days after 2026-09-07.
  assert.equal(lapsingWithin(h, 34).reduce((n, b) => n + b.count, 0) < total, true);
  assert.equal(lapsingWithin(h, 35).reduce((n, b) => n + b.count, 0), total);
});

test("healthHorizon's last-serving day is the day before everything has lapsed", () => {
  const h = healthHorizon(corpus, TODAY);
  assert.equal(h.serving_until, addDays(AFTER_CLIFF, -1));
  // And that day really does still serve something, while the next one does not.
  assert.ok(corpus.some((r) => isCurrent(r, h.serving_until!)));
  assert.ok(!corpus.some((r) => isCurrent(r, AFTER_CLIFF)));
});
