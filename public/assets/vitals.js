// Cookieless Core Web Vitals RUM (OBSERVABILITY-STANDARD §8) — a dependency-free
// adaptation of the portfolio reference beacon (personal-site src/lib/vitals.ts).
// Field LCP and CLS come from PerformanceObserver; INP is approximated from the
// event-timing API (worst interaction duration). Each metric is beaconed at most
// once, when the page is hidden, to the SAME-ORIGIN sink only (CSP connect-src
// 'self'). The payload carries no cookies, no IPs and no identifiers — just the
// metric name, value, rating and the path (never the query string). Best-effort:
// every failure is swallowed so telemetry can never break or slow the page.
(() => {
  "use strict";
  if (typeof PerformanceObserver !== "function" || typeof document === "undefined") return;

  const ENDPOINT = "/api/metrics/web-vitals"; // same-origin only — no external hosts

  // web.dev thresholds per metric: [good ≤, needs-improvement ≤] then poor.
  const THRESHOLDS = { LCP: [2500, 4000], CLS: [0.1, 0.25], INP: [200, 500] };

  const rating = (name, value) =>
    value <= THRESHOLDS[name][0] ? "good" : value <= THRESHOLDS[name][1] ? "needs-improvement" : "poor";

  const sent = {};
  function send(name, value) {
    if (sent[name]) return;
    sent[name] = true;
    const body = JSON.stringify({
      type: "vital",
      name,
      value: Math.round(value * 1000) / 1000,
      rating: rating(name, value),
      // Path only — never the query string — so nothing user-specific leaves.
      path: location.pathname,
    });
    try {
      if (typeof navigator.sendBeacon === "function") {
        navigator.sendBeacon(ENDPOINT, body);
      } else if (typeof fetch === "function") {
        fetch(ENDPOINT, {
          method: "POST",
          body,
          keepalive: true,
          headers: { "content-type": "application/json" },
        }).catch(() => {});
      }
    } catch (_err) {
      // Telemetry must never throw.
    }
  }

  function observe(type, onEntry, extra) {
    try {
      const po = new PerformanceObserver((list) => list.getEntries().forEach(onEntry));
      po.observe(Object.assign({ type, buffered: true }, extra));
      return po;
    } catch (_err) {
      return null; // entry type unsupported in this browser — skip that metric
    }
  }

  // LCP — the latest candidate before the page is hidden wins.
  let lcp = 0;
  observe("largest-contentful-paint", (e) => {
    lcp = e.startTime;
  });

  // CLS — session windows (gap < 1 s, span < 5 s) of shifts without recent
  // input; the worst window is the score, matching the web-vitals library.
  let clsWorst = 0;
  let winValue = 0;
  let winStart = 0;
  let winPrev = 0;
  observe("layout-shift", (e) => {
    if (e.hadRecentInput) return;
    if (winValue > 0 && e.startTime - winPrev < 1000 && e.startTime - winStart < 5000) {
      winValue += e.value;
    } else {
      winValue = e.value;
      winStart = e.startTime;
    }
    winPrev = e.startTime;
    if (winValue > clsWorst) clsWorst = winValue;
  });

  // INP (approximation) — worst event-timing interaction duration. The strict
  // metric is a high percentile across interactions; on a low-traffic page the
  // worst duration is a faithful, dependency-free stand-in.
  let inp = -1;
  observe(
    "event",
    (e) => {
      if (e.interactionId && e.duration > inp) inp = e.duration;
    },
    { durationThreshold: 40 },
  );

  let flushed = false;
  function flush() {
    if (flushed) return;
    flushed = true;
    if (lcp > 0) send("LCP", lcp);
    send("CLS", clsWorst);
    if (inp >= 0) send("INP", inp);
  }

  addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
  addEventListener("pagehide", flush);
})();
