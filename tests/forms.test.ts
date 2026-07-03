import { test } from "node:test";
import assert from "node:assert/strict";
import { loadForms, formById, clearFormsCache } from "../api/forms.ts";
import type { FormDef } from "../api/types.ts";
import { renderFormFillPage } from "../src/pages.ts";

// The forms feature links users to the real official blank form; it does NOT auto-fill.
// (An earlier build shipped synthetic placeholder PDFs that "filled" — passing tests
// while handing users a fake form. scripts/forms-check.ts now guards against that.)

test("loads the form registry", () => {
  const forms = loadForms();
  assert.ok(forms.length >= 4);
  assert.equal(formById("us-ss-5")?.document_type, "ssa-card");
  assert.equal(formById("nope"), undefined);
});

test("loadForms caches — repeat calls return the same array (FIX-10)", () => {
  clearFormsCache();
  const a = loadForms();
  const b = loadForms();
  assert.equal(a, b); // reference-equal: no re-read from disk on the second call
  clearFormsCache();
  const c = loadForms();
  assert.notEqual(a, c); // a fresh read after clearing produces a new array instance
  assert.equal(a.length, c.length);
});

test("every form points at an official https source with a title and date", () => {
  for (const f of loadForms()) {
    assert.match(f.source.url, /^https:\/\//, `${f.id} source must be https`);
    assert.ok(f.source.title.length > 0, `${f.id} needs a source title`);
    assert.match(f.source.last_verified, /^\d{4}-\d{2}-\d{2}$/, `${f.id} needs a verified date`);
  }
});

test("the registry exposes no auto-fill surface (no template/field-map fields)", () => {
  // Honesty guard at the type/data level: we never claim to fill these forms.
  for (const f of loadForms()) {
    const raw = f as unknown as Record<string, unknown>;
    assert.equal(raw.fillable, undefined, `${f.id} must not declare fillable`);
    assert.equal(raw.template_path, undefined, `${f.id} must not ship a fill template`);
    assert.equal(raw.field_map, undefined, `${f.id} must not declare a field map`);
  }
});

// FIX-10 — forms layer depth: version pinning + preparation metadata are additive/
// optional fields; existing registry fixtures (with none of them set) must keep working,
// and a FormDef that does set them must type-check and round-trip untouched.

test("FormDef accepts the new optional fields without breaking existing fixtures", () => {
  // Existing registry entries carry none of the new fields — still valid FormDefs.
  for (const f of loadForms()) {
    assert.equal(f.version_hint, undefined);
    assert.equal(f.pdf_sha256, undefined);
    assert.equal(f.checked, undefined);
    assert.equal(f.preparation, undefined);
  }
  // A FormDef that DOES set them type-checks and preserves the values.
  const withMeta: FormDef = {
    ...formById("us-ss-5")!,
    version_hint: "Rev. 2024-11",
    pdf_sha256: "a".repeat(64),
    checked: "2026-06-01",
    preparation: [{ item: "Certified copy of court order", citation: "Cal. Fam. Code § 103" }],
  };
  assert.equal(withMeta.version_hint, "Rev. 2024-11");
  assert.equal(withMeta.preparation?.[0]?.citation, "Cal. Fam. Code § 103");
});

test("renderFormFillPage renders preparation items with citations when present", () => {
  const form: FormDef = {
    ...formById("us-ss-5")!,
    preparation: [
      { item: "Certified copy of court order", citation: "Cal. Fam. Code § 103" },
      { item: "Government-issued photo ID", citation: "SSA POMS RM 10210.030" },
    ],
  };
  const h = renderFormFillPage(form, "en");
  assert.match(h, /What to bring/);
  assert.match(h, /Certified copy of court order/);
  assert.match(h, /Cal\. Fam\. Code § 103/);
  assert.match(h, /Government-issued photo ID/);
  assert.match(h, /SSA POMS RM 10210\.030/);
});

test("renderFormFillPage omits the preparation section when absent/empty (no placeholder legal claims)", () => {
  const withoutPrep = formById("us-ss-5")!;
  assert.equal(withoutPrep.preparation, undefined);
  const h = renderFormFillPage(withoutPrep, "en");
  assert.doesNotMatch(h, /What to bring/);
  assert.doesNotMatch(h, /id="prep-h"/);

  const emptyPrep: FormDef = { ...withoutPrep, preparation: [] };
  const h2 = renderFormFillPage(emptyPrep, "en");
  assert.doesNotMatch(h2, /What to bring/);
});
