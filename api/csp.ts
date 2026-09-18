// The Content-Security-Policy every response carries (api/server.ts). Kept in its own
// module so tests can read it without starting the server.
//
// 'self' across the board: client JS is served from /assets/, the stylesheet from
// /assets/app.css, and per-page config travels in JSON islands, so nothing is inline.
// The only other origins are the minimum Google Analytics 4 needs for
// /assets/analytics.js on the production host (docs/adr/0007): gtag.js from
// www.googletagmanager.com, and its measurement requests to *.google-analytics.com and
// *.analytics.google.com (Google's documented GA4 CSP set, without Google signals).

export const GA_SCRIPT_ORIGINS = ["https://www.googletagmanager.com"] as const;
export const GA_CONNECT_ORIGINS = [
  "https://*.google-analytics.com",
  "https://*.analytics.google.com",
  "https://www.googletagmanager.com",
] as const;
export const GA_IMG_ORIGINS = ["https://*.google-analytics.com", "https://www.googletagmanager.com"] as const;

export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  `script-src 'self' ${GA_SCRIPT_ORIGINS.join(" ")}`,
  "style-src 'self'",
  `img-src 'self' data: ${GA_IMG_ORIGINS.join(" ")}`,
  `connect-src 'self' ${GA_CONNECT_ORIGINS.join(" ")}`,
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
].join("; ");
