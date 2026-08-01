// Tests for scripts/codeql-gate.mjs — especially that it does NOT fail open.
//
// The "no SARIF" cases are the point of this file. A gate that returns success when it finds no
// SARIF reports a clean scan for an analysis that never ran, and with no code-scanning dashboard
// on this private repo nothing else would notice. That is exactly the failure mode the codeql
// workflow was in before 2026-08-01, when the whole job skipped and the skip read as green.

import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// @ts-ignore -- plain .mjs helper, deliberately dependency-free and outside the typed sources
import { gate } from "../scripts/codeql-gate.mjs";

const runGate = gate as (paths: string[]) => Promise<number>;

interface SarifResult {
  ruleId: string;
  level?: string;
  message: { text: string };
}

interface SarifRule {
  id: string;
  properties: Record<string, string>;
}

const sarif = (results: SarifResult[], rules: SarifRule[] = []): unknown => ({
  runs: [{ tool: { driver: { rules } }, results }],
});

const writeSarif = (dir: string, name: string, doc: unknown): Promise<void> =>
  writeFile(join(dir, name), JSON.stringify(doc), "utf8");

let dir: string;
// The gate prints its report to stdout/stderr; silence it so the test output stays readable.
const noop = (): boolean => true;
let log: typeof console.log;
let err: typeof console.error;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "codeql-gate-"));
  log = console.log;
  err = console.error;
  console.log = noop;
  console.error = noop;
});

afterEach(async () => {
  console.log = log;
  console.error = err;
  await rm(dir, { recursive: true, force: true });
});

describe("no SARIF fails closed", () => {
  test("fails on an empty directory", async () => {
    assert.equal(await runGate([dir]), 1);
  });

  test("fails on a path that does not exist", async () => {
    assert.equal(await runGate([join(dir, "sarif-results")]), 1);
  });

  test("fails on the default path when it is absent", async () => {
    assert.equal(await runGate(["sarif-results"]), 1);
  });

  test("fails on a directory holding only non-SARIF files", async () => {
    await writeFile(join(dir, "results.json"), "{}", "utf8");
    assert.equal(await runGate([dir]), 1);
  });
});

describe("gate verdicts", () => {
  test("passes when the SARIF holds no findings", async () => {
    await writeSarif(dir, "results.sarif", sarif([]));
    assert.equal(await runGate([dir]), 0);
  });

  test("fails on an error-level result", async () => {
    await writeSarif(dir, "results.sarif", sarif([{ ruleId: "x/y", level: "error", message: { text: "boom" } }]));
    assert.equal(await runGate([dir]), 1);
  });

  test("fails on a result whose rule is error severity even though its own level is note", async () => {
    await writeSarif(
      dir,
      "results.sarif",
      sarif(
        [{ ruleId: "x/y", level: "note", message: { text: "boom" } }],
        [{ id: "x/y", properties: { "problem.severity": "error" } }],
      ),
    );
    assert.equal(await runGate([dir]), 1);
  });

  test("passes on warning-only findings — they are reported, not gated", async () => {
    await writeSarif(
      dir,
      "results.sarif",
      sarif(
        [{ ruleId: "x/y", level: "warning", message: { text: "meh" } }],
        [{ id: "x/y", properties: { "problem.severity": "warning" } }],
      ),
    );
    assert.equal(await runGate([dir]), 0);
  });

  test("passes on note-only findings — they are reported, not gated", async () => {
    await writeSarif(
      dir,
      "results.sarif",
      sarif(
        [{ ruleId: "x/y", level: "note", message: { text: "fyi" } }],
        [{ id: "x/y", properties: { "problem.severity": "recommendation" } }],
      ),
    );
    assert.equal(await runGate([dir]), 0);
  });

  test("discovers SARIF nested below the given directory", async () => {
    const nested = join(dir, "runs", "lang");
    await mkdir(nested, { recursive: true });
    await writeSarif(nested, "results.sarif", sarif([{ ruleId: "x/y", level: "error", message: { text: "boom" } }]));
    assert.equal(await runGate([dir]), 1);
  });
});
