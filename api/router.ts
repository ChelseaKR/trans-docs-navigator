// Pure request routing + input hardening, factored out of the HTTP shell (api/server.ts)
// so it is unit-testable and covered by the test gate. Given a method + parsed URL it
// returns a RouteResponse describing exactly what to send — no sockets or filesystem I/O.
//
// SECURITY: all user-controlled inputs are bounded and validated here (jurisdiction
// format, enum filtering, array caps, question length) before they reach retrieval or
// rendering. Checklist selections and optional question text are server inputs; direct
// identity-form fields are not read. See the Privacy Notice for cache/log boundaries.

import { buildChecklist, hasThinnerLanguageCoverage } from "./checklist.ts";
import { buildRelocationPlan } from "./relocation.ts";
import { answer } from "./guidance.ts";
import { loadCorpus } from "./corpus.ts";
import { isCurrent } from "./freshness.ts";
import { formById } from "./forms.ts";
import { memoize } from "./cache.ts";
import type { ChangeType, CorpusRecord, DocumentType, Intake, Language, RelocationIntake } from "./types.ts";
import { renderIntakePage, renderChecklistPage, renderPacketPage, renderFormFillPage, renderOfflinePage } from "../src/pages.ts";
import { renderMovePage, renderPlanPage } from "../src/relocation.ts";
import { renderAnswer, page, uiStrings, escapeHtml, STYLE } from "../src/render.ts";
import { renderTermsPage, renderPrivacyPage, renderAccessibilityPage, renderMethodologyPage } from "../src/legal.ts";
import { renderTransparencyPage } from "../src/transparency.ts";
import { renderGuideIndex, renderGuidePage, indexablePaths } from "../src/guide.ts";
import { robotsTxt, sitemapXml } from "../src/seo.ts";
import { asLanguage } from "../src/i18n/index.ts";
import { serviceWorkerScript } from "../src/offline.ts";
import { metricMethod, metricRoute, renderPrometheusMetrics } from "./metrics.ts";

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
  /** Optional structured log descriptor (bounded allowlisted metadata only). */
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
  return {
    origin,
    destination,
    held,
    change_types: ct.length > 0 ? ct : ["name", "gender-marker"],
    language: asLanguage(url.searchParams.get("language")),
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
  return {
    jurisdiction,
    change_types: ct.length > 0 ? ct : ["name", "gender-marker"],
    documents: documents(url),
    language: asLanguage(url.searchParams.get("language")),
    ...(hasCourtOrder ? { has_court_order: true } : {}),
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
  (k) => renderChecklistPage(buildChecklist(k.intake, k.today), loadCorpus(), k.intake.language, intakeQuery(k.intake), { thinnerCoverage: k.thinnerCoverage }),
  { keyOf: checklistCacheKeyOf },
);

interface AnswerKey {
  jurisdiction: string;
  change_types: ChangeType[];
  documents: DocumentType[];
  language: Language;
  today: string | undefined;
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
): AnswerCacheValue {
  const t = uiStrings(language);
  const result = answer({ jurisdiction, change_types, documents, question, language, today });
  const claims = result.blocks.filter((b) => b.kind === "claim").length;
  const degraded = result.blocks.some((b) => b.kind === "freshness");
  // Always give a way forward (no dead-end): back to the checklist for the same query,
  // or start over. Preserves the canonical selection query so the user lands back where they were.
  const back = intakeQuery({ jurisdiction, change_types, documents, language });
  const actions = `<p class="no-print"><a href="/checklist?${back}">← ${escapeHtml(t.backToChecklist)}</a> · <a href="/">${escapeHtml(t.backToStart)}</a></p>`;
  const body = page({ lang: language, title: t.answerHeading, heading: t.answerHeading, body: renderAnswer(result, language) + actions });
  return { body, refused: result.refused, claims, degraded };
}

// Only cache the free-text-free "common (jurisdiction × change-type)" combos the roadmap
// item names — a `q` present means we skip the cache entirely (see the /answer route).
const cachedAnswer = memoize<AnswerKey, AnswerCacheValue>(
  (k) => buildAnswerValue(k.jurisdiction, k.change_types, k.documents, k.language, k.today, undefined),
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

  if (p === "/healthz") {
    return {
      status: 200,
      contentType: JSON_CT,
      body: JSON.stringify({ status: "ok", corpus_records: loadCorpus().length }),
    };
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
    return { status: 200, contentType: HTML, body: renderIntakePage(asLanguage(url.searchParams.get("language"))) };
  }

  // Static legal / policy / trust pages (linked from every footer).
  if (p === "/terms" || p === "/privacy" || p === "/accessibility" || p === "/methodology" || p === "/transparency") {
    const lang = asLanguage(url.searchParams.get("language"));
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
      body: renderPacketPage(checklist, loadCorpus(), intake.language, generatedOn, intakeQuery(intake)),
      log: { event: "packet", fields: { jurisdiction: intake.jurisdiction, language: intake.language, status: 200 } },
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
    const plan = buildRelocationPlan(intake, today);
    return {
      status: 200,
      contentType: HTML,
      body: renderPlanPage(plan, loadCorpus(), intake.language, { thinnerCoverage: thinner }),
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
    // Cached (IP §5.2) only for the common (jurisdiction × change-type) set the roadmap
    // item names: a free-text question bypasses the cache entirely (never mixed into the
    // key), so cache keys stay jurisdiction/enum/language/date only — no direct identity
    // fields and no free text.
    const value =
      question === undefined
        ? cachedAnswer({ jurisdiction, change_types, documents: docs, language: lang, today })
        : buildAnswerValue(jurisdiction, change_types, docs, lang, today, question);
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
