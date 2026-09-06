// i18n hardcoded-attribute gate (issue #151) — merge-blocking.
//
// The gap this closes: `make a11y` (scripts/a11y-lint.ts) accepts any labelled
// landmark regardless of what language the label is written in — a mechanical WCAG
// check has no notion of "wrong language". `make i18n` (scripts/i18n-parity.ts) only
// proves key-for-key parity between locale bundles that ALREADY exist — an inline
// string literal sitting in a template in src/ was never a bundle key in the first
// place, so it has nothing to be "missing" against. Together those two gates stayed
// green while `<nav aria-label="Breadcrumb">` and `<section aria-label="answer">`
// shipped hardcoded English that rendered unchanged on `?language=es` pages.
//
// This gate asks the question neither of those can: is every literal value of a
// user-visible HTML attribute (aria-label / alt / title / placeholder) in a
// rendering path actually sourced from the locale bundle, rather than typed in
// English by hand? It is deliberately narrow and mechanical (line-based regex, like
// lint.ts/privacy-lint.ts) rather than the full G2 FormatJS-extraction ratchet
// (docs/I18N.md "Deferred to a later phase") — it catches exactly the shape of bug
// #151, not every hardcoded string in the app.
//
// Method: for each of the four attributes, find `attr="...”`/`attr='...'` in every
// src/ rendering file (src/i18n/** excluded — that's the bundle data itself, not a
// template) and strip out `${...}` template interpolations. Anything with a letter
// left over after stripping is a literal the template author typed in English by
// hand, and every one of those found in this repo's history so far HAS been English
// — so any leftover letter is the harm, not just an English-looking one.

import { fileURLToPath } from "node:url";
import { dirname, join, relative, sep } from "node:path";
import { walk, read, isSource, pass, fail } from "./util.ts";

// Test-only override (tests/gate-efficacy): point the gate at a poisoned fixture
// tree instead of the repo root. Unset in production, so behavior is unchanged.
const ROOT = process.env.I18N_HARDCODED_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), "..");

// The rendering surface: everything under src/ builds HTML. src/i18n/ is excluded —
// it IS the locale catalog (its string values are data, not template literals), so
// scanning it would just flag every translation as "hardcoded".
const RENDER_DIR = "src";
const EXCLUDED_PREFIX = join(RENDER_DIR, "i18n") + sep;

// The four user-visible attributes named in the issue. `aria-labelledby` is exempt on
// purpose: it points at the id of a heading that is itself rendered from the locale
// bundle (checked elsewhere), so it never carries its own literal text.
const ATTRS = ["aria-label", "alt", "title", "placeholder"];
const ATTR_RE = new RegExp(`\\b(${ATTRS.join("|")})\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "g");

/** Remove every `${...}` template interpolation (this repo's only interpolation syntax). */
function stripInterpolation(value: string): string {
  return value.replace(/\$\{[^}]*\}/g, "");
}

/** True if anything with an actual letter (any script) survives interpolation-stripping. */
function hasLiteralText(value: string): boolean {
  return /\p{L}/u.test(stripInterpolation(value));
}

const problems: string[] = [];

for (const file of walk(join(ROOT, RENDER_DIR), isSource)) {
  const rel = relative(ROOT, file);
  if (rel.startsWith(EXCLUDED_PREFIX)) continue;
  const lines = read(file).split("\n");
  lines.forEach((line, i) => {
    let m: RegExpExecArray | null;
    ATTR_RE.lastIndex = 0;
    while ((m = ATTR_RE.exec(line)) !== null) {
      const attr = m[1]!;
      const value = m[2] ?? m[3] ?? "";
      if (hasLiteralText(value)) {
        problems.push(`${rel}:${i + 1} — hardcoded ${attr}="${value}" (source it from the locale bundle: src/i18n/en.ts + es.ts)`);
      }
    }
  });
}

if (problems.length > 0) {
  fail(
    "i18n-hardcoded",
    `${problems.length} hardcoded user-visible attribute string(s) in a rendering path`,
    problems,
  );
}
pass("i18n-hardcoded", `no hardcoded ${ATTRS.join("/")} literals in ${RENDER_DIR}/ (excl. ${RENDER_DIR}/i18n/) — every value is locale-sourced`);
