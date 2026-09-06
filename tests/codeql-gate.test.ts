// Tests for scripts/codeql-gate.mjs — especially that it does NOT fail open.
//
// The "no SARIF" cases are the point of this file. A gate that returns success when it finds no
// SARIF reports a clean scan for an analysis that never ran. That is exactly the failure mode the
// codeql workflow was in before 2026-08-01, when the whole job skipped and the skip read as green.
//
// Code scanning is enabled again as of 2026-09-06 (this repo is public; the "private repo, no
// dashboard" premise this comment used to carry was false). The dashboard does NOT make these
// cases redundant — it is the weaker detector of the two here. A run that produces no SARIF
// uploads nothing, so the Security tab simply keeps displaying the PREVIOUS analysis and stays
// green; that is how a June snapshot passed for current state for three months. Only a gate that
// fails closed on a missing SARIF turns that silence into a red check.

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
  defaultConfiguration?: { level: string };
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

  // Regression test for the shape CodeQL actually emits. Real CodeQL SARIF leaves
  // `tool.driver.rules` EMPTY, puts every query-pack rule under `tool.extensions[].rules`, and
  // puts no `level` on results at all — severity lives only on the rule. A gate that resolves
  // rules from the driver alone builds an empty table, classifies nothing, and reports
  // "0 error-severity finding(s)" no matter what CodeQL found.
  test("detects an error whose rule metadata lives in tool.extensions, not tool.driver", async () => {
    await writeSarif(dir, "results.sarif", {
      runs: [
        {
          tool: {
            driver: { name: "CodeQL", rules: [] },
            extensions: [
              {
                name: "codeql/javascript-queries",
                rules: [{ id: "js/sqli", defaultConfiguration: { level: "error" }, properties: { "problem.severity": "error" } }],
              },
            ],
          },
          results: [{ ruleId: "js/sqli", message: { text: "injection" } }],
        },
      ],
    });
    assert.equal(await runGate([dir]), 1);
  });

  test("discovers SARIF nested below the given directory", async () => {
    const nested = join(dir, "runs", "lang");
    await mkdir(nested, { recursive: true });
    await writeSarif(nested, "results.sarif", sarif([{ ruleId: "x/y", level: "error", message: { text: "boom" } }]));
    assert.equal(await runGate([dir]), 1);
  });
});

// ---------------------------------------------------------------------------------------------
// security-severity: CodeQL's SECOND severity axis, which this gate used to ignore entirely.
//
// `problem.severity` (error/warning/recommendation) and `security-severity` (a CVSS-style
// 0.0-10.0 score) are independent. Every security finding this repo has actually seen sits at
// `problem.severity: warning` AND high `security-severity` — so the log said "9 warning", which
// reads as nine style nits, for nine findings GitHub bands as HIGH (measured 2026-09-06 on the
// live codeql run). The exit code deliberately does NOT change here: raising the floor is the
// repo owner's policy call. What these tests lock in is that the log can no longer be misread.
// ---------------------------------------------------------------------------------------------

/** Run the gate while capturing the lines it prints to stdout. */
const runGateCapturing = async (paths: string[]): Promise<{ code: number; out: string }> => {
  const lines: string[] = [];
  const previous = console.log;
  console.log = ((...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
    return true;
  }) as typeof console.log;
  try {
    const code = await runGate(paths);
    return { code, out: lines.join("\n") };
  } finally {
    console.log = previous;
  }
};

/** A finding whose rule is a warning by problem.severity but scores `score` on security-severity. */
const securityFinding = (ruleId: string, score: string): unknown =>
  sarif(
    [{ ruleId, message: { text: "found" } }],
    [
      {
        id: ruleId,
        defaultConfiguration: { level: "warning" },
        properties: { "problem.severity": "warning", "security-severity": score },
      },
    ],
  );

describe("security-severity is read, banded, and reported", () => {
  test("a high-scoring warning is banded high and named as ungated — the live 2026-09-06 shape", async () => {
    await writeSarif(dir, "results.sarif", securityFinding("js/incomplete-multi-character-sanitization", "7.8"));
    const { code, out } = await runGateCapturing([dir]);

    // The floor is unchanged: this still passes. That is the point being documented, not hidden.
    assert.equal(code, 0);
    assert.match(out, /security-severity \(GitHub banding\): 1 high/);
    assert.match(out, /1 finding\(s\) at HIGH or CRITICAL security severity are NOT gated/);
    assert.match(out, /js\/incomplete-multi-character-sanitization/);
  });

  test("bands follow GitHub's own thresholds", async () => {
    const cases: Array<[string, string]> = [
      ["9.1", "critical"],
      ["9.0", "critical"],
      ["8.9", "high"],
      ["7.0", "high"],
      ["6.9", "medium"],
      ["4.0", "medium"],
      ["3.9", "low"],
      ["0.1", "low"],
    ];
    for (const [score, band] of cases) {
      await rm(join(dir, "results.sarif"), { force: true });
      await writeSarif(dir, "results.sarif", securityFinding("x/y", score));
      const { out } = await runGateCapturing([dir]);
      assert.match(out, new RegExp(`security-severity \\(GitHub banding\\): 1 ${band}`), `score ${score}`);
    }
  });

  test("only critical and high are called out as ungated; medium and low are not", async () => {
    await writeSarif(dir, "results.sarif", securityFinding("x/y", "5.0"));
    const { code, out } = await runGateCapturing([dir]);
    assert.equal(code, 0);
    assert.match(out, /security-severity \(GitHub banding\): 1 medium/);
    assert.doesNotMatch(out, /at HIGH or CRITICAL security severity are NOT gated/);
  });

  test("a rule with no security-severity is absent from the banding, not scored zero", async () => {
    await writeSarif(
      dir,
      "results.sarif",
      sarif(
        [{ ruleId: "js/unused-local-variable", level: "note", message: { text: "fyi" } }],
        [{ id: "js/unused-local-variable", properties: { "problem.severity": "recommendation" } }],
      ),
    );
    const { code, out } = await runGateCapturing([dir]);
    assert.equal(code, 0);
    // "no score" must not become "low" — absence is not a measurement of zero.
    assert.match(out, /no findings carried a security-severity score/);
    assert.doesNotMatch(out, /banding/);
  });

  test("an unparseable security-severity is treated as absent, never coerced to zero/low", async () => {
    await writeSarif(dir, "results.sarif", securityFinding("x/y", "not-a-number"));
    const { code, out } = await runGateCapturing([dir]);
    assert.equal(code, 0);
    assert.match(out, /no findings carried a security-severity score/);
    assert.doesNotMatch(out, /low/);
  });

  test("a high-scoring finding that IS gated is not also counted as slipping through", async () => {
    await writeSarif(
      dir,
      "results.sarif",
      sarif(
        [{ ruleId: "js/sqli", message: { text: "injection" } }],
        [
          {
            id: "js/sqli",
            defaultConfiguration: { level: "error" },
            properties: { "problem.severity": "error", "security-severity": "9.8" },
          },
        ],
      ),
    );
    const { code, out } = await runGateCapturing([dir]);
    assert.equal(code, 1); // error-severity still fails the build
    assert.match(out, /security-severity \(GitHub banding\): 1 critical/);
    assert.doesNotMatch(out, /at HIGH or CRITICAL security severity are NOT gated/);
  });
});
