import { test } from "node:test";
import assert from "node:assert/strict";
import { freshnessOf, isCurrent, staleButMarkedCurrent } from "../api/freshness.ts";
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
