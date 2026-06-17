// Regression guard for Spanish parity: the ES experience must be genuinely equivalent,
// with no English leaks in the page chrome, step titles, answer heading, or error pages.

import { test } from "node:test";
import assert from "node:assert/strict";
import { handleRoute } from "../api/router.ts";
import { renderIntakePage } from "../src/pages.ts";

const u = (p: string) => new URL(p, "http://localhost:8080");
const today = "2026-06-16";

test("intake page is fully Spanish under ?language=es (no English chrome)", () => {
  const h = renderIntakePage("es");
  assert.match(h, /<html lang="es">/);
  assert.match(h, /Planifique sus cambios legales/); // heading
  assert.match(h, /¿Dónde vive\?/); // legend
  assert.match(h, /Marcador de género/); // change-type label
  assert.match(h, /Mostrar mi lista/); // submit button
  // English chrome must be gone:
  assert.doesNotMatch(h, /Show my checklist|Where do you live|What are you changing/);
});

test("checklist page chrome and step titles are Spanish", () => {
  const r = handleRoute("GET", u("/checklist?jurisdiction=US-CA&change=name&language=es"), today);
  assert.match(r.body, /Su lista personalizada/); // heading
  assert.match(r.body, /Sus pasos se enumeran/); // intro
  assert.match(r.body, /Obtenga una orden judicial/); // localized step title
  assert.match(r.body, /Obtenga el formulario oficial/); // localized official-form CTA
  assert.match(r.body, /Marcar como hecho/); // localized progress toggle
  assert.doesNotMatch(r.body, /Your personalized checklist|Get a court order|Get the official form|Mark done/);
});

test("answer page heading is Spanish and offers a way back (no dead-end)", () => {
  const r = handleRoute("GET", u("/answer?jurisdiction=US-CA&change=name&language=es"), today);
  assert.match(r.body, /Lo que dicen las fuentes/);
  assert.match(r.body, /Volver a su lista/); // back action
  assert.match(r.body, /href="\/checklist\?/);
  assert.doesNotMatch(r.body, /What the sources say/);
});

test("error pages are Spanish under ?language=es", () => {
  const bad = handleRoute("GET", u("/checklist?jurisdiction=Mars&language=es"), today);
  assert.equal(bad.status, 400);
  assert.match(bad.body, /no es un estado que reconozcamos/);

  const notFound = handleRoute("GET", u("/nope?language=es"), today);
  assert.equal(notFound.status, 404);
  assert.match(notFound.body, /Página no encontrada/);

  const method = handleRoute("POST", u("/?language=es"));
  assert.equal(method.status, 405);
  assert.match(method.body, /Método no permitido/);
});

test("Spanish-thin states surface an honest coverage note (TX has no ES state records)", () => {
  // Texas: EN has a current court-order record, Spanish does not → honest note.
  const tx = handleRoute("GET", u("/checklist?jurisdiction=US-TX&change=name&doc=court-order&language=es"), today);
  assert.match(tx.body, /Los pasos completos en español para este estado aún no están listos/);
  // California ES is complete for court-order → no note.
  const ca = handleRoute("GET", u("/checklist?jurisdiction=US-CA&change=name&doc=court-order&language=es"), today);
  assert.doesNotMatch(ca.body, /aún no están listos/);
});

test("official-form page is localized and links to the real source (no auto-fill)", () => {
  const en = handleRoute("GET", u("/forms/us-ss-5")).body;
  assert.match(en, /complete it yourself/); // honest: we don't fill it
  assert.match(en, /ssa\.gov\/forms\/ss-5\.pdf/); // links the official form
  const es = handleRoute("GET", u("/forms/us-ss-5?language=es")).body;
  assert.match(es, /complételo usted mismo/); // localized honest copy
  assert.match(es, /Obtenga el formulario oficial/);
  assert.match(es, /Sus datos, listos para copiar/); // localized copy-helper
  assert.doesNotMatch(es, /complete it yourself|Your details, ready/); // no English leak
});

test("405 carries an Allow header", () => {
  const r = handleRoute("POST", u("/"));
  assert.equal(r.status, 405);
  assert.equal(r.headers?.allow, "GET, HEAD");
});

test("answer-page Sources heading is h2 (no h1→h3 skip)", () => {
  const r = handleRoute("GET", u("/answer?jurisdiction=US-CA&change=name"), today);
  assert.match(r.body, /<h2>Sources<\/h2>/);
  assert.doesNotMatch(r.body, /<h3>Sources/);
});

test("gaps render a humane Spanish sentence, not a raw slug", () => {
  // US-CA + birth-certificate has no CA records → a gap.
  const r = handleRoute("GET", u("/checklist?jurisdiction=US-CA&change=name&doc=birth-certificate&language=es"), today);
  assert.match(r.body, /Acta de nacimiento/); // localized document label
  assert.match(r.body, /Aún no tenemos pasos verificados/); // humane reason
  assert.doesNotMatch(r.body, /no-records|birth-certificate:/); // no slug/code leak
});
