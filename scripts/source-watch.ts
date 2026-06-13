// Source-change detection (scheduled, not merge-blocking). Fetches every corpus
// source URL, normalizes the body (tags and whitespace stripped — gov pages churn
// markup more than text), hashes it, and compares against the committed baseline in
// corpus/source-hashes.json. A changed hash means the official source moved under a
// record: a human must re-verify that record. The weekly workflow opens an issue
// naming the affected records; nothing is ever flipped automatically.
//
//   node scripts/source-watch.ts            # compare against baseline (exit 1 on drift)
//   node scripts/source-watch.ts --update   # (re)write the baseline after re-verification
//
// Fetch failures are reported but never recorded as drift — a bot-block or outage is
// not a content change.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { loadCorpus, REPO_ROOT } from "../api/corpus.ts";
import { pass, fail } from "./util.ts";

const BASELINE_PATH = join(REPO_ROOT, "corpus", "source-hashes.json");
const TIMEOUT_MS = 20_000;
const UA = "trans-docs-navigator-source-watch/1.0 (+https://github.com/ChelseaKR/trans-docs-navigator)";
const update = process.argv.includes("--update");

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

async function contentHash(url: string): Promise<string | null> {
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

// url → records that cite it (drift is reported per record, the unit a human re-verifies).
const byUrl = new Map<string, string[]>();
for (const r of loadCorpus()) {
  byUrl.set(r.source.url, [...(byUrl.get(r.source.url) ?? []), r.id]);
}

const baseline: Record<string, string> = existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, "utf8")) : {};
const next: Record<string, string> = {};
const drifted: string[] = [];
const unreachable: string[] = [];

for (const [url, recordIds] of byUrl) {
  const hash = await contentHash(url);
  if (hash === null) {
    unreachable.push(url);
    if (baseline[url]) next[url] = baseline[url]; // keep the old baseline; an outage is not a change
    continue;
  }
  next[url] = hash;
  if (!update && baseline[url] && baseline[url] !== hash) {
    drifted.push(`${url} → re-verify: ${recordIds.join(", ")}`);
  }
}

for (const u of unreachable) console.log(`  ⚠️  unreachable (skipped): ${u}`);

if (update) {
  writeFileSync(BASELINE_PATH, JSON.stringify(next, null, 2) + "\n");
  pass("source-watch", `baseline written for ${Object.keys(next).length} URL(s) → corpus/source-hashes.json`);
} else if (Object.keys(baseline).length === 0) {
  fail("source-watch", "no baseline committed — run `make source-baseline` after verifying records");
} else if (drifted.length > 0) {
  fail("source-watch", `${drifted.length} source(s) changed since baseline — records need re-verification`, drifted);
} else {
  pass("source-watch", `${Object.keys(next).length - unreachable.length} source(s) unchanged since baseline`);
}
