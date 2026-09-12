// A SECOND, INDEPENDENTLY REVIEWED STALENESS SIGNAL (#228).
//
// Guardrail 4 says stale law is broken law, and until now staleness here had exactly two
// detectors: this repository's own hash watcher (`scripts/source-watch.ts`) and the SLA
// clock (`api/freshness.ts`). Both are ours. Both share our blind spots — the launch-gate
// table lists cited sources this project cannot watch at all, and for those a
// `last_verified` date is a human's assertion that nothing moved, never a checked one.
//
// `ChelseaKR/id-churn-sentinel` watches the same class of government pages, and every
// change it publishes carries the name of the human who classified it. Reading that feed
// turns a silent `verified` into an honest `needs_reverification` sooner, with a trail a
// verifier can follow back to a named decision.
//
// OFFLINE BY CONSTRUCTION. Nothing here fetches. The sentinel's published artifacts are
// vendored under `corpus/external/id-churn-sentinel/` and pinned by sha256 in
// `PROVENANCE.json`. `make sentinel` reads bytes that are in the repository, so the app's
// offline-first posture is unchanged and a run is reproducible from the commit alone.
//
// WHAT THIS MODULE REFUSES TO DO, and why each refusal is load-bearing:
//
//   1. **It never renders a missing or drifted feed as "nothing changed."** A missing
//      file, an unparseable file, a sha256 that disagrees with the pin, or a
//      `schema_version` outside the pinned major all throw. The alternative — matching
//      zero entries and reporting an all-clear — is this portfolio's most common defect
//      (absence published as a measurement), and it would be at its worst here: the
//      signal exists precisely to say "your source moved."
//
//   2. **An empty feed is reported as no signal, never as reassurance.** The feed is
//      empty today (0 changes as of the vendored 2026-09-02 snapshot). That is a fact
//      about the sentinel's crawl, not about the law, and `summarize()` says so in those
//      words so no caller can round it up to "every source is current."
//
//   3. **A host-only match is reported and never applied.** Two different pages on
//      dmv.ca.gov are two different pages. Flagging a record because a sibling page moved
//      would degrade a record on evidence that is not about it.
//
//   4. **It never edits a statement.** The only fields it can write are
//      `verification_status` and `flagged_by`. A feed entry is evidence that a page
//      moved; it is not evidence of what the page now says.
//
// DIRECTION OF ERROR. Every judgement call below fails toward `needs_reverification`.
// Being told to re-check a source that did not really change costs a verifier one read;
// the reverse costs a reader a filing.

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { REPO_ROOT } from "./corpus.ts";
import { canonicalIdOf } from "./translations.ts";
import type { CorpusRecord, FlaggedBy } from "./types.ts";

/** The feed id recorded on every flag this module writes. */
export const SENTINEL_FEED_ID = "id-churn-sentinel";

/** Directory holding the vendored artifacts and their provenance pin. */
export function sentinelDir(repoRoot: string = REPO_ROOT): string {
  return join(repoRoot, "corpus", "external", "id-churn-sentinel");
}

/**
 * One published change. Field meanings are the sentinel's, not ours — see its
 * `changes-v2.schema.json`, vendored alongside the data so the contract this code was
 * written against travels with it.
 */
export interface SentinelChange {
  id: string;
  source_id: string;
  jurisdiction: string;
  document_class: string;
  url: string;
  observed_at: string;
  kind: string;
  significance: string;
  review_status: string;
  reviewer: string;
  reviewed_at: string;
  independent_review_status: string | null;
  publication_status: string;
}

export interface SentinelSource {
  source_id: string;
  jurisdiction: string;
  document_class: string;
  url: string;
  authority: string;
  verification_status: string;
  reachable_by_our_crawler: boolean;
}

/** A jurisdiction × document class the sentinel has publicly declared it cannot watch. */
export interface SentinelGap {
  jurisdiction: string;
  document_class: string;
  reason: string;
  hosts: string[];
  checked: string;
  detail: string;
}

export interface SentinelFeed {
  schema_version: string;
  generated_at: string;
  changes: SentinelChange[];
  sources: SentinelSource[];
}

export interface SentinelInventory {
  schema_version: string;
  generated_at: string;
  sources: SentinelSource[];
  gaps: SentinelGap[];
}

export interface SentinelProvenance {
  feed: string;
  feed_url: string;
  schema_major: number;
  vendored_at: string;
  vendored_from_commit: string;
  files: Record<string, { sha256: string; schema_version?: string; generated_at?: string }>;
}

export interface Sentinel {
  provenance: SentinelProvenance;
  feed: SentinelFeed;
  inventory: SentinelInventory;
}

/** Thrown for every reason the vendored feed cannot be trusted. Never swallowed. */
export class SentinelError extends Error {}

function readJson(path: string, label: string): unknown {
  if (!existsSync(path)) {
    throw new SentinelError(
      `${label}: vendored file is missing (${path}). The sentinel sync fails closed rather ` +
        "than reporting zero changes, which would be an absence dressed as an all-clear.",
    );
  }
  const raw = readFileSync(path, "utf8");
  try {
    return JSON.parse(raw) as unknown;
  } catch (err) {
    throw new SentinelError(`${label}: vendored file is not valid JSON (${(err as Error).message})`);
  }
}

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Load and validate the vendored artifacts.
 *
 * Every check here is a fail-closed one. The one that matters most is the schema-major
 * pin: the sentinel's `changes` items are a closed vocabulary (`significance`,
 * `publication_status`, `independent_review_status`), and a major bump is exactly where
 * that vocabulary is allowed to change. Reading a v3 document with v2 assumptions would
 * not error — it would quietly match nothing, and this repository would report an
 * all-clear it had not earned.
 */
export function loadSentinel(dir: string = sentinelDir()): Sentinel {
  const provRaw = readJson(join(dir, "PROVENANCE.json"), "PROVENANCE.json");
  if (!isObj(provRaw) || !isObj(provRaw.files) || typeof provRaw.schema_major !== "number") {
    throw new SentinelError("PROVENANCE.json: missing `schema_major` or `files`");
  }
  const provenance = provRaw as unknown as SentinelProvenance;

  for (const [name, entry] of Object.entries(provenance.files)) {
    const path = join(dir, name);
    if (!existsSync(path)) {
      throw new SentinelError(`${name}: pinned in PROVENANCE.json but not present in ${dir}`);
    }
    const actual = sha256File(path);
    if (actual !== entry.sha256) {
      throw new SentinelError(
        `${name}: sha256 ${actual} does not match the pin ${entry.sha256}. Re-vendor with ` +
          "`make sentinel-vendor` (which rewrites the pin) rather than editing the data in place.",
      );
    }
  }

  const feedRaw = readJson(join(dir, "changes.json"), "changes.json");
  const invRaw = readJson(join(dir, "sources.json"), "sources.json");
  if (!isObj(feedRaw) || !isObj(invRaw)) {
    throw new SentinelError("changes.json / sources.json: top level must be an object");
  }
  for (const [label, doc, keys] of [
    ["changes.json", feedRaw, ["schema_version", "generated_at", "changes", "sources"]],
    ["sources.json", invRaw, ["schema_version", "generated_at", "sources", "gaps"]],
  ] as const) {
    for (const k of keys) {
      if (doc[k] === undefined) throw new SentinelError(`${label}: required key \`${k}\` is absent`);
    }
    const version = doc.schema_version;
    if (typeof version !== "string" || !version.startsWith(`${provenance.schema_major}.`)) {
      throw new SentinelError(
        `${label}: schema_version ${JSON.stringify(version)} leaves the pinned major ` +
          `${provenance.schema_major}. A major bump may redefine the very fields this sync ` +
          "filters on, so it stops the gate instead of silently matching nothing.",
      );
    }
  }

  return {
    provenance,
    feed: feedRaw as unknown as SentinelFeed,
    inventory: invRaw as unknown as SentinelInventory,
  };
}

/**
 * Comparison key for a cited URL.
 *
 * Scheme is dropped deliberately: an agency moving a page from http to https is not a
 * content change, and treating it as a mismatch would silently stop matching the very
 * pages most likely to be maintained. Host is lower-cased with a leading `www.` removed;
 * the fragment is dropped (it never reaches the server); a trailing slash is dropped; the
 * query string is KEPT verbatim, because several cited statute pages are addressed only
 * by query (`legis.la.gov/legis/law.aspx?d=77843`) and normalizing it away would collapse
 * distinct legal texts onto one key.
 *
 * #228 asks for "one normalization shared with source-watch.ts". There is none to share:
 * `source-watch.ts` keys its baseline on the raw URL string and normalizes page TEXT, not
 * URLs. This is the first URL normalizer in the repository; it is exported so a later
 * change to the watcher adopts it rather than writing a second one.
 */
export function urlKey(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url.trim().toLowerCase();
  }
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  const path = parsed.pathname.replace(/\/+$/, "").toLowerCase();
  return `${host}${path}${parsed.search}`;
}

/** Registrable-ish host for a cited URL: lower-cased, `www.` stripped. */
export function urlHost(url: string): string {
  const key = urlKey(url);
  return (key.split("/")[0] ?? "").split("?")[0] ?? "";
}

/**
 * Is this change one this repository may act on?
 *
 * Each clause rules out a different way a feed entry can look actionable without being
 * so. The `independent_review_status` clause is the strictest: the sentinel requires a
 * SECOND named human for a substantive observation, and a substantive item that has not
 * cleared that second decision is not the human-confirmed signal #228 asks for.
 */
export function isActionableChange(change: SentinelChange): boolean {
  return (
    change.publication_status === "active" &&
    change.review_status === "confirmed" &&
    change.significance === "substantive" &&
    change.independent_review_status === "confirmed" &&
    typeof change.reviewer === "string" &&
    change.reviewer.length > 0 &&
    typeof change.observed_at === "string" &&
    change.observed_at.length > 0
  );
}

/** A change this repository should act on, matched to one corpus record. */
export interface SentinelFlag {
  recordId: string;
  changeId: string;
  url: string;
  observedAt: string;
  reviewer: string;
  reviewedAt: string;
  lastVerified: string;
}

/** A change whose host we cite but whose page we do not. Reported; never applied. */
export interface HostOnlyMatch {
  changeId: string;
  changeUrl: string;
  host: string;
  citedBy: string[];
}

/**
 * The date part of an ISO timestamp. The sentinel stamps `observed_at` to the second;
 * a record's `last_verified` is a calendar date. Comparing them needs one shape.
 */
function isoDate(value: string): string {
  return value.slice(0, 10);
}

export interface MatchResult {
  flags: SentinelFlag[];
  hostOnly: HostOnlyMatch[];
  /** Actionable changes that matched no cited host at all. */
  unmatched: string[];
}

/**
 * Match actionable changes against the corpus.
 *
 * A change flags a record when the normalized URLs are equal AND the change was observed
 * strictly after that record's `last_verified`. "Strictly after" is deliberate: a change
 * observed on the same day a human verified the record cannot be ordered from a date
 * alone, and flagging it would fire on every record a verifier touched that morning. The
 * cost of that choice is stated rather than hidden: a change the sentinel observed on the
 * same day a verifier re-checked the page is NOT flagged, and re-checking it is the
 * verifier's own weekly read of the feed, not this gate's job.
 */
export function matchChanges(records: CorpusRecord[], feed: SentinelFeed): MatchResult {
  const byKey = new Map<string, CorpusRecord[]>();
  const byHost = new Map<string, string[]>();
  for (const record of records) {
    const url = record.source?.url;
    if (typeof url !== "string" || url.length === 0) continue;
    const key = urlKey(url);
    const list = byKey.get(key);
    if (list) list.push(record);
    else byKey.set(key, [record]);
    const host = urlHost(url);
    const hosts = byHost.get(host);
    if (hosts) hosts.push(record.id);
    else byHost.set(host, [record.id]);
  }

  const flags: SentinelFlag[] = [];
  const hostOnly: HostOnlyMatch[] = [];
  const unmatched: string[] = [];

  for (const change of feed.changes) {
    if (!isActionableChange(change)) continue;
    const key = urlKey(change.url);
    const exact = byKey.get(key) ?? [];
    if (exact.length > 0) {
      for (const record of exact) {
        const lastVerified = record.source.last_verified;
        if (isoDate(change.observed_at) <= isoDate(lastVerified)) continue;
        flags.push({
          recordId: record.id,
          changeId: change.id,
          url: record.source.url,
          observedAt: change.observed_at,
          reviewer: change.reviewer,
          reviewedAt: change.reviewed_at,
          lastVerified,
        });
      }
      continue;
    }
    const host = urlHost(change.url);
    const cited = byHost.get(host);
    if (cited && cited.length > 0) {
      hostOnly.push({ changeId: change.id, changeUrl: change.url, host, citedBy: [...cited].sort() });
    } else {
      unmatched.push(change.id);
    }
  }

  flags.sort((a, b) => a.recordId.localeCompare(b.recordId) || a.changeId.localeCompare(b.changeId));
  hostOnly.sort((a, b) => a.changeId.localeCompare(b.changeId));
  unmatched.sort();
  return { flags, hostOnly, unmatched };
}

/** A cited host the sentinel has publicly declared it cannot watch either. */
export interface ExternallyUnwatchable {
  host: string;
  reason: string;
  detail: string;
  citedBy: string[];
}

/**
 * Hosts this corpus cites that the sentinel ALSO cannot watch.
 *
 * Two independently published reasons, kept distinct because they mean different things:
 * `gap:<reason>` is the sentinel's own named, dated gap for a jurisdiction × document
 * class (`tls-unverifiable`, and its siblings); `crawler-unreachable` is a registered
 * source its fetcher cannot reach. Neither is a statement about whether OUR watcher can
 * see the page — `api/watchability.ts` answers that, from our own artifacts. What this
 * adds is the knowledge that a second watcher is blind there too, so a reader looking at
 * "we cannot check this automatically" is not left assuming somebody else can.
 *
 * #228 names `robots-disallowed` as the reason to look for. It is one of three the
 * inventory actually publishes today — `blocked-403` and `tls-unverifiable` are the
 * others, and unreachability is a separate boolean on each source — so the reason is read
 * from the data rather than matched against a single hard-coded constant. A fourth reason
 * appearing upstream then shows up here instead of being silently dropped.
 */
export function externallyUnwatchable(
  records: CorpusRecord[],
  inventory: SentinelInventory,
): ExternallyUnwatchable[] {
  const citedByHost = new Map<string, Set<string>>();
  for (const record of records) {
    const url = record.source?.url;
    if (typeof url !== "string" || url.length === 0) continue;
    const host = urlHost(url);
    const set = citedByHost.get(host);
    if (set) set.add(record.id);
    else citedByHost.set(host, new Set([record.id]));
  }

  const found = new Map<string, ExternallyUnwatchable>();
  const note = (host: string, reason: string, detail: string) => {
    const cited = citedByHost.get(host);
    if (!cited) return;
    const existing = found.get(`${host} ${reason}`);
    if (existing) return;
    found.set(`${host} ${reason}`, { host, reason, detail, citedBy: [...cited].sort() });
  };

  for (const gap of inventory.gaps ?? []) {
    for (const rawHost of gap.hosts ?? []) {
      note(
        urlHost(`https://${rawHost}`),
        `gap:${gap.reason}`,
        `${gap.jurisdiction} · ${gap.document_class} — declared ${gap.checked}`,
      );
    }
  }
  for (const source of inventory.sources ?? []) {
    if (source.reachable_by_our_crawler === false) {
      note(
        urlHost(source.url),
        "crawler-unreachable",
        `${source.jurisdiction} · ${source.document_class} — registered as ${source.source_id}`,
      );
    }
  }

  return [...found.values()].sort((a, b) => a.host.localeCompare(b.host) || a.reason.localeCompare(b.reason));
}

/** Records already carrying a flag, keyed by record id. */
export function existingFlags(records: CorpusRecord[]): Map<string, FlaggedBy> {
  const out = new Map<string, FlaggedBy>();
  for (const record of records) {
    if (record.flagged_by) out.set(record.id, record.flagged_by);
  }
  return out;
}

/** One record's new state, as `--apply` would write it. */
export interface PlannedWrite {
  recordId: string;
  flaggedBy: FlaggedBy;
  /** True when this record is a translation degraded to keep its canonical's state. */
  inherited: boolean;
}

/**
 * Turn matched flags into the exact set of records that must change, twins included.
 *
 * A TRANSLATION IS NOT OPTIONAL HERE. `api/translations.ts` requires an English record and
 * its Spanish twin to agree on `verification_status`, and it is right to: a Spanish reader
 * shown a step is shown it with an English reader's confidence. So degrading one side and
 * not the other is not merely inconsistent — it would fail `make content`, and if it
 * somehow did not, the Spanish reader would be the one to find out in a clerk's office.
 *
 * The twin inherits its canonical's `change_id` rather than being matched independently.
 * Three Spanish records deliberately cite the same agency's Spanish-language page, so a
 * URL match would miss them; and the flag is a fact about the RULE's source having moved,
 * which the pair shares by construction.
 */
export function planWrites(records: CorpusRecord[], flags: SentinelFlag[]): PlannedWrite[] {
  const byId = new Map(records.map((r) => [r.id, r]));
  const byCanonical = new Map<string, CorpusRecord[]>();
  for (const record of records) {
    if (record.language === "en") continue;
    const canonical = canonicalIdOf(record);
    if (!canonical) continue;
    const list = byCanonical.get(canonical);
    if (list) list.push(record);
    else byCanonical.set(canonical, [record]);
  }

  const planned = new Map<string, PlannedWrite>();
  for (const flag of flags) {
    const record = byId.get(flag.recordId);
    if (!record) continue;
    const flaggedBy: FlaggedBy = {
      feed: SENTINEL_FEED_ID,
      change_id: flag.changeId,
      // Date part only: the corpus speaks in ISO calendar dates everywhere, and the full
      // timestamp stays resolvable from the feed by `change_id`.
      reviewed_at: isoDate(flag.reviewedAt),
    };
    planned.set(flag.recordId, { recordId: flag.recordId, flaggedBy, inherited: false });

    // A flagged English canonical drags its translations with it; a flagged translation
    // drags its canonical, for the same reason in the other direction.
    const canonicalId = record.language === "en" ? record.id : canonicalIdOf(record);
    if (!canonicalId) continue;
    const family = [byId.get(canonicalId), ...(byCanonical.get(canonicalId) ?? [])];
    for (const relative of family) {
      if (!relative || relative.id === flag.recordId || planned.has(relative.id)) continue;
      planned.set(relative.id, { recordId: relative.id, flaggedBy, inherited: true });
    }
  }
  return [...planned.values()].sort((a, b) => a.recordId.localeCompare(b.recordId));
}

/**
 * Apply a plan to one jurisdiction file's parsed records, in place.
 *
 * Only two fields are ever written. A feed entry is evidence that a page moved; it is not
 * evidence of what the page now says, so `statement`, `detail`, `cost` and every citation
 * field are untouchable here. Returns how many records in this file changed, so the
 * caller can refuse to report a partial apply as a complete one.
 */
export function applyPlanToFile(
  parsed: Array<Record<string, unknown>>,
  plannedById: Map<string, PlannedWrite>,
): number {
  let written = 0;
  for (const record of parsed) {
    const plan = plannedById.get(record.id as string);
    if (!plan) continue;
    record.verification_status = "needs_reverification";
    record.flagged_by = { ...plan.flaggedBy };
    written += 1;
  }
  return written;
}

export interface SentinelSummary {
  /** Human-readable lines. The first is always the honest headline. */
  lines: string[];
  /** Flags the feed implies that the corpus does not yet carry. */
  pending: SentinelFlag[];
  hostOnly: HostOnlyMatch[];
  unwatchable: ExternallyUnwatchable[];
}

/**
 * What the vendored feed currently says about this corpus.
 *
 * The headline is written so an empty feed cannot be read as an all-clear. "0 records
 * flagged" and "the sentinel has published nothing yet" are the same number and different
 * facts, and only one of them is about the law.
 */
export function summarize(records: CorpusRecord[], sentinel: Sentinel): SentinelSummary {
  const { flags, hostOnly, unmatched } = matchChanges(records, sentinel.feed);
  const carried = existingFlags(records);
  const pending = flags.filter((f) => carried.get(f.recordId)?.change_id !== f.changeId);
  const unwatchable = externallyUnwatchable(records, sentinel.inventory);

  const lines: string[] = [];
  const total = sentinel.feed.changes.length;
  if (total === 0) {
    lines.push(
      `feed carries NO published changes (generated ${sentinel.feed.generated_at}). That is a ` +
        "fact about the sentinel's crawl and review queue, not evidence that no cited source " +
        "moved. No record's freshness is confirmed by this run.",
    );
  } else {
    const actionable = sentinel.feed.changes.filter(isActionableChange).length;
    lines.push(
      `feed carries ${total} published change(s), ${actionable} of them human-confirmed ` +
        "substantive and independently reviewed.",
    );
  }
  lines.push(`${flags.length} cited record(s) matched by URL and observed after their last check.`);
  lines.push(`${pending.length} record(s) need the flag written.`);
  lines.push(`${hostOnly.length} host-only match(es) reported for a human; never applied.`);
  lines.push(`${unmatched.length} actionable change(s) touched no host this corpus cites.`);
  lines.push(`${unwatchable.length} cited host(s) the sentinel also cannot watch.`);
  return { lines, pending, hostOnly, unwatchable };
}
