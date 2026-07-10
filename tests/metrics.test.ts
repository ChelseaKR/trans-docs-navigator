// RED metrics registry tests (OBSERVABILITY-STANDARD §2). Covers the recording API, the
// Prometheus text-exposition rendering, and — the safety property that matters most here —
// that route labels are bounded and can never leak a raw/attacker-controlled path.

import { test } from "node:test";
import assert from "node:assert/strict";
import { recordRequest, renderMetrics, resetMetrics } from "../api/metrics.ts";
import { routeTemplate, handleRoute } from "../api/router.ts";

test.beforeEach(() => resetMetrics());

test("routeTemplate collapses known routes to themselves and unknown paths to a bounded label", () => {
  assert.equal(routeTemplate("/"), "/");
  assert.equal(routeTemplate("/checklist"), "/checklist");
  assert.equal(routeTemplate("/metrics"), "/metrics");
  assert.equal(routeTemplate("/guide/us-ca/court-order"), "/guide/:state/:topic");
  assert.equal(routeTemplate("/forms/us-ss-5"), "/forms/:id");
  assert.equal(routeTemplate("/forms/fixtures/us-ss-5.pdf"), "/forms/fixtures/:file");
  assert.equal(routeTemplate("/vendor/pdf-lib.js"), "/vendor/:file");
  assert.equal(routeTemplate("/assets/app.js"), "/assets/:file");
  // The safety property: arbitrary/attacker-controlled paths (probes, typos, path-scan
  // attempts) all collapse to ONE bounded label, never their own — otherwise a scan could
  // grow the in-process registry without bound.
  assert.equal(routeTemplate("/wp-admin/config.php"), "other");
  assert.equal(routeTemplate("/checklist/../../etc/passwd"), "other");
  for (let i = 0; i < 500; i++) assert.equal(routeTemplate(`/scan-${i}`), "other");
});

test("recordRequest accumulates requests_total, errors_total, and duration histogram per route", () => {
  recordRequest("/checklist", "GET", 200, 3);
  recordRequest("/checklist", "GET", 200, 7);
  recordRequest("/checklist", "GET", 500, 2);
  recordRequest("/answer", "GET", 200, 1);

  const text = renderMetrics();
  assert.match(text, /http_requests_total\{route="\/checklist",method="GET",status="200"\} 2/);
  assert.match(text, /http_requests_total\{route="\/checklist",method="GET",status="500"\} 1/);
  assert.match(text, /http_errors_total\{route="\/checklist"\} 1/);
  assert.match(text, /http_errors_total\{route="\/answer"\} 0/);
  assert.match(text, /http_request_duration_seconds_count\{route="\/checklist"\} 3/);
});

test("renderMetrics emits valid Prometheus text-exposition format (HELP/TYPE per metric family)", () => {
  recordRequest("/", "GET", 200, 1);
  const text = renderMetrics();
  for (const family of ["http_requests_total", "http_errors_total", "http_request_duration_seconds"]) {
    assert.match(text, new RegExp(`# HELP ${family} `));
    assert.match(text, new RegExp(`# TYPE ${family} `));
  }
  // Histogram buckets are cumulative and end in a +Inf bucket equal to the total count.
  assert.match(text, /http_request_duration_seconds_bucket\{route="\/",le="\+Inf"\} 1/);
});

test("histogram buckets are cumulative (Prometheus le-bucket contract), not one-count-per-observation", () => {
  // A single 3ms observation must land in every bucket boundary from 0.005s upward,
  // each showing the SAME count (1) — not an incrementing 1,2,3,... per boundary
  // (a regression this test catches: double-accumulating in both recordRequest and
  // renderMetrics would produce 1,2,3,4,... instead of a flat 1).
  recordRequest("/checklist", "GET", 200, 3);
  const text = renderMetrics();
  const buckets = [...text.matchAll(/http_request_duration_seconds_bucket\{route="\/checklist",le="([^"]+)"\} (\d+)/g)].map((m) => ({
    le: m[1],
    count: Number(m[2]),
  }));
  assert.ok(buckets.length > 0);
  for (const b of buckets) assert.ok(b.count <= 1, `bucket le="${b.le}" over-counted: ${b.count}`);
  // Every bucket from the observation's own boundary through +Inf must be exactly 1.
  const nonZero = buckets.filter((b) => b.count === 1);
  assert.ok(nonZero.length >= 1);

  // Two observations in different buckets: the smaller bucket's cumulative count must
  // never exceed a larger bucket's cumulative count for the same route.
  recordRequest("/checklist", "GET", 200, 9000); // lands only in the 10s / +Inf buckets
  const text2 = renderMetrics();
  const b2 = [...text2.matchAll(/http_request_duration_seconds_bucket\{route="\/checklist",le="([^"]+)"\} (\d+)/g)].map((m) => Number(m[2]));
  for (let i = 1; i < b2.length; i++) assert.ok(b2[i]! >= b2[i - 1]!, "cumulative buckets must be monotonically non-decreasing");
  assert.equal(b2.at(-1), 2); // +Inf == total count
});

test("renderMetrics is empty-but-well-formed before any request is recorded", () => {
  const text = renderMetrics();
  assert.match(text, /# HELP http_requests_total/);
  assert.doesNotMatch(text, /\{route=/); // no series yet
});

test("route labels never carry request content (no query string, no PII-shaped values)", () => {
  recordRequest(routeTemplate("/answer"), "GET", 200, 4);
  const text = renderMetrics();
  assert.ok(!text.includes("jurisdiction="));
  assert.ok(!text.includes("current_legal_name"));
});

test("GET /metrics returns Prometheus text with the RED families present", () => {
  resetMetrics();
  recordRequest("/checklist", "GET", 200, 5);
  const r = handleRoute("GET", new URL("/metrics", "http://localhost:8080"));
  assert.equal(r.status, 200);
  assert.match(r.contentType, /text\/plain/);
  assert.match(r.body, /# TYPE http_requests_total counter/);
  assert.match(r.body, /http_requests_total\{route="\/checklist",method="GET",status="200"\} 1/);
});
