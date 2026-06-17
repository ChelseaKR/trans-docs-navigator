// Legal & policy pages: Terms of Use, Privacy Notice, Accessibility Statement.
// Served at /terms, /privacy, /accessibility and linked from every page footer.
// Content lives in the locale bundles (src/i18n/), one set of sections per language.
//
// PLAIN LANGUAGE by design (these are read by the same audience as the rest of the site).
// DRAFT POSTURE: this is a pre-launch reference build. The Terms and Privacy text are
// written to be honest and reasonable but are NOT a substitute for review by a licensed
// attorney — counsel review of the disclaimers/terms is an explicit, OPEN launch gate
// (docs/STATUS.md §7.1). Do not present this as final legal text without that review.

import type { Language } from "../api/types.ts";
import type { LegalSection } from "./i18n/index.ts";
import { t as locale } from "./i18n/index.ts";
import { page, escapeHtml } from "./render.ts";

export const LEGAL_EFFECTIVE_DATE = "2026-06-05";

function legalBody(sections: LegalSection[], updatedLabel: string): string {
  const body = sections.map((s) => `<section><h2>${escapeHtml(s.h)}</h2>${s.html}</section>`).join("\n");
  return `${body}\n<p class="meta">${escapeHtml(updatedLabel)} ${escapeHtml(LEGAL_EFFECTIVE_DATE)}.</p>`;
}

export function renderTermsPage(lang: Language = "en"): string {
  const l = locale(lang).legal;
  return page({
    lang, title: l.termsTitle, heading: l.termsTitle, body: legalBody(l.terms, l.updatedLabel),
    seo: { path: "/terms", description: locale(lang).seo.legalDescription.terms, index: true },
  });
}
export function renderPrivacyPage(lang: Language = "en"): string {
  const l = locale(lang).legal;
  return page({
    lang, title: l.privacyTitle, heading: l.privacyTitle, body: legalBody(l.privacy, l.updatedLabel),
    seo: { path: "/privacy", description: locale(lang).seo.legalDescription.privacy, index: true },
  });
}
export function renderAccessibilityPage(lang: Language = "en"): string {
  const l = locale(lang).legal;
  return page({
    lang, title: l.accessibilityTitle, heading: l.accessibilityTitle, body: legalBody(l.accessibility, l.updatedLabel),
    seo: { path: "/accessibility", description: locale(lang).seo.legalDescription.accessibility, index: true },
  });
}
