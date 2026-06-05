import { test } from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, page, renderChecklist, renderAnswer, uiStrings, PALETTE } from "../src/render.ts";
import type { Checklist, GroundedAnswer, CorpusRecord } from "../api/types.ts";

test("escapeHtml neutralizes every HTML-significant character", () => {
  assert.equal(escapeHtml(`<script>&"'`), "&lt;script&gt;&amp;&quot;&#39;");
  assert.equal(escapeHtml("plain"), "plain");
});

test("page wraps body with lang, skip link, banner disclosure, and main landmark", () => {
  const h = page({ lang: "en", title: "T", heading: "H", body: "<p>hi</p>" });
  assert.match(h, /^<!doctype html>/);
  assert.match(h, /<html lang="en">/);
  assert.match(h, /class="skip" href="#main"/);
  assert.match(h, /id="main"/);
  assert.match(h, /Information, not legal advice/);
});

test("page escapes a hostile title (XSS defense)", () => {
  const h = page({ lang: "en", title: '</title><script>alert(1)</script>', heading: "H", body: "" });
  assert.doesNotMatch(h, /<script>alert\(1\)/);
  assert.match(h, /&lt;script&gt;/);
});

const rec = (over: Partial<CorpusRecord> = {}): CorpusRecord => ({
  id: "ca.court-order.name",
  jurisdiction: "US-CA",
  document_type: "court-order",
  change_type: ["name"],
  topic: "name change",
  statement: "File a Petition for Change of Name in superior court.",
  source: { url: "https://x.gov", title: "CA Courts", last_verified: "2026-05-31", verifier: "Pilot Seed Reviewer" },
  verification_status: "verified",
  recheck_sla_days: 90,
  language: "en",
  ...over,
});

test("renderChecklist escapes record statements and lists sources", () => {
  const records = [rec({ statement: "Watch out for <b>this</b> & that." })];
  const checklist: Checklist = {
    jurisdiction: "US-CA",
    change_types: ["name"],
    language: "en",
    steps: [{ key: "court-order", order: 1, document_type: "court-order", title: "Court order", record_ids: ["ca.court-order.name"], prerequisites: [], discretionary: false, needs_reverification: false }],
    gaps: [],
  };
  const h = renderChecklist(checklist, records, "en");
  assert.match(h, /&lt;b&gt;this&lt;\/b&gt;/); // escaped, not rendered
  assert.match(h, /CA Courts/);
  assert.match(h, /rel="noopener noreferrer"/);
});

test("renderAnswer marks freshness/uncertainty as flags and lists cited sources", () => {
  const ans: GroundedAnswer = {
    blocks: [
      { kind: "claim", citations: ["ca.court-order.name"], text: "Do the thing." },
      { kind: "uncertainty", citations: [], text: "Varies by court." },
      { kind: "freshness", citations: [], text: "Needs reverification." },
      { kind: "boilerplate", citations: [], text: "Info, not legal advice." },
    ],
    cited_records: [rec()],
    refused: false,
  };
  const h = renderAnswer(ans, "en");
  assert.match(h, /class="flag">Varies by court/);
  assert.match(h, /class="flag">Needs reverification/);
  assert.match(h, /class="meta">Info, not legal advice/);
  assert.match(h, /CA Courts/);
});

test("uiStrings differ by language", () => {
  assert.notEqual(uiStrings("en").bannerTitle, uiStrings("es").bannerTitle);
  assert.match(uiStrings("es").private, /Modo privado/);
});

test("PALETTE exposes screen and print themes used by the contrast gate", () => {
  assert.equal(PALETTE.screen.bg, "#0f1419");
  assert.equal(PALETTE.print.bg, "#ffffff");
});
