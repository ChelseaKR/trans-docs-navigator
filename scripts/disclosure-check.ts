// Disclosure gate (guardrail #2, audit §D) — merge-blocking.
// Stronger than string-presence: every rendered page in EVERY language must carry the
// "information, not legal advice" + "AI-assisted" disclosure INSIDE the visible banner
// region (not just somewhere in the HTML), and every grounded answer — including
// refusals — must end with it. Checks all user-facing paths, not a single sample.

import { DISCLOSURE } from "../api/citation.ts";
import { answer } from "../api/guidance.ts";
import { buildChecklist } from "../api/checklist.ts";
import { loadCorpus } from "../api/corpus.ts";
import { formById } from "../api/forms.ts";
import { renderIntakePage, renderChecklistPage, renderPacketPage, renderFormFillPage } from "../src/pages.ts";
import { renderMovePage, renderPlanPage } from "../src/relocation.ts";
import { buildRelocationPlan } from "../api/relocation.ts";
import { renderCompareFormPage, renderCompareResultsPage } from "../src/compare.ts";
import { buildCompareTable } from "../api/compare.ts";
import { renderTermsPage, renderPrivacyPage, renderAccessibilityPage, renderMethodologyPage } from "../src/legal.ts";
import { renderTransparencyPage } from "../src/transparency.ts";
import { renderAnswer, page } from "../src/render.ts";
import type { Language } from "../api/types.ts";
import { pass, fail } from "./util.ts";

const problems: string[] = [];
const corpus = loadCorpus();

// Test-only injection point (tests/gate-efficacy): DISCLOSURE_POISON=1 strips the
// "not legal advice" phrase from one rendered page's banner, simulating a template
// regression (guardrail #2 silently dropped from a page). Inert unless the env var
// is exactly "1", so production behavior is unchanged.
const DISCLOSURE_POISON = process.env.DISCLOSURE_POISON === "1";
function poison(html: string): string {
  return DISCLOSURE_POISON ? html.replace(DISCLOSURE.notLegalAdvice, "") : html;
}

// Language-appropriate disclosure phrases that must appear in the visible banner.
const BANNER_PHRASES: Record<Language, string[]> = {
  en: [DISCLOSURE.notLegalAdvice, "AI-assisted"],
  es: ["Información, no asesoramiento legal", "Asistido por IA"],
};

/** Extract the <header role="banner"> … </header> region (the always-visible disclosure). */
function bannerRegion(html: string): string {
  const m = /<header role="banner">([\s\S]*?)<\/header>/.exec(html);
  return m ? m[1]! : "";
}

function checkPageDisclosure(name: string, html: string, lang: Language): void {
  const banner = bannerRegion(html);
  if (!banner) {
    problems.push(`${name}: no visible <header role="banner"> region`);
    return;
  }
  for (const phrase of BANNER_PHRASES[lang]) {
    if (!banner.includes(phrase)) problems.push(`${name} (${lang}): banner missing visible disclosure "${phrase}"`);
  }
}

// Every page must carry the banner disclosure AND footer links to the legal/policy pages.
const LEGAL_LINKS = [
  /href="\/terms/,
  /href="\/privacy/,
  /href="\/transparency/,
  /href="\/accessibility/,
  /href="\/methodology/,
];
function checkFooterLegalLinks(name: string, html: string): void {
  for (const re of LEGAL_LINKS) {
    if (!re.test(html)) problems.push(`${name}: footer missing legal/policy link ${re}`);
  }
}

for (const lang of ["en", "es"] as Language[]) {
  const cl = buildChecklist({ jurisdiction: "US-CA", change_types: ["name", "gender-marker"], documents: [], language: lang });
  // The relocation planner is a full user-facing surface and rides the SAME disclosure
  // gate as every other page: banner in both languages, legal footer, no exceptions.
  const plan = buildRelocationPlan({
    origin: "US-TX",
    destination: "US-WA",
    held: [],
    change_types: ["name", "gender-marker"],
    language: lang,
  });
  const pages: [string, string][] = [
    ["intake", renderIntakePage(lang)],
    ["checklist", poison(renderChecklistPage(cl, corpus, lang))],
    ["packet", renderPacketPage(cl, corpus, lang, "2026-05-31")],
    ["move", renderMovePage(lang)],
    ["plan", renderPlanPage(plan, corpus, lang)],
    ["compare-form", renderCompareFormPage(lang)],
    ["compare-results", renderCompareResultsPage(buildCompareTable({ documents: [], change_types: [] }), corpus, lang)],
    ["form-fill", renderFormFillPage(formById("us-ss-5")!, lang)],
    ["answer-page", page({ lang, title: "A", heading: "A", body: renderAnswer(answer({ jurisdiction: "US-CA", change_types: ["name"], language: lang }), lang) })],
    ["terms", renderTermsPage(lang)],
    ["privacy", renderPrivacyPage(lang)],
    ["accessibility", renderAccessibilityPage(lang)],
    ["methodology", renderMethodologyPage(lang)],
    ["transparency", renderTransparencyPage(lang)],
  ];
  for (const [name, htmlStr] of pages) {
    checkPageDisclosure(name, htmlStr, lang);
    checkFooterLegalLinks(name, htmlStr);
  }
}

// Every grounded answer — grounded AND refusal, EN AND ES — must end with the disclaimer.
const answerCases: { name: string; query: Parameters<typeof answer>[0] }[] = [
  { name: "grounded-en", query: { jurisdiction: "US-CA", change_types: ["name"] } },
  { name: "grounded-es", query: { jurisdiction: "US-CA", change_types: ["name"], language: "es" } },
  { name: "refusal-en", query: { jurisdiction: "US-PR", change_types: ["name"] } },
  { name: "refusal-es", query: { jurisdiction: "US-PR", change_types: ["name"], language: "es" } },
];
for (const c of answerCases) {
  const ans = answer(c.query);
  const last = ans.blocks[ans.blocks.length - 1];
  const expect = c.name.endsWith("-es") ? "Información, no asesoramiento legal" : DISCLOSURE.notLegalAdvice;
  if (!last || !last.text.includes(expect)) {
    problems.push(`answer ${c.name}: final block does not carry the legal-advice disclaimer`);
  }
}

if (problems.length > 0) fail("disclosure", `${problems.length} missing/invisible disclosure(s)`, problems);
pass("disclosure", "info-not-advice + AI-assisted disclosures visible in the banner on every page/lang, and trailing on every answer");
