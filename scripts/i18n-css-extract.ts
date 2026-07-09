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
const OUT = resolve(OUT_DIR, "app.generated.css");

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, STYLE.trimStart() + "\n", "utf8");
console.log(`  ✅ i18n-css-extract: wrote ${OUT.replace(process.cwd() + "/", "")} from src/render.ts STYLE`);
