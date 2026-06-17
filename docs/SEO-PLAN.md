# SEO Audit & Plan — Trans Docs Navigator

> Audited 2026-06-12 against the post-merge `main`. The app is server-rendered HTML
> (no framework, `node:http`), bilingual (EN/ES), not yet deployed to a public domain.

## Execution status (updated 2026-06-16)

**Landed — Phases 0, 1, 2, 3, and 4 (the code half):**
- **Phase 0** — the indexing contract is encoded, not just documented: `page()` defaults
  to `noindex`, so a surface is private until it opts in. Indexable: home, `/guide` and
  the guide pages, the three legal pages. Everything else (`/checklist`, `/packet`,
  `/answer`, `/forms/*`, errors) is `noindex` automatically.
- **Phase 1** — `src/seo.ts` centralizes the head: meta description, self-referential
  canonical, en/es/x-default hreflang, Open Graph + Twitter cards, brand title template,
  favicon (`favicon.svg`) and web manifest. Descriptions and titles live in the i18n
  bundles, so Spanish is a real rankable surface. OG image rendered to
  `public/assets/og-default.png`.
- **Phase 2** — the content surface: `/guide` index plus `/guide/<state>/<topic>` for
  5 states × 2 topics, built from the corpus with full citations, a CTA into the
  interactive checklist, and `HowTo` + `BreadcrumbList` JSON-LD derived from the same
  records (so structured data can't drift from visible content).
- **Phase 3** — `/robots.txt` and `/sitemap.xml` served from the router, generated from
  the route set with hreflang alternates; the sitemap lists exactly the indexable paths.
- A new **`seo-lint` gate** (gate 12 of 13 in `make verify`) enforces the whole contract
  mechanically; `tests/seo.test.ts`, the smoke journey, and the pa11y browser run all
  cover the new surfaces.

**Still blocked on the live domain (Phase 4 + real ranking):**
- Set the real origin via the `SITE_ORIGIN` env var at deploy time (defaults to a
  placeholder today; canonical/OG/sitemap URLs read from it).
- Google Search Console / Bing Webmaster verification and sitemap submission.
- Referrer-host-only landing data in the allowlist logger (Phase 4.2) — deferred until
  there's real traffic to measure.
>
> **The tension this audit lives inside.** This is a privacy-first service for people
> who may be in hostile jurisdictions. Discoverability is part of the mission: someone
> searching "how do I change my gender marker in California" should find accurate,
> cited guidance instead of forum lore. But the same threat model means some surfaces
> must stay *out* of the index, and the site carries no client-side analytics by
> design. So this is not a generic "add meta tags and a sitemap" plan. The real work
> is building an indexable content surface for the guidance that today only exists
> behind a form, while keeping user-state URLs uncrawlable and measuring without
> trackers.

## The headline finding

**The content people search for exists in the corpus but lives at no indexable URL.**
The high-intent queries — "California name change court order," "Illinois gender
marker license," "update Social Security card after name change" — map exactly to
corpus records. But those records only render after a form submission, at
query-string URLs (`/checklist?jurisdiction=US-CA&change=name`, `/answer?...`) that
should *not* be indexed. The homepage is a thin form with one lead paragraph. So even
with flawless metadata there is almost nothing for a search engine to rank.

Everything else in this audit is table stakes. This is the lever. The fix is a set of
stable, server-rendered guide pages (one per jurisdiction × topic) that carry the
cited corpus content and funnel into the interactive flow. See Phase 2.

## Audit: current state

Severity: **P0** = blocks ranking / causes indexing harm · **P1** = significant
missed opportunity · **P2** = polish.

| # | Finding | Severity | Where |
|---|---|---|---|
| 1 | No indexable content surface for jurisdiction guidance (the headline finding) | P0 | `api/router.ts`, corpus |
| 2 | User-state URLs (`/checklist`, `/packet`, `/answer`) are indexable — query-param permutations create unbounded duplicate URLs and put user-flow state in the index | P0 | `api/router.ts`, `src/render.ts` |
| 3 | No `<meta name="description">` on any page | P1 | `src/render.ts` `page()` |
| 4 | No `hreflang` alternates — the EN/ES split (`?language=es`) is invisible to crawlers, so the Spanish content can't rank for Spanish queries and the two get treated as duplicates | P1 | `page()` |
| 5 | No canonical URLs — with query-param routing, every parameter ordering is a distinct URL to a crawler | P1 | `page()` |
| 6 | `<title>` is the bare page heading: no brand, no keyword-shaped homepage title | P1 | `page()`, `src/i18n/*` |
| 7 | No Open Graph / Twitter Card tags — links shared in community spaces (where this will spread) render as bare URLs | P1 | `page()` |
| 8 | No structured data (JSON-LD). `HowTo`, `FAQPage`, `GovernmentService`, and `BreadcrumbList` all apply and drive rich results | P1 | new |
| 9 | No `robots.txt` — crawlers get a 404; no place to point a sitemap or disallow user-state paths | P1 | `api/router.ts` |
| 10 | No `sitemap.xml` — nothing tells search engines which URLs are canonical and translated | P1 | new |
| 11 | No favicon or web manifest — affects SERP presentation and the install/share affordance | P2 | `public/` |
| 12 | No measurement path compatible with the no-tracker stance | P1 | ops |

**What is already right** (worth keeping as the plan changes things):

- Clean, semantic, server-rendered HTML with one `<h1>` per page and a correct heading
  order (the a11y gate enforces this; it doubles as on-page SEO hygiene).
- Real HTTP status codes: genuine `404` for unknown routes, `400`/`405` where due. No
  soft-404s, which are a common SEO own-goal.
- `<html lang>` is set correctly per page.
- Fast, dependency-light pages with a strict CSP and no render-blocking third-party
  scripts — Core Web Vitals should be excellent out of the box.
- Mobile viewport is set; layout is responsive and zoom-tolerant (a11y gate).
- The content is genuinely authoritative (cited to official sources with dates), which
  is exactly what Google's helpful-content and E-E-A-T systems reward — *if* it is
  reachable at an indexable URL.

## Plan

### Phase 0 — Decide the indexing contract (do first; it's a design decision)

Write down, in one place, which surfaces are indexable and which are not. Proposed:

- **Index:** `/` (homepage), the new guide pages (Phase 2), `/terms`, `/privacy`,
  `/accessibility`.
- **`noindex`:** `/checklist`, `/packet`, `/answer`, `/forms/*`. These are user-state
  or interaction endpoints. They carry no PII (selections only), but they are not
  content to rank, and indexing them wastes crawl budget and muddies the index.
- **Disallow in robots.txt:** the user-state HTML routes above plus `/healthz`. Do
  **not** disallow `/assets/*` or `/vendor/*` — search engines must fetch the CSS and
  JS to render and judge the page, so blocking them hurts ranking.

This contract drives Phases 1–3. It's a judgment call about product surface, so it's
the one thing to confirm before building.

### Phase 1 — Tag-level foundations (pure code; ship now, harmless pre-domain)

All of this lives in the `page()` head in `src/render.ts` plus the locale bundles, so
it's centralized and testable. Add a gate (`scripts/seo-lint.ts`) the way every other
property here is gated.

1. **Meta description** per page, from the locale bundle (each page type gets a
   distinct, ~150-char description; the homepage and guide pages are keyword-shaped,
   the legal pages plain).
2. **`noindex` directive** (`<meta name="robots" content="noindex,follow">`) on the
   pages the contract excludes. Thread an `index: boolean` through `page()`.
3. **Canonical link** — emit `<link rel="canonical">` built from the *normalized*
   route, not the raw query (reuse the existing `intakeQuery` canonical-rebuild logic
   in `api/router.ts`, which already drops unknown params).
4. **`hreflang` alternates** — on every indexable page, emit
   `<link rel="alternate" hreflang="en" ...>` / `hreflang="es" ...` /
   `hreflang="x-default" ...`. This is the single highest-value tag here given the
   bilingual content.
5. **Title template** — `"<page> · Trans Docs Navigator"`, with a keyword-shaped
   homepage title (e.g. "Legal name & gender-marker change guide, by state").
6. **Open Graph + Twitter cards** — `og:title/description/type/locale/url`,
   `og:locale:alternate`, `twitter:card=summary_large_image`, plus one static social
   image in `public/assets/`. Matters because this spreads through shared links.
7. **`robots.txt`** served from the router (like `/assets/app.css` is): allow all,
   disallow the never-crawl paths, point to the sitemap.
8. **Favicon + minimal web manifest** in `public/assets/`, linked from `page()`.

A gate to add alongside: assert every indexable page has a title, description,
canonical, and both hreflang alternates, and that every excluded page carries
`noindex`. Wire it into `make verify` and the smoke journey.

### Phase 2 — The indexable content surface (the lever)

Build stable guide pages from the corpus. This is where ranking actually comes from.

1. **URL scheme:** human-readable, stable, no query params —
   `/guide/<state>/<topic>`, e.g. `/guide/california/name-change`,
   `/guide/illinois/gender-marker`, plus federal `/guide/federal/social-security`.
   Spanish at the same path with `?language=es` *and* a proper hreflang pairing (or
   `/es/guide/...` if you prefer path-based locales — decide in Phase 0).
2. **Content:** server-render the relevant corpus records in full — statement, detail,
   cost, timeline, every citation with its last-verified date — as readable prose, not
   a form result. Each page ends with a clear CTA into the interactive checklist
   (`/checklist?jurisdiction=...`) for the personalized, multi-document plan. The guide
   page is the indexable front door; the app is the tool behind it.
3. **Structured data per guide page:** `HowTo` (the ordered steps), `FAQPage` (common
   questions per topic), and `BreadcrumbList`. JSON-LD, built from the same corpus
   records so it can never drift from the visible content (which is also what keeps it
   within Google's structured-data policy).
4. **Internal linking:** a real index at `/guide` linking every page; cross-links
   between a state's topics and to the federal steps; breadcrumbs. Right now the app
   has almost no internal link graph, which starves crawl discovery.
5. **Freshness signals:** these pages already carry per-record last-verified dates;
   surface a page-level "last reviewed" date too. The existing freshness SLA and the
   `content-watch` workflow keep them honest, which is a durable ranking asset most
   sites can't claim.
6. **Generation:** render guide pages from the corpus at request time (same pattern as
   the rest of the app), so adding a verified record automatically yields or enriches a
   page. Include them in the sitemap generator.

This phase is also the strongest mission argument: it puts cited, current guidance in
front of people at the moment they search, which is the entire point of the project.

### Phase 3 — Sitemap & crawl management (after Phase 2 exists)

1. **`sitemap.xml`** generated from the route set + the guide pages, served from the
   router. Include `<xhtml:link rel="alternate" hreflang>` entries so the EN/ES pairing
   is declared at the sitemap level too. Exclude every `noindex` URL.
2. Reference it from `robots.txt` and submit it in Search Console once the domain is
   live.
3. Regenerate as part of the build so it never goes stale; assert in CI that every
   indexable route appears and no excluded route does.

### Phase 4 — Measurement without trackers (privacy-compatible)

The no-analytics stance is correct and worth protecting. You can still measure:

1. **Google Search Console** (and Bing Webmaster Tools). These use the search engine's
   own crawl and click data, set no client-side cookies, and collect nothing the user's
   browser sends to you. Fully compatible with the privacy posture. This is the primary
   instrument: impressions, queries, CTR, index coverage, Core Web Vitals.
2. **Server-side, non-PII landing data.** The allowlist logger (`api/log.ts`) already
   emits structured events. Add the *referrer host only* (not the full referrer URL,
   not the query) and the landing path to the existing event allowlist, so you can see
   which guide pages draw traffic without logging anything about the person. Run it past
   `privacy-lint` and the egress test before shipping.
3. No third-party analytics, no client beacons. Keep it that way; it's a differentiator
   and a safety property.

## Sequencing

Phase 0 (decide the contract) → Phase 1 (tag foundations + gate, ships now) → Phase 2
(guide pages — the real work) → Phase 3 (sitemap) → Phase 4 (Search Console once the
domain is live). Phases 1–3 are pure code and can land before deployment; Phase 4 and
the actual ranking payoff begin when the site is publicly hosted on a real domain
(tracked as a blocked item in `PRODUCTIONIZATION-PLAN.md` Phase 1).

## Out of scope / needs a human or an account

- A registered domain and public hosting (blocks all real-world ranking; see
  `PRODUCTIONIZATION-PLAN.md`).
- Search Console / Bing Webmaster verification (needs the live domain + account access).
- Off-page work: outreach to trans legal-aid orgs for links is high-value E-E-A-T
  signal but is human relationship work, and should be coordinated with those orgs, not
  automated.
- Copywriting review of guide-page prose and FAQ content by someone close to the
  community, alongside the existing named-verifier content gate.
