# 7. Google Analytics 4 page counts: path only, never a question, never the relocation planner

## Status

Accepted (2026-09-17)

## Context

On 2026-09-17 the owner decided to run Google Analytics 4 on every public site in the
portfolio, and to update privacy pages and claims to match. This service is the hardest
case in that set. It exists for trans people changing their legal name and gender marker,
and its threat model assumes some users are in hostile jurisdictions. Until now the Privacy
Notice promised "no advertising or analytics trackers and no tracking cookies", and the
ROADMAP called zero client-side telemetry to a third party a core safety property. The DPIA
records one third-party flow (an NPPES lookup by destination) as rejected because it would
disclose a relocation plan at the moment of planning.

GA cannot be added the way the static sites add it. The page address here is not just a
page name. Its query string carries the state, change and document choices, the court-order
and minor bits, a packet's print date (`since`), the relocation origin and destination, and
on `/answer` a free-text question (`q`) that users sometimes fill with their own names. GA4's
enhanced measurement also treats `q` as a site-search term by default.

## Decision

`public/assets/analytics.js` is the only code that talks to Google. `page()` in
`src/render.ts` loads it on every rendered page (`<script src="/assets/analytics.js"
defer>`, same-origin, allowed by `script-src 'self'`). It holds the measurement ID
`G-8HZFD5R23E` (GA4 property 554877190, 14-month retention, Google signals disabled). Setting
it to `""` removes GA and the opt-out control.

It loads `gtag.js` only when every one of these holds:

1. The page is served over HTTPS from the production Lambda URL host
   (`7cddozrk6sfpsq7foszis7tcza0boyka.lambda-url.us-west-2.on.aws`). Local runs, the test
   servers, CI, Render, and any other deployment never contact Google.
2. The URL carries none of GA's site-search parameters (`q`, `s`, `search`, `query`,
   `keyword`). A page with a question loads no analytics at all, so no GA property setting
   can turn a question into a search term.
3. The path is not `/move` or `/plan`. The relocation planner loads no analytics even
   without its origin and destination, because the visit alone is timestamped interest in
   leaving a state.
4. The browser does not send Global Privacy Control, and Do Not Track is off.
5. The visitor has not opted out. The footer control stores `"1"` under the localStorage key
   `trans-docs-navigator:analytics-opt-out` and sets `window["ga-disable-G-8HZFD5R23E"]`.

When it loads:

- **Path only.** `page_location` is origin plus path. No query string or fragment reaches
  Google, so no selection, court-order or minor bit, `since` date, or question does either.
  `page_referrer` is the referring origin only. (The service's own `referrer-policy:
  no-referrer` already keeps internal navigations from carrying a referrer.)
- **Consent Mode v2 defaults.** `ad_storage`, `ad_user_data` and `ad_personalization` are
  denied everywhere. `analytics_storage` is denied through `region` for the EEA, GB and CH
  (cookieless pings there), and granted elsewhere. There is no banner, so these never change.
- **Config.** `allow_google_signals: false`, `allow_ad_personalization_signals: false`. No
  custom events. The file never reads a form, the on-device form helper, the encrypted
  resume blob, the packet, offline copies, or page content.

The CSP moves to `api/csp.ts`, so tests can read it without starting the server, and gains
exactly Google's documented GA4 origins: `script-src https://www.googletagmanager.com`;
`connect-src https://*.google-analytics.com https://*.analytics.google.com
https://www.googletagmanager.com`; `img-src https://*.google-analytics.com
https://www.googletagmanager.com`. The service worker already ignores cross-origin requests,
so it never caches or replays GA traffic. `/assets/analytics.js` joins the offline shell.

The footer control's words are rendered from the en/es catalogs into `data-*` attributes,
so the loader carries no user-facing text. It is hidden without JavaScript, which is also
when GA cannot run, and it explains itself under GPC/DNT or blocked storage.

## Consequences

- The Privacy Notice (en/es) replaces "No cookies, no trackers" with three sections: what
  GA receives and never receives, cookies (`_ga`, `_ga_8HZFD5R23E`, up to two years; none in
  the EEA/UK/CH), and how to turn it off. The short version, the footer and "Why we built it
  this way" mention it too. `LEGAL_EFFECTIVE_DATE` moves to 2026-09-17.
- The DPIA gains an inventory row, a control row, and a reviewer question on whether
  page-count paths to a US company are acceptable for this population. The owner accepted
  it; the named reviewer has not.
- The ROADMAP's RUM row, the README's privacy guarantee, the SEO plan and the infra comments
  are corrected so no "no analytics" claim remains false.
- The RSS/Atom feeds are XML and never load the script, so "the feeds themselves are never
  tracked" stays true.
- **Deploy.** The Lambda preview runs the container image and does not change until
  `deploy-aws-preview.yml` is dispatched (manual by design). GA takes effect only after that.
- Owner steps in the GA4 web stream: under Enhanced measurement, turn off "Page changes based
  on browser history events", "Site search" and "Form interactions". The loader already makes
  site search impossible to trigger, and form interactions send form IDs, not values, but
  this service should not rely on either.
