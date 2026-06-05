// PII-egress data-flow proof (RESPONSIBLE-TECH §C, guardrail #3). The regex privacy
// lint proves no PII is *referenced* in server/log code; this proves no PII *escapes*
// at runtime: we inject a unique sentinel into every conceivable request field and the
// log sink, then assert it never appears in any response body or emitted log line.

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
  // Identity fields the UI never sends, but an attacker/proxy might append:
  for (const k of ["current_legal_name", "new_legal_name", "ssn", "date_of_birth", "email"]) {
    url.searchParams.set(k, SENTINEL);
  }
  return url;
}

test("no request-borne PII reaches any response body or log descriptor", () => {
  const routes = ["/", "/checklist", "/packet", "/answer", "/forms/us-ss-5", "/healthz"];
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
