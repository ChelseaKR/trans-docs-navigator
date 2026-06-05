import { test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { loadForms, formById, mapFields, fillForm, listFixtureForms, MAX_FIELD_LEN } from "../api/forms.ts";

test("loads the form registry", () => {
  const forms = loadForms();
  assert.ok(forms.length >= 4);
  assert.equal(formById("us-ss-5")?.document_type, "ssa-card");
  assert.equal(formById("nope"), undefined);
});

test("mapFields maps text + checkbox and skips empties", () => {
  const form = formById("us-ss-5")!;
  const mapped = mapFields(form, { new_legal_name: "Alex Doe", current_legal_name: "", has_court_order: true });
  const byField = Object.fromEntries(mapped.map((m) => [m.pdf_field, m]));
  assert.equal(byField["name_to_be_shown_on_card"]!.value, "Alex Doe");
  assert.equal(byField["other_names_used"], undefined); // empty string skipped
  assert.equal(byField["name_change_check"]!.kind, "checkbox");
  assert.equal(byField["name_change_check"]!.value, "Yes");
});

test("checkbox is omitted when falsey", () => {
  const form = formById("us-ss-5")!;
  const mapped = mapFields(form, { new_legal_name: "A", has_court_order: false });
  assert.ok(!mapped.some((m) => m.pdf_field === "name_change_check"));
});

test("fillForm fills a fillable PDF client-side and returns valid PDF bytes", async () => {
  const form = formById("ca-nc-100")!;
  const res = await fillForm(form, { current_legal_name: "Pat Old", new_legal_name: "Pat New" });
  assert.equal(res.kind, "filled");
  assert.ok(res.bytes && res.bytes.length > 0);
  // Round-trip: the value is actually set in the AcroForm.
  const reloaded = await PDFDocument.load(res.bytes!);
  assert.equal(reloaded.getForm().getTextField("petitioner_proposed_name").getText(), "Pat New");
});

test("fillForm degrades gracefully for a flat (non-fillable) scan", async () => {
  const form = formById("us-ds-82")!;
  const res = await fillForm(form, { new_legal_name: "X" });
  assert.equal(res.kind, "degraded");
  assert.ok(res.downloadUrl);
  assert.match(res.reason ?? "", /flat scan/);
});

test("fillForm degrades when the template is missing", async () => {
  const fake = { ...formById("ca-nc-100")!, template_path: "forms/fixtures/missing.pdf" };
  const res = await fillForm(fake, { new_legal_name: "X" });
  assert.equal(res.kind, "degraded");
});

test("fillForm accepts caller-supplied template bytes (the browser path)", async () => {
  const form = formById("ca-dl-329")!;
  const blank = await PDFDocument.create();
  const acro = blank.getForm();
  const pageRef = blank.addPage();
  acro.createTextField("full_name").addToPage(pageRef, { x: 10, y: 10, width: 100, height: 20 });
  const bytes = await blank.save();
  const res = await fillForm(form, { new_legal_name: "Sam" }, new Uint8Array(bytes));
  assert.equal(res.kind, "filled");
});

test("mapFields caps text field length against pasted blobs", () => {
  const form = formById("us-ss-5")!;
  const mapped = mapFields(form, { new_legal_name: "x".repeat(500) });
  assert.equal(mapped.find((m) => m.pdf_field === "name_to_be_shown_on_card")!.value.length, MAX_FIELD_LEN);
});

test("fillForm reports fields that don't exist in the live PDF (user completes by hand)", async () => {
  const form = formById("ca-dl-329")!; // maps new_legal_name → some pdf field
  const blank = await PDFDocument.create();
  blank.addPage(); // no form fields at all
  const res = await fillForm(form, { new_legal_name: "Sam" }, new Uint8Array(await blank.save()));
  assert.equal(res.kind, "filled");
  assert.ok(res.unfilledFields && res.unfilledFields.length > 0, "should report the unmatched field");
});

test("listFixtureForms returns forms whose fixtures exist on disk", () => {
  const ids = listFixtureForms().map((f) => f.id);
  assert.ok(ids.includes("us-ss-5"));
  assert.ok(!ids.includes("us-ds-82")); // flat form, no fixture
});
