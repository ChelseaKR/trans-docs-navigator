// Accessible server-side rendering (WCAG 2.2 AA target, audit §E).
// Pages are usable with no client JavaScript; the form-fill page progressively
// enhances. Every page carries the persistent "information, not legal advice"
// disclosure (guardrail #2). Colour tokens meet AA contrast; focus is always
// visible; motion respects prefers-reduced-motion.

import type { Checklist, GroundedAnswer, CorpusRecord, DocumentType, Language } from "../api/types.ts";
import { DISCLOSURE } from "../api/citation.ts";
import { TITLES as EN_TITLES } from "../api/checklist.ts";

/** Localized step titles (full) and short document labels for prerequisites/gaps. */
export const DOC_TITLES: Record<Language, Record<DocumentType, string>> = {
  en: EN_TITLES,
  es: {
    "court-order": "Obtenga una orden judicial para su cambio de nombre",
    "ssa-card": "Actualice su registro del Seguro Social",
    "drivers-license": "Actualice su licencia de conducir o identificación estatal",
    passport: "Actualice su pasaporte de EE. UU.",
    "birth-certificate": "Modifique su acta de nacimiento",
    "financial-records": "Actualice registros financieros y otros",
  },
};
export const DOC_LABELS: Record<Language, Record<DocumentType, string>> = {
  en: {
    "court-order": "Court order",
    "ssa-card": "Social Security card",
    "drivers-license": "Driver's license / state ID",
    passport: "U.S. passport",
    "birth-certificate": "Birth certificate",
    "financial-records": "Financial & other records",
  },
  es: {
    "court-order": "Orden judicial",
    "ssa-card": "Tarjeta de Seguro Social",
    "drivers-license": "Licencia de conducir / identificación estatal",
    passport: "Pasaporte de EE. UU.",
    "birth-certificate": "Acta de nacimiento",
    "financial-records": "Registros financieros y otros",
  },
};
/** Localized gap-reason sentence from the language table. */
export function gapReason(lang: Language, reason: "no-records" | "all-degraded"): string {
  return reason === "no-records" ? T[lang].gapNoRecords : T[lang].gapAllDegraded;
}

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
    intakeHeading: "Plan your legal name and gender-marker changes",
    intakeLead: "Answer a few questions and get a personalized, ordered checklist with the right forms and official sources for your state. You can also use this without entering any personal details.",
    whereLive: "Where do you live?",
    stateLabel: "State",
    whatChanging: "What are you changing?",
    changeNameLabel: "Legal name",
    changeMarkerLabel: "Gender marker",
    whichDocs: "Which documents do you want to update? (leave all unchecked for the recommended set)",
    languageLegend: "Language",
    submitChecklist: "Show my checklist",
    checklistTitle: "Your checklist",
    checklistHeading: "Your personalized checklist",
    checklistIntro: "Your steps are listed in the order most people complete them. Each links to its official source and the date it was last checked.",
    packetTitle: "Your packet",
    packetHeading: "Your name & gender-marker change packet",
    answerHeading: "What the sources say",
    formPrivacy: "What you type here stays in your browser. The form is filled on your device and never sent anywhere.",
    fillDownload: "Fill & download",
    flatScanIntro: "This official form is a flat scan that can't be auto-filled. Download the blank form and complete it by hand:",
    gapNoRecords: "We don't have verified steps for this yet. Check your state's official website or a trans legal-aid organization.",
    gapAllDegraded: "The information we have for this may have changed and needs reverification — we won't show it as current. Check the official source.",
    noStepsLead: "We couldn't build any verified steps for these choices yet.",
    notFoundHeading: "Page not found",
    notFoundBody: "We couldn't find that page.",
    badRequestHeading: "Invalid request",
    badRequestBody: "That isn't a state we recognize. Please pick one from the list.",
    methodHeading: "Method not allowed",
    methodBody: "Please use GET.",
    backToChecklist: "Back to your checklist",
    backToStart: "Start over",
    privacyLabel: "Privacy:",
    resEnterPass: "Enter a passphrase first.",
    resSaved: "Saved on this device, encrypted. Nothing was sent anywhere.",
    resNothing: "Nothing saved on this device.",
    resWrong: "Wrong passphrase, or the saved data was changed.",
    resDeleted: "Deleted from this device.",
    fillFilling: "Filling on your device…",
    fillDone: "Done — your filled form downloaded. It was never sent to a server.",
    fillUnfilled: "Downloaded. These field(s) could not be auto-filled — please complete them by hand: ",
    fillError: "Could not fill the form. You can download the blank form instead.",
    thinnerCoverage: "Full steps in your language for this state aren't ready yet. Federal steps are shown; switch to English to see more.",
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
    intakeHeading: "Planifique sus cambios legales de nombre y marcador de género",
    intakeLead: "Responda algunas preguntas y obtenga una lista personalizada y ordenada con los formularios correctos y las fuentes oficiales para su estado. También puede usarla sin ingresar datos personales.",
    whereLive: "¿Dónde vive?",
    stateLabel: "Estado",
    whatChanging: "¿Qué está cambiando?",
    changeNameLabel: "Nombre legal",
    changeMarkerLabel: "Marcador de género",
    whichDocs: "¿Qué documentos desea actualizar? (deje todo sin marcar para el conjunto recomendado)",
    languageLegend: "Idioma",
    submitChecklist: "Mostrar mi lista",
    checklistTitle: "Su lista",
    checklistHeading: "Su lista personalizada",
    checklistIntro: "Sus pasos se enumeran en el orden en que la mayoría de las personas los completa. Cada uno enlaza a su fuente oficial y la fecha en que se verificó por última vez.",
    packetTitle: "Su paquete",
    packetHeading: "Su paquete de cambio de nombre y marcador de género",
    answerHeading: "Lo que dicen las fuentes",
    formPrivacy: "Lo que escribe aquí permanece en su navegador. El formulario se llena en su dispositivo y nunca se envía a ningún lugar.",
    fillDownload: "Llenar y descargar",
    flatScanIntro: "Este formulario oficial es una imagen escaneada que no se puede llenar automáticamente. Descargue el formulario en blanco y complételo a mano:",
    gapNoRecords: "Aún no tenemos pasos verificados para esto. Consulte el sitio web oficial de su estado o una organización de ayuda legal para personas trans.",
    gapAllDegraded: "La información que tenemos sobre esto puede haber cambiado y necesita reverificación; no la mostraremos como actual. Consulte la fuente oficial.",
    noStepsLead: "Todavía no pudimos crear pasos verificados para estas opciones.",
    notFoundHeading: "Página no encontrada",
    notFoundBody: "No pudimos encontrar esa página.",
    badRequestHeading: "Solicitud no válida",
    badRequestBody: "Ese no es un estado que reconozcamos. Por favor, elija uno de la lista.",
    methodHeading: "Método no permitido",
    methodBody: "Por favor, use GET.",
    backToChecklist: "Volver a su lista",
    backToStart: "Empezar de nuevo",
    privacyLabel: "Privacidad:",
    resEnterPass: "Ingrese una contraseña primero.",
    resSaved: "Guardado en este dispositivo, cifrado. No se envió nada a ningún lugar.",
    resNothing: "No hay nada guardado en este dispositivo.",
    resWrong: "Contraseña incorrecta, o los datos guardados fueron modificados.",
    resDeleted: "Eliminado de este dispositivo.",
    fillFilling: "Llenando en su dispositivo…",
    fillDone: "Listo: su formulario llenado se descargó. Nunca se envió a un servidor.",
    fillUnfilled: "Descargado. Estos campos no se pudieron llenar automáticamente; complételos a mano: ",
    fillError: "No se pudo llenar el formulario. Puede descargar el formulario en blanco.",
    thinnerCoverage: "Los pasos completos en español para este estado aún no están listos. Se muestran los pasos federales; cambie a inglés para ver más.",
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

// `level` keeps heading order correct: 3 inside a checklist step (under the step's h2),
// 2 on the standalone answer page (directly under the page h1, so no level is skipped).
function sourceList(records: CorpusRecord[], lang: Language, level: 2 | 3 = 3): string {
  if (records.length === 0) return "";
  const t = T[lang];
  const items = records
    .map(
      (r) =>
        `<li><a href="${escapeHtml(r.source.url)}" rel="noopener noreferrer">${escapeHtml(r.source.title)}</a> — <span class="meta">${escapeHtml(t.lastChecked)} ${escapeHtml(r.source.last_verified)}</span></li>`,
    )
    .join("");
  return `<h${level}>${escapeHtml(t.sources)}</h${level}><ul>${items}</ul>`;
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
        ? `<p class="meta"><strong>${escapeHtml(t.prereq)}:</strong> ${s.prerequisites.map((d) => escapeHtml(DOC_LABELS[lang][d as DocumentType] ?? d)).join(", ")}</p>`
        : "";
      const disc = s.discretionary ? `<p class="flag">${escapeHtml(t.discretionary)}</p>` : "";
      const stale = s.needs_reverification ? `<p class="flag" role="note">${escapeHtml(t.needsRecheck)}</p>` : "";
      const claims = stepRecords.map((r) => `<li>${escapeHtml(r.statement)}</li>`).join("");
      return `<li class="step">
  <h2>${escapeHtml(t.step)} ${s.order}: ${escapeHtml(DOC_TITLES[lang][s.document_type])}</h2>
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
        ? `<p class="meta"><strong>${escapeHtml(t.prereq)}:</strong> ${s.prerequisites.map((d) => escapeHtml(DOC_LABELS[lang][d as DocumentType] ?? d)).join(", ")}</p>`
        : "";
      const disc = s.discretionary ? `<p class="flag">${escapeHtml(t.discretionary)}</p>` : "";
      const stale = s.needs_reverification ? `<p class="flag" role="note">${escapeHtml(t.needsRecheck)}</p>` : "";
      return `<li class="step">
  <h2>${escapeHtml(t.step)} ${s.order}: ${escapeHtml(DOC_TITLES[lang][s.document_type])}</h2>
  ${detail ? `<ul>${detail}</ul>` : ""}
  ${cost}${time}${prereq}${disc}${stale}
  ${sourceList(stepRecords, lang)}
</li>`;
    })
    .join("");
  const gaps = checklist.gaps.length
    ? `<section aria-label="${escapeHtml(t.notCovered)}"><h2>${escapeHtml(t.notCovered)}</h2><ul>${checklist.gaps
        .map((g) => `<li class="flag">${escapeHtml(DOC_LABELS[lang][g.document_type])}: ${escapeHtml(gapReason(lang, g.reason))}</li>`)
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
