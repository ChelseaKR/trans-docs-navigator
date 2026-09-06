// What is actually running here, and which commit produced it.
//
// WHY THIS EXISTS
//
// The live preview is deployed by hand (`.github/workflows/deploy-aws-preview.yml` is
// `workflow_dispatch` only), so the running image can be arbitrarily far behind `main`
// and nothing about the running service said which commit it was. A reader — or the
// maintainer, or a post-deploy check — could see that the demo answered, and could not
// see what it was answering *from*. `docs/OPERATIONS.md` had to be trusted rather than
// consulted. That is the same shape as a published number with no provenance: the site
// is legible about everything except itself.
//
// WHAT IT REFUSES TO DO
//
// It never invents an answer. `BUILD_COMMIT` is accepted only as exactly 40 lowercase
// hex characters — the shape of a real git object name. Unset, empty, a short SHA, a
// branch name, the literal string "unknown": every one of those becomes `commit: null`
// with `stamped: false`, because a plausible-looking wrong commit is worse than an
// admitted absence. The same rule governs `built_at`: a value that does not parse as a
// date is reported as absent, not passed through.
//
// The values are baked into the image at `docker build` time (see the `BUILD_COMMIT` /
// `BUILD_TIME` build args in the Dockerfile), so they describe the image, not the host
// that happens to be running it, and they cannot drift once the image exists.
//
// PRIVACY: this endpoint reports build identity only. No request data, no corpus
// content, no environment beyond the two stamps and the already-public corpus digest.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..");

/** A real git object name: exactly 40 lowercase hex characters. Nothing else counts. */
const COMMIT_RE = /^[0-9a-f]{40}$/;

export interface BuildInfo {
  /** package.json version of the source this image was built from, or null. */
  version: string | null;
  /** The 40-hex commit the image was built from, or null when the image was not stamped. */
  commit: string | null;
  /** ISO-8601 build timestamp, or null when absent or unparseable. */
  built_at: string | null;
  /**
   * False whenever `commit` is null. Stated as its own field so a consumer does not
   * have to infer "unstamped" from a null it might otherwise read as a transport
   * problem — and so a post-deploy check can assert on it directly.
   */
  stamped: boolean;
  /**
   * The corpus digest baked into corpus.manifest.json at image-build time. This is the
   * value `api/server.ts` re-verifies against a live recompute at boot, so an image
   * that came up at all has already proved it serves these exact corpus bytes. Read
   * from the baked file rather than recomputed, because recomputing on every request
   * would re-hash the whole corpus to learn something boot already settled.
   */
  corpus_hash: string | null;
}

/** Accept a stamp only in the exact shape of a git object name. */
function readCommit(env: NodeJS.ProcessEnv): string | null {
  const raw = (env.BUILD_COMMIT ?? "").trim().toLowerCase();
  return COMMIT_RE.test(raw) ? raw : null;
}

/** Accept a build time only if it actually parses as a date; normalise to ISO-8601. */
function readBuiltAt(env: NodeJS.ProcessEnv): string | null {
  const raw = (env.BUILD_TIME ?? "").trim();
  if (raw === "") return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function readJsonField(path: string, field: string): string | null {
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
    const value = parsed[field];
    return typeof value === "string" && value !== "" ? value : null;
  } catch {
    return null;
  }
}

/**
 * Build identity for this running image. Pure with respect to its arguments so the
 * tests can drive every branch without mutating the real process environment.
 */
export function buildInfo(
  env: NodeJS.ProcessEnv = process.env,
  repoRoot: string = REPO_ROOT,
): BuildInfo {
  const commit = readCommit(env);
  return {
    version: readJsonField(join(repoRoot, "package.json"), "version"),
    commit,
    built_at: readBuiltAt(env),
    stamped: commit !== null,
    corpus_hash: readJsonField(join(repoRoot, "corpus.manifest.json"), "hash"),
  };
}
