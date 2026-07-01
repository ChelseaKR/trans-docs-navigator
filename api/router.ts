// Pure request routing + input hardening, factored out of the HTTP shell (api/server.ts)
// so it is unit-testable and covered by the test gate. Given a method + parsed URL it
// returns a RouteResponse describing exactly what to send — no sockets, no fs, no PII.
//
// SECURITY: all user-controlled inputs are bounded and validated here (jurisdiction
// format, enum filtering, array caps, question length) before they reach retrieval or
// rendering. The PRIVACY INVARIANT holds: only non-identifying query fields are read.

import { buildChecklist, hasThinnerLanguageCoverage } from "./checklist.ts";
import { answer } from "./guidance.ts";
import { loadCorpus } from "./corpus.ts";
import { isCurrent } from "./freshness.ts";
import { formById } from "./forms.ts";
import type { ChangeType, CorpusRecord, DocumentType, Intake, Language } from "./types.ts";
import { renderIntakePage, renderChecklistPage, renderPacketPage, renderFormFillPage } from "../src/pages.ts";
import { renderAnswer, page, uiStrings, escapeHtml, STYLE } from "../src/render.ts";
import { renderTermsPage, renderPrivacyPage, renderAccessibilityPage } from "../src/legal.ts";
import { renderGuideIndex, renderGuidePage, indexablePaths } from "../src/guide.ts";
import { robotsTxt, sitemapXml } from "../src/seo.ts";
import { asLanguage } from "../src/i18n/index.ts";

/** Input bounds — abuse/DoS resistance + predictable resource use. */
export const LIMITS = {
  /** Free-text question chars considered; longer is truncated before tokenizing. */
  questionMaxLen: 2000,
  /** Max repeated change/doc params honoured; excess is ignored. */
  maxArrayItems: 16,
} as const;

const CHANGE_TYPES: readonly ChangeType[] = ["name", "gender-marker"];
const DOCUMENT_TYPES: readonly DocumentType[] = [
  "court-order",
  "ssa-card",
  "drivers-license",
  "passport",
  "birth-certificate",
  "financial-records",
];
const JURISDICTION_RE = /^US(-[A-Z]{2})?$/;

export interface RouteResponse {
  status: number;
  contentType: string;
  body: string;
  /** Extra response headers to merge (e.g. Allow on a 405). */
  headers?: Record<string, string>;
  /** Optional structured log to emit (non-PII fields only). */
  log?: { event: string; fields: Record<string, unknown> };
}

// Language parsing is registry-driven (src/i18n): a new locale needs no router change.
export { asLanguage } from "../src/i18n/index.ts";

/** Well-formed jurisdiction id, or null when the param is malformed (→ 400). */
export function validJurisdiction(v: string | null): string | null {
  if (v === null) return "US-CA"; // default when omitted
  return JURISDICTION_RE.test(v) ? v : null;
}

/** Truncate a free-text question to the input bound (defense against unbounded tokenizing). */
export function sanitizeQuestion(v: string | null): string | undefined {
  if (!v) return undefined;
  return v.length > LIMITS.questionMaxLen ? v.slice(0, LIMITS.questionMaxLen) : v;
}

function changeTypes(url: URL): ChangeType[] {
  return (url.searchParams.getAll("change") as ChangeType[])
    .filter((c) => CHANGE_TYPES.includes(c))
    .slice(0, LIMITS.maxArrayItems);
}
function documents(url: URL): DocumentType[] {
  return (url.searchParams.getAll("doc") as DocumentType[])
    .filter((d) => DOCUMENT_TYPES.includes(d))
    .slice(0, LIMITS.maxArrayItems);
}

/**
 * Rebuild a canonical query string from the parsed intake ONLY. Never echo the raw
 * query string back into a link/page — that reflects arbitrary appended params
 * (including PII-shaped ones) into the response. We emit exactly the known-safe fields.
 */
export function intakeQuery(intake: Intake): string {
  const sp = new URLSearchParams();
  sp.set("jurisdiction", intake.jurisdiction);
  for (const c of intake.change_types) sp.append("change", c);
  for (const d of intake.documents) sp.append("doc", d);
  if (intake.language !== "en") sp.set("language", intake.language);
  return sp.toString();
}

/** Parse the non-PII intake from query params. Returns null when jurisdiction is malformed. */
export function parseIntake(url: URL): Intake | null {
  const jurisdiction = validJurisdiction(url.searchParams.get("jurisdiction"));
  if (jurisdiction === null) return null;
  const ct = changeTypes(url);
  return {
    jurisdiction,
    change_types: ct.length > 0 ? ct : ["name", "gender-marker"],
    documents: documents(url),
    language: asLanguage(url.searchParams.get("language")),
  };
}

const HTML = "text/html; charset=utf-8";
const JSON_CT = "application/json";

/** Result of the readiness probe: overall verdict + per-dependency check detail. */
export interface ReadinessReport {
  ready: boolean;
  checks: Record<string, "ok" | "unavailable">;
}

/**
 * Readiness for the `/readyz` probe — FAIL-CLOSED. The critical dependency here is the
 * legal corpus and its freshness: the service is only "ready" when the corpus loads with
 * ≥1 record AND at least one record is serveable-as-current (within its recheck SLA).
 * If the corpus can't load, is empty, or has zero current records, we are NOT ready —
 * "stale law is broken law", so we return 503 rather than route traffic to stale facts.
 *
 * `load`/`today` are injectable for deterministic tests; production uses the cached corpus
 * loader and the real "as of" date.
 */
export function readiness(opts: { today?: string; load?: () => CorpusRecord[] } = {}): ReadinessReport {
  const load = opts.load ?? (() => loadCorpus());
  let corpus: CorpusRecord[];
  try {
    corpus = load();
  } catch {
    // A throwing corpus dependency is unavailable — never a 500 on a readiness probe.
    return { ready: false, checks: { corpus: "unavailable", freshness: "unavailable" } };
  }
  const checks: Record<string, "ok" | "unavailable"> = {
    corpus: corpus.length > 0 ? "ok" : "unavailable",
    freshness: corpus.some((r) => isCurrent(r, opts.today)) ? "ok" : "unavailable",
  };
  const ready = checks.corpus === "ok" && checks.freshness === "ok";
  return { ready, checks };
}

function badRequest(lang: Language): RouteResponse {
  const t = uiStrings(lang);
  return {
    status: 400,
    contentType: HTML,
    body: page({ lang, title: t.badRequestHeading, heading: t.badRequestHeading, body: `<p>${escapeHtml(t.badRequestBody)}</p><p><a href="/">${escapeHtml(t.backToStart)}</a></p>` }),
    log: { event: "bad_request", fields: { status: 400 } },
  };
}

function notFound(lang: Language): RouteResponse {
  const t = uiStrings(lang);
  return {
    status: 404,
    contentType: HTML,
    body: page({ lang, title: t.notFoundHeading, heading: t.notFoundHeading, body: `<p>${escapeHtml(t.notFoundBody)}</p><p><a href="/">${escapeHtml(t.backToStart)}</a></p>` }),
  };
}

/**
 * Resolve a dynamic route. Static files and the HTTP plumbing live in server.ts;
 * `today` is injectable for deterministic tests.
 */
export function handleRoute(method: string, url: URL, today?: string): RouteResponse {
  const lang = asLanguage(url.searchParams.get("language"));
  if (method !== "GET" && method !== "HEAD") {
    const t = uiStrings(lang);
    return {
      status: 405,
      contentType: HTML,
      headers: { allow: "GET, HEAD" }, // HTTP requires Allow on a 405
      body: page({ lang, title: t.methodHeading, heading: t.methodHeading, body: `<p>${escapeHtml(t.methodBody)}</p>` }),
      log: { event: "method_not_allowed", fields: { method, status: 405 } },
    };
  }

  const p = url.pathname;

  // The app stylesheet derives from the typed PALETTE in src/render.ts, so it is
  // served from code rather than duplicated on disk. Static JS lives in public/assets.
  if (p === "/assets/app.css") {
    return { status: 200, contentType: "text/css; charset=utf-8", body: STYLE };
  }

  // Crawler files (generated from the route set, so they can't go stale).
  if (p === "/robots.txt") {
    return { status: 200, contentType: "text/plain; charset=utf-8", body: robotsTxt() };
  }
  if (p === "/sitemap.xml") {
    return { status: 200, contentType: "application/xml; charset=utf-8", body: sitemapXml(indexablePaths()) };
  }

  if (p === "/healthz") {
    return {
      status: 200,
      contentType: JSON_CT,
      body: JSON.stringify({ status: "ok", corpus_records: loadCorpus().length }),
    };
  }

  // Liveness (K8s probe contract, OBSERVABILITY-STANDARD §6): the process is alive and
  // not deadlocked. NO dependency calls — must stay trivially fast and never flap on a
  // slow/absent dependency.
  if (p === "/livez") {
    return { status: 200, contentType: JSON_CT, body: JSON.stringify({ status: "ok" }) };
  }

  // Readiness (K8s probe contract, OBSERVABILITY-STANDARD §6): ready for traffic INCLUDING
  // the critical dependency check. Fail-closed 503 when the corpus/freshness dependency is
  // unavailable, so a not-ready instance is pulled from rotation instead of serving stale law.
  if (p === "/readyz") {
    const report = readiness({ today });
    return {
      status: report.ready ? 200 : 503,
      contentType: JSON_CT,
      body: JSON.stringify({ status: report.ready ? "ok" : "unavailable", checks: report.checks }),
    };
  }

  if (p === "/") {
    return { status: 200, contentType: HTML, body: renderIntakePage(asLanguage(url.searchParams.get("language"))) };
  }

  // Static legal / policy pages (linked from every footer).
  if (p === "/terms" || p === "/privacy" || p === "/accessibility") {
    const lang = asLanguage(url.searchParams.get("language"));
    const render = p === "/terms" ? renderTermsPage : p === "/privacy" ? renderPrivacyPage : renderAccessibilityPage;
    return { status: 200, contentType: HTML, body: render(lang) };
  }

  // Indexable guide content surface (docs/SEO-PLAN.md Phase 2).
  if (p === "/guide") {
    return { status: 200, contentType: HTML, body: renderGuideIndex(lang) };
  }
  if (p.startsWith("/guide/")) {
    const [, , stateSlug, topicSlug, ...rest] = p.split("/");
    if (!stateSlug || !topicSlug || rest.length > 0) return notFound(lang);
    const html = renderGuidePage(stateSlug, topicSlug, lang);
    if (html === null) return notFound(lang);
    return {
      status: 200,
      contentType: HTML,
      body: html,
      log: { event: "guide", fields: { state: stateSlug, topic: topicSlug, language: lang, status: 200 } },
    };
  }

  if (p === "/checklist") {
    const intake = parseIntake(url);
    if (!intake) return badRequest(lang);
    const checklist = buildChecklist(intake, today);
    const thinnerCoverage = hasThinnerLanguageCoverage(intake, today);
    return {
      status: 200,
      contentType: HTML,
      body: renderChecklistPage(checklist, loadCorpus(), intake.language, intakeQuery(intake), { thinnerCoverage }),
      log: { event: "checklist", fields: { jurisdiction: intake.jurisdiction, change_types: intake.change_types, documents: intake.documents, language: intake.language, status: 200 } },
    };
  }

  if (p === "/packet") {
    const intake = parseIntake(url);
    if (!intake) return badRequest(lang);
    const checklist = buildChecklist(intake, today);
    const generatedOn = (today ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
    return {
      status: 200,
      contentType: HTML,
      body: renderPacketPage(checklist, loadCorpus(), intake.language, generatedOn),
      log: { event: "packet", fields: { jurisdiction: intake.jurisdiction, language: intake.language, status: 200 } },
    };
  }

  if (p === "/answer") {
    const jurisdiction = validJurisdiction(url.searchParams.get("jurisdiction"));
    if (jurisdiction === null) return badRequest(lang);
    const t = uiStrings(lang);
    const result = answer({
      jurisdiction,
      change_types: changeTypes(url),
      documents: documents(url),
      question: sanitizeQuestion(url.searchParams.get("q")),
      language: lang,
      today,
    });
    // Non-PII observability counters (OPERATIONS alarms): how many claims were served,
    // and whether any stale/volatile record was surfaced as "needs reverification".
    const claims = result.blocks.filter((b) => b.kind === "claim").length;
    const degraded = result.blocks.some((b) => b.kind === "freshness");
    // Always give a way forward (no dead-end): back to the checklist for the same query,
    // or start over. Preserves the non-PII query so the user lands back where they were.
    const back = intakeQuery({ jurisdiction, change_types: changeTypes(url), documents: documents(url), language: lang });
    const actions = `<p class="no-print"><a href="/checklist?${back}">← ${escapeHtml(t.backToChecklist)}</a> · <a href="/">${escapeHtml(t.backToStart)}</a></p>`;
    return {
      status: 200,
      contentType: HTML,
      body: page({ lang, title: t.answerHeading, heading: t.answerHeading, body: renderAnswer(result, lang) + actions }),
      log: { event: "answer", fields: { jurisdiction, refused: result.refused, claims, degraded, status: 200 } },
    };
  }

  if (p.startsWith("/forms/") && !p.startsWith("/forms/fixtures/")) {
    const form = formById(p.slice("/forms/".length));
    if (!form) return notFound(lang);
    return { status: 200, contentType: HTML, body: renderFormFillPage(form, lang) };
  }

  return { ...notFound(lang), log: { event: "not_found", fields: { route: p, status: 404 } } };
}
