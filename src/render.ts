// Accessible server-side rendering (WCAG 2.2 AA target, audit §E).
// Pages are usable with no client JavaScript; the form-fill page progressively
// enhances. Every page carries the persistent "information, not legal advice"
// disclosure (guardrail #2). Colour tokens meet AA contrast; focus is always
// visible; motion respects prefers-reduced-motion.

import type { Checklist, GroundedAnswer, CorpusRecord, Language } from "../api/types.ts";
import { DISCLOSURE } from "../api/citation.ts";

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const T = {
  en: {
    skip: "Skip to main content",
    bannerTitle: "Information, not legal advice",
    bannerBody: DISCLOSURE.aiAssisted, // title already carries the "not legal advice" sentence
    footer: "Your answers stay in your browser. Nothing you enter is sent to or stored on a server.",
    legalNav: "Legal and policies",
    termsLink: "Terms of Use",
    privacyLink: "Privacy",
    a11yLink: "Accessibility",
    verifyNote: "This is general information, not legal advice. Requirements change — always confirm with the official source linked on each step, and talk to a lawyer or legal-aid organization about your specific situation.",
    notFilingNote: "Filling this form here does not file it for you and is not legal advice. Review the official instructions and submit it yourself.",
    sources: "Sources",
    lastChecked: "last checked",
    needsRecheck: "Needs reverification — not shown as current.",
    discretionary: "Varies by court/clerk.",
    cost: "Cost",
    timeline: "Timeline",
    prereq: "Do first",
    step: "Step",
    print: "Print or save as PDF",
    startOver: "Start over",
    prepared: "Prepared on",
    packetIntro: "Your full plan, ready to print or save. It contains no information about you beyond the choices you made.",
    private: "Private mode: no account, nothing saved. Closing this tab erases everything.",
    notCovered: "Not yet covered",
    resumeTitle: "Save your progress (optional, on this device)",
    resumeIntro: "Save only your selections — no names — encrypted with a passphrase you choose. It stays on this device and is never sent anywhere. Forget the passphrase and it can't be recovered.",
    passLabel: "Passphrase",
    saveBtn: "Save (encrypted)",
    resumeBtn: "Resume",
    deleteBtn: "Delete saved",
  },
  es: {
    skip: "Saltar al contenido principal",
    bannerTitle: "Información, no asesoramiento legal",
    bannerBody: "Asistido por IA, basado en fuentes citadas.",
    footer: "Sus respuestas permanecen en su navegador. Nada de lo que escribe se envía ni se almacena en un servidor.",
    legalNav: "Legal y políticas",
    termsLink: "Términos de uso",
    privacyLink: "Privacidad",
    a11yLink: "Accesibilidad",
    verifyNote: "Esto es información general, no asesoramiento legal. Los requisitos cambian — confirme siempre con la fuente oficial enlazada en cada paso, y hable con un abogado o una organización de ayuda legal sobre su situación específica.",
    notFilingNote: "Llenar este formulario aquí no lo presenta por usted y no es asesoramiento legal. Revise las instrucciones oficiales y preséntelo usted mismo.",
    sources: "Fuentes",
    lastChecked: "verificado por última vez",
    needsRecheck: "Necesita reverificación — no se muestra como actual.",
    discretionary: "Varía según el tribunal/secretario.",
    cost: "Costo",
    timeline: "Tiempo estimado",
    prereq: "Hacer primero",
    step: "Paso",
    print: "Imprimir o guardar como PDF",
    startOver: "Empezar de nuevo",
    prepared: "Preparado el",
    packetIntro: "Su plan completo, listo para imprimir o guardar. No contiene información sobre usted más allá de las opciones que eligió.",
    private: "Modo privado: sin cuenta, nada se guarda. Cerrar esta pestaña borra todo.",
    notCovered: "Aún no cubierto",
    resumeTitle: "Guarde su progreso (opcional, en este dispositivo)",
    resumeIntro: "Guarde solo sus selecciones — sin nombres — cifradas con una contraseña que usted elige. Permanece en este dispositivo y nunca se envía a ningún lugar. Si olvida la contraseña, no se puede recuperar.",
    passLabel: "Contraseña",
    saveBtn: "Guardar (cifrado)",
    resumeBtn: "Reanudar",
    deleteBtn: "Eliminar lo guardado",
  },
} as const;

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

const STYLE = `
:root{--bg:${PALETTE.screen.bg};--fg:${PALETTE.screen.fg};--muted:${PALETTE.screen.muted};--accent:${PALETTE.screen.accent};--card:${PALETTE.screen.card};--warn:${PALETTE.screen.warn};--line:${PALETTE.screen.line}}
*{box-sizing:border-box}
body{margin:0;font:1rem/1.6 system-ui,sans-serif;background:var(--bg);color:var(--fg)}
a{color:var(--accent)}
a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
.skip{position:absolute;left:-9999px;top:0;background:var(--accent);color:#000;padding:.5rem 1rem}
.skip:focus{left:0;z-index:10}
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
export function uiStrings(lang: Language): (typeof T)[Language] {
  return T[lang];
}

export function page(opts: { lang: Language; title: string; heading: string; body: string }): string {
  const t = T[opts.lang];
  const langQ = opts.lang === "es" ? "?language=es" : ""; // preserve language on footer links
  return `<!doctype html>
<html lang="${opts.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(opts.title)}</title>
<style>${STYLE}</style>
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
    <a href="/accessibility${langQ}">${escapeHtml(t.a11yLink)}</a>
  </nav>
</footer>
</body>
</html>`;
}

function sourceList(records: CorpusRecord[], lang: Language): string {
  if (records.length === 0) return "";
  const t = T[lang];
  const items = records
    .map(
      (r) =>
        `<li><a href="${escapeHtml(r.source.url)}" rel="noopener noreferrer">${escapeHtml(r.source.title)}</a> — <span class="meta">${escapeHtml(t.lastChecked)} ${escapeHtml(r.source.last_verified)}</span></li>`,
    )
    .join("");
  return `<h3>${escapeHtml(t.sources)}</h3><ul>${items}</ul>`;
}

export function renderChecklist(checklist: Checklist, records: CorpusRecord[], lang: Language): string {
  const t = T[lang];
  const byId = new Map(records.map((r) => [r.id, r]));
  const steps = checklist.steps
    .map((s) => {
      const stepRecords = s.record_ids.map((id) => byId.get(id)).filter((r): r is CorpusRecord => !!r);
      const cost = s.cost
        ? `<p class="meta"><strong>${escapeHtml(t.cost)}:</strong> ${s.cost.amount_usd === null ? escapeHtml(s.cost.note ?? "varies") : "$" + s.cost.amount_usd}</p>`
        : "";
      const time = s.timeline ? `<p class="meta"><strong>${escapeHtml(t.timeline)}:</strong> ${escapeHtml(s.timeline.typical)}</p>` : "";
      const prereq = s.prerequisites.length
        ? `<p class="meta"><strong>${escapeHtml(t.prereq)}:</strong> ${s.prerequisites.map(escapeHtml).join(", ")}</p>`
        : "";
      const disc = s.discretionary ? `<p class="flag">${escapeHtml(t.discretionary)}</p>` : "";
      const stale = s.needs_reverification ? `<p class="flag" role="note">${escapeHtml(t.needsRecheck)}</p>` : "";
      const claims = stepRecords.map((r) => `<li>${escapeHtml(r.statement)}</li>`).join("");
      return `<li class="step">
  <h2>${escapeHtml(t.step)} ${s.order}: ${escapeHtml(s.title)}</h2>
  ${claims ? `<ul>${claims}</ul>` : ""}
  ${cost}${time}${prereq}${disc}${stale}
  ${sourceList(stepRecords, lang)}
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
  const t = T[lang];
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
        ? `<p class="meta"><strong>${escapeHtml(t.prereq)}:</strong> ${s.prerequisites.map(escapeHtml).join(", ")}</p>`
        : "";
      const disc = s.discretionary ? `<p class="flag">${escapeHtml(t.discretionary)}</p>` : "";
      const stale = s.needs_reverification ? `<p class="flag" role="note">${escapeHtml(t.needsRecheck)}</p>` : "";
      return `<li class="step">
  <h2>${escapeHtml(t.step)} ${s.order}: ${escapeHtml(s.title)}</h2>
  ${detail ? `<ul>${detail}</ul>` : ""}
  ${cost}${time}${prereq}${disc}${stale}
  ${sourceList(stepRecords, lang)}
</li>`;
    })
    .join("");
  const gaps = checklist.gaps.length
    ? `<section aria-label="${escapeHtml(t.notCovered)}"><h2>${escapeHtml(t.notCovered)}</h2><ul>${checklist.gaps
        .map((g) => `<li class="flag">${escapeHtml(g.document_type)}: ${escapeHtml(g.reason)}</li>`)
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
  return `<section aria-label="answer">${blocks}${sourceList(ans.cited_records, lang)}</section>`;
}
