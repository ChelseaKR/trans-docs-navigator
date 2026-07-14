// Transparency report: dated quarterly architecture inventories stating what records
// may exist and which features stay local. Served at /transparency and linked from
// every page footer, mirroring src/legal.ts.
//
// DRAFT POSTURE: this is a pre-launch reference build. The quarterly entries below are
// a factual restatement of the data-inventory work already done in docs/audits/dpia.md
// (what the server processes, caches, and logs) — they are NOT demand statistics or a
// warrant canary. Any
// canary-style wording (e.g. an explicit "we have not received a court order" assertion)
// is legally delicate and counsel review of that wording is an explicit, OPEN launch
// gate (docs/STATUS.md §7.1), same posture as the Terms/Privacy disclaimers in
// src/legal.ts. Do not add canary language to this page, or present anything here as
// final legal text, without that review.

import type { Language } from "../api/types.ts";
import type { LegalSection } from "./i18n/index.ts";
import { t as locale } from "./i18n/index.ts";
import { page, escapeHtml } from "./render.ts";

/** Date the current set of quarterly entries was last reviewed/appended. */
export const TRANSPARENCY_UPDATED_DATE = "2026-07-12";

function transparencyBody(sections: LegalSection[], updatedLabel: string): string {
  const body = sections.map((s) => `<section><h2>${escapeHtml(s.h)}</h2>${s.html}</section>`).join("\n");
  return `${body}\n<p class="meta">${escapeHtml(updatedLabel)} ${escapeHtml(TRANSPARENCY_UPDATED_DATE)}.</p>`;
}

export function renderTransparencyPage(lang: Language = "en"): string {
  const l = locale(lang);
  return page({
    lang,
    title: l.legal.transparencyTitle,
    heading: l.legal.transparencyTitle,
    body: transparencyBody(l.transparency, l.legal.updatedLabel),
    seo: { path: "/transparency", description: l.seo.transparencyDescription, index: true },
  });
}
