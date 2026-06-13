// Client-side form fill. The blank PDF and field map arrive with the page; the
// user's answers are read from the DOM and the PDF is filled with pdf-lib entirely
// on-device, then downloaded. Nothing is posted anywhere. Config arrives in the
// #fill-cfg JSON island; pdf-lib is loaded as a separate same-origin script with SRI.

const cfgEl = document.getElementById("fill-cfg");
const form = document.getElementById("fill");
if (cfgEl && form) {
  const CFG = JSON.parse(cfgEl.textContent);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const status = document.getElementById("status");
    status.textContent = CFG.M.filling;
    const values = {};
    for (const el of document.querySelectorAll("[data-key]")) {
      values[el.dataset.key] = el.type === "checkbox" ? el.checked : el.value;
    }
    try {
      const tplBytes = await fetch(CFG.template).then((r) => r.arrayBuffer());
      const pdfDoc = await PDFLib.PDFDocument.load(tplBytes);
      const acro = pdfDoc.getForm();
      const unfilled = [];
      for (const m of CFG.fieldMap) {
        let v = values[m.intake_key];
        if (v === undefined || v === "" || v === false) continue;
        if (typeof v === "string" && v.length > 200) v = v.slice(0, 200);
        try {
          if (m.kind === "checkbox") acro.getCheckBox(m.pdf_field).check();
          else acro.getTextField(m.pdf_field).setText(String(v));
        } catch {
          unfilled.push(m.intake_key.replace(/_/g, " "));
        }
      }
      const out = await pdfDoc.save();
      const blob = new Blob([out], { type: "application/pdf" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = CFG.filename;
      a.click();
      URL.revokeObjectURL(a.href);
      status.textContent = unfilled.length ? CFG.M.unfilled + unfilled.join(", ") + "." : CFG.M.done;
    } catch {
      status.textContent = CFG.M.error;
    }
  });
}
