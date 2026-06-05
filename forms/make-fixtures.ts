// Generates blank, fillable PDF fixtures whose AcroForm field names match the
// registry field maps. These stand in for the official blank forms during
// development so the client-side fill path is exercisable end-to-end. In
// production the browser fetches the real blank form from its official source.
//
// Run: node --experimental-strip-types forms/make-fixtures.ts

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { REPO_ROOT } from "../api/corpus.ts";
import { loadForms } from "../api/forms.ts";

const OUT = join(REPO_ROOT, "forms", "fixtures");
mkdirSync(OUT, { recursive: true });

for (const form of loadForms()) {
  if (!form.fillable || !form.template_path) continue;
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const acro = pdf.getForm();
  const pagePdf = pdf.addPage([612, 792]);
  pagePdf.drawText(form.title, { x: 40, y: 740, size: 14, font });

  let y = 700;
  for (const entry of form.field_map) {
    pagePdf.drawText(entry.pdf_field, { x: 40, y, size: 10, font });
    if (entry.kind === "checkbox") {
      const cb = acro.createCheckBox(entry.pdf_field);
      cb.addToPage(pagePdf, { x: 300, y: y - 4, width: 14, height: 14 });
    } else {
      const tf = acro.createTextField(entry.pdf_field);
      tf.addToPage(pagePdf, { x: 300, y: y - 6, width: 250, height: 18 });
    }
    y -= 40;
  }

  const bytes = await pdf.save();
  const outPath = join(REPO_ROOT, form.template_path);
  writeFileSync(outPath, bytes);
  console.log(`wrote ${form.template_path} (${bytes.length} bytes, ${form.field_map.length} fields)`);
}
