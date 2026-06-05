// Client-side form pre-fill (M4, guardrail #3). The field-mapping + fill logic
// lives here so it can run IN THE BROWSER (bundled into src/form-fill client code)
// — identity data never leaves the device. The same pure functions are exercised
// in Node by the test suite to prove the mapping and the "flat PDF" degradation.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";
import type { FormDef, Intake } from "./types.ts";
import { REPO_ROOT } from "./corpus.ts";

const REGISTRY = join(REPO_ROOT, "forms", "registry.json");

export function loadForms(): FormDef[] {
  return JSON.parse(readFileSync(REGISTRY, "utf8")) as FormDef[];
}

export function formById(id: string): FormDef | undefined {
  return loadForms().find((f) => f.id === id);
}

/** The intake values usable for form-fill. Pure data; never persisted server-side. */
export type FillValues = Pick<Intake, "current_legal_name" | "new_legal_name" | "has_court_order">;

export interface MappedField {
  pdf_field: string;
  value: string;
  kind: "text" | "checkbox";
}

/** Cap text field length — a pasted blob shouldn't be able to corrupt the local PDF. */
export const MAX_FIELD_LEN = 200;

/**
 * Map intake values onto a form's PDF fields. Pure — no PDF, no I/O — so the
 * mapping is unit-testable and runs identically in the browser.
 */
export function mapFields(form: FormDef, values: FillValues): MappedField[] {
  const v = values as Record<string, unknown>;
  const out: MappedField[] = [];
  for (const entry of form.field_map) {
    const raw = v[entry.intake_key];
    if (raw === undefined || raw === null || raw === "") continue;
    if (entry.kind === "checkbox") {
      if (raw) out.push({ pdf_field: entry.pdf_field, value: entry.on_value ?? "Yes", kind: "checkbox" });
    } else {
      out.push({ pdf_field: entry.pdf_field, value: String(raw).slice(0, MAX_FIELD_LEN), kind: "text" });
    }
  }
  return out;
}

export interface FillResult {
  kind: "filled" | "degraded";
  /** Filled PDF bytes when kind === "filled". */
  bytes?: Uint8Array;
  /** When kind === "degraded": why, plus where to get the blank form. */
  reason?: string;
  downloadUrl?: string;
  /** Mapped fields that did not exist in the live PDF (user must complete them by hand). */
  unfilledFields?: string[];
}

/**
 * Fill a fillable form's AcroForm fields. For flat scans (fillable: false) it
 * degrades gracefully to "download + instructions" rather than failing (ROADMAP M4).
 * `templateBytes` is supplied by the caller (the browser fetches the blank PDF);
 * in Node tests we read the fixture from disk.
 */
export async function fillForm(form: FormDef, values: FillValues, templateBytes?: Uint8Array): Promise<FillResult> {
  if (!form.fillable) {
    return {
      kind: "degraded",
      reason: "This official form is a flat scan that can't be auto-filled. Download it and fill it by hand using the steps provided.",
      downloadUrl: form.source.url,
    };
  }

  let bytes = templateBytes;
  if (!bytes && form.template_path) {
    const p = join(REPO_ROOT, form.template_path);
    if (existsSync(p)) bytes = new Uint8Array(readFileSync(p));
  }
  if (!bytes) {
    return { kind: "degraded", reason: "Blank form template unavailable.", downloadUrl: form.source.url };
  }

  const pdf = await PDFDocument.load(bytes);
  const acro = pdf.getForm();
  const unfilled: string[] = [];
  for (const m of mapFields(form, values)) {
    try {
      if (m.kind === "checkbox") {
        const cb = acro.getCheckBox(m.pdf_field);
        cb.check();
      } else {
        acro.getTextField(m.pdf_field).setText(m.value);
      }
    } catch {
      // A mapping that doesn't match the live PDF is skipped, not fatal: the user still
      // gets a partially-filled form — but we report which fields they must complete by hand.
      unfilled.push(m.pdf_field);
    }
  }
  const filled = await pdf.save();
  return { kind: "filled", bytes: filled, ...(unfilled.length ? { unfilledFields: unfilled } : {}) };
}

export function listFixtureForms(): FormDef[] {
  const dir = join(REPO_ROOT, "forms", "fixtures");
  if (!existsSync(dir)) return [];
  const present = new Set(readdirSync(dir));
  return loadForms().filter((f) => f.template_path && present.has(f.template_path.split("/").pop()!));
}
