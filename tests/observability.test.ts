// Observability instrumentation tests (OBSERVABILITY-STANDARD §3 logs, §6 health probes).
// Covers: /livez liveness, /readyz readiness (ready-200 + fail-closed-503), the readiness
// dependency logic, and the structured JSON access-log line — including the hard invariant
// that a log line NEVER carries query content or identity/PII.

import { test } from "node:test";
import assert from "node:assert/strict";
import { handleRoute, readiness } from "../api/router.ts";
import { safeLog } from "../api/log.ts";
import { metricMethod, metricRoute } from "../api/metrics.ts";

const u = (path: string) => new URL(path, "http://localhost:8080");

// A far-future "as of" date puts every real record past its recheck SLA, so nothing is
// serveable-as-current — the deterministic way to exercise the fail-closed readiness path.
const FUTURE = "2099-01-01";

// ── /livez (liveness) ──────────────────────────────────────────────────────

test("/livez returns 200 {status:ok} with no dependency detail", () => {
  const r = handleRoute("GET", u("/livez"));
  assert.equal(r.status, 200);
  assert.equal(r.contentType, "application/json");
  const body = JSON.parse(r.body);
  assert.equal(body.status, "ok");
  assert.equal(body.checks, undefined); // liveness makes no dependency calls
});

// ── /readyz (readiness) ────────────────────────────────────────────────────

test("/readyz returns 200 with per-dependency checks when the corpus is fresh", () => {
  const r = handleRoute("GET", u("/readyz"));
  assert.equal(r.status, 200);
  assert.equal(r.contentType, "application/json");
  const body = JSON.parse(r.body);
  assert.equal(body.status, "ok");
  assert.equal(body.checks.corpus, "ok");
  assert.equal(body.checks.freshness, "ok");
});

test("/readyz fails closed with 503 when no record is serveable-as-current", () => {
  const r = handleRoute("GET", u("/readyz"), FUTURE);
  assert.equal(r.status, 503);
  const body = JSON.parse(r.body);
  assert.equal(body.status, "unavailable");
  assert.equal(body.checks.freshness, "unavailable");
});

test("/healthz is preserved and still reports corpus size", () => {
  const r = handleRoute("GET", u("/healthz"));
  assert.equal(r.status, 200);
  const body = JSON.parse(r.body);
  assert.equal(body.status, "ok");
  assert.ok(body.corpus_records > 5);
});

// ── readiness() fail-closed dependency logic ───────────────────────────────

test("readiness is ready when the corpus loads with current records", () => {
  const report = readiness();
  assert.equal(report.ready, true);
  assert.equal(report.checks.corpus, "ok");
  assert.equal(report.checks.freshness, "ok");
});

test("readiness fails closed when the corpus is empty (dependency unavailable)", () => {
  const report = readiness({ load: () => [] });
  assert.equal(report.ready, false);
  assert.equal(report.checks.corpus, "unavailable");
  assert.equal(report.checks.freshness, "unavailable");
});

test("readiness fails closed when the corpus loader throws (never a 500 on a probe)", () => {
  const report = readiness({
    load: () => {
      throw new Error("corpus down");
    },
  });
  assert.equal(report.ready, false);
  assert.equal(report.checks.corpus, "unavailable");
  assert.equal(report.checks.freshness, "unavailable");
});

test("readiness fails closed when all records are past SLA (stale-law guard)", () => {
  const report = readiness({ today: FUTURE });
  assert.equal(report.ready, false);
  assert.equal(report.checks.corpus, "ok"); // corpus present…
  assert.equal(report.checks.freshness, "unavailable"); // …but nothing current
});

// ── Structured JSON access-log line ────────────────────────────────────────

/** Capture the single stdout line produced by a call that logs through safeLog. */
function captureLine(fn: () => void): string {
  const lines: string[] = [];
  const orig = console.log;
  console.log = (s: string) => lines.push(s);
  try {
    fn();
  } finally {
    console.log = orig;
  }
  assert.equal(lines.length, 1, "expected exactly one log line");
  return lines[0]!;
}

test("the request access-log line is valid JSON with the required observability fields", () => {
  // Mirror exactly the fields the server's request-logging middleware emits.
  const line = captureLine(() =>
    safeLog("request", { request_id: "11111111-1111-1111-1111-111111111111", method: "GET", path: "/checklist", status: 200, latency_ms: 4 }),
  );
  const rec = JSON.parse(line); // throws if not valid JSON — the AUTO-GATE

  for (const field of ["ts", "level", "msg", "request_id", "method", "path", "status", "latency_ms"]) {
    assert.ok(field in rec, `log line missing required field: ${field}`);
  }
  assert.equal(rec.msg, "request");
  assert.equal(rec.level, "info");
  assert.equal(rec.method, "GET");
  assert.equal(rec.path, "/checklist");
  assert.equal(rec.status, 200);
  assert.match(rec.ts, /^\d{4}-\d{2}-\d{2}T.*Z$/); // ISO 8601 UTC
});

test("a log line never leaks query content or identity/PII, even if passed", () => {
  // Adversarial: the caller tries to log a free-text legal question and identity PII.
  // The allowlist must drop every one of these before serialization.
  const line = captureLine(() =>
    safeLog("request", {
      request_id: "22222222-2222-2222-2222-222222222222",
      method: "GET",
      path: "/answer",
      status: 200,
      latency_ms: 7,
      // none of the following are on the allowlist:
      q: "how do I change my gender marker after a divorce",
      question: "am I safe to transition in my state",
      current_legal_name: "Jordan Rivers",
      new_legal_name: "Alex Rivers",
      date_of_birth: "1990-01-01",
      ssn: "123-45-6789",
      email: "user@example.com",
    } as Record<string, unknown>),
  );
  JSON.parse(line); // still valid JSON
  for (const leak of ["how do I change", "am I safe", "Jordan Rivers", "Alex Rivers", "1990-01-01", "123-45-6789", "user@example.com"]) {
    assert.ok(!line.includes(leak), `log line leaked forbidden content: ${leak}`);
  }
});

test("bounded access-log identities exclude attacker-controlled path and method values", () => {
  assert.equal(metricMethod("SENTINEL-METHOD"), "OTHER");
  assert.equal(metricRoute("/SENTINEL-private-path"), "_unmatched");
  const line = captureLine(() =>
    safeLog("request", {
      request_id: "33333333-3333-3333-3333-333333333333",
      method: "SENTINEL-METHOD",
      path: "/SENTINEL-private-path",
      status: 404,
      latency_ms: 1,
      span_kind: "server",
      span_name: "HTTP SENTINEL-METHOD /SENTINEL-private-path",
    }),
  );
  assert.doesNotMatch(line, /SENTINEL/);
  const record = JSON.parse(line);
  assert.equal(record.method, "OTHER");
  assert.equal(record.path, "_unmatched");
  assert.equal(record.span_name, "HTTP OTHER _unmatched");
});

test("safeLog honors an explicit severity level", () => {
  const line = captureLine(() => safeLog("error", { status: 500, error: "TypeError" }, "error"));
  const rec = JSON.parse(line);
  assert.equal(rec.level, "error");
  assert.equal(rec.msg, "error");
  assert.equal(rec.status, 500);
});
