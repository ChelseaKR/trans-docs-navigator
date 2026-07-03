// Privacy-safe structured logger (guardrail #3). Only an explicit allowlist of
// non-PII fields may be logged; anything else is dropped. This is the single
// logging mechanism in server code — the lint gate forbids raw console.* there.
//
// Output shape: one JSON object per line (JSON-lines) carrying the observability
// envelope required by OBSERVABILITY-STANDARD §3 — `ts` (ISO 8601 UTC), `level`,
// `msg` — plus only the non-PII operational fields below. Query content and any
// identity/PII field can never appear: the allowlist is a fail-closed filter, so a
// field is logged only if it is named here. Path/method/server-span values are also
// normalized to bounded templates before serialization, so attacker-controlled URL
// segments cannot turn an allowed field into a content side channel.

import { metricMethod, metricRoute } from "./metrics.ts";

/** Severity levels (maps to SeverityText / syslog-style levels). */
export type LogLevel = "debug" | "info" | "warn" | "error";

/** The only fields permitted in a log line. None of these can identify a person. */
const ALLOWED_FIELDS = new Set([
  // Observability envelope (per OBSERVABILITY-STANDARD §3).
  "ts",
  "level",
  "msg",
  "request_id",
  "path",
  "latency_ms",
  // Existing non-PII operational fields.
  "event",
  "route",
  "method",
  "status",
  "jurisdiction",
  "change_types",
  "documents",
  "language",
  "duration_ms",
  "refused",
  "claims",
  "coverage",
  "degraded",
  "quarantined",
  "error",
  // Privacy-safe GenAI lifecycle telemetry (api/genai-telemetry.ts).
  "semconv_version",
  "provider",
  "model",
  "response_model",
  "operation",
  "input_tokens",
  "output_tokens",
  "cache_creation_input_tokens",
  "cache_read_input_tokens",
  "finish_reason",
  "error_type",
  "estimated_cost_usd",
  "unpriced",
  "content_captured",
  // W3C trace context and exporter-neutral span identity (api/trace.ts).
  "trace_id",
  "span_id",
  "parent_span_id",
  "trace_flags",
  "span_kind",
  "span_name",
  // Corpus integrity attestation (FIX-09 §A): hex digests only, never file content.
  "expected",
  "actual",
]);

export type LogFields = Record<string, unknown>;

function sanitizeAllowedValue(key: string, value: unknown): unknown {
  if ((key === "path" || key === "route") && typeof value === "string") {
    return metricRoute(value);
  }
  if (key === "method" && typeof value === "string") return metricMethod(value);
  if (key === "span_name" && typeof value === "string" && value.startsWith("HTTP ")) {
    const [, rawMethod = "OTHER", ...rawRoute] = value.split(" ");
    return `HTTP ${metricMethod(rawMethod)} ${metricRoute(rawRoute.join(" "))}`;
  }
  return value;
}

/**
 * Emit one structured JSON log line. `event` is the machine-stable message code
 * (also surfaced as `msg`); `level` defaults to "info". Every line carries the
 * `ts`/`level`/`msg` envelope; any field not on the non-PII allowlist is dropped
 * before it is ever serialized — the request path never logs query content or PII.
 */
export function safeLog(event: string, fields: LogFields = {}, level: LogLevel = "info"): void {
  const safe: LogFields = {
    ts: new Date().toISOString(),
    level,
    msg: event,
    event,
  };
  for (const [k, v] of Object.entries(fields)) {
    if (ALLOWED_FIELDS.has(k)) safe[k] = sanitizeAllowedValue(k, v);
    // Unknown keys are intentionally dropped — never logged, never inspected.
  }
  // eslint-disable-next-line no-console -- the one sanctioned logging sink
  console.log(JSON.stringify(safe));
}

/** Exposed for tests: is this field allowed to be logged? */
export function isLoggableField(name: string): boolean {
  return ALLOWED_FIELDS.has(name);
}
