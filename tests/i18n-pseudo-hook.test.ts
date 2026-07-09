// Test-only pseudolocale hook (G9). Proves the registration seam used by the
// overflow gate is INERT in production — an unregistered tag resolves to English —
// and becomes resolvable only after an explicit registerTestLocale() call, without
// ever entering SUPPORTED_LOCALES (so the G3/G6 catalog gates never see it).

import { test } from "node:test";
import assert from "node:assert/strict";
import type { Language } from "../api/types.ts";
import { SUPPORTED_LOCALES, registerTestLocale, t, asLanguage } from "../src/i18n/index.ts";

const PSEUDO: string = "en-XA"; // string (not the literal) so it can compare against Language

test("prod inertness: an unregistered tag falls back to English", () => {
  // asLanguage never promotes an unknown tag, and t() fails safe to the en bundle.
  assert.equal(asLanguage(PSEUDO), "en");
  assert.equal(asLanguage(null), "en");
  assert.equal(t(PSEUDO as Language), t("en"));
});

test("registering a test locale makes it resolvable without touching the registry", () => {
  const before = SUPPORTED_LOCALES.length;
  registerTestLocale(PSEUDO, t("en")); // any valid LocaleBundle proves the seam

  assert.equal(asLanguage(PSEUDO), PSEUDO, "registered tag now resolves to itself");
  assert.equal(t(PSEUDO as Language), t("en"), "t() returns the registered bundle");

  // The shipping-locale set is unchanged, so the G3 tag + G6 parity gates never see it.
  assert.equal(SUPPORTED_LOCALES.length, before);
  assert.ok(!SUPPORTED_LOCALES.some((l) => l.language === PSEUDO));
});
