// SEO behavior: head metadata, the indexing contract, guide content, and the
// crawler files. The seo-lint gate enforces the contract across all pages; these
// tests pin the specific behaviors and the privacy-relevant invariants.

import { test } from "node:test";
import assert from "node:assert/strict";
import { headTags, titleTag, absoluteUrl, robotsTxt, sitemapXml, SITE_NAME, SITE_ORIGIN } from "../src/seo.ts";
import { renderGuideIndex, renderGuidePage, guidePaths, indexablePaths } from "../src/guide.ts";
import { renderIntakePage } from "../src/pages.ts";
import { t as locale } from "../src/i18n/index.ts";

test("noindex is the default: a page with no seo opts is not indexable", () => {
  const h = headTags("X · " + SITE_NAME, "en", { path: "", description: "", index: false });
  assert.match(h, /content="noindex,follow"/);
  assert.doesNotMatch(h, /rel="canonical"/);
  assert.doesNotMatch(h, /og:title/);
});

test("indexable head carries canonical, en/es/x-default hreflang, and OG", () => {
  const h = headTags("Home · " + SITE_NAME, "es", { path: "/", description: "desc", index: true });
  assert.match(h, new RegExp(`rel="canonical" href="${SITE_ORIGIN}/\\?language=es"`));
  assert.match(h, /hreflang="en" href="[^"]+\/"/);
  assert.match(h, /hreflang="es" href="[^"]+\/\?language=es"/);
  assert.match(h, /hreflang="x-default"/);
  assert.match(h, /property="og:locale" content="es_ES"/);
  assert.match(h, /property="og:locale:alternate" content="en_US"/);
  assert.doesNotMatch(h, /noindex/);
});

test("titleTag appends the brand once and never doubles it", () => {
  assert.equal(titleTag("Privacy"), "Privacy · " + SITE_NAME);
  assert.equal(titleTag(SITE_NAME), SITE_NAME);
});

test("absoluteUrl encodes the Spanish locale as a query param", () => {
  assert.equal(absoluteUrl("/guide", "en"), SITE_ORIGIN + "/guide");
  assert.equal(absoluteUrl("/guide", "es"), SITE_ORIGIN + "/guide?language=es");
});

test("homepage is indexable with a keyword title and description", () => {
  const h = renderIntakePage("en");
  assert.match(h, new RegExp(`<title>[^<]*· ${SITE_NAME}</title>`));
  assert.match(h, /<meta name="description" content="[^"]+"/);
  assert.match(h, /rel="canonical" href="[^"]+\/"/);
  assert.doesNotMatch(h, /noindex/);
});

test("guide page renders cited content, a checklist CTA, and valid JSON-LD", () => {
  const h = renderGuidePage("california", "name-change", "en");
  assert.ok(h);
  assert.equal((h!.match(/<h1/g) ?? []).length, 1);
  assert.match(h!, /href="\/checklist\?jurisdiction=US-CA&change=name"/); // funnels into the tool
  // Scheme-anchored: an unanchored host substring (CodeQL js/regex/missing-regexp-anchor) would
  // also be satisfied by a lookalike host or by the name appearing in body prose.
  assert.match(h!, /https:\/\/selfhelp\.courts\.ca\.gov\//); // a real cited source from the corpus
  const ld = [...h!.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  assert.ok(ld.length >= 1);
  const parsed = JSON.parse(ld[0]![1]!.replace(/\\u003c/g, "<"));
  const types = (Array.isArray(parsed) ? parsed : [parsed]).map((x) => x["@type"]);
  assert.ok(types.includes("HowTo") && types.includes("BreadcrumbList"));
});

test("Spanish guide page is a real, separately-canonical Spanish surface", () => {
  const h = renderGuidePage("illinois", "gender-marker", "es");
  assert.ok(h);
  assert.match(h!, /<html lang="es">/);
  assert.match(h!, /rel="canonical" href="[^"]+\/guide\/illinois\/gender-marker\?language=es"/);
  assert.doesNotMatch(h!, /What the sources say|Build my personalized/); // no English chrome leak
});

test("unknown guide slugs return null (router maps to 404)", () => {
  assert.equal(renderGuidePage("atlantis", "name-change", "en"), null);
  assert.equal(renderGuidePage("california", "passport-stuff", "en"), null);
});

test("robots.txt disallows user-state routes but never the assets crawlers need", () => {
  const r = robotsTxt();
  for (const d of ["/checklist", "/packet", "/answer", "/forms/"]) assert.ok(r.includes(`Disallow: ${d}`));
  assert.doesNotMatch(r, /Disallow:\s*\/assets/);
  assert.doesNotMatch(r, /Disallow:\s*\/vendor/);
  assert.match(r, /Sitemap: https?:\/\/\S+\/sitemap\.xml/);
});

// /compare is the one route whose bare form IS indexable but whose results (a query
// string of selections) are not — unlike /checklist/etc., which disallow the whole
// path, this needs a query-string-only disallow so the form stays crawlable.
test("robots.txt disallows /compare results (a query string) but not the bare indexable form", () => {
  const r = robotsTxt();
  assert.ok(r.includes("Disallow: /compare?"));
  assert.doesNotMatch(r, /Disallow:\s*\/compare\s*(\n|$)/);
});

test("/compare is in the sitemap (the bare form only — indexablePaths never carries a query string)", () => {
  assert.ok(indexablePaths().includes("/compare"));
});

test("sitemap lists exactly the indexable paths, each with hreflang, none noindex", () => {
  const paths = indexablePaths();
  const xml = sitemapXml(paths);
  assert.equal((xml.match(/<url>/g) ?? []).length, paths.length);
  for (const p of paths) assert.ok(xml.includes(`<loc>${SITE_ORIGIN}${p}</loc>`), `missing ${p}`);
  for (const bad of ["/checklist", "/packet", "/answer", "/healthz"]) assert.ok(!xml.includes(`${SITE_ORIGIN}${bad}`));
  assert.match(xml, /xmlns:xhtml/);
});

test("guide index links every state and topic", () => {
  const h = renderGuideIndex("en");
  for (const path of guidePaths().filter((p) => p !== "/guide")) {
    const rel = path.replace(/^\//, "");
    assert.ok(h.includes(`/${rel}`), `index missing link to ${path}`);
  }
});

test("guide pages carry the state's referrals (A4TE guide + legal aid) so the SEO landing page is never a dead end", () => {
  const en = renderGuidePage("washington", "name-change", "en") ?? "";
  assert.match(en, /id="help-h">Where to get help</);
  assert.match(en, /href="https:\/\/transequality\.org\/documents\/washington-identity-documents" rel="noopener noreferrer"/);
  assert.doesNotMatch(en, /texas-identity-documents/); // only this state's referrals, plus federal
  const es = renderGuidePage("washington", "name-change", "es") ?? "";
  assert.match(es, /Dónde obtener ayuda/);
  assert.doesNotMatch(es, /Read it alongside this checklist/); // no English leak
});

// #311: costs, fees and timelines are withheld while a record is past its re-check date, so
// the text a search result or a link preview shows must not promise them. The same strings
// feed the <title>, the description, Open Graph, Twitter and the HowTo JSON-LD.
test("guide titles and descriptions never promise costs or timelines (#311)", () => {
  const promise = /\b(costs?|fees?|prices?|how long|timelines?)\b|costos?|cuánto (cuesta|tarda)|plazos?|tarifas?/i;
  for (const lang of ["en", "es"] as const) {
    const seo = locale(lang).seo;
    assert.doesNotMatch(seo.guideIndexDescription, promise, `${lang} guide index description`);
    assert.doesNotMatch(seo.guideIndexDescription, /\b(current|actuales?|vigentes?)\b/i, `${lang} guide index description claims currency`);
    for (const [state, topic] of [["California", "Name change"], ["Illinois", "Gender-marker change"]] as const) {
      assert.doesNotMatch(seo.guideTitle(state, topic), promise, `${lang} guide title`);
      assert.doesNotMatch(seo.guideDescription(state, topic), promise, `${lang} guide description`);
    }
    for (const html of [renderGuideIndex(lang), renderGuidePage("california", "name-change", lang)!, renderGuidePage("illinois", "gender-marker", lang)!]) {
      const metas = [...html.matchAll(/<(?:meta|title)[^>]*(?:name|property)="(?:description|og:description|og:title|twitter:description|twitter:title)"[^>]*>|<title>[^<]*<\/title>/g)].map((m) => m[0]);
      assert.ok(metas.length >= 5, "title, description, og and twitter text are present");
      for (const m of metas) assert.doesNotMatch(m, promise, `${lang}: ${m}`);
    }
  }
});
