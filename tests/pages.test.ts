// M5 experience + a11y tests: ephemeral affordances, the printable packet, Spanish
// rendering, and keyboard-path structural properties (no positive tabindex, skip-link
// target present, all interactive controls reachable in source order).

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildChecklist } from "../api/checklist.ts";
import { loadCorpus } from "../api/corpus.ts";
import { renderIntakePage, renderChecklistPage, renderPacketPage, renderFormFillPage } from "../src/pages.ts";
import { formById } from "../api/forms.ts";

const corpus = loadCorpus();
const clEn = buildChecklist({ jurisdiction: "US-CA", change_types: ["name", "gender-marker"], documents: [], language: "en" });
const clEs = buildChecklist({ jurisdiction: "US-CA", change_types: ["name"], documents: [], language: "es" });

test("intake page states the ephemeral/private posture", () => {
  const h = renderIntakePage("en");
  assert.match(h, /Private mode: no account, nothing saved/);
});

test("checklist page links to the packet (carrying the query) and start-over", () => {
  const h = renderChecklistPage(clEn, corpus, "en", "jurisdiction=US-CA&change=name");
  assert.match(h, /href="\/packet\?jurisdiction=US-CA&change=name"/);
  assert.match(h, /href="\/">/); // start over
});

test("printable packet renders full steps, sources, prepared date, and print control", () => {
  const h = renderPacketPage(clEn, corpus, "en", "2026-05-31");
  assert.match(h, /window\.print\(\)/);
  assert.match(h, /Prepared on 2026-05-31/);
  assert.match(h, /Petition for Change of Name/); // statement
  assert.match(h, /selfhelp\.courts\.ca\.gov/); // source url
  // Print stylesheet hides nav and expands link URLs.
  assert.match(h, /@media print/);
  assert.match(h, /\.no-print/);
});

test("Spanish pages render in Spanish", () => {
  const intake = renderIntakePage("es");
  assert.match(intake, /<html lang="es">/);
  assert.match(intake, /Modo privado/);
  const packet = renderPacketPage(clEs, corpus, "es", "2026-05-31");
  assert.match(packet, /Preparado el/);
  assert.match(packet, /Petición para Cambio de Nombre/);
});

test("non-fillable form degrades to a download link, not a fill form", () => {
  const ds82 = renderFormFillPage(formById("us-ds-82")!, "en");
  assert.match(ds82, /flat scan/);
  assert.doesNotMatch(ds82, /id="fill"/); // no client fill form
});

test("encrypted save/resume panel renders with a labeled passphrase when there's a selection", () => {
  const h = renderChecklistPage(clEn, corpus, "en", "jurisdiction=US-CA&change=name");
  assert.match(h, /Save your progress/);
  assert.match(h, /id="resume-pass"/);
  assert.match(h, /for="resume-pass"/); // labeled (a11y)
  assert.match(h, /AES-GCM/); // client-side encryption present
  assert.match(h, /localStorage/); // local-only, no server
  assert.doesNotMatch(h, /current_legal_name|new_legal_name/); // never persists identity
});

test("resume panel is hidden when there is no selection yet (progressive enhancement)", () => {
  const h = renderChecklistPage(clEn, corpus, "en", "");
  assert.doesNotMatch(h, /id="resume-pass"/);
});

test("checklist page surfaces gaps for an uncovered jurisdiction", () => {
  const cl = buildChecklist({ jurisdiction: "US-NV", change_types: ["name"], documents: ["court-order"], language: "en" });
  const h = renderChecklistPage(cl, corpus, "en", "jurisdiction=US-NV&change=name");
  assert.match(h, /Not yet covered/);
});

test("keyboard-path: no positive tabindex, skip link has a target, controls have labels", () => {
  const fillForm = renderFormFillPage(formById("us-ss-5")!, "en");
  for (const h of [renderIntakePage("en"), renderChecklistPage(clEn, corpus, "en"), renderPacketPage(clEn, corpus, "en", "2026-05-31"), fillForm]) {
    // No positive tabindex (would break source order).
    assert.equal((h.match(/tabindex="[1-9]/g) ?? []).length, 0);
    // Skip link points at an existing landmark.
    if (h.includes('href="#main"')) assert.match(h, /id="main"/);
    // Every text input has a matching label[for].
    for (const m of h.matchAll(/<input[^>]*\bid="([^"]+)"[^>]*>/g)) {
      assert.ok(h.includes(`for="${m[1]}"`), `input ${m[1]} lacks a label`);
    }
  }
});
