// Policy-change sentinel (scheduled, not merge-blocking). Watches a small, hand-
// curated set of authoritative trackers (MAP, A4TE, legislative-tracker pages) — the
// upstream sources law and policy actually change on — rather than the individual
// cited source URLs source-watch.ts already covers. Fetches each tracker page,
// normalizes and hashes it the same way source-watch.ts does, and compares against the
// committed baseline in corpus/policy-hashes.json. A changed hash means a tracker
// moved: it does not mean any specific record is wrong, but every record in the
// tracker's jurisdiction is now a candidate for re-verification, so the weekly workflow
// annotates the content-watch issue with the affected record ids. A human decides;
// nothing here ever edits a record automatically.
//
//   node scripts/policy-watch.ts            # compare against baseline (exit 1 on drift)
//   node scripts/policy-watch.ts --update   # (re)write the baseline after a review pass
//
// Fetch failures are reported but never recorded as drift — a bot-block or outage is
// not a policy change. Respect each tracker's ToS: this runs at the same low weekly
// cadence as source-watch.ts, with the same descriptive UA.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { loadCorpus, REPO_ROOT } from "../api/corpus.ts";
import type { JurisdictionId } from "../api/types.ts";
import { pass, fail } from "./util.ts";

interface PolicyTracker {
  jurisdiction: JurisdictionId;
  name: string;
  url: string;
}

const TRACKERS_PATH = join(REPO_ROOT, "corpus", "policy-trackers.json");
const BASELINE_PATH = join(REPO_ROOT, "corpus", "policy-hashes.json");
const TIMEOUT_MS = 20_000;
const UA = "trans-docs-navigator-policy-watch/1.0 (+https://github.com/ChelseaKR/trans-docs-navigator)";
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

const trackers: PolicyTracker[] = existsSync(TRACKERS_PATH) ? JSON.parse(readFileSync(TRACKERS_PATH, "utf8")) : [];

const baseline: Record<string, string> = existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, "utf8")) : {};
const next: Record<string, string> = {};
const drifted: string[] = [];
const unreachable: string[] = [];

for (const tracker of trackers) {
  const { url } = tracker;
  const hash = await contentHash(url);
  if (hash === null) {
    unreachable.push(url);
    if (baseline[url]) next[url] = baseline[url]; // keep the old baseline; an outage is not a change
    continue;
  }
  next[url] = hash;
  if (!update && baseline[url] && baseline[url] !== hash) {
    // Affected records are the record's jurisdiction, computed fresh (not derived from
    // the tracker config) — the tracker's own jurisdiction tag is the unit a human
    // re-verifies against.
    const affected = loadCorpus()
      .filter((rec) => rec.jurisdiction === tracker.jurisdiction)
      .map((rec) => rec.id);
    drifted.push(`tracker '${tracker.name}' changed for ${tracker.jurisdiction} — records ${affected.join(", ") || "(none)"} may be affected`);
  }
}

for (const u of unreachable) console.log(`  ⚠️  unreachable (skipped): ${u}`);

if (update) {
  writeFileSync(BASELINE_PATH, JSON.stringify(next, null, 2) + "\n");
  pass("policy-watch", `baseline written for ${Object.keys(next).length} tracker(s) → corpus/policy-hashes.json`);
} else if (trackers.length === 0) {
  fail("policy-watch", "no trackers configured — add entries to corpus/policy-trackers.json");
} else if (Object.keys(baseline).length === 0) {
  fail("policy-watch", "no baseline committed — run `make policy-baseline` after reviewing the trackers");
} else if (drifted.length > 0) {
  fail("policy-watch", `${drifted.length} tracker(s) changed since baseline — affected records need re-verification`, drifted);
} else {
  pass("policy-watch", `${Object.keys(next).length - unreachable.length} tracker(s) unchanged since baseline`);
}
