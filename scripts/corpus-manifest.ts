// Corpus integrity manifest (FIX-09 §A): a build-time content hash of the
// corpus-backed content, baked into the container image and re-verified at boot
// (api/corpus.ts verifyCorpusManifest, wired in api/server.ts) so an image that
// shipped with one corpus but is now serving a mutated one — a tampered image,
// a bind-mount, a bad deploy — is caught loudly instead of served silently.
//
//   node --experimental-strip-types scripts/corpus-manifest.ts
//   (or) npm run corpus:manifest
//
// Writes corpus.manifest.json at REPO_ROOT: { hash, files, generatedAt }.
//
// The hash covers every file in corpus/jurisdictions/*.json plus forms/registry.json.
// Files are sorted by their repo-relative path (not directory read order, which is
// platform-dependent) before hashing, and each file's bytes are wrapped in an explicit
// filename separator — so the digest is stable across machines/runs, changes if ANY
// byte of the corpus-backed content changes, and two different file sets can't collide
// by concatenating to the same byte stream.

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { pass } from "./util.ts";

// Computed independently of api/corpus.ts's REPO_ROOT (rather than imported from it) so
// this module has no dependency on api/ — api/corpus.ts imports computeCorpusManifest
// from HERE, and a scripts→api→scripts cycle would otherwise result.
const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(HERE, "..");

export interface CorpusManifest {
  hash: string;
  files: string[];
  generatedAt: string;
}

/** Path to the manifest file for a given repo root (defaults to the real REPO_ROOT). */
export function manifestPath(repoRoot: string = REPO_ROOT): string {
  return join(repoRoot, "corpus.manifest.json");
}

/**
 * Compute a stable SHA-256 over the sorted contents of corpus/jurisdictions/*.json +
 * forms/registry.json. Deterministic across calls/processes/machines for the same
 * bytes on disk — callable from tests, from this CLI, and from the boot-time
 * verifier (api/corpus.ts verifyCorpusManifest) alike.
 */
export function computeCorpusManifest(repoRoot: string = REPO_ROOT): CorpusManifest {
  const jurisdictionsDir = join(repoRoot, "corpus", "jurisdictions");
  const jurisdictionFiles = readdirSync(jurisdictionsDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => join("corpus", "jurisdictions", f));
  const files = [...jurisdictionFiles, join("forms", "registry.json")].sort();

  const hash = createHash("sha256");
  for (const rel of files) {
    const bytes = readFileSync(join(repoRoot, rel));
    // Filename separator around each file's bytes: prevents two different sets of
    // files from concatenating to an identical byte stream (a rename/split can't
    // masquerade as "no change").
    hash.update(rel);
    hash.update("\0");
    hash.update(bytes);
    hash.update("\0");
  }

  return { hash: hash.digest("hex"), files, generatedAt: new Date().toISOString() };
}

// ── CLI: (re)write the manifest file ────────────────────────────────────────────
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const manifest = computeCorpusManifest();
  writeFileSync(manifestPath(), JSON.stringify(manifest, null, 2) + "\n");
  pass(
    "corpus-manifest",
    `${manifest.files.length} file(s) hashed → ${manifest.hash.slice(0, 12)}… written to corpus.manifest.json`,
  );
}
