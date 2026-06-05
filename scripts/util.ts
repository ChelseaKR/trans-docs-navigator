// Shared helpers for the CI gate scripts. Every gate prints a one-line verdict and
// exits non-zero on failure so `make verify` halts the pipeline (fail-closed).

import { readdirSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";

export function pass(gate: string, msg: string): void {
  console.log(`  ✅ ${gate}: ${msg}`);
}

export function fail(gate: string, msg: string, details: string[] = []): never {
  console.error(`  ❌ ${gate}: ${msg}`);
  for (const d of details) console.error(`     - ${d}`);
  process.exit(1);
}

/** Recursively list files under `dir` whose name matches `filter`. */
export function walk(dir: string, filter: (path: string) => boolean): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (name === "node_modules" || name === ".git") continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full, filter));
    else if (filter(full)) out.push(full);
  }
  return out;
}

export function read(path: string): string {
  return readFileSync(path, "utf8");
}

export function isSource(path: string): boolean {
  return /\.(ts|tsx|js|mjs)$/.test(path) && !path.endsWith(".test.ts");
}
