/**
 * Which languages are machine-translated, and the notice every surface showing one carries.
 *
 * Owner decision, 2026-09-18: the Spanish ships, labeled machine-translated. No qualified
 * speaker has reviewed it (the README and docs/I18N.md have always said so); the label puts
 * that on the page itself rather than only in the repository.
 *
 * The notice is deliberately NOT a `LocaleBundle` key. It has to read the same in both
 * languages whichever bundle rendered the page, and a translatable string is one a future
 * translation could turn into a claim that the text was reviewed. It is one definition,
 * used by:
 *
 * - `page()` in src/render.ts, which puts it first in `<main>` on every HTML page in a
 *   machine-translated language (and so in the portable edition, which runs the same code);
 * - `handleRoute()` in api/router.ts, which points its English link at this page's English
 *   twin, because only the router knows the request URL;
 * - the Spanish RSS feeds in src/feeds.ts;
 * - the portable edition's `<noscript>` fallback.
 *
 * `tests/machine-translation.test.ts` fails if any of them shows Spanish without it.
 */
import type { Language } from "../api/types.ts";

/** Languages whose text on this site is machine-translated and unreviewed. */
export const MACHINE_TRANSLATED: ReadonlySet<Language> = new Set<Language>(["es"]);

export function isMachineTranslated(lang: Language): boolean {
  return MACHINE_TRANSLATED.has(lang);
}

/** The notice, in each language, rendered under its own `lang` attribute. */
export const MACHINE_TRANSLATION_NOTICE = {
  es: {
    lead: "Traducción automática, sin revisión humana.",
    body:
      "El español de este sitio lo tradujo una máquina y ninguna persona calificada lo ha " +
      "revisado. La versión en inglés es la de referencia.",
    link: "Consulte la versión en inglés",
  },
  en: {
    lead: "Machine-translated, not reviewed by a person.",
    body:
      "The Spanish on this site was translated by machine and has not been reviewed by a " +
      "qualified person. The English version is the reference.",
    link: "See the English version",
  },
} as const;

/** The attribute that marks the notice, so tests count the element rather than a class name. */
export const NOTICE_ATTR = "data-machine-translation-notice";

/** Marks the notice's English link, which `aimEnglishLink` points at the page's twin. */
export const ENGLISH_LINK_ATTR = "data-mt-english";

/** Where the English link goes when nothing aims it: the English home page. */
export const DEFAULT_ENGLISH_HREF = "/";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * The notice's HTML for a page in `lang`, or `""` when `lang` is not machine-translated
 * (English is the reference; a notice there would be false).
 */
export function machineTranslationNoticeHtml(lang: Language): string {
  if (!isMachineTranslated(lang)) return "";
  const { es, en } = MACHINE_TRANSLATION_NOTICE;
  return (
    `<div class="mt-notice" ${NOTICE_ATTR}>\n` +
    `    <p lang="es"><strong>${esc(es.lead)}</strong> ${esc(es.body)}</p>\n` +
    `    <p lang="en"><strong>${esc(en.lead)}</strong> ${esc(en.body)}</p>\n` +
    `    <p><a href="${DEFAULT_ENGLISH_HREF}" ${ENGLISH_LINK_ATTR} hreflang="en">` +
    `<span lang="es">${esc(es.link)}</span> · <span lang="en">${esc(en.link)}</span></a></p>\n` +
    `  </div>`
  );
}

/**
 * The same URL in English: every parameter kept, the language parameters removed (English
 * is the default, so no parameter is the canonical English form). Path plus query only.
 */
export function englishHref(url: URL): string {
  const params = new URLSearchParams(url.search);
  params.delete("language");
  params.delete("lang");
  const query = params.toString();
  return `${url.pathname}${query ? `?${query}` : ""}`;
}

/** Point the notice's English link in `html` at `href`. A page without the notice is unchanged. */
export function aimEnglishLink(html: string, href: string): string {
  const unaimed = `<a href="${DEFAULT_ENGLISH_HREF}" ${ENGLISH_LINK_ATTR}`;
  return html.replace(unaimed, `<a href="${esc(href)}" ${ENGLISH_LINK_ATTR}`);
}

/**
 * The plain-text notice for a feed in `lang`, or `null` when `lang` is not machine-translated.
 * With `englishUrl`, it ends by naming the English feed in both languages.
 */
export function machineTranslationNoticeText(lang: Language, englishUrl?: string): string | null {
  if (!isMachineTranslated(lang)) return null;
  const { es, en } = MACHINE_TRANSLATION_NOTICE;
  const lead = `${es.lead} ${en.lead}`;
  return englishUrl ? `${lead} ${es.link} / ${en.link}: ${englishUrl}` : lead;
}
