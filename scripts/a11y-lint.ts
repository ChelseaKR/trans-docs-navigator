// Accessibility gate (audit §E) — merge-blocking on the MECHANICAL WCAG 2.2 AA
// checks (the ~30–40% that automation can decide, per the standard). It renders
// every page template and asserts: language, title, viewport, single h1, skip
// link + main landmark, visible-focus + reduced-motion styles, image alt text,
// labelled form controls, no positive tabindex, and non-empty link/button text.
//
// HONEST SCOPE: this is NOT a full axe/pa11y run and does NOT replace the manual
// screen-reader / keyboard / 200%-zoom walkthrough, which are REVIEW-GATED and
// signed off in docs/audits/accessibility-YYYY-MM-DD.md. Production CI also runs
// pa11y-ci in a real browser (see .github/workflows/ci.yml).

import { loadCorpus } from "../api/corpus.ts";
import { buildChecklist } from "../api/checklist.ts";
import { formById } from "../api/forms.ts";
import { renderIntakePage, renderChecklistPage, renderPacketPage, renderFormFillPage } from "../src/pages.ts";
import { PALETTE } from "../src/render.ts";
import { pass, fail } from "./util.ts";

// ── Colour-contrast (WCAG 2.2 SC 1.4.3) ───────────────────────────────────────
// Automatable portion of contrast conformance: compute the real ratio for the
// palette's text/background pairs. Normal text needs ≥ 4.5:1, large/bold UI ≥ 3:1.
function srgbToLin(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m || !m[1]) throw new Error(`bad hex ${hex}`);
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.2126 * srgbToLin(r) + 0.7152 * srgbToLin(g) + 0.0722 * srgbToLin(b);
}
function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

function contrastErrors(): string[] {
  const errs: string[] = [];
  for (const [theme, p] of Object.entries(PALETTE)) {
    // [name, foreground, background, minimum ratio]
    const pairs: [string, string, string, number][] = [
      ["body text (fg/bg)", p.fg, p.bg, 4.5],
      ["muted text on bg", p.muted, p.bg, 4.5],
      ["muted text on card", p.muted, p.card, 4.5],
      ["links (accent on bg)", p.accent, p.bg, 4.5],
      ["banner/flag (warn on card)", p.warn, p.card, 4.5],
      ["button/skip text (onAccent on accent)", p.onAccent, p.accent, 4.5],
    ];
    for (const [name, fg, bg, min] of pairs) {
      const ratio = contrast(fg, bg);
      if (ratio < min) errs.push(`${theme}: ${name} contrast ${ratio.toFixed(2)}:1 < ${min}:1`);
    }
  }
  return errs;
}

interface Page {
  name: string;
  html: string;
}

const corpus = loadCorpus();
const enChecklist = buildChecklist({ jurisdiction: "US-CA", change_types: ["name", "gender-marker"], documents: [], language: "en" });
const esChecklist = buildChecklist({ jurisdiction: "US-CA", change_types: ["name"], documents: [], language: "es" });
const pages: Page[] = [
  { name: "intake", html: renderIntakePage("en") },
  { name: "intake-es", html: renderIntakePage("es") },
  { name: "checklist", html: renderChecklistPage(enChecklist, corpus, "en", "jurisdiction=US-CA&change=name") },
  { name: "checklist-es", html: renderChecklistPage(esChecklist, corpus, "es", "jurisdiction=US-CA&language=es") },
  { name: "packet", html: renderPacketPage(enChecklist, corpus, "en", "2026-05-31") },
  { name: "form-fill", html: renderFormFillPage(formById("us-ss-5")!, "en") },
  { name: "form-degraded", html: renderFormFillPage(formById("us-ds-82")!, "en") },
];

function checkPage(p: Page): string[] {
  const h = p.html;
  const errs: string[] = [];
  const need = (cond: boolean, msg: string) => {
    if (!cond) errs.push(`${p.name}: ${msg}`);
  };

  need(/^<!doctype html>/i.test(h.trim()), "missing <!doctype html>");
  need(/<html lang="[a-z-]+"/i.test(h), "missing <html lang>");
  need(/<title>[^<]+<\/title>/i.test(h), "missing non-empty <title>");
  need(/<meta name="viewport"/i.test(h), "missing viewport meta");
  need((h.match(/<h1[\s>]/gi) ?? []).length === 1, "must have exactly one <h1>");
  need(/<a class="skip" href="#main"/.test(h), "missing skip-to-content link");
  need(/id="main"/.test(h), "missing main landmark (#main)");
  need(/focus-visible/.test(h), "missing visible-focus styles");
  need(/prefers-reduced-motion/.test(h), "missing reduced-motion handling");

  // Images need alt text.
  for (const img of h.match(/<img\b[^>]*>/gi) ?? []) {
    if (!/\balt=/.test(img)) errs.push(`${p.name}: <img> without alt`);
  }
  // No positive tabindex.
  for (const m of h.match(/tabindex="(\d+)"/gi) ?? []) {
    if (Number(m.replace(/\D/g, "")) > 0) errs.push(`${p.name}: positive tabindex`);
  }
  // Links and buttons need accessible text.
  for (const a of h.match(/<a\b[^>]*>(.*?)<\/a>/gis) ?? []) {
    const text = a.replace(/<[^>]+>/g, "").trim();
    if (text.length === 0 && !/aria-label=/.test(a)) errs.push(`${p.name}: link without text`);
  }
  for (const b of h.match(/<button\b[^>]*>(.*?)<\/button>/gis) ?? []) {
    const text = b.replace(/<[^>]+>/g, "").trim();
    if (text.length === 0 && !/aria-label=/.test(b)) errs.push(`${p.name}: button without text`);
  }
  // Every form control is labelled: id→<label for>, or wrapped in a <label>.
  errs.push(...checkLabels(p));
  return errs;
}

/** Each input/select/textarea must have a matching label[for] (by id) or be wrapped in a <label>. */
function checkLabels(p: Page): string[] {
  const h = p.html;
  const errs: string[] = [];
  const forTargets = new Set([...h.matchAll(/<label[^>]*\sfor="([^"]+)"/gi)].map((m) => m[1]));
  const controlRe = /<(input|select|textarea)\b([^>]*)>/gi;
  let m: RegExpExecArray | null;
  while ((m = controlRe.exec(h)) !== null) {
    const attrs = m[2] ?? "";
    if (/type="(hidden|submit|button)"/.test(attrs)) continue;
    const idMatch = /\bid="([^"]+)"/.exec(attrs);
    if (idMatch && forTargets.has(idMatch[1]!)) continue;
    // Wrapped-in-label case: the nearest unclosed <label> precedes this control.
    const before = h.slice(0, m.index);
    const lastOpen = before.lastIndexOf("<label");
    const lastClose = before.lastIndexOf("</label>");
    if (lastOpen > lastClose) continue;
    errs.push(`${p.name}: <${m[1]}> control without an associated label`);
  }
  return errs;
}

const allErrors = [...pages.flatMap(checkPage), ...contrastErrors()];
if (allErrors.length > 0) fail("a11y", `${allErrors.length} mechanical WCAG violation(s)`, allErrors);
pass(
  "a11y",
  `0 mechanical WCAG violations across ${pages.length} page templates + contrast on ${Object.keys(PALETTE).length} themes (manual SR walkthrough is review-gated)`,
);
