// HTTP shell. The PRIVACY INVARIANT (enforced by privacy-lint) holds here: this file
// references no identity PII. All routing/validation logic lives in api/router.ts (which
// is unit-tested and coverage-gated); this file only does HTTP plumbing — security
// headers, request bounds, a simple rate limit, timeouts, and static-file serving.

import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join, normalize, extname, sep } from "node:path";
import { REPO_ROOT, loadCorpus, LAST_QUARANTINE, verifyCorpusManifest } from "./corpus.ts";
import { safeLog } from "./log.ts";
import { handleRoute, asLanguage } from "./router.ts";

const PORT = Number(process.env.PORT ?? 8080);

// Health/readiness probes are unauthenticated and EXCLUDED from the access log
// (OBSERVABILITY-STANDARD §6): kept out of log noise so probe traffic (every few
// seconds) doesn't drown the request stream.
const HEALTH_PATHS = new Set(["/livez", "/readyz", "/healthz"]);

// Abuse resistance.
const MAX_URL_LEN = 4096; // reject absurd query strings before parsing
const REQUEST_TIMEOUT_MS = 15_000; // socket idle/processing timeout
const RATE_LIMIT = { windowMs: 60_000, max: 120 }; // per-IP requests/min

const MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

// Strict security headers. No inline scripts or styles anywhere: client JS is served
// from /assets/ (public/assets on disk), the stylesheet from /assets/app.css, and
// per-page config travels in JSON islands — so the CSP is 'self' across the board.
const SECURITY_HEADERS: Record<string, string> = {
  "content-security-policy":
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer",
  "cross-origin-opener-policy": "same-origin",
  // HSTS (2 years, subdomains included; no `preload` — this repo is deployed to
  // multiple hosts per docs/DEPLOY-*.md and preload-list submission is a one-way
  // door that should be a deliberate ops decision, not a default).
  "strict-transport-security": "max-age=63072000; includeSubDomains",
  // No feature this app uses needs a browser permission; deny every gated feature
  // outright rather than allowlisting 'self' for anything (SEC-20).
  "permissions-policy":
    "geolocation=(), camera=(), microphone=(), payment=(), usb=(), fullscreen=(), interest-cohort=()",
};

function send(res: ServerResponse, status: number, contentType: string, body: string | Buffer, extra?: Record<string, string>): void {
  res.writeHead(status, { "content-type": contentType, ...SECURITY_HEADERS, ...extra });
  res.end(body);
}

// The ONLY directories static serving may reach. We assert the resolved path is inside
// one of these (not merely under REPO_ROOT), so a traversal that still resolves under the
// repo can't disclose source files. We also reject any pathname carrying `..` or an
// encoded slash before it's resolved.
const VENDOR_DIR = join(REPO_ROOT, "public", "vendor");
const ASSETS_DIR = join(REPO_ROOT, "public", "assets");
const FIXTURES_DIR = join(REPO_ROOT, "forms", "fixtures");

/** Serve a static file only from the public/{vendor,assets}/ and forms/fixtures/ allowlist. */
function tryStatic(pathname: string, res: ServerResponse): boolean {
  if (pathname.includes("..") || /%2[ef]/i.test(pathname)) return false; // no traversal / encoded sep
  const isPublic = pathname.startsWith("/vendor/") || pathname.startsWith("/assets/");
  const isFixture = pathname.startsWith("/forms/fixtures/");
  if (!isPublic && !isFixture) return false;
  const full = normalize(join(REPO_ROOT, isPublic ? join("public", pathname) : pathname));
  const allowedDir = pathname.startsWith("/vendor/") ? VENDOR_DIR : isPublic ? ASSETS_DIR : FIXTURES_DIR;
  // /assets/app.css is not on disk (the router serves it from the typed palette), so a
  // miss here falls through to routing rather than 404ing.
  if (!full.startsWith(allowedDir + sep) || !existsSync(full) || !statSync(full).isFile()) return false;
  send(res, 200, MIME[extname(full)] ?? "application/octet-stream", readFileSync(full));
  return true;
}

// Tiny in-memory fixed-window rate limiter (per client IP). Stateless service, so this
// is best-effort process-local protection; a real deploy fronts it with an edge limiter.
// Entries are swept so a spray of unique IPs (IPv6) can't grow the map without bound.
const hits = new Map<string, { count: number; resetAt: number }>();
const MAX_TRACKED_IPS = 50_000;
let sweepCounter = 0;
function rateLimited(ip: string, now: number): boolean {
  if (++sweepCounter >= 1000 || hits.size > MAX_TRACKED_IPS) {
    sweepCounter = 0;
    for (const [k, v] of hits) if (now >= v.resetAt) hits.delete(k);
    if (hits.size > MAX_TRACKED_IPS) hits.clear(); // hard bound if everything is still active
  }
  const slot = hits.get(ip);
  if (!slot || now >= slot.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + RATE_LIMIT.windowMs });
    return false;
  }
  slot.count++;
  return slot.count > RATE_LIMIT.max;
}

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  const start = Date.now();
  const requestId = randomUUID(); // correlation id; not derived from and never carries user data
  const ip = req.socket.remoteAddress ?? "unknown";
  let route = "/";
  try {
    if ((req.url ?? "").length > MAX_URL_LEN) {
      send(res, 414, "text/plain; charset=utf-8", "URI too long");
      return;
    }
    if (rateLimited(ip, start)) {
      res.writeHead(429, { "content-type": "text/plain; charset=utf-8", "retry-after": "60", ...SECURITY_HEADERS });
      res.end("Too many requests");
      safeLog("rate_limited", { status: 429 });
      return;
    }

    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
    route = url.pathname;

    if (tryStatic(route, res)) return;

    const r = handleRoute(req.method ?? "GET", url);
    // I18N-13 (G11): declare the resolved rendered language on every localized HTML
    // response, independent of how it was selected (explicit ?language= param here,
    // not Accept-Language negotiation — see docs/I18N.md). Non-HTML responses (health
    // probes, JSON, the stylesheet, robots/sitemap) carry no human-language content.
    const langHeaders: Record<string, string> = r.contentType.startsWith("text/html")
      ? { "content-language": asLanguage(url.searchParams.get("language")) }
      : {};
    send(res, r.status, r.contentType, r.body, { ...langHeaders, ...r.headers });
    if (r.log) safeLog(r.log.event, r.log.fields);
  } catch (err) {
    send(res, 500, "text/html; charset=utf-8", "<!doctype html><html lang=en><title>Error</title><p>Something went wrong. Please try again.</p>");
    // Log the error CLASS only, never the message — a message can interpolate content the
    // allowlist logger wouldn't otherwise see. Stack/detail belong in a non-PII trace sink.
    safeLog("error", { route, status: 500, error: (err as Error).name }, "error");
  } finally {
    // Structured access log: one JSON line per request with the correlation id, method,
    // path, response status, and latency. Health probes are excluded (§6). `route` is a
    // matched pathname only — never the query string — so no query content is logged.
    if (!HEALTH_PATHS.has(route)) {
      safeLog("request", {
        request_id: requestId,
        method: req.method ?? "GET",
        path: route,
        status: res.statusCode,
        latency_ms: Date.now() - start,
      });
    }
  }
});

// Warm the corpus in fail-DEGRADED mode at startup: a single malformed record is
// quarantined (and alarmed) rather than taking the whole service down. CI still loads
// fail-closed via the content gate, so a bad record can't reach production unseen.
loadCorpus({ quarantine: true });
if (LAST_QUARANTINE.length > 0) {
  safeLog("corpus_quarantine", { quarantined: LAST_QUARANTINE.length, status: 200 });
}

// Corpus integrity attestation (FIX-09 §A): the digest baked into corpus.manifest.json
// at build/image time must match a live recompute of the corpus/forms bytes on disk
// right now. Extends the quarantine pattern above, but LOUD rather than degraded — a
// mismatch means what's on disk is not what CI's content gate cleared (a tampered
// image, a bad deploy, a stray hand-edit), so we refuse to come up at all rather than
// silently serve unverified content.
const integrity = verifyCorpusManifest();
if (integrity.expected === null) {
  // No manifest baked in: the normal case in local dev, where nobody runs
  // `npm run corpus:manifest` before `npm run dev`. Logged once at info, never fatal.
  safeLog("corpus_integrity", { status: 200 }, "info");
} else if (!integrity.ok) {
  safeLog("corpus_integrity", { status: 200, expected: integrity.expected, actual: integrity.actual }, "error");
  process.exit(1); // loud quarantine: refuse to serve corpus-backed routes at all
}

server.requestTimeout = REQUEST_TIMEOUT_MS;
server.headersTimeout = REQUEST_TIMEOUT_MS;
server.listen(PORT, () => safeLog("listening", { route: `http://localhost:${PORT}`, status: 200 }));
