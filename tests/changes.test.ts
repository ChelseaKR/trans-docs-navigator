// Packet staleness (/changes, EXP-03).
//
// The failure this page exists to avoid is not a crash. It is a person three months into
// a court-order-then-DMV sequence reading "unchanged" on a screen and walking into a
// clerk's office with a superseded fee. Without per-record changelogs (corpus schema v2,
// FIX-03) this repository does not know whether the law changed; it knows only whether
// anyone re-checked the cited page. So the strongest honest statement about a step is
// "no re-check has been recorded", and these tests hold the page to that.
//
// The other half is the ordinary contract: a later verification date reads as
// re-verified, the same date before `since` does not, a malformed or future `since` is a
// 400, and nothing on the query string is reflected into the page.

import { test } from "node:test";
import assert from "node:assert/strict";
import { handleRoute } from "../api/router.ts";
import { buildPacketChanges, parseSince, longestSlaDays } from "../api/changes.ts";
import { renderPacketPage, changesUrlFor } from "../src/pages.ts";
import { buildChecklist } from "../api/checklist.ts";
import type { CorpusRecord, Intake } from "../api/types.ts";

const u = (p: string) => new URL(p, "http://localhost:8080");
const TODAY = "2026-07-13";

const INTAKE: Intake = {
  jurisdiction: "US-CA",
  change_types: ["name"],
  documents: ["court-order"],
  language: "en",
};

/**
 * One record, fully in the shape the corpus validator accepts, so the engine is
 * exercised on the same fields the real loader produces. `last_verified` is the axis
 * every test below moves.
 */
function record(over: Partial<CorpusRecord> & { id: string; last_verified: string }): CorpusRecord {
  const { last_verified, ...rest } = over;
  return {
    jurisdiction: "US-CA",
    document_type: "court-order",
    change_type: ["name"],
    topic: "court-ordered name change",
    statement: "File a petition for change of name with the superior court in your county.",
    source: {
      url: "https://www.courts.ca.gov/example",
      title: "California Courts — Name Change",
      last_verified,
      verifier: "Pilot Seed Reviewer",
    },
    verification_status: "verified",
    recheck_sla_days: 90,
    language: "en",
    ...rest,
  } as CorpusRecord;
}

// ── The wording that carries the risk ─────────────────────────────────────────

test("a step nobody re-checked says so, and never says it is unchanged", () => {
  // Verified BEFORE the packet printed: nothing has happened since.
  const corpus = [record({ id: "us-ca-court-order-1", last_verified: "2026-06-01" })];
  const changes = buildPacketChanges(INTAKE, "2026-06-20", TODAY, corpus);

  assert.equal(changes.steps.length, 1);
  assert.equal(changes.steps[0]!.state, "no-recheck-recorded");

  // Against the REAL corpus. `since` is today, so no record's last_verified can be
  // later and every step lands in the state under test.
  const r = handleRoute("GET", u(`/changes?since=${TODAY}&jurisdiction=US-CA&change=name&doc=court-order`), TODAY);
  assert.equal(r.status, 200);
  assert.match(r.body, /No re-check has been recorded since your packet printed/);
  // The word this page may not use as a reassurance. `unchanged` appearing anywhere in
  // the rendered body would mean some template started answering a question this
  // repository cannot answer without changelogs.
  assert.doesNotMatch(r.body, /\bunchanged\b/i);
  assert.doesNotMatch(r.body, /\bstill (correct|current|accurate|right)\b/i);
});

test("the page states plainly that per-step change history does not exist yet", () => {
  const r = handleRoute("GET", u(`/changes?since=${TODAY}&jurisdiction=US-CA&change=name`), TODAY);
  assert.match(r.body, /Per-step change history is not built/);
  assert.match(r.body, /a statement about our records, not a promise that the law has stayed the same/);
  assert.equal(buildPacketChanges(INTAKE, "2026-06-20", TODAY).changelog_available, false);
});

test("the caveat is unconditional, not shown only when something looks wrong", () => {
  // A packet from yesterday, everything re-verified: the most reassuring case there is.
  // The limit still has to be on the page, because it is still true.
  const corpus = [record({ id: "us-ca-court-order-1", last_verified: TODAY })];
  const changes = buildPacketChanges(INTAKE, "2026-07-12", TODAY, corpus);
  assert.equal(changes.steps[0]!.state, "re-verified");

  const r = handleRoute("GET", u("/changes?since=2026-07-12&jurisdiction=US-CA&change=name&doc=court-order"), TODAY);
  assert.match(r.body, /Per-step change history is not built/);
});

// ── EXP-03's "Done when" ──────────────────────────────────────────────────────

test("a record verified after `since` renders re-verified at that step; before it does not", () => {
  const after = buildPacketChanges(
    INTAKE,
    "2026-06-01",
    TODAY,
    [record({ id: "us-ca-court-order-1", last_verified: "2026-06-02" })],
  );
  assert.equal(after.steps[0]!.state, "re-verified");
  assert.equal(after.steps[0]!.last_verified, "2026-06-02");

  const before = buildPacketChanges(
    INTAKE,
    "2026-06-01",
    TODAY,
    [record({ id: "us-ca-court-order-1", last_verified: "2026-05-31" })],
  );
  assert.equal(before.steps[0]!.state, "no-recheck-recorded");

  // Same day is not "since": a re-check on the day the packet printed tells the reader
  // nothing they did not already have.
  const sameDay = buildPacketChanges(
    INTAKE,
    "2026-06-01",
    TODAY,
    [record({ id: "us-ca-court-order-1", last_verified: "2026-06-01" })],
  );
  assert.equal(sameDay.steps[0]!.state, "no-recheck-recorded");
});

test("a record that has degraded since the packet printed says so", () => {
  const corpus = [
    record({ id: "us-ca-court-order-1", last_verified: "2026-06-02", verification_status: "needs_reverification" }),
  ];
  const changes = buildPacketChanges(INTAKE, "2026-06-01", TODAY, corpus);
  assert.equal(changes.steps[0]!.state, "needs-reverification");
});

test("a malformed or future `since` returns the existing bad-request page", () => {
  for (const bad of ["2026-13-45", "yesterday", "", "2026-7-1"]) {
    const r = handleRoute("GET", u(`/changes?since=${encodeURIComponent(bad)}&jurisdiction=US-CA&change=name`), TODAY);
    assert.equal(r.status, 400, `since=${bad} should be a 400`);
  }
  // A `since` in the future would make every comparison vacuous and every step read as
  // un-rechecked, which is the reassuring answer. Refused, like a future last_verified.
  assert.equal(handleRoute("GET", u("/changes?since=2027-01-01&jurisdiction=US-CA&change=name"), TODAY).status, 400);
  // A missing `since` is not defaulted to today: that would silently answer a different
  // question ("has anything changed since now") and always say no.
  assert.equal(handleRoute("GET", u("/changes?jurisdiction=US-CA&change=name"), TODAY).status, 400);
  // A malformed jurisdiction is the same 400 /checklist gives.
  assert.equal(handleRoute("GET", u("/changes?since=2026-06-01&jurisdiction=Mars"), TODAY).status, 400);
});

test("parseSince accepts a real past date and rejects everything else", () => {
  assert.equal(parseSince("2026-06-01", TODAY), "2026-06-01");
  assert.equal(parseSince(TODAY, TODAY), TODAY);
  assert.equal(parseSince("2026-07-14", TODAY), null);
  assert.equal(parseSince("2026-02-30", TODAY), null);
  assert.equal(parseSince(null, TODAY), null);
});

test("a packet older than the longest recheck window is declared unusable, from the corpus", () => {
  const corpus = [
    record({ id: "us-ca-court-order-1", last_verified: "2026-06-01", recheck_sla_days: 30 }),
    record({ id: "us-ca-court-order-2", last_verified: "2026-06-01", recheck_sla_days: 120 }),
  ];
  assert.equal(longestSlaDays(corpus), 120);

  const old = buildPacketChanges(INTAKE, "2026-01-01", TODAY, corpus);
  assert.equal(old.packet_expired, true, "193 days > the 120-day longest SLA");

  const recent = buildPacketChanges(INTAKE, "2026-06-01", TODAY, corpus);
  assert.equal(recent.packet_expired, false, "42 days < the 120-day longest SLA");

  const r = handleRoute("GET", u("/changes?since=2024-01-01&jurisdiction=US-CA&change=name"), TODAY);
  assert.match(r.body, /older than the longest window we allow between checks/);
});

test("the whole page is Spanish under ?language=es with no English leaking", () => {
  const r = handleRoute("GET", u(`/changes?since=${TODAY}&jurisdiction=US-CA&change=name&language=es`), TODAY);
  assert.equal(r.status, 200);
  assert.match(r.body, /<html lang="es">/);
  assert.match(r.body, /Qué cambió desde que imprimió su paquete/);
  assert.match(r.body, /No se ha registrado ninguna revisión desde que imprimió su paquete/);
  assert.doesNotMatch(r.body, /No re-check has been recorded|What changed since your packet/);

  // The Spanish bad-request page, same as every other route's.
  const bad = handleRoute("GET", u("/changes?since=nope&jurisdiction=US-CA&language=es"), TODAY);
  assert.equal(bad.status, 400);
});

// ── The link that has to survive onto paper ───────────────────────────────────

test("the packet prints an absolute link back to its own staleness check", () => {
  const checklist = buildChecklist(INTAKE, TODAY);
  const html = renderPacketPage(checklist, [], "en", "2026-05-31", "jurisdiction=US-CA&change=name");
  assert.match(html, /\/changes\?since=2026-05-31&amp;jurisdiction=US-CA&amp;change=name/);
  // Printed as literal text, not only as an href: a person holding paper cannot click.
  assert.match(html, />https?:\/\/[^<]*\/changes\?since=2026-05-31[^<]*</);
  // It carries the date this packet printed, not today's date.
  assert.doesNotMatch(html, /\/changes\?since=2026-07-13/);
});

test("a packet built without a canonical intake query offers no check it cannot honour", () => {
  const checklist = buildChecklist(INTAKE, TODAY);
  const html = renderPacketPage(checklist, [], "en", "2026-05-31");
  assert.doesNotMatch(html, /\/changes\?/);
});

test("the printed link keeps the reader's language", () => {
  assert.match(changesUrlFor("jurisdiction=US-CA&change=name", "2026-05-31", "es"), /&language=es$/);
  assert.doesNotMatch(changesUrlFor("jurisdiction=US-CA&change=name", "2026-05-31", "en"), /language=/);
  // Already present: not appended twice.
  const already = changesUrlFor("jurisdiction=US-CA&change=name&language=es", "2026-05-31", "es");
  assert.equal(already.match(/language=es/g)!.length, 1);
});

// ── Determinism and non-reflection ────────────────────────────────────────────

test("the same packet asked twice gives byte-identical answers", () => {
  const a = handleRoute("GET", u("/changes?since=2026-06-01&jurisdiction=US-CA&change=name"), TODAY);
  const b = handleRoute("GET", u("/changes?since=2026-06-01&jurisdiction=US-CA&change=name"), TODAY);
  assert.equal(a.body, b.body);
});

test("neither `since` nor any appended parameter is reflected into the body or the log", () => {
  const url = u("/changes?since=2026-06-01&jurisdiction=US-CA&change=name");
  url.searchParams.set("q", "SENTINEL_CHANGES_9081726354");
  url.searchParams.set("current_legal_name", "SENTINEL_CHANGES_9081726354");
  const r = handleRoute("GET", url, TODAY);
  assert.ok(!r.body.includes("SENTINEL_CHANGES_9081726354"));
  const logStr = r.log ? JSON.stringify(r.log) : "";
  assert.ok(!logStr.includes("SENTINEL_CHANGES_9081726354"));
  // `since` is the date a specific person printed a specific packet. Nothing derived
  // from it reaches the log, not the date and not the packet_expired bit.
  assert.ok(!logStr.includes("2026-06-01"));
  assert.ok(!logStr.includes("packet_expired"));
});

test("the route is disallowed to crawlers and rendered noindex", () => {
  const robots = handleRoute("GET", u("/robots.txt"), TODAY);
  assert.match(robots.body, /Disallow: \/changes/);
  const r = handleRoute("GET", u("/changes?since=2026-06-01&jurisdiction=US-CA&change=name"), TODAY);
  assert.match(r.body, /content="noindex,follow"/);
  assert.doesNotMatch(r.body, /rel="canonical"/);
});
