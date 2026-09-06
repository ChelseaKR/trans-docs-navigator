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

/**
 * Matches an EXECUTABLE INLINE `<script>` — a script start tag carrying neither `src=` nor a
 * data `type=`. The pages below legitimately emit `<script type="module" src="/assets/…">`
 * (external behaviour) and `<script type="application/json">` / `application/ld+json`
 * (inert config islands and structured data); neither is inline code, and both must pass.
 *
 * The assertions below used to be `assert.doesNotMatch(h, /<script>/)`, which CodeQL flagged
 * as js/bad-tag-filter and which was a genuinely weak guard: it only ever recognized the
 * tight, attribute-less spelling. `<script >`, `<script\n>` and `<script type="text/javascript">`
 * are all executed by a browser and all sailed straight past it, so the assertion attested to
 * a property ("no inline script") much narrower than the one it claimed. On this repo that
 * assertion is the test-side half of a privacy control: the CSP is `script-src 'self'`, and
 * these tests are what would catch a template regressing to inline code before the CSP has to.
 */
const INLINE_SCRIPT = /<script\b(?![^>]*(?:\bsrc=|\btype="application\/(?:ld\+)?json"))[^>]*>/i;

test("intake page states the private-mode request and local-state boundary", () => {
  const h = renderIntakePage("en");
  assert.match(h, /Private mode: no account or saved session/);
  assert.match(h, /request metadata may be retained as described in Privacy/);
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
  assert.doesNotMatch(h, INLINE_SCRIPT); // strict CSP: no inline script
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
  // Anchored to the scheme so the host boundary is exact: an unanchored `selfhelp.courts.ca.gov`
  // (CodeQL js/regex/missing-regexp-anchor) is also satisfied by `evil-selfhelp.courts.ca.gov.example`
  // or by the bare string appearing in prose, neither of which is the cited official source.
  assert.match(h, /href="https:\/\/selfhelp\.courts\.ca\.gov\//); // the real cited source url
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
  assert.match(packet, /cambia su nombre legal presentando documentos en la corte/);
});

test("form page links to the official source and never auto-fills", () => {
  for (const id of ["us-ss-5", "us-ds-82", "ca-nc-200"]) {
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
  assert.doesNotMatch(h, INLINE_SCRIPT); // strict CSP: no inline script
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
  assert.doesNotMatch(h, INLINE_SCRIPT); // CSP is script-src 'self'; nothing inline
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

test("checklist page surfaces gaps for an uncovered jurisdiction", () => {
  // US-AK: genuinely uncovered (see tests/coverage-honesty.test.ts's UNCOVERED) after
  // this PR's US-AL/MS/LA addition — this fixture has swapped states before as each
  // gained corpus coverage.
  const cl = buildChecklist({ jurisdiction: "US-AK", change_types: ["name"], documents: ["court-order"], language: "en" });
  const h = renderChecklistPage(cl, corpus, "en", "jurisdiction=US-AK&change=name");
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

// ── REGRESSION (CodeQL js/bad-tag-filter) ─────────────────────────────────────────────
// The three "no inline script" assertions above were `assert.doesNotMatch(h, /<script>/)`,
// which recognizes only the tight, attribute-less start tag. Every spelling below is
// executed by a browser and was invisible to that regex, so an inline script could have been
// added to any of these templates without a single test going red.
//
// THIS TEST FAILS ON THE UNFIXED CODE: substitute `/<script>/` for INLINE_SCRIPT and the
// first four cases assert "matched" against a pattern that cannot match them.
test("REGRESSION: the inline-script guard recognizes every spelling a browser executes", () => {
  for (const evil of [
    "<p>x</p><script >alert(1)</script >", // whitespace before the closing angle
    "<p>x</p><script\n>alert(1)</script\n>", // newline before it
    '<p>x</p><script type="text/javascript">alert(1)</script>', // legacy executable type
    '<p>x</p><script async>alert(1)</script>', // bare boolean attribute
    "<p>x</p><script>alert(1)</script>", // the one spelling the old regex did catch
  ]) {
    assert.match(evil, INLINE_SCRIPT, `inline script not detected in: ${JSON.stringify(evil)}`);
  }

  // ...and it must stay quiet about the script elements these pages legitimately emit,
  // or the assertions above would fail on real output and get weakened again.
  for (const ok of [
    '<script type="module" src="/assets/progress.js"></script>',
    '<script src="/assets/packet.js"></script>',
    '<script type="application/json" id="progress-cfg">{"a":1}</script>',
    '<script type="application/ld+json">{"@type":"HowTo"}</script>',
  ]) {
    assert.doesNotMatch(ok, INLINE_SCRIPT, `false positive on: ${ok}`);
  }
});
