// Request-content non-reflection proof (RESPONSIBLE-TECH §C, guardrail #3). The
// static privacy gate rejects direct identity-field handling in runtime API/log code;
// this runtime test injects a unique sentinel into every request field and the log
// sink, then proves it is not copied into a response body or application log descriptor.
// The request itself still reaches the server, as the Privacy Notice discloses.

import { test } from "node:test";
import assert from "node:assert/strict";
import { handleRoute } from "../api/router.ts";
import { safeLog } from "../api/log.ts";

const SENTINEL = "PIISENTINEL_DO_NOT_LEAK_42";

/** A URL whose every parameter (including PII-shaped ones) carries the sentinel. */
function poisoned(path: string, jurisdiction = "US-CA"): URL {
  const url = new URL(path, "http://localhost:8080");
  url.searchParams.set("jurisdiction", jurisdiction);
  url.searchParams.set("q", `my name is ${SENTINEL}`);
  // /changes takes one extra bounded field (the date a packet printed). Set to a real
  // date so the route reaches its 200 path and is actually exercised here rather than
  // short-circuiting on a 400, which would prove nothing about reflection.
  url.searchParams.set("since", "2026-05-01");
  // Identity fields the UI never sends, but an attacker/proxy might append:
  for (const k of ["current_legal_name", "new_legal_name", "ssn", "date_of_birth", "email"]) {
    url.searchParams.set(k, SENTINEL);
  }
  return url;
}

test("request-borne content is not reflected into a response body or log descriptor", () => {
  const routes = ["/", "/checklist", "/packet", "/changes", "/answer", "/forms/us-ss-5", "/healthz"];
  for (const path of routes) {
    const r = handleRoute("GET", poisoned(path), "2026-05-31");
    assert.ok(!r.body.includes(SENTINEL), `${path}: sentinel leaked into response body`);
    const logStr = r.log ? JSON.stringify(r.log) : "";
    assert.ok(!logStr.includes(SENTINEL), `${path}: sentinel leaked into log fields`);
  }
});

test("the question param influences retrieval but is never echoed into the answer", () => {
  const r = handleRoute("GET", poisoned("/answer"), "2026-05-31");
  // Answer text is composed only from cited corpus records, never from user input.
  assert.ok(!r.body.includes(SENTINEL));
});

test("safeLog drops PII-shaped fields even if a caller passes them", () => {
  const original = console.log;
  const lines: string[] = [];
  console.log = (s?: unknown) => { lines.push(String(s)); };
  try {
    safeLog("checklist", {
      jurisdiction: "US-CA",
      current_legal_name: SENTINEL,
      new_legal_name: SENTINEL,
      ssn: SENTINEL,
    });
  } finally {
    console.log = original;
  }
  const out = lines.join("\n");
  assert.ok(out.includes("US-CA"), "allowlisted field should be logged");
  assert.ok(!out.includes(SENTINEL), "PII field must be dropped from the log line");
});
