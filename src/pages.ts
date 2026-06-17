// Page assembly: the intake form, the checklist page, and the client-side
// form-fill page. The intake form collects NO PII — only jurisdiction, change
// types, documents, and language — and submits via GET (no request body, no PII
// on the wire). Identity fields are collected only on the form-fill page and
// filled entirely in the browser.

import type { Checklist, CorpusRecord, DocumentType, FormDef, Language } from "../api/types.ts";
import { page, renderChecklist, renderPacket, uiStrings, escapeHtml, gapReason, fieldLabel } from "./render.ts";
import { t as locale, SUPPORTED_LOCALES } from "./i18n/index.ts";
import { guideLinksFor } from "./guide.ts";
import { toResumeState } from "./secure-resume.ts";

const JURISDICTIONS: { id: string; label: string }[] = [
  { id: "US-CA", label: "California" },
  { id: "US-IL", label: "Illinois" },
  { id: "US-NY", label: "New York" },
  { id: "US-TX", label: "Texas" },
  { id: "US-WA", label: "Washington" },
];
const DOCUMENT_IDS: DocumentType[] = ["court-order", "ssa-card", "drivers-license", "passport", "birth-certificate", "financial-records"];

export function renderIntakePage(lang: Language = "en"): string {
  const s = uiStrings(lang);
  const jOpts = JURISDICTIONS.map((j) => `<option value="${j.id}">${escapeHtml(j.label)}</option>`).join("");
  const ct = (["name", "gender-marker"] as const)
    .map(
      (c) =>
        `<label><input type="checkbox" name="change" value="${c}" checked> ${escapeHtml(c === "name" ? s.changeNameLabel : s.changeMarkerLabel)}</label>`,
    )
    .join("");
  const docs = DOCUMENT_IDS.map(
    (d) => `<label><input type="checkbox" name="doc" value="${d}"> ${escapeHtml(locale(lang).docLabels[d])}</label>`,
  ).join("");

  const body = `
<p>${escapeHtml(s.intakeLead)}</p>
<p class="meta" role="note">🔒 ${escapeHtml(s.private)}</p>
<form action="/checklist" method="get" aria-label="${escapeHtml(s.intakeHeading)}">
  <fieldset>
    <legend>${escapeHtml(s.whereLive)}</legend>
    <label for="jurisdiction">${escapeHtml(s.stateLabel)}</label>
    <select id="jurisdiction" name="jurisdiction" required>${jOpts}</select>
  </fieldset>
  <fieldset>
    <legend>${escapeHtml(s.whatChanging)}</legend>
    ${ct}
  </fieldset>
  <fieldset>
    <legend>${escapeHtml(s.whichDocs)}</legend>
    ${docs}
  </fieldset>
  <fieldset>
    <legend>${escapeHtml(s.languageLegend)}</legend>
    <label for="language">${escapeHtml(s.languageLegend)}</label>
    <select id="language" name="language">
      ${SUPPORTED_LOCALES.map((l) => `<option value="${l.language}"${lang === l.language ? " selected" : ""}>${escapeHtml(l.selfName)}</option>`).join("\n      ")}
    </select>
  </fieldset>
  <button type="submit">${escapeHtml(s.submitChecklist)}</button>
</form>
<p><a href="/guide">${escapeHtml(locale(lang).seo.guideIndexTitle)}</a></p>`;
  return page({
    lang,
    title: locale(lang).seo.homeTitle,
    heading: s.intakeHeading,
    body,
    seo: { path: "/", description: locale(lang).seo.homeDescription, index: true },
  });
}

export function renderChecklistPage(
  checklist: Checklist,
  records: CorpusRecord[],
  lang: Language,
  query = "",
  opts: { thinnerCoverage?: boolean } = {},
): string {
  const s = uiStrings(lang);
  const coverageNote = opts.thinnerCoverage ? `<p class="flag" role="note">${escapeHtml(s.thinnerCoverage)}</p>` : "";
  const intro = `<p>${escapeHtml(s.checklistIntro)}</p>
<p class="flag" role="note">${escapeHtml(s.verifyNote)}</p>${coverageNote}`;
  const q = query ? `?${query}` : "";
  const actions = `<p class="no-print"><a href="/packet${q}">📄 ${escapeHtml(s.print)}</a> · <a href="/">${escapeHtml(s.startOver)}</a></p>`;
  const gaps = checklist.gaps.length
    ? `<section aria-label="${escapeHtml(s.notCovered)}"><h2>${escapeHtml(s.notCovered)}</h2><ul>${checklist.gaps
        .map((g) => `<li class="flag">${escapeHtml(locale(lang).docLabels[g.document_type])}: ${escapeHtml(gapReason(lang, g.reason))}</li>`)
        .join("")}</ul></section>`
    : "";
  // Reassuring empty-state instead of a bare empty list when nothing could be produced.
  const hasSteps = checklist.steps.length > 0;
  const noSteps = !hasSteps
    ? `<p class="flag" role="note">${escapeHtml(s.noStepsLead)}</p><p class="no-print"><a href="/">${escapeHtml(s.backToStart)}</a></p>`
    : renderChecklist(checklist, records, lang);

  // Plan summary: step count + an honest estimated cost (sum of known amounts; "+"
  // when some steps vary; "varies" when none are fixed).
  let known = 0;
  let anyVaries = false;
  for (const st of checklist.steps) {
    if (!st.cost) continue;
    if (st.cost.amount_usd === null) anyVaries = true;
    else known += st.cost.amount_usd;
  }
  const costText = known > 0 ? `$${known}${anyVaries ? "+" : ""}` : anyVaries ? s.varies : "";
  const summary = hasSteps
    ? `<p class="plan-summary"><strong>${checklist.steps.length} ${escapeHtml(s.stepsLabel)}</strong>${costText ? ` · ${escapeHtml(s.estimatedCost)}: ${escapeHtml(costText)}` : ""}</p>
<p id="progress-count" class="meta no-print" role="status" aria-live="polite"></p>`
    : "";

  // "Go deeper": the matching state guides + the detailed grounded answer, which the
  // checklist flow previously left unreachable.
  const guides = guideLinksFor(checklist.jurisdiction, checklist.change_types, lang);
  const more = hasSteps
    ? `<section class="more no-print" aria-labelledby="more-h"><h2 id="more-h">${escapeHtml(s.moreHeading)}</h2><ul>${guides
        .map((g) => `<li><a href="${escapeHtml(g.path)}">${escapeHtml(g.label)}</a></li>`)
        .join("")}<li><a href="/answer${q}">${escapeHtml(s.seeDetailedAnswer)}</a></li></ul></section>`
    : "";

  // Client-side, local-only progress (privacy-safe, like the resume panel).
  const progress = hasSteps
    ? `${jsonIsland("progress-cfg", { key: `tdn.progress.${query}`, template: s.progressTemplate })}
<script type="module" src="/assets/progress.js"></script>`
    : "";

  const body = intro + summary + actions + noSteps + more + gaps + renderResumePanel(s, query) + progress;
  return page({ lang, title: s.checklistTitle, heading: s.checklistHeading, body });
}

/** JSON island: config data for a static client script. `<` is escaped so markup in a
 *  value can never close the tag; type="application/json" means it is data, never executed. */
function jsonIsland(id: string, value: unknown): string {
  return `<script type="application/json" id="${id}">${JSON.stringify(value).replace(/</g, "\\u003c")}</script>`;
}

/**
 * Optional client-side encrypted save/resume (§2.5). Saves ONLY the non-PII selection
 * query, AES-GCM-encrypted with a passphrase, into localStorage — never to a server, and
 * never any identity field. The behavior lives in the static module
 * /assets/resume-panel.js (crypto in /assets/resume-crypto.js, the same module the test
 * suite exercises); this function only emits markup + a JSON config island, so the page
 * carries no inline script. Progressive enhancement: no-JS users simply don't see it.
 * Hidden when there's no selection yet.
 */
function renderResumePanel(s: ReturnType<typeof uiStrings>, query: string): string {
  if (!query) return "";
  // Defense-in-depth: persist ONLY the allowlisted non-PII selection keys, regardless of
  // what query reached this page. Identity fields can never be saved even if a future
  // caller passed a richer query string.
  const safeQuery = toResumeState(new URLSearchParams(query)).toString();
  if (!safeQuery) return "";
  const cfg = {
    query: safeQuery,
    M: { enterPass: s.resEnterPass, saved: s.resSaved, nothing: s.resNothing, wrong: s.resWrong, deleted: s.resDeleted },
  };
  return `
<section class="no-print" aria-labelledby="resume-h">
  <h2 id="resume-h">${escapeHtml(s.resumeTitle)}</h2>
  <p class="meta">${escapeHtml(s.resumeIntro)}</p>
  <div id="resume" role="group" aria-labelledby="resume-h">
    <label for="resume-pass">${escapeHtml(s.passLabel)}</label>
    <input id="resume-pass" type="password" autocomplete="off" autocapitalize="off" spellcheck="false">
    <button type="button" id="resume-save">${escapeHtml(s.saveBtn)}</button>
    <button type="button" id="resume-load">${escapeHtml(s.resumeBtn)}</button>
    <button type="button" id="resume-del">${escapeHtml(s.deleteBtn)}</button>
    <p id="resume-status" role="status" aria-live="polite" class="meta"></p>
  </div>
</section>
${jsonIsland("resume-cfg", cfg)}
<script type="module" src="/assets/resume-panel.js"></script>`;
}

/** M5 printable packet: the full plan, print-optimized, with a print button (no-JS-friendly). */
export function renderPacketPage(
  checklist: Checklist,
  records: CorpusRecord[],
  lang: Language,
  generatedOn: string,
): string {
  const s = uiStrings(lang);
  const actions = `<p class="no-print"><button type="button" id="print-btn">🖨️ ${escapeHtml(s.print)}</button> <a href="/">${escapeHtml(s.startOver)}</a></p>
<script type="module" src="/assets/packet.js"></script>`;
  const body = actions + renderPacket(checklist, records, lang, generatedOn);
  return page({ lang, title: s.packetTitle, heading: s.packetHeading, body });
}

/**
 * Client-side form-fill page. The blank form + field map are sent to the browser;
 * the user's name(s) are typed in and the PDF is filled with pdf-lib entirely
 * client-side, then downloaded. Nothing is posted back. Flat scans degrade to
 * download-and-instructions.
 */
export function renderFormFillPage(form: FormDef, lang: Language = "en"): string {
  const s = uiStrings(lang);
  if (!form.fillable) {
    const body = `
<p>${escapeHtml(s.flatScanIntro)}</p>
<p><a href="${escapeHtml(form.source.url)}" rel="noopener noreferrer">${escapeHtml(form.title)}</a></p>
<p class="flag" role="note">${escapeHtml(s.notFilingNote)}</p>`;
    return page({ lang, title: form.title, heading: form.title, body });
  }

  const inputs = form.field_map
    .map((m) => {
      const label = fieldLabel(lang, m.intake_key);
      if (m.kind === "checkbox") {
        return `<label><input type="checkbox" data-key="${m.intake_key}"> ${escapeHtml(label)}</label>`;
      }
      return `<label for="f_${m.intake_key}">${escapeHtml(label)}</label>
        <input id="f_${m.intake_key}" type="text" data-key="${m.intake_key}" autocomplete="off">`;
    })
    .join("");

  const cfg = {
    template: `/${form.template_path}`,
    fieldMap: form.field_map,
    filename: `${form.id}-filled.pdf`,
    M: { filling: s.fillFilling, done: s.fillDone, unfilled: s.fillUnfilled, error: s.fillError },
  };

  // pdf-lib loads as a classic script (sets the PDFLib global, SRI-pinned); the fill
  // logic is the static module /assets/form-fill.js reading the #fill-cfg island.
  // Module scripts run after parsing, so PDFLib is always defined first.
  const body = `
<p><strong>${escapeHtml(s.privacyLabel)}</strong> ${escapeHtml(s.formPrivacy)}</p>
<p class="flag" role="note">${escapeHtml(s.notFilingNote)}</p>
<form id="fill" aria-label="${escapeHtml(form.title)}">
  <fieldset><legend>${escapeHtml(form.title)}</legend>${inputs}</fieldset>
  <button type="submit">${escapeHtml(s.fillDownload)}</button>
  <p id="status" role="status" aria-live="polite"></p>
</form>
${jsonIsland("fill-cfg", cfg)}
<script src="/vendor/pdf-lib.min.js" integrity="sha256-D5pcrQeUHwgmWGyU4InYm5GMRuXBfPLVo8b2ZuO8aU8=" crossorigin="anonymous"></script>
<script type="module" src="/assets/form-fill.js"></script>`;
  return page({ lang, title: form.title, heading: form.title, body });
}
