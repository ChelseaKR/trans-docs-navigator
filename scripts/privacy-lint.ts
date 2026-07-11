// Privacy gate (audit §C, guardrail #3) — merge-blocking.
// Asserts the two mechanical privacy invariants:
//   (1) No PII egress: the server never references identity-document PII fields,
//       because form-fill is client-side and PII never reaches the server.
//   (2) No PII in logs: no logging call anywhere carries a PII field.
// The runtime safe-logger allowlist (api/log.ts) is verified separately by tests.

import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import { walk, read, isSource, pass, fail } from "./util.ts";

// Test-only override (tests/gate-efficacy): point the whole gate at a poisoned
// fixture tree (its own api/server.ts, api/, src/, .gitignore) instead of the repo
// root. Unset in production, so behavior is unchanged.
const ROOT = process.env.PRIVACY_LINT_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), "..");

// Identity PII that must never touch the server or any log line.
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

// (1) Server must be PII-free. types.ts defines the Intake shape and is exempt
//     (it is a compile-time type, not a runtime data flow).
const serverFile = join(ROOT, "api", "server.ts");
const serverSrc = read(serverFile);
serverSrc.split("\n").forEach((line, i) => {
  if (piiRe.test(line)) problems.push(`api/server.ts:${i + 1} — server references PII field (no PII may reach the server)`);
});

// (2) No PII in any log call across app code.
for (const dir of ["api", "src"]) {
  for (const file of walk(join(ROOT, dir), isSource)) {
    const rel = relative(ROOT, file);
    if (rel.endsWith("types.ts")) continue;
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
pass("privacy", "no PII reaches the server; no PII in logs; sessions ephemeral");
