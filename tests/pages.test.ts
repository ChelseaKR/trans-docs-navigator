// M5 experience + a11y tests: ephemeral affordances, the printable packet, Spanish
// rendering, and keyboard-path structural properties (no positive tabindex, skip-link
// target present, all interactive controls reachable in source order).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildChecklist } from "../api/checklist.ts";
import { loadCorpus } from "../api/corpus.ts";
import { renderIntakePage, renderChecklistPage, renderPacketPage, renderFormFillPage } from "../src/pages.ts";
import { STYLE } from "../src/render.ts";
import { formById } from "../api/forms.ts";

const corpus = loadCorpus();
const clEn = buildChecklist({ jurisdiction: "US-CA", change_types: ["name", "gender-marker"], documents: [], language: "en" });
const clEs = buildChecklist({ jurisdiction: "US-CA", change_types: ["name"], documents: [], language: "es" });

test("intake page states the ephemeral/private posture", () => {
  const h = renderIntakePage("en");
  assert.match(h, /Private mode: no account, nothing saved/);
});

test("intake lets any state be selected (grouped), with a coverage note", () => {
  const h = renderIntakePage("en");
  assert.match(h, /<optgroup label="Fully covered">/);
  assert.match(h, /<optgroup label="Other states/);
  assert.match(h, /Montana/); // an uncovered state is selectable
  assert.match(h, /Florida/);
  assert.match(h, /We fully cover California/); // coverage expectation set up front
});

test("an uncovered state gets an honest banner + federal steps + referrals, not a dead end", () => {
  const oh = buildChecklist({ jurisdiction: "US-OH", change_types: ["name"], documents: [], language: "en" });
  const h = renderChecklistPage(oh, corpus, "en", "jurisdiction=US-OH&change=name");
  assert.match(h, /fully cover Ohio yet/); // names the state honestly
  assert.match(h, /Social Security/); // federal step still shown
  assert.match(h, /ID Documents Center/); // the all-50-states lifeline
});

test("checklist page links to the packet (carrying the query) and start-over", () => {
  const h = renderChecklistPage(clEn, corpus, "en", "jurisdiction=US-CA&change=name");
  assert.match(h, /href="\/packet\?jurisdiction=US-CA&change=name"/);
  assert.match(h, /href="\/">/); // start over
});

test("checklist surfaces the official form for steps backed by a form", () => {
  const h = renderChecklistPage(clEn, corpus, "en", "jurisdiction=US-CA&change=name");
  assert.match(h, /href="\/forms\/[a-z0-9-]+"/); // the form is reachable from the flow
  assert.match(h, /Get the official form/);
});

test("checklist shows a plan summary, progress toggles, and deeper links", () => {
  const h = renderChecklistPage(clEn, corpus, "en", "jurisdiction=US-CA&change=name");
  assert.match(h, /class="plan-summary"/);
  assert.match(h, /<strong>\d+ steps<\/strong>/);
  assert.match(h, /data-step-toggle=/); // per-step progress
  assert.match(h, /id="progress-cfg"/);
  assert.match(h, /\/assets\/progress\.js/);
  assert.match(h, /href="\/guide\/california\/name-change"/); // matching state guide
  assert.match(h, /href="\/answer\?jurisdiction=US-CA&change=name"/); // grounded Q&A
  assert.doesNotMatch(h, /<script>/); // strict CSP: no inline script
});

test("progress is local-only with no network egress", () => {
  const js = readFileSync(join(import.meta.dirname, "..", "public", "assets", "progress.js"), "utf8");
  assert.match(js, /localStorage/);
  assert.doesNotMatch(js, /fetch\(|XMLHttpRequest|navigator\.sendBeacon/);
});

test("printable packet renders full steps, sources, prepared date, and print control", () => {
  const h = renderPacketPage(clEn, corpus, "en", "2026-05-31");
  assert.match(h, /id="print-btn"/); // wired by the static /assets/packet.js module
  assert.match(h, /\/assets\/packet\.js/);
  assert.match(h, /Prepared on 2026-05-31/);
  assert.match(h, /Petition for Change of Name/); // statement
  assert.match(h, /selfhelp\.courts\.ca\.gov/); // source url
  // Print stylesheet (linked, served from the same STYLE constant) hides nav and expands link URLs.
  assert.match(h, /<link rel="stylesheet" href="\/assets\/app\.css">/);
  assert.match(STYLE, /@media print/);
  assert.match(STYLE, /\.no-print/);
});

test("Spanish pages render in Spanish", () => {
  const intake = renderIntakePage("es");
  assert.match(intake, /<html lang="es">/);
  assert.match(intake, /Modo privado/);
  const packet = renderPacketPage(clEs, corpus, "es", "2026-05-31");
  assert.match(packet, /Preparado el/);
  assert.match(packet, /Petición para Cambio de Nombre/);
});

test("form page links to the official source and never auto-fills", () => {
  for (const id of ["us-ss-5", "us-ds-82", "ca-nc-100"]) {
    const h = renderFormFillPage(formById(id)!, "en");
    assert.match(h, /rel="noopener noreferrer"/); // links out to the official form
    assert.match(h, /complete it yourself/); // honest: we don't fill it
    assert.doesNotMatch(h, /id="fill"/); // no client fill form
    assert.doesNotMatch(h, /pdf-lib|PDFLib/); // no fake-fill machinery
  }
});

test("form page offers an on-device copy-helper that can't submit anything", () => {
  const h = renderFormFillPage(formById("us-ss-5")!, "en");
  assert.match(h, /id="copy-current"/);
  assert.match(h, /id="copy-new"/);
  assert.match(h, /for="copy-current"/); // labelled (a11y)
  assert.match(h, /\/assets\/form-copy\.js/);
  assert.doesNotMatch(h, /<form/); // no form element → nothing can be submitted
  assert.doesNotMatch(h, /<input[^>]*\bname=/); // inputs have no name → never serialized to a request
  assert.doesNotMatch(h, /<script>/); // strict CSP: no inline script
});

test("the copy-helper is local-only with no network egress", () => {
  const js = readFileSync(join(import.meta.dirname, "..", "public", "assets", "form-copy.js"), "utf8");
  assert.match(js, /clipboard/);
  assert.doesNotMatch(js, /fetch\(|XMLHttpRequest|navigator\.sendBeacon|FormData/);
});

test("encrypted save/resume panel renders with a labeled passphrase when there's a selection", () => {
  const h = renderChecklistPage(clEn, corpus, "en", "jurisdiction=US-CA&change=name");
  assert.match(h, /Save your progress/);
  assert.match(h, /id="resume-pass"/);
  assert.match(h, /for="resume-pass"/); // labeled (a11y)
  assert.match(h, /id="resume-cfg"/); // config island for the static module
  assert.match(h, /\/assets\/resume-panel\.js/); // behavior is external — no inline script
  assert.doesNotMatch(h, /<script>/); // CSP is script-src 'self'; nothing inline
  assert.doesNotMatch(h, /current_legal_name|new_legal_name/); // never persists identity
});

test("the client resume module encrypts via the same single-source crypto (local-only)", () => {
  const panel = readFileSync(join(import.meta.dirname, "..", "public", "assets", "resume-panel.js"), "utf8");
  assert.match(panel, /from "\.\/resume-crypto\.js"/); // single source of truth
  assert.match(panel, /localStorage/); // local-only, no server
  assert.doesNotMatch(panel, /fetch\(|XMLHttpRequest|navigator\.sendBeacon/); // nothing leaves the device
  const cryptoSrc = readFileSync(join(import.meta.dirname, "..", "public", "assets", "resume-crypto.js"), "utf8");
  assert.match(cryptoSrc, /AES-GCM/);
  assert.match(cryptoSrc, /600000/); // PBKDF2 iterations (OWASP 2023)
});

test("resume panel is hidden when there is no selection yet (progressive enhancement)", () => {
  const h = renderChecklistPage(clEn, corpus, "en", "");
  assert.doesNotMatch(h, /id="resume-pass"/);
});

test("a degraded (needs-reverification) step still shows the official source + why + safest action", () => {
  const tx = buildChecklist({ jurisdiction: "US-TX", change_types: ["gender-marker"], documents: [], language: "en" });
  const h = renderChecklistPage(tx, corpus, "en", "jurisdiction=US-TX&change=gender-marker");
  assert.match(h, /Needs reverification/);
  assert.match(h, /rel="noopener noreferrer"/); // official source link is NOT stripped on a degraded step
  assert.match(h, /changing or being challenged/); // the "why"
  assert.match(h, /Safest thing to do today/); // the escape hatch
});

test("checklist always offers a human lifeline and a sensitive-situations note", () => {
  const h = renderChecklistPage(clEn, corpus, "en", "jurisdiction=US-CA&change=name");
  assert.match(h, /Get help from a real person/);
  assert.match(h, /ID Documents Center/); // the all-50-states referral
  assert.match(h, /your situation is sensitive/);
});

test("the court-order step carries a public-record / confidential-filing warning", () => {
  const h = renderChecklistPage(clEn, corpus, "en", "jurisdiction=US-CA&change=name");
  assert.match(h, /public record/);
});

test("fee-waiver help and an honest cost note appear for budget-anxious users", () => {
  const h = renderChecklistPage(clEn, corpus, "en", "jurisdiction=US-CA&change=name");
  assert.match(h, /ask for a fee waiver/); // make-or-break step for low income
  assert.match(h, /Form FW-001/);
  assert.match(h, /Costs vary by state and county/);
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
