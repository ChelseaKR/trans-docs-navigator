// Forms gate. Guards the class of bug where the app claims to produce a form it
// can't actually produce. An earlier build shipped synthetic placeholder PDFs and
// "filled" them client-side — every test passed while the user got a fake form.
//
// The honest contract now: the app only LINKS to official blank forms. This gate
// enforces it:
//   • every form has an official https source with a title and a verified date;
//   • no form declares an auto-fill surface (fillable / template_path / field_map) —
//     we don't fill these XFA/LiveCycle government PDFs, so we must not imply we do;
//   • no synthetic fill fixtures are shipped under forms/.
//
// Source-URL liveness is covered by scripts/link-check.ts (now including form URLs).

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { loadForms } from "../api/forms.ts";
import { isValidIsoDate, REPO_ROOT } from "../api/corpus.ts";
import { pass, fail } from "./util.ts";

const errors: string[] = [];

// Test-only override (tests/gate-efficacy): point the gate at a poisoned fixture
// registry. loadForms() defaults to the real registry.json when the argument is
// undefined, so production behavior is unchanged whenever FORMS_REGISTRY is unset.
const forms = loadForms(process.env.FORMS_REGISTRY);

for (const f of forms) {
  const raw = f as unknown as Record<string, unknown>;
  if (!/^https:\/\//.test(f.source?.url ?? "")) errors.push(`${f.id}: source.url must be an official https URL`);
  if (!f.source?.title) errors.push(`${f.id}: missing source.title`);
  if (!isValidIsoDate(f.source?.last_verified)) errors.push(`${f.id}: missing/invalid last_verified`);
  if (f.version_hint !== undefined && f.version_hint.trim().length === 0) {
    errors.push(`${f.id}: version_hint must be non-empty when present`);
  }
  if (f.pdf_sha256 !== undefined && !/^[a-f0-9]{64}$/.test(f.pdf_sha256)) {
    errors.push(`${f.id}: pdf_sha256 must be a lowercase SHA-256 hex digest`);
  }
  if (f.checked !== undefined && !isValidIsoDate(f.checked)) {
    errors.push(`${f.id}: checked must be a real ISO calendar date`);
  }
  if (f.pdf_sha256 !== undefined && f.checked === undefined) {
    errors.push(`${f.id}: pdf_sha256 requires a checked date`);
  }
  if (f.preparation !== undefined) {
    if (!Array.isArray(f.preparation)) {
      errors.push(`${f.id}: preparation must be an array`);
    } else {
      for (const [index, item] of f.preparation.entries()) {
        if (!item || typeof item.item !== "string" || item.item.trim().length === 0) {
          errors.push(`${f.id}: preparation[${index}].item must be non-empty`);
        }
        if (!item || typeof item.citation !== "string" || item.citation.trim().length === 0) {
          errors.push(`${f.id}: preparation[${index}].citation must be non-empty`);
        }
      }
    }
  }
  for (const banned of ["fillable", "template_path", "field_map"]) {
    if (raw[banned] !== undefined) errors.push(`${f.id}: must not declare "${banned}" — the app links to official forms, it does not auto-fill`);
  }
}

// No synthetic fill fixtures may be shipped.
const fixturesDir = join(REPO_ROOT, "forms", "fixtures");
if (existsSync(fixturesDir)) {
  const pdfs = readdirSync(fixturesDir).filter((n) => n.toLowerCase().endsWith(".pdf"));
  if (pdfs.length > 0) errors.push(`forms/fixtures/ ships ${pdfs.length} PDF(s) — synthetic fill fixtures are not allowed (${pdfs.join(", ")})`);
}

if (errors.length > 0) fail("forms", `${errors.length} form-registry issue(s)`, errors);
pass("forms", `${forms.length} forms link to official sources; no auto-fill surface or synthetic fixtures shipped`);
