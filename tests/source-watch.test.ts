// FIX-10 — extends source-watch drift detection to form source artifacts (raw-bytes sha256,
// separate baseline at forms/form-hashes.json). Network is always mocked here: this
// suite must never live-fetch real PDFs.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { contentHash, binaryHash, computeUrlHashes, summarize, normalize } from "../scripts/source-watch.ts";

function withMockedFetch<T>(impl: typeof fetch, run: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  return run().finally(() => {
    globalThis.fetch = original;
  });
}

test("binaryHash hashes raw PDF bytes (not the HTML-normalize path)", async () => {
  const bytes = Buffer.from("%PDF-1.4 fake pdf bytes for a test fixture");
  const mock = (async () =>
    new Response(bytes, { status: 200, headers: { "content-type": "application/pdf" } })) as unknown as typeof fetch;
  const hash = await withMockedFetch(mock, () => binaryHash("https://example.gov/form.pdf"));
  assert.equal(hash, createHash("sha256").update(bytes).digest("hex"));
});

test("binaryHash returns null on fetch failure — never flips to drift on an outage", async () => {
  const mock = (async () => {
    throw new Error("network down");
  }) as unknown as typeof fetch;
  const hash = await withMockedFetch(mock, () => binaryHash("https://example.gov/form.pdf"));
  assert.equal(hash, null);
});

test("binaryHash returns null on a non-OK response", async () => {
  const mock = (async () => new Response("nope", { status: 404 })) as unknown as typeof fetch;
  const hash = await withMockedFetch(mock, () => binaryHash("https://example.gov/form.pdf"));
  assert.equal(hash, null);
});

test("contentHash still normalizes HTML (existing corpus behavior preserved)", async () => {
  const html = "<html><body><p>Hello   World</p></body></html>";
  const mock = (async () =>
    new Response(html, { status: 200, headers: { "content-type": "text/html" } })) as unknown as typeof fetch;
  const hash = await withMockedFetch(mock, () => contentHash("https://example.gov/page"));
  assert.equal(hash, createHash("sha256").update("hello world").digest("hex"));
});

test("computeUrlHashes reports drift against baseline and never flags an unreachable URL as drift", async () => {
  const byUrl = new Map<string, string[]>([
    ["https://a.gov/x.pdf", ["form-a"]],
    ["https://b.gov/y.pdf", ["form-b"]],
  ]);
  const hashFn = async (url: string) => (url === "https://a.gov/x.pdf" ? "newhash" : null);
  const baseline = { "https://a.gov/x.pdf": "oldhash", "https://b.gov/y.pdf": "bhash" };

  const result = await computeUrlHashes(byUrl, hashFn, baseline, false);

  assert.deepEqual(result.drifted, ["https://a.gov/x.pdf → re-verify: form-a"]);
  assert.deepEqual(result.unreachable, ["https://b.gov/y.pdf"]);
  assert.deepEqual(result.missingBaseline, []);
  assert.deepEqual(result.staleBaseline, []);
  assert.equal(result.next["https://a.gov/x.pdf"], "newhash");
  assert.equal(result.next["https://b.gov/y.pdf"], "bhash"); // kept the old baseline on fetch failure
});

test("computeUrlHashes with update=true never reports drift, even against a differing baseline", async () => {
  const byUrl = new Map<string, string[]>([["https://a.gov/x.pdf", ["form-a"]]]);
  const hashFn = async () => "newhash";
  const result = await computeUrlHashes(byUrl, hashFn, { "https://a.gov/x.pdf": "oldhash" }, true);

  assert.deepEqual(result.drifted, []);
  assert.equal(result.next["https://a.gov/x.pdf"], "newhash");
});

test("computeUrlHashes against an empty baseline (first run) records hashes with no drift", async () => {
  const byUrl = new Map<string, string[]>([["https://a.gov/x.pdf", ["form-a"]]]);
  const hashFn = async () => "firsthash";
  const result = await computeUrlHashes(byUrl, hashFn, {}, false);

  assert.deepEqual(result.drifted, []);
  assert.deepEqual(result.unreachable, []);
  assert.deepEqual(result.missingBaseline, []); // main reports the explicit no-baseline failure
  assert.deepEqual(result.staleBaseline, []);
  assert.equal(result.next["https://a.gov/x.pdf"], "firsthash");
});

test("computeUrlHashes fails coverage for a new URL absent from a non-empty baseline", async () => {
  const byUrl = new Map<string, string[]>([
    ["https://a.gov/known.pdf", ["form-known"]],
    ["https://a.gov/new.pdf", ["form-new"]],
  ]);
  const hashFn = async (url: string) => (url.endsWith("known.pdf") ? "knownhash" : "newhash");
  const result = await computeUrlHashes(
    byUrl,
    hashFn,
    { "https://a.gov/known.pdf": "knownhash" },
    false,
  );

  assert.deepEqual(result.drifted, []);
  assert.deepEqual(result.missingBaseline, [
    "https://a.gov/new.pdf → baseline required for: form-new",
  ]);
  assert.equal(result.next["https://a.gov/new.pdf"], "newhash");
});

test("missing baseline and fetch outage remain separate signals", async () => {
  const byUrl = new Map<string, string[]>([
    ["https://a.gov/known.pdf", ["form-known"]],
    ["https://a.gov/new.pdf", ["form-new"]],
  ]);
  const result = await computeUrlHashes(
    byUrl,
    async (url) => (url.endsWith("known.pdf") ? "knownhash" : null),
    { "https://a.gov/known.pdf": "knownhash" },
    false,
  );

  assert.deepEqual(result.unreachable, ["https://a.gov/new.pdf"]);
  assert.deepEqual(result.missingBaseline, [
    "https://a.gov/new.pdf → baseline required for: form-new",
  ]);
  assert.equal(result.next["https://a.gov/new.pdf"], undefined);
});

// --- Regression: a baseline-coverage issue must never SUPPRESS the drift report. -------
// summarize() used to be an early `return` on missingBaseline/staleBaseline that ran
// before drift was ever evaluated. Because this repo deliberately carries baseline gaps
// (the four review-gated SS-5/SSA/NY-Courts references), that meant real drift at every
// other source was silently never reported — a fail-quiet in the exact mechanism the
// product's safety story rests on. These tests pin both signals surviving one run.

test("REGRESSION: drift is still reported when a baseline-coverage issue is present", async () => {
  const byUrl = new Map<string, string[]>([
    ["https://drifted.gov/page", ["rec-drifted"]], // real drift
    ["https://uncovered.gov/page", ["rec-uncovered"]], // deliberate baseline gap
  ]);
  const result = await computeUrlHashes(
    byUrl,
    async (url) => (url.includes("drifted") ? "newhash" : "somehash"),
    { "https://drifted.gov/page": "oldhash" }, // uncovered.gov has no baseline entry
    false,
  );

  // Both signals must be present on the result...
  assert.deepEqual(result.drifted, ["https://drifted.gov/page → re-verify: rec-drifted"]);
  assert.deepEqual(result.missingBaseline, [
    "https://uncovered.gov/page → baseline required for: rec-uncovered",
  ]);

  // ...and both must survive into the reported verdict. The coverage gap must not mask
  // the drift: a human reading this run has to learn that drifted.gov moved.
  const summary = summarize([result]);
  assert.equal(summary.ok, false);
  assert.equal(summary.drifted.length, 1);
  assert.equal(summary.coverageIssues.length, 1);
  assert.ok(
    summary.details.some((d) => d.includes("drift: https://drifted.gov/page")),
    "drift must appear in the reported details even alongside a coverage issue",
  );
  assert.ok(
    summary.details.some((d) => d.includes("coverage: https://uncovered.gov/page")),
    "the coverage issue must still be reported",
  );
  assert.match(summary.message, /1 source\(s\) changed since baseline/);
  assert.match(summary.message, /1 baseline coverage issue\(s\)/);
});

test("summarize: a coverage issue alone still fails the build", () => {
  const summary = summarize([
    { next: {}, drifted: [], unreachable: [], missingBaseline: ["https://a.gov → baseline required for: r"], staleBaseline: [] },
  ]);
  assert.equal(summary.ok, false);
  assert.equal(summary.drifted.length, 0);
  assert.match(summary.message, /baseline coverage issue/);
});

test("summarize: drift alone fails the build", () => {
  const summary = summarize([
    { next: {}, drifted: ["https://a.gov → re-verify: r"], unreachable: [], missingBaseline: [], staleBaseline: [] },
  ]);
  assert.equal(summary.ok, false);
  assert.match(summary.message, /changed since baseline/);
});

test("summarize: clean run passes; unreachable URLs are not drift", () => {
  const summary = summarize([
    { next: { "https://a.gov": "h" }, drifted: [], unreachable: ["https://b.gov"], missingBaseline: [], staleBaseline: [] },
  ]);
  assert.equal(summary.ok, true);
  assert.deepEqual(summary.details, []);
});

test("summarize: drift across BOTH watches (corpus + forms) is aggregated, not shadowed", () => {
  const summary = summarize([
    { next: {}, drifted: ["https://corpus.gov → re-verify: rec"], unreachable: [], missingBaseline: ["https://gap.gov → baseline required for: x"], staleBaseline: [] },
    { next: {}, drifted: ["https://form.gov/f.pdf → re-verify: form"], unreachable: [], missingBaseline: [], staleBaseline: [] },
  ], "source");
  assert.equal(summary.drifted.length, 2);
  assert.equal(summary.coverageIssues.length, 1);
  assert.ok(summary.details.some((d) => d.includes("drift: https://form.gov/f.pdf")));
});

test("summarize: `unit` labels the verdict (shared with policy-watch)", () => {
  const summary = summarize(
    [{ next: {}, drifted: ["tracker 'X' changed"], unreachable: [], missingBaseline: [], staleBaseline: [] }],
    "tracker",
  );
  assert.match(summary.message, /1 tracker\(s\) changed since baseline/);
});

test("computeUrlHashes flags stale baseline URLs until an intentional update removes them", async () => {
  const byUrl = new Map<string, string[]>([["https://a.gov/current.pdf", ["form-current"]]]);
  const baseline = {
    "https://a.gov/current.pdf": "currenthash",
    "https://a.gov/removed.pdf": "removedhash",
  };

  const check = await computeUrlHashes(byUrl, async () => "currenthash", baseline, false);
  assert.deepEqual(check.staleBaseline, [
    "https://a.gov/removed.pdf → no current record/form cites this baseline",
  ]);

  const update = await computeUrlHashes(byUrl, async () => "currenthash", baseline, true);
  assert.deepEqual(update.staleBaseline, []);
  assert.deepEqual(Object.keys(update.next), ["https://a.gov/current.pdf"]);
});

// ── REGRESSION (CodeQL js/bad-tag-filter): loose end tags must close the element ───────
//
// normalize() stripped <script>/<style> with `/<script[\s\S]*?<\/script>/gi` — an end-tag
// pattern that only accepts the tight `</script>`. HTML lets a browser close the element on
// `</script >`, `</script\n>` and `</script foo="bar">` as well, and against a page that
// emits any of those the non-greedy match runs PAST the real end tag to the next tight one
// (or fails entirely), leaving the whole JavaScript body inside the text that gets hashed.
//
// That is not a lint nit here. Minified bundles carry per-build cache-busting ids and
// per-response nonces, so the content hash then changes on every fetch and source-watch /
// policy-watch report DRIFT — "this official source moved under a record" — for a document
// that did not change. False drift on the trans policy documents this project exists to
// monitor is worse than no watcher: it trains a human to dismiss the alert that is real.
//
// THIS TEST FAILS ON THE UNFIXED normalize(): every loose-end-tag case below leaks `alert`
// and `buildid` into the output, which is exactly the per-build id that would then churn the
// content hash on every fetch.
test("REGRESSION: normalize() drops script bodies closed with a loose end tag", () => {
  const cases: Array<[string, string]> = [
    ["tight", '<p>keep</p><script>var buildid="a1";alert(1)</script><p>me</p>'],
    ["trailing space", '<p>keep</p><script>var buildid="a1";alert(1)</script ><p>me</p>'],
    ["newline", '<p>keep</p><script>var buildid="a1";alert(1)</script\n><p>me</p>'],
    ["attributes on the end tag", '<p>keep</p><script>var buildid="a1";alert(1)</script foo="bar"><p>me</p>'],
    ["slash", '<p>keep</p><script>var buildid="a1";alert(1)</script/><p>me</p>'],
    ["loose start tag too", '<p>keep</p><script type="text/javascript" >var buildid="a1";alert(1)</script ><p>me</p>'],
  ];
  for (const [label, html] of cases) {
    const text = normalize(html);
    assert.doesNotMatch(text, /alert|buildid/, `script body survived normalize() (${label})`);
    assert.equal(text, "keep me", `surrounding text not preserved (${label})`);
  }
});

test("REGRESSION: normalize() drops style bodies closed with a loose end tag", () => {
  for (const html of [
    "<p>keep</p><style>.x{color:red}</style><p>me</p>",
    "<p>keep</p><style>.x{color:red}</style ><p>me</p>",
    '<p>keep</p><style>.x{color:red}</style media="all"><p>me</p>',
  ]) {
    assert.equal(normalize(html), "keep me", `style body survived normalize(): ${html}`);
  }
});

// Pins the OTHER half of the `\b` in `</script\b[^>]*>`. `[^>]*` on its own would happily
// let `</scriptfoo>` close the element; a browser does not close on it, and if we did, a page
// could hide text from the hash between the fake close and the real one. (This case already
// held before the fix — it is pinned so a future "simplify the regex" cannot quietly lose it.)
test("`</scriptfoo>` does NOT close a script element", () => {
  const text = normalize("<p>keep</p><script>a</scriptfoo>b</script><p>me</p>");
  assert.equal(text, "keep me");
  assert.doesNotMatch(text, /scriptfoo/);
});

// FAILS ON THE UNFIXED normalize(): with only `-->` recognized, the comment is not removed as
// a comment, the generic tag-strip tears it in half at the `>` inside it, and the tail leaks
// into the hashed text as `b --!`.
test("REGRESSION: normalize() honours `--!>` as a comment terminator, as browsers do", () => {
  assert.equal(normalize("<p>keep</p><!-- a > b --><p>me</p>"), "keep me");
  assert.equal(normalize("<p>keep</p><!-- a > b --!><p>me</p>"), "keep me");
});

// Pins the property scripts/source-snapshot.ts and scripts/policy-watch.ts both depend on:
// there is ONE normalize(), so a snapshot, a drift baseline and a tracker hash can never be
// computed by three subtly different implementations. policy-watch used to hold a
// byte-identical copy, which meant the fix above would have had to be made twice.
test("policy-watch and source-snapshot share the one normalize() implementation", async () => {
  const policyWatchSrc = readFileSync(
    join(import.meta.dirname, "..", "scripts", "policy-watch.ts"),
    "utf8",
  );
  assert.match(policyWatchSrc, /import \{[^}]*normalize[^}]*\} from "\.\/source-watch\.ts"/);
  assert.doesNotMatch(policyWatchSrc, /function normalize\s*\(/, "policy-watch must not re-implement normalize()");
});
