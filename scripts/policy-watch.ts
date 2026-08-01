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
// normalize() is IMPORTED, not re-implemented. It used to be a byte-identical copy of
// source-watch's, which meant the loose-end-tag bug fixed there (js/bad-tag-filter) had to
// be found and fixed twice, and any future divergence would silently make "hashed the same
// way source-watch does" — the claim this file's header makes — untrue.
import { normalize, summarize } from "./source-watch.ts";
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

async function contentHash(url: string): Promise<string | null> {
  try {
    // NOTE (CodeQL js/file-access-to-http): `url` is read from a file (corpus/policy-trackers.json)
    // and fetched. That file is committed to this repository and changes only through a reviewed
    // PR — it is configuration, not input. There is no request-time path by which a user, or any
    // untrusted party, chooses this URL. Left as-is rather than suppressed; see the PR body.
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
const hasBaseline = Object.keys(baseline).length > 0;
const next: Record<string, string> = {};
const drifted: string[] = [];
const unreachable: string[] = [];
// Same fail-quiet class source-watch had, in a second form: a tracker configured with no
// baseline entry used to be *silently unwatched* — `baseline[url] && ...` is simply false,
// so it produced neither drift nor an error, forever. (This was live: the MAP Identity
// Document Laws tracker — the one most on-point for this corpus — had no baseline entry.)
// A configured-but-unbaselined tracker is now a coverage issue, reported alongside drift.
const missingBaseline: string[] = [];

for (const tracker of trackers) {
  const { url } = tracker;
  const hasUrlBaseline = Object.prototype.hasOwnProperty.call(baseline, url);
  if (!update && hasBaseline && !hasUrlBaseline) {
    missingBaseline.push(`${url} → baseline required for tracker '${tracker.name}' (${tracker.jurisdiction})`);
  }
  const hash = await contentHash(url);
  if (hash === null) {
    unreachable.push(url);
    if (hasUrlBaseline) next[url] = baseline[url]!; // keep the old baseline; an outage is not a change
    continue;
  }
  next[url] = hash;
  if (!update && hasUrlBaseline && baseline[url] !== hash) {
    // Affected records are the record's jurisdiction, computed fresh (not derived from
    // the tracker config) — the tracker's own jurisdiction tag is the unit a human
    // re-verifies against.
    const affected = loadCorpus()
      .filter((rec) => rec.jurisdiction === tracker.jurisdiction)
      .map((rec) => rec.id);
    drifted.push(`tracker '${tracker.name}' changed for ${tracker.jurisdiction} — records ${affected.join(", ") || "(none)"} may be affected`);
  }
}

const trackerUrls = new Set(trackers.map((t) => t.url));
const staleBaseline = !update && hasBaseline
  ? Object.keys(baseline)
      .filter((url) => !trackerUrls.has(url))
      .map((url) => `${url} → no configured tracker cites this baseline`)
  : [];

for (const u of unreachable) console.log(`  ⚠️  unreachable (skipped): ${u}`);

if (update) {
  // NOTE (CodeQL js/file-system-race): the existsSync(BASELINE_PATH) above and this write are
  // a check-then-act pair. Nothing turns on it — this is a human-invoked CLI (`--update`,
  // behind the review-gated `make policy-baseline`) writing a tracked file inside its own
  // git checkout, and the safety property that matters is the reviewed DIFF, not exclusive
  // access. There is no privileged path and no concurrent writer to race. Left as-is rather
  // than suppressed; see the PR body.
  writeFileSync(BASELINE_PATH, JSON.stringify(next, null, 2) + "\n");
  pass("policy-watch", `baseline written for ${Object.keys(next).length} tracker(s) → corpus/policy-hashes.json`);
} else if (trackers.length === 0) {
  fail("policy-watch", "no trackers configured — add entries to corpus/policy-trackers.json");
} else if (!hasBaseline) {
  fail("policy-watch", "no baseline committed — run `make policy-baseline` after reviewing the trackers");
} else {
  // Drift and coverage are reported together; neither suppresses the other.
  const summary = summarize([{ next, drifted, unreachable, missingBaseline, staleBaseline }], "tracker");
  if (!summary.ok) {
    fail("policy-watch", summary.message, summary.details);
  }
  pass("policy-watch", `${Object.keys(next).length - unreachable.length} tracker(s) unchanged since baseline`);
}
