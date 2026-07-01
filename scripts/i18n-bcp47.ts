// BCP 47 language-tag gate (INTERNATIONALIZATION-STANDARD §4, G3) — merge-blocking.
// Every authored locale tag must be (a) well-formed per BCP 47 / RFC 5646 and (b) valid
// — recognized by the runtime's CLDR registry. A malformed or unknown tag silently
// breaks Accept-Language negotiation and emits an invalid <html lang> (WCAG 3.1.1), so
// the check is fail-closed.
//
// The authored tags are the language codes of the registered LocaleBundles
// (src/i18n/index.ts). They are the single source of truth for the locale registry and
// are exactly what the renderer emits as <html lang="…">, so validating them here
// validates the tags in code, config and rendered HTML in one place.
//
//   Well-formed:  Intl.getCanonicalLocales(tag) does not throw (RFC 5646 structure)
//   Canonical:    the authored tag already equals its canonical form (no "EN"/"es_MX")
//   Valid:        Intl.DateTimeFormat.supportedLocalesOf([tag]) is non-empty (CLDR knows it)

import { SUPPORTED_LOCALES } from "../src/i18n/index.ts";
import { pass, fail } from "./util.ts";

// The language code of every registered locale bundle — the set that becomes
// <html lang>, the language-picker value, and the negotiation key.
const tags = [...new Set(SUPPORTED_LOCALES.map((l) => l.language))].sort();

if (tags.length === 0) fail("i18n-bcp47", "no authored locale tags found in the registry");

const problems: string[] = [];
for (const tag of tags) {
  let canonical: string;
  try {
    const c = Intl.getCanonicalLocales(tag);
    if (c.length !== 1 || c[0] === undefined) {
      problems.push(`${tag}: did not canonicalize to a single locale`);
      continue;
    }
    canonical = c[0];
  } catch {
    problems.push(`${tag}: malformed BCP 47 / RFC 5646 tag`);
    continue;
  }
  // Structural parse must also succeed (defense in depth against getCanonicalLocales quirks).
  try {
    new Intl.Locale(tag);
  } catch {
    problems.push(`${tag}: Intl.Locale rejects tag`);
    continue;
  }
  // Authored tags must be stored canonical so parity/negotiation keys never drift.
  if (canonical !== tag) problems.push(`${tag}: not canonical (should be "${canonical}")`);
  // Registry validity: the runtime's CLDR data must actually recognize this locale.
  if (Intl.DateTimeFormat.supportedLocalesOf([tag]).length === 0) {
    problems.push(`${tag}: not recognized by the CLDR registry (invalid tag)`);
  }
}

if (problems.length > 0) {
  problems.sort();
  fail("i18n-bcp47", `${problems.length} invalid language tag(s)`, problems);
}
pass(
  "i18n-bcp47",
  `${tags.length} authored locale tag(s) well-formed + registry-valid (BCP 47/RFC 5646): ${tags.join(", ")}`,
);
