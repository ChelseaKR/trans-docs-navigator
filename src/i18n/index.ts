// Locale registry. To add a language: write a LocaleBundle module (the compiler
// enforces parity with English), add the code to the Language union in
// api/types.ts, and register the bundle here. Nothing else in the app changes —
// pickers, validation, and every renderer read from this registry.

import type { Language } from "../../api/types.ts";
import type { LocaleBundle } from "./types.ts";
import { en } from "./en.ts";
import { es } from "./es.ts";

export type { LocaleBundle, UiMessages, GeneratorMessages, LegalMessages, LegalSection } from "./types.ts";

const LOCALES: Record<Language, LocaleBundle> = { en, es };

/** All registered locales, in display order (drives the language picker). */
export const SUPPORTED_LOCALES: readonly LocaleBundle[] = Object.values(LOCALES);

// ── Test-only pseudolocale hook (G9 overflow gate, INTERNATIONALIZATION-STANDARD §4) ──
// The generated `en-XA` pseudolocale is a TEST ARTIFACT, never a shipping locale. It is
// NEVER added to LOCALES / SUPPORTED_LOCALES — so the G3 tag-validity and G6 key-parity
// gates only ever see en/es — and it is resolvable ONLY after a harness explicitly
// registers it here. The production server never calls registerTestLocale, so asLanguage()
// and t() behave exactly as before and `?language=en-XA` falls back to English (proven by
// tests/i18n-pseudo-hook.test.ts). See scripts/i18n-pseudo.ts + tests/e2e/i18n/.
const TEST_LOCALES = new Map<string, LocaleBundle>();

/** TEST-ONLY: register a non-shipping locale (e.g. the en-XA pseudolocale). Inert in prod. */
export function registerTestLocale(tag: string, bundle: LocaleBundle): void {
  TEST_LOCALES.set(tag, bundle);
}

/** The complete string bundle for a language. */
export function t(lang: Language): LocaleBundle {
  return LOCALES[lang] ?? TEST_LOCALES.get(lang) ?? LOCALES.en;
}

/** Parse an untrusted language param; anything unregistered falls back to English. */
export function asLanguage(v: string | null): Language {
  if (v === null) return "en";
  if (v in LOCALES) return v as Language;
  if (TEST_LOCALES.has(v)) return v as Language; // test-only pseudolocale; never set in prod
  return "en";
}
