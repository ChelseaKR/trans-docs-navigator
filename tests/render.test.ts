import { test } from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, page, renderChecklist, renderAnswer, uiStrings, PALETTE, reportErrorHref, reportErrorLinksEnabled } from "../src/render.ts";
import type { Checklist, Cost, GroundedAnswer, CorpusRecord } from "../api/types.ts";

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

// ── Fee-waiver detail on a checklist step ───────────────────────────────────────────────
// GOVERNANCE.md: this app surfaces what the court publishes — the form, the court's own
// words — and never adjudicates eligibility. These tests pin the four honest shapes: form +
// criteria, form only (criteria not stated by the source), criteria only (no confirmed
// form), and neither (no waiver detail rendered at all).

function waiverChecklist(cost: Cost): { checklist: Checklist; records: CorpusRecord[] } {
  const records = [rec({ cost })];
  const checklist: Checklist = {
    jurisdiction: "US-CA",
    change_types: ["name"],
    language: "en",
    steps: [
      {
        key: "court-order",
        order: 1,
        document_type: "court-order",
        title: "Court order",
        record_ids: ["ca.court-order.name"],
        prerequisites: [],
        cost,
        discretionary: false,
        needs_reverification: false,
      },
    ],
    gaps: [],
  };
  return { checklist, records };
}

test("fee-waiver detail: form + criteria both render, with a live link to the official form", () => {
  const { checklist, records } = waiverChecklist({
    amount_usd: null,
    fee_waiver: true,
    fee_waiver_form: "ca-fw-001",
    fee_waiver_criteria: "You only need to meet 1 of these to qualify.",
  });
  const h = renderChecklist(checklist, records, "en");
  assert.match(h, /This fee can be waived\./);
  assert.match(h, /<a href="\/forms\/ca-fw-001">Form FW-001 — Request to Waive Court Fees<\/a>/);
  assert.match(h, /The court says: &quot;You only need to meet 1 of these to qualify\.&quot;/);
});

test("fee-waiver detail: form sourced, criteria not stated — says so, never guesses", () => {
  const { checklist, records } = waiverChecklist({
    amount_usd: null,
    fee_waiver: true,
    fee_waiver_form: "ca-fw-001",
  });
  const h = renderChecklist(checklist, records, "en");
  assert.match(h, /This fee can be waived\./);
  assert.match(h, /Form FW-001/);
  assert.match(h, /publish specific criteria/);
});

test("fee-waiver detail: criteria sourced but no confirmed form (e.g. Rhode Island) — criteria only, no form line", () => {
  const { checklist, records } = waiverChecklist({
    amount_usd: null,
    fee_waiver: true,
    fee_waiver_criteria: "The court costs may be waived or reduced for an indigent petitioner.",
  });
  const h = renderChecklist(checklist, records, "en");
  assert.match(h, /This fee can be waived\./);
  assert.match(h, /The court says:/);
  assert.doesNotMatch(h, /Form:/);
});

test("fee-waiver detail: neither form nor criteria sourced — no waiver detail line at all", () => {
  const { checklist, records } = waiverChecklist({
    amount_usd: null,
    note: "A fee waiver is available if you qualify.",
    fee_waiver: true,
  });
  const h = renderChecklist(checklist, records, "en");
  assert.doesNotMatch(h, /This fee can be waived/);
});

test("fee-waiver detail: never renders for a step with no fee_waiver at all", () => {
  const { checklist, records } = waiverChecklist({ amount_usd: 100 });
  const h = renderChecklist(checklist, records, "en");
  assert.doesNotMatch(h, /This fee can be waived/);
  assert.doesNotMatch(h, /fee-waiver/);
});

test("fee-waiver detail never renders an eligibility prediction — the line this app is forbidden to cross", () => {
  const { checklist, records } = waiverChecklist({
    amount_usd: null,
    fee_waiver: true,
    fee_waiver_form: "ca-fw-001",
    fee_waiver_criteria: "You only need to meet 1 of these to qualify.",
  });
  const h = renderChecklist(checklist, records, "en");
  assert.doesNotMatch(h, /you (likely|probably) qualify/i);
  assert.doesNotMatch(h, /you (likely|probably) (do not|don't) need to pay/i);
});

test("fee-waiver detail renders fully in Spanish too (parity)", () => {
  const records = [rec({ language: "es" })];
  const checklist: Checklist = {
    jurisdiction: "US-CA",
    change_types: ["name"],
    language: "es",
    steps: [
      {
        key: "court-order",
        order: 1,
        document_type: "court-order",
        title: "Court order",
        record_ids: ["ca.court-order.name"],
        prerequisites: [],
        cost: {
          amount_usd: null,
          fee_waiver: true,
          fee_waiver_form: "ca-fw-001",
          fee_waiver_criteria: "Solo necesita cumplir 1 de estos requisitos para calificar.",
        },
        discretionary: false,
        needs_reverification: false,
      },
    ],
    gaps: [],
  };
  const h = renderChecklist(checklist, records, "es");
  assert.match(h, /Esta tarifa se puede exentar\./);
  assert.match(h, /Formulario: <a href="\/forms\/ca-fw-001\?language=es">/);
  assert.match(h, /La corte dice: &quot;Solo necesita cumplir 1 de estos requisitos para calificar\.&quot;/);
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

// --- Per-step "report an error / law changed" link (C1) ---

const reportChecklist = (): Checklist => ({
  jurisdiction: "US-CA",
  change_types: ["name"],
  language: "en",
  steps: [{ key: "court-order", order: 1, document_type: "court-order", title: "Court order", record_ids: ["ca.court-order.name"], prerequisites: [], discretionary: false, needs_reverification: false }],
  gaps: [],
});

test("reportErrorHref carries jurisdiction + document type only, fully encoded", () => {
  const href = reportErrorHref("US-CA", "court-order");
  const url = new URL(href);
  assert.equal(url.origin + url.pathname, "https://github.com/ChelseaKR/trans-docs-navigator/issues/new");
  assert.deepEqual([...url.searchParams.keys()].sort(), ["template", "title"]);
  assert.equal(url.searchParams.get("template"), "law-changed.md");
  assert.equal(url.searchParams.get("title"), "[law-changed] US-CA · court-order");
  // No raw spaces/middots leak into the serialized URL (everything URL-encoded).
  assert.doesNotMatch(href, /[ ·]/);
});

test("reportErrorLinksEnabled is fail-closed: off unless REPORT_ERROR_LINKS=on", () => {
  assert.equal(reportErrorLinksEnabled({} as NodeJS.ProcessEnv), false);
  assert.equal(reportErrorLinksEnabled({ REPORT_ERROR_LINKS: "true" } as NodeJS.ProcessEnv), false);
  assert.equal(reportErrorLinksEnabled({ REPORT_ERROR_LINKS: "on" } as NodeJS.ProcessEnv), true);
});

test("report-an-error link does NOT render by default (repo is private; flag off)", () => {
  delete process.env.REPORT_ERROR_LINKS;
  const h = renderChecklist(reportChecklist(), [rec()], "en");
  assert.doesNotMatch(h, /step-report/);
  assert.doesNotMatch(h, /issues\/new/);
});

test("report-an-error link renders with escaping, noopener, and destination disclosure when enabled", () => {
  process.env.REPORT_ERROR_LINKS = "on";
  try {
    const h = renderChecklist(reportChecklist(), [rec()], "en");
    assert.match(h, /class="step-report meta no-print"/);
    // Href is escaped per repo convention: the literal & joins as &amp; in the attribute.
    assert.match(h, /template=law-changed\.md&amp;title=/);
    // Screen-only (never in the printed packet surface) and safe against reverse-tabnabbing.
    const m = h.match(/<p class="step-report[^]*?<\/p>/);
    assert.ok(m, "report link block rendered");
    assert.match(m![0], /rel="noopener noreferrer"/);
    // The destination disclosure is structurally inseparable from the link.
    assert.match(m![0], /Reports are public and need a GitHub account/);
  } finally {
    delete process.env.REPORT_ERROR_LINKS;
  }
});

// ── Unwatchable-source disclosure (issue #117) ─────────────────────────────────
// A "last checked <date>" on a source under drift watch means a machine re-reads that
// page and a gate goes red when it changes. On a source that returns 403 to this
// project's declared user-agent it means only that a human once read it. Rendering both
// identically hands a reader a guarantee that does not exist, before a legal filing.
test("a source that cannot be drift-watched renders an explicit note, in both languages", () => {
  const unwatched: CorpusRecord = {
    id: "ny.court-order.name",
    jurisdiction: "US-NY",
    document_type: "court-order",
    change_type: ["name"],
    topic: "t",
    statement: "long enough statement here",
    // The real 403 source, from corpus/snapshots/index.json.
    source: {
      url: "https://www.nycourts.gov/courthelp/Family/nameChange.shtml",
      title: "NY Courts",
      last_verified: "2026-07-13",
      verifier: "A",
    },
    verification_status: "verified",
    recheck_sla_days: 90,
    language: "en",
  };
  const answer: GroundedAnswer = {
    blocks: [{ kind: "claim", text: "Do the thing.", citations: [unwatched.id] }],
    cited_records: [unwatched],
    refused: false,
  };

  const en = renderAnswer(answer, "en");
  // Caption framing comes from verificationCaption (#118): a placeholder verifier
  // reads "recorded <date> · not yet verified by a named reviewer", never "verified by".
  assert.match(en, /recorded 2026-07-13/);
  assert.match(en, /We cannot check this source automatically for changes/);

  const es = renderAnswer(answer, "es");
  assert.match(es, /No podemos revisar esta fuente automáticamente/);
});

test("a watched source renders the date with no unwatchable note", () => {
  const watched: CorpusRecord = {
    id: "ca.court-order.name",
    jurisdiction: "US-CA",
    document_type: "court-order",
    change_type: ["name"],
    topic: "t",
    statement: "long enough statement here",
    source: {
      url: "https://selfhelp.courts.ca.gov/name-change",
      title: "CA Courts",
      last_verified: "2026-07-13",
      verifier: "A",
    },
    verification_status: "verified",
    recheck_sla_days: 90,
    language: "en",
  };
  const answer: GroundedAnswer = {
    blocks: [{ kind: "claim", text: "Do the other thing.", citations: [watched.id] }],
    cited_records: [watched],
    refused: false,
  };
  const en = renderAnswer(answer, "en");
  assert.match(en, /recorded 2026-07-13/);
  assert.doesNotMatch(en, /cannot check this source automatically/);
});
