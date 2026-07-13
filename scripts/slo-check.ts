// Parse the committed rule YAML and enforce SLO/burn-profile/scope drift contracts.
// A real PromQL parser (promtool) remains a deployment gate; this repo does not vendor one.

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  SLO_EXCLUDED_ROUTES,
  SLO_ROUTE_MATCHER,
  SLOW_REQUEST_SECONDS,
} from "../api/metrics.ts";
import { fail, pass } from "./util.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(readFileSync(join(ROOT, "slos/service.yaml"), "utf8")) as unknown;
const rules = readFileSync(join(ROOT, "slos/prometheus.rules.yml"), "utf8");
const require = createRequire(import.meta.url);
const yaml = require("js-yaml") as { load(source: string): unknown };
const parsedRules = yaml.load(rules);

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

const root = record(config);
const ruleRoot = record(parsedRules);
const objectives = Array.isArray(root?.objectives) ? root.objectives.map(record) : [];
const alerts = Array.isArray(root?.multi_window_burn_alerts)
  ? root.multi_window_burn_alerts.map(record)
  : [];
const problems: string[] = [];

const scope = record(root?.sli_scope);
const excludedRoutes = Array.isArray(scope?.excluded_routes)
  ? scope.excluded_routes.filter((value): value is string => typeof value === "string")
  : [];
if (scope?.kind !== "request_based") problems.push("SLI scope must be request_based");
if (
  JSON.stringify([...excludedRoutes].sort()) !==
  JSON.stringify([...SLO_EXCLUDED_ROUTES].sort())
) {
  problems.push("SLI excluded routes drifted from the runtime observability contract");
}

const groups = Array.isArray(ruleRoot?.groups) ? ruleRoot.groups.map(record) : [];
const ruleItems = groups.flatMap((group) =>
  Array.isArray(group?.rules) ? group.rules.map(record) : [],
);
if (ruleItems.length !== 4) problems.push("Prometheus YAML must define exactly four SLO rules");
const expressions = ruleItems
  .map((rule) => rule?.expr)
  .filter((value): value is string => typeof value === "string");
if (expressions.length !== 4) problems.push("every SLO rule must carry a string expression");
for (const expression of expressions) {
  const selectors = [
    ...expression.matchAll(
      /rate\(tdn_http_server_(?:errors|slow_requests|requests)_total\{([^}]*)\}\[[^\]]+\]\)/g,
    ),
  ];
  if (selectors.length !== 4) {
    problems.push("each multi-window rule must contain four scoped rate selectors");
  }
  if (selectors.some((match) => match[1] !== SLO_ROUTE_MATCHER)) {
    problems.push("every SLI numerator and denominator must exclude scrape/probe routes");
  }
}

const availability = objectives.find((item) => item?.name === "availability");
const latency = objectives.find((item) => item?.name === "response_latency");
if (availability?.target !== 0.999) problems.push("availability target must be 0.999");
if (latency?.target !== 0.99) problems.push("latency target must be 0.99");
if (latency?.threshold_seconds !== SLOW_REQUEST_SECONDS) {
  problems.push("latency threshold drifted from the runtime slow-request counter");
}

for (const [name, shortWindow, longWindow, burnRate] of [
  ["fast", "5m", "1h", 14.4],
  ["slow", "30m", "6h", 6],
] as const) {
  const alert = alerts.find((item) => item?.name === name);
  if (
    alert?.short_window !== shortWindow ||
    alert?.long_window !== longWindow ||
    alert?.burn_rate !== burnRate
  ) {
    problems.push(`${name} burn alert windows/rate do not match the standard profile`);
  }
}

for (const required of [
  "TdnAvailabilityFastBurn",
  "TdnAvailabilitySlowBurn",
  "TdnLatencyFastBurn",
  "TdnLatencySlowBurn",
  "[5m]",
  "[1h]",
  "[30m]",
  "[6h]",
  "> 0.0144",
  "> 0.006",
  "> 0.144",
  "> 0.06",
]) {
  if (!rules.includes(required)) problems.push(`Prometheus rules missing ${required}`);
}

if (problems.length > 0) fail("slo", `${problems.length} invalid SLO control(s)`, problems);
pass(
  "slo",
  "SLO objectives, parsed rule YAML, request scope, and burn-profile drift checks are consistent (PromQL parser validation is a deployment gate)",
);
