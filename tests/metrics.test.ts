import assert from "node:assert/strict";
import { test } from "node:test";

import {
  metricMethod,
  metricRoute,
  observeRequest,
  renderPrometheusMetrics,
  resetMetrics,
  startRequest,
} from "../api/metrics.ts";
import { handleRoute } from "../api/router.ts";

test("route labels are bounded and never retain user-controlled path segments", () => {
  assert.equal(metricRoute("/guide/california/name-change"), "/guide/:state/:topic");
  assert.equal(metricRoute("/forms/private-looking-id"), "/forms/:form");
  assert.equal(metricRoute("/SENTINEL-user-value"), "_unmatched");
  assert.equal(metricMethod("SENTINEL-METHOD"), "OTHER");
});

test("RED metrics use status, templated route, and seconds without leaking paths", () => {
  resetMetrics();
  observeRequest({ method: "get", path: "/guide/california/name", status: 200, durationSeconds: 0.25 });
  observeRequest({ method: "GET", path: "/SENTINEL-private", status: 503, durationSeconds: 2 });

  const text = renderPrometheusMetrics();
  assert.match(text, /tdn_http_server_requests_total\{[^}]*http_route="\/guide\/:state\/:topic"[^}]*\} 1/);
  assert.match(text, /tdn_http_server_errors_total\{[^}]*http_response_status_code="503"[^}]*\} 1/);
  assert.match(text, /tdn_http_server_slow_requests_total\{[^}]*http_response_status_code="503"[^}]*\} 1/);
  assert.match(text, /tdn_http_server_request_duration_seconds_sum\{[^}]*\} 0\.25/);
  assert.doesNotMatch(text, /SENTINEL/);
});

test("active request completion is idempotent", () => {
  resetMetrics();
  const finish = startRequest();
  assert.match(renderPrometheusMetrics(), /tdn_http_server_active_requests 1/);
  const observation = { method: "GET", path: "/", status: 200, durationSeconds: 0.1 };
  finish(observation);
  finish(observation);
  const text = renderPrometheusMetrics();
  assert.match(text, /tdn_http_server_active_requests 0/);
  assert.match(text, /tdn_http_server_requests_total\{[^}]*\} 1/);
});

test("/metrics exposes valid Prometheus text", () => {
  resetMetrics();
  const response = handleRoute("GET", new URL("http://localhost/metrics"));
  assert.equal(response.status, 200);
  assert.equal(response.contentType, "text/plain; version=0.0.4; charset=utf-8");
  assert.match(response.body, /^# HELP/m);
});
