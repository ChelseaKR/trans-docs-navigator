// Offline-capable PWA shell (docs/ideation/03-expansions.md EXP-01) — a PRIVACY
// feature, not a convenience feature.
//
// THREAT MODEL (mirrors src/secure-resume.ts): for users in hostile jurisdictions,
// re-reading a saved checklist must not generate fresh network traffic — and the
// service worker itself must never become a new observability surface. So:
//   • EXPLICIT SAVE ONLY — the service worker is registered, and pages are cached,
//     only when the user presses "Save for offline" (public/assets/offline.js).
//     The fetch handler NEVER writes to a cache; there is no background sync, no
//     push, no periodic sync, no speculative prefetch. Ever.
//   • LOCAL ONLY — saving writes to the browser's Cache Storage on the device;
//     nothing is sent anywhere. One button deletes every cache and unregisters
//     the worker.
//   • HONEST STALENESS — every saved page gets a "saved on DATE — laws change"
//     banner burned into its HTML at save time, with a re-check window keyed to
//     the corpus freshness SLAs (api/freshness.ts semantics: the tightest
//     recheck_sla_days in the corpus — past that, some saved fact may no longer
//     be serveable-as-current even online).
//   • FORENSIC TRADE-OFF DOCUMENTED — cached pages are device-discoverable and
//     NOT encrypted (unlike save/resume). The trade-off is stated in the save
//     panel itself and on /privacy. Counsel/DPIA review of that copy is an open
//     gate (see EXP-01 in docs/ideation/03-expansions.md).
//
// Like the stylesheet (src/render.ts STYLE → /assets/app.css), the service worker
// is generated from typed code and served at /sw.js by api/router.ts, so the shell
// version hash below always matches the assets actually deployed — that hash IS the
// update flow: any change to the shell changes /sw.js byte-for-byte, the browser
// installs the new worker on the next visit, and old shell caches are deleted on
// activate (the user's explicitly saved pages are kept).

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT, loadCorpus } from "../api/corpus.ts";
import type { CorpusRecord } from "../api/types.ts";
import { STYLE } from "./render.ts";
import { t as locale, SUPPORTED_LOCALES } from "./i18n/index.ts";

/** Cache holding the user's explicitly saved pages. NOT versioned with the shell:
 *  a shell update must never silently discard what the user chose to keep. */
export const SAVED_CACHE = "tdn-saved-v1";

/** Fail-safe re-check window (days) when the corpus can't be read: the tightest
 *  SLA the corpus schema uses, so degraded mode is the most cautious mode. */
const FALLBACK_STALE_DAYS = 30;

/**
 * URLs precached at service-worker install: everything any saved page needs to
 * render (stylesheet, client modules, manifest, icon) plus the offline notice in
 * every supported language. All same-origin; the shell contains no user state.
 */
export const SHELL_ASSETS: readonly string[] = [
  "/assets/app.css",
  "/assets/offline.js",
  "/assets/progress.js",
  "/assets/resume-crypto.js",
  "/assets/resume-panel.js",
  "/assets/packet.js",
  "/assets/form-copy.js",
  "/assets/vitals.js",
  "/assets/site.webmanifest",
  "/assets/favicon.svg",
  "/offline",
  ...SUPPORTED_LOCALES.filter((l) => l.language !== "en").map((l) => `/offline?language=${l.language}`),
];

/**
 * "Laws change" window for the burned-in banner: the TIGHTEST recheck SLA in the
 * corpus (api/freshness.ts treats a record past its recheck_sla_days as no longer
 * serveable-as-current, so past this window the saved copy may contain facts even
 * the live site would refuse to present). Injectable + fail-safe like
 * api/router.ts readiness().
 */
export function staleAfterDays(load: () => CorpusRecord[] = () => loadCorpus()): number {
  try {
    const corpus = load();
    if (corpus.length === 0) return FALLBACK_STALE_DAYS;
    return Math.min(...corpus.map((r) => r.recheck_sla_days));
  } catch {
    return FALLBACK_STALE_DAYS;
  }
}

// The service worker, as a template with the version + shell manifest burned in by
// serviceWorkerScript(). Plain string concatenation only (no backticks) so nothing
// here is interpolated by accident. INVARIANTS the test suite pins: no cache writes
// outside install, and no "sync"/"push"/"periodicsync" listeners — saving is always
// an explicit user action and the worker never generates traffic on its own.
const SW_TEMPLATE = `// Trans Docs Navigator service worker — generated from src/offline.ts. Do not edit here.
// Privacy invariants: never caches in the fetch handler (saving is an explicit user
// action in /assets/offline.js), no background sync, no push. Local-first, egress-free.
"use strict";

const VERSION = "__VERSION__";
const SHELL_CACHE = "tdn-shell-" + VERSION;
const SAVED_CACHE = "__SAVED_CACHE__";
const SHELL = __SHELL__;

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(function (cache) { return cache.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

// Update flow: a changed shell ships as a byte-different /sw.js; on activate the new
// worker deletes every stale tdn-shell-* cache and takes over open pages. The user's
// explicitly saved pages (SAVED_CACHE) are never touched by an update.
self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(
          keys
            .filter(function (k) { return k.indexOf("tdn-shell-") === 0 && k !== SHELL_CACHE; })
            .map(function (k) { return caches.delete(k); })
        );
      })
      .then(function () { return self.clients.claim(); })
  );
});

// Fetch strategy — reads only, NEVER writes a cache:
//   • navigations: network-first (an online user always sees the live page), falling
//     back to the user's saved copy (which carries its burned-in "saved on" banner),
//     then to the offline notice;
//   • shell sub-resources: cache-first from the versioned shell (its version is a
//     content hash, so a stale hit is impossible);
//   • everything else: straight to the network.
self.addEventListener("fetch", function (event) {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const key = url.pathname + url.search;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(function () {
        return caches.match(key, { cacheName: SAVED_CACHE }).then(function (saved) {
          if (saved) return saved;
          return caches.match(key, { cacheName: SHELL_CACHE }).then(function (shellHit) {
            if (shellHit) return shellHit;
            const lang = url.searchParams.get("language");
            const fallback = lang && lang !== "en" ? "/offline?language=" + lang : "/offline";
            return caches.match(fallback, { cacheName: SHELL_CACHE }).then(function (page) {
              return page || caches.match("/offline", { cacheName: SHELL_CACHE });
            });
          });
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(key, { cacheName: SHELL_CACHE }).then(function (hit) {
      return hit || fetch(req);
    })
  );
});
`;

/**
 * Content fingerprint of the shell: the stylesheet, every shell asset on disk, the
 * UI string bundles (the offline-notice pages render from them), and the worker
 * template itself. Changing any of these changes /sw.js, which is what triggers the
 * browser's service-worker update — no manual version bump to forget.
 */
function shellFingerprint(): string {
  const h = createHash("sha256");
  h.update(STYLE);
  h.update(SW_TEMPLATE);
  for (const asset of SHELL_ASSETS) {
    // app.css is served from STYLE (already hashed); /offline pages render from the
    // UI bundles (hashed below); everything else is a real file under public/.
    if (asset.startsWith("/assets/") && asset !== "/assets/app.css") {
      h.update(readFileSync(join(REPO_ROOT, "public", asset)));
    }
  }
  for (const l of SUPPORTED_LOCALES) {
    h.update(JSON.stringify(locale(l.language).ui));
  }
  return h.digest("hex").slice(0, 12);
}

/** The deployed shell version (12-hex content hash; see shellFingerprint). */
export const SW_VERSION = shellFingerprint();

/** The service worker served at /sw.js (api/router.ts), version + manifest burned in. */
export function serviceWorkerScript(): string {
  return SW_TEMPLATE
    .replace("__VERSION__", SW_VERSION)
    .replace("__SAVED_CACHE__", SAVED_CACHE)
    .replace("__SHELL__", JSON.stringify(SHELL_ASSETS));
}
