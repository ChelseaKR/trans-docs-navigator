// Named, vetted national organizations to hand off to whenever the tool can't fully
// help — a degraded step, a gap, an uncovered state, or a sensitive situation. The
// panel's recurring complaint was "honest dead end with no lifeline"; this is the
// lifeline. National orgs only (stable, reputable); link-check covers these URLs.

import type { Language } from "../api/types.ts";

export interface Referral {
  name: string;
  url: string;
  /** One-line description of what they help with, per language. */
  note: Record<Language, string>;
  /** True for orgs with explicit Spanish-language services. */
  spanish?: boolean;
}

export const REFERRALS: Referral[] = [
  {
    name: "A4TE — ID Documents Center",
    url: "https://transequality.org/documents",
    note: {
      en: "Free, state-by-state guide to updating the name and gender on every ID and record — covers all 50 states, including ones this tool doesn't.",
      es: "Guía gratuita, estado por estado, para actualizar el nombre y el género en todas las identificaciones y registros, incluidos estados que esta herramienta no cubre.",
    },
  },
  {
    name: "Transgender Law Center",
    url: "https://transgenderlawcenter.org",
    note: {
      en: "Legal information and help line for trans people, including sensitive situations.",
      es: "Información legal y línea de ayuda para personas trans, incluidas situaciones delicadas.",
    },
  },
  {
    name: "National Center for Lesbian Rights",
    url: "https://www.nclrights.org",
    note: {
      en: "Free legal help line for LGBTQ people across the country.",
      es: "Línea de ayuda legal gratuita para personas LGBTQ en todo el país.",
    },
  },
  {
    name: "TransLatin@ Coalition",
    url: "https://www.translatinacoalition.org",
    note: {
      en: "Support and services led by and for trans Latina/o/x people (Spanish-speaking).",
      es: "Apoyo y servicios dirigidos por y para personas trans latinas/os/x (en español).",
    },
    spanish: true,
  },
  {
    name: "Trans Lifeline",
    url: "https://translifeline.org",
    note: {
      en: "Peer support hotline and small grants — help if you're in crisis or can't afford fees.",
      es: "Línea de apoyo entre pares y pequeñas ayudas económicas si está en crisis o no puede pagar las tarifas.",
    },
    spanish: true,
  },
];

/** Render the help/referral block. `escape` is the caller's HTML-escaper. */
export function renderReferrals(lang: Language, heading: string, intro: string, escape: (s: string) => string): string {
  const items = REFERRALS.map(
    (r) =>
      `<li><a href="${escape(r.url)}" rel="noopener noreferrer">${escape(r.name)}</a>${r.spanish ? " 🗣️" : ""} — <span class="meta">${escape(r.note[lang])}</span></li>`,
  ).join("");
  return `<section class="help no-print" aria-labelledby="help-h">
  <h2 id="help-h">${escape(heading)}</h2>
  <p class="meta">${escape(intro)}</p>
  <ul>${items}</ul>
</section>`;
}
