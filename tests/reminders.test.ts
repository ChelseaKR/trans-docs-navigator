// Privacy-safe .ics reminders (C2): buildIcs turns step titles into an undated VTODO
// list, entirely client-side (no server, no contact info, no invented dates).

import { test } from "node:test";
import assert from "node:assert/strict";

// reminders.js is a browser module: on import it looks for #ics-btn to wire a click
// handler (progressive enhancement — no button, no behavior). Stub the minimal DOM
// surface it touches at load time so the module can be imported under plain Node to
// exercise its pure, exported buildIcs(); this changes nothing about the shipped file.
(globalThis as { document?: { getElementById: (id: string) => null } }).document ??= {
  getElementById: () => null,
};

const { buildIcs } = await import("../public/assets/reminders.js");

const STAMP = "20260101T000000Z";

test("buildIcs starts with BEGIN:VCALENDAR and ends with END:VCALENDAR", () => {
  const ics = buildIcs(["Get a court order"], STAMP);
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /END:VCALENDAR\r\n$/);
});

test("buildIcs emits one BEGIN:VTODO per summary", () => {
  const summaries = ["Get a court order", "Update your SSA record", "Update your driver's license"];
  const ics = buildIcs(summaries, STAMP);
  const begins = ics.match(/BEGIN:VTODO/g) ?? [];
  const ends = ics.match(/END:VTODO/g) ?? [];
  assert.equal(begins.length, summaries.length);
  assert.equal(ends.length, summaries.length);
  for (const summary of summaries) {
    assert.ok(ics.includes(`SUMMARY:${summary}`), `should contain SUMMARY for "${summary}"`);
  }
});

test("buildIcs escapes semicolons and commas per RFC 5545", () => {
  const ics = buildIcs(["Name, gender marker; both"], STAMP);
  assert.ok(ics.includes("SUMMARY:Name\\, gender marker\\; both"), "should escape , and ;");
});

test("buildIcs escapes backslashes and newlines per RFC 5545", () => {
  const ics = buildIcs(["Back\\slash and\nnewline"], STAMP);
  assert.ok(ics.includes("SUMMARY:Back\\\\slash and\\nnewline"));
});

test("buildIcs omits DTSTART and DUE (steps have no real deadlines)", () => {
  const ics = buildIcs(["Get a court order", "Update your SSA record"], STAMP);
  assert.ok(!ics.includes("DTSTART"), "should never invent a start date");
  assert.ok(!ics.includes("DUE:"), "should never invent a due date");
});

test("buildIcs includes DTSTAMP and a unique UID per item", () => {
  const ics = buildIcs(["A", "B"], STAMP);
  assert.match(ics, new RegExp(`DTSTAMP:${STAMP}`, "g"));
  const uids = [...ics.matchAll(/UID:([^\r\n]+)/g)].map((m) => m[1]);
  assert.equal(uids.length, 2);
  assert.equal(new Set(uids).size, 2, "UIDs must be unique");
});

test("buildIcs with no summaries still produces a valid, empty calendar", () => {
  const ics = buildIcs([], STAMP);
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /END:VCALENDAR\r\n$/);
  assert.ok(!ics.includes("BEGIN:VTODO"));
});
