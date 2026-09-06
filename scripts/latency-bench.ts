// In-process latency benchmark for the request path (routing + retrieval + grounded
// composition + render). It measures COMPUTE latency per route — not network first-token
// — so it runs deterministically in CI without a server or k6. It is a regression guard
// for the hot path; the network-level p95 first-token target (ROADMAP §7) is measured by
// loadtest/p95.k6.js against a deployed instance.
//
// Run: `make loadtest`.
//
// CONTENTION vs REGRESSION (#153). An absolute p95 wall-clock budget cannot tell a real
// regression from the measuring machine being busy: under `make verify -j4` (#148) this
// gate can run concurrently with other heavy gates (tsc, a real-browser Playwright pass,
// the coverage-gated test suite), and on a loaded box p95/max blow out to 10-20x their
// normal value while p50 stays flat — scheduler starvation, not algorithmic cost. That
// was measured directly on this repo: p50=0.430ms / p95=25.715ms at load average 122,
// vs p95=2.57/1.20/0.72ms on three immediate isolated re-runs of the same commit.
//
// The fix is two independent, composable pieces:
//   (Makefile) when reached via `make verify`, `loadtest` is now ordered after every
//   other verify gate, so it never shares the box with them — keeping #148's speedup
//   for the other 22 gates while giving this one an uncontended window. A standalone
//   `make loadtest` is unaffected (still just this script, no server needed). See the
//   Makefile's `loadtest:` target.
//   (here) Even an uncontended-by-us box can be busy for external reasons (a laptop's
//   other tabs, a shared CI runner), so this script also runs its own same-run control:
//   a trivial calibration workload, interleaved with the real samples, that carries no
//   algorithmic cost of its own. If scheduling noise is present, it shows up on the
//   control exactly as it does on the workload, because both are the same process in
//   the same window of time. Two distinct verdicts follow:
//     - p50 is never excused. A genuine regression moves the median; contention does
//       not (see the measurement above), so the p50 budget is enforced unconditionally
//       and failing it is always a real "over budget" verdict.
//     - p95 is only judged when the control says the box was quiet. When the control
//       detects contention, "could not measure p95" is reported instead of either a
//       false "over budget" or a false "within budget" — matching the fail-vs-refuse
//       distinction scripts/security-scan.ts's audit half already makes: a check that
//       can't produce a trustworthy verdict must say so, not guess in either direction.
//       Crucially this is a REFUSAL, not a fail-open: it does not print or claim
//       "within budget", and it does not block the push either — the harm in #153 was
//       exactly that "could not tell" was rendered as "over budget".

import { performance } from "node:perf_hooks";
import { cpus, loadavg } from "node:os";
import { handleRoute } from "../api/router.ts";
import { loadCorpus } from "../api/corpus.ts";
import { pass, fail } from "./util.ts";

// Test-only override (tests/gate-efficacy): the poison scenarios below add real
// wall-clock busy-waits per iteration, so the full 2000-iteration/route sweep would
// make the negative controls slow. Unset in production: identical behavior (2000).
const ITERATIONS = Number(process.env.LATENCY_BENCH_TEST_ITERATIONS) || 2000;
const TODAY = "2026-05-31";
// Generous in-process budget; this guards against accidental O(n) blowups, not network.
const P95_BUDGET_MS = 15;
// Contention stretches the tail, not the median (see header). A regression that doubles
// or triples real per-request cost still trips this well inside the P95 budget's margin,
// and — unlike P95 — this check is never suspended for contention.
const P50_BUDGET_MS = P95_BUDGET_MS / 3;

// A trivial, allocation-light unit of "no real work", sized to complete in low
// microseconds on a quiet box. It carries no route logic and no corpus access, so
// nothing about IT should ever cost more than that — if its own p95 is elevated, the
// process is being preempted by something else, not running slower code.
const CALIBRATION_CONTENTION_MS = 1;
function calibrationUnit(): void {
  let x = 0;
  for (let j = 0; j < 200; j++) x += Math.sqrt(j);
  if (x < 0) throw new Error("unreachable"); // defeat dead-code elimination
}

// Deterministic test-only jitter (tests/gate-efficacy/gate-efficacy.test.ts). Two
// scenarios, decided ONCE per outer iteration (not per timed segment) so the cost
// doesn't silently double where both a route sample and a calibration sample are
// taken in the same loop pass. Unset in production: both are no-ops.
const POISON_REGRESSION = process.env.LATENCY_BENCH_POISON_REGRESSION === "1";
const POISON_CONTENTION = process.env.LATENCY_BENCH_POISON_CONTENTION === "1";
let contentionTicks = 0;
function busyWaitMs(ms: number): void {
  const end = performance.now() + ms;
  while (performance.now() < end) {
    /* spin: simulate a real wall-clock stall, not just an inflated number */
  }
}
/** Called once per outer iteration. Returns whether this iteration gets a simulated
 * contention stall — applied by the caller to BOTH the route sample and the
 * calibration sample, exactly what real OS scheduler contention does: it stalls
 * whatever the process happens to be running, not just one code path. */
function contentionHitsThisIteration(): boolean {
  if (!POISON_CONTENTION) return false;
  contentionTicks += 1;
  return contentionTicks % 20 === 0; // ~5% of iterations take a scheduler-sized hit
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx]!;
}

const routes: [string, string][] = [
  ["home", "/"],
  ["checklist", "/checklist?jurisdiction=US-CA&change=name&change=gender-marker"],
  ["packet", "/packet?jurisdiction=US-CA&change=name"],
  ["answer", "/answer?jurisdiction=US-CA&change=name&q=how%20do%20I%20change%20my%20name%20in%20superior%20court"],
  ["healthz", "/healthz"],
];

loadCorpus(); // warm the cache so we measure steady-state, not first-load
const rows: { name: string; p50: number; p95: number; max: number }[] = [];
const calibration: number[] = [];

for (const [name, path] of routes) {
  const samples: number[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const stall = contentionHitsThisIteration();

    const url = new URL(path, "http://localhost:8080");
    const t0 = performance.now();
    handleRoute("GET", url, TODAY);
    if (POISON_REGRESSION) busyWaitMs(8); // constant per-sample cost: moves p50, as a real regression does
    if (stall) busyWaitMs(30); // rare + large: moves the tail, not the median
    samples.push(performance.now() - t0);

    // Interleaved same-run control (see header): one trivial unit per route sample,
    // spread across the whole run so it shares every window of time the workload does.
    // Deliberately NOT subject to POISON_REGRESSION — a real code regression doesn't
    // slow down an unrelated calibration loop, only contention does.
    const c0 = performance.now();
    calibrationUnit();
    if (stall) busyWaitMs(30); // the same stall event also visible to the control
    calibration.push(performance.now() - c0);
  }
  samples.sort((a, b) => a - b);
  rows.push({ name, p50: percentile(samples, 50), p95: percentile(samples, 95), max: samples[samples.length - 1]! });
}

calibration.sort((a, b) => a - b);
const calibrationP95 = percentile(calibration, 95);
const calibrationMax = calibration[calibration.length - 1]!;
const loadAvg1m = loadavg()[0] ?? 0;
const cpuCount = cpus().length || 1;
const loadPerCore = loadAvg1m / cpuCount;
// Two independent triggers, either sufficient, each catching a different failure mode
// found by actually running this against real (not just simulated) contention:
//
//   - Calibration p95: catches OS thread-scheduling preemption — the process gets
//     descheduled mid-measurement. This is precise and portable, but it is a pure
//     arithmetic loop with no allocation, so it does NOT reliably see contention that
//     shows up as GC/memory-pressure latency on the real, allocating routes: measured
//     live in this repo's own dev sandbox under a heavy but non-pathological load
//     (~2.7/core), calibration correctly read ~0.000ms and every route stayed in
//     budget — good. But under genuinely pathological oversubscription (~16-28/core,
//     this sandbox running many unrelated concurrent processes), a route's own p95
//     blew past budget while the calibration loop's p95 (and even its max, once)
//     stayed clean, because nothing about it ever allocates or touches the GC.
//   - Load average, as a high-threshold backstop for exactly that gap: NOT the low
//     threshold tried first (>2/core), which fired on this sandbox's ordinary
//     background noise even while calibration showed zero real contention — trading
//     one false verdict for another. >8/core means the box is running at least 8x its
//     own core count in ready-to-run work; nothing this repo measured below ~3/core
//     ever needed it, and everything at 16-28/core did. Unix-only (always 0 on
//     Windows), so it only ever adds a trigger, never removes one.
const EXTREME_LOAD_PER_CORE = 8;
const contended = calibrationP95 > CALIBRATION_CONTENTION_MS || loadPerCore > EXTREME_LOAD_PER_CORE;

console.log(`  in-process latency over ${ITERATIONS} iters/route (ms):`);
for (const r of rows) {
  console.log(`     ${r.name.padEnd(10)} p50=${r.p50.toFixed(3)}  p95=${r.p95.toFixed(3)}  max=${r.max.toFixed(3)}`);
}
console.log(
  `  same-run control: calibration p95=${calibrationP95.toFixed(3)}ms max=${calibrationMax.toFixed(3)}ms ` +
    `(contention floor ${CALIBRATION_CONTENTION_MS}ms) — load avg(1m)=${loadAvg1m.toFixed(2)} / ${cpuCount} cores = ${loadPerCore.toFixed(2)}/core ` +
    `(extreme-oversubscription floor ${EXTREME_LOAD_PER_CORE}/core)`,
);

// p50 is never excused (see header) — a real regression fails here regardless of
// whether the box is otherwise contended.
const p50Breaches = rows.filter((r) => r.p50 > P50_BUDGET_MS);
if (p50Breaches.length > 0) {
  fail(
    "loadtest",
    `${p50Breaches.length} route(s) over the ${P50_BUDGET_MS}ms p50 budget — the median moved, which contention does not do`,
    p50Breaches.map((r) => `${r.name}: p50=${r.p50.toFixed(2)}ms`),
  );
}

if (contended) {
  // Refuse, don't guess. This is not a pass: it never prints "within budget", and the
  // routes' own p95 numbers above stay visible for a human to judge. It is also not a
  // fail: an inconclusive tail measurement on an otherwise-clean median must not block
  // the push it was blocking before #153 (a busy box, not a busy code path).
  const why =
    calibrationP95 > CALIBRATION_CONTENTION_MS
      ? `calibration p95 ${calibrationP95.toFixed(2)}ms > ${CALIBRATION_CONTENTION_MS}ms floor`
      : `load ${loadPerCore.toFixed(2)}/core > ${EXTREME_LOAD_PER_CORE}/core floor`;
  console.log(
    `  ⚠️  loadtest: could not measure p95 reliably — contention detected (${why}). ` +
      `p50 is within the ${P50_BUDGET_MS}ms budget on every route, so no regression signal was found; re-run on a quiet box for a trustworthy p95 verdict.`,
  );
  process.exit(0);
}

const p95Breaches = rows.filter((r) => r.p95 > P95_BUDGET_MS);
if (p95Breaches.length > 0) {
  fail(
    "loadtest",
    `${p95Breaches.length} route(s) over the ${P95_BUDGET_MS}ms in-process p95 budget`,
    p95Breaches.map((r) => `${r.name}: ${r.p95.toFixed(2)}ms`),
  );
}
pass("loadtest", `all ${rows.length} routes within the ${P95_BUDGET_MS}ms p95 and ${P50_BUDGET_MS}ms p50 budgets (control: quiet)`);
