// Executes the real client-side modules (public/assets/*.js) against the REAL rendered
// HTML, in a jsdom DOM. This is the layer the suite was missing: previously the browser
// modules were only string-asserted ("contains localStorage"), never run — which is how
// a broken client feature could ship green. These tests drive the actual behavior and
// fold the client tier into the gated coverage number.
//
// node --test isolates each test file in its own process, so the DOM globals set here
// don't leak into other suites.

import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { buildChecklist } from "../api/checklist.ts";
import { loadCorpus } from "../api/corpus.ts";
import { formById } from "../api/forms.ts";
import { renderChecklistPage, renderFormFillPage, renderPacketPage } from "../src/pages.ts";
import { decryptState, toResumeState } from "../src/secure-resume.ts";

const corpus = loadCorpus();
const clEn = buildChecklist({ jurisdiction: "US-CA", change_types: ["name", "gender-marker"], documents: [], language: "en" });

/** Mount full page HTML in jsdom and expose its DOM as the globals the modules read. */
function mount(html: string): JSDOM {
  const dom = new JSDOM(html, { url: "http://localhost/" });
  global.window = dom.window as unknown as Window & typeof globalThis;
  global.document = dom.window.document;
  global.localStorage = dom.window.localStorage;
  return dom;
}
function fire(dom: JSDOM, el: Element, type: string) {
  el.dispatchEvent(new dom.window.Event(type, { bubbles: true }));
}

test("form-copy.js assembles a copyable block from the user's typed name (on-device)", async () => {
  const dom = mount(renderFormFillPage(formById("us-ss-5")!, "en"));
  await import("../public/assets/form-copy.js");
  const cur = dom.window.document.getElementById("copy-current") as HTMLInputElement;
  const nw = dom.window.document.getElementById("copy-new") as HTMLInputElement;
  cur.value = "Robin Old";
  nw.value = "Robin New";
  fire(dom, nw, "input");
  const out = dom.window.document.getElementById("copy-out")!;
  assert.match(out.textContent ?? "", /Current legal name: Robin Old/);
  assert.match(out.textContent ?? "", /New legal name: Robin New/);
  // Clicking copy re-builds and attempts the clipboard write (wrapped, so a headless
  // env without a clipboard still populates the visible block).
  (dom.window.document.getElementById("copy-btn") as HTMLButtonElement).click();
  assert.match(out.textContent ?? "", /Robin New/);
});

test("progress.js restores saved progress on load and persists toggles", async () => {
  const query = "jurisdiction=US-CA&change=name&change=gender-marker";
  const key = `tdn.progress.${query}`;
  const html = renderChecklistPage(clEn, corpus, "en", query);
  const dom = mount(html);
  // Pre-seed one completed step → the module should restore it on load.
  dom.window.localStorage.setItem(key, JSON.stringify(["court-order"]));
  await import("../public/assets/progress.js");

  const courtToggle = dom.window.document.querySelector('[data-step-toggle="court-order"]') as HTMLInputElement;
  assert.equal(courtToggle.checked, true, "saved step restored as checked");
  const courtLi = dom.window.document.querySelector('[data-step="court-order"]')!;
  assert.ok(courtLi.classList.contains("done"), "saved step visually marked done");
  const counter = dom.window.document.getElementById("progress-count")!;
  assert.match(counter.textContent ?? "", /1 of \d+ steps done/);

  // Toggle a second step → persisted to localStorage and counter advances.
  const ssa = dom.window.document.querySelector('[data-step-toggle="ssa-card"]') as HTMLInputElement;
  ssa.checked = true;
  fire(dom, ssa, "change");
  const saved = JSON.parse(dom.window.localStorage.getItem(key) ?? "[]");
  assert.ok(saved.includes("court-order") && saved.includes("ssa-card"), "toggle persisted locally");
  assert.match(counter.textContent ?? "", /2 of \d+ steps done/);
});

test("resume-panel.js encrypts only the selection to localStorage and round-trips", async () => {
  const query = "jurisdiction=US-CA&change=name&new_legal_name=SHOULD_NOT_PERSIST";
  const dom = mount(renderChecklistPage(clEn, corpus, "en", query));
  // @ts-expect-error test shim: resume-panel sets location.href on load
  global.location = { href: "" };
  await import("../public/assets/resume-panel.js");

  const pass = dom.window.document.getElementById("resume-pass") as HTMLInputElement;
  pass.value = "correct horse battery staple";
  (dom.window.document.getElementById("resume-save") as HTMLButtonElement).click();
  // Save runs PBKDF2 (600k iterations) + AES-GCM, which takes a beat — poll for it.
  let blob: string | null = null;
  for (let i = 0; i < 60 && !blob; i++) {
    await new Promise((r) => setTimeout(r, 100));
    blob = dom.window.localStorage.getItem("tdn.resume");
  }
  assert.ok(blob && blob.length > 0, "encrypted blob saved");
  // Round-trips through the real PBKDF2/AES-GCM, and only the allowlisted selection was
  // saved — the identity field is never persisted.
  const expected = toResumeState(new URLSearchParams(query)).toString();
  const decrypted = await decryptState(blob!, "correct horse battery staple");
  assert.equal(decrypted, expected);
  assert.doesNotMatch(decrypted, /SHOULD_NOT_PERSIST/);

  // Resume (load): decrypts and navigates back to the saved selection.
  // @ts-expect-error test shim
  global.location = { href: "" };
  (dom.window.document.getElementById("resume-load") as HTMLButtonElement).click();
  for (let i = 0; i < 60 && !global.location.href; i++) await new Promise((r) => setTimeout(r, 100));
  assert.equal(global.location.href, `/checklist?${expected}`);

  // Delete: clears the saved blob.
  (dom.window.document.getElementById("resume-del") as HTMLButtonElement).click();
  assert.equal(dom.window.localStorage.getItem("tdn.resume"), null);

  // Wrong passphrase surfaces an error rather than leaking anything.
  dom.window.localStorage.setItem("tdn.resume", blob!);
  pass.value = "wrong passphrase";
  const status = dom.window.document.getElementById("resume-status")!;
  (dom.window.document.getElementById("resume-load") as HTMLButtonElement).click();
  for (let i = 0; i < 60 && !(status.textContent ?? ""); i++) await new Promise((r) => setTimeout(r, 100));
  assert.ok((status.textContent ?? "").length > 0, "wrong passphrase shows a message");
});

test("packet.js wires the print button", async () => {
  const cl = buildChecklist({ jurisdiction: "US-CA", change_types: ["name"], documents: [], language: "en" });
  const dom = mount(renderPacketPage(cl, corpus, "en", "2026-06-16"));
  let printed = false;
  dom.window.print = () => { printed = true; };
  await import("../public/assets/packet.js");
  (dom.window.document.getElementById("print-btn") as HTMLButtonElement).click();
  assert.equal(printed, true);
});

test("reminders.js downloads an undated, escaped, client-side .ics of the steps (E6)", async () => {
  // Mount the checklist DOM BEFORE the first import: the module binds its button listener
  // at import time, and node caches the module across tests.
  const dom = mount(renderChecklistPage(clEn, corpus, "en", "jurisdiction=US-CA&change=name"));
  // Capture the would-be download instead of needing a real navigation/Blob in jsdom.
  let href = "";
  let name = "";
  dom.window.HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
    href = this.href;
    name = this.getAttribute("download") ?? "";
  };
  const mod = await import("../public/assets/reminders.js");
  (dom.window.document.getElementById("ics-btn") as HTMLButtonElement).click();
  assert.ok(href.startsWith("data:text/calendar"), "saved as a client-side data: URL — nothing sent to a server");
  assert.match(name, /\.ics$/);

  // Pure builder: real step titles become tasks; escaped; no invented deadlines.
  const titles = [...dom.window.document.querySelectorAll("[data-step] .step-head h2")].map((h) => (h.textContent || "").trim());
  assert.ok(titles.length > 0);
  const ics = mod.buildIcs([...titles, "a, b; c"], "20260630T000000Z");
  assert.match(ics, /BEGIN:VCALENDAR/);
  assert.match(ics, /END:VCALENDAR/);
  assert.equal((ics.match(/BEGIN:VTODO/g) ?? []).length, titles.length + 1); // one task per step
  assert.match(ics, /SUMMARY:Step 1: Get a court order for your name change/); // a real step → a task
  assert.match(ics, /SUMMARY:a\\, b\\; c/); // RFC 5545 escaping of , and ;
  assert.doesNotMatch(ics, /DTSTART|DUE/); // no invented deadlines
  assert.match(ics, /\r\n/); // CRLF line endings
});
