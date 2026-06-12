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
import { formById } from "./forms.ts";
import type { ChangeType, DocumentType, Intake, Language } from "./types.ts";
import { renderIntakePage, renderChecklistPage, renderPacketPage, renderFormFillPage } from "../src/pages.ts";
import { renderAnswer, page, uiStrings, escapeHtml } from "../src/render.ts";
import { renderTermsPage, renderPrivacyPage, renderAccessibilityPage } from "../src/legal.ts";

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

export function asLanguage(v: string | null): Language {
  return v === "es" ? "es" : "en";
}

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

  if (p === "/healthz") {
    return {
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: "ok", corpus_records: loadCorpus().length }),
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
