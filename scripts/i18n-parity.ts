// Locale key-parity gate (backlog #15, i18n standard) — merge-blocking.
// English is the reference locale; every other registered locale (currently Spanish)
// must expose EXACTLY English's key structure, recursively, and no translated string
// may be empty. A missing key or a blank value would silently ship English — or
// nothing — to Spanish users on a safety-critical legal surface, so this is fail-closed.
//
// This is the runtime rail that complements the two compile-time/test checks already in
// place: the LocaleBundle interfaces enforce parity for *known* keys, and
// tests/i18n-parity.test.ts asserts shape at test time. This gate is dependency-free,
// deterministic, and offline: it imports the compiled locale registry and walks it.
//
// ── Why it now RENDERS the copy functions, when this header used to say it never did ──
//
// The old note read: "never invokes the generator/SEO functions (they are code, not
// translatable copy)". That was wrong about what those functions are. Every one of the 24
// of them returns a whole user-facing sentence with a name or a number interpolated into
// it — `planHeading(origin, dest)`, `freshness(topic, date, source)`,
// `issuingJurisdictionScope(state)`. Not rendering them meant a quarter of the copy on
// this surface was checked for its *type* and for nothing else: a Spanish function
// returning the empty string, or returning its English source verbatim, passed.
//
// They are pure string builders with no I/O, so rendering them is deterministic and
// side-effect-free. Each is called with fixed sentinel arguments; if a call throws with
// string arguments it is retried with numeric ones, and a leaf that cannot be rendered
// either way is REPORTED rather than skipped — a leaf the gate cannot read is not a leaf
// the gate has checked.
//
// ── The must-differ rule, and why it needs a written list ──
//
// Key parity and non-emptiness are both satisfied by a Spanish string that is verbatim
// English. Measured in this repo: replacing one `es` sentence with its English source
// left this gate printing "locale parity: all 2 bundle(s) match" and exiting 0, and left
// all 19 tests in tests/spanish-parity.test.ts green. So a non-reference locale's leaf
// must also DIFFER from English's.
//
// Two exemptions are mechanical, and both are about the ENGLISH SOURCE containing no
// prose — which is checkable — rather than about a word happening to be the same in two
// languages, which is not:
//   1. no alphabetic character survives once interpolated arguments are removed
//      ("$40", "—", "2026");
//   2. the whole string is a bare URL.
// There is deliberately no "short ALL-CAPS token" exemption: it would let `OK`, `NEW` and
// `SAME` through as readily as `CSV`, and nothing here needs it (measured: it would exempt
// zero leaves).
//
// Everything else that is identical on purpose — a product name, a proper noun — takes a
// written reason in src/i18n/identical-by-design.json. A pattern cannot make that call.
// That file is itself gated (stale path, unregistered locale, since-translated pair, blank
// reason all fail), a malformed file is an ERROR rather than an empty list, and the rule
// refuses to report success over zero compared leaves or zero target locales — three ways
// this check could otherwise have become one that cannot fail.

import { readFileSync } from "node:fs";
import { SUPPORTED_LOCALES, t } from "../src/i18n/index.ts";
import { pass, fail } from "./util.ts";

const REFERENCE = "en";
const EXEMPTIONS_PATH = new URL("../src/i18n/identical-by-design.json", import.meta.url);

/**
 * Where the reasoned-exemption list is read from. Always the committed file, except under
 * the single test-only variable this gate already carries: `I18N_PARITY_POISON` may name a
 * substitute list as `exemptions-file:<path>`, which is how the controls prove that a
 * malformed or over-broad list is refused rather than read as "no exemptions". Keeping it
 * on the existing poison variable means there is still exactly one environment variable to
 * audit here, rather than a second, quieter path override.
 */
function exemptionsSource(): URL | string {
  const poison = process.env.I18N_PARITY_POISON ?? "";
  return poison.startsWith("exemptions-file:") ? poison.slice("exemptions-file:".length) : EXEMPTIONS_PATH;
}

/** Sentinel arguments for rendering a copy function, in the two shapes they take. */
const STRING_ARGS = ["Alpha", "Bravo", "Charlie", "Delta", "Echo"];
const NUMBER_ARGS = [1, 2, 3, 4, 5];

interface Exemption {
  path: string;
  locales: string[];
  reason: string;
}

function loadExemptions(): Exemption[] {
  let raw: string;
  try {
    raw = readFileSync(exemptionsSource(), "utf8");
  } catch (e) {
    // Fail-closed: a missing escape-hatch file must not read as "no exemptions", which
    // would silently turn every reasoned entry into a fresh violation, and — worse for a
    // future refactor — would let someone delete the file to make the list's own gate
    // stop applying.
    fail("i18n", `could not read the identical-by-design list: ${(e as Error).message}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    fail("i18n", `the identical-by-design list is not valid JSON: ${(e as Error).message}`);
  }
  if (parsed === null || typeof parsed !== "object") {
    fail("i18n", 'the identical-by-design list must be an object carrying an "entries" array');
  }
  const entries = (parsed as { entries?: unknown }).entries;
  if (!Array.isArray(entries)) {
    fail("i18n", 'the identical-by-design list must carry an "entries" array');
  }
  return entries as Exemption[];
}

/** True when the ENGLISH source carries no prose, so an identical translation says nothing. */
function hasNoTranslatableProse(source: string): boolean {
  if (/^https?:\/\/\S+$/.test(source.trim())) return true;
  let stripped = source;
  for (const arg of STRING_ARGS) stripped = stripped.split(arg).join(" ");
  return !/[A-Za-z]/.test(stripped);
}

/**
 * Render a copy function to a comparable string, or return the reason it could not be.
 * Never returns a value silently derived from a failure — the caller reports either the
 * rendered text or the refusal, and both are visible in the gate's output.
 */
function render(fn: (...args: unknown[]) => unknown): { text: string } | { error: string } {
  for (const pool of [STRING_ARGS, NUMBER_ARGS] as unknown[][]) {
    try {
      const out = fn(...pool.slice(0, Math.max(fn.length, 1)));
      if (typeof out === "string") return { text: out };
      return { error: `returned ${typeof out}, not a string` };
    } catch {
      // try the next argument shape
    }
  }
  return { error: "threw for both string and numeric arguments" };
}

/** Runtime kind used for structural comparison. */
function kind(v: unknown): string {
  if (Array.isArray(v)) return "array";
  if (v === null) return "null";
  return typeof v; // "object" | "string" | "function" | "number" | "boolean" | ...
}

// Compare `candidate` (one locale bundle) against `reference` (English), recursively,
// pushing a precise dot-path for every divergence: a missing key, an unexpected key,
// a type drift (string vs function vs object), or an empty/whitespace-only translation.
interface Counts {
  compared: number;
  mechanicallyExempt: number;
  reasonedExempt: number;
}

function diff(
  reference: unknown,
  candidate: unknown,
  path: string,
  out: string[],
  ctx: { locale: string; exemptions: Exemption[]; counts: Counts; used: Set<string> },
): void {
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
          diff((reference as Record<string, unknown>)[k], (candidate as Record<string, unknown>)[k], `${path}.${k}`, out, ctx);
        }
      }
      break;
    }
    case "array": {
      // Section lists (e.g. legal pages) share an element shape but may legitimately
      // differ in count across languages. Every candidate element must match the
      // reference element shape (index 0) and carry no empty strings.
      const ref0 = (reference as unknown[])[0];
      (candidate as unknown[]).forEach((el, i) => diff(ref0, el, `${path}[${i}]`, out, ctx));
      break;
    }
    case "string": {
      if ((candidate as string).trim() === "") {
        out.push(`${path}: empty translation`);
        break;
      }
      compare(reference as string, candidate as string, path, out, ctx);
      break;
    }
    case "function": {
      // Rendered, not skipped: these are whole sentences with a name or a number
      // interpolated, and a type check says nothing about what they say.
      const ref = render(reference as (...a: unknown[]) => unknown);
      const cand = render(candidate as (...a: unknown[]) => unknown);
      if ("error" in ref) {
        out.push(`${path}: the "${REFERENCE}" copy function could not be rendered (${ref.error})`);
        break;
      }
      if ("error" in cand) {
        out.push(`${path}: this locale's copy function could not be rendered (${cand.error})`);
        break;
      }
      if (cand.text.trim() === "") {
        out.push(`${path}: empty translation (the function rendered to nothing)`);
        break;
      }
      compare(ref.text, cand.text, path, out, ctx);
      break;
    }
    // number / boolean / null: presence + type parity is already proven above.
  }
}

/**
 * The must-differ rule for one leaf. `path` here already carries the locale prefix, so
 * an exemption is matched on the part after it — the leaf's position in the bundle.
 */
function compare(
  source: string,
  translation: string,
  path: string,
  out: string[],
  ctx: { locale: string; exemptions: Exemption[]; counts: Counts; used: Set<string> },
): void {
  const leaf = path.startsWith(`${ctx.locale}.`) ? path.slice(ctx.locale.length + 1) : path;
  const exempt = ctx.exemptions.find((e) => e.path === leaf && e.locales.includes(ctx.locale));
  if (exempt) {
    ctx.used.add(`${leaf}|${ctx.locale}`);
    ctx.counts.reasonedExempt += 1;
    // A reasoned exemption that is no longer needed is a stale exemption. Reporting it
    // here rather than tolerating it is what stops the list becoming the drawer an
    // untranslated string gets swept into.
    if (source !== translation) {
      out.push(
        `${path}: listed in identical-by-design.json but the two now differ — delete the entry`,
      );
    }
    return;
  }
  if (hasNoTranslatableProse(source)) {
    ctx.counts.mechanicallyExempt += 1;
    return;
  }
  ctx.counts.compared += 1;
  if (source === translation) {
    out.push(
      `${path}: identical to its "${REFERENCE}" source — translate it, or add it to ` +
        `src/i18n/identical-by-design.json with a written reason: ${JSON.stringify(
          source.length > 80 ? `${source.slice(0, 77)}...` : source,
        )}`,
    );
  }
}

/** Every leaf path of the reference bundle, so a stale exemption can be named. */
function collectLeaves(node: unknown, path: string, out: Set<string>): void {
  if (Array.isArray(node)) {
    node.forEach((el, i) => collectLeaves(el, `${path}[${i}]`, out));
    return;
  }
  if (node !== null && typeof node === "object") {
    for (const k of Object.keys(node as object)) {
      collectLeaves((node as Record<string, unknown>)[k], path ? `${path}.${k}` : k, out);
    }
    return;
  }
  if (typeof node === "string" || typeof node === "function") out.add(path);
}

const reference = t(REFERENCE);
const problems: string[] = [];

// Test-only injection points (tests/gate-efficacy). Each poisons a CLONE of the Spanish
// bundle with the exact harm one half of this gate exists to catch, so a half that has
// been short-circuited fails its control even while every other test stays green:
//
//   "1"               a key present in en.ts and never ported to es.ts (the original)
//   "english-paste"   a Spanish string replaced by its English source — key parity,
//                     non-emptiness and the type check all still pass, which is exactly
//                     why the must-differ rule had to be added
//   "empty-function"  a Spanish copy FUNCTION rendering to nothing — invisible to this
//                     gate until it started rendering them
//
// Shallow-clone (not structuredClone: the bundles carry functions, which structuredClone
// cannot copy) so the real registry is never mutated. Inert unless the env var matches
// exactly, so production behaviour is unchanged.
const POISON = process.env.I18N_PARITY_POISON ?? "";
const locales: typeof SUPPORTED_LOCALES = POISON
  ? SUPPORTED_LOCALES.map((l) => {
      if (l.language !== "es") return l;
      const ui: Record<string, unknown> = { ...l.ui };
      if (POISON === "1") delete ui.skip;
      if (POISON === "english-paste") ui.needsRecheck = t(REFERENCE).ui.needsRecheck;
      if (POISON === "empty-function") ui.issuingJurisdictionScope = () => "";
      return { ...l, ui } as unknown as typeof l;
    })
  : SUPPORTED_LOCALES;

const exemptions = loadExemptions();
const registered = new Set<string>(SUPPORTED_LOCALES.map((l) => l.language));
const referenceLeaves = new Set<string>();
collectLeaves(reference, "", referenceLeaves);

// The exemption list is gated before it is used, so a blank reason or a stale entry can
// never quietly widen the escape hatch it lives in.
exemptions.forEach((e, i) => {
  const where = `identical-by-design.json entry ${i}`;
  if (typeof e?.path !== "string" || e.path === "") problems.push(`${where}: needs a "path"`);
  if (typeof e?.reason !== "string" || e.reason.trim() === "")
    problems.push(`${where} (${e?.path}): needs a written reason — a pattern cannot make this call`);
  if (!Array.isArray(e?.locales) || e.locales.length === 0)
    problems.push(`${where} (${e?.path}): needs a non-empty "locales" list`);
  else
    for (const l of e.locales) {
      if (!registered.has(l)) problems.push(`${where} (${e.path}): locale "${l}" is not registered`);
      if (l === REFERENCE)
        problems.push(`${where} (${e.path}): "${REFERENCE}" is the source locale and cannot be exempt from itself`);
    }
  if (typeof e?.path === "string" && !referenceLeaves.has(e.path))
    problems.push(`${where}: "${e.path}" is not a leaf of the "${REFERENCE}" bundle — delete the entry`);
});

const counts: Counts = { compared: 0, mechanicallyExempt: 0, reasonedExempt: 0 };
const used = new Set<string>();
let targets = 0;
for (const locale of locales) {
  if (locale.language === REFERENCE) continue;
  targets += 1;
  diff(reference, locale, locale.language, problems, {
    locale: locale.language,
    exemptions,
    counts,
    used,
  });
}

// Three floors. Each one is a way this gate could have reported success over nothing:
// no locale to check, no leaf compared, or an exemption for a leaf the walk never reached.
if (targets === 0) {
  fail("i18n", `no locale other than "${REFERENCE}" is registered — this gate would check nothing`);
}
if (counts.compared === 0) {
  fail("i18n", "no leaf was compared against its source — the walk is not reaching the copy");
}
for (const e of exemptions) {
  if (typeof e?.path !== "string" || !Array.isArray(e?.locales)) continue;
  for (const l of e.locales) {
    if (registered.has(l) && l !== REFERENCE && !used.has(`${e.path}|${l}`)) {
      problems.push(
        `identical-by-design.json: "${e.path}" (${l}) was never reached by the walk — delete the entry`,
      );
    }
  }
}

problems.sort(); // stable, run-independent ordering

if (problems.length > 0) {
  fail(
    "i18n",
    `${problems.length} locale parity issue(s) — every locale must match "${REFERENCE}" key-for-key, with no empty translation and none left verbatim English`,
    problems,
  );
}
pass(
  "i18n",
  `locale parity: all ${SUPPORTED_LOCALES.length} bundle(s) match "${REFERENCE}" key-for-key; ` +
    `${counts.compared} leaf/leaves compared against their source across ${targets} target locale(s), ` +
    `none verbatim English (${counts.mechanicallyExempt} carried no translatable prose, ` +
    `${counts.reasonedExempt} identical by written design)`,
);
