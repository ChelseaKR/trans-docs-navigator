import { test } from "node:test";
import assert from "node:assert/strict";
import { renderTransparencyPage, TRANSPARENCY_UPDATED_DATE } from "../src/transparency.ts";
import { handleRoute } from "../api/router.ts";

const u = (p: string) => new URL(p, "http://localhost:8080");

test("Transparency page renders an English architecture inventory with bounded claims", () => {
  const h = renderTransparencyPage("en");
  assert.match(h, /Transparency Report/);
  assert.match(h, /Q2 2026/); // dated quarterly entry label
  assert.match(h, new RegExp(TRANSPARENCY_UPDATED_DATE));
  assert.match(h, /Records that may exist/i);
  assert.match(h, /Local-storage boundaries/i);
  assert.match(h, /Save for offline.*explicitly requests/i);
  assert.match(h, /14-day retention/i);
  assert.match(h, /optional question/i);
  assert.doesNotMatch(h, /Could not be produced/i);
  assert.doesNotMatch(h, /question.*never sent to.*server/i);
});

test("Transparency page renders in Spanish with parity content", () => {
  const h = renderTransparencyPage("es");
  assert.match(h, /Informe de transparencia/);
  assert.match(h, /2\.º trimestre de 2026/);
  assert.match(h, new RegExp(TRANSPARENCY_UPDATED_DATE));
  assert.match(h, /Registros que pueden existir/i);
  assert.match(h, /Límites del almacenamiento local/i);
  assert.match(h, /Guardar sin conexión.*solicita explícitamente/i);
  assert.doesNotMatch(h, /No podría producirse/i);
});

test("Transparency page does not present unreviewed canary text as final", () => {
  const en = renderTransparencyPage("en");
  // Must NOT assert an actual canary status (e.g. "we have not received a court order").
  assert.doesNotMatch(en, /we have not received/i);
  assert.doesNotMatch(en, /no ha recibido/i);
  // Must clearly flag the draft posture: no canary ships, review is pending/open.
  assert.match(en, /does not include a warrant canary/i);
  assert.match(en, /open\b.*launch gate|counsel/i);

  const es = renderTransparencyPage("es");
  assert.doesNotMatch(es, /no hemos recibido una orden/i);
  assert.match(es, /no incluye un.*canary/i);
});

test("route serves the transparency page and preserves language", () => {
  const r = handleRoute("GET", u("/transparency"));
  assert.equal(r.status, 200);
  assert.match(r.body, /Transparency Report/);

  const es = handleRoute("GET", u("/transparency?language=es"));
  assert.equal(es.status, 200);
  assert.match(es.body, /Informe de transparencia/);
});

test("every page footer links to the transparency report", () => {
  const home = handleRoute("GET", u("/")).body;
  assert.match(home, /href="\/transparency"/);
});
