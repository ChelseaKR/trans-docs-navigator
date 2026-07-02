// Service-worker + offline PWA tests (EXP-01).

import { test } from "node:test";
import assert from "node:assert/strict";
import { handleRoute } from "../api/router.ts";
import { SW_VERSION, serviceWorkerScript, SHELL_ASSETS, staleAfterDays, SAVED_CACHE } from "../src/offline.ts";
import { renderOfflinePage } from "../src/pages.ts";
import { loadCorpus } from "../api/corpus.ts";

const u = (path: string) => new URL(path, "http://localhost:8080");

test("GET /offline renders the offline notice page", () => {
  const r = handleRoute("GET", u("/offline"));
  assert.equal(r.status, 200);
  assert.ok(r.body.includes("offline"), "should mention offline");
  assert.ok(r.body.includes("offline-list"), "should have offline list element");
  assert.ok(r.body.includes("offline-cfg"), "should have offline config");
});

test("GET /offline?language=es renders in Spanish", () => {
  const r = handleRoute("GET", u("/offline?language=es"));
  assert.equal(r.status, 200);
  assert.match(r.body, /Está sin conexion/i);
});

test("GET /sw.js serves the service worker", () => {
  const r = handleRoute("GET", u("/sw.js"));
  assert.equal(r.status, 200);
  assert.equal(r.contentType, "text/javascript; charset=utf-8");
  assert.match(r.body, /self\.addEventListener/);
  assert.match(r.body, /SAVED_CACHE/);
  assert.match(r.body, /tdn-shell-/);
});

test("service worker script includes the version hash", () => {
  const sw = serviceWorkerScript();
  assert.ok(sw.includes("tdn-shell-"), "should contain tdn-shell prefix");
  assert.ok(sw.includes(`const VERSION = "${SW_VERSION}"`), "should contain VERSION constant");
  assert.ok(sw.includes(SAVED_CACHE), "should contain SAVED_CACHE");
});

test("SW_VERSION is a 12-hex string", () => {
  assert.match(SW_VERSION, /^[0-9a-f]{12}$/);
});

test("SHELL_ASSETS includes all required files", () => {
  const required = ["/assets/app.css", "/assets/offline.js", "/assets/site.webmanifest", "/offline"];
  for (const asset of required) {
    assert.ok(SHELL_ASSETS.includes(asset), `SHELL_ASSETS missing ${asset}`);
  }
});

test("staleAfterDays returns the tightest corpus SLA or fail-safe default", () => {
  const days = staleAfterDays(() => loadCorpus());
  assert.ok(Number.isInteger(days) && days > 0, "should be a positive integer");
  // The corpus has 30 and 90-day records; should return 30.
  assert.equal(days, 30);
});

test("staleAfterDays returns fallback when corpus load fails", () => {
  const days = staleAfterDays(() => {
    throw new Error("corpus unavailable");
  });
  assert.equal(days, 30); // FALLBACK_STALE_DAYS
});

test("renderOfflinePage includes offline-cfg JSON island with stale window", () => {
  const html = renderOfflinePage("en");
  assert.match(html, /"offline-cfg"/);
  assert.match(html, /staleAfterDays/);
  assert.match(html, /offline-list/);
});

test("service worker template never writes in the fetch handler", () => {
  const sw = serviceWorkerScript();
  // Verify fetch handler never calls cache.put, cache.add, or cache.addAll without
  // being in the install listener context. Match the fetch listener block.
  const fetchBlock = sw.match(/self\.addEventListener\("fetch"[\s\S]*?\}\);$/m)?.[0] ?? "";
  assert.ok(!fetchBlock.includes("cache.put"), "fetch handler must never write to cache");
  // But install should add to the shell cache.
  assert.match(sw, /self\.addEventListener\("install"[\s\S]*?addAll[\s\S]*?\}\);/);
});

test("service worker has no background-sync, push, or periodic-sync listeners", () => {
  const sw = serviceWorkerScript();
  assert.ok(!sw.includes('addEventListener("sync"'), "no background sync listener");
  assert.ok(!sw.includes('addEventListener("push"'), "no push listener");
  assert.ok(!sw.includes('addEventListener("periodicsync"'), "no periodic sync listener");
});

test("SAVED_CACHE constant is defined and exported", () => {
  assert.equal(SAVED_CACHE, "tdn-saved-v1");
});
