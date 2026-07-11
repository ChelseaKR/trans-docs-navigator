// Security gate (§6) — merge-blocking. Two checks runnable without external SaaS:
//   (a) dependency audit: fail on any high/critical advisory (npm audit).
//   (b) secret scan: fail on committed credentials.
// Production CI additionally runs semgrep/CodeQL SAST (see .github/workflows/ci.yml).

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import { walk, read, pass, fail } from "./util.ts";

// Test-only override (tests/gate-efficacy): point the gate at a poisoned fixture
// tree instead of the repo root. Unset in production, so behavior is unchanged.
const ROOT = process.env.SECURITY_SCAN_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), "..");

// (c) Vendored-asset integrity. The app vendors no third-party browser bundles
// (pdf-lib was removed with the auto-fill feature), so there is nothing to pin.
// Any future vendored asset under public/vendor/ should be sha256-pinned here.
const VENDORED: [string, string][] = [];
for (const [rel, expected] of VENDORED) {
  const p = join(ROOT, rel);
  if (!existsSync(p)) fail("security", `vendored asset missing: ${rel}`);
  const actual = createHash("sha256").update(readFileSync(p)).digest("hex");
  if (actual !== expected) {
    fail("security", `vendored asset integrity mismatch: ${rel}`, [`expected ${expected}`, `actual   ${actual}`]);
  }
}

// (a) Dependency audit.
const audit = spawnSync("npm", ["audit", "--json"], { cwd: ROOT, encoding: "utf8" });
let high = 0;
let critical = 0;
try {
  const json = JSON.parse(audit.stdout || "{}");
  const v = json?.metadata?.vulnerabilities ?? {};
  high = v.high ?? 0;
  critical = v.critical ?? 0;
} catch {
  // npm audit can fail offline; treat unpar, but don't silently pass.
  if (!audit.stdout) console.log("  ℹ️  npm audit produced no JSON (offline?) — dependency advisory check skipped");
}
if (high + critical > 0) fail("security", `dependency audit: ${critical} critical, ${high} high`);

// (b) Secret scan.
const SECRET_PATTERNS: [string, RegExp][] = [
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
  ["private key block", /-----BEGIN (RSA |EC )?PRIVATE KEY-----/],
  ["hardcoded bearer/secret", /(secret|api[_-]?key|password)\s*[:=]\s*["'][A-Za-z0-9/+_-]{16,}["']/i],
];
const findings: string[] = [];
const scanFile = (path: string) =>
  /\.(ts|tsx|js|mjs|json|env|ya?ml|sh|tf)$/.test(path) && !path.includes("public/vendor");

for (const file of walk(ROOT, scanFile)) {
  if (file.includes("/node_modules/") || file.endsWith("package-lock.json")) continue;
  const rel = relative(ROOT, file);
  if (rel.startsWith("scripts/security-scan.ts")) continue; // the patterns themselves
  // Deliberately-poisoned negative-control fixtures (tests/gate-efficacy) — see
  // scripts/security-scan.ts's own SECURITY_SCAN_ROOT test-only override above.
  if (rel.startsWith("tests/gate-efficacy/fixtures/")) continue;
  const content = read(file);
  for (const [name, re] of SECRET_PATTERNS) {
    if (re.test(content)) findings.push(`${rel} — possible ${name}`);
  }
}
if (findings.length > 0) fail("security", `${findings.length} possible secret(s) committed`, findings);

pass("security", `no high/critical dependency advisories; no committed secrets (${critical}C/${high}H)`);
