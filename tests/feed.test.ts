// Per-jurisdiction change-alert feeds: the data layer (api/feed.ts), the RSS 2.0
// rendering (src/feeds.ts), and the router wiring (api/router.ts).

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildJurisdictionFeed, isKnownJurisdiction, knownFeedJurisdictions } from "../api/feed.ts";
import { renderJurisdictionFeedXml, renderFeedsIndex, feedLinkFor, feedPath } from "../src/feeds.ts";
import { handleRoute } from "../api/router.ts";
import type { CorpusRecord } from "../api/types.ts";
import { TEST_TODAY } from "../api/freshness.ts";

const today = TEST_TODAY;

function rec(over: Partial<CorpusRecord>): CorpusRecord {
  return {
    id: "x",
    jurisdiction: "US-ZZ",
    document_type: "court-order",
    change_type: ["name"],
    topic: "t",
    statement: "A sufficiently long statement.",
    source: { url: "https://e.gov", title: "T", last_verified: today, verifier: "Pilot Seed Reviewer" },
    verification_status: "verified",
    recheck_sla_days: 90,
    language: "en",
    ...over,
  };
}

const u = (path: string) => new URL(path, "http://localhost:8080");

// ── A minimal, dependency-free XML well-formedness check ──────────────────────────
// This project ships no bundler/linter dependencies (ADR-6) and has no XML parser
// available; this stack-based tag matcher is the "quick well-formedness check" the
// task calls for at minimum. It is deliberately narrow (this app only ever emits its
// own simple, attribute-light tags) — good enough to catch an unbalanced/unescaped
// template bug, not a general-purpose validator.
function assertWellFormedXml(xml: string, label: string): void {
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/, `${label}: missing XML declaration`);
  const stack: string[] = [];
  const tagRe = /<([^>]+)>/g;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(xml)) !== null) {
    const inner = m[1]!;
    if (inner.startsWith("?") || inner.startsWith("!")) continue; // declaration/comment
    if (inner.endsWith("/")) continue; // self-closing, e.g. <atom:link .../>
    if (inner.startsWith("/")) {
      const name = inner.slice(1).trim();
      const open = stack.pop();
      assert.equal(open, name, `${label}: mismatched close </${name}> (stack: ${stack.join(",")})`);
      continue;
    }
    const name = inner.split(/\s/)[0]!;
    stack.push(name);
  }
  assert.deepEqual(stack, [], `${label}: unclosed tag(s): ${stack.join(",")}`);

  // Every bare `&` must start a well-formed entity/character reference.
  for (const bad of xml.matchAll(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)/g)) {
    assert.fail(`${label}: unescaped "&" at index ${bad.index}`);
  }
}

test("isKnownJurisdiction / knownFeedJurisdictions read the corpus, not just the US-XX shape", () => {
  const corpus = [rec({ id: "a", jurisdiction: "US-WA" }), rec({ id: "b", jurisdiction: "US" })];
  assert.equal(isKnownJurisdiction("US-WA", corpus), true);
  assert.equal(isKnownJurisdiction("US", corpus), true);
  // Well-formed shape, but not actually covered — must NOT read as known.
  assert.equal(isKnownJurisdiction("US-ZZ", corpus), false);
  assert.deepEqual(knownFeedJurisdictions(corpus), ["US", "US-WA"]);
});

test("buildJurisdictionFeed groups current records by last_verified date, newest first", () => {
  const corpus = [
    rec({ id: "a1", jurisdiction: "US-WA", document_type: "court-order", source: { url: "https://e.gov", title: "T", last_verified: "2026-05-01", verifier: "Pilot Seed Reviewer" } }),
    rec({ id: "a2", jurisdiction: "US-WA", document_type: "drivers-license", source: { url: "https://e.gov", title: "T", last_verified: "2026-05-01", verifier: "Pilot Seed Reviewer" } }),
    rec({ id: "a3", jurisdiction: "US-WA", document_type: "passport", source: { url: "https://e.gov", title: "T", last_verified: "2026-07-13", verifier: "Pilot Seed Reviewer" } }),
    // Different jurisdiction/language: must not leak in.
    rec({ id: "b1", jurisdiction: "US-CA", source: { url: "https://e.gov", title: "T", last_verified: "2026-07-13", verifier: "Pilot Seed Reviewer" } }),
    rec({ id: "c1", jurisdiction: "US-WA", language: "es", source: { url: "https://e.gov", title: "T", last_verified: "2026-07-13", verifier: "Pilot Seed Reviewer" } }),
  ];
  const entries = buildJurisdictionFeed("US-WA", "en", today, corpus);
  assert.equal(entries.length, 2);
  assert.equal(entries[0]!.date, "2026-07-13", "newest entry first");
  assert.deepEqual(entries[0]!.recordIds, ["a3"]);
  assert.deepEqual(entries[0]!.documentTypes, ["passport"]);
  assert.equal(entries[1]!.date, "2026-05-01");
  assert.deepEqual(entries[1]!.recordIds, ["a1", "a2"]);
  // Canonical document order (court-order before drivers-license), not insertion order.
  assert.deepEqual(entries[1]!.documentTypes, ["court-order", "drivers-license"]);
});

test("buildJurisdictionFeed flags an entry degraded when any backing record is no longer current", () => {
  const corpus = [
    rec({ id: "fresh", jurisdiction: "US-WA", source: { url: "https://e.gov", title: "T", last_verified: today, verifier: "Pilot Seed Reviewer" } }),
    rec({
      id: "stale",
      jurisdiction: "US-WA",
      document_type: "passport",
      source: { url: "https://e.gov", title: "T", last_verified: today, verifier: "Pilot Seed Reviewer" },
      verification_status: "needs_reverification",
    }),
  ];
  // Both records share `today` as last_verified but one is marked needs_reverification —
  // they land in the SAME entry (same date) and it must read as degraded.
  const entries = buildJurisdictionFeed("US-WA", "en", today, corpus);
  assert.equal(entries.length, 1);
  assert.equal(entries[0]!.degraded, true);
});

test("buildJurisdictionFeed returns no entries for a language the jurisdiction has no records in", () => {
  const corpus = [rec({ id: "a", jurisdiction: "US-WA", language: "en" })];
  assert.deepEqual(buildJurisdictionFeed("US-WA", "es", today, corpus), []);
});

// ── Real-corpus smoke: Washington's 5 EN records currently share one last_verified date ──
test("real corpus: US-WA feed (en) is well-formed RSS naming every current document type", () => {
  const xml = renderJurisdictionFeedXml("US-WA", "Washington", "en", today);
  assertWellFormedXml(xml, "US-WA en feed");
  assert.match(xml, /<rss version="2\.0"/);
  assert.match(xml, /<title>Washington: records updated<\/title>/);
  assert.match(xml, /<item>/, "expects at least one entry");
  assert.match(xml, /records for Washington updated on 2026-07-13/);
  for (const label of ["Court order", "Driver's license", "Birth certificate"]) {
    assert.ok(xml.includes(label), `expected document type "${label}" named in the feed`);
  }
  // Honesty: never claims the LAW changed.
  assert.doesNotMatch(xml, /the law (has |)changed/i);
});

test("real corpus: US-WA feed (es) is well-formed and in Spanish", () => {
  const xml = renderJurisdictionFeedXml("US-WA", "Washington", "es", today);
  assertWellFormedXml(xml, "US-WA es feed");
  assert.match(xml, /<language>es<\/language>/);
  assert.match(xml, /registros actualizados/);
});

test("feed item guid is stable across renders (idempotent for feed readers) and not a permalink", () => {
  const a = renderJurisdictionFeedXml("US-WA", "Washington", "en", today);
  const b = renderJurisdictionFeedXml("US-WA", "Washington", "en", today);
  assert.equal(a, b, "rendering is pure/deterministic given the same corpus + today");
  assert.match(a, /<guid isPermaLink="false">/);
});

test("an empty-in-this-language feed still renders valid, honest XML (no entries silently hidden as an error)", () => {
  const xml = renderJurisdictionFeedXml("US-ZZ", "Nowhere", "en", today, []);
  assertWellFormedXml(xml, "empty feed");
  assert.doesNotMatch(xml, /<item>/);
  assert.match(xml, /don't have any dated records/);
});

test("feedLinkFor resolves a display name from the covered-states list and is undefined for federal", () => {
  const wa = feedLinkFor("US-WA", "en")!;
  assert.equal(wa.href, "/feeds/US-WA.xml");
  assert.equal(wa.stateName, "Washington");
  assert.match(wa.title, /Washington/);
  assert.equal(feedLinkFor("US", "en"), undefined);
});

test("feedPath is the canonical route for a jurisdiction", () => {
  assert.equal(feedPath("US-WA"), "/feeds/US-WA.xml");
});

test("renderFeedsIndex lists every covered state and is indexable", () => {
  const html = renderFeedsIndex("en");
  assert.match(html, /<h1>/);
  assert.match(html, /href="\/feeds\/US-WA\.xml"/);
  assert.doesNotMatch(html, /noindex/);
});

// ── Router integration ─────────────────────────────────────────────────────────────
test("GET /feeds and /feeds/ render the HTML index", () => {
  assert.equal(handleRoute("GET", u("/feeds")).status, 200);
  const r = handleRoute("GET", u("/feeds/"));
  assert.equal(r.status, 200);
  assert.equal(r.contentType, "text/html; charset=utf-8");
});

test("GET /feeds/US-WA.xml renders a real RSS feed with the correct content-type and a bounded log", () => {
  const r = handleRoute("GET", u("/feeds/US-WA.xml"), today);
  assert.equal(r.status, 200);
  assert.equal(r.contentType, "application/rss+xml; charset=utf-8");
  assertWellFormedXml(r.body, "/feeds/US-WA.xml");
  assert.deepEqual(r.log, { event: "feed", fields: { jurisdiction: "US-WA", language: "en", status: 200 } });
});

test("GET /feeds/US-WA.xml?language=es renders the Spanish feed", () => {
  const r = handleRoute("GET", u("/feeds/US-WA.xml?language=es"), today);
  assert.equal(r.status, 200);
  assert.match(r.body, /<language>es<\/language>/);
  assert.equal(r.log?.fields.language, "es");
});

test("an unknown/uncovered jurisdiction 404s and never reflects the input", () => {
  const bogus = "US-ZZ<script>";
  const r = handleRoute("GET", u(`/feeds/${encodeURIComponent(bogus)}.xml`));
  assert.equal(r.status, 404);
  assert.doesNotMatch(r.body, /ZZ/);
  assert.doesNotMatch(r.body, /script/i);
});

test("a well-formed but uncovered US-XX jurisdiction 404s (validated against the corpus, not just the regex shape)", () => {
  // Every real US state/DC is covered by the seed corpus; a fabricated-but-shaped code
  // exercises the "in the corpus" check api/router.ts's plain regex validator can't do.
  assert.equal(handleRoute("GET", u("/feeds/US-ZZ.xml")).status, 404);
});
