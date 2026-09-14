// Pure request routing + input hardening, factored out of the HTTP shell (api/server.ts)
// so it is unit-testable and covered by the test gate. Given a method + parsed URL it
// returns a RouteResponse describing exactly what to send — no sockets or filesystem I/O.
//
// SECURITY: all user-controlled inputs are bounded and validated here (jurisdiction
// format, enum filtering, array caps, question length) before they reach retrieval or
// rendering. Checklist selections and optional question text are server inputs; direct
// identity-form fields are not read. See the Privacy Notice for cache/log boundaries.

import { buildChecklist, hasThinnerLanguageCoverage, hasNoStateCoverage, hasNoMinorCoverage } from "./checklist.ts";
import { buildPacketChanges, parseSince } from "./changes.ts";
import { buildRelocationPlan } from "./relocation.ts";
import { buildCompareTable, COMPARE_JURISDICTIONS } from "./compare.ts";
import { answer } from "./guidance.ts";
import { loadCorpus } from "./corpus.ts";
import { isCurrent, servingToday } from "./freshness.ts";
import { healthHorizon } from "./horizon.ts";
import { formById } from "./forms.ts";
import { isKnownJurisdiction } from "./feed.ts";
import { memoize } from "./cache.ts";
import type { ChangeType, CorpusRecord, DocumentType, Intake, JurisdictionId, Language, RelocationIntake } from "./types.ts";
import { renderIntakePage, renderChecklistPage, renderPacketPage, renderChangesPage, renderFormFillPage, renderOfflinePage } from "../src/pages.ts";
import { renderMovePage, renderPlanPage } from "../src/relocation.ts";
import { renderCompareFormPage, renderCompareResultsPage, type CompareSort } from "../src/compare.ts";
import { renderAnswer, page, uiStrings, escapeHtml, STYLE } from "../src/render.ts";
import { renderTermsPage, renderPrivacyPage, renderAccessibilityPage, renderMethodologyPage } from "../src/legal.ts";
import { renderTransparencyPage } from "../src/transparency.ts";
import { renderGuideIndex, renderGuidePage, indexablePaths, stateNameFor } from "../src/guide.ts";
import { renderFeedsIndex, renderJurisdictionFeedXml } from "../src/feeds.ts";
import { robotsTxt, sitemapXml } from "../src/seo.ts";
import { asLanguage } from "../src/i18n/index.ts";
import { serviceWorkerScript } from "../src/offline.ts";
import { metricMethod, metricRoute, renderPrometheusMetrics } from "./metrics.ts";
import {
  API_PREFIX,
  API_VERSION,
  getChecklist,
  getCorpus,
  getJurisdiction,
  getJurisdictions,
  getReferrals,
} from "./public-api.ts";
import { buildInfo } from "./version.ts";

/** Input bounds — abuse/DoS resistance + predictable resource use. */
export const LIMITS = {
  /** Free-text question chars considered; longer is truncated before tokenizing. */
  questionMaxLen: 2000,
  /** Max repeated change/doc params honoured; excess is ignored. */
  maxArrayItems: 16,
} as const;

// Exported so the published JSON Schemas (scripts/api-schemas.ts) enumerate exactly what
// this router accepts. Two hand-kept copies of an enum is how a schema starts promising a
// value the service rejects; tests/public-api.test.ts pins them to each other.
export const CHANGE_TYPES: readonly ChangeType[] = ["name", "gender-marker"];
export const DOCUMENT_TYPES: readonly DocumentType[] = [
  "court-order",
  "ssa-card",
  "drivers-license",
  "passport",
  "birth-certificate",
  "financial-records",
  "green-card",
  "naturalization-certificate",
  "ead",
  "selective-service",
  "military-records",
  "trusted-traveler",
  "federal-employment-records",
];
const JURISDICTION_RE = /^US(-[A-Z]{2})?$/;

export interface RouteResponse {
  status: number;
  contentType: string;
  body: string;
  /** Extra response headers to merge (e.g. Allow on a 405). */
  headers?: Record<string, string>;
  /** Optional structured log descriptor (bounded allowlisted metadata only). */
  log?: { event: string; fields: Record<string, unknown> };
}

// Language parsing is registry-driven (src/i18n): a new locale needs no router change.
export { asLanguage } from "../src/i18n/index.ts";

/**
 * Read the requested language, accepting `?lang=` as an alias for the canonical
 * `?language=`. `lang` is the more common convention elsewhere on the web, so a typed
 * or shared link built from muscle memory (`?lang=es`) would otherwise silently fall
 * back to English instead of erroring or honoring the intent — the kind of quiet
 * failure this project avoids elsewhere (see the coverage/freshness banners). Every
 * generated link on the site still emits `?language=` (`intakeQuery` above); this only
 * widens what's *accepted* on the way in, so it never affects cache keys or the URLs
 * this app itself builds.
 */
export function languageParam(url: URL): string | null {
  return url.searchParams.get("language") ?? url.searchParams.get("lang");
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
 * (including identity-shaped ones) into the response. We emit exactly the canonical
 * selection fields; those can still be sensitive and are covered by the Privacy Notice.
 */
export function intakeQuery(intake: Intake): string {
  const sp = new URLSearchParams();
  sp.set("jurisdiction", intake.jurisdiction);
  for (const c of intake.change_types) sp.append("change", c);
  for (const d of intake.documents) sp.append("doc", d);
  if (intake.language !== "en") sp.set("language", intake.language);
  if (intake.has_court_order) sp.set("court_order", "1");
  if (intake.for_minor) sp.set("for_minor", "1");
  return sp.toString();
}

/**
 * Parse a relocation intake. Same bounded-enum discipline as parseIntake: two jurisdiction
 * ids, a capped document list, change types, language. Nothing free-text, no identity fields.
 *
 * Returns `null` for a malformed jurisdiction (→ 400) and `"same-state"` when origin equals
 * destination — there is no delta to compute, and re-rendering the intake with a message is
 * kinder than a 400.
 */
export function parseRelocationIntake(url: URL): RelocationIntake | null | "same-state" {
  const origin = url.searchParams.get("origin");
  const destination = url.searchParams.get("destination");
  if (origin === null || destination === null) return null;
  if (!JURISDICTION_RE.test(origin) || !JURISDICTION_RE.test(destination)) return null;
  if (origin === destination) return "same-state";

  const held = (url.searchParams.getAll("hold") as DocumentType[])
    .filter((d) => DOCUMENT_TYPES.includes(d))
    .slice(0, LIMITS.maxArrayItems);
  const ct = changeTypes(url);
  const forMinor = url.searchParams.get("for_minor") === "1";
  return {
    origin,
    destination,
    held,
    change_types: ct.length > 0 ? ct : ["name", "gender-marker"],
    language: asLanguage(languageParam(url)),
    ...(forMinor ? { for_minor: true } : {}),
  };
}

/** Parse bounded checklist selections from query params. Returns null when jurisdiction is malformed. */
export function parseIntake(url: URL): Intake | null {
  const jurisdiction = validJurisdiction(url.searchParams.get("jurisdiction"));
  if (jurisdiction === null) return null;
  const ct = changeTypes(url);
  // Same privacy class as change_types (a single selection-only bit; see docs/audits/dpia.md) —
  // bookkeeping only, used to annotate the court-order step done and prune it as a prerequisite.
  const hasCourtOrder = url.searchParams.get("court_order") === "1";
  // Minors pilot: same privacy class again — a single selection-only bit, read by
  // retrieval (api/retrieval.ts selectAudience) and the coverage-honesty note
  // (api/checklist.ts hasNoMinorCoverage), never an identity field.
  const forMinor = url.searchParams.get("for_minor") === "1";
  return {
    jurisdiction,
    change_types: ct.length > 0 ? ct : ["name", "gender-marker"],
    documents: documents(url),
    language: asLanguage(languageParam(url)),
    ...(hasCourtOrder ? { has_court_order: true } : {}),
    ...(forMinor ? { for_minor: true } : {}),
  };
}

/**
 * Parsed input for the "which state?" comparison (/compare). `wantsResults` is true the
 * moment either `doc` or `change` appears on the query string at all — even if every
 * value on it fails enum validation — so a form submission with a request that turns
 * out empty still renders results (buildCompareTable defaults an empty list, the same
 * way buildChecklist/buildRelocationPlan default an empty one), and only a genuinely
 * bare `/compare` (or a submission with every checkbox left unchecked, which a browser
 * sends as no params at all) shows the form. `current` is optional and cosmetic — a
 * shape-invalid or unrecognized value is simply never displayed (see src/compare.ts),
 * never rejected with a 400 and never reflected back into the page.
 */
export interface CompareQuery {
  wantsResults: boolean;
  documents: DocumentType[];
  change_types: ChangeType[];
  current?: JurisdictionId;
  sort: CompareSort;
  language: Language;
}

export function parseCompareInput(url: URL): CompareQuery {
  const rawCurrent = url.searchParams.get("current");
  const current = rawCurrent && JURISDICTION_RE.test(rawCurrent) ? rawCurrent : undefined;
  return {
    wantsResults: url.searchParams.has("doc") || url.searchParams.has("change"),
    documents: documents(url),
    change_types: changeTypes(url),
    ...(current ? { current } : {}),
    sort: url.searchParams.get("sort") === "count" ? "count" : "alpha",
    language: asLanguage(languageParam(url)),
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
export function readiness(opts: { today?: string | undefined; load?: (() => CorpusRecord[]) | undefined } = {}): ReadinessReport {
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

// --- Render caching (IP §5.2) ---------------------------------------------------
// Both caches key on bounded enum/date fields only (jurisdiction, change/doc enums,
// language, the injectable `today`) — never on free text — so cache keys carry the
// same no-direct-identity-field guarantee as the rest of the router. These selections
// can still be sensitive; they are a subset of what already flows into URLs and logs.
// A corpus edit on disk clears both via api/cache.ts's clearAllCaches() (see api/corpus.ts).

interface ChecklistCacheKey {
  intake: Intake;
  today: string | undefined;
  thinnerCoverage: boolean;
}

/** Canonical checklist cache key: (jurisdiction × change × doc × language) + today + coverage flag. */
function checklistCacheKeyOf(k: ChecklistCacheKey): string {
  return `${intakeQuery(k.intake)}|${k.today ?? ""}|${k.thinnerCoverage}`;
}

// The rendered checklist page is pure given (intake, today, thinnerCoverage) — cache it.
const cachedChecklistPage = memoize<ChecklistCacheKey, string>(
  // `noStateCoverage` is derived INSIDE the builder rather than added to the cache key:
  // it is a pure function of the jurisdiction, which intakeQuery() already puts in the key.
  (k) =>
    renderChecklistPage(buildChecklist(k.intake, k.today), loadCorpus(), k.intake.language, intakeQuery(k.intake), {
      thinnerCoverage: k.thinnerCoverage,
      noStateCoverage: hasNoStateCoverage(k.intake.jurisdiction),
      // Pure function of (jurisdiction, for_minor) — both already inside intakeQuery(k.intake),
      // which is part of the cache key, so no separate key field is needed (same reasoning
      // as noStateCoverage just above).
      noMinorCoverage: k.intake.for_minor === true && hasNoMinorCoverage(k.intake.jurisdiction),
    }),
  { keyOf: checklistCacheKeyOf },
);

interface AnswerKey {
  jurisdiction: string;
  change_types: ChangeType[];
  documents: DocumentType[];
  language: Language;
  today: string | undefined;
  for_minor: boolean;
}

interface AnswerCacheValue {
  body: string;
  refused: boolean;
  /** Observability counters, stored alongside the cached body so the safe-log call still
   *  fires with real numbers on a cache hit (OPERATIONS alarms must not go blind to hits). */
  claims: number;
  degraded: boolean;
}

function answerCacheKeyOf(k: AnswerKey): string {
  const sp = new URLSearchParams();
  sp.set("jurisdiction", k.jurisdiction);
  for (const c of [...k.change_types].sort()) sp.append("change", c);
  for (const d of [...k.documents].sort()) sp.append("doc", d);
  sp.set("language", k.language);
  sp.set("today", k.today ?? "");
  sp.set("for_minor", String(k.for_minor));
  return sp.toString();
}

/** Compute the full `/answer` response. Shared by the cached (no free-text `q`) and
 *  uncached (a `q` was supplied) paths so caching never changes the answer logic itself. */
function buildAnswerValue(
  jurisdiction: string,
  change_types: ChangeType[],
  documents: DocumentType[],
  language: Language,
  today: string | undefined,
  question: string | undefined,
  for_minor: boolean,
): AnswerCacheValue {
  const t = uiStrings(language);
  const result = answer({ jurisdiction, change_types, documents, question, language, today, for_minor });
  const claims = result.blocks.filter((b) => b.kind === "claim").length;
  const degraded = result.blocks.some((b) => b.kind === "freshness");
  // Always give a way forward (no dead-end): back to the checklist for the same query,
  // or start over. Preserves the canonical selection query so the user lands back where they were.
  const back = intakeQuery({ jurisdiction, change_types, documents, language, ...(for_minor ? { for_minor: true } : {}) });
  const actions = `<p class="no-print"><a href="/checklist?${back}">← ${escapeHtml(t.backToChecklist)}</a> · <a href="/">${escapeHtml(t.backToStart)}</a></p>`;
  const body = page({ lang: language, title: t.answerHeading, heading: t.answerHeading, body: renderAnswer(result, language) + actions });
  return { body, refused: result.refused, claims, degraded };
}

// Only cache the free-text-free "common (jurisdiction × change-type)" combos the roadmap
// item names — a `q` present means we skip the cache entirely (see the /answer route).
const cachedAnswer = memoize<AnswerKey, AnswerCacheValue>(
  (k) => buildAnswerValue(k.jurisdiction, k.change_types, k.documents, k.language, k.today, undefined, k.for_minor),
  { keyOf: answerCacheKeyOf },
);

function notFound(lang: Language): RouteResponse {
  const t = uiStrings(lang);
  return {
    status: 404,
    contentType: HTML,
    body: page({ lang, title: t.notFoundHeading, heading: t.notFoundHeading, body: `<p>${escapeHtml(t.notFoundBody)}</p><p><a href="/">${escapeHtml(t.backToStart)}</a></p>` }),
  };
}

// ── Partner read-API dispatch (api/public-api.ts, #232) ────────────────────────────────
//
// Separate from the HTML routes for two reasons. It must never fall through to an HTML
// 404 page — a consumer parsing JSON would then try to parse a document — and its errors
// must be machine-readable. Both error shapes below are FIXED strings: nothing from the
// request is copied into a response, so the non-reflection guarantee
// (tests/privacy-egress.test.ts) holds on these routes exactly as it does on the pages.

const JSON_INDENT = 2;

function apiJson(status: number, value: unknown, log?: RouteResponse["log"]): RouteResponse {
  return {
    status,
    contentType: JSON_CT,
    body: JSON.stringify(value, null, JSON_INDENT),
    ...(log ? { log } : {}),
  };
}

/** A machine-readable API error. `message` is a constant — never an echo of the input. */
function apiError(status: number, code: string, message: string): RouteResponse {
  return apiJson(status, { api_version: API_VERSION, error: { code, message } }, {
    event: "api_error",
    fields: { route: metricRoute("/api/v1"), status },
  });
}

/**
 * Read a language filter for the API. Unlike the HTML routes — where `asLanguage` falls back
 * to English so a page always renders — an UNRECOGNIZED value here returns null so the caller
 * can 400. A partner that asks for a locale we do not have must be told so, not silently
 * handed English rows and left to publish them as that locale's coverage.
 */
function apiLanguage(url: URL): Language | null | undefined {
  const raw = languageParam(url);
  if (raw === null) return undefined; // absent = no filter
  return raw === "en" || raw === "es" ? raw : null;
}

function apiRoute(p: string, url: URL, today?: string): RouteResponse {
  const rest = p.slice(API_PREFIX.length).replace(/^\/+/, "").replace(/\/+$/, "");
  const segments = rest === "" ? [] : rest.split("/");
  const lang = apiLanguage(url);
  if (lang === null) {
    return apiError(400, "unsupported_language", "Supported values for `language` are: en, es.");
  }

  // /api/v1/corpus — every record, optionally narrowed.
  if (segments.length === 1 && segments[0] === "corpus") {
    const raw = url.searchParams.get("jurisdiction");
    if (raw !== null && !JURISDICTION_RE.test(raw)) {
      return apiError(400, "invalid_jurisdiction", "`jurisdiction` must match US or US-XX.");
    }
    return apiJson(200, getCorpus({ ...(raw !== null ? { jurisdiction: raw } : {}), ...(lang ? { language: lang } : {}), today }), {
      event: "api_corpus",
      fields: { route: "/api/v1/corpus", status: 200 },
    });
  }

  // /api/v1/jurisdictions — the coverage index.
  if (segments.length === 1 && segments[0] === "jurisdictions") {
    return apiJson(200, getJurisdictions({ today }), {
      event: "api_jurisdictions",
      fields: { route: "/api/v1/jurisdictions", status: 200 },
    });
  }

  // /api/v1/jurisdictions/{code} — one jurisdiction. A WELL-FORMED but uncovered id is a
  // 200 carrying `status: "not_covered"`, never a 404: 404 would say "no such thing", and
  // the honest answer is "we have not researched it". A MALFORMED id is still a 400.
  if (segments.length === 2 && segments[0] === "jurisdictions") {
    const id = segments[1]!;
    if (!JURISDICTION_RE.test(id)) {
      return apiError(400, "invalid_jurisdiction", "Jurisdiction must match US or US-XX.");
    }
    return apiJson(200, getJurisdiction(id, { ...(lang ? { language: lang } : {}), today }), {
      event: "api_jurisdiction",
      fields: { route: "/api/v1/jurisdictions/:jurisdiction", jurisdiction: id, status: 200 },
    });
  }

  // /api/v1/checklist — the same bounded selection grammar as /checklist.
  if (segments.length === 1 && segments[0] === "checklist") {
    const intake = parseIntake(url);
    if (!intake) {
      return apiError(400, "invalid_jurisdiction", "`jurisdiction` must match US or US-XX.");
    }
    return apiJson(200, getChecklist(intake, { today }), {
      event: "api_checklist",
      fields: {
        route: "/api/v1/checklist",
        jurisdiction: intake.jurisdiction,
        change_types: intake.change_types,
        documents: intake.documents,
        language: intake.language,
        status: 200,
      },
    });
  }

  // /api/v1/referrals/{code} — same not_covered discipline as the jurisdiction route.
  if (segments.length === 2 && segments[0] === "referrals") {
    const id = segments[1]!;
    if (!JURISDICTION_RE.test(id)) {
      return apiError(400, "invalid_jurisdiction", "Jurisdiction must match US or US-XX.");
    }
    return apiJson(200, getReferrals(id, { ...(lang ? { language: lang } : {}), today }), {
      event: "api_referrals",
      fields: { route: "/api/v1/referrals/:jurisdiction", jurisdiction: id, status: 200 },
    });
  }

  return apiError(
    404,
    "unknown_endpoint",
    "No such endpoint. The published response schemas are in docs/api/ in this repository.",
  );
}

/**
 * Resolve a dynamic route. Static files and the HTTP plumbing live in server.ts;
 * `today` is injectable for deterministic tests.
 */
export function handleRoute(method: string, url: URL, today?: string): RouteResponse {
  const lang = asLanguage(languageParam(url));
  if (method !== "GET" && method !== "HEAD") {
    const t = uiStrings(lang);
    return {
      status: 405,
      contentType: HTML,
      headers: { allow: "GET, HEAD" }, // HTTP requires Allow on a 405
      body: page({ lang, title: t.methodHeading, heading: t.methodHeading, body: `<p>${escapeHtml(t.methodBody)}</p>` }),
      log: {
        event: "method_not_allowed",
        fields: { method: metricMethod(method), status: 405 },
      },
    };
  }

  const p = url.pathname;

  // The app stylesheet derives from the typed PALETTE in src/render.ts, so it is
  // served from code rather than duplicated on disk. Static JS lives in public/assets.
  if (p === "/assets/app.css") {
    return { status: 200, contentType: "text/css; charset=utf-8", body: STYLE };
  }

  // Service worker for offline-capable PWA (EXP-01). Serves a generated script with
  // the shell version hash burned in (content hash = versioning).
  if (p === "/sw.js") {
    return { status: 200, contentType: "text/javascript; charset=utf-8", body: serviceWorkerScript() };
  }

  // Crawler files (generated from the route set, so they can't go stale).
  if (p === "/robots.txt") {
    return { status: 200, contentType: "text/plain; charset=utf-8", body: robotsTxt() };
  }
  if (p === "/sitemap.xml") {
    return { status: 200, contentType: "application/xml; charset=utf-8", body: sitemapXml(indexablePaths()) };
  }

  // ── Versioned partner read-API (EXP-07, #232) ─────────────────────────────────────
  // Read-only by construction: this router only ever answers GET/HEAD (the 405 above),
  // so there is no write surface to secure. Every payload is built by api/public-api.ts,
  // which attaches mandatory provenance; this block only parses input and picks a status.
  if (p === API_PREFIX || p.startsWith(API_PREFIX + "/")) {
    return apiRoute(p, url, today);
  }

  // Container liveness. The Dockerfile HEALTHCHECK, AWS_LWA_READINESS_CHECK_PATH and
  // render.yaml's healthCheckPath all point here, so `status` stays a statement about the
  // PROCESS and this route stays 200 whenever the process can answer. What changed is that
  // `corpus_records` no longer stands alone: it counts records on disk, and on 2026-10-12
  // it will still read 688 while zero of them are serveable as current (api/horizon.ts).
  // A monitor reading only that number would see nothing wrong through a total content
  // blackout. The freshness VERDICT is /readyz's job and is unchanged.
  if (p === "/healthz") {
    return {
      status: 200,
      contentType: JSON_CT,
      body: JSON.stringify({ status: "ok", ...healthHorizon(loadCorpus(), today ?? servingToday()) }),
    };
  }

  // Build identity (api/version.ts): which commit produced the image that is answering
  // this request. The deploy is manual, so the running preview can be far behind main
  // and nothing else on the wire says so. Reports `commit: null, stamped: false` rather
  // than a placeholder when the image carries no stamp — see api/version.ts for why an
  // admitted absence beats a plausible-looking wrong SHA. Not indexable: the sitemap is
  // generated from indexablePaths(), which this is not in.
  if (p === "/version") {
    return { status: 200, contentType: JSON_CT, body: JSON.stringify(buildInfo()) };
  }

  if (p === "/metrics") {
    return {
      status: 200,
      contentType: "text/plain; version=0.0.4; charset=utf-8",
      body: renderPrometheusMetrics(),
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
    return { status: 200, contentType: HTML, body: renderIntakePage(asLanguage(languageParam(url))) };
  }

  // Static legal / policy / trust pages (linked from every footer).
  if (p === "/terms" || p === "/privacy" || p === "/accessibility" || p === "/methodology" || p === "/transparency") {
    const lang = asLanguage(languageParam(url));
    const render =
      p === "/terms" ? renderTermsPage :
      p === "/privacy" ? renderPrivacyPage :
      p === "/accessibility" ? renderAccessibilityPage :
      p === "/methodology" ? renderMethodologyPage :
      renderTransparencyPage;
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

  // ── Per-jurisdiction change-alert feeds (RSS 2.0; no accounts, no PII) ────────────
  // /feeds/ is the HTML index of every covered jurisdiction; /feeds/<id>.xml is one
  // jurisdiction's feed. `id` is validated against the CORPUS itself (isKnownJurisdiction),
  // not merely the US/US-XX shape — anything not actually covered 404s with no reflection
  // of the input (notFound() never echoes the path). See api/feed.ts + src/feeds.ts.
  if (p === "/feeds" || p === "/feeds/") {
    return { status: 200, contentType: HTML, body: renderFeedsIndex(lang) };
  }
  if (p.startsWith("/feeds/") && p.endsWith(".xml")) {
    const jurisdiction = p.slice("/feeds/".length, -".xml".length);
    if (!isKnownJurisdiction(jurisdiction)) return notFound(lang);
    // Fallback to the raw id when there's no display name (federal "US" today) — same
    // convention as src/relocation.ts's jurisdictionName().
    const stateName = stateNameFor(jurisdiction, lang) ?? jurisdiction;
    return {
      status: 200,
      contentType: "application/rss+xml; charset=utf-8",
      body: renderJurisdictionFeedXml(jurisdiction, stateName, lang, today),
      log: { event: "feed", fields: { jurisdiction, language: lang, status: 200 } },
    };
  }

  if (p === "/checklist") {
    const intake = parseIntake(url);
    if (!intake) return badRequest(lang);
    const thinnerCoverage = hasThinnerLanguageCoverage(intake, today);
    return {
      status: 200,
      contentType: HTML,
      // Cached (IP §5.2): the canonical intakeQuery(intake) already collapses to
      // (jurisdiction × change × doc × language), so this naturally caches common
      // (jurisdiction × change-type) combos. Keying on today ?? '' keeps per-day
      // freshness correct without special-casing whether today was injected.
      body: cachedChecklistPage({ intake, today, thinnerCoverage }),
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
      body: renderPacketPage(checklist, loadCorpus(), intake.language, generatedOn, intakeQuery(intake), {
        noStateCoverage: hasNoStateCoverage(intake.jurisdiction),
        noMinorCoverage: intake.for_minor === true && hasNoMinorCoverage(intake.jurisdiction),
      }),
      log: { event: "packet", fields: { jurisdiction: intake.jurisdiction, language: intake.language, status: 200 } },
    };
  }

  // Packet staleness (EXP-03). One extra bit on the request surface — the date a packet
  // printed — answered against the corpus as it stands today. Same bounded intake
  // grammar as /checklist, so nothing free-text or identity-shaped reaches here.
  //
  // NOT CACHED, unlike /checklist. A memo key IS retention, and this key would carry
  // "someone printed a packet for this state on this date" in process memory for the
  // lifetime of the process — the reasoning /plan already applies to an origin→
  // destination pair. The recompute is paid on every request instead; scripts/latency-
  // bench.ts measures this route against the same p95 budget so the cost is not hidden.
  //
  // NOTHING DERIVED FROM `since` IS LOGGED, not the date and not the one-bit
  // "is this packet past the longest recheck window". `since` is the day a specific
  // person printed a specific packet; joined with a jurisdiction it is the most
  // identifying thing on this route, and even the boolean narrows a person to a range of
  // print dates. The log descriptor therefore carries exactly what /packet's does. This
  // is the same reasoning /plan applies when it emits no descriptor at all, applied to a
  // weaker signal — and losing an operational metric is the cheaper mistake.
  if (p === "/changes") {
    const intake = parseIntake(url);
    if (!intake) return badRequest(lang);
    const serving = today ?? new Date().toISOString().slice(0, 10);
    const since = parseSince(url.searchParams.get("since"), serving);
    if (since === null) return badRequest(intake.language);
    const changes = buildPacketChanges(intake, since, serving);
    return {
      status: 200,
      contentType: HTML,
      body: renderChangesPage(changes, intake.language, intakeQuery(intake)),
      log: {
        event: "changes",
        fields: { jurisdiction: intake.jurisdiction, language: intake.language, status: 200 },
      },
    };
  }

  // ── Relocation planner (docs/RELOCATION.md) ────────────────────────────────────
  // PRIVACY, and why these two routes look poorer than the others:
  //
  //   • NOT LOGGED. Neither route emits a `log` descriptor. An (origin → destination)
  //     pair is the single most sensitive thing this app can learn about a trans person
  //     in a hostile state — it is intent to flee, timestamped. api/log.ts's allowlist has
  //     no `origin`/`destination` field, so safeLog would drop them anyway; emitting NO
  //     descriptor at all means we don't even record that a plan was built. The
  //     defense-in-depth is deliberate: two independent mechanisms, not one.
  //
  //   • NOT CACHED. Every other rendered page here is memoized (IP §5.2), and /plan is
  //     just as pure — but a memo key IS retention: it would hold "someone is leaving
  //     Texas for Washington" in process memory for the lifetime of the process. We pay
  //     the recompute on every request instead. That is the intended trade.
  if (p === "/move") {
    return { status: 200, contentType: HTML, body: renderMovePage(lang) };
  }

  if (p === "/plan") {
    const intake = parseRelocationIntake(url);
    if (intake === null) return badRequest(lang);
    if (intake === "same-state") {
      return { status: 200, contentType: HTML, body: renderMovePage(lang, "same-state") };
    }
    // Coverage honesty: does the user's language have thinner coverage than English for
    // the DESTINATION state? (Washington, for instance, has no Spanish records yet.)
    const thinner = hasThinnerLanguageCoverage(
      { jurisdiction: intake.destination, change_types: intake.change_types, documents: [], language: intake.language },
      today,
    );
    // Minors pilot: a move touches BOTH states' rules (the origin's while you still live
    // there, the destination's once you arrive), so the honest disclosure fires if EITHER
    // side of the move has no minor-audience record — never only the destination.
    const noMinor = intake.for_minor === true && (hasNoMinorCoverage(intake.origin) || hasNoMinorCoverage(intake.destination));
    const plan = buildRelocationPlan(intake, today);
    return {
      status: 200,
      contentType: HTML,
      body: renderPlanPage(plan, loadCorpus(), intake.language, { thinnerCoverage: thinner, noMinorCoverage: noMinor }),
    };
  }

  // ── "Which state?" comparison (the relocation planner's inverse question) ──────
  // Less sensitive than /move+/plan (no origin→destination pair — the closest thing to
  // one, `current`, is a single state, the same sensitivity class as /checklist's
  // `jurisdiction`), so this route IS logged, with the same bounded-enum fields the
  // rest of the app already logs. Not cached (IP §5.2 caches are opt-in per route, not
  // a default every new route must earn — /move and /plan skip it too): the table is a
  // full corpus scan across every jurisdiction, but on this corpus's current size that
  // recompute is cheap, and skipping a cache here is simpler, not a privacy trade.
  if (p === "/compare") {
    const q = parseCompareInput(url);
    if (!q.wantsResults) {
      return { status: 200, contentType: HTML, body: renderCompareFormPage(q.language) };
    }
    const table = buildCompareTable({ documents: q.documents, change_types: q.change_types }, today);
    // Coverage honesty: does the user's language have thinner coverage than English for
    // ANY compared state? (Mirrors /checklist and /plan's own thinner-coverage check,
    // applied across the whole compared set rather than one jurisdiction.)
    const thinner =
      q.language !== "en" &&
      COMPARE_JURISDICTIONS.some((j) =>
        hasThinnerLanguageCoverage(
          { jurisdiction: j, change_types: table.change_types, documents: table.documents, language: q.language },
          today,
        ),
      );
    return {
      status: 200,
      contentType: HTML,
      body: renderCompareResultsPage(table, loadCorpus(), q.language, {
        ...(q.current ? { current: q.current } : {}),
        sort: q.sort,
        thinnerCoverage: thinner,
      }),
      log: {
        event: "compare",
        fields: {
          documents: table.documents,
          change_types: table.change_types,
          ...(q.current ? { current: q.current } : {}),
          sort: q.sort,
          language: q.language,
          status: 200,
        },
      },
    };
  }

  // Offline notice page — shown when there's no network and no cached copy.
  if (p === "/offline") {
    return { status: 200, contentType: HTML, body: renderOfflinePage(lang) };
  }

  if (p === "/answer") {
    const jurisdiction = validJurisdiction(url.searchParams.get("jurisdiction"));
    if (jurisdiction === null) return badRequest(lang);
    // Same default as parseIntake: no `change` param means "both change types" —
    // otherwise an empty array matches no record and every answer refuses.
    const ct = changeTypes(url);
    const change_types = ct.length > 0 ? ct : [...CHANGE_TYPES];
    const docs = documents(url);
    const question = sanitizeQuestion(url.searchParams.get("q"));
    const forMinor = url.searchParams.get("for_minor") === "1";
    // Cached (IP §5.2) only for the common (jurisdiction × change-type) set the roadmap
    // item names: a free-text question bypasses the cache entirely (never mixed into the
    // key), so cache keys stay jurisdiction/enum/language/date only — no direct identity
    // fields and no free text.
    const value =
      question === undefined
        ? cachedAnswer({ jurisdiction, change_types, documents: docs, language: lang, today, for_minor: forMinor })
        : buildAnswerValue(jurisdiction, change_types, docs, lang, today, question, forMinor);
    // Content-free observability counters (OPERATIONS alarms): how many claims were served,
    // and whether any stale/volatile record was surfaced as "needs reverification".
    // Stored alongside the cached body (not recomputed) so counters stay accurate on hits.
    return {
      status: 200,
      contentType: HTML,
      body: value.body,
      log: { event: "answer", fields: { jurisdiction, refused: value.refused, claims: value.claims, degraded: value.degraded, status: 200 } },
    };
  }

  if (p.startsWith("/forms/") && !p.startsWith("/forms/fixtures/")) {
    const form = formById(p.slice("/forms/".length));
    if (!form) return notFound(lang);
    return { status: 200, contentType: HTML, body: renderFormFillPage(form, lang) };
  }

  return {
    ...notFound(lang),
    log: { event: "not_found", fields: { route: metricRoute(p), status: 404 } },
  };
}
