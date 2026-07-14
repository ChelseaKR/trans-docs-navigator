// Privacy gate (audit §C, guardrail #3) — merge-blocking.
// Asserts two deliberately narrow, mechanical privacy invariants:
//   (1) Runtime API code never references the direct identity fields used by the
//       on-device form helper.
//   (2) No logging call in application code carries one of those identity fields.
// The runtime safe-logger allowlist (api/log.ts) is verified separately by tests.
// This gate does not prove that request data never reaches the server: checklist
// selections and an optional free-text question are request inputs. The runtime
// data-flow test separately proves that attacker-controlled content is not reflected
// into an application log descriptor or response body.

import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import { walk, read, isSource, pass, fail } from "./util.ts";

// Test-only override (tests/gate-efficacy): point the whole gate at a poisoned
// fixture tree (its own api/server.ts, api/, src/, .gitignore) instead of the repo
// root. Unset in production, so behavior is unchanged.
const ROOT = process.env.PRIVACY_LINT_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), "..");

// Direct identity fields that runtime API code must never handle or log.
const PII_KEYS = [
  "current_legal_name",
  "new_legal_name",
  "date_of_birth",
  "ssn",
  "social_security_number",
];
const piiRe = new RegExp(`\\b(${PII_KEYS.join("|")})\\b`);
const logRe = /\b(console\.\w+|safeLog|logger?\.\w+)\s*\(/;

const problems: string[] = [];

// (1) Runtime API code must not handle direct identity fields. types.ts is exempt:
//     it is a compile-time shape retained for client-side form-helper compatibility.
for (const file of walk(join(ROOT, "api"), isSource)) {
  const rel = relative(ROOT, file);
  if (rel === join("api", "types.ts")) continue;
  read(file)
    .split("\n")
    .forEach((line, i) => {
      if (piiRe.test(line)) problems.push(`${rel}:${i + 1} — runtime API references a direct identity field`);
    });
}

// (2) No direct identity field in any log call across application code.
for (const dir of ["api", "src"]) {
  for (const file of walk(join(ROOT, dir), isSource)) {
    const rel = relative(ROOT, file);
    if (rel === join("api", "types.ts")) continue;
    read(file)
      .split("\n")
      .forEach((line, i) => {
        if (logRe.test(line) && piiRe.test(line)) problems.push(`${rel}:${i + 1} — PII in a log call`);
      });
  }
}

// (3) Ephemeral by design: session artifacts must be git-ignored.
const gitignore = read(join(ROOT, ".gitignore"));
if (!/\*\.session\.json/.test(gitignore)) {
  problems.push(".gitignore — session artifacts are not ignored (ephemeral-by-default invariant)");
}

if (problems.length > 0) fail("privacy", `${problems.length} privacy violation(s)`, problems);
pass("privacy", "no direct identity fields in runtime API/log calls; session artifacts ignored");
