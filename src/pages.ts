// Page assembly: the intake form, the checklist page, and the client-side
// form-fill page. The intake asks for jurisdiction, change types, documents, and
// language — not direct identity fields — and submits those selections via GET.
// Identity fields are entered only in the form-helper page and stay in the browser.

import type { Checklist, CorpusRecord, DocumentType, FormDef, Language } from "../api/types.ts";
import { page, renderChecklist, renderPacket, uiStrings, escapeHtml, gapReason, fieldLabel, preparationList, verificationCaption } from "./render.ts";
import { t as locale, SUPPORTED_LOCALES } from "./i18n/index.ts";
import { guideLinksFor } from "./guide.ts";
import { toResumeState } from "./secure-resume.ts";
import { staleAfterDays } from "./offline.ts";
import { isDriftWatchable } from "../api/watchability.ts";

const JURISDICTIONS: { id: string; label: string }[] = [
  { id: "US-CA", label: "California" },
  { id: "US-GA", label: "Georgia" },
  { id: "US-CO", label: "Colorado" },
  { id: "US-IL", label: "Illinois" },
  { id: "US-NY", label: "New York" },
  { id: "US-OH", label: "Ohio" },
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
  // Skippable, selection-only bookkeeping bit (same privacy class as change_types —
  // see docs/audits/dpia.md). It only lets the checklist annotate the court-order step
  // as already done and prune it from dependents' prerequisite lists; it is bookkeeping,
  // never individualized guidance, so the copy stays neutral.
  const courtOrderLabel = fieldLabel(lang, "has_court_order");

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
    <legend>${escapeHtml(courtOrderLabel)}</legend>
    <label><input type="checkbox" name="court_order" value="1"> ${escapeHtml(courtOrderLabel)}</label>
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
<p><a href="/move${lang === "es" ? "?language=es" : ""}">🚚 ${escapeHtml(locale(lang).relocation.planCta)}</a></p>
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
  opts: { thinnerCoverage?: boolean; noStateCoverage?: boolean } = {},
): string {
  const s = uiStrings(lang);
  const coverageNote = opts.thinnerCoverage ? `<p class="flag" role="note">${escapeHtml(s.thinnerCoverage)}</p>` : "";
  // The state itself is absent from the corpus: every step below is federal. Said BEFORE
  // the steps, because after them the page already reads as a finished plan.
  const stateNote = opts.noStateCoverage ? `<p class="flag" role="note">${escapeHtml(s.noStateCoverage)}</p>` : "";
  const intro = `<p>${escapeHtml(s.checklistIntro)}</p>
<p class="flag" role="note">${escapeHtml(s.verifyNote)}</p>${stateNote}${coverageNote}`;
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

  // Plan summary: step count + an honest estimated cost.
  //
  // Three distinct states have to stay distinguishable, because two of them are absences
  // and an absence must never be added to a total as if it were zero:
  //   • a stated amount              → add it
  //   • `amount_usd: null`           → the source names a fee but not a number ("varies")
  //   • no `cost` on the step at all → NO cited source prices this step (unpriced)
  // Unpriced steps used to be skipped silently, so a plan with a $435 court fee and an
  // unpriced DMV step rendered "Estimated cost: $435" — a floor presented as a total, on
  // the barrier users report as their biggest. They now count toward the "+" and are
  // stated outright, matching what the relocation planner already does (api/relocation.ts
  // costModel → `unpriced_step_keys`).
  let known = 0;
  let anyVaries = false;
  let unpriced = 0;
  for (const st of checklist.steps) {
    if (st.done) continue; // already-done steps (e.g. has_court_order) don't cost anything more
    if (!st.cost) {
      unpriced++;
      continue;
    }
    if (st.cost.amount_usd === null) anyVaries = true;
    else known += st.cost.amount_usd;
  }
  const incomplete = anyVaries || unpriced > 0;
  const costText = known > 0 ? `$${known}${incomplete ? "+" : ""}` : incomplete ? s.varies : "";
  const unpricedNote = unpriced > 0 ? `<p class="meta">${escapeHtml(s.costIncomplete(unpriced))}</p>` : "";
  const summary = hasSteps
    ? `<p class="plan-summary"><strong>${checklist.steps.length} ${escapeHtml(s.stepsLabel)}</strong>${costText ? ` · ${escapeHtml(s.estimatedCost)}: ${escapeHtml(costText)}` : ""}</p>${unpricedNote}
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

  // Explicit offline saving (EXP-01) — URLs to cache are the current checklist only.
  const offlineUrls = hasSteps
    ? [`/checklist?${query}${lang === "es" && !query.includes("language=") ? "&language=es" : ""}`]
    : [];
  const offline = renderOfflinePanel(s, offlineUrls);

  // Privacy-safe reminders: a client-side .ics task list of the step titles already on
  // the page. No server, no contact info, no dates invented — see assets/reminders.js.
  const reminders = hasSteps
    ? `<p class="no-print"><button type="button" id="ics-btn">📅 ${escapeHtml(s.downloadIcs)}</button></p>
<p class="meta no-print">${escapeHtml(s.downloadIcsNote)}</p>
<script type="module" src="/assets/reminders.js"></script>`
    : "";

  const body = intro + summary + actions + noSteps + reminders + more + gaps + renderResumePanel(s, query) + offline + progress;
  return page({ lang, title: s.checklistTitle, heading: s.checklistHeading, body });
}

/** JSON island: config data for a static client script. `<` is escaped so markup in a
 *  value can never close the tag; type="application/json" means it is data, never executed. */
function jsonIsland(id: string, value: unknown): string {
  return `<script type="application/json" id="${id}">${JSON.stringify(value).replace(/</g, "\\u003c")}</script>`;
}

/**
 * Optional client-side encrypted save/resume (§2.5). Saves only the canonical selection
 * query, AES-GCM-encrypted with a passphrase, into localStorage. The save action makes no
 * network request and includes no direct identity field; the selections were already part
 * of the server-rendered page request. The behavior lives in the static module
 * /assets/resume-panel.js (crypto in /assets/resume-crypto.js, the same module the test
 * suite exercises); this function only emits markup + a JSON config island, so the page
 * carries no inline script. Progressive enhancement: no-JS users simply don't see it.
 * Hidden when there's no selection yet.
 */
function renderResumePanel(s: ReturnType<typeof uiStrings>, query: string): string {
  if (!query) return "";
  // Defense-in-depth: persist only the allowlisted selection keys, regardless of
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
  intakeQuery = "",
  opts: { noStateCoverage?: boolean } = {},
): string {
  const s = uiStrings(lang);
  const actions = `<p class="no-print"><button type="button" id="print-btn">🖨️ ${escapeHtml(s.print)}</button> <a href="/">${escapeHtml(s.startOver)}</a></p>
<script type="module" src="/assets/packet.js"></script>`;
  // The packet is the artifact people print and carry to a clerk, so the "these are
  // federal steps only" caveat has to survive onto paper — not be a screen-only note.
  const stateNote = opts.noStateCoverage ? `<p class="flag" role="note">${escapeHtml(s.noStateCoverage)}</p>` : "";
  // Offline saving: the packet itself, plus the checklist to go back to.
  const offlineUrls = intakeQuery
    ? [
        `/packet?${intakeQuery}${lang === "es" ? (intakeQuery.includes("language=") ? "" : "&language=es") : ""}`,
        `/checklist?${intakeQuery}${lang === "es" ? (intakeQuery.includes("language=") ? "" : "&language=es") : ""}`,
      ]
    : [];
  const offline = renderOfflinePanel(s, offlineUrls);
  const body = actions + stateNote + renderPacket(checklist, records, lang, generatedOn) + offline;
  return page({ lang, title: s.packetTitle, heading: s.packetHeading, body });
}

/**
 * Official-form page. We link the user to the real blank form at its official source
 * and tell them plainly that they download and complete it themselves. We deliberately
 * do NOT auto-fill: the relevant government forms are XFA/LiveCycle PDFs that browser
 * tooling can't fill, and a mis-filled legal form is a real harm — better the
 * authoritative form than a fake one. (See docs/STATUS.md.)
 */
export function renderFormFillPage(form: FormDef, lang: Language = "en"): string {
  const s = uiStrings(lang);
  const currentLabel = fieldLabel(lang, "current_legal_name");
  const newLabel = fieldLabel(lang, "new_legal_name");
  // Copy-helper config (labels + confirmation) for the static module. The inputs are
  // NOT inside a <form> and have no name attribute, so nothing can be submitted — the
  // values live only in the browser and never reach the server.
  const cfg = { labels: { current: currentLabel, new: newLabel }, copied: s.copied };
  const body = `
<p>${escapeHtml(s.officialFormIntro)}</p>
<p class="cta"><a href="${escapeHtml(form.source.url)}" rel="noopener noreferrer">${escapeHtml(s.getFormCta)}: ${escapeHtml(form.source.title)}</a></p>
<p class="meta">${escapeHtml(verificationCaption(form.source, s))}${
    isDriftWatchable(form.source.url) ? "" : ` <span class="flag">${escapeHtml(s.sourceNotWatched)}</span>`
  }</p>
${preparationList(form.preparation, lang)}
<section class="copy-helper no-print" aria-labelledby="copy-h">
  <h2 id="copy-h">${escapeHtml(s.copyTitle)}</h2>
  <p class="meta">${escapeHtml(s.copyIntro)}</p>
  <label for="copy-current">${escapeHtml(currentLabel)}</label>
  <input id="copy-current" type="text" data-copy="current" autocomplete="off" autocapitalize="words" spellcheck="false">
  <label for="copy-new">${escapeHtml(newLabel)}</label>
  <input id="copy-new" type="text" data-copy="new" autocomplete="off" autocapitalize="words" spellcheck="false">
  <p><button type="button" id="copy-btn">${escapeHtml(s.copyBtn)}</button></p>
  <pre id="copy-out" class="copy-out" aria-live="polite"></pre>
  <p id="copy-status" role="status" aria-live="polite" class="meta"></p>
</section>
${jsonIsland("copy-cfg", cfg)}
<script type="module" src="/assets/form-copy.js"></script>
<p class="flag" role="note">${escapeHtml(s.notFilingNote)}</p>`;
  return page({ lang, title: form.title, heading: form.title, body });
}

/** Explicit "save for offline" panel (EXP-01; progressive enhancement). */
function renderOfflinePanel(s: ReturnType<typeof uiStrings>, urls: string[]): string {
  if (urls.length === 0) return "";
  const cfg = {
    urls,
    staleAfterDays: staleAfterDays(),
    M: {
      banner: s.offlineBanner,
      saving: s.offlineSaving,
      saved: s.offlineSaved,
      haveCopy: s.offlineHaveCopy,
      removed: s.offlineRemoved,
      error: s.offlineError,
      unsupported: s.offlineUnsupported,
      updated: s.offlineUpdated,
      noneSaved: s.offlineNoneSaved,
    },
  };
  return `
<section class="no-print" aria-labelledby="offline-h">
  <h2 id="offline-h">${escapeHtml(s.offlineTitle)}</h2>
  <p class="meta">${escapeHtml(s.offlineIntro)}</p>
  <div id="offline" role="group" aria-labelledby="offline-h">
    <button type="button" id="offline-save">${escapeHtml(s.offlineSaveBtn)}</button>
    <button type="button" id="offline-remove">${escapeHtml(s.offlineRemoveBtn)}</button>
    <p id="offline-status" role="status" aria-live="polite" class="meta"></p>
  </div>
</section>
${jsonIsland("offline-cfg", cfg)}
<script type="module" src="/assets/offline.js"></script>`;
}

/** Offline notice page shown when there's no network and no cached copy. */
export function renderOfflinePage(lang: Language = "en"): string {
  const s = uiStrings(lang);
  const body = `
<p>${escapeHtml(s.offlineLead)}</p>
<section aria-labelledby="saved-h">
  <h2 id="saved-h">${escapeHtml(s.offlineSavedHeading)}</h2>
  <ul id="offline-list"></ul>
</section>
${jsonIsland("offline-cfg", { urls: [], staleAfterDays: staleAfterDays(), M: { noneSaved: s.offlineNoneSaved } })}
<script type="module" src="/assets/offline.js"></script>`;
  return page({ lang, title: s.offlinePageTitle, heading: s.offlineHeading, body });
}
