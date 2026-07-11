// Lightweight lint gate (maintainability §7): no stray debuggers, no unlinked
// TODOs, no leftover `console.log` in shipping app code (use api/log.ts instead).
// A full project would also run eslint/prettier; this keeps the gate dependency-free
// and merge-blocking on the rules that matter most here.

import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import { walk, read, isSource, pass, fail } from "./util.ts";

// Test-only override (tests/gate-efficacy): point the gate at a poisoned fixture
// tree instead of the repo root. Unset in production, so behavior is unchanged.
const ROOT = process.env.LINT_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), "..");
const APP_DIRS = ["api", "src"];

const problems: string[] = [];

for (const dir of APP_DIRS) {
  for (const file of walk(join(ROOT, dir), isSource)) {
    const rel = relative(ROOT, file);
    if (rel.endsWith("log.ts")) continue; // the safe logger is allowed to use console
    const lines = read(file).split("\n");
    lines.forEach((line, i) => {
      const at = `${rel}:${i + 1}`;
      if (/\bdebugger\b/.test(line)) problems.push(`${at} — stray 'debugger'`);
      if (/\bconsole\.(log|debug)\(/.test(line)) problems.push(`${at} — console.log in app code (use api/log.ts)`);
      if (/\bTODO\b/.test(line) && !/#\d+|issue\//i.test(line)) problems.push(`${at} — TODO without a linked issue`);
    });
  }
}

if (problems.length > 0) fail("lint", `${problems.length} issue(s)`, problems);
pass("lint", "no debuggers, unlinked TODOs, or stray console.log in app code");
