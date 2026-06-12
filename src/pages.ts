// Page assembly: the intake form, the checklist page, and the client-side
// form-fill page. The intake form collects NO PII — only jurisdiction, change
// types, documents, and language — and submits via GET (no request body, no PII
// on the wire). Identity fields are collected only on the form-fill page and
// filled entirely in the browser.

import type { Checklist, CorpusRecord, DocumentType, FormDef, Language } from "../api/types.ts";
import { page, renderChecklist, renderPacket, uiStrings, escapeHtml, DOC_LABELS, gapReason } from "./render.ts";
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
    (d) => `<label><input type="checkbox" name="doc" value="${d}"> ${escapeHtml(DOC_LABELS[lang][d])}</label>`,
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
      <option value="en"${lang === "en" ? " selected" : ""}>English</option>
      <option value="es"${lang === "es" ? " selected" : ""}>Español</option>
    </select>
  </fieldset>
  <button type="submit">${escapeHtml(s.submitChecklist)}</button>
</form>`;
  return page({ lang, title: s.intakeHeading, heading: s.intakeHeading, body });
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
        .map((g) => `<li class="flag">${escapeHtml(DOC_LABELS[lang][g.document_type])}: ${escapeHtml(gapReason(lang, g.reason))}</li>`)
        .join("")}</ul></section>`
    : "";
  // Reassuring empty-state instead of a bare empty list when nothing could be produced.
  const noSteps = checklist.steps.length === 0
    ? `<p class="flag" role="note">${escapeHtml(s.noStepsLead)}</p><p class="no-print"><a href="/">${escapeHtml(s.backToStart)}</a></p>`
    : renderChecklist(checklist, records, lang);
  const body = intro + actions + noSteps + gaps + renderResumePanel(s, query);
  return page({ lang, title: s.checklistTitle, heading: s.checklistHeading, body });
}

/**
 * Optional client-side encrypted save/resume (§2.5). Saves ONLY the non-PII selection
 * query, AES-GCM-encrypted with a passphrase, into localStorage — never to a server, and
 * never any identity field. Mirrors src/secure-resume.ts (kept in sync); progressive
 * enhancement, so no-JS users simply don't see it. Hidden when there's no selection yet.
 */
function renderResumePanel(s: ReturnType<typeof uiStrings>, query: string): string {
  if (!query) return "";
  // Defense-in-depth: persist ONLY the allowlisted non-PII selection keys, regardless of
  // what query reached this page. Identity fields can never be saved even if a future
  // caller passed a richer query string. (Mirrors src/secure-resume.ts toResumeState.)
  const safeQuery = toResumeState(new URLSearchParams(query)).toString();
  if (!safeQuery) return "";
  const cfg = JSON.stringify({
    query: safeQuery,
    M: { enterPass: s.resEnterPass, saved: s.resSaved, nothing: s.resNothing, wrong: s.resWrong, deleted: s.resDeleted },
  });
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
<script>
(function(){
  var CFG = ${cfg}, KEY = 'tdn.resume', ITER = 600000; // keep in sync with secure-resume.ts
  var status = document.getElementById('resume-status');
  var pass = document.getElementById('resume-pass');
  var enc = new TextEncoder(), dec = new TextDecoder();
  function b64(bytes){ var s=''; for(var i=0;i<bytes.length;i++) s+=String.fromCharCode(bytes[i]); return btoa(s); }
  function unb64(t){ var s=atob(t), o=new Uint8Array(s.length); for(var i=0;i<s.length;i++) o[i]=s.charCodeAt(i); return o; }
  async function key(salt){
    var base = await crypto.subtle.importKey('raw', enc.encode(pass.value), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({name:'PBKDF2',salt:salt,iterations:ITER,hash:'SHA-256'}, base, {name:'AES-GCM',length:256}, false, ['encrypt','decrypt']);
  }
  document.getElementById('resume-save').addEventListener('click', async function(){
    if(!pass.value){ status.textContent=CFG.M.enterPass; return; }
    var salt=crypto.getRandomValues(new Uint8Array(16)), iv=crypto.getRandomValues(new Uint8Array(12));
    var ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:iv}, await key(salt), enc.encode(CFG.query)));
    var blob=new Uint8Array(28+ct.length); blob.set(salt,0); blob.set(iv,16); blob.set(ct,28);
    localStorage.setItem(KEY, b64(blob));
    status.textContent=CFG.M.saved;
  });
  document.getElementById('resume-load').addEventListener('click', async function(){
    var stored=localStorage.getItem(KEY);
    if(!stored){ status.textContent=CFG.M.nothing; return; }
    try{
      var b=unb64(stored), salt=b.slice(0,16), iv=b.slice(16,28), ct=b.slice(28);
      var pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:iv}, await key(salt), ct);
      location.href='/checklist?'+dec.decode(pt);
    }catch(e){ status.textContent=CFG.M.wrong; }
  });
  document.getElementById('resume-del').addEventListener('click', function(){
    localStorage.removeItem(KEY); status.textContent=CFG.M.deleted;
  });
})();
</script>`;
}

/** M5 printable packet: the full plan, print-optimized, with a print button (no-JS-friendly). */
export function renderPacketPage(
  checklist: Checklist,
  records: CorpusRecord[],
  lang: Language,
  generatedOn: string,
): string {
  const s = uiStrings(lang);
  const actions = `<p class="no-print"><button type="button" onclick="window.print()">🖨️ ${escapeHtml(s.print)}</button> <a href="/">${escapeHtml(s.startOver)}</a></p>`;
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
      if (m.kind === "checkbox") {
        return `<label><input type="checkbox" data-key="${m.intake_key}"> ${escapeHtml(m.intake_key.replace(/_/g, " "))}</label>`;
      }
      return `<label for="f_${m.intake_key}">${escapeHtml(m.intake_key.replace(/_/g, " "))}</label>
        <input id="f_${m.intake_key}" type="text" data-key="${m.intake_key}" autocomplete="off">`;
    })
    .join("");

  const config = JSON.stringify({
    template: `/${form.template_path}`,
    fieldMap: form.field_map,
    filename: `${form.id}-filled.pdf`,
    M: { filling: s.fillFilling, done: s.fillDone, unfilled: s.fillUnfilled, error: s.fillError },
  });

  const body = `
<p><strong>${escapeHtml(s.privacyLabel)}</strong> ${escapeHtml(s.formPrivacy)}</p>
<p class="flag" role="note">${escapeHtml(s.notFilingNote)}</p>
<form id="fill" aria-label="${escapeHtml(form.title)}">
  <fieldset><legend>${escapeHtml(form.title)}</legend>${inputs}</fieldset>
  <button type="submit">${escapeHtml(s.fillDownload)}</button>
  <p id="status" role="status" aria-live="polite"></p>
</form>
<script src="/vendor/pdf-lib.min.js" integrity="sha256-D5pcrQeUHwgmWGyU4InYm5GMRuXBfPLVo8b2ZuO8aU8=" crossorigin="anonymous"></script>
<script>
const CFG = ${config};
document.getElementById('fill').addEventListener('submit', async (e) => {
  e.preventDefault();
  const status = document.getElementById('status');
  status.textContent = CFG.M.filling;
  const values = {};
  for (const el of document.querySelectorAll('[data-key]')) {
    values[el.dataset.key] = el.type === 'checkbox' ? el.checked : el.value;
  }
  try {
    const tplBytes = await fetch(CFG.template).then(r => r.arrayBuffer());
    const pdfDoc = await PDFLib.PDFDocument.load(tplBytes);
    const acro = pdfDoc.getForm();
    const unfilled = [];
    for (const m of CFG.fieldMap) {
      let v = values[m.intake_key];
      if (v === undefined || v === '' || v === false) continue;
      if (typeof v === 'string' && v.length > 200) v = v.slice(0, 200);
      try {
        if (m.kind === 'checkbox') acro.getCheckBox(m.pdf_field).check();
        else acro.getTextField(m.pdf_field).setText(String(v));
      } catch (_) { unfilled.push(m.intake_key.replace(/_/g, ' ')); }
    }
    const out = await pdfDoc.save();
    const blob = new Blob([out], { type: 'application/pdf' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = CFG.filename;
    a.click();
    URL.revokeObjectURL(a.href);
    status.textContent = unfilled.length
      ? CFG.M.unfilled + unfilled.join(', ') + '.'
      : CFG.M.done;
  } catch (err) {
    status.textContent = CFG.M.error;
  }
});
</script>`;
  return page({ lang, title: form.title, heading: form.title, body });
}
