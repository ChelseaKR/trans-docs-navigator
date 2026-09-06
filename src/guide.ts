// Indexable guide pages — the SEO content surface (docs/SEO-PLAN.md Phase 2).
//
// The valuable, search-worthy content (cited, current, state-specific steps) otherwise
// only exists behind a form at user-state URLs we deliberately keep out of the index.
// These pages render that same corpus content as readable prose at stable, clean URLs
// (/guide/<state>/<topic>), with HowTo + Breadcrumb structured data, and funnel into
// the interactive checklist. The guide is the front door; the app is the tool behind it.
//
// Every page is built from the corpus, so a newly verified record enriches its guide
// automatically and the structured data can never drift from the visible content.

import type { ChangeType, CorpusRecord, Language } from "../api/types.ts";
import { buildChecklist } from "../api/checklist.ts";
import { loadCorpus } from "../api/corpus.ts";
import { page, renderChecklist, escapeHtml } from "./render.ts";
import { t as locale } from "./i18n/index.ts";
import { absoluteUrl, jsonLd } from "./seo.ts";

interface StateDef {
  slug: string;
  id: string;
  name: Record<Language, string>;
}

// The states we currently cover. Federal steps (SSA, passport) are woven into each
// guide by the checklist builder, so they need no separate page.
const STATES: StateDef[] = [
  { slug: "alabama", id: "US-AL", name: { en: "Alabama", es: "Alabama" } },
  { slug: "arkansas", id: "US-AR", name: { en: "Arkansas", es: "Arkansas" } },
  { slug: "arizona", id: "US-AZ", name: { en: "Arizona", es: "Arizona" } },
  { slug: "california", id: "US-CA", name: { en: "California", es: "California" } },
  { slug: "delaware", id: "US-DE", name: { en: "Delaware", es: "Delaware" } },
  { slug: "maine", id: "US-ME", name: { en: "Maine", es: "Maine" } },
  { slug: "new-hampshire", id: "US-NH", name: { en: "New Hampshire", es: "Nuevo Hampshire" } },
  { slug: "florida", id: "US-FL", name: { en: "Florida", es: "Florida" } },
  { slug: "georgia", id: "US-GA", name: { en: "Georgia", es: "Georgia" } },
  { slug: "colorado", id: "US-CO", name: { en: "Colorado", es: "Colorado" } },
  { slug: "illinois", id: "US-IL", name: { en: "Illinois", es: "Illinois" } },
  { slug: "louisiana", id: "US-LA", name: { en: "Louisiana", es: "Luisiana" } },
  { slug: "maryland", id: "US-MD", name: { en: "Maryland", es: "Maryland" } },
  { slug: "massachusetts", id: "US-MA", name: { en: "Massachusetts", es: "Massachusetts" } },
  { slug: "michigan", id: "US-MI", name: { en: "Michigan", es: "Michigan" } },
  { slug: "minnesota", id: "US-MN", name: { en: "Minnesota", es: "Minnesota" } },
  { slug: "mississippi", id: "US-MS", name: { en: "Mississippi", es: "Misisipi" } },
  { slug: "north-carolina", id: "US-NC", name: { en: "North Carolina", es: "Carolina del Norte" } },
  { slug: "nevada", id: "US-NV", name: { en: "Nevada", es: "Nevada" } },
  { slug: "new-jersey", id: "US-NJ", name: { en: "New Jersey", es: "Nueva Jersey" } },
  { slug: "new-york", id: "US-NY", name: { en: "New York", es: "Nueva York" } },
  { slug: "pennsylvania", id: "US-PA", name: { en: "Pennsylvania", es: "Pensilvania" } },
  { slug: "ohio", id: "US-OH", name: { en: "Ohio", es: "Ohio" } },
  { slug: "oklahoma", id: "US-OK", name: { en: "Oklahoma", es: "Oklahoma" } },
  { slug: "tennessee", id: "US-TN", name: { en: "Tennessee", es: "Tennessee" } },
  { slug: "oregon", id: "US-OR", name: { en: "Oregon", es: "Oregón" } },
  { slug: "south-carolina", id: "US-SC", name: { en: "South Carolina", es: "Carolina del Sur" } },
  { slug: "texas", id: "US-TX", name: { en: "Texas", es: "Texas" } },
  { slug: "virginia", id: "US-VA", name: { en: "Virginia", es: "Virginia" } },
  { slug: "washington", id: "US-WA", name: { en: "Washington", es: "Washington" } },
  { slug: "kansas", id: "US-KS", name: { en: "Kansas", es: "Kansas" } },
  { slug: "nebraska", id: "US-NE", name: { en: "Nebraska", es: "Nebraska" } },
  { slug: "south-dakota", id: "US-SD", name: { en: "South Dakota", es: "Dakota del Sur" } },
];

const TOPICS: { slug: string; change: ChangeType }[] = [
  { slug: "name-change", change: "name" },
  { slug: "gender-marker", change: "gender-marker" },
];

const stateBySlug = (slug: string) => STATES.find((s) => s.slug === slug);
const topicBySlug = (slug: string) => TOPICS.find((t) => t.slug === slug);

/** Every indexable guide URL (path only), for the sitemap. */
export function guidePaths(): string[] {
  const paths = ["/guide"];
  for (const s of STATES) for (const t of TOPICS) paths.push(`/guide/${s.slug}/${t.slug}`);
  return paths;
}

/** The full set of indexable paths (home + guides + legal) — single source for the
 *  sitemap and the seo-lint gate. */
export function indexablePaths(): string[] {
  return ["/", ...guidePaths(), "/terms", "/privacy", "/accessibility", "/methodology", "/transparency"];
}

/** Guide links matching a checklist's jurisdiction × change types (empty if none cover it). */
export function guideLinksFor(jurisdiction: string, changeTypes: ChangeType[], lang: Language): { path: string; label: string }[] {
  const state = STATES.find((s) => s.id === jurisdiction);
  if (!state) return [];
  const seo = locale(lang).seo;
  const out: { path: string; label: string }[] = [];
  for (const c of changeTypes) {
    const topic = TOPICS.find((t) => t.change === c);
    if (!topic) continue;
    out.push({
      path: `/guide/${state.slug}/${topic.slug}${lang === "es" ? "?language=es" : ""}`,
      label: seo.guideHeading(state.name[lang], seo.topicName[c]),
    });
  }
  return out;
}

/** The /guide index: links to every state × topic guide, grouped by state. */
export function renderGuideIndex(lang: Language): string {
  const seo = locale(lang).seo;
  const items = STATES.map((s) => {
    const links = TOPICS.map(
      (t) => `<li><a href="/guide/${s.slug}/${t.slug}${lang === "es" ? "?language=es" : ""}">${escapeHtml(seo.topicName[t.change])}</a></li>`,
    ).join("");
    return `<section><h2>${escapeHtml(s.name[lang])}</h2><ul>${links}</ul></section>`;
  }).join("\n");
  const body = `<p>${escapeHtml(seo.guideIndexLead)}</p><h2 class="sr-only">${escapeHtml(seo.guideIndexAllHeading)}</h2>${items}`;
  return page({
    lang,
    title: seo.guideIndexTitle,
    heading: seo.guideIndexTitle,
    body,
    seo: { path: "/guide", description: seo.guideIndexDescription, index: true },
  });
}

/** A single guide page, or null if the state/topic slugs don't resolve (→ 404). */
export function renderGuidePage(stateSlug: string, topicSlug: string, lang: Language): string | null {
  const state = stateBySlug(stateSlug);
  const topic = topicBySlug(topicSlug);
  if (!state || !topic) return null;

  const seo = locale(lang).seo;
  const ui = locale(lang).ui;
  const stateName = state.name[lang];
  const topicName = seo.topicName[topic.change];
  const path = `/guide/${state.slug}/${topic.slug}`;

  const corpus = loadCorpus();
  const checklist = buildChecklist({ jurisdiction: state.id, change_types: [topic.change], documents: [], language: lang }, undefined, corpus);
  const byId = new Map(corpus.map((r) => [r.id, r]));

  // Page-level "last reviewed" = the most recent verification among shown records.
  const shownDates = checklist.steps
    .flatMap((s) => s.record_ids)
    .map((id) => byId.get(id)?.source.last_verified)
    .filter((d): d is string => !!d)
    .sort();
  const reviewed = shownDates[shownDates.length - 1];

  const langQ = lang === "es" ? "&language=es" : "";
  const cta = `<p class="cta"><a href="/checklist?jurisdiction=${state.id}&change=${topic.change}${langQ}">${escapeHtml(seo.guideCta)} →</a></p>`;
  const reviewedNote = reviewed ? `<p class="meta">${escapeHtml(seo.guideReviewed)} ${escapeHtml(reviewed)}.</p>` : "";

  const breadcrumb = `<nav aria-label="Breadcrumb" class="breadcrumb"><a href="/${lang === "es" ? "?language=es" : ""}">${escapeHtml(seo.breadcrumbHome)}</a> › <a href="/guide${lang === "es" ? "?language=es" : ""}">${escapeHtml(seo.breadcrumbGuides)}</a> › ${escapeHtml(seo.guideHeading(stateName, topicName))}</nav>`;

  const body = [
    breadcrumb,
    `<p>${escapeHtml(seo.guideLead(stateName, topicName))}</p>`,
    `<p class="flag" role="note">${escapeHtml(ui.verifyNote)}</p>`,
    cta,
    renderChecklist(checklist, corpus, lang),
    cta,
    reviewedNote,
    structuredData(state, topic, lang, checklist, byId),
  ].join("\n");

  return page({
    lang,
    title: seo.guideTitle(stateName, topicName),
    heading: seo.guideHeading(stateName, topicName),
    body,
    seo: { path, description: seo.guideDescription(stateName, topicName), index: true },
  });
}

/** HowTo + BreadcrumbList JSON-LD, derived entirely from the rendered checklist. */
function structuredData(
  state: StateDef,
  topic: { slug: string; change: ChangeType },
  lang: Language,
  checklist: ReturnType<typeof buildChecklist>,
  byId: Map<string, CorpusRecord>,
): string {
  const seo = locale(lang).seo;
  const stateName = state.name[lang];
  const topicName = seo.topicName[topic.change];
  const path = `/guide/${state.slug}/${topic.slug}`;

  const howTo = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: seo.guideTitle(stateName, topicName),
    description: seo.guideDescription(stateName, topicName),
    inLanguage: lang,
    step: checklist.steps.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.title,
      text: s.record_ids.map((id) => byId.get(id)?.statement).filter(Boolean).join(" ") || s.title,
    })),
  };

  const crumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: seo.breadcrumbHome, item: absoluteUrl("/", lang) },
      { "@type": "ListItem", position: 2, name: seo.breadcrumbGuides, item: absoluteUrl("/guide", lang) },
      { "@type": "ListItem", position: 3, name: seo.guideHeading(stateName, topicName), item: absoluteUrl(path, lang) },
    ],
  };

  return jsonLd([howTo, crumbs]);
}
