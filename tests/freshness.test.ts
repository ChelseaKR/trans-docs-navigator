import { test } from "node:test";
import assert from "node:assert/strict";
import { freshnessOf, isCurrent, isValidIsoDate, servingToday, staleButMarkedCurrent } from "../api/freshness.ts";
import type { CorpusRecord } from "../api/types.ts";

const base: CorpusRecord = {
  id: "t",
  jurisdiction: "US-CA",
  document_type: "court-order",
  change_type: ["name"],
  topic: "t",
  statement: "long enough statement here",
  source: { url: "https://e", title: "T", last_verified: "2026-05-01", verifier: "A" },
  verification_status: "verified",
  recheck_sla_days: 90,
  language: "en",
};
const today = "2026-05-31";

test("verified within SLA is current", () => {
  const v = freshnessOf(base, today);
  assert.equal(v.current, true);
  assert.equal(v.reason, "verified-within-sla");
  assert.equal(v.ageDays, 30);
  assert.equal(isCurrent(base, today), true);
});

test("verified but past SLA is not current and is flagged stale-as-current", () => {
  const old = { ...base, source: { ...base.source, last_verified: "2025-01-01" } };
  const v = freshnessOf(old, today);
  assert.equal(v.current, false);
  assert.equal(v.reason, "past-sla");
  assert.equal(staleButMarkedCurrent(old, today), true);
});

test("needs_reverification degrades and is not stale-as-current", () => {
  const r = { ...base, verification_status: "needs_reverification" as const };
  assert.equal(freshnessOf(r, today).reason, "needs-reverification");
  assert.equal(isCurrent(r, today), false);
  assert.equal(staleButMarkedCurrent(r, today), false);
});

test("a future last_verified date is never current (data-entry typo guard)", () => {
  const future = { ...base, source: { ...base.source, last_verified: "2027-01-01" } };
  const v = freshnessOf(future, today);
  assert.equal(v.current, false);
  assert.equal(v.reason, "future-date");
  assert.ok(v.ageDays < 0);
  assert.equal(isCurrent(future, today), false);
});

test("unverified is never current", () => {
  const r = { ...base, verification_status: "unverified" as const };
  assert.equal(freshnessOf(r, today).reason, "unverified");
  assert.equal(isCurrent(r, today), false);
});

test("uses the default today when none is given", () => {
  assert.equal(typeof freshnessOf(base).current, "boolean");
});

// Regression: a shape-valid but impossible date used to THROW rather than return false.
// `2026-13-45` matches YYYY-MM-DD, so the regex passes, but `new Date(...)` yields an
// Invalid Date and `.toISOString()` on it raises a RangeError. The predicate therefore
// had a third outcome besides true and false, and every caller inherited it: the
// NAV_TODAY override below, whose contract is that a malformed pin is *ignored*, and
// `changes.parseSince`, where the string is user-supplied and a throw is a 500 rather
// than the 400 the route means to return.
test("isValidIsoDate returns false for an impossible date instead of throwing", () => {
  assert.equal(isValidIsoDate("2026-13-45"), false);
  assert.equal(isValidIsoDate("2026-02-30"), false, "rollover case: caught by the round-trip");
  assert.equal(isValidIsoDate("2026-00-10"), false);
  assert.equal(isValidIsoDate("not-a-date"), false);
  assert.equal(isValidIsoDate("2026-07-13"), true);
});

test("a malformed NAV_TODAY pin is ignored, as servingToday's contract says", () => {
  // Previously this raised a RangeError out of servingToday, so the serving path died
  // on the first freshness evaluation rather than falling back to the real clock.
  const pinned = servingToday({ NAV_TODAY: "2026-13-45" } as NodeJS.ProcessEnv, new Date("2026-05-31T12:00:00Z"));
  assert.equal(pinned, "2026-05-31");
  // A well-formed pin is still honoured.
  assert.equal(
    servingToday({ NAV_TODAY: "2026-01-02" } as NodeJS.ProcessEnv, new Date("2026-05-31T12:00:00Z")),
    "2026-01-02",
  );
});
