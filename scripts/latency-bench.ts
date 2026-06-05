// In-process latency benchmark for the request path (routing + retrieval + grounded
// composition + render). It measures COMPUTE latency per route — not network first-token
// — so it runs deterministically in CI without a server or k6. It is a regression guard
// for the hot path; the network-level p95 first-token target (ROADMAP §7) is measured by
// loadtest/p95.k6.js against a deployed instance.
//
// Run: `make loadtest`.

import { performance } from "node:perf_hooks";
import { handleRoute } from "../api/router.ts";
import { loadCorpus } from "../api/corpus.ts";
import { pass, fail } from "./util.ts";

const ITERATIONS = 2000;
const TODAY = "2026-05-31";
// Generous in-process budget; this guards against accidental O(n) blowups, not network.
const P95_BUDGET_MS = 15;

const routes: [string, string][] = [
  ["home", "/"],
  ["checklist", "/checklist?jurisdiction=US-CA&change=name&change=gender-marker"],
  ["packet", "/packet?jurisdiction=US-CA&change=name"],
  ["answer", "/answer?jurisdiction=US-CA&change=name&q=how%20do%20I%20change%20my%20name%20in%20superior%20court"],
  ["healthz", "/healthz"],
];

function percentile(sorted: number[], p: number): number {
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx]!;
}

loadCorpus(); // warm the cache so we measure steady-state, not first-load
const rows: { name: string; p50: number; p95: number; max: number }[] = [];

for (const [name, path] of routes) {
  const samples: number[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const url = new URL(path, "http://localhost:8080");
    const t0 = performance.now();
    handleRoute("GET", url, TODAY);
    samples.push(performance.now() - t0);
  }
  samples.sort((a, b) => a - b);
  rows.push({ name, p50: percentile(samples, 50), p95: percentile(samples, 95), max: samples[samples.length - 1]! });
}

console.log(`  in-process latency over ${ITERATIONS} iters/route (ms):`);
for (const r of rows) {
  console.log(`     ${r.name.padEnd(10)} p50=${r.p50.toFixed(3)}  p95=${r.p95.toFixed(3)}  max=${r.max.toFixed(3)}`);
}

const breaches = rows.filter((r) => r.p95 > P95_BUDGET_MS);
if (breaches.length > 0) {
  fail("loadtest", `${breaches.length} route(s) over the ${P95_BUDGET_MS}ms in-process p95 budget`, breaches.map((r) => `${r.name}: ${r.p95.toFixed(2)}ms`));
}
pass("loadtest", `all ${rows.length} routes within the ${P95_BUDGET_MS}ms in-process p95 budget`);
