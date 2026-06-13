// HTTP shell. The PRIVACY INVARIANT (enforced by privacy-lint) holds here: this file
// references no identity PII. All routing/validation logic lives in api/router.ts (which
// is unit-tested and coverage-gated); this file only does HTTP plumbing — security
// headers, request bounds, a simple rate limit, timeouts, and static-file serving.

import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, normalize, extname, sep } from "node:path";
import { REPO_ROOT, loadCorpus, LAST_QUARANTINE } from "./corpus.ts";
import { safeLog } from "./log.ts";
import { handleRoute } from "./router.ts";

const PORT = Number(process.env.PORT ?? 8080);

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
    send(res, r.status, r.contentType, r.body, r.headers);
    if (r.log) safeLog(r.log.event, r.log.fields);
  } catch (err) {
    send(res, 500, "text/html; charset=utf-8", "<!doctype html><html lang=en><title>Error</title><p>Something went wrong. Please try again.</p>");
    // Log the error CLASS only, never the message — a message can interpolate content the
    // allowlist logger wouldn't otherwise see. Stack/detail belong in a non-PII trace sink.
    safeLog("error", { route, status: 500, error: (err as Error).name });
  } finally {
    safeLog("request", { route, method: req.method ?? "GET", duration_ms: Date.now() - start });
  }
});

// Warm the corpus in fail-DEGRADED mode at startup: a single malformed record is
// quarantined (and alarmed) rather than taking the whole service down. CI still loads
// fail-closed via the content gate, so a bad record can't reach production unseen.
loadCorpus({ quarantine: true });
if (LAST_QUARANTINE.length > 0) {
  safeLog("corpus_quarantine", { quarantined: LAST_QUARANTINE.length, status: 200 });
}

server.requestTimeout = REQUEST_TIMEOUT_MS;
server.headersTimeout = REQUEST_TIMEOUT_MS;
server.listen(PORT, () => safeLog("listening", { route: `http://localhost:${PORT}`, status: 200 }));
