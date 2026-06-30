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
// RFC 5545 text escaping for SUMMARY values.
function escapeText(s) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/**
 * Build a VCALENDAR of undated VTODO items — one per step summary. Deliberately no
 * DTSTART/DUE: these steps have no real deadlines, so inventing dates would be dishonest.
 * Pure and exported so the test suite can assert the format without a DOM.
 */
export function buildIcs(summaries, stamp) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Trans Docs Navigator//Reminders//EN", "CALSCALE:GREGORIAN"];
  summaries.forEach((summary, i) => {
    lines.push(
      "BEGIN:VTODO",
      `UID:tdn-${i + 1}-${stamp}@trans-docs-navigator`,
      `DTSTAMP:${stamp}`,
      `SUMMARY:${escapeText(summary)}`,
      "END:VTODO",
    );
  });
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
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
    a.download = "trans-docs-reminders.ics";
    document.body.appendChild(a);
    a.click();
    a.remove();
  });
}
