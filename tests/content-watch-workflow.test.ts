// Tests for .github/workflows/content-watch.yml — that the weekly content sweep stays
// CAPABLE of telling a human something.
//
// THE DEFECT THESE PIN. Every check in that workflow was written as
//
//     run: make link-check 2>&1 | tee link-check.out
//
// with no `shell:` key. GitHub Actions' default shell for a `run:` step on Linux is
// `bash -e {0}` — **without** `pipefail`. So the step's exit status is `tee`'s, which is
// always 0. Measured locally:
//
//     bash -e            -c 'false | tee /dev/null'   → exit 0
//     bash -eo pipefail  -c 'false | tee /dev/null'   → exit 1
//
// Every one of the four checks therefore reported `success` no matter what it found, and
// the "Open an issue when anything needs a human" step — whose `if:` reads those step
// outcomes — could never fire. Confirmed against the live run of 2026-09-07
// (`actions/runs/34092783935`): the log contains
//
//     ❌ link-check: 3/421 source URL(s) dead
//
// while the "Link-rot check" step's conclusion is `success` and the issue-opening step is
// `skipped`. Zero issues have ever carried the `content-watch` label. Three cited sources
// were dead, on a project whose first guardrail is that no claim ships without a working
// citation, and the machinery built to say so was structurally unable to.
//
// Specifying `shell: bash` selects `bash --noprofile --norc -eo pipefail {0}`, which is
// what every one of these steps assumed it already had.
//
// The second test is the one that matters for the future: a check added later, with an
// `id` nobody wires into the issue-opening `if:`, is the same defect wearing a new coat —
// it runs, it fails, and no human is told.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { load } from "js-yaml";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WORKFLOW_PATH = join(REPO_ROOT, ".github", "workflows", "content-watch.yml");

interface Step {
  name?: string;
  id?: string;
  run?: string;
  shell?: string;
  uses?: string;
  if?: string;
  "continue-on-error"?: boolean;
}

function steps(): Step[] {
  const doc = load(readFileSync(WORKFLOW_PATH, "utf8")) as {
    jobs: Record<string, { steps: Step[] }>;
  };
  const job = doc.jobs["content-watch"];
  assert.ok(job, "content-watch.yml must define a `content-watch` job");
  return job.steps;
}

/**
 * A shell that propagates a pipeline's real exit status. `shell: bash` is the one Actions
 * offers that sets `pipefail`; an explicit `set -o pipefail` inside the script counts too,
 * because that is how `deploy-aws-preview.yml` already does it.
 */
function propagatesPipeStatus(step: Step): boolean {
  if (step.shell === "bash") return true;
  return /^\s*set -[a-z]*o?\s*[a-z]*\s*pipefail|set -[a-z]*\s*-o pipefail|set -euo pipefail/m.test(
    step.run ?? "",
  );
}

test("every piping run step propagates the pipeline's exit status", () => {
  const offenders = steps()
    .filter((s) => typeof s.run === "string" && s.run.includes("|"))
    .filter((s) => !propagatesPipeStatus(s))
    .map((s) => s.name ?? s.id ?? "(unnamed)");
  assert.deepEqual(
    offenders,
    [],
    `these steps pipe into tee under Actions' default \`bash -e\` (no pipefail), so their ` +
      `exit status is tee's and they can never report failure: ${offenders.join(", ")}`,
  );
});

test("the issue-opening step reads the outcome of every check that can fail", () => {
  const all = steps();
  const opener = all.find((s) => typeof s.if === "string" && /steps\.\w+\.outcome/.test(s.if));
  assert.ok(opener, "no step gates on any check's outcome — nothing can open the weekly issue");

  // Every check is exactly a step that is allowed to fail without failing the job.
  const checks = all.filter((s) => s["continue-on-error"] === true);
  assert.ok(checks.length >= 4, `expected at least the four weekly checks, found ${checks.length}`);

  const missing: string[] = [];
  for (const check of checks) {
    assert.ok(check.id, `check "${check.name}" has no \`id\`, so its outcome cannot be read`);
    if (!opener.if?.includes(`steps.${check.id}.outcome`)) missing.push(check.id);
  }
  assert.deepEqual(
    missing,
    [],
    `these checks run and are allowed to fail, but no human is ever told when they do: ${missing.join(", ")}`,
  );
});

test("every check is allowed to fail without failing the job", () => {
  // The complement of the test above: a check WITHOUT `continue-on-error` would abort the
  // sweep at the first drift, so the later checks would never run and the issue would
  // never be composed from a complete picture.
  const shellChecks = steps().filter((s) => typeof s.run === "string" && s.run.includes("| tee"));
  for (const check of shellChecks) {
    assert.equal(
      check["continue-on-error"],
      true,
      `"${check.name}" captures its output for the weekly issue but would abort the sweep on failure`,
    );
  }
});
