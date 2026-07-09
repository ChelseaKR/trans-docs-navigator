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

test("buildIcs escapes a lone carriage return as \\n (RFC 5545 TEXT)", () => {
  const ics = buildIcs(["carriage\rreturn"], STAMP);
  assert.ok(ics.includes("SUMMARY:carriage\\nreturn"), "lone \\r must become \\n, not leak raw");
  assert.ok(!/SUMMARY:[^\r\n]*\r(?!\n)/.test(ics), "no raw lone CR may survive in content");
});

test("buildIcs folds long lines at 75 octets (RFC 5545 §3.1) and unfolds losslessly", () => {
  const long = "Update your driver's license, state ID, and vehicle registration at the department of motor vehicles ".repeat(2).trim();
  const ics = buildIcs([long], STAMP);
  const enc = new TextEncoder();
  for (const line of ics.split("\r\n")) {
    assert.ok(enc.encode(line).length <= 75, `physical line exceeds 75 octets: ${line.length} chars`);
  }
  // Unfolding (strip CRLF + single space) must reconstruct the logical line.
  const unfolded = ics.replace(/\r\n /g, "");
  assert.ok(unfolded.includes(`SUMMARY:${long.replaceAll(",", "\\,")}`));
});

test("buildIcs folding never splits a multi-byte character", () => {
  const accented = "Actualicé la información del pasaporte y de la matrícula ".repeat(3).trim();
  const ics = buildIcs([accented], STAMP);
  const enc = new TextEncoder();
  for (const line of ics.split("\r\n")) {
    assert.ok(enc.encode(line).length <= 75);
  }
  const unfolded = ics.replace(/\r\n /g, "");
  assert.ok(unfolded.includes(accented.replaceAll(",", "\\,")), "multi-byte content survives folding intact");
});

test("the .ics artifact carries no product branding (device/calendar discoverability)", () => {
  const ics = buildIcs(["Get a court order"], STAMP);
  assert.ok(!/trans[- ]docs/i.test(ics), "PRODID/UID must not brand the artifact");
  assert.match(ics, /PRODID:-\/\/Reminders\/\/EN/);
  assert.match(ics, /UID:1-20260101T000000Z@reminders\.local/);
});
