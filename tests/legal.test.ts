import { test } from "node:test";
import assert from "node:assert/strict";
import { renderTermsPage, renderPrivacyPage, renderAccessibilityPage, renderMethodologyPage, LEGAL_EFFECTIVE_DATE } from "../src/legal.ts";
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

test("Privacy page distinguishes server requests from local-only identity fields", () => {
  const h = renderPrivacyPage("en");
  assert.match(h, /Privacy Notice/);
  assert.match(h, /browser sends.*optional free-text question.*server/i);
  assert.match(h, /form helper does not transmit your name/i);
  assert.match(h, /bounded in-memory cache/i);
  assert.match(h, /14 days/i);
  assert.match(h, /same-origin requests.*offline shell/i);
  assert.match(h, /Opening a saved copy while offline makes no fresh request/i);
  assert.doesNotMatch(h, /Nothing you type is sent/i);
  assert.doesNotMatch(h, /Saving never sends anything/i);
  assert.match(h, /no.*trackers|no cookies/i);
});

test("Accessibility page commits to WCAG 2.2 AA and is honest about the manual gate", () => {
  const h = renderAccessibilityPage("en");
  assert.match(h, /WCAG 2.2/);
  assert.match(h, /manual screen-reader/i);
});

test("Methodology page documents sourcing, verification, and the partner-review cadence", () => {
  const h = renderMethodologyPage("en");
  assert.match(h, /How We Source/);
  assert.match(h, /official government source/i);
  assert.match(h, /last checked|needs reverification/i);
  assert.match(h, /report an error|law changed/i);
  assert.match(h, /quarterly/i);
  assert.match(h, /partner/i);
  assert.match(h, new RegExp(LEGAL_EFFECTIVE_DATE));
});

test("legal pages render in Spanish", () => {
  assert.match(renderTermsPage("es"), /Términos de uso/);
  assert.match(renderPrivacyPage("es"), /Aviso de privacidad/);
  assert.match(renderPrivacyPage("es"), /solicitudes explícitas al mismo origen/i);
  assert.match(renderAccessibilityPage("es"), /Declaración de accesibilidad/);
  assert.match(renderMethodologyPage("es"), /Cómo obtenemos y verificamos/);
  // Spanish footer links preserve language.
  assert.match(renderTermsPage("es"), /href="\/privacy\?language=es"/);
});

test("routes serve the legal pages and preserve language", () => {
  for (const path of ["/terms", "/privacy", "/accessibility", "/methodology"]) {
    const r = handleRoute("GET", u(path));
    assert.equal(r.status, 200);
  }
  const es = handleRoute("GET", u("/terms?language=es"));
  assert.match(es.body, /Términos de uso/);
  const esMethodology = handleRoute("GET", u("/methodology?language=es"));
  assert.match(esMethodology.body, /Cómo obtenemos y verificamos/);
});

test("every page footer links to terms, privacy, accessibility, and methodology", () => {
  const home = handleRoute("GET", u("/")).body;
  assert.match(home, /href="\/terms"/);
  assert.match(home, /href="\/privacy"/);
  assert.match(home, /href="\/accessibility"/);
  assert.match(home, /href="\/methodology"/);
});

test("checklist and form-fill carry contextual legal notes", () => {
  const checklist = handleRoute("GET", u("/checklist?jurisdiction=US-CA&change=name")).body;
  assert.match(checklist, /not legal advice/i);
  assert.match(checklist, /official source/i);
});
