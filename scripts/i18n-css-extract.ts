// G10 helper — materialize the app stylesheet for stylelint.
//
// The stylesheet is not a committed .css file: it is the typed `STYLE` template in
// src/render.ts (derived from the PALETTE, served at /assets/app.css). stylelint
// lints .css files, so this script imports the SAME `STYLE` the server ships and
// writes it to a git-ignored artifact (tmp/ is ignored) for `make i18n-logical-css`
// to lint. One source of truth: fix findings in src/render.ts, never the artifact.
//
// Deterministic, dependency-free, offline.

import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { STYLE } from "../src/render.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(HERE, "../tmp");
// Test-only override (tests/gate-efficacy): write to a fixture path instead of the
// real generated artifact. Unset in production, so behavior is unchanged.
const OUT = process.env.CSS_EXTRACT_OUT ?? resolve(OUT_DIR, "app.generated.css");

// Test-only injection point (tests/gate-efficacy): CSS_EXTRACT_POISON=1 appends a
// physical (non-logical) inline-axis rule, simulating the RTL-readiness regression
// G10/stylelint-use-logical exists to catch. Inert unless the env var is exactly
// "1", so production output is unchanged.
const POISON = process.env.CSS_EXTRACT_POISON === "1";
const body = STYLE.trimStart() + (POISON ? "\n.poison { margin-left: 1rem; }\n" : "") + "\n";

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, body, "utf8");
console.log(`  ✅ i18n-css-extract: wrote ${OUT.replace(process.cwd() + "/", "")} from src/render.ts STYLE`);
