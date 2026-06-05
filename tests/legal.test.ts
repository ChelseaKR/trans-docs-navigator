import { test } from "node:test";
import assert from "node:assert/strict";
import { renderTermsPage, renderPrivacyPage, renderAccessibilityPage, LEGAL_EFFECTIVE_DATE } from "../src/legal.ts";
import { handleRoute } from "../api/router.ts";

const u = (p: string) => new URL(p, "http://localhost:8080");

test("Terms page states the key protective clauses", () => {
  const h = renderTermsPage("en");
  assert.match(h, /Terms of Use/);
  assert.match(h, /not legal advice/i);
  assert.match(h, /attorney.?client relationship/i);
  assert.match(h, /not a filing service/i);
  assert.match(h, /verify before you act|confirm the current rule/i);
  assert.match(h, new RegExp(LEGAL_EFFECTIVE_DATE));
});

test("Privacy page states the zero-server-PII posture", () => {
  const h = renderPrivacyPage("en");
  assert.match(h, /Privacy Notice/);
  assert.match(h, /collect essentially nothing/i);
  assert.match(h, /never sent to a server/i);
  assert.match(h, /no.*trackers|no cookies/i);
});

test("Accessibility page commits to WCAG 2.2 AA and is honest about the manual gate", () => {
  const h = renderAccessibilityPage("en");
  assert.match(h, /WCAG 2.2/);
  assert.match(h, /manual screen-reader/i);
});

test("legal pages render in Spanish", () => {
  assert.match(renderTermsPage("es"), /Términos de uso/);
  assert.match(renderPrivacyPage("es"), /Aviso de privacidad/);
  assert.match(renderAccessibilityPage("es"), /Declaración de accesibilidad/);
  // Spanish footer links preserve language.
  assert.match(renderTermsPage("es"), /href="\/privacy\?language=es"/);
});

test("routes serve the legal pages and preserve language", () => {
  for (const path of ["/terms", "/privacy", "/accessibility"]) {
    const r = handleRoute("GET", u(path));
    assert.equal(r.status, 200);
  }
  const es = handleRoute("GET", u("/terms?language=es"));
  assert.match(es.body, /Términos de uso/);
});

test("every page footer links to terms, privacy, and accessibility", () => {
  const home = handleRoute("GET", u("/")).body;
  assert.match(home, /href="\/terms"/);
  assert.match(home, /href="\/privacy"/);
  assert.match(home, /href="\/accessibility"/);
});

test("checklist and form-fill carry contextual legal notes", () => {
  const checklist = handleRoute("GET", u("/checklist?jurisdiction=US-CA&change=name")).body;
  assert.match(checklist, /not legal advice/i);
  assert.match(checklist, /official source/i);
});
