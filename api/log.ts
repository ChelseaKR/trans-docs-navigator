// Privacy-safe structured logger (guardrail #3). Only an explicit allowlist of
// non-PII fields may be logged; anything else is dropped. This is the single
// logging mechanism in server code — the lint gate forbids raw console.* there.

/** The only fields permitted in a log line. None of these can identify a person. */
const ALLOWED_FIELDS = new Set([
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
]);

export type LogFields = Record<string, unknown>;

export function safeLog(event: string, fields: LogFields = {}): void {
  const safe: LogFields = { event };
  for (const [k, v] of Object.entries(fields)) {
    if (ALLOWED_FIELDS.has(k)) safe[k] = v;
    // Unknown keys are intentionally dropped — never logged, never inspected.
  }
  // eslint-disable-next-line no-console -- the one sanctioned logging sink
  console.log(JSON.stringify(safe));
}

/** Exposed for tests: is this field allowed to be logged? */
export function isLoggableField(name: string): boolean {
  return ALLOWED_FIELDS.has(name);
}
