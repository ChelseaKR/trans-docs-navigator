// External drift sync (#228): read the vendored ID Churn Sentinel feed and report — or,
// with --apply, write — the records whose cited source a named human has confirmed moved.
//
//   node scripts/sentinel-sync.ts            # report; exit 1 when a flag is owed
//   node scripts/sentinel-sync.ts --apply    # write the owed flags into corpus/jurisdictions/
//   node scripts/sentinel-sync.ts --vendor   # re-vendor from a local sentinel checkout
//
// NOT a `make verify` stage, deliberately. This is content-ops: it reads an artifact
// refreshed on someone else's schedule, exactly like `source-watch` and `policy-watch`,
// which are scheduled and non-merge-blocking for the same reason. Its merge-blocking half
// lives in `make content`, which re-checks every flag already written into the corpus
// against the vendored feed — so a hand-written flag, or a vendored file edited to make a
// red gate green, fails a blocking gate. Adding a 26th `verify` stage would also mean
// renumbering the gate-count contract in four self-describing documents for a check that
// cannot be made from the repository's own bytes alone.
//
// The exit code is the only thing a scheduled workflow reads, so it is precise: 1 means a
// flag is OWED, not that anything is wrong with the feed. A feed that cannot be trusted
// throws instead, and that is a different, louder failure.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

import { loadCorpus, REPO_ROOT } from "../api/corpus.ts";
import {
  SENTINEL_FEED_ID,
  applyPlanToFile,
  loadSentinel,
  planWrites,
  sentinelDir,
  summarize,
} from "../api/sentinel.ts";
import { pass, fail, walk } from "./util.ts";

const args = new Set(process.argv.slice(2));
const dir = sentinelDir();

if (args.has("--vendor")) {
  // Re-vendor from a sibling checkout and rewrite the pin. Deliberately manual: pulling
  // the feed on a schedule would make an upstream edit land here with nobody reading it.
  const from = process.env.SENTINEL_DOCS ?? join(REPO_ROOT, "..", "id-churn-sentinel", "docs");
  const files: Array<[string, string]> = [
    [join(from, "changes.json"), "changes.json"],
    [join(from, "sources.json"), "sources.json"],
    [join(from, "schema", "changes-v2.schema.json"), "changes-v2.schema.json"],
  ];
  for (const [src] of files) {
    if (!existsSync(src)) fail("sentinel", `cannot re-vendor: ${src} not found (set SENTINEL_DOCS)`);
  }
  mkdirSync(dir, { recursive: true });
  const pin = JSON.parse(readFileSync(join(dir, "PROVENANCE.json"), "utf8")) as {
    files: Record<string, { sha256: string; schema_version?: string; generated_at?: string }>;
    vendored_at: string;
  };
  for (const [src, name] of files) {
    const bytes = readFileSync(src);
    writeFileSync(join(dir, name), bytes);
    const entry = pin.files[name] ?? { sha256: "" };
    entry.sha256 = createHash("sha256").update(bytes).digest("hex");
    if (entry.schema_version !== undefined || entry.generated_at !== undefined) {
      const doc = JSON.parse(bytes.toString("utf8")) as Record<string, string>;
      const version = doc.schema_version;
      const generated = doc.generated_at;
      if (version === undefined || generated === undefined) {
        fail("sentinel", `${name}: re-vendored file has no schema_version/generated_at to pin`);
      }
      entry.schema_version = version;
      entry.generated_at = generated;
    }
    pin.files[name] = entry;
  }
  pin.vendored_at = new Date().toISOString().slice(0, 10);
  writeFileSync(join(dir, "PROVENANCE.json"), `${JSON.stringify(pin, null, 2)}\n`);
  pass("sentinel", `re-vendored ${files.length} artifact(s) from ${from} and rewrote the pin`);
  process.exit(0);
}

const sentinel = loadSentinel(dir);
const records = loadCorpus();
const summary = summarize(records, sentinel);

console.log(`  ℹ️  sentinel (${SENTINEL_FEED_ID}, vendored ${sentinel.provenance.vendored_at}):`);
for (const line of summary.lines) console.log(`     - ${line}`);
for (const m of summary.hostOnly) {
  console.log(`     · host-only ${m.host} (change ${m.changeId}) — cited by ${m.citedBy.join(", ")}`);
}

if (summary.pending.length === 0) {
  pass(
    "sentinel",
    `no record is owed a flag. ${summary.unwatchable.length} cited host(s) the sentinel ` +
      "also cannot watch are listed in docs/audits/coverage.md.",
  );
  process.exit(0);
}

const planned = planWrites(records, summary.pending);

if (!args.has("--apply")) {
  fail(
    "sentinel",
    `${planned.length} record(s) are owed an external drift flag`,
    planned.map(
      (p) =>
        `${p.recordId} → needs_reverification, flagged_by ${p.flaggedBy.change_id}` +
        (p.inherited ? " (inherited from its twin; verification state is mirrored)" : ""),
    ),
  );
}

// --apply: rewrite only the two fields a feed entry is evidence for.
const plannedById = new Map(planned.map((p) => [p.recordId, p]));
let written = 0;
const touchedFiles: string[] = [];
for (const file of walk(join(REPO_ROOT, "corpus", "jurisdictions"), (p) => p.endsWith(".json"))) {
  const parsed = JSON.parse(readFileSync(file, "utf8")) as Array<Record<string, unknown>>;
  const changedHere = applyPlanToFile(parsed, plannedById);
  written += changedHere;
  if (changedHere > 0) {
    writeFileSync(file, `${JSON.stringify(parsed, null, 2)}\n`);
    touchedFiles.push(file.slice(REPO_ROOT.length + 1));
  }
}

if (written !== planned.length) {
  fail(
    "sentinel",
    `planned ${planned.length} write(s) but found only ${written} of those records in ` +
      "corpus/jurisdictions/ — refusing to report a partial apply as a complete one",
  );
}
pass("sentinel", `flagged ${written} record(s) across ${touchedFiles.length} file(s): ${touchedFiles.join(", ")}`);
