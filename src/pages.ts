// Page assembly: the intake form, the checklist page, and the client-side
// form-fill page. The intake form collects NO PII — only jurisdiction, change
// types, documents, and language — and submits via GET (no request body, no PII
// on the wire). Identity fields are collected only on the form-fill page and
// filled entirely in the browser.

import type { Checklist, CorpusRecord, FormDef, Language } from "../api/types.ts";
import { page, renderChecklist, renderPacket, uiStrings, escapeHtml } from "./render.ts";

const JURISDICTIONS: { id: string; label: string }[] = [
  { id: "US-CA", label: "California" },
  { id: "US-IL", label: "Illinois" },
  { id: "US-NY", label: "New York" },
  { id: "US-TX", label: "Texas" },
  { id: "US-WA", label: "Washington" },
];
const DOCUMENTS: { id: string; label: string }[] = [
  { id: "court-order", label: "Court order (name change)" },
  { id: "ssa-card", label: "Social Security card" },
  { id: "drivers-license", label: "Driver's license / state ID" },
  { id: "passport", label: "U.S. passport" },
  { id: "birth-certificate", label: "Birth certificate" },
  { id: "financial-records", label: "Financial & other records" },
];

export function renderIntakePage(lang: Language = "en"): string {
  const jOpts = JURISDICTIONS.map((j) => `<option value="${j.id}">${escapeHtml(j.label)}</option>`).join("");
  const ct = (["name", "gender-marker"] as const)
    .map(
      (c) =>
        `<label><input type="checkbox" name="change" value="${c}" checked> ${c === "name" ? "Legal name" : "Gender marker"}</label>`,
    )
    .join("");
  const docs = DOCUMENTS.map(
    (d) => `<label><input type="checkbox" name="doc" value="${d.id}"> ${escapeHtml(d.label)}</label>`,
  ).join("");

  const s = uiStrings(lang);
  const body = `
<p>Answer a few questions and get a personalized, ordered checklist with the right forms and official sources for your state. You can also use this without entering any personal details.</p>
<p class="meta" role="note">🔒 ${escapeHtml(s.private)}</p>
<form action="/checklist" method="get" aria-label="Intake">
  <fieldset>
    <legend>Where do you live?</legend>
    <label for="jurisdiction">State</label>
    <select id="jurisdiction" name="jurisdiction" required>${jOpts}</select>
  </fieldset>
  <fieldset>
    <legend>What are you changing?</legend>
    ${ct}
  </fieldset>
  <fieldset>
    <legend>Which documents do you want to update? (leave all unchecked for the recommended set)</legend>
    ${docs}
  </fieldset>
  <fieldset>
    <legend>Language</legend>
    <label for="language">Language</label>
    <select id="language" name="language">
      <option value="en">English</option>
      <option value="es">Español</option>
    </select>
  </fieldset>
  <button type="submit">Show my checklist</button>
</form>`;
  return page({ lang, title: "Trans Docs Navigator", heading: "Plan your legal name and gender-marker changes", body });
}

export function renderChecklistPage(
  checklist: Checklist,
  records: CorpusRecord[],
  lang: Language,
  query = "",
): string {
  const s = uiStrings(lang);
  const intro = `<p>Your steps are listed in the order most people complete them. Each links to its official source and the date it was last checked.</p>`;
  const q = query ? `?${query}` : "";
  const actions = `<p class="no-print"><a href="/packet${q}">📄 ${escapeHtml(s.print)}</a> · <a href="/">${escapeHtml(s.startOver)}</a></p>`;
  const gaps = checklist.gaps.length
    ? `<section aria-label="gaps"><h2>${escapeHtml(s.notCovered)}</h2><ul>${checklist.gaps
        .map((g) => `<li class="flag">${escapeHtml(g.document_type)}: ${escapeHtml(g.reason)}</li>`)
        .join("")}</ul></section>`
    : "";
  const body = intro + actions + renderChecklist(checklist, records, lang) + gaps + renderResumePanel(s, query);
  return page({ lang, title: "Your checklist", heading: "Your personalized checklist", body });
}

/**
 * Optional client-side encrypted save/resume (§2.5). Saves ONLY the non-PII selection
 * query, AES-GCM-encrypted with a passphrase, into localStorage — never to a server, and
 * never any identity field. Mirrors src/secure-resume.ts (kept in sync); progressive
 * enhancement, so no-JS users simply don't see it. Hidden when there's no selection yet.
 */
function renderResumePanel(s: ReturnType<typeof uiStrings>, query: string): string {
  if (!query) return "";
  const cfg = JSON.stringify({ query });
  return `
<section class="no-print" aria-labelledby="resume-h">
  <h2 id="resume-h">${escapeHtml(s.resumeTitle)}</h2>
  <p class="meta">${escapeHtml(s.resumeIntro)}</p>
  <form id="resume" onsubmit="return false">
    <label for="resume-pass">${escapeHtml(s.passLabel)}</label>
    <input id="resume-pass" type="password" autocomplete="off" autocapitalize="off" spellcheck="false">
    <button type="button" id="resume-save">${escapeHtml(s.saveBtn)}</button>
    <button type="button" id="resume-load">${escapeHtml(s.resumeBtn)}</button>
    <button type="button" id="resume-del">${escapeHtml(s.deleteBtn)}</button>
    <p id="resume-status" role="status" aria-live="polite" class="meta"></p>
  </form>
</section>
<script>
(function(){
  var CFG = ${cfg}, KEY = 'tdn.resume', ITER = 150000;
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
    if(!pass.value){ status.textContent='Enter a passphrase first.'; return; }
    var salt=crypto.getRandomValues(new Uint8Array(16)), iv=crypto.getRandomValues(new Uint8Array(12));
    var ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:iv}, await key(salt), enc.encode(CFG.query)));
    var blob=new Uint8Array(28+ct.length); blob.set(salt,0); blob.set(iv,16); blob.set(ct,28);
    localStorage.setItem(KEY, b64(blob));
    status.textContent='Saved on this device, encrypted. Nothing was sent anywhere.';
  });
  document.getElementById('resume-load').addEventListener('click', async function(){
    var stored=localStorage.getItem(KEY);
    if(!stored){ status.textContent='Nothing saved on this device.'; return; }
    try{
      var b=unb64(stored), salt=b.slice(0,16), iv=b.slice(16,28), ct=b.slice(28);
      var pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:iv}, await key(salt), ct);
      location.href='/checklist?'+dec.decode(pt);
    }catch(e){ status.textContent='Wrong passphrase, or the saved data was changed.'; }
  });
  document.getElementById('resume-del').addEventListener('click', function(){
    localStorage.removeItem(KEY); status.textContent='Deleted from this device.';
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
  return page({ lang, title: "Your packet", heading: "Your name & gender-marker change packet", body });
}

/**
 * Client-side form-fill page. The blank form + field map are sent to the browser;
 * the user's name(s) are typed in and the PDF is filled with pdf-lib entirely
 * client-side, then downloaded. Nothing is posted back. Flat scans degrade to
 * download-and-instructions.
 */
export function renderFormFillPage(form: FormDef, lang: Language = "en"): string {
  if (!form.fillable) {
    const body = `
<p>This official form is a flat scan that can't be auto-filled. Download the blank form and complete it by hand:</p>
<p><a href="${escapeHtml(form.source.url)}" rel="noopener noreferrer">${escapeHtml(form.title)}</a></p>`;
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
  });

  const body = `
<p><strong>Privacy:</strong> what you type here stays in your browser. The form is filled on your device and never sent anywhere.</p>
<form id="fill" aria-label="${escapeHtml(form.title)}">
  <fieldset><legend>${escapeHtml(form.title)}</legend>${inputs}</fieldset>
  <button type="submit">Fill &amp; download</button>
  <p id="status" role="status" aria-live="polite"></p>
</form>
<script src="/vendor/pdf-lib.min.js" integrity="sha256-D5pcrQeUHwgmWGyU4InYm5GMRuXBfPLVo8b2ZuO8aU8=" crossorigin="anonymous"></script>
<script>
const CFG = ${config};
document.getElementById('fill').addEventListener('submit', async (e) => {
  e.preventDefault();
  const status = document.getElementById('status');
  status.textContent = 'Filling on your device…';
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
      ? 'Downloaded. These field(s) could not be auto-filled — please complete them by hand: ' + unfilled.join(', ') + '.'
      : 'Done — your filled form downloaded. It was never sent to a server.';
  } catch (err) {
    status.textContent = 'Could not fill the form. You can download the blank form instead.';
  }
});
</script>`;
  return page({ lang, title: form.title, heading: form.title, body });
}
