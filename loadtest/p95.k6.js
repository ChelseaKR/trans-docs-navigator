// Network-level load test for the p95 first-token target (ROADMAP §7: p95 < 1.5s).
// Requires k6 (https://k6.io) and a running server.
//
//   make dev                                   # in one shell (http://localhost:8080)
//   BASE=http://localhost:8080 k6 run loadtest/p95.k6.js
//
// In CI this runs against the deployed (or docker-compose) instance and is the gate that
// backs the §7 first-token target. The deterministic in-process guard is scripts/latency-bench.ts.

import http from "k6/http";
import { check, sleep } from "k6";

const BASE = __ENV.BASE || "http://localhost:8080";

export const options = {
  scenarios: {
    browse: { executor: "ramping-vus", startVUs: 1, stages: [
      { duration: "15s", target: 20 },
      { duration: "30s", target: 20 },
      { duration: "15s", target: 0 },
    ] },
  },
  thresholds: {
    // p95 of the full request under load. The §7 target is p95 first-token < 1.5s.
    http_req_duration: ["p(95)<1500"],
    checks: ["rate>0.99"],
  },
};

const PATHS = [
  "/",
  "/checklist?jurisdiction=US-CA&change=name&change=gender-marker",
  "/packet?jurisdiction=US-CA&change=name",
  "/changes?since=2026-05-01&jurisdiction=US-CA&change=name&change=gender-marker",
  "/answer?jurisdiction=US-CA&change=name&q=how%20do%20I%20change%20my%20name",
  "/forms/us-ss-5",
  "/healthz",
];

export default function () {
  for (const p of PATHS) {
    const res = http.get(`${BASE}${p}`);
    check(res, {
      "status 200": (r) => r.status === 200,
      "has body": (r) => r.body && r.body.length > 0,
    });
  }
  sleep(1);
}
