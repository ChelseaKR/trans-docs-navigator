// Gate-efficacy runner (FIX-05, docs/ideation/02-large-scale-fixes.md).
//
// Spawns a merge-gate script as a REAL child process, the same way `make verify`
// does (`node --experimental-strip-types scripts/<gate>.ts`), so these tests prove
// the gate's actual process-exit-code contract (scripts/util.ts: fail() prints and
// process.exit(1)) — not just that some internal function throws. Poisoning happens
// via env-var injection points added to the individual gate scripts (guarded: unset
// env → identical production behavior) or, where a gate takes no input at all
// (i18n-utf8.ts walks `git ls-files`), via a throwaway git repo passed as `cwd`.

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(HERE, "..", "..");
export const FIXTURES_DIR = join(HERE, "fixtures");

export interface GateResult {
  code: number | null;
  stdout: string;
  stderr: string;
  /** stdout + stderr concatenated — most gate output lands on one or the other. */
  output: string;
}

/**
 * Run `node --experimental-strip-types scripts/<gate>.ts` as a child process with
 * extra env vars overlaid on the current environment, and optionally a different cwd.
 * Never throws on a non-zero exit — that is the case under test.
 */
// This suite itself runs under `node --test`, which stamps NODE_TEST_CONTEXT /
// NODE_TEST_WORKER_ID on its own process env. Left in place, those leak into a
// spawned gate and (for the "test" gate, which spawns node --test AGAIN internally
// via scripts/run-tests.ts) make the doubly-nested test run report itself as a
// subtest to a non-existent parent instead of exiting normally — silently turning a
// real test failure into exit 0. Strip them so every gate observes the same
// top-level environment `make verify` would give it.
const NODE_TEST_ENV_KEYS = ["NODE_TEST_CONTEXT", "NODE_TEST_WORKER_ID"];

/**
 * Hooks such as pre-push export GIT_DIR/GIT_WORK_TREE for the caller repository.
 * Never let that ambient repository identity escape into a child whose `cwd` is a
 * disposable fixture: a `git init`/`git add` there would otherwise mutate the real
 * worktree's index and branch. Child processes rediscover Git state from their cwd.
 */
export function isolatedChildEnv(
  overrides: Record<string, string> = {},
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith("GIT_") || NODE_TEST_ENV_KEYS.includes(key)) delete env[key];
  }
  return { ...env, ...overrides };
}

export function runGate(
  gate: string,
  opts: { env?: Record<string, string>; cwd?: string } = {},
): GateResult {
  const scriptPath = join(REPO_ROOT, "scripts", `${gate}.ts`);
  const env = isolatedChildEnv(opts.env);
  const res = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--no-warnings", scriptPath],
    {
      cwd: opts.cwd ?? REPO_ROOT,
      env,
      encoding: "utf8",
    },
  );
  const stdout = res.stdout ?? "";
  const stderr = res.stderr ?? "";
  return { code: res.status, stdout, stderr, output: stdout + stderr };
}

export function fixture(...segments: string[]): string {
  return join(FIXTURES_DIR, ...segments);
}
