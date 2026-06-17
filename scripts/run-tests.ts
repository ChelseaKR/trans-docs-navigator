// Test gate. Runs the unit + integration suite under the Node test runner with
// coverage thresholds on the CORE engine (api/*) AND the routing + render surface
// (api/router.ts, src/*). Only api/server.ts — the irreducible HTTP/socket plumbing —
// is excluded; all of its routing/validation logic now lives in the covered router.
// ROADMAP §7 target: ≥90% lines / ≥85% branches on safety-critical logic.

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { pass, fail } from "./util.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const args = [
  "--experimental-strip-types",
  "--no-warnings",
  "--test",
  "--experimental-test-coverage",
  "--test-coverage-include=api/**/*.ts",
  "--test-coverage-include=src/**/*.ts",
  "--test-coverage-include=public/assets/**/*.js", // client tier — executed by tests/client-dom.test.ts
  "--test-coverage-exclude=api/server.ts", // thin HTTP/socket shell (logic lives in api/router.ts)
  "--test-coverage-lines=90",
  "--test-coverage-branches=85",
  "--test-coverage-functions=90",
  "tests/**/*.test.ts",
];

const res = spawnSync(process.execPath, args, { cwd: ROOT, stdio: "inherit" });

if (res.status !== 0) fail("test", "tests failed or coverage below threshold (≥90% lines / ≥85% branches)");
pass("test", "all tests green and core-logic coverage ≥ threshold");
