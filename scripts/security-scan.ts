// Security gate (§6) — merge-blocking. Two checks runnable without external SaaS:
//   (a) dependency audit: fail on any high/critical advisory (npm audit).
//   (b) secret scan: fail on committed credentials.
// Production CI additionally runs semgrep/CodeQL SAST (see .github/workflows/ci.yml).
//
// FAIL-CLOSED CONTRACT (SEC-12). This gate's output is a claim about the world:
// "zero high/critical advisories apply to this tree." An audit that could not run —
// npm missing, no lockfile, no network, a registry error — establishes nothing, and
// "I could not find out" is not that claim. So an audit that does not produce a
// parseable report WITH a numeric metadata.vulnerabilities block is a gate FAILURE,
// not a pass, and the 0C/0H figure is only printed when a real audit reported it.
// A deliberately offline run must say so out loud: SECURITY_SCAN_ALLOW_NO_AUDIT=1
// downgrades that failure to a loud SKIPPED notice that names itself in the verdict
// line. There is no path where the advisory check is silently absent.

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
//
// Two outcomes only, and they are not interchangeable: RAN (we have counts, and can
// assert something about them) or DID-NOT-RUN (we have nothing, and must say so).
// The old code collapsed both into "counters are still 0" — `JSON.parse(stdout || "{}")`
// never throws, so an absent audit produced a green "0C/0H". See the fail-closed
// contract at the top of this file.
type AuditOutcome =
  | { ran: true; critical: number; high: number; total: number }
  | { ran: false; reason: string };

function runDependencyAudit(): AuditOutcome {
  const audit = spawnSync("npm", ["audit", "--json"], { cwd: ROOT, encoding: "utf8" });
  if (audit.error) {
    return { ran: false, reason: `npm audit could not be spawned: ${audit.error.message}` };
  }
  const stdout = (audit.stdout ?? "").trim();
  if (!stdout) {
    const stderr = (audit.stderr ?? "").trim().split("\n").filter(Boolean).slice(-1)[0] ?? "no stderr";
    return { ran: false, reason: `npm audit produced no output (exit ${audit.status}): ${stderr}` };
  }

  let json: unknown;
  try {
    json = JSON.parse(stdout);
  } catch {
    return { ran: false, reason: `npm audit output was not parseable JSON (exit ${audit.status})` };
  }

  // npm reports its own failures as {"error": {...}} on stdout — valid JSON, no counts.
  const report = json as {
    error?: { code?: string; summary?: string };
    metadata?: { vulnerabilities?: Record<string, unknown> };
  };
  if (report?.error) {
    const { code, summary } = report.error;
    return { ran: false, reason: `npm audit reported an error: ${code ?? "unknown"} — ${summary ?? "no summary"}` };
  }

  const v = report?.metadata?.vulnerabilities;
  if (!v || typeof v !== "object") {
    return { ran: false, reason: "npm audit output carried no metadata.vulnerabilities block, so no advisory count was established" };
  }
  const count = (key: string): number | null => {
    const n = v[key];
    return typeof n === "number" && Number.isFinite(n) ? n : null;
  };
  const critical = count("critical");
  const high = count("high");
  const total = count("total") ?? -1;
  if (critical === null || high === null) {
    return { ran: false, reason: "npm audit reported no numeric high/critical counts" };
  }
  return { ran: true, critical, high, total };
}

// Escape hatch for a knowingly-offline run. It is deliberately not a silent one: it
// prints a warning and rewrites the verdict line so no reader can mistake the result
// for an audit that actually happened.
const ALLOW_NO_AUDIT = process.env.SECURITY_SCAN_ALLOW_NO_AUDIT === "1";

const outcome = runDependencyAudit();
let auditVerdict: string;
if (outcome.ran) {
  if (outcome.critical + outcome.high > 0) {
    fail("security", `dependency audit: ${outcome.critical} critical, ${outcome.high} high`);
  }
  auditVerdict = `no high/critical dependency advisories (${outcome.critical}C/${outcome.high}H${outcome.total >= 0 ? `, ${outcome.total} total` : ""})`;
} else if (ALLOW_NO_AUDIT) {
  console.log(`  ⚠️  SECURITY_SCAN_ALLOW_NO_AUDIT=1 — dependency advisory check SKIPPED: ${outcome.reason}`);
  auditVerdict = "dependency advisory check SKIPPED (SECURITY_SCAN_ALLOW_NO_AUDIT=1 — no advisory count established)";
} else {
  fail("security", `dependency audit did not run, so SEC-12 is unverified — ${outcome.reason}`, [
    "This gate fails closed: an audit that cannot run is not evidence of zero advisories.",
    "Fix the audit (install npm, restore the lockfile, restore network) — do not ignore this.",
    "For a knowingly-offline run, set SECURITY_SCAN_ALLOW_NO_AUDIT=1; the verdict line will then say the check was skipped.",
  ]);
}

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

pass("security", `${auditVerdict}; no committed secrets`);
