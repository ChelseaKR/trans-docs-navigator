// The portable single-file edition (#233; docs/ideation/03-expansions.md EXP-02).
//
// `make portable` writes ONE self-contained HTML file that runs intake, the checklist,
// the packet, /move and /compare entirely in the reader's browser from `file://`, with
// the network disabled and nothing to phone home to. It is the strongest privacy posture
// this threat model can offer: a community organiser can hand it out on a USB stick, and
// a reader in a hostile jurisdiction can use the whole navigator without a single request
// existing to be logged, subpoenaed, or correlated.
//
// HOW IT AVOIDS BECOMING A FORK. The dangerous version of this feature is a second,
// quieter copy of the engine that drifts from the server and starts giving different
// answers about the law. So no application code is duplicated: this script SHIPS
// api/ and src/ unmodified. It strips their types with node:module's own
// stripTypeScriptTypes, mechanically rewrites their static imports and exports onto a
// tiny registry, and supplies a `node:` shim (scripts/portable/runtime.js) so the same
// modules load in a browser. tests/portable.test.ts then asserts the bundle's
// `handleRoute` is BYTE-IDENTICAL to the repository's across the whole eval gold set and
// a route matrix, in both languages, so drift fails the build rather than shipping.
//
// ADR-0006 (no bundler): the rewrite below is concatenation and two regular expressions
// over an already-type-stripped source, with build-time refusals wherever a mechanical
// rewrite could be wrong (see `transformModule` and `assertCycleSafety`). It adds no
// dependency.
//
// WHAT THIS SCRIPT REFUSES TO DO, and why each refusal is a refusal rather than a
// fallback: an unbundled module, an unresolvable import specifier, an import form the
// rewrite does not understand, a mutable `export let` another module reads, a cycle whose
// bindings are not hoisted functions, a missing placeholder, and a corpus file that turns
// out not to be in the virtual filesystem all throw. Each of them, softened, would
// produce a file that opens, looks like the navigator, and answers with less than the
// truth — which is the failure this project can least afford.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { dirname, join, posix, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { escapeHtml, STYLE } from "../src/render.ts";
import { t as locale, SUPPORTED_LOCALES } from "../src/i18n/index.ts";
import { pass, fail } from "./util.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..");
const PORTABLE_DIR = join(HERE, "portable");

/** Where the virtual filesystem is rooted inside the bundle. */
const VFS_ROOT = "/tdn";

/** The entry point: the same pure router api/server.ts calls. */
const ENTRY = "api/router.ts";

/**
 * Modules the driver requires directly. They are all reachable from ENTRY today, but
 * naming them makes that a checked fact rather than a coincidence: if a refactor stops
 * the router from pulling one in, the build fails here instead of the file failing to
 * open in someone's hands.
 */
const DRIVER_MODULES = [
  "api/corpus.ts",
  "api/horizon.ts",
  "src/offline.ts",
  "src/render.ts",
  "src/i18n/index.ts",
];

/**
 * Everything the shipped modules read from disk at runtime, as repo-relative globs.
 * Directories are taken whole; a file that turns out to be missing from this list
 * surfaces as an ENOENT during the build's own exercise pass (below), never as a
 * silently short corpus in a reader's hands.
 */
const VFS_DIRS = [
  "corpus/jurisdictions",
  "corpus/referrals",
  "public/assets",
];
const VFS_FILES = [
  "corpus/VERIFIERS.json",
  "corpus/translation-status.json",
  "corpus/source-hashes.json",
  "corpus/snapshots/index.json",
  "forms/registry.json",
  "forms/form-hashes.json",
  "package.json",
];

/** Files under a VFS directory that must not ship: type stubs and the social card. */
const VFS_SKIP = new Set(["og-default.png"]);

/**
 * The digest is embedded in the file it describes, so it is computed over the file with
 * every occurrence of the digest replaced by this placeholder. `--verify` reverses that
 * exactly, which makes the claim checkable from the artifact alone rather than from a
 * build log nobody kept.
 */
const HASH_PLACEHOLDER = "0".repeat(64);

// ---------------------------------------------------------------------------
// Module graph
// ---------------------------------------------------------------------------

interface ModuleInfo {
  id: string;
  /** Transformed body, ready to be wrapped in a module function. */
  body: string;
  /** Exported names whose declarations hoist (function declarations only). */
  hoisted: string[];
  /** Exported names that do not hoist (const, class). */
  deferred: string[];
  /** `export { x } from "./y"` — assigned from a namespace so it cannot collide with an
   *  identically-named value import of the same binding (api/router.ts does both). */
  reexports: { name: string; expression: string }[];
  /** Exported names bound with `let`/`var`, which this registry cannot keep live. */
  mutable: string[];
  /** Module ids this one imports at load time, and the names taken from each. */
  imports: { id: string; names: string[] }[];
}

const IMPORT_RE = /^[ \t]*import\s*\{([^}]*)\}\s*from\s*["']([^"']+)["'];?[ \t]*$/gm;
const REEXPORT_RE = /^[ \t]*export\s*\{([^}]*)\}\s*from\s*["']([^"']+)["'];?[ \t]*$/gm;
const LOCAL_EXPORT_LIST_RE = /^[ \t]*export\s*\{([^}]*)\}\s*;?[ \t]*$/gm;
const ANY_IMPORT_RE = /^[ \t]*import\b/gm;

function readModuleSource(id: string): string {
  const raw = readFileSync(join(REPO_ROOT, id), "utf8");
  if (!id.endsWith(".ts")) return raw;
  // `mode: "strip"` replaces type syntax with whitespace rather than deleting it, so
  // `import type` lines become blank and every remaining `import` is a real value
  // import. That is what makes the two regular expressions below sufficient.
  return stripTypeScriptTypes(raw, { mode: "strip" });
}

function resolveSpecifier(fromId: string, spec: string): string {
  const resolved = posix.normalize(posix.join(posix.dirname(fromId), spec));
  if (!existsSync(join(REPO_ROOT, resolved))) {
    throw new Error(`portable build: ${fromId} imports "${spec}", which resolves to ${resolved} — no such file`);
  }
  return resolved;
}

/** Split a `{ a, b as c }` clause into [localName, importedName] pairs. */
function parseNamedClause(clause: string): { imported: string; local: string }[] {
  return clause
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => {
      const parts = s.split(/\s+as\s+/);
      const imported = (parts[0] ?? "").trim();
      const local = (parts[1] ?? parts[0] ?? "").trim();
      if (!/^[A-Za-z_$][\w$]*$/.test(imported) || !/^[A-Za-z_$][\w$]*$/.test(local)) {
        throw new Error(`portable build: cannot parse import/export clause fragment "${s}"`);
      }
      return { imported, local };
    });
}

function transformModule(id: string): ModuleInfo {
  let src = readModuleSource(id);
  const imports: { id: string; names: string[] }[] = [];
  const hoisted: string[] = [];
  const deferred: string[] = [];
  const mutable: string[] = [];
  const reexports: { name: string; expression: string }[] = [];
  let reexportSeq = 0;

  // `export { a, b } from "./x.ts"`. Bound through a namespace rather than destructured:
  // api/router.ts both imports `asLanguage` for its own use and re-exports it, and two
  // `const` declarations of one name in the same module function is a SyntaxError that
  // would take the whole bundle down at parse time.
  src = src.replace(REEXPORT_RE, (_m, clause: string, spec: string) => {
    const target = resolveSpecifier(id, spec);
    const pairs = parseNamedClause(clause);
    imports.push({ id: target, names: pairs.map((p) => p.imported) });
    const ns = `__tdn_reexport_${reexportSeq++}`;
    for (const p of pairs) reexports.push({ name: p.local, expression: `${ns}.${p.imported}` });
    return `const ${ns} = __tdn_require(${JSON.stringify(target)});`;
  });

  // `import { a, b as c } from "./x.ts"` / `from "node:fs"`.
  src = src.replace(IMPORT_RE, (_m, clause: string, spec: string) => {
    const target = spec.startsWith("node:") ? spec : resolveSpecifier(id, spec);
    const pairs = parseNamedClause(clause);
    if (!spec.startsWith("node:")) imports.push({ id: target, names: pairs.map((p) => p.imported) });
    const bindings = pairs.map((p) => (p.imported === p.local ? p.imported : `${p.imported}: ${p.local}`)).join(", ");
    return `const { ${bindings} } = __tdn_require(${JSON.stringify(target)});`;
  });

  // Anything still calling itself an import is a form this rewrite does not understand
  // (a default import, a namespace import, a side-effect import). Refuse rather than
  // emit a module that silently lost a binding.
  const leftovers = [...src.matchAll(ANY_IMPORT_RE)];
  if (leftovers.length > 0) {
    const lines = leftovers.map((m) => src.slice(m.index ?? 0).split("\n")[0]?.trim());
    throw new Error(`portable build: ${id} uses an import form the bundler does not support:\n  ${lines.join("\n  ")}`);
  }

  // `export { a, b };` with no source — record the names, drop the statement.
  src = src.replace(LOCAL_EXPORT_LIST_RE, (_m, clause: string) => {
    for (const p of parseNamedClause(clause)) deferred.push(p.local);
    return "";
  });

  // Declaration exports. Only the declaration keyword is removed; the declaration and
  // its body are untouched, which is why nothing about the shipped logic can change here.
  src = src.replace(
    /^([ \t]*)export\s+(async\s+function|function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/gm,
    (_m, indent: string, kind: string, name: string) => {
      if (kind === "function" || kind === "async function") hoisted.push(name);
      else if (kind === "let" || kind === "var") mutable.push(name);
      else deferred.push(name);
      return `${indent}${kind} ${name}`;
    },
  );

  const stillExported = /^[ \t]*export\b/m.exec(src);
  if (stillExported) {
    const line = src.slice(stillExported.index).split("\n")[0]?.trim();
    throw new Error(`portable build: ${id} uses an export form the bundler does not support: ${line}`);
  }

  // Module-relative self-identification. `import.meta` is meaningless outside a module,
  // and the value the shipped code wants from it is only ever "where am I on disk" —
  // answered here by the virtual filesystem's own layout.
  src = src.replaceAll("import.meta.url", JSON.stringify(`file://${VFS_ROOT}/${id}`));

  const assignments = (names: string[]) => names.map((n) => `  __exports.${n} = ${n};`).join("\n");
  const tail = [...deferred, ...mutable]
    .map((n) => `  __exports.${n} = ${n};`)
    .concat(reexports.map((r) => `  __exports.${r.name} = ${r.expression};`))
    .join("\n");

  // The hoisted assignments come FIRST, before any `__tdn_require` this module makes.
  // That is what makes the one import cycle in this graph (src/render.ts <-> src/seo.ts)
  // resolve to real functions instead of `undefined`: when the cycle re-enters this
  // module's half-built exports object, the function declarations are already on it.
  const body =
    (hoisted.length > 0 ? `${assignments(hoisted)}\n` : "") + src + (tail.length > 0 ? `\n${tail}\n` : "");

  return { id, body, hoisted, deferred, mutable, reexports, imports };
}

function buildGraph(roots: string[]): Map<string, ModuleInfo> {
  const modules = new Map<string, ModuleInfo>();
  const queue = [...roots];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    if (modules.has(id)) continue;
    const info = transformModule(id);
    modules.set(id, info);
    for (const dep of info.imports) if (!modules.has(dep.id)) queue.push(dep.id);
  }
  return modules;
}

/**
 * A registry-based bundle evaluates a cycle's second module against a HALF-BUILT exports
 * object. That is safe for a hoisted function declaration and unsafe for anything else,
 * so every name crossing a cycle edge must be a function this module already assigned.
 * The alternative — quietly binding `undefined` — is how a page would render with a
 * whole section missing and no error anywhere.
 */
function assertCycleSafety(modules: Map<string, ModuleInfo>): string[] {
  const cycles: string[] = [];
  const problems: string[] = [];
  const state = new Map<string, number>(); // 1 = on stack, 2 = done
  const stack: string[] = [];

  const visit = (id: string): void => {
    state.set(id, 1);
    stack.push(id);
    for (const dep of modules.get(id)?.imports ?? []) {
      const s = state.get(dep.id) ?? 0;
      if (s === 1) {
        const cycle = [...stack.slice(stack.indexOf(dep.id)), dep.id];
        cycles.push(cycle.join(" -> "));
        const target = modules.get(dep.id);
        for (const name of dep.names) {
          if (target && !target.hoisted.includes(name)) {
            problems.push(
              `${id} imports "${name}" from ${dep.id} across an import cycle, but it is not a ` +
                `hoisted function declaration — it would bind undefined in the portable bundle`,
            );
          }
        }
      } else if (s === 0) {
        visit(dep.id);
      }
    }
    stack.pop();
    state.set(id, 2);
  };

  for (const id of modules.keys()) if ((state.get(id) ?? 0) === 0) visit(id);
  if (problems.length > 0) throw new Error(`portable build: unsafe import cycle\n  ${problems.join("\n  ")}`);
  return cycles;
}

/** A mutable export another bundled module reads cannot stay live through this registry. */
function assertNoLiveMutableExports(modules: Map<string, ModuleInfo>): void {
  const problems: string[] = [];
  for (const [id, info] of modules) {
    for (const dep of info.imports) {
      const target = modules.get(dep.id);
      if (!target) continue;
      for (const name of dep.names) {
        if (target.mutable.includes(name)) {
          problems.push(`${id} imports the mutable binding "${name}" from ${dep.id}; the portable registry copies it once`);
        }
      }
    }
  }
  if (problems.length > 0) throw new Error(`portable build: live mutable export\n  ${problems.join("\n  ")}`);
}

// ---------------------------------------------------------------------------
// Virtual filesystem
// ---------------------------------------------------------------------------

function buildVfs(): Record<string, string> {
  const vfs: Record<string, string> = {};
  const add = (rel: string): void => {
    vfs[`${VFS_ROOT}/${rel}`] = readFileSync(join(REPO_ROOT, rel), "utf8");
  };
  for (const dir of VFS_DIRS) {
    for (const name of readdirSync(join(REPO_ROOT, dir)).sort()) {
      if (VFS_SKIP.has(name) || name.endsWith(".d.ts")) continue;
      add(posix.join(dir, name));
    }
  }
  for (const file of VFS_FILES) add(file);
  return vfs;
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

/**
 * The shell has exactly one `<script>` element, so the assembled document must contain
 * exactly one `</script>`. A second one means the payload closed the element early and
 * the browser is parsing application source as markup — which fails silently enough to
 * ship (the page still opens, and renders its noscript fallback as though JavaScript
 * were switched off).
 */
function assertSingleScriptClose(html: string): void {
  const closes = html.split("</script").length - 1;
  if (closes !== 1) {
    throw new Error(`portable build: the assembled document contains ${closes} "</script" sequences, expected exactly 1`);
  }
}

function substituteOnce(template: string, token: string, value: string, where: string): string {
  const parts = template.split(token);
  if (parts.length !== 2) {
    throw new Error(`portable build: expected exactly one "${token}" in ${where}, found ${parts.length - 1}`);
  }
  return parts.join(value);
}

export interface PortableBuild {
  html: string;
  sha256: string;
  built: string;
  bytes: number;
  moduleCount: number;
  vfsCount: number;
  cycles: string[];
}

export function buildPortable(opts: { built?: string } = {}): PortableBuild {
  const built = opts.built ?? new Date().toISOString().slice(0, 10);
  const modules = buildGraph([ENTRY, ...DRIVER_MODULES]);
  const cycles = assertCycleSafety(modules);
  assertNoLiveMutableExports(modules);

  const vfs = buildVfs();

  let runtime = readFileSync(join(PORTABLE_DIR, "runtime.js"), "utf8");
  runtime = substituteOnce(runtime, "__TDN_VFS__", JSON.stringify(vfs), "runtime.js");
  runtime = substituteOnce(
    runtime,
    "__TDN_BUILD__",
    JSON.stringify({ built, payload_sha256: HASH_PLACEHOLDER, generator: "scripts/portable-build.ts" }),
    "runtime.js",
  );

  const moduleBlock = [...modules.keys()]
    .sort()
    .map((id) => {
      const info = modules.get(id) as ModuleInfo;
      return `__tdn_modules[${JSON.stringify(id)}] = function (__exports, __tdn_require, process) {\n${info.body}\n};\n`;
    })
    .join("\n");

  const driver = readFileSync(join(PORTABLE_DIR, "driver.js"), "utf8");

  // `</script` ANYWHERE in the payload ends the inline script element — the HTML parser
  // does not care that it is inside a JavaScript string. src/pages.ts renders
  // `<script type="module" src="/assets/...">...</script>` tags as part of its page
  // templates, so those closing tags are in the bundled source text, and unescaped they
  // truncated the whole bundle mid-expression. The browser then parsed the REST of the
  // application source as HTML and tried to load /assets/*.js off the filesystem root.
  //
  // Measured before the fix: `SyntaxError: Unexpected end of input`, six blocked
  // sub-resource loads, and a page that rendered its own <noscript> fallback — i.e. the
  // artifact opened, looked deliberate, and did nothing. `\/` inside a JavaScript string,
  // template literal or regular expression is the same character as `/`, and inside a
  // JSON string it is a legal escape, so this rewrite is value-preserving everywhere the
  // payload can put it. assertSingleScriptClose below is the proof, not this comment.
  const script = `${runtime}\n${moduleBlock}\n${driver}`.replaceAll("</script", "<\\/script");

  let html = readFileSync(join(PORTABLE_DIR, "shell.html"), "utf8");
  html = substituteOnce(html, "__TDN_TITLE__", "Trans Docs Navigator — portable copy", "shell.html");
  html = substituteOnce(html, "__TDN_BUILT__", built, "shell.html");
  html = substituteOnce(html, "__TDN_SHA256__", HASH_PLACEHOLDER, "shell.html");
  html = substituteOnce(html, "__TDN_NOSCRIPT__", noscriptBlock(), "shell.html");
  html = substituteOnce(html, "__TDN_STYLE__", portableStyle(), "shell.html");
  html = substituteOnce(html, "__TDN_SCRIPT__", script, "shell.html");

  assertSingleScriptClose(html);

  const sha256 = createHash("sha256").update(html, "utf8").digest("hex");
  const final = html.replaceAll(HASH_PLACEHOLDER, sha256);

  return {
    html: final,
    sha256,
    built,
    bytes: Buffer.byteLength(final, "utf8"),
    moduleCount: modules.size,
    vfsCount: Object.keys(vfs).length,
    cycles,
  };
}

/**
 * The no-JavaScript fallback, in EVERY registered language at once.
 *
 * It has to be every language, because it renders before anything has run that could ask
 * which one the reader wants — and a Spanish reader who opens this file on a locked-down
 * browser is exactly the reader who most needs to be told, in Spanish, that the file is
 * not broken and that nothing has been transmitted.
 *
 * Both strings come from src/i18n rather than being typed into the shell template, so
 * they sit inside the key-parity gate like every other string a reader can see. A literal
 * here would have been the one piece of user-facing copy in the artifact that no gate
 * could look at.
 */
function noscriptBlock(): string {
  const blocks = SUPPORTED_LOCALES.map((l) => {
    const ui = locale(l.language).ui;
    return `  <p lang="${l.language}"><strong>${escapeHtml(ui.noscriptTitle)}</strong> ${escapeHtml(ui.noscriptBody)}</p>`;
  });
  return `<noscript>\n${blocks.join("\n")}\n</noscript>`;
}

/**
 * The app stylesheet — the same typed PALETTE that is served at /assets/app.css online,
 * imported from src/render.ts rather than re-derived, so the portable edition cannot end
 * up carrying a second palette that the a11y contrast gate has never seen. The only
 * additions are two layout rules for the portable banner, which the online edition has
 * no element for.
 */
function portableStyle(): string {
  return `${STYLE}\n#tdn-portable-header { margin: 0 0 1rem 0; }\n#tdn-portable-header code { word-break: break-all; }\n`;
}

/**
 * Recompute a built file's embedded digest: replace every occurrence of the digest it
 * declares with the placeholder and hash the result. Reverses the build exactly, so the
 * claim is checkable from the artifact alone.
 */
export function verifyPortable(html: string): { declared: string; actual: string; ok: boolean } {
  const declared = /<meta name="tdn-content-sha256" content="([0-9a-f]{64})">/.exec(html)?.[1] ?? "";
  if (declared === "") throw new Error("portable verify: no tdn-content-sha256 meta tag in the file");
  const actual = createHash("sha256").update(html.replaceAll(declared, HASH_PLACEHOLDER), "utf8").digest("hex");
  return { declared, actual, ok: declared === actual };
}

export const OUTPUT_PATH = join(REPO_ROOT, "dist", "portable", "trans-docs-navigator.html");

/**
 * Size budget. The point of the artifact is that it can be handed over on a USB stick,
 * emailed, or AirDropped, so the ceiling is a product constraint rather than a
 * performance one. Asserted in CI (tests/portable.test.ts).
 */
export const SIZE_BUDGET_BYTES = 6 * 1024 * 1024;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.includes("--verify")) {
      const html = readFileSync(OUTPUT_PATH, "utf8");
      const v = verifyPortable(html);
      if (!v.ok) fail("portable", `content hash mismatch: declares ${v.declared}, computes ${v.actual}`);
      pass("portable", `content hash verified (${v.declared.slice(0, 16)}…)`);
    } else {
      const build = buildPortable();
      mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
      writeFileSync(OUTPUT_PATH, build.html, "utf8");
      writeFileSync(`${OUTPUT_PATH}.sha256`, `${build.sha256}  ${posix.basename(OUTPUT_PATH)}\n`, "utf8");
      const kib = (build.bytes / 1024).toFixed(0);
      if (build.bytes > SIZE_BUDGET_BYTES) {
        fail("portable", `${kib} KiB exceeds the ${(SIZE_BUDGET_BYTES / 1024 / 1024).toFixed(0)} MiB budget`);
      }
      pass(
        "portable",
        `${relative(REPO_ROOT, OUTPUT_PATH)} — ${kib} KiB, ${build.moduleCount} modules, ` +
          `${build.vfsCount} bundled files, sha256 ${build.sha256.slice(0, 16)}…`,
      );
    }
  } catch (err) {
    fail("portable", err instanceof Error ? err.message : String(err));
  }
}
