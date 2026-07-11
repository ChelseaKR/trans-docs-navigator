// Merge gate (FIX-12): the number of blocking stages in `make verify` is a fact
// derived from the Makefile, not a number that lives independently in prose. This
// gate parses the real prerequisite list off the `verify:` target, then fails the
// build if any self-describing doc states a different count. Bump the pipeline?
// This gate goes red until the docs are updated to match — that's the point.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { read, pass, fail } from "./util.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Pull the prerequisite list off the `verify:` target in the Makefile, handling
 * trailing-backslash line continuation (even though today it's a single line).
 */
function deriveGateCount(makefile: string): { count: number; stages: string[] } {
  const lines = makefile.split("\n");
  const startIdx = lines.findIndex((l) => /^verify:\s*/.test(l));
  if (startIdx === -1) {
    fail("gate-count", "no `verify:` target found in Makefile");
  }

  let rest = (lines[startIdx] ?? "").replace(/^verify:\s*/, "");
  let i = startIdx;
  while (rest.trimEnd().endsWith("\\")) {
    i += 1;
    if (i >= lines.length) fail("gate-count", "Makefile `verify:` target ends mid line-continuation");
    rest = `${rest.trimEnd().slice(0, -1)} ${lines[i] ?? ""}`;
  }

  // Strip a trailing make comment, if any.
  rest = (rest.split("#")[0] ?? "").toString();

  const stages = rest.split(/\s+/).map((s) => s.trim()).filter(Boolean);
  return { count: stages.length, stages };
}

const makefile = read(join(ROOT, "Makefile"));
const { count: derived, stages } = deriveGateCount(makefile);

if (!stages.includes("gate-count")) {
  fail(
    "gate-count",
    "the `verify:` target does not list `gate-count` as one of its own prerequisites",
    [`derived stages: ${stages.join(" ")}`],
  );
}

const mismatches: string[] = [];

// --- README.md: "All N automated merge gates pass" -------------------------------
const readmePath = "README.md";
const readme = read(join(ROOT, readmePath));
const readmeMatch = readme.match(/(\d+) automated merge gates/);
if (!readmeMatch) {
  mismatches.push(`${readmePath}: no "N automated merge gates" phrase found`);
} else if (Number(readmeMatch[1]) !== derived) {
  mismatches.push(`${readmePath}: states ${readmeMatch[1]} automated merge gates, derived ${derived}`);
}
// Same drift can hide anywhere a bare "N-gate" count is quoted (e.g. the quickstart
// comment) — catch any other hard-coded gate count in the same file too.
for (const m of readme.matchAll(/(\d+)[\s-](?:gates?)\b/gi)) {
  const n = Number(m[1]);
  if (n !== derived) {
    mismatches.push(`${readmePath}: "${m[0]}" states ${n}, derived ${derived}`);
  }
}

// --- docs/STATUS.md: "N/N gates" and "N-stage blocking pipeline" -----------------
const statusPath = "docs/STATUS.md";
const status = read(join(ROOT, statusPath));

const gateFractionMatch = status.match(/(\d+)\/(\d+) gates/);
if (!gateFractionMatch) {
  mismatches.push(`${statusPath}: no "N/N gates" phrase found`);
} else {
  const [, a, b] = gateFractionMatch;
  if (Number(a) !== derived || Number(b) !== derived) {
    mismatches.push(`${statusPath}: states ${a}/${b} gates, derived ${derived}/${derived}`);
  }
}

const stageMatches = [...status.matchAll(/(\d+)-stage blocking pipeline/g)];
if (stageMatches.length === 0) {
  mismatches.push(`${statusPath}: no "N-stage blocking pipeline" phrase found`);
} else {
  for (const m of stageMatches) {
    if (Number(m[1]) !== derived) {
      mismatches.push(`${statusPath}: "${m[0]}" states ${m[1]}, derived ${derived}`);
    }
  }
}

// --- .github/PULL_REQUEST_TEMPLATE.md: no stale hard-coded count -----------------
const prTemplatePath = ".github/PULL_REQUEST_TEMPLATE.md";
const prTemplate = read(join(ROOT, prTemplatePath));
for (const m of prTemplate.matchAll(/(\d+)[\s-](?:gates?|stage)\b/gi)) {
  const n = Number(m[1]);
  if (n !== derived) {
    mismatches.push(`${prTemplatePath}: "${m[0]}" states ${n}, derived ${derived}`);
  }
}

if (mismatches.length > 0) {
  fail("gate-count", `${mismatches.length} doc(s) drifted from the derived gate count (${derived})`, mismatches);
}

pass("gate-count", `Makefile \`verify:\` has ${derived} stages; README/STATUS/PR-template agree`);
