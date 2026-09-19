// The machine-translation notice (owner decision, 2026-09-18: the Spanish ships labeled
// machine-translated). These fail if any HTML page or feed that shows Spanish lacks the notice,
// if it stops being first in <main>, loses either language, or loses its link to the same
// page in English -- and if an English page ever carries it.

import { test } from "node:test";
import assert from "node:assert/strict";
import { handleRoute } from "../api/router.ts";
import { indexablePaths } from "../src/guide.ts";
import { page } from "../src/render.ts";
import {
  DEFAULT_ENGLISH_HREF,
  ENGLISH_LINK_ATTR,
  MACHINE_TRANSLATED,
  MACHINE_TRANSLATION_NOTICE,
  NOTICE_ATTR,
  aimEnglishLink,
  englishHref,
  isMachineTranslated,
  machineTranslationNoticeHtml,
  machineTranslationNoticeText,
} from "../src/machine-translation.ts";
import { SUPPORTED_LOCALES } from "../src/i18n/index.ts";

const TODAY = "2026-07-13";
const u = (p: string) => new URL(p, "http://localhost:8080");

/** Every HTML surface a reader can reach, before the language is chosen. */
const ROUTES: string[] = [
  ...indexablePaths(),
  "/guide",
  "/checklist?jurisdiction=US-CA&change=name&doc=court-order&doc=ssa-card",
  "/checklist?jurisdiction=US-TX&change=gender-marker",
  "/checklist?jurisdiction=US-IL&change=name&for_minor=1",
  "/packet?jurisdiction=US-NY&change=name&doc=court-order",
  "/changes?since=2026-06-01&jurisdiction=US-CA&change=name&doc=court-order",
  "/move?origin=US-TX&destination=US-CA&change=name",
  "/plan?origin=US-TX&destination=US-CA&change=name",
  "/compare?current=US-TX&change=gender-marker&sort=count",
  "/answer?jurisdiction=US-CA&q=how%20do%20I%20change%20my%20name",
  "/forms/us-ss-5",
  "/offline",
  "/checklist", // a 400: error pages are pages too
  "/nope-does-not-exist",
];

function inLanguage(route: string, lang: string): string {
  if (lang === "en") return route;
  return `${route}${route.includes("?") ? "&" : "?"}language=${lang}`;
}

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

test("every HTML page in a machine-translated language carries the notice, first in <main>", () => {
  let checked = 0;
  for (const route of ROUTES) {
    for (const bundle of SUPPORTED_LOCALES) {
      const lang = bundle.language;
      const url = u(inLanguage(route, lang));
      const r = handleRoute("GET", url, TODAY);
      if (!r.contentType.startsWith("text/html")) continue;
      const htmlLang = r.body.match(/<html lang="([^"]+)"/)?.[1];
      assert.equal(htmlLang, lang, `${url.pathname}${url.search} renders <html lang="${lang}">`);
      const where = `${url.pathname}${url.search}`;

      if (!isMachineTranslated(lang)) {
        assert.equal(count(r.body, NOTICE_ATTR), 0, `${where}: English must not carry the notice`);
        continue;
      }
      checked++;
      assert.equal(count(r.body, NOTICE_ATTR), 1, `${where}: exactly one notice`);
      const main = r.body.indexOf('<main id="main">');
      assert.ok(main >= 0, `${where}: has <main>`);
      const afterMain = r.body.slice(main + '<main id="main">'.length).trimStart();
      assert.ok(afterMain.startsWith(`<div class="mt-notice" ${NOTICE_ATTR}>`), `${where}: the notice is first in <main>`);
      const notice = afterMain.slice(0, afterMain.indexOf("</div>"));
      assert.match(notice, /<p lang="es"><strong>Traducción automática, sin revisión humana\.<\/strong> \S/, where);
      assert.match(notice, /<p lang="en"><strong>Machine-translated, not reviewed by a person\.<\/strong> \S/, where);
      const href = notice.match(new RegExp(`<a href="([^"]*)" ${ENGLISH_LINK_ATTR} hreflang="en">`))?.[1];
      const expected = englishHref(url).replace(/&/g, "&amp;");
      assert.equal(href, expected, `${where}: the English link is this page in English`);
      assert.doesNotMatch(href ?? "", /[?&](language|lang)=/, `${where}: the English link carries no language`);
    }
  }
  assert.ok(checked >= ROUTES.length, `checked ${checked} Spanish pages; the matrix did not render`);
});

test("the English link keeps every parameter but the language, so it is the same page", () => {
  assert.equal(
    englishHref(u("/checklist?jurisdiction=US-CA&change=name&language=es&doc=court-order&doc=ssa-card")),
    "/checklist?jurisdiction=US-CA&change=name&doc=court-order&doc=ssa-card",
  );
  assert.equal(englishHref(u("/terms?lang=es")), "/terms");
  assert.equal(englishHref(u("/?language=es")), "/");
});

test("aiming the link touches only the notice's link, and a page without one is unchanged", () => {
  const es = page({ lang: "es", title: "t", heading: "h", body: `<p><a href="/">inicio</a></p>` });
  const aimed = aimEnglishLink(es, "/terms?x=1&y=2");
  assert.ok(aimed.includes(`<a href="/terms?x=1&amp;y=2" ${ENGLISH_LINK_ATTR}`));
  assert.ok(aimed.includes(`<p><a href="/">inicio</a></p>`), "other links to / are left alone");
  const en = page({ lang: "en", title: "t", heading: "h", body: "<p>x</p>" });
  assert.equal(aimEnglishLink(en, "/terms"), en);
  assert.ok(machineTranslationNoticeHtml("es").includes(`<a href="${DEFAULT_ENGLISH_HREF}" ${ENGLISH_LINK_ATTR}`));
});

test("an English page is byte-for-byte what it was: no notice, no stray line", () => {
  const en = page({ lang: "en", title: "t", heading: "h", body: "<p>x</p>" });
  assert.ok(en.includes('<main id="main">\n  <h1>h</h1>'));
});

test("every non-English language is machine-translated until a review is recorded", () => {
  let others = 0;
  for (const bundle of SUPPORTED_LOCALES) {
    if (bundle.language === "en") {
      assert.equal(isMachineTranslated("en"), false, "English is the reference");
      continue;
    }
    others++;
    assert.ok(MACHINE_TRANSLATED.has(bundle.language), `${bundle.language} can be shown without the notice`);
  }
  assert.ok(others >= 1, "no non-English bundle loaded, so this proved nothing");
});

test("the notice says it in both languages, each really in its language", () => {
  const { es, en } = MACHINE_TRANSLATION_NOTICE;
  for (const key of ["lead", "body", "link"] as const) {
    assert.ok(es[key].trim() && en[key].trim());
    assert.notEqual(es[key], en[key]);
  }
});

test("a Spanish feed says it is machine-translated in the channel and in every item", () => {
  const r = handleRoute("GET", u("/feeds/US-CA.xml?language=es"), TODAY);
  assert.equal(r.status, 200);
  const notice = machineTranslationNoticeText("es");
  assert.ok(notice);
  const descriptions = [...r.body.matchAll(/<description>([\s\S]*?)<\/description>/g)].map((m) => m[1] ?? "");
  assert.ok(descriptions.length >= 2, "the channel and at least one item, or this proved nothing");
  for (const d of descriptions) assert.ok(d.startsWith(notice), `description does not start with the notice: ${d.slice(0, 80)}`);
  assert.ok(descriptions[0]?.includes("See the English version: "), "the channel names the English feed");
  assert.match(r.body, /<atom:link href="[^"]*\/feeds\/US-CA\.xml" rel="alternate" hreflang="en"/);
});

test("an English feed carries no notice", () => {
  const r = handleRoute("GET", u("/feeds/US-CA.xml"), TODAY);
  assert.equal(r.status, 200);
  assert.ok(!r.body.includes("Traducción automática"));
  assert.ok(!r.body.includes("Machine-translated"));
  assert.ok(!r.body.includes('hreflang="en"'));
});
