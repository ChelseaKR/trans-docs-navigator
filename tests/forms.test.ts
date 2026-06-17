import { test } from "node:test";
import assert from "node:assert/strict";
import { loadForms, formById } from "../api/forms.ts";

// The forms feature links users to the real official blank form; it does NOT auto-fill.
// (An earlier build shipped synthetic placeholder PDFs that "filled" — passing tests
// while handing users a fake form. scripts/forms-check.ts now guards against that.)

test("loads the form registry", () => {
  const forms = loadForms();
  assert.ok(forms.length >= 4);
  assert.equal(formById("us-ss-5")?.document_type, "ssa-card");
  assert.equal(formById("nope"), undefined);
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
