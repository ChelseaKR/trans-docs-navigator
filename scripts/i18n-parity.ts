// Locale key-parity gate (backlog #15, i18n standard) — merge-blocking.
// English is the reference locale; every other registered locale (currently Spanish)
// must expose EXACTLY English's key structure, recursively, and no translated string
// may be empty. A missing key or a blank value would silently ship English — or
// nothing — to Spanish users on a safety-critical legal surface, so this is fail-closed.
//
// This is the runtime rail that complements the two compile-time/test checks already in
// place: the LocaleBundle interfaces enforce parity for *known* keys, and
// tests/i18n-parity.test.ts asserts shape at test time. This gate is dependency-free,
// deterministic, and offline: it imports the compiled locale registry, walks it, and
// never invokes the generator/SEO functions (they are code, not translatable copy) so
// there are no side effects and the result never varies between runs.

import { SUPPORTED_LOCALES, t } from "../src/i18n/index.ts";
import { pass, fail } from "./util.ts";

const REFERENCE = "en";

/** Runtime kind used for structural comparison. */
function kind(v: unknown): string {
  if (Array.isArray(v)) return "array";
  if (v === null) return "null";
  return typeof v; // "object" | "string" | "function" | "number" | "boolean" | ...
}

// Compare `candidate` (one locale bundle) against `reference` (English), recursively,
// pushing a precise dot-path for every divergence: a missing key, an unexpected key,
// a type drift (string vs function vs object), or an empty/whitespace-only translation.
function diff(reference: unknown, candidate: unknown, path: string, out: string[]): void {
  const refKind = kind(reference);
  const candKind = kind(candidate);
  if (refKind !== candKind) {
    out.push(`${path}: expected ${refKind} (as in "${REFERENCE}"), found ${candKind}`);
    return;
  }
  switch (refKind) {
    case "object": {
      const refKeys = Object.keys(reference as object).sort();
      const candKeys = Object.keys(candidate as object).sort();
      for (const k of refKeys) if (!candKeys.includes(k)) out.push(`${path}.${k}: missing`);
      for (const k of candKeys) if (!refKeys.includes(k)) out.push(`${path}.${k}: unexpected (not in "${REFERENCE}")`);
      for (const k of refKeys) {
        if (candKeys.includes(k)) {
          diff((reference as Record<string, unknown>)[k], (candidate as Record<string, unknown>)[k], `${path}.${k}`, out);
        }
      }
      break;
    }
    case "array": {
      // Section lists (e.g. legal pages) share an element shape but may legitimately
      // differ in count across languages. Every candidate element must match the
      // reference element shape (index 0) and carry no empty strings.
      const ref0 = (reference as unknown[])[0];
      (candidate as unknown[]).forEach((el, i) => diff(ref0, el, `${path}[${i}]`, out));
      break;
    }
    case "string": {
      if ((candidate as string).trim() === "") out.push(`${path}: empty translation`);
      break;
    }
    // function / number / boolean / null: presence + type parity is already proven above.
  }
}

const reference = t(REFERENCE);
const problems: string[] = [];

for (const locale of SUPPORTED_LOCALES) {
  if (locale.language === REFERENCE) continue;
  diff(reference, locale, locale.language, problems);
}
problems.sort(); // stable, run-independent ordering

if (problems.length > 0) {
  fail(
    "i18n",
    `${problems.length} locale parity issue(s) — every locale must match "${REFERENCE}" key-for-key with no empty translations`,
    problems,
  );
}
pass(
  "i18n",
  `locale parity: all ${SUPPORTED_LOCALES.length} bundle(s) match "${REFERENCE}" key-for-key with no empty translations`,
);
