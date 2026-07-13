// Dependency-free RED metrics for the hosted HTTP surface. Values are process-local
// and exposed in Prometheus text format at /metrics. Route labels are templated before
// storage so user-controlled paths cannot create unbounded cardinality or leak content.

interface Series {
  method: string;
  route: string;
  status: number;
  count: number;
  errorCount: number;
  slowCount: number;
  durationSeconds: number;
}

export interface RequestObservation {
  method: string;
  path: string;
  status: number;
  durationSeconds: number;
}

const series = new Map<string, Series>();
let activeRequests = 0;

/** Deployed end-to-end HTTP response SLO threshold; mirrored by slos/service.yaml. */
export const SLOW_REQUEST_SECONDS = 1.5;
/** Non-user traffic excluded from request-based availability/latency SLIs. */
export const SLO_EXCLUDED_ROUTES = ["/metrics", "/livez", "/readyz", "/healthz"] as const;
export const SLO_ROUTE_MATCHER = 'http_route!~"/(metrics|livez|readyz|healthz)"';

const EXACT_ROUTES = new Set([
  "/",
  "/accessibility",
  "/answer",
  "/assets/app.css",
  "/checklist",
  "/guide",
  "/healthz",
  "/livez",
  "/metrics",
  "/offline",
  "/packet",
  "/privacy",
  "/readyz",
  "/robots.txt",
  "/sitemap.xml",
  "/sw.js",
  "/terms",
]);

/** Bound every path to a low-cardinality route-template label. */
export function metricRoute(path: string): string {
  if (EXACT_ROUTES.has(path)) return path;
  if (path.startsWith("/assets/")) return "/assets/:asset";
  if (path.startsWith("/forms/fixtures/")) return "/forms/fixtures/:file";
  if (path.startsWith("/forms/")) return "/forms/:form";
  if (path.startsWith("/guide/")) return "/guide/:state/:topic";
  return "_unmatched";
}

/** Bound arbitrary HTTP method strings for both metrics and privacy-safe logs. */
export function metricMethod(method: string): string {
  const upper = method.toUpperCase();
  return ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"].includes(upper)
    ? upper
    : "OTHER";
}

/** Increment the active gauge and return an idempotent completion callback. */
export function startRequest(): (observation: RequestObservation) => void {
  activeRequests++;
  let finished = false;
  return (observation) => {
    if (finished) return;
    finished = true;
    activeRequests = Math.max(activeRequests - 1, 0);
    observeRequest(observation);
  };
}

export function observeRequest(observation: RequestObservation): void {
  const method = metricMethod(observation.method);
  const route = metricRoute(observation.path);
  const status = Number.isSafeInteger(observation.status) ? observation.status : 500;
  const key = JSON.stringify([method, route, status]);
  const current = series.get(key) ?? {
    method,
    route,
    status,
    count: 0,
    errorCount: 0,
    slowCount: 0,
    durationSeconds: 0,
  };
  current.count++;
  if (status >= 500) current.errorCount++;
  if (observation.durationSeconds > SLOW_REQUEST_SECONDS) current.slowCount++;
  current.durationSeconds += Math.max(observation.durationSeconds, 0);
  series.set(key, current);
}

function escapeLabel(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("\n", "\\n").replaceAll('"', '\\"');
}

function labels(item: Series): string {
  return `http_request_method="${escapeLabel(item.method)}",http_route="${escapeLabel(item.route)}",http_response_status_code="${item.status}"`;
}

export function renderPrometheusMetrics(): string {
  const ordered = [...series.values()].sort((a, b) =>
    `${a.method}\0${a.route}\0${a.status}`.localeCompare(`${b.method}\0${b.route}\0${b.status}`),
  );
  const lines = [
    "# HELP tdn_http_server_active_requests Current in-flight HTTP requests.",
    "# TYPE tdn_http_server_active_requests gauge",
    `tdn_http_server_active_requests ${activeRequests}`,
    "# HELP tdn_http_server_requests_total Completed HTTP requests.",
    "# TYPE tdn_http_server_requests_total counter",
  ];
  for (const item of ordered) {
    lines.push(`tdn_http_server_requests_total{${labels(item)}} ${item.count}`);
  }
  lines.push(
    "# HELP tdn_http_server_errors_total Completed HTTP requests with a 5xx status.",
    "# TYPE tdn_http_server_errors_total counter",
  );
  for (const item of ordered) {
    lines.push(`tdn_http_server_errors_total{${labels(item)}} ${item.errorCount}`);
  }
  lines.push(
    `# HELP tdn_http_server_slow_requests_total Completed HTTP requests slower than ${SLOW_REQUEST_SECONDS} seconds.`,
    "# TYPE tdn_http_server_slow_requests_total counter",
  );
  for (const item of ordered) {
    lines.push(`tdn_http_server_slow_requests_total{${labels(item)}} ${item.slowCount}`);
  }
  lines.push(
    "# HELP tdn_http_server_request_duration_seconds HTTP request duration in UCUM seconds.",
    "# TYPE tdn_http_server_request_duration_seconds summary",
  );
  for (const item of ordered) {
    const labelSet = labels(item);
    lines.push(
      `tdn_http_server_request_duration_seconds_sum{${labelSet}} ${item.durationSeconds}`,
      `tdn_http_server_request_duration_seconds_count{${labelSet}} ${item.count}`,
    );
  }
  return `${lines.join("\n")}\n`;
}

/** Test isolation only. */
export function resetMetrics(): void {
  series.clear();
  activeRequests = 0;
}
