// Search-engine metadata for the document head, centralized so every page emits a
// consistent, correct set and the seo-lint gate has one place to check.
//
// THE CONTRACT (see docs/SEO-PLAN.md): only content surfaces are indexable — the
// homepage, the guide pages, and the legal pages. Everything else (user-state routes
// like /checklist and /packet, the form-fill pages, error pages) is rendered with
// `noindex` and carries no canonical/hreflang/OG. `page()` defaults to noindex, so a
// new page type is private until someone deliberately opts it into the index — the
// fail-safe direction for a privacy-first service.

import type { Language } from "../api/types.ts";
import { escapeHtml } from "./render.ts";
import { SUPPORTED_LOCALES } from "./i18n/index.ts";

/** Absolute origin for canonical/OG/hreflang/sitemap URLs. Set SITE_ORIGIN at deploy
 *  time; on Render the preview auto-detects its own URL via RENDER_EXTERNAL_URL. */
export const SITE_ORIGIN = (process.env.SITE_ORIGIN ?? process.env.RENDER_EXTERNAL_URL ?? "https://trans-docs-navigator.org").replace(/\/+$/, "");
export const SITE_NAME = "Trans Docs Navigator";
const OG_IMAGE = "/assets/og-default.png";

const OG_LOCALE: Record<Language, string> = { en: "en_US", es: "es_ES" };

/** What an indexable page needs to describe itself to a crawler. */
export interface SeoMeta {
  /** Canonical path with NO query string, e.g. "/" or "/guide/california/name-change". */
  path: string;
  description: string;
  /** Index this page? When false (the default in page()), emit noindex and nothing else. */
  index: boolean;
  /** Override the social image; defaults to the site card. */
  ogImage?: string;
}

/** Build an absolute URL for `path` in `lang` (Spanish carries ?language=es). */
export function absoluteUrl(path: string, lang: Language): string {
  const q = lang === "en" ? "" : `?language=${lang}`;
  return `${SITE_ORIGIN}${path}${q}`;
}

/** The full <title>: page title + brand (skipped if the title already is the brand). */
export function titleTag(title: string): string {
  return title === SITE_NAME ? title : `${title} · ${SITE_NAME}`;
}

/**
 * The head metadata block. For an indexable page: description, canonical, hreflang
 * alternates (en/es/x-default), and Open Graph + Twitter cards. For a non-indexable
 * page: a single robots:noindex,follow and nothing that would invite a share preview.
 * Favicon and manifest links are emitted either way.
 */
export function headTags(fullTitle: string, lang: Language, seo: SeoMeta): string {
  const icons = [
    `<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">`,
    `<link rel="manifest" href="/assets/site.webmanifest">`,
  ].join("\n");

  if (!seo.index) {
    return [`<meta name="robots" content="noindex,follow">`, icons].join("\n");
  }

  const canonical = absoluteUrl(seo.path, lang);
  const alternates = SUPPORTED_LOCALES.map(
    (l) => `<link rel="alternate" hreflang="${l.language}" href="${escapeHtml(absoluteUrl(seo.path, l.language))}">`,
  );
  // x-default points at the default (English) URL.
  alternates.push(`<link rel="alternate" hreflang="x-default" href="${escapeHtml(absoluteUrl(seo.path, "en"))}">`);

  const og = [
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${escapeHtml(SITE_NAME)}">`,
    `<meta property="og:title" content="${escapeHtml(fullTitle)}">`,
    `<meta property="og:description" content="${escapeHtml(seo.description)}">`,
    `<meta property="og:url" content="${escapeHtml(canonical)}">`,
    `<meta property="og:locale" content="${OG_LOCALE[lang]}">`,
    ...SUPPORTED_LOCALES.filter((l) => l.language !== lang).map(
      (l) => `<meta property="og:locale:alternate" content="${OG_LOCALE[l.language]}">`,
    ),
    `<meta property="og:image" content="${escapeHtml(SITE_ORIGIN + (seo.ogImage ?? OG_IMAGE))}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeHtml(fullTitle)}">`,
    `<meta name="twitter:description" content="${escapeHtml(seo.description)}">`,
    `<meta name="twitter:image" content="${escapeHtml(SITE_ORIGIN + (seo.ogImage ?? OG_IMAGE))}">`,
  ];

  return [
    `<meta name="description" content="${escapeHtml(seo.description)}">`,
    `<link rel="canonical" href="${escapeHtml(canonical)}">`,
    ...alternates,
    ...og,
    icons,
  ].join("\n");
}

/** Wrap validated JSON-LD for embedding; `<` is escaped so a value can't close the tag. */
export function jsonLd(data: unknown): string {
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
}

/**
 * robots.txt. Disallows the user-state HTML routes (no content to rank, and they
 * generate unbounded query-param permutations) but deliberately leaves /assets and
 * /vendor crawlable — search engines need the CSS/JS to render and judge the page.
 */
export function robotsTxt(): string {
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /checklist",
    "Disallow: /packet",
    "Disallow: /answer",
    // The relocation planner. /plan carries an (origin → destination) pair in its query
    // string — the most sensitive selection this app takes — and /move is its entry form.
    // Neither is a ranking surface, and neither should ever appear in an index or a
    // crawler's logs. (`page()` already renders both noindex; this is the second lock.)
    "Disallow: /move",
    "Disallow: /plan",
    // /compare is the inverse of /move+/plan: the bare form IS indexable (allowed above),
    // but a result carries the user's document/change selections (and optionally their
    // current state) in its query string, so only URLs WITH a query string are blocked —
    // the trailing "?" makes this a query-string-only disallow, unlike the whole-path
    // disallows above.
    "Disallow: /compare?",
    "Disallow: /forms/",
    "Disallow: /healthz",
    "",
    `Sitemap: ${SITE_ORIGIN}/sitemap.xml`,
    "",
  ].join("\n");
}

/** sitemap.xml for the indexable paths, each with en/es/x-default hreflang alternates. */
export function sitemapXml(paths: string[]): string {
  const urls = paths
    .map((p) => {
      const alts = [
        ...SUPPORTED_LOCALES.map(
          (l) => `    <xhtml:link rel="alternate" hreflang="${l.language}" href="${escapeHtml(absoluteUrl(p, l.language))}"/>`,
        ),
        `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeHtml(absoluteUrl(p, "en"))}"/>`,
      ].join("\n");
      return `  <url>\n    <loc>${escapeHtml(absoluteUrl(p, "en"))}</loc>\n${alts}\n  </url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`;
}
