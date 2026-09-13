// Guards the one thing this repo's permanently-red Dependabot job could hide.
//
// GitHub runs a workflow this repository does not own — `dynamic/dependabot/update-graph`,
// job title "Graph Update: pip in /corpus/snapshots". It has run 7 times (2026-07-14 →
// 2026-09-06) and failed all 7; it has never once passed. It fails with
// `dependency_file_not_evaluatable` / `RequirementsFileParseError` because it is parsing
// three committed corpus snapshots as pip requirements files. Their names come from the
// source URLs they snapshot, and all three happen to contain the word "requirements":
//
//   corpus/snapshots/dor-mo-gov-driver-license-issuance-id-requirements-html-3146ecde.txt
//   corpus/snapshots/dshs-texas-gov-vital-statistics-requirements-requesting-changing-vital-00409814.txt
//   corpus/snapshots/mass-gov-info-details-eligibility-requirements-for-indigency-waiver-of-bc737a19.txt
//
// The job is created by GitHub's own manifest detection, not by `.github/dependabot.yml`
// (which declares npm, github-actions and docker, and no `pip` at all), and as of
// 2026-09-13 it cannot be turned off for one directory: `exclude-paths` is documented as
// "Version updates only", and the upstream change that would make graph jobs honor it
// (dependabot-core PR #15148, "Honor exclude_paths in graph jobs") is open and conflicted.
// See README.md's Standards-conformance CI/CD row for the full, dated finding, and
// issue #265.
//
// So the red run stays. The danger that creates is the reason this file exists: a reader
// who has learned to skip "Graph Update: pip" would also skip it on the day it starts
// failing for a REAL reason. Two things would make that happen, and both are checked here:
//
//   1. A real Python manifest lands somewhere in this repo. Then the pip graph job has
//      actual dependencies to resolve, its failure means something, and the README note
//      is no longer the explanation.
//   2. Someone "fixes" the noise by declaring `pip` (or `uv`) in `.github/dependabot.yml`.
//      That does not silence the graph job — it only adds a second job, a weekly version
//      update with no manifests to update, which fails in its own way. The decision not
//      to do that is recorded here so it is not quietly reversed.
//
// New corpus snapshots are deliberately NOT counted or pinned. The corpus grows, more
// URL-derived names will contain "requirements", and a gate that failed on that would
// block corpus work to restate a fact the README already states.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, basename } from "node:path";
import { load } from "js-yaml";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEPENDABOT_PATH = join(REPO_ROOT, ".github", "dependabot.yml");
const README_PATH = join(REPO_ROOT, "README.md");

/** The Actions job title GitHub gives the failing run. The README must keep naming it. */
const JOB_TITLE = "Graph Update: pip in /corpus/snapshots";

/**
 * Copied verbatim from dependabot-core
 * (`python/lib/dependabot/python/dependency_grapher/requirements_layers.rb`, merged in
 * PR #14786) — the patterns that decide whether a `.txt` file is treated as a pip
 * manifest. Reproduced rather than paraphrased so that "would Dependabot pick this up?"
 * is answered by Dependabot's own rule and not by a guess about it.
 */
const TXT_MANIFEST_PATTERNS = [
  /(?:[-._]|^|\/)requirements[^\s]*\.txt$/i,
  /(?:[-._]|^|\/)require(?:[-_/][^\s.]*)?\.txt$/i,
  /(?:[-._]|^|\/)dependenc(?:y|ies)[^\s]*\.txt$/i,
  /(?:[-._]|^|\/)depend(?:s)?(?:[-_/][^\s.]*)?\.txt$/i,
];

/** Filenames that are unambiguously a Python dependency manifest or lockfile. */
const MANIFEST_BASENAMES = new Set([
  "pyproject.toml",
  "setup.py",
  "setup.cfg",
  "Pipfile",
  "Pipfile.lock",
  "poetry.lock",
  "uv.lock",
]);

/** `pip-compile` inputs, which Dependabot's Python file fetcher also collects. */
const REQUIREMENTS_IN_PATTERN = /(?:[-._]|^|\/)requirements[^\s]*\.in$/i;

/**
 * The corpus is the one place a `*requirements*.txt` is expected and meaningless: it holds
 * verbatim snapshots of government web pages, named after the URLs they came from.
 */
const CORPUS_PREFIX = "corpus/";

/**
 * Files tracked on this branch — the same set GitHub's dependency graph sees. Reading the
 * index rather than walking the working tree keeps a local virtualenv or a stray download
 * from failing a check about what is committed.
 */
function trackedFiles(): string[] {
  const out = execFileSync("git", ["ls-files", "-z"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return out.split("\0").filter((name) => name.length > 0);
}

function looksLikePythonManifest(path: string): boolean {
  if (MANIFEST_BASENAMES.has(basename(path))) return true;
  if (REQUIREMENTS_IN_PATTERN.test(path)) return true;
  return TXT_MANIFEST_PATTERNS.some((pattern) => pattern.test(path));
}

test("no Python manifest exists outside the corpus, so a red pip graph job is still explained by README", () => {
  const offenders = trackedFiles()
    .filter((path) => !path.startsWith(CORPUS_PREFIX))
    .filter(looksLikePythonManifest);

  assert.deepEqual(
    offenders,
    [],
    "A file Dependabot will read as a pip manifest now exists outside corpus/:\n" +
      offenders.map((path) => `  ${path}`).join("\n") +
      `\n\nThe repository's "${JOB_TITLE}" job has failed every run since 2026-07-14 for an ` +
      "unrelated reason (corpus snapshots with `requirements` in their URL-derived names), and " +
      "README.md records that as known noise. Adding a real Python manifest makes that note " +
      "wrong: from now on a failure there could be a genuine unresolvable dependency. Update " +
      "the README's CI/CD row and this test together, and give the new manifest a `pip` (or " +
      "`uv`) entry in .github/dependabot.yml so it is actually watched. See issue #265.",
  );
});

test(".github/dependabot.yml declares no pip or uv ecosystem", () => {
  const config = load(readFileSync(DEPENDABOT_PATH, "utf8")) as {
    updates?: { "package-ecosystem"?: string }[];
  };
  const ecosystems = (config.updates ?? []).map((update) => update["package-ecosystem"]);

  for (const python of ["pip", "uv"]) {
    assert.ok(
      !ecosystems.includes(python),
      `.github/dependabot.yml declares \`package-ecosystem: ${python}\`, but this repo has no ` +
        "Python dependencies. Declaring one does not stop GitHub's pip graph job — that job is " +
        "created by GitHub's manifest detection and ignores this file, which is why it already " +
        "runs without any pip entry here. It only adds a weekly version-update job with nothing " +
        "to update, i.e. a second red run beside the first. If real Python dependencies have " +
        "arrived, that changes — delete this assertion along with the README note. See issue #265.",
    );
  }
});

test("README records the permanently-red pip graph job by its Actions job title", () => {
  const readme = readFileSync(README_PATH, "utf8");

  assert.ok(
    readme.includes(JOB_TITLE),
    `README.md must name "${JOB_TITLE}" verbatim. That string is what a reader sees in the ` +
      "Actions tab, so it is the string they will search for when they find a run that has " +
      "never once passed. Without it the red run reads as an unexplained broken check. " +
      "See issue #265.",
  );
});
