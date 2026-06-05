import { test } from "node:test";
import assert from "node:assert/strict";
import { safeLog, isLoggableField } from "../api/log.ts";

test("safeLog drops fields outside the non-PII allowlist", () => {
  const lines: string[] = [];
  const orig = console.log;
  console.log = (s: string) => lines.push(s);
  try {
    safeLog("answer", {
      jurisdiction: "US-CA",
      status: 200,
      new_legal_name: "SHOULD NOT APPEAR",
      current_legal_name: "ALSO NOT",
    });
  } finally {
    console.log = orig;
  }
  const out = lines.join("\n");
  assert.ok(out.includes("US-CA"));
  assert.ok(out.includes('"event":"answer"'));
  assert.ok(!out.includes("SHOULD NOT APPEAR"));
  assert.ok(!out.includes("ALSO NOT"));
});

test("isLoggableField allows non-PII fields and rejects PII", () => {
  assert.equal(isLoggableField("jurisdiction"), true);
  assert.equal(isLoggableField("language"), true);
  assert.equal(isLoggableField("new_legal_name"), false);
  assert.equal(isLoggableField("ssn"), false);
});

test("safeLog works with no fields", () => {
  const orig = console.log;
  let line = "";
  console.log = (s: string) => (line = s);
  try {
    safeLog("listening");
  } finally {
    console.log = orig;
  }
  assert.ok(line.includes('"event":"listening"'));
});
