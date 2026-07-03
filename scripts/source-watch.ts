// Source-change detection (scheduled, not merge-blocking). Fetches every corpus
// source URL, normalizes the body (tags and whitespace stripped — gov pages churn
// markup more than text), hashes it, and compares against the committed baseline in
// corpus/source-hashes.json. A changed hash means the official source moved under a
// record: a human must re-verify that record. The weekly workflow opens an issue
// naming the affected records; nothing is ever flipped automatically.
//
// Also watches the official form PDFs in forms/registry.json: fetched and hashed as
// raw bytes (NOT the HTML-normalize path above — a PDF isn't markup to strip), compared
// against forms/form-hashes.json. A changed hash means the official PDF was revised
// under a form: a human must re-verify version_hint/pdf_sha256/preparation for it.
//
//   node scripts/source-watch.ts            # compare against baselines (exit 1 on drift)
//   node scripts/source-watch.ts --update   # (re)write both baselines after re-verification
//
// Fetch failures are reported but never recorded as drift — a bot-block or outage is
// not a content change.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { loadCorpus, REPO_ROOT } from "../api/corpus.ts";
import { loadForms } from "../api/forms.ts";
import { pass, fail } from "./util.ts";

const CORPUS_BASELINE_PATH = join(REPO_ROOT, "corpus", "source-hashes.json");
const FORMS_BASELINE_PATH = join(REPO_ROOT, "forms", "form-hashes.json");
const TIMEOUT_MS = 20_000;
const UA = "trans-docs-navigator-source-watch/1.0 (+https://github.com/ChelseaKR/trans-docs-navigator)";

function normalize(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** HTML-normalized hash — used for corpus source pages (gov pages churn markup more than text). */
export async function contentHash(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(TIMEOUT_MS), headers: { "user-agent": UA } });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    const body = Buffer.from(await res.arrayBuffer());
    const material = type.includes("html") ? normalize(body.toString("utf8")) : body;
    return createHash("sha256").update(material).digest("hex");
  } catch {
    return null;
  }
}

/** Raw-bytes hash — used for form PDFs. No text-normalize path: a PDF isn't markup to strip. */
export async function binaryHash(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(TIMEOUT_MS), headers: { "user-agent": UA } });
    if (!res.ok) return null;
    const body = Buffer.from(await res.arrayBuffer());
    return createHash("sha256").update(body).digest("hex");
  } catch {
    return null;
  }
}

export interface WatchResult {
  next: Record<string, string>;
  drifted: string[];
  unreachable: string[];
}

/**
 * Shared fetch-hash-compare loop, reused for both the corpus (HTML-normalized) and the
 * forms (raw-bytes) watches. Fetch failures never flip a URL to "drift" — the prior
 * baseline hash is carried forward instead (an outage is not a content change).
 */
export async function computeUrlHashes(
  byUrl: Map<string, string[]>,
  hashFn: (url: string) => Promise<string | null>,
  baseline: Record<string, string>,
  update: boolean,
): Promise<WatchResult> {
  const next: Record<string, string> = {};
  const drifted: string[] = [];
  const unreachable: string[] = [];

  for (const [url, ids] of byUrl) {
    const hash = await hashFn(url);
    if (hash === null) {
      unreachable.push(url);
      if (baseline[url]) next[url] = baseline[url]; // keep the old baseline; an outage is not a change
      continue;
    }
    next[url] = hash;
    if (!update && baseline[url] && baseline[url] !== hash) {
      drifted.push(`${url} → re-verify: ${ids.join(", ")}`);
    }
  }
  return { next, drifted, unreachable };
}

function readBaseline(path: string): Record<string, string> {
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as Record<string, string>) : {};
}

async function main(): Promise<void> {
  const update = process.argv.includes("--update");

  // url → ids of the records/forms that cite it (drift is reported per id, the unit a
  // human re-verifies).
  const corpusByUrl = new Map<string, string[]>();
  for (const r of loadCorpus()) {
    corpusByUrl.set(r.source.url, [...(corpusByUrl.get(r.source.url) ?? []), r.id]);
  }
  const formsByUrl = new Map<string, string[]>();
  for (const f of loadForms()) {
    formsByUrl.set(f.source.url, [...(formsByUrl.get(f.source.url) ?? []), f.id]);
  }

  const corpusBaseline = readBaseline(CORPUS_BASELINE_PATH);
  const formsBaseline = readBaseline(FORMS_BASELINE_PATH);

  const corpusResult = await computeUrlHashes(corpusByUrl, contentHash, corpusBaseline, update);
  const formsResult = await computeUrlHashes(formsByUrl, binaryHash, formsBaseline, update);

  for (const u of [...corpusResult.unreachable, ...formsResult.unreachable]) {
    console.log(`  ⚠️  unreachable (skipped): ${u}`);
  }

  if (update) {
    writeFileSync(CORPUS_BASELINE_PATH, JSON.stringify(corpusResult.next, null, 2) + "\n");
    writeFileSync(FORMS_BASELINE_PATH, JSON.stringify(formsResult.next, null, 2) + "\n");
    pass(
      "source-watch",
      `baselines written for ${Object.keys(corpusResult.next).length} corpus source(s) → corpus/source-hashes.json, ` +
        `${Object.keys(formsResult.next).length} form PDF(s) → forms/form-hashes.json`,
    );
    return;
  }

  if (Object.keys(corpusBaseline).length === 0 || Object.keys(formsBaseline).length === 0) {
    fail("source-watch", "no baseline committed — run `make source-baseline` after verifying records/forms");
    return;
  }

  const drifted = [...corpusResult.drifted, ...formsResult.drifted];
  if (drifted.length > 0) {
    fail("source-watch", `${drifted.length} source(s) changed since baseline — records/forms need re-verification`, drifted);
    return;
  }

  const unchanged =
    Object.keys(corpusResult.next).length -
    corpusResult.unreachable.length +
    (Object.keys(formsResult.next).length - formsResult.unreachable.length);
  pass("source-watch", `${unchanged} source(s) unchanged since baseline`);
}

// Only run when invoked as a script (`node scripts/source-watch.ts`), not when imported
// by tests — importing must never trigger live network fetches.
const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) await main();
