// Cookieless Core Web Vitals RUM (OBSERVABILITY-STANDARD §8): beacon validation
// (api/vitals.ts), the safe-logger allowlist for the sample fields, the client
// script's privacy/egress posture, and its presence in the page shell.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseWebVital, MAX_BEACON_BYTES } from "../api/vitals.ts";
import { safeLog, isLoggableField } from "../api/log.ts";
import { page } from "../src/render.ts";
import { SHELL_ASSETS } from "../src/offline.ts";

const valid = () =>
  JSON.stringify({ type: "vital", name: "LCP", value: 1234.567, rating: "good", path: "/checklist" });

// ── parseWebVital (fail-closed validation) ─────────────────────────────────

test("accepts a valid cookieless sample", () => {
  const v = parseWebVital(valid());
  assert.deepEqual(v, { name: "LCP", value: 1234.567, rating: "good", path: "/checklist" });
});

test("accepts every Core Web Vital name and rating", () => {
  for (const name of ["CLS", "INP", "LCP"]) {
    for (const rating of ["good", "needs-improvement", "poor"]) {
      const v = parseWebVital(JSON.stringify({ name, value: 0.07, rating, path: "/" }));
      assert.ok(v, `${name}/${rating} should be accepted`);
    }
  }
});

test("rejects unknown metric names, ratings and malformed values", () => {
  assert.equal(parseWebVital(JSON.stringify({ name: "FID", value: 1, rating: "good", path: "/" })), null);
  assert.equal(parseWebVital(JSON.stringify({ name: "LCP", value: 1, rating: "terrible", path: "/" })), null);
  assert.equal(parseWebVital(JSON.stringify({ name: "LCP", value: "fast", rating: "good", path: "/" })), null);
  assert.equal(parseWebVital(JSON.stringify({ name: "LCP", value: -5, rating: "good", path: "/" })), null);
  assert.equal(parseWebVital(JSON.stringify({ name: "LCP", value: Infinity, rating: "good", path: "/" })), null);
});

test("rejects non-JSON, non-object, oversized and empty bodies", () => {
  assert.equal(parseWebVital("not json"), null);
  assert.equal(parseWebVital("[1,2,3]"), null);
  assert.equal(parseWebVital(""), null);
  assert.equal(parseWebVital(`{"pad":"${"x".repeat(MAX_BEACON_BYTES)}"}`), null);
});

test("rejects a path that is missing or not site-relative", () => {
  assert.equal(parseWebVital(JSON.stringify({ name: "CLS", value: 0.1, rating: "good" })), null);
  assert.equal(
    parseWebVital(JSON.stringify({ name: "CLS", value: 0.1, rating: "good", path: "https://evil.example/" })),
    null,
  );
});

test("strips query/fragment content from the path — no query content can reach a log", () => {
  const v = parseWebVital(
    JSON.stringify({ name: "INP", value: 180, rating: "good", path: "/answer?q=my name is PIISENTINEL#frag" }),
  );
  assert.ok(v);
  assert.equal(v.path, "/answer");
  assert.ok(!JSON.stringify(v).includes("PIISENTINEL"));
});

// ── safeLog allowlist for the sample fields ────────────────────────────────

test("the web-vital sample fields are loggable; identity fields stay banned", () => {
  for (const f of ["metric", "value", "rating", "path"]) assert.equal(isLoggableField(f), true);
  assert.equal(isLoggableField("ssn"), false);
  assert.equal(isLoggableField("new_legal_name"), false);
});

test("a web_vital log line carries only the non-PII sample envelope", () => {
  const lines: string[] = [];
  const orig = console.log;
  console.log = (s?: unknown) => {
    lines.push(String(s));
  };
  try {
    safeLog("web_vital", { metric: "LCP", value: 1234.567, rating: "good", path: "/checklist", status: 204 });
  } finally {
    console.log = orig;
  }
  const line = JSON.parse(lines.join("\n"));
  assert.equal(line.event, "web_vital");
  assert.equal(line.metric, "LCP");
  assert.equal(line.rating, "good");
  assert.equal(line.path, "/checklist");
});

// ── client beacon script (public/assets/vitals.js) ─────────────────────────

const vitalsJs = readFileSync(join(import.meta.dirname, "..", "public", "assets", "vitals.js"), "utf8");

test("vitals.js beacons same-origin only and never touches cookies or storage", () => {
  assert.match(vitalsJs, /\/api\/metrics\/web-vitals/);
  // Same-origin only: no absolute URL anywhere in the script.
  assert.doesNotMatch(vitalsJs, /https?:\/\//);
  // Cookieless and identifier-free: no cookie, storage or fingerprint surface.
  assert.doesNotMatch(vitalsJs, /document\.cookie|localStorage|sessionStorage|indexedDB|userAgent/);
  // Path only — the query string never leaves the page.
  assert.match(vitalsJs, /location\.pathname/);
  assert.doesNotMatch(vitalsJs, /location\.(search|href)/);
});

test("vitals.js observes the three Core Web Vitals", () => {
  for (const type of ["largest-contentful-paint", "layout-shift", "event"]) {
    assert.ok(vitalsJs.includes(type), `missing observer for ${type}`);
  }
});

// ── page shell wiring ──────────────────────────────────────────────────────

test("the base layout loads /assets/vitals.js with defer", () => {
  const html = page({ lang: "en", title: "T", heading: "H", body: "<p>b</p>" });
  assert.match(html, /<script defer src="\/assets\/vitals\.js"><\/script>/);
});

test("the offline shell precaches vitals.js", () => {
  assert.ok(SHELL_ASSETS.includes("/assets/vitals.js"));
});
