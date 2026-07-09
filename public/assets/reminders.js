// Privacy-safe reminders (RESEARCH-ROADMAP E6): turn the on-screen checklist into a
// downloadable .ics task list, entirely in the browser. It reads only the step titles
// already on the page, invents no deadlines (the steps have none — their timelines are
// "typical", not due dates), carries no contact info, and sends nothing anywhere: the
// file is built into a data: URL and saved on the user's own device, consistent with the
// project's "nothing leaves the device" posture. Progressive enhancement — no button, no
// behavior without JS.

function pad2(n) {
  return String(n).padStart(2, "0");
}
function icsStamp(d) {
  return (
    d.getUTCFullYear() +
    pad2(d.getUTCMonth() + 1) +
    pad2(d.getUTCDate()) +
    "T" +
    pad2(d.getUTCHours()) +
    pad2(d.getUTCMinutes()) +
    pad2(d.getUTCSeconds()) +
    "Z"
  );
}
// RFC 5545 text escaping for SUMMARY values (handles \r\n, lone \n, and lone \r).
function escapeText(s) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r\n|\r|\n/g, "\\n");
}

// RFC 5545 §3.1 line folding: a content line SHOULD NOT be longer than 75 octets
// (excluding CRLF). Fold with CRLF + one space; continuation content is capped at 74
// octets so the leading space keeps each physical line within 75. Byte-aware (UTF-8 via
// TextEncoder) so multi-byte characters are never split mid-sequence.
function foldLine(line) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const parts = [];
  let cur = "";
  let curBytes = 0;
  let budget = 75; // first physical line
  for (const ch of line) {
    const chBytes = enc.encode(ch).length;
    if (curBytes + chBytes > budget) {
      parts.push(cur);
      cur = "";
      curBytes = 0;
      budget = 74; // continuation lines spend 1 octet on the leading space
    }
    cur += ch;
    curBytes += chBytes;
  }
  if (cur) parts.push(cur);
  return parts.join("\r\n ");
}

/**
 * Build a VCALENDAR of undated VTODO items — one per step summary. Deliberately no
 * DTSTART/DUE: these steps have no real deadlines, so inventing dates would be dishonest.
 * Pure and exported so the test suite can assert the format without a DOM.
 */
export function buildIcs(summaries, stamp) {
  // PRODID/UID/filename are deliberately neutral: the .ics is designed to be imported
  // into calendar apps (often cloud-synced), so the artifact itself must not brand the
  // user's device or calendar with the product name (DPIA 2026-07-09 row).
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Reminders//EN", "CALSCALE:GREGORIAN"];
  summaries.forEach((summary, i) => {
    lines.push(
      "BEGIN:VTODO",
      `UID:${i + 1}-${stamp}@reminders.local`,
      `DTSTAMP:${stamp}`,
      `SUMMARY:${escapeText(summary)}`,
      "END:VTODO",
    );
  });
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

const btn = document.getElementById("ics-btn");
if (btn) {
  btn.addEventListener("click", () => {
    const summaries = [...document.querySelectorAll("[data-step] .step-head h2")]
      .map((h) => (h.textContent || "").trim())
      .filter(Boolean);
    if (summaries.length === 0) return;
    const ics = buildIcs(summaries, icsStamp(new Date()));
    const a = document.createElement("a");
    a.href = "data:text/calendar;charset=utf-8," + encodeURIComponent(ics);
    a.download = "reminders.ics"; // neutral filename — see PRODID note above
    document.body.appendChild(a);
    a.click();
    a.remove();
  });
}
