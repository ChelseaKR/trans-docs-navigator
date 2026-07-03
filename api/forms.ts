// Official-forms registry. The app links the user to the real blank form at its
// official source; it does NOT auto-fill forms.
//
// Why no auto-fill: the relevant government forms (CA court NC-100, DMV DL 329, SSA
// SS-5) are XFA/LiveCycle PDFs that browser/JS PDF tooling cannot fill, and handing
// someone a mis-filled legal form is a real harm. An earlier build shipped synthetic
// placeholder PDFs that "filled" — which looked fine in tests but produced a fake form
// for the user. We removed that path; see docs/STATUS.md and scripts/forms-check.ts.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { FormDef } from "./types.ts";
import { REPO_ROOT } from "./corpus.ts";

const REGISTRY = join(REPO_ROOT, "forms", "registry.json");

// Cached like loadCorpus() — the registry is small and static per-process, so re-reading
// it from disk on every formById() call (per step, per request) is pure waste.
let CACHE: FormDef[] | null = null;

export function loadForms(): FormDef[] {
  if (CACHE) return CACHE;
  CACHE = JSON.parse(readFileSync(REGISTRY, "utf8")) as FormDef[];
  return CACHE;
}

/** Test-only hook: drop the cache so a test can force a fresh disk read. */
export function clearFormsCache(): void {
  CACHE = null;
}

export function formById(id: string): FormDef | undefined {
  return loadForms().find((f) => f.id === id);
}
