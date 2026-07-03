// Accessible server-side rendering (WCAG 2.2 AA target, audit §E).
// Pages are usable with no client JavaScript; the form-fill page progressively
// enhances. Every page carries the persistent "information, not legal advice"
// disclosure (guardrail #2). Colour tokens meet AA contrast; focus is always
// visible; motion respects prefers-reduced-motion.

import type { Checklist, GroundedAnswer, CorpusRecord, DocumentType, Language, PreparationItem } from "../api/types.ts";
import type { UiMessages } from "./i18n/index.ts";
import { t as locale } from "./i18n/index.ts";
import type { SeoMeta } from "./seo.ts";
import { headTags, titleTag } from "./seo.ts";
import { formById } from "../api/forms.ts";

/** Localized gap-reason sentence from the language bundle. */
export function gapReason(lang: Language, reason: "no-records" | "all-degraded"): string {
  const ui = locale(lang).ui;
  return reason === "no-records" ? ui.gapNoRecords : ui.gapAllDegraded;
}

/** Friendly label for a form-fill intake key (a small fixed set). Falls back to the key. */
export function fieldLabel(lang: Language, intakeKey: string): string {
  return locale(lang).fieldLabels[intakeKey] ?? intakeKey.replace(/_/g, " ");
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// "Law changed in X" issue template (.github/ISSUE_TEMPLATE/law-changed.md). Wiring a
// per-step report link to it turns users into a freshness signal (RESEARCH-ROADMAP R11).
// The jurisdiction + document are non-PII selection metadata, prefilled into the title so
// the report is actionable; no identity data is involved.
const LAW_CHANGED_ISSUE_URL = "https://github.com/ChelseaKR/trans-docs-navigator/issues/new?template=law-changed.md";
export function reportErrorHref(jurisdiction: string, documentType: string): string {
  return `${LAW_CHANGED_ISSUE_URL}&title=${encodeURIComponent(`[law-changed] ${jurisdiction} · ${documentType}`)}`;
}

// The destination is a GitHub issue on a repo that is currently PRIVATE: for any
// non-collaborator the link 404s — after GitHub has already logged the prefilled URL
// against their IP/session. Rendering is therefore OFF unless the operator opts in
// with REPORT_ERROR_LINKS=on. Flipping it on is part of the repo-visibility decision
// (owner-only), and a filed issue is PUBLIC and tied to the reporter's GitHub
// identity — which is why the disclosure note renders beside the link when enabled.
// DPIA: docs/audits/dpia.md §1 row [Added 2026-07-09] + §5 residual-risk entry.
export function reportErrorLinksEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.REPORT_ERROR_LINKS === "on";
}


/**
 * Colour tokens, exported so the a11y gate can assert WCAG 2.2 AA contrast ratios
 * against the actual rendered palette (not a hand-copied duplicate). `screen` is the
 * default dark theme; `print` is the print-media override. On-token colours are the
 * foreground used ON a control of that colour (e.g. button/skip text).
 */
export const PALETTE = {
  screen: { bg: "#0f1419", fg: "#f2f5f7", muted: "#c9d3da", accent: "#7fd3ff", card: "#1b232c", warn: "#ffcf6b", line: "#3a4754", onAccent: "#000000" },
  print: { bg: "#ffffff", fg: "#000000", muted: "#222222", accent: "#0b3d91", card: "#ffffff", warn: "#7a4b00", line: "#999999", onAccent: "#ffffff" },
} as const;

// Served at /assets/app.css (api/router.ts) and linked from every page, so the CSP
// needs no 'unsafe-inline' for styles. Derived from PALETTE — one source of truth.
export const STYLE = `
:root{--bg:${PALETTE.screen.bg};--fg:${PALETTE.screen.fg};--muted:${PALETTE.screen.muted};--accent:${PALETTE.screen.accent};--card:${PALETTE.screen.card};--warn:${PALETTE.screen.warn};--line:${PALETTE.screen.line}}
*{box-sizing:border-box}
body{margin:0;font:1rem/1.6 system-ui,sans-serif;background:var(--bg);color:var(--fg)}
a{color:var(--accent)}
a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
.skip{position:absolute;inset-inline-start:-9999px;top:0;background:var(--accent);color:#000;padding:.5rem 1rem}
.skip:focus{inset-inline-start:0;z-index:10}
header[role=banner]{background:var(--card);border-bottom:1px solid var(--line);padding:1rem}
.banner{max-width:60rem;margin:0 auto;color:var(--warn);font-weight:600}
main{max-width:60rem;margin:0 auto;padding:1.5rem 1rem}
.step{background:var(--card);border:1px solid var(--line);border-radius:.5rem;padding:1rem;margin:1rem 0}
.meta{color:var(--muted);font-size:.95rem}
.flag{color:var(--warn);font-weight:600}
fieldset{border:1px solid var(--line);border-radius:.5rem;margin:1rem 0;padding:1rem}
label{display:block;margin:.4rem 0}
input[type=text],input[type=password],select{background:var(--card);color:var(--fg);border:1px solid var(--line);border-radius:.3rem;padding:.5rem;font:inherit;max-width:100%}
button{background:var(--accent);color:#000;border:0;border-radius:.4rem;padding:.6rem 1.2rem;font-size:1rem;cursor:pointer}
footer{max-width:60rem;margin:0 auto;padding:1.5rem 1rem;color:var(--muted);border-top:1px solid var(--line)}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.breadcrumb{color:var(--muted);font-size:.95rem;margin:.5rem 0 1rem}
.cta{margin:1.5rem 0}
.cta a{display:inline-block;background:var(--accent);color:var(--onAccent,#000);padding:.6rem 1.1rem;border-radius:.4rem;font-weight:600;text-decoration:none}
.plan-summary{font-size:1.05rem;margin:.5rem 0}
.step-head{display:flex;justify-content:space-between;align-items:baseline;gap:1rem;flex-wrap:wrap}
.step-head h2{margin:.2rem 0}
.done-toggle{font-size:.9rem;color:var(--muted);font-weight:400;white-space:nowrap}
.step.done{opacity:.7}
.step.done .step-head h2{text-decoration:line-through}
.step-done{border-inline-start:.3rem solid var(--accent)}
.done-badge{color:var(--accent);font-weight:600}
.step-cta{margin:.6rem 0}
.step-cta a{display:inline-block;background:var(--accent);color:var(--onAccent,#000);padding:.45rem .9rem;border-radius:.4rem;text-decoration:none;font-weight:600;font-size:.95rem}
.step-detail{margin:.5rem 0}
.step-detail summary{cursor:pointer;color:var(--accent)}
.more{background:var(--card);border:1px solid var(--line);border-radius:.5rem;padding:.5rem 1rem 1rem;margin:1.5rem 0}
.copy-helper{background:var(--card);border:1px solid var(--line);border-radius:.5rem;padding:.5rem 1rem 1rem;margin:1.5rem 0}
.prep{background:var(--card);border:1px solid var(--line);border-radius:.5rem;padding:.5rem 1rem 1rem;margin:1.5rem 0}
.copy-out{white-space:pre-wrap;background:var(--bg);border:1px solid var(--line);border-radius:.4rem;padding:.5rem;min-height:1.4rem;margin:.5rem 0}
@media (prefers-reduced-motion: reduce){*{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
@media print{
  :root{--bg:${PALETTE.print.bg};--fg:${PALETTE.print.fg};--muted:${PALETTE.print.muted};--accent:${PALETTE.print.accent};--card:${PALETTE.print.card};--warn:${PALETTE.print.warn};--line:${PALETTE.print.line}}
  body{font-size:11pt}
  .no-print{display:none!important}
  a{color:#000;text-decoration:underline}
  a[href^="http"]::after{content:" (" attr(href) ")";font-size:.85em;color:#333;word-break:break-all}
  header[role=banner]{border-bottom:2px solid #000}
  .step{break-inside:avoid;border:1px solid #000}
  h2{break-after:avoid}
}
`;

/** UI string table for a language (used by page assembly in pages.ts). */
export function uiStrings(lang: Language): UiMessages {
  return locale(lang).ui;
}

export function page(opts: {
  lang: Language;
  title: string;
  heading: string;
  body: string;
  /**
   * Search metadata. Omit it and the page renders `noindex` with no canonical/OG —
   * the privacy-safe default. Pass `{ path, description, index: true }` only on the
   * content surfaces the indexing contract allows (home, guides, legal).
   */
  seo?: SeoMeta;
}): string {
  const t = locale(opts.lang).ui;
  const langQ = opts.lang === "es" ? "?language=es" : ""; // preserve language on footer links
  const fullTitle = titleTag(opts.title);
  const seo: SeoMeta = opts.seo ?? { path: "", description: "", index: false };
  return `<!doctype html>
<html lang="${opts.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(fullTitle)}</title>
${headTags(fullTitle, opts.lang, seo)}
<link rel="stylesheet" href="/assets/app.css">
</head>
<body>
<a class="skip" href="#main">${escapeHtml(t.skip)}</a>
<header role="banner">
  <p class="banner" role="note"><strong>${escapeHtml(t.bannerTitle)}.</strong> ${escapeHtml(t.bannerBody)}</p>
</header>
<main id="main">
  <h1>${escapeHtml(opts.heading)}</h1>
  ${opts.body}
</main>
<footer>
  <p>${escapeHtml(t.footer)}</p>
  <nav aria-label="${escapeHtml(t.legalNav)}">
    <a href="/terms${langQ}">${escapeHtml(t.termsLink)}</a> ·
    <a href="/privacy${langQ}">${escapeHtml(t.privacyLink)}</a> ·
    <a href="/transparency${langQ}">${escapeHtml(t.transparencyLink)}</a> ·
    <a href="/accessibility${langQ}">${escapeHtml(t.a11yLink)}</a> ·
    <a href="/methodology${langQ}">${escapeHtml(t.methodologyLink)}</a>
  </nav>
</footer>
</body>
</html>`;
}

// `level` keeps heading order correct: 3 inside a checklist step (under the step's h2),
// 2 on the standalone answer page (directly under the page h1, so no level is skipped).
function sourceList(records: CorpusRecord[], lang: Language, level: 2 | 3 = 3): string {
  if (records.length === 0) return "";
  const t = locale(lang).ui;
  const items = records
    .map(
      (r) =>
        `<li><a href="${escapeHtml(r.source.url)}" rel="noopener noreferrer">${escapeHtml(r.source.title)}</a> — <span class="meta">${escapeHtml(t.lastChecked)} ${escapeHtml(r.source.last_verified)}</span></li>`,
    )
    .join("");
  return `<h${level}>${escapeHtml(t.sources)}</h${level}><ul>${items}</ul>`;
}

/**
 * "What to bring" preparation checklist for a form-fill page (FIX-10). Renders nothing
 * when `items` is absent/empty — the underlying legal content (what a given form
 * actually requires) is [counsel-gated] and not yet authored in forms/registry.json,
 * so an empty/absent list must never render a placeholder claim.
 */
export function preparationList(items: PreparationItem[] | undefined, lang: Language): string {
  if (!items || items.length === 0) return "";
  const t = locale(lang).ui;
  const rows = items
    .map((p) => `<li>${escapeHtml(p.item)} — <span class="meta">${escapeHtml(p.citation)}</span></li>`)
    .join("");
  return `<section class="prep" aria-labelledby="prep-h"><h2 id="prep-h">${escapeHtml(t.whatToBringTitle)}</h2><ul>${rows}</ul></section>`;
}

export function renderChecklist(checklist: Checklist, records: CorpusRecord[], lang: Language): string {
  const t = locale(lang).ui;
  const langQ = lang === "es" ? "?language=es" : "";
  const byId = new Map(records.map((r) => [r.id, r]));
  const steps = checklist.steps
    .map((s) => {
      const stepRecords = s.record_ids.map((id) => byId.get(id)).filter((r): r is CorpusRecord => !!r);
      const cost = s.cost
        ? `<p class="meta"><strong>${escapeHtml(t.cost)}:</strong> ${s.cost.amount_usd === null ? escapeHtml(s.cost.note ?? t.varies) : "$" + s.cost.amount_usd}</p>`
        : "";
      const time = s.timeline ? `<p class="meta"><strong>${escapeHtml(t.timeline)}:</strong> ${escapeHtml(s.timeline.typical)}</p>` : "";
      const prereq = s.prerequisites.length
        ? `<p class="meta"><strong>${escapeHtml(t.prereq)}:</strong> ${s.prerequisites.map((d) => escapeHtml(locale(lang).docLabels[d as DocumentType] ?? d)).join(", ")}</p>`
        : "";
      const disc = s.discretionary ? `<p class="flag">${escapeHtml(t.discretionary)}</p>` : "";
      const stale = s.needs_reverification ? `<p class="flag" role="note">${escapeHtml(t.needsRecheck)}</p>` : "";
      // has_court_order intake: annotate, don't hide — citations stay visible either way.
      const done = s.done ? `<p class="meta done-badge">✅ ${escapeHtml(t.alreadyDone)}</p>` : "";
      const claims = stepRecords.map((r) => `<li>${escapeHtml(r.statement)}</li>`).join("");

      // Expandable practical detail (kept out of the default view to stay scannable).
      const details = stepRecords.map((r) => r.detail).filter((d): d is string => !!d);
      const detailBlock = details.length
        ? `<details class="step-detail no-print"><summary>${escapeHtml(t.moreDetail)}</summary><ul>${details.map((d) => `<li>${escapeHtml(d)}</li>`).join("")}</ul></details>`
        : "";

      // Link straight to the official form for this step (download + complete it
      // yourself; we don't auto-fill — see api/forms.ts).
      const form = s.form_ref ? formById(s.form_ref) : undefined;
      const formCta = form
        ? `<p class="step-cta no-print"><a href="/forms/${escapeHtml(form.id)}${langQ}">📝 ${escapeHtml(t.getFormCta)}</a></p>`
        : "";

      // Per-step "report an error / law changed" link (RESEARCH-ROADMAP R11): a one-click
      // path to the law-changed issue template, so a user who spots stale guidance becomes
      // a freshness signal exactly where they noticed it.
      const reportLink = reportErrorLinksEnabled()
        ? `<p class="step-report meta no-print"><a href="${escapeHtml(reportErrorHref(checklist.jurisdiction, s.document_type))}" rel="noopener noreferrer">${escapeHtml(t.reportError)}</a><br><small>${escapeHtml(t.reportErrorNote)}</small></p>`
        : "";
      return `<li class="step${s.done ? " step-done" : ""}" data-step="${escapeHtml(s.key)}">
  <div class="step-head"><h2>${escapeHtml(t.step)} ${s.order}: ${escapeHtml(locale(lang).docTitles[s.document_type])}</h2>
  <label class="done-toggle no-print"><input type="checkbox" data-step-toggle="${escapeHtml(s.key)}"> ${escapeHtml(t.markDone)}</label></div>
  ${done}
  ${claims ? `<ul>${claims}</ul>` : ""}
  ${cost}${time}${prereq}${disc}${stale}
  ${detailBlock}${formCta}
  ${sourceList(stepRecords, lang)}
  ${reportLink}
</li>`;
    })
    .join("");
  return `<ol>${steps}</ol>`;
}

/** Full, print-optimized packet body: every step with detail, costs, and sources. */
export function renderPacket(
  checklist: Checklist,
  records: CorpusRecord[],
  lang: Language,
  generatedOn: string,
): string {
  const t = locale(lang).ui;
  const byId = new Map(records.map((r) => [r.id, r]));
  const steps = checklist.steps
    .map((s) => {
      const stepRecords = s.record_ids.map((id) => byId.get(id)).filter((r): r is CorpusRecord => !!r);
      const detail = stepRecords
        .map((r) => `<li><p>${escapeHtml(r.statement)}</p>${r.detail ? `<p class="meta">${escapeHtml(r.detail)}</p>` : ""}</li>`)
        .join("");
      const cost = s.cost
        ? `<p class="meta"><strong>${escapeHtml(t.cost)}:</strong> ${s.cost.amount_usd === null ? escapeHtml(s.cost.note ?? "varies") : "$" + s.cost.amount_usd}</p>`
        : "";
      const time = s.timeline ? `<p class="meta"><strong>${escapeHtml(t.timeline)}:</strong> ${escapeHtml(s.timeline.typical)}</p>` : "";
      const prereq = s.prerequisites.length
        ? `<p class="meta"><strong>${escapeHtml(t.prereq)}:</strong> ${s.prerequisites.map((d) => escapeHtml(locale(lang).docLabels[d as DocumentType] ?? d)).join(", ")}</p>`
        : "";
      const disc = s.discretionary ? `<p class="flag">${escapeHtml(t.discretionary)}</p>` : "";
      const stale = s.needs_reverification ? `<p class="flag" role="note">${escapeHtml(t.needsRecheck)}</p>` : "";
      const done = s.done ? `<p class="meta done-badge">✅ ${escapeHtml(t.alreadyDone)}</p>` : "";
      return `<li class="step${s.done ? " step-done" : ""}">
  <h2>${escapeHtml(t.step)} ${s.order}: ${escapeHtml(locale(lang).docTitles[s.document_type])}</h2>
  ${done}
  ${detail ? `<ul>${detail}</ul>` : ""}
  ${cost}${time}${prereq}${disc}${stale}
  ${sourceList(stepRecords, lang)}
</li>`;
    })
    .join("");
  const gaps = checklist.gaps.length
    ? `<section aria-label="${escapeHtml(t.notCovered)}"><h2>${escapeHtml(t.notCovered)}</h2><ul>${checklist.gaps
        .map((g) => `<li class="flag">${escapeHtml(locale(lang).docLabels[g.document_type])}: ${escapeHtml(gapReason(lang, g.reason))}</li>`)
        .join("")}</ul></section>`
    : "";
  return `<p>${escapeHtml(t.packetIntro)}</p><p class="flag" role="note">${escapeHtml(t.verifyNote)}</p><ol>${steps}</ol>${gaps}<p class="meta">${escapeHtml(t.prepared)} ${escapeHtml(generatedOn)}.</p>`;
}

export function renderAnswer(ans: GroundedAnswer, lang: Language): string {
  const blocks = ans.blocks
    .map((b) => {
      const cls = b.kind === "claim" ? "" : ` class="${b.kind === "freshness" || b.kind === "uncertainty" ? "flag" : "meta"}"`;
      return `<p${cls}>${escapeHtml(b.text)}</p>`;
    })
    .join("");
  return `<section aria-label="answer">${blocks}${sourceList(ans.cited_records, lang, 2)}</section>`;
}
