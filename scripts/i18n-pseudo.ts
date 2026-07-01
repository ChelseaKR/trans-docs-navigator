// G9 — pseudolocale generator (INTERNATIONALIZATION-STANDARD §4 / §8).
//
// Transforms the English reference bundle (src/i18n/en.ts, a typed LocaleBundle)
// into an `en-XA`-style pseudolocale that (1) accents every Latin letter so any
// untranslated / hardcoded string stands out, (2) expands text by ~40% to mimic
// the length of longer locales (Spanish, German, …) — the exact condition that
// surfaces overflow — and (3) brackets each string value with ⟦ … ⟧ so the
// overflow spec can prove the pseudo strings actually rendered.
//
// The bundle is CODE, not a JSON catalog: alongside literal strings it carries
// generator/SEO FUNCTIONS (generator.costAbout(...), seo.guideTitle(...), …) and
// `{done}`/`{total}`-style interpolation placeholders, and the legal pages hold
// trusted HTML. All three are PROTECTED verbatim — only literal visible text is
// accented/expanded — so the pseudo bundle stays a valid, runnable LocaleBundle.
//
// The generated JSON is a TEST ARTIFACT, not a shipping locale: it is written
// OUTSIDE src/i18n/ (so the G3 tag + G6 parity gates never treat it as a real
// locale) and is git-ignored. The runtime overflow gate builds the live pseudo
// bundle in-process via makePseudoBundle(en) and registers it ONLY behind a test
// flag (see tests/e2e/i18n/pseudo-server.ts + tests/e2e/i18n/pseudo-overflow.spec.ts).
//
// Deterministic and dependency-free: identical input always yields identical
// output, so the gate never flakes.

import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { LocaleBundle } from "../src/i18n/index.ts";

// Latin letter → accented look-alike (readable, roughly the same visual width).
const ACCENTS: Record<string, string> = {
  a: "á", b: "ƀ", c: "ç", d: "đ", e: "é", f: "ƒ", g: "ĝ", h: "ĥ", i: "í",
  j: "ĵ", k: "ķ", l: "ļ", m: "ɱ", n: "ñ", o: "ó", p: "ƥ", q: "ɋ", r: "ř",
  s: "š", t: "ţ", u: "ú", v: "ṽ", w: "ŵ", x: "ẋ", y: "ý", z: "ž",
  A: "Á", B: "Ɓ", C: "Ç", D: "Đ", E: "É", F: "Ƒ", G: "Ĝ", H: "Ĥ", I: "Í",
  J: "Ĵ", K: "Ķ", L: "Ļ", M: "Ṁ", N: "Ñ", O: "Ó", P: "Ƥ", Q: "Ǫ", R: "Ř",
  S: "Š", T: "Ţ", U: "Ú", V: "Ṽ", W: "Ŵ", X: "Ẋ", Y: "Ý", Z: "Ž",
};

// Filler drawn cyclically to reach the ~40% expansion target. Accented vowels so
// the padding reads as pseudo text, not noise.
const FILLER = "áéíóúàèìòù";
const EXPANSION = 0.4; // ~40% more characters than the source (§4 target).

// Tokens PROTECTED verbatim inside a string: {placeholders}, <html tags>, and
// &entities; — accenting/expanding any of them would corrupt interpolation or markup.
// PROTECTED_SPLIT (capturing) partitions a value into literal text + tokens;
// PROTECTED_TOKEN (anchored, non-global) classifies each split part.
const PROTECTED_SPLIT = /(\{[^}]*\}|<[^>]*>|&[^;\s]+;)/g;
const PROTECTED_TOKEN = /^(?:\{[^}]*\}|<[^>]*>|&[^;\s]+;)$/;

/** Accent one word and append deterministic filler to grow it ~EXPANSION. */
function expandWord(word: string, counter: { i: number }): string {
  let accented = "";
  let letters = 0;
  for (const ch of word) {
    const a = ACCENTS[ch];
    if (a !== undefined) {
      accented += a;
      letters++;
    } else {
      accented += ch; // digits, punctuation, non-Latin (á, “”, —) pass through
    }
  }
  if (letters === 0) return accented; // nothing to expand (pure punctuation/number)
  const padLen = Math.ceil(letters * EXPANSION);
  let pad = "";
  for (let i = 0; i < padLen; i++) {
    pad += FILLER[counter.i % FILLER.length];
    counter.i++;
  }
  return accented + pad;
}

/**
 * Pseudo-transform one string value: protect interpolation/markup tokens, accent +
 * expand the literal text between them, then bracket the whole value with ⟦ … ⟧.
 * Intentional blanks are left as-is (they carry no visible text to expand).
 */
export function pseudoString(value: string): string {
  if (value.trim() === "") return value;
  const counter = { i: 0 };
  const out = value
    .split(PROTECTED_SPLIT)
    .map((part) => {
      if (PROTECTED_TOKEN.test(part)) return part; // protected token — verbatim
      // Preserve whitespace runs; accent + expand word tokens.
      return part
        .split(/(\s+)/g)
        .map((tok) => (/^\s+$/.test(tok) || tok === "" ? tok : expandWord(tok, counter)))
        .join("");
    })
    .join("");
  return `⟦${out}⟧`; // ⟦ … ⟧
}

/** Deep-transform: strings → pseudo, FUNCTIONS → verbatim, recurse objects/arrays. */
function transform(node: unknown): unknown {
  if (typeof node === "string") return pseudoString(node);
  if (typeof node === "function") return node; // generator/SEO fns — protected verbatim
  if (Array.isArray(node)) return node.map(transform);
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) out[k] = transform(v);
    return out;
  }
  return node; // number / boolean / null
}

/**
 * Build a live `en-XA` LocaleBundle from a source bundle (normally `en`). Every
 * visible string is accented + ~40%-expanded + bracketed; every generator/SEO
 * function is preserved so the bundle stays runnable. The `language` field keeps
 * the real locale CODE (it is a tag, not visible copy).
 */
export function makePseudoBundle(source: LocaleBundle): LocaleBundle {
  const bundle = transform(source) as LocaleBundle;
  bundle.language = source.language; // keep the code intact (never pseudo a tag)
  return bundle;
}

// ── CLI: write the git-ignored JSON artifact (deterministic, reviewable) ───────
const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(HERE, "../tests/e2e/i18n");
const OUT = resolve(OUT_DIR, "en-XA.generated.json");

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { en } = await import("../src/i18n/en.ts");
  const bundle = makePseudoBundle(en);
  mkdirSync(OUT_DIR, { recursive: true });
  // Functions serialize as a sentinel; only the pseudo STRINGS are captured (the
  // artifact is for review/determinism — the runtime builds the live bundle via
  // makePseudoBundle). Trailing newline; 2-space indent — stable if ever inspected.
  const json = JSON.stringify(bundle, (_k, v) => (typeof v === "function" ? "⟦fn⟧" : v), 2);
  writeFileSync(OUT, json + "\n", "utf8");
  console.log(`  ✅ i18n-pseudo: wrote en-XA artifact (${OUT.replace(process.cwd() + "/", "")}) from en.ts`);
}
