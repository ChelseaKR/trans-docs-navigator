// FIX-02 regression: the serving path must evaluate freshness against the REAL clock (or
// a frozen `today` explicitly injected at the shell boundary, as servingToday() supplies
// in api/server.ts), never a compile-time constant. A record that is marked `verified` but
// has crossed its recheck SLA must degrade to "needs reverification" at request time, not
// be served as current forever.
//
// These tests freeze `today` (the same seam server.ts now feeds with servingToday()) well
// past a real seed record's SLA and assert the readiness probe and the checklist route both
// observe the lapse — proving degradation happens live on the serving path rather than being
// pinned to a frozen date.

import { test } from "node:test";
import assert from "node:assert/strict";
import { handleRoute, readiness } from "../api/router.ts";
import { servingToday, TEST_TODAY } from "../api/freshness.ts";

const u = (path: string) => new URL(path, "http://localhost:8080");

// The seed corpus's freshest record (corpus/jurisdictions/california.json,
// ca.court-order.name) is `verified`, last_verified 2026-05-31, recheck_sla_days 90 — the
// widest SLA in the corpus is 90 days. A `today` a full year later is past every record's
// SLA, so it is a clock-agnostic way to force a corpus-wide lapse without hardcoding
// per-record internals that could shift as the corpus is edited.
const FAR_PAST_SLA_TODAY = "2027-06-16";

test("servingToday never returns the frozen TEST_TODAY constant", () => {
  // No NAV_TODAY pin: falls back to the real clock, not the compile-time constant.
  assert.notEqual(servingToday({}, new Date("2030-01-01T00:00:00Z")), TEST_TODAY);
  assert.equal(servingToday({}, new Date("2030-01-01T00:00:00Z")), "2030-01-01");
});

test("readiness degrades freshness to unavailable once every record is past its SLA", () => {
  // A near-current `today` (matching the corpus's own freshness) reports ok.
  const fresh = readiness({ today: "2026-06-16" });
  assert.equal(fresh.checks.freshness, "ok");
  assert.equal(fresh.ready, true);

  // A year-later `today` — the kind of value the real clock (servingToday) produces once
  // time has actually moved on, as opposed to a frozen constant that would never change —
  // pushes every seed record past its recheck SLA.
  const stale = readiness({ today: FAR_PAST_SLA_TODAY });
  assert.equal(stale.checks.freshness, "unavailable");
  assert.equal(stale.ready, false);
});

test("/readyz degrades to 503 unavailable once the injected clock outruns every record's SLA", () => {
  const ok = handleRoute("GET", u("/readyz"), "2026-06-16");
  assert.equal(ok.status, 200);
  assert.equal(JSON.parse(ok.body).checks.freshness, "ok");

  const degraded = handleRoute("GET", u("/readyz"), FAR_PAST_SLA_TODAY);
  assert.equal(degraded.status, 503);
  const body = JSON.parse(degraded.body);
  assert.equal(body.status, "unavailable");
  assert.equal(body.checks.freshness, "unavailable");
});

test("/checklist flags a verified-but-past-SLA record as needing reverification, not as current", () => {
  const route = "/checklist?jurisdiction=US-CA&change=name&doc=court-order";

  // At a `today` matching the record's own last_verified window, it is served as current —
  // no reverification flag in the rendered page.
  const fresh = handleRoute("GET", u(route), "2026-06-16");
  assert.equal(fresh.status, 200);
  assert.doesNotMatch(fresh.body, /Needs reverification/);

  // A `today` a year past that lapses the SLA. The step must degrade in the response —
  // proving the checklist route derives currency from the injected clock at request time,
  // not from a compile-time "as of" constant that would keep serving it as current forever.
  const stale = handleRoute("GET", u(route), FAR_PAST_SLA_TODAY);
  assert.equal(stale.status, 200);
  assert.match(stale.body, /Needs reverification/);
});
