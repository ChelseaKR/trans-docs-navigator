// External drift sync (#228). The tests are organized around the ways this feature could
// LOOK like it was working while measuring nothing: a vendored file edited in place, a
// schema major that redefines the fields being filtered on, an empty feed read as an
// all-clear, a host-only match applied as if it were a page match, and an English record
// degraded while its Spanish twin goes on being served as current.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadCorpus } from "../api/corpus.ts";
import {
  SENTINEL_FEED_ID,
  SentinelError,
  existingFlags,
  externallyUnwatchable,
  isActionableChange,
  applyPlanToFile,
  loadSentinel,
  matchChanges,
  planWrites,
  sentinelDir,
  summarize,
  urlHost,
  urlKey,
} from "../api/sentinel.ts";
import type {
  SentinelChange,
  SentinelFeed,
  SentinelInventory,
} from "../api/sentinel.ts";
import type { CorpusRecord } from "../api/types.ts";

// --- fixtures ---------------------------------------------------------------------

function change(over: Partial<SentinelChange> = {}): SentinelChange {
  return {
    id: "chg-1",
    source_id: "src-1",
    jurisdiction: "CA",
    document_class: "drivers_license",
    url: "https://www.dmv.example.gov/change-name",
    observed_at: "2026-08-20T04:00:00+00:00",
    kind: "content_drift",
    significance: "substantive",
    review_status: "confirmed",
    reviewer: "A Named Human",
    reviewed_at: "2026-08-21T09:00:00+00:00",
    independent_review_status: "confirmed",
    publication_status: "active",
    ...over,
  };
}

function record(over: Partial<CorpusRecord> = {}): CorpusRecord {
  return {
    id: "ex.drivers-license.name",
    jurisdiction: "US-CA",
    document_type: "drivers-license",
    change_type: ["name"],
    topic: "Example",
    statement: "An example statement long enough to be substantive.",
    source: {
      url: "https://dmv.example.gov/change-name",
      title: "Example DMV",
      last_verified: "2026-07-01",
      verifier: "Pilot Seed Reviewer",
    },
    verification_status: "verified",
    recheck_sla_days: 90,
    language: "en",
    ...over,
  } as CorpusRecord;
}

function feed(over: Partial<SentinelFeed> = {}): SentinelFeed {
  return { schema_version: "2.0", generated_at: "2026-09-02T04:26:49+00:00", changes: [], sources: [], ...over };
}

function inventory(over: Partial<SentinelInventory> = {}): SentinelInventory {
  return { schema_version: "2.0", generated_at: "2026-09-02T04:26:49+00:00", sources: [], gaps: [], ...over };
}

/** A throwaway vendored-artifact directory whose pin matches the bytes written. */
function makeVendorDir(over: { feed?: unknown; inventory?: unknown; schemaMajor?: number } = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "sentinel-"));
  mkdirSync(dir, { recursive: true });
  const files: Record<string, string> = {
    "changes.json": JSON.stringify(over.feed ?? feed()),
    "sources.json": JSON.stringify(over.inventory ?? inventory()),
  };
  const pin: Record<string, { sha256: string }> = {};
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(join(dir, name), body);
    pin[name] = { sha256: createHash("sha256").update(body).digest("hex") };
  }
  writeFileSync(
    join(dir, "PROVENANCE.json"),
    JSON.stringify({
      feed: SENTINEL_FEED_ID,
      feed_url: "https://example.invalid/",
      schema_major: over.schemaMajor ?? 2,
      vendored_at: "2026-09-07",
      vendored_from_commit: "0".repeat(40),
      files: pin,
    }),
  );
  return dir;
}

function withVendorDir(opts: Parameters<typeof makeVendorDir>[0], fn: (dir: string) => void): void {
  const dir = makeVendorDir(opts);
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// --- the vendored feed must be trustworthy, or nothing runs -------------------------

test("loadSentinel reads a well-formed vendored directory", () => {
  withVendorDir({}, (dir) => {
    const s = loadSentinel(dir);
    assert.equal(s.provenance.feed, SENTINEL_FEED_ID);
    assert.equal(s.feed.changes.length, 0);
    assert.equal(s.inventory.gaps.length, 0);
  });
});

test("a vendored file edited in place fails the pin, rather than matching nothing", () => {
  withVendorDir({}, (dir) => {
    // The obvious way to make this gate green would be to delete the entry that flags you.
    writeFileSync(join(dir, "changes.json"), JSON.stringify(feed({ changes: [change()] })));
    assert.throws(() => loadSentinel(dir), (err: unknown) => {
      assert.ok(err instanceof SentinelError);
      assert.match((err as Error).message, /sha256 .* does not match the pin/);
      return true;
    });
  });
});

test("a missing vendored file throws instead of reporting zero changes", () => {
  withVendorDir({}, (dir) => {
    rmSync(join(dir, "sources.json"));
    assert.throws(() => loadSentinel(dir), /pinned in PROVENANCE.json but not present/);
  });
});

test("unparseable JSON throws", () => {
  const dir = mkdtempSync(join(tmpdir(), "sentinel-bad-"));
  try {
    writeFileSync(join(dir, "PROVENANCE.json"), "{ not json");
    assert.throws(() => loadSentinel(dir), /not valid JSON/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("PROVENANCE.json without schema_major or files throws", () => {
  const dir = mkdtempSync(join(tmpdir(), "sentinel-prov-"));
  try {
    writeFileSync(join(dir, "PROVENANCE.json"), JSON.stringify({ feed: "x" }));
    assert.throws(() => loadSentinel(dir), /missing `schema_major` or `files`/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a schema major outside the pin stops the gate, because v3 may redefine the filters", () => {
  withVendorDir({ feed: feed({ schema_version: "3.0" }) }, (dir) => {
    assert.throws(() => loadSentinel(dir), /leaves the pinned major 2/);
  });
});

test("a required top-level key absent from the feed throws", () => {
  withVendorDir({ feed: { schema_version: "2.0", generated_at: "x", sources: [] } }, (dir) => {
    assert.throws(() => loadSentinel(dir), /required key `changes` is absent/);
  });
});

test("a feed whose top level is an array throws", () => {
  withVendorDir({ feed: [] }, (dir) => {
    assert.throws(() => loadSentinel(dir), /top level must be an object/);
  });
});

// --- URL comparison ----------------------------------------------------------------

test("urlKey ignores scheme and www, drops the fragment and a trailing slash", () => {
  const canonical = urlKey("https://www.dmv.example.gov/change-name");
  assert.equal(urlKey("http://dmv.example.gov/change-name/"), canonical);
  assert.equal(urlKey("https://DMV.example.gov/Change-Name#step2"), canonical);
});

test("urlKey keeps the query, because some statutes are addressed only by one", () => {
  assert.notEqual(
    urlKey("https://legis.example.gov/law.aspx?d=77843"),
    urlKey("https://legis.example.gov/law.aspx?d=77844"),
  );
});

test("urlKey falls back to the trimmed string for an unparseable URL", () => {
  assert.equal(urlKey("  NOT a url "), "not a url");
  assert.equal(urlHost("  NOT a url "), "not a url");
});

test("urlHost strips the path and query", () => {
  assert.equal(urlHost("https://www.legis.example.gov/law.aspx?d=1"), "legis.example.gov");
});

// --- which changes may be acted on --------------------------------------------------

test("isActionableChange accepts a confirmed, independently reviewed substantive change", () => {
  assert.equal(isActionableChange(change()), true);
});

for (const [label, over] of [
  ["an editorial classification", { significance: "editorial" }],
  ["a withdrawn record", { publication_status: "withdrawn" }],
  ["a corrected record", { publication_status: "corrected" }],
  ["an unconfirmed review status", { review_status: "pending" }],
  ["a substantive change with no independent decision", { independent_review_status: null }],
  ["an anonymous classification", { reviewer: "" }],
  ["a change with no observation date", { observed_at: "" }],
] as Array<[string, Partial<SentinelChange>]>) {
  test(`isActionableChange rejects ${label}`, () => {
    assert.equal(isActionableChange(change(over)), false);
  });
}

// --- matching ------------------------------------------------------------------------

test("a confirmed substantive change after last_verified flips that record and no other", () => {
  const other = record({ id: "ex.other", source: { ...record().source, url: "https://dmv.example.gov/other" } });
  const { flags } = matchChanges([record(), other], feed({ changes: [change()] }));
  assert.deepEqual(flags.map((f) => f.recordId), ["ex.drivers-license.name"]);
  assert.equal(flags[0]?.changeId, "chg-1");
  assert.equal(flags[0]?.lastVerified, "2026-07-01");
});

test("the same change dated BEFORE the record's last check flips nothing", () => {
  const { flags } = matchChanges([record()], feed({ changes: [change({ observed_at: "2026-06-01T00:00:00Z" })] }));
  assert.deepEqual(flags, []);
});

test("a change observed on the verification day itself flips nothing", () => {
  // Two events on one calendar date cannot be ordered from the dates alone.
  const { flags } = matchChanges([record()], feed({ changes: [change({ observed_at: "2026-07-01T23:00:00Z" })] }));
  assert.deepEqual(flags, []);
});

test("an editorial change after last_verified flips nothing", () => {
  const { flags } = matchChanges([record()], feed({ changes: [change({ significance: "editorial" })] }));
  assert.deepEqual(flags, []);
});

test("a sibling page on a cited host is reported, never applied", () => {
  const result = matchChanges(
    [record()],
    feed({ changes: [change({ url: "https://dmv.example.gov/some-other-page" })] }),
  );
  assert.deepEqual(result.flags, []);
  assert.equal(result.hostOnly.length, 1);
  assert.equal(result.hostOnly[0]?.host, "dmv.example.gov");
  assert.deepEqual(result.hostOnly[0]?.citedBy, ["ex.drivers-license.name"]);
});

test("a change on a host this corpus does not cite is counted as unmatched", () => {
  const result = matchChanges([record()], feed({ changes: [change({ url: "https://elsewhere.example/x" })] }));
  assert.deepEqual(result.flags, []);
  assert.deepEqual(result.hostOnly, []);
  assert.deepEqual(result.unmatched, ["chg-1"]);
});

test("a record with no source URL is skipped rather than crashing the match", () => {
  const broken = { ...record({ id: "ex.broken" }), source: { ...record().source, url: "" } } as CorpusRecord;
  const { flags } = matchChanges([broken, record()], feed({ changes: [change()] }));
  assert.deepEqual(flags.map((f) => f.recordId), ["ex.drivers-license.name"]);
});

// --- twins ---------------------------------------------------------------------------

test("flagging an English record degrades its Spanish twin with the same change id", () => {
  const en = record();
  const es = record({
    id: "ex.drivers-license.name.es",
    language: "es",
    // A Spanish record may cite the same agency's Spanish page, so a URL match would miss it.
    source: { ...record().source, url: "https://dmv.example.gov/cambio-de-nombre" },
  });
  const { flags } = matchChanges([en, es], feed({ changes: [change()] }));
  const planned = planWrites([en, es], flags);
  assert.deepEqual(planned.map((p) => p.recordId), ["ex.drivers-license.name", "ex.drivers-license.name.es"]);
  assert.equal(planned[0]?.inherited, false);
  assert.equal(planned[1]?.inherited, true);
  // Date part only: the corpus speaks in ISO calendar dates.
  assert.equal(planned[1]?.flaggedBy.reviewed_at, "2026-08-21");
  assert.equal(planned[1]?.flaggedBy.change_id, "chg-1");
});

test("flagging a Spanish record drags its English canonical too", () => {
  const en = record();
  const es = record({ id: "ex.drivers-license.name.es", language: "es" });
  const { flags } = matchChanges([es], feed({ changes: [change()] }));
  assert.deepEqual(flags.map((f) => f.recordId), ["ex.drivers-license.name.es"]);
  const planned = planWrites([en, es], flags);
  assert.deepEqual(planned.map((p) => p.recordId).sort(), [
    "ex.drivers-license.name",
    "ex.drivers-license.name.es",
  ]);
});

test("planWrites ignores a flag naming a record that is not in the corpus", () => {
  const planned = planWrites([], [
    {
      recordId: "ghost",
      changeId: "chg-1",
      url: "https://x.example/",
      observedAt: "2026-08-20T00:00:00Z",
      reviewer: "A Named Human",
      reviewedAt: "2026-08-21T00:00:00Z",
      lastVerified: "2026-07-01",
    },
  ]);
  assert.deepEqual(planned, []);
});

test("applyPlanToFile writes exactly two fields, and leaves every cited claim alone", () => {
  const en = record();
  const es = record({ id: "ex.drivers-license.name.es", language: "es" });
  const { flags } = matchChanges([en, es], feed({ changes: [change()] }));
  const planned = new Map(planWrites([en, es], flags).map((p) => [p.recordId, p]));

  const file = [
    { ...en, statement: "ORIGINAL STATEMENT" } as unknown as Record<string, unknown>,
    { ...record({ id: "ex.untouched" }) } as unknown as Record<string, unknown>,
  ];
  const written = applyPlanToFile(file, planned);
  assert.equal(written, 1);
  assert.equal(file[0]?.verification_status, "needs_reverification");
  assert.deepEqual(file[0]?.flagged_by, {
    feed: SENTINEL_FEED_ID,
    change_id: "chg-1",
    reviewed_at: "2026-08-21",
  });
  assert.equal(file[0]?.statement, "ORIGINAL STATEMENT");
  assert.deepEqual((file[0] as { source: { url: string } }).source.url, en.source.url);
  // A record no plan names is untouched, including its status.
  assert.equal(file[1]?.verification_status, "verified");
  assert.equal(file[1]?.flagged_by, undefined);
});

test("applyPlanToFile reports zero for a file holding none of the planned records", () => {
  assert.equal(applyPlanToFile([{ id: "ex.elsewhere" }], new Map()), 0);
});

// --- externally unwatchable ----------------------------------------------------------

test("a gap host this corpus cites is reported with the sentinel's own reason", () => {
  const inv = inventory({
    gaps: [
      {
        jurisdiction: "FL",
        document_class: "court_order_name_change",
        reason: "robots-disallowed",
        hosts: ["dmv.example.gov", "uncited.example.gov"],
        checked: "2026-07-13",
        detail: "irrelevant here",
      },
    ],
  });
  const out = externallyUnwatchable([record()], inv);
  assert.deepEqual(out.map((u) => u.host), ["dmv.example.gov"]);
  assert.equal(out[0]?.reason, "gap:robots-disallowed");
  assert.deepEqual(out[0]?.citedBy, ["ex.drivers-license.name"]);
});

test("a registered source the sentinel's crawler cannot reach is reported separately", () => {
  const inv = inventory({
    sources: [
      {
        source_id: "src-1",
        jurisdiction: "CA",
        document_class: "drivers_license",
        url: "https://www.dmv.example.gov/change-name",
        authority: "Example",
        verification_status: "unverified",
        reachable_by_our_crawler: false,
      },
      {
        source_id: "src-2",
        jurisdiction: "CA",
        document_class: "drivers_license",
        url: "https://reachable.example.gov/x",
        authority: "Example",
        verification_status: "unverified",
        reachable_by_our_crawler: true,
      },
    ],
  });
  const out = externallyUnwatchable([record()], inv);
  assert.deepEqual(out.map((u) => u.reason), ["crawler-unreachable"]);
});

test("externallyUnwatchable reads the CORPUS, not just the inventory", () => {
  // The guard against this repository's own recurring defect: an analysis path that
  // produces a plausible answer without ever consulting its real input. Swap the corpus
  // for an empty one and the answer must collapse.
  const inv = inventory({
    gaps: [
      {
        jurisdiction: "FL",
        document_class: "court_order_name_change",
        reason: "robots-disallowed",
        hosts: ["dmv.example.gov"],
        checked: "2026-07-13",
        detail: "d",
      },
    ],
  });
  assert.equal(externallyUnwatchable([record()], inv).length, 1);
  assert.equal(externallyUnwatchable([], inv).length, 0);
});

// --- summary honesty -----------------------------------------------------------------

test("an empty feed is reported as no signal, never as an all-clear", () => {
  withVendorDir({}, (dir) => {
    const s = loadSentinel(dir);
    const { lines, pending } = summarize([record()], s);
    assert.deepEqual(pending, []);
    assert.match(lines[0] ?? "", /NO published changes/);
    assert.match(lines[0] ?? "", /not evidence that no cited source moved/);
    assert.doesNotMatch(lines.join(" "), /up to date|all clear|no changes detected/i);
  });
});

test("a non-empty feed reports how many entries are actionable", () => {
  withVendorDir({ feed: feed({ changes: [change(), change({ id: "chg-2", significance: "editorial" })] }) }, (dir) => {
    const s = loadSentinel(dir);
    const { lines, pending } = summarize([record()], s);
    assert.match(lines[0] ?? "", /2 published change\(s\), 1 of them human-confirmed/);
    assert.deepEqual(pending.map((p) => p.recordId), ["ex.drivers-license.name"]);
  });
});

test("a record already carrying this change's flag is not pending again", () => {
  withVendorDir({ feed: feed({ changes: [change()] }) }, (dir) => {
    const s = loadSentinel(dir);
    const flagged = record({
      verification_status: "needs_reverification",
      flagged_by: { feed: SENTINEL_FEED_ID, change_id: "chg-1", reviewed_at: "2026-08-21" },
    });
    assert.deepEqual(summarize([flagged], s).pending, []);
    // ...but a LATER change on the same record is still owed.
    assert.equal(existingFlags([flagged]).get("ex.drivers-license.name")?.change_id, "chg-1");
  });
});

test("a stale flag naming an older change does not suppress a newer one", () => {
  withVendorDir({ feed: feed({ changes: [change({ id: "chg-9" })] }) }, (dir) => {
    const s = loadSentinel(dir);
    const flagged = record({
      verification_status: "needs_reverification",
      flagged_by: { feed: SENTINEL_FEED_ID, change_id: "chg-1", reviewed_at: "2026-08-01" },
    });
    assert.deepEqual(summarize([flagged], s).pending.map((p) => p.changeId), ["chg-9"]);
  });
});

// --- the artifacts actually committed -------------------------------------------------

test("the committed vendored artifacts load, and describe the real corpus", () => {
  const s = loadSentinel(sentinelDir());
  assert.equal(s.provenance.feed, SENTINEL_FEED_ID);
  const records = loadCorpus();
  const unwatchable = externallyUnwatchable(records, s.inventory);
  // A real, non-trivial overlap: hosts this corpus cites that a second watcher has
  // publicly declared it cannot watch either. If this ever drops to zero the vendored
  // inventory changed shape, which is a thing to look at, not to shrug at.
  assert.ok(unwatchable.length > 0, "expected the real corpus to overlap the sentinel's declared gaps");
  for (const u of unwatchable) {
    assert.ok(u.citedBy.length > 0);
    assert.match(u.reason, /^(gap:|crawler-unreachable$)/);
  }
  // Same call against an empty corpus must produce nothing — the overlap is measured, not
  // recited from the inventory alone.
  assert.equal(externallyUnwatchable([], s.inventory).length, 0);
});

test("no committed record carries a flag that the vendored feed cannot account for", () => {
  const s = loadSentinel(sentinelDir());
  const actionable = new Set(s.feed.changes.filter(isActionableChange).map((c) => c.id));
  for (const [recordId, flag] of existingFlags(loadCorpus())) {
    assert.equal(flag.feed, SENTINEL_FEED_ID, `${recordId} names an unknown feed`);
    assert.ok(actionable.has(flag.change_id), `${recordId} names change ${flag.change_id}, absent from the feed`);
  }
});
