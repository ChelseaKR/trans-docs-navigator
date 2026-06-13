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

/** The complete string bundle for a language. */
export function t(lang: Language): LocaleBundle {
  return LOCALES[lang];
}

/** Parse an untrusted language param; anything unregistered falls back to English. */
export function asLanguage(v: string | null): Language {
  return v !== null && v in LOCALES ? (v as Language) : "en";
}
