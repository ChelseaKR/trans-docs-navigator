// SEO gate (docs/SEO-PLAN.md). Enforces the indexing contract mechanically, the way
// every other property here is gated:
//   • Indexable pages (home, guides, legal) carry a brand title, a meta description of
//     sane length, a self-referential canonical, en/es/x-default hreflang, OG/Twitter
//     cards, and are NOT noindex. Guide pages also carry parseable JSON-LD.
//   • Non-indexable pages (checklist, packet, answer, form-fill, errors) ARE noindex
//     and emit no canonical — user-state must never enter the index.
//   • robots.txt and sitemap.xml are well-formed; the sitemap lists exactly the
//     indexable set and nothing that is noindex.
//
// Pure rendering, no network. Wired into `make verify` and the smoke journey.

import { buildChecklist } from "../api/checklist.ts";
import { loadCorpus } from "../api/corpus.ts";
import { formById } from "../api/forms.ts";
import { renderIntakePage, renderChecklistPage, renderPacketPage, renderFormFillPage } from "../src/pages.ts";
import { renderMovePage, renderPlanPage } from "../src/relocation.ts";
import { buildRelocationPlan } from "../api/relocation.ts";
import { renderCompareFormPage, renderCompareResultsPage } from "../src/compare.ts";
import { buildCompareTable } from "../api/compare.ts";
import { renderTermsPage, renderPrivacyPage, renderAccessibilityPage, renderMethodologyPage } from "../src/legal.ts";
import { renderTransparencyPage } from "../src/transparency.ts";
import { renderGuideIndex, renderGuidePage, indexablePaths } from "../src/guide.ts";
import { renderFeedsIndex } from "../src/feeds.ts";
import { robotsTxt, sitemapXml, SITE_NAME, SITE_ORIGIN } from "../src/seo.ts";
import type { Language } from "../api/types.ts";
import { pass, fail } from "./util.ts";

const DESC_MIN = 50;
const DESC_MAX = 165; // SERP description truncation guidance
const corpus = loadCorpus();
const cl = (lang: Language) => buildChecklist({ jurisdiction: "US-CA", change_types: ["name"], documents: [], language: lang }, undefined, corpus);
const errors: string[] = [];
const note = (cond: boolean, msg: string) => { if (!cond) errors.push(msg); };

function attr(html: string, re: RegExp): string | undefined {
  return re.exec(html)?.[1];
}

// Test-only injection point (tests/gate-efficacy): SEO_POISON=1 strips the canonical
// link from one indexable page, simulating a template regression that drops required
// indexing metadata. Inert unless the env var is exactly "1", so production is
// unchanged.
const SEO_POISON = process.env.SEO_POISON === "1";
function poisonCanonical(html: string): string {
  return SEO_POISON ? html.replace(/<link rel="canonical"[^>]*>\n?/, "") : html;
}

// ── Indexable pages: full metadata, not noindex ────────────────────────────────
interface Indexable { name: string; path: string; html: string; jsonLd?: boolean }
const indexable: Indexable[] = [
  { name: "home (en)", path: "/", html: poisonCanonical(renderIntakePage("en")) },
  { name: "home (es)", path: "/", html: renderIntakePage("es") },
  { name: "guide-index (en)", path: "/guide", html: renderGuideIndex("en") },
  { name: "guide-index (es)", path: "/guide", html: renderGuideIndex("es") },
  { name: "guide ca/name (en)", path: "/guide/california/name-change", html: renderGuidePage("california", "name-change", "en")!, jsonLd: true },
  { name: "guide il/marker (es)", path: "/guide/illinois/gender-marker", html: renderGuidePage("illinois", "gender-marker", "es")!, jsonLd: true },
  { name: "feeds-index (en)", path: "/feeds", html: renderFeedsIndex("en") },
  { name: "feeds-index (es)", path: "/feeds", html: renderFeedsIndex("es") },
  { name: "terms (en)", path: "/terms", html: renderTermsPage("en") },
  { name: "privacy (es)", path: "/privacy", html: renderPrivacyPage("es") },
  { name: "accessibility (en)", path: "/accessibility", html: renderAccessibilityPage("en") },
  { name: "methodology (en)", path: "/methodology", html: renderMethodologyPage("en") },
  { name: "transparency (en)", path: "/transparency", html: renderTransparencyPage("en") },
  { name: "transparency (es)", path: "/transparency", html: renderTransparencyPage("es") },
  // /compare's bare FORM is indexable, like /move's form arguably should be but isn't —
  // this route carries no origin→destination pair, so it gets the guide/legal-page
  // posture instead of the relocation planner's stricter one. Only the form; a result
  // (a query string) is noindex, in the block below.
  { name: "compare-form (en)", path: "/compare", html: renderCompareFormPage("en") },
  { name: "compare-form (es)", path: "/compare", html: renderCompareFormPage("es") },
];

for (const p of indexable) {
  const h = p.html;
  note(new RegExp(`<title>[^<]+· ${SITE_NAME}</title>`).test(h), `${p.name}: <title> missing brand suffix`);
  const desc = attr(h, /<meta name="description" content="([^"]*)"/);
  note(!!desc && desc.length >= DESC_MIN && desc.length <= DESC_MAX, `${p.name}: meta description missing or out of ${DESC_MIN}-${DESC_MAX} chars (${desc?.length ?? 0})`);
  const canon = attr(h, /<link rel="canonical" href="([^"]+)"/);
  note(!!canon && canon.includes(p.path === "/" ? "/" : p.path), `${p.name}: canonical missing or wrong (${canon})`);
  note(!/content="noindex/.test(h), `${p.name}: must NOT be noindex`);
  for (const hl of ["en", "es", "x-default"]) {
    note(new RegExp(`hreflang="${hl}"`).test(h), `${p.name}: missing hreflang ${hl}`);
  }
  note(/property="og:title"/.test(h) && /name="twitter:card"/.test(h), `${p.name}: missing Open Graph / Twitter cards`);
  note(/<link rel="icon"/.test(h) && /rel="manifest"/.test(h), `${p.name}: missing favicon/manifest links`);
  if (p.jsonLd) {
    const blocks = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    note(blocks.length > 0, `${p.name}: missing JSON-LD`);
    for (const b of blocks) {
      try { JSON.parse((b[1] ?? "").replace(/\\u003c/g, "<")); } catch { errors.push(`${p.name}: JSON-LD does not parse`); }
    }
    note(h.includes('"HowTo"') && h.includes('"BreadcrumbList"'), `${p.name}: expected HowTo + BreadcrumbList JSON-LD`);
  }
}

// ── Non-indexable pages: noindex, no canonical ─────────────────────────────────
// /move and /plan are here on purpose. A relocation plan carries an (origin → destination)
// pair in its URL — intent to leave a hostile state. It must never be indexed, shared as a
// social card, or handed to a crawler. The `page()` noindex default gives us that; this
// gate is what keeps it true if someone later adds `seo:` to the render call.
const noindex: { name: string; html: string }[] = [
  { name: "checklist", html: renderChecklistPage(cl("en"), corpus, "en", "jurisdiction=US-CA&change=name") },
  { name: "packet", html: renderPacketPage(cl("en"), corpus, "en", "2026-05-31") },
  { name: "form-fill", html: renderFormFillPage(formById("us-ss-5")!, "en") },
  { name: "move", html: renderMovePage("en") },
  {
    name: "plan",
    html: renderPlanPage(
      buildRelocationPlan({ origin: "US-TX", destination: "US-WA", held: [], change_types: ["name"], language: "en" }),
      corpus,
      "en",
    ),
  },
  {
    name: "compare-results",
    html: renderCompareResultsPage(buildCompareTable({ documents: ["drivers-license"], change_types: ["name"] }), corpus, "en"),
  },
];
for (const p of noindex) {
  note(/content="noindex,follow"/.test(p.html), `${p.name}: must be noindex,follow`);
  note(!/rel="canonical"/.test(p.html), `${p.name}: must not emit a canonical`);
  note(!/property="og:/.test(p.html), `${p.name}: must not emit Open Graph (not a share surface)`);
}

// ── robots.txt + sitemap.xml ───────────────────────────────────────────────────
const robots = robotsTxt();
note(/Sitemap: https?:\/\/\S+\/sitemap\.xml/.test(robots), "robots.txt: missing Sitemap line");
for (const d of ["/checklist", "/packet", "/answer", "/forms/", "/move", "/plan", "/compare?"]) {
  note(robots.includes(`Disallow: ${d}`), `robots.txt: should disallow ${d}`);
}
// The bare form must NOT be disallowed — only "/compare?" (a query string) may be.
note(!/Disallow:\s*\/compare\s*($|\n)/.test(robots), "robots.txt: must not disallow the bare (indexable) /compare form");
note(!/Disallow:\s*\/assets/.test(robots) && !/Disallow:\s*\/vendor/.test(robots), "robots.txt: must NOT block CSS/JS (crawlers need them to render)");

const paths = indexablePaths();
const sitemap = sitemapXml(paths);
note(sitemap.startsWith("<?xml"), "sitemap.xml: missing XML declaration");
note(sitemap.includes("xmlns:xhtml"), "sitemap.xml: missing xhtml namespace for hreflang");
for (const p of paths) {
  note(sitemap.includes(`<loc>${SITE_ORIGIN}${p}</loc>`), `sitemap.xml: missing <loc> for ${p}`);
}
for (const bad of ["/checklist", "/packet", "/answer", "/healthz"]) {
  note(!sitemap.includes(`${SITE_ORIGIN}${bad}`), `sitemap.xml: must not list noindex path ${bad}`);
}
note((sitemap.match(/<url>/g) ?? []).length === paths.length, `sitemap.xml: URL count ${(sitemap.match(/<url>/g) ?? []).length} != indexable ${paths.length}`);

const real = errors.filter(Boolean);
if (real.length > 0) fail("seo", `${real.length} SEO issue(s)`, real);
pass("seo", `${indexable.length} indexable pages carry full metadata; ${noindex.length} user-state pages are noindex; robots + sitemap (${paths.length} URLs) well-formed`);
