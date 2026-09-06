// Source-snapshot refresher (`make source-snapshot`) — the deliberate, human-driven path
// that feeds the offline source-fidelity gate (scripts/source-fidelity.ts).
//
// It fetches every corpus source URL, runs it through the SAME normalize() the drift
// watcher hashes (scripts/source-watch.ts — imported, not re-implemented, so the two can
// never diverge), and writes the normalized text to corpus/snapshots/ plus an index.
// `make fidelity` then re-reads those files offline: a live fetch inside CI would be flaky
// and rude to the government hosts we depend on.
//
// ⚠️ READ BEFORE RUNNING (the `make source-baseline` warning applies here too):
// this command ADOPTS whatever the sources serve right now. If a page changed under a
// record, refreshing the snapshot means the fidelity gate will start checking the record
// against the NEW text — which is what you want ONLY if you are about to re-read the page
// and reconcile the record. It is not a way to make a red gate green.
//
// It is, however, deliberately NOT the same loaded gun as `make source-baseline`, and the
// difference is structural, not a matter of discipline: every snapshot's sha256 must equal
// the drift baseline already committed in corpus/source-hashes.json (both hash the same
// normalize() output). So a snapshot refreshed over genuine upstream drift makes
// `make fidelity` fail with a baseline-mismatch, and it stays failing until a human runs
// the human-review-only re-baseline procedure for that URL. Refreshing snapshots cannot,
// by itself, launder unread content into a "verified" claim.
//
//   node scripts/source-snapshot.ts            # fetch + write corpus/snapshots/ (then git diff!)
//   node scripts/source-snapshot.ts --check    # fetch + report what WOULD change; write nothing

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { loadCorpus } from "../api/corpus.ts";
import { normalize } from "./source-watch.ts";
import {
  SNAPSHOT_DIR,
  SNAPSHOT_INDEX,
  loadSnapshotIndex,
  sha256,
  snapshotFileName,
  type SnapshotEntry,
  type SnapshotIndex,
} from "./source-fidelity.ts";
import { pass } from "./util.ts";

const TIMEOUT_MS = 25_000;
// The project's own declared user-agent, with a contact URL — the same one source-watch
// sends. We do NOT send a browser user-agent: several of these hosts deliberately refuse
// non-browser clients, and spoofing past that to make a gate green would be dishonest
// twice over (to the host, and to anyone reading a green gate).
const UA = "trans-docs-navigator-source-watch/1.0 (+https://github.com/ChelseaKR/trans-docs-navigator)";

interface Fetched {
  body: Buffer;
  contentType: string;
  via: "fetch" | "curl";
}

/**
 * Fetch with Node, falling back to curl. The fallback exists for one honest reason
 * documented in docs/OPERATIONS.md: CDPH (`www.cdph.ca.gov`) serves an incomplete TLS
 * chain that Node's fetch rejects outright while curl (with the same user-agent, following
 * the same redirects) completes it. Same URL, same UA, same bytes — not a way around a
 * host that is refusing us.
 */
async function fetchSource(url: string): Promise<Fetched | { blocked: string }> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "user-agent": UA },
    });
    if (res.ok) {
      return {
        body: Buffer.from(await res.arrayBuffer()),
        contentType: res.headers.get("content-type") ?? "",
        via: "fetch",
      };
    }
    if (res.status === 403 || res.status === 401 || res.status === 429) {
      return { blocked: `HTTP ${res.status}` };
    }
  } catch {
    /* fall through to curl */
  }
  try {
    const body = execFileSync(
      "curl",
      ["-sSL", "--max-time", "30", "--fail", "-A", UA, url],
      { maxBuffer: 64 * 1024 * 1024, encoding: "buffer" },
    ) as unknown as Buffer;
    return { body, contentType: url.toLowerCase().endsWith(".pdf") ? "application/pdf" : "text/html", via: "curl" };
  } catch {
    return { blocked: "unreachable (fetch and curl both failed)" };
  }
}

async function main(): Promise<void> {
  const write = !process.argv.includes("--check");
  mkdirSync(SNAPSHOT_DIR, { recursive: true });

  const corpus = loadCorpus();
  const byUrl = new Map<string, string[]>();
  for (const r of corpus) {
    byUrl.set(r.source.url, [...(byUrl.get(r.source.url) ?? []), r.id]);
    // cost.fee_waiver_source: a second citation, used when the fee-waiver form/criteria live
    // on a different official page than the record's primary source (scripts/source-fidelity.ts
    // checks it with the same rigor). It needs a snapshot exactly like any other cited URL.
    const waiverUrl = r.cost?.fee_waiver_source?.url;
    if (waiverUrl) byUrl.set(waiverUrl, [...(byUrl.get(waiverUrl) ?? []), `${r.id} (fee waiver)`]);
  }

  const previous = loadSnapshotIndex();
  const next: SnapshotIndex = {
    _comment:
      "Offline snapshots of every cited corpus source, normalized with the SAME normalize() " +
      "that scripts/source-watch.ts hashes, so each `sha256` here must equal the drift baseline " +
      "in corpus/source-hashes.json for the same URL. scripts/source-fidelity.ts (`make fidelity`) " +
      "reads these offline to check that each record's load-bearing assertions are actually " +
      "locatable in the source it cites. Regenerate deliberately with `make source-snapshot`, " +
      "then READ THE DIFF — see docs/OPERATIONS.md. A source recorded as `unfetchable` has no " +
      "snapshot and its records' claims are UNCHECKABLE, never silently passed.",
    snapshots: {},
  };

  const today = new Date().toISOString().slice(0, 10);
  const changed: string[] = [];
  const added: string[] = [];
  const blocked: string[] = [];
  let unchanged = 0;

  for (const url of [...byUrl.keys()].sort()) {
    const ids = byUrl.get(url) ?? [];
    const result = await fetchSource(url);

    if ("blocked" in result) {
      const prior = previous.snapshots[url];
      const entry: SnapshotEntry = {
        file: null,
        fetched: today,
        unfetchable: {
          status: result.blocked,
          note:
            prior?.unfetchable?.note ??
            "the host refuses this project's declared user-agent; we do not spoof a browser UA. " +
              "Records citing it can only be verified by a human reading the page.",
        },
      };
      next.snapshots[url] = entry;
      blocked.push(`${url} → ${result.blocked} · records: ${ids.join(", ")}`);
      continue;
    }

    const isHtml = result.contentType.includes("html") || result.contentType.includes("xml");
    if (!isHtml) {
      next.snapshots[url] = {
        file: null,
        fetched: today,
        unextractable: {
          reason: `the source is ${result.contentType || "not HTML"} — this gate extracts text from HTML only, so nothing in it can be checked`,
        },
      };
      blocked.push(`${url} → not HTML (${result.contentType}) · records: ${ids.join(", ")}`);
      continue;
    }

    const text = normalize(result.body.toString("utf8"));
    const file = snapshotFileName(url);
    const digest = sha256(text);
    const path = join(SNAPSHOT_DIR, file);
    const priorText = existsSync(path) ? readFileSync(path, "utf8") : null;

    if (priorText === null) added.push(`${url} (${text.length} chars, via ${result.via})`);
    else if (priorText !== text) changed.push(`${url} — the source text MOVED under: ${ids.join(", ")}`);
    else unchanged++;

    next.snapshots[url] = { file, fetched: priorText === text ? (previous.snapshots[url]?.fetched ?? today) : today, sha256: digest };
    // NOTE, two CodeQL findings on this write:
    //   js/file-system-race — the existsSync(path) above and this write are a check-then-act
    //     pair, but this is a human-invoked CLI writing a tracked file inside its own git
    //     checkout (`make source-snapshot`, then read the diff). The prior read only decides
    //     which console line to print; correctness rests on the reviewed diff and on the
    //     sha256 cross-check against corpus/source-hashes.json, not on exclusive access.
    //   js/http-to-file-access — `text` did come from a remote fetch. It is normalized plain
    //     text written to a `.txt` under corpus/snapshots/ and never executed, and `path` is
    //     not attacker-influenced: snapshotFileName() reduces the URL to `[a-z0-9-]{,70}` plus
    //     an 8-hex sha256 suffix and a fixed `.txt`, so no separator or `..` can survive into
    //     the name, and the URL itself comes from the committed corpus rather than a request.
    // Both left as-is rather than suppressed; see the PR body.
    if (write) writeFileSync(path, text);
  }

  if (write) {
    const live = new Set(
      Object.values(next.snapshots)
        .map((e) => e.file)
        .filter((f): f is string => f !== null),
    );
    for (const f of readdirSync(SNAPSHOT_DIR)) {
      if (f.endsWith(".txt") && !live.has(f)) {
        rmSync(join(SNAPSHOT_DIR, f));
        console.log(`  🗑  removed orphan snapshot (no record cites it): ${f}`);
      }
    }
    writeFileSync(SNAPSHOT_INDEX, JSON.stringify(next, null, 2) + "\n");
  }

  for (const b of blocked) console.log(`  ⚠️  no snapshot: ${b}`);
  for (const a of added) console.log(`  +   new snapshot: ${a}`);
  for (const c of changed) console.log(`  ⚠️  CHANGED: ${c}`);
  if (changed.length > 0) {
    console.log("");
    console.log("  ⚠️  A CHANGED source means the official page moved under a record. Read the page,");
    console.log("      reconcile the record (EN + ES), and re-baseline that URL through the review-only");
    console.log("      procedure in docs/OPERATIONS.md. `make fidelity` will fail with a baseline-mismatch");
    console.log("      until you do — refreshing a snapshot cannot, on its own, adopt drift.");
  }

  pass(
    "source-snapshot",
    write
      ? `${unchanged} unchanged, ${added.length} added, ${changed.length} changed, ${blocked.length} without a snapshot → corpus/snapshots/ (now run \`git diff corpus/snapshots\` and read it)`
      : `--check only: ${unchanged} unchanged, ${added.length} would be added, ${changed.length} would change, ${blocked.length} without a snapshot`,
  );
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) await main();
