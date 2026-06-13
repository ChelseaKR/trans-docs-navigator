// Locale-registry parity: every registered bundle must expose exactly the same key
// structure as English, recursively. The compiler already enforces this for known
// keys; this test is the runtime rail for the "adding a language is one bundle +
// one registration" claim — a future locale that drifts (extra keys, missing nested
// sections, a string where a function belongs) fails here with a precise path.

import { test } from "node:test";
import assert from "node:assert/strict";
import { SUPPORTED_LOCALES, t } from "../src/i18n/index.ts";

function shapeDiff(reference: unknown, candidate: unknown, path: string): string[] {
  if (typeof reference !== typeof candidate) return [`${path}: ${typeof reference} vs ${typeof candidate}`];
  if (typeof reference !== "object" || reference === null || candidate === null) return [];
  if (Array.isArray(reference)) {
    // Section lists (e.g. legal pages) may differ in length across languages; their
    // ELEMENTS must still match the reference shape.
    const refEl = (reference as unknown[])[0];
    return (candidate as unknown[]).flatMap((el, i) => shapeDiff(refEl, el, `${path}[${i}]`));
  }
  const refKeys = Object.keys(reference as object).sort();
  const candKeys = Object.keys(candidate as object).sort();
  const diffs: string[] = [];
  for (const k of refKeys) if (!candKeys.includes(k)) diffs.push(`${path}.${k}: missing`);
  for (const k of candKeys) if (!refKeys.includes(k)) diffs.push(`${path}.${k}: extra`);
  for (const k of refKeys.filter((k) => candKeys.includes(k))) {
    diffs.push(...shapeDiff((reference as Record<string, unknown>)[k], (candidate as Record<string, unknown>)[k], `${path}.${k}`));
  }
  return diffs;
}

test("every registered locale matches the English bundle's shape exactly", () => {
  const reference = t("en");
  for (const locale of SUPPORTED_LOCALES) {
    const diffs = shapeDiff(reference, locale, locale.language);
    assert.deepEqual(diffs, [], `locale "${locale.language}" drifted from the reference shape`);
  }
});

test("locale self-descriptions are consistent", () => {
  for (const locale of SUPPORTED_LOCALES) {
    assert.equal(t(locale.language), locale, "registry lookup returns the registered bundle");
    assert.ok(locale.selfName.length > 0, "selfName drives the language picker");
  }
});

test("no locale leaks another language's strings for high-traffic keys", () => {
  // Cheap tripwire for copy-paste bundles: headline strings must differ across locales.
  const seen = new Map<string, string>();
  for (const locale of SUPPORTED_LOCALES) {
    for (const key of ["intakeHeading", "checklistHeading", "bannerTitle"] as const) {
      const prior = seen.get(key);
      assert.notEqual(locale.ui[key], prior, `${locale.language}.ui.${key} duplicates another locale`);
      seen.set(key, locale.ui[key]);
    }
  }
});
