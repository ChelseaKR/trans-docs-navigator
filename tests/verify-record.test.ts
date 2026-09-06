// Tests for scripts/verify-record.ts — the verifier workbench.
//
// The point of this file is the REFUSALS. A workbench that can be talked into recording a
// verification nobody performed is worse than no workbench: it converts launch gate 1 from
// "0 records read by a human" into a number that looks like progress and is not. So the
// three properties the issue names as "done when" are asserted here as invariants, not as
// prompt wording:
//
//   * a verifier absent from the roster is refused BEFORE any write;
//   * a source that returned 403 cannot be marked verified, and says why;
//   * a six-record fixture walked end-to-end produces a corpus that still validates.
//
// Plus the quieter one that is easiest to get wrong: a REJECTION must not advance
// `source.last_verified`, or a record that just failed review reads as freshly checked.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

import {
  applyVerdict,
  assertVerifier,
  classifySource,
  loadJurisdictionFiles,
  loadProgress,
  normalizeJurisdiction,
  parseArgs,
  progressPath,
  saveJurisdictionFile,
  saveProgress,
  type Checkability,
  type LiveFetch,
} from "../scripts/verify-record.ts";
import { validateRecord, type VerifierEntry } from "../api/corpus.ts";
import type { CorpusRecord } from "../api/types.ts";

// ── Fixtures ──────────────────────────────────────────────────────────────────────────

function roster(entries: VerifierEntry[]): Map<string, VerifierEntry> {
  return new Map(entries.map((e) => [e.name, e]));
}

const REAL: VerifierEntry = {
  name: "Real Human Verifier",
  role: "attorney",
  affiliation: "Some Legal Aid",
} as VerifierEntry;

const SEED: VerifierEntry = {
  name: "Pilot Seed Reviewer",
  role: "seed",
  affiliation: "reference build",
  placeholder: true,
} as VerifierEntry;

const ROSTER = roster([REAL, SEED]);

function record(overrides: Partial<CorpusRecord> = {}): CorpusRecord {
  return {
    id: "tx.court-order.name",
    jurisdiction: "US-TX",
    document_type: "court-order",
    change_type: ["name"],
    topic: "Texas name change petition",
    statement: "In Texas you file a petition for a name change in the county where you live.",
    source: {
      url: "https://example.gov/name-change",
      title: "Example — name change",
      last_verified: "2026-01-01",
      verifier: "Pilot Seed Reviewer",
    },
    verification_status: "verified",
    recheck_sla_days: 90,
    language: "en",
    ...overrides,
  } as CorpusRecord;
}

const CHECKABLE: Checkability = {
  kind: "checkable",
  drifted: false,
  liveSha: "a".repeat(64),
  snapshotSha: "a".repeat(64),
};

const OK_FETCH: LiveFetch = { ok: true, status: 200, text: "some normalized page text" };

// ── Invariant 1: the roster gate ──────────────────────────────────────────────────────

describe("assertVerifier — nothing happens for a name that is not on the roster", () => {
  test("an unknown verifier is refused, and the message says nothing was written", () => {
    const result = assertVerifier("Someone Not On It", ROSTER);
    assert.equal(result.ok, false);
    assert.match(result.message, /not on the verifier roster/);
    assert.match(result.message, /nothing was read and nothing was written/);
  });

  test("a near-miss name is refused — matching is exact, never fuzzy", () => {
    // "real human verifier" differs only in case. Accepting it would let a typo'd or
    // impersonated name onto a record's provenance, which is the whole point of the roster.
    assert.equal(assertVerifier("real human verifier", ROSTER).ok, false);
    assert.equal(assertVerifier("Real Human Verifier ", ROSTER).ok, true); // trimmed, not fuzzed
  });

  test("an empty verifier is refused rather than treated as anonymous", () => {
    assert.equal(assertVerifier("   ", ROSTER).ok, false);
  });

  test("a placeholder/seed reviewer is refused by default", () => {
    const result = assertVerifier("Pilot Seed Reviewer", ROSTER);
    assert.equal(result.ok, false);
    assert.match(result.message, /PLACEHOLDER/);
    assert.match(result.message, /never launch-cleared/);
  });

  test("--allow-placeholder permits the seed reviewer, for fixtures", () => {
    assert.equal(assertVerifier("Pilot Seed Reviewer", ROSTER, { allowPlaceholder: true }).ok, true);
  });

  test("a real, accountable verifier is accepted", () => {
    const result = assertVerifier("Real Human Verifier", ROSTER);
    assert.equal(result.ok, true);
    assert.equal(result.entry?.name, "Real Human Verifier");
  });
});

// ── Invariant 2: an unreadable source cannot become a verification ────────────────────

describe("classifySource — absence is reported as absence, never as agreement", () => {
  test("a 403 is UNCHECKABLE and names the status", () => {
    const check = classifySource(
      { file: "x.txt", fetched: "2026-01-01", sha256: "b".repeat(64) },
      { ok: false, status: 403, text: null },
    );
    assert.equal(check.kind, "uncheckable");
    assert.equal(check.kind === "uncheckable" && check.reason, "fetch-failed");
    assert.match(check.kind === "uncheckable" ? check.detail : "", /HTTP 403/);
  });

  test("a transport failure with no HTTP response still reports why", () => {
    const check = classifySource(
      { file: "x.txt", fetched: "2026-01-01", sha256: "b".repeat(64) },
      { ok: false, status: null, text: null, error: "connect ETIMEDOUT" },
    );
    assert.equal(check.kind === "uncheckable" && check.reason, "fetch-failed");
    assert.match(check.kind === "uncheckable" ? check.detail : "", /ETIMEDOUT/);
  });

  test("a host recorded as refusing automation is reported as policy, not as a network blip", () => {
    // The durable, reviewed explanation must win over the live symptom, or a verifier goes
    // chasing a connectivity problem that is really a standing 403.
    const check = classifySource(
      { file: null, fetched: "2026-01-01", unfetchable: { status: "403", note: "blocks our UA" } },
      { ok: false, status: 403, text: null },
    );
    assert.equal(check.kind === "uncheckable" && check.reason, "source-refuses-automation");
    assert.match(check.kind === "uncheckable" ? check.detail : "", /blocks our UA/);
  });

  test("a non-text source (a PDF) is UNCHECKABLE at this layer", () => {
    const check = classifySource(
      { file: null, fetched: "2026-01-01", unextractable: { reason: "PDF bytes, no extractable text" } },
      OK_FETCH,
    );
    assert.equal(check.kind === "uncheckable" && check.reason, "not-text");
  });

  test("no committed snapshot is UNCHECKABLE even when the page fetches fine", () => {
    // Fetching successfully proves the page exists, not that it still says what the record
    // claims. Without a baseline there is nothing to compare, so it must not read as clean.
    const missingEntry = classifySource(undefined, OK_FETCH);
    assert.equal(missingEntry.kind, "uncheckable");
    assert.equal(missingEntry.kind === "uncheckable" && missingEntry.reason, "no-snapshot");
    const check = classifySource({ file: null, fetched: "2026-01-01" }, OK_FETCH);
    assert.equal(check.kind === "uncheckable" && check.reason, "no-snapshot");
  });

  test("a live page matching its snapshot is checkable and not drifted", () => {
    const text = "some normalized page text";
    const sha = createHash("sha256").update(text).digest("hex");
    const check = classifySource({ file: "x.txt", fetched: "2026-01-01", sha256: sha }, { ok: true, status: 200, text });
    assert.equal(check.kind, "checkable");
    assert.equal(check.kind === "checkable" && check.drifted, false);
  });

  test("a live page that moved under the record is checkable AND flagged drifted", () => {
    const check = classifySource(
      { file: "x.txt", fetched: "2026-01-01", sha256: "b".repeat(64) },
      { ok: true, status: 200, text: "the page changed" },
    );
    assert.equal(check.kind, "checkable");
    assert.equal(check.kind === "checkable" && check.drifted, true);
  });
});

describe("applyVerdict — the workbench refuses to launder an unreadable source", () => {
  test("marking an UNCHECKABLE source 'supported' throws rather than writing", () => {
    const uncheckable: Checkability = {
      kind: "uncheckable",
      reason: "fetch-failed",
      detail: "the cited page could not be read just now (HTTP 403)",
    };
    assert.throws(
      () => applyVerdict(record(), uncheckable, { answer: "supported", verifier: "Real Human Verifier", today: "2026-09-06" }),
      /UNCHECKABLE/,
    );
  });

  test("the refusal explains itself in terms a verifier can act on", () => {
    const uncheckable: Checkability = { kind: "uncheckable", reason: "no-snapshot", detail: "no committed snapshot" };
    assert.throws(
      () => applyVerdict(record(), uncheckable, { answer: "supported", verifier: "Real Human Verifier", today: "2026-09-06" }),
      /could not be read cannot have supported a claim/,
    );
  });

  test("an UNCHECKABLE source CAN still be marked needs_reverification", () => {
    // Recording "I could not check this" is exactly what we want a verifier to be able to do.
    const uncheckable: Checkability = { kind: "uncheckable", reason: "fetch-failed", detail: "HTTP 403" };
    const out = applyVerdict(record(), uncheckable, {
      answer: "not-supported",
      verifier: "Real Human Verifier",
      today: "2026-09-06",
    });
    assert.equal(out.verification_status, "needs_reverification");
  });

  test("'supported' stamps the date and the named verifier", () => {
    const out = applyVerdict(record(), CHECKABLE, {
      answer: "supported",
      verifier: "Real Human Verifier",
      today: "2026-09-06",
    });
    assert.equal(out.verification_status, "verified");
    assert.equal(out.source.last_verified, "2026-09-06");
    assert.equal(out.source.verifier, "Real Human Verifier");
  });

  test("INVARIANT: a rejection does NOT advance last_verified", () => {
    // The bug this guards: writing today's date on a "no" makes a record that just failed
    // review look freshly checked to the freshness gate, so it keeps serving as current.
    const before = record({ source: { ...record().source, last_verified: "2026-01-01" } });
    const out = applyVerdict(before, CHECKABLE, {
      answer: "not-supported",
      verifier: "Real Human Verifier",
      today: "2026-09-06",
    });
    assert.equal(out.verification_status, "needs_reverification");
    assert.equal(out.source.last_verified, "2026-01-01");
    assert.equal(out.source.verifier, "Pilot Seed Reviewer", "a rejection does not claim the rejecter as verifier");
  });

  test("applyVerdict is pure — the input record is not mutated", () => {
    const before = record();
    const snapshot = JSON.stringify(before);
    applyVerdict(before, CHECKABLE, { answer: "supported", verifier: "Real Human Verifier", today: "2026-09-06" });
    assert.equal(JSON.stringify(before), snapshot);
  });
});

// ── Done-when 1: a six-record fixture walks end-to-end and still validates ────────────

describe("a six-record jurisdiction fixture survives a full pass", () => {
  test("every record still passes corpus validation, and the file round-trips", async () => {
    const dir = await mkdtemp(join(tmpdir(), "tdn-workbench-"));
    try {
      const jdir = join(dir, "jurisdictions");
      await mkdir(jdir, { recursive: true });
      const six = Array.from({ length: 6 }, (_, i) =>
        record({
          id: `tx.fixture.${i}`,
          source: { ...record().source, url: `https://example.gov/page-${i}`, last_verified: "2026-01-01" },
          verification_status: "needs_reverification",
        }),
      );
      await writeFile(join(jdir, "texas.json"), JSON.stringify(six, null, 2) + "\n");

      const files = loadJurisdictionFiles(jdir);
      assert.equal(files.length, 1);
      assert.equal(files[0]!.records.length, 6);
      assert.equal(files[0]!.roundTrips, true, "fixture is written in the corpus's canonical JSON shape");

      // Three verified, three rejected — the realistic mixed outcome.
      const updated = files[0]!.records.map((r, i) =>
        applyVerdict(r, CHECKABLE, {
          answer: i % 2 === 0 ? "supported" : "not-supported",
          verifier: "Real Human Verifier",
          today: "2026-09-06",
        }),
      );
      saveJurisdictionFile(files[0]!, updated);

      const reloaded = loadJurisdictionFiles(jdir)[0]!;
      assert.equal(reloaded.roundTrips, true, "the workbench writes canonical JSON, so `make content` sees a clean diff");
      for (const r of reloaded.records) {
        assert.deepEqual(validateRecord(r), [], `${r.id} must still validate after a workbench pass`);
      }
      assert.equal(reloaded.records.filter((r) => r.verification_status === "verified").length, 3);
      assert.equal(reloaded.records.filter((r) => r.verification_status === "needs_reverification").length, 3);
      // The rejected half kept its old date; the verified half advanced.
      assert.equal(reloaded.records[1]!.source.last_verified, "2026-01-01");
      assert.equal(reloaded.records[0]!.source.last_verified, "2026-09-06");

      const raw = await readFile(join(jdir, "texas.json"), "utf8");
      assert.ok(raw.endsWith("\n"), "trailing newline preserved");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

// ── Resumability ──────────────────────────────────────────────────────────────────────

describe("progress is resumable and never blocks a session", () => {
  test("saved progress round-trips, scoped per jurisdiction", async () => {
    const dir = await mkdtemp(join(tmpdir(), "tdn-progress-"));
    try {
      saveProgress("US-TX", { done: ["tx.a", "tx.b"] }, dir);
      assert.deepEqual(loadProgress("US-TX", dir).done, ["tx.a", "tx.b"]);
      assert.deepEqual(loadProgress("US-CA", dir).done, [], "another jurisdiction is unaffected");
      assert.match(progressPath("US-TX", dir), /progress-us-tx\.json$/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("a corrupt or hand-edited progress file costs re-reading, never a crash", async () => {
    const dir = await mkdtemp(join(tmpdir(), "tdn-progress-"));
    try {
      await writeFile(join(dir, "progress-us-tx.json"), "{ not json");
      assert.deepEqual(loadProgress("US-TX", dir).done, []);
      await writeFile(join(dir, "progress-us-tx.json"), JSON.stringify({ done: "oops" }));
      assert.deepEqual(loadProgress("US-TX", dir).done, []);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

// ── Argument handling ─────────────────────────────────────────────────────────────────

describe("CLI argument handling", () => {
  test("jurisdiction shorthand is accepted in every spelling a verifier might type", () => {
    for (const input of ["tx", "TX", "us-tx", "US-TX"]) {
      assert.equal(normalizeJurisdiction(input), "US-TX");
    }
  });

  test("flags parse, including the short forms", () => {
    const args = parseArgs(["--jurisdiction", "tx", "-v", "Real Human Verifier", "--allow-placeholder"]);
    assert.equal(args.jurisdiction, "tx");
    assert.equal(args.verifier, "Real Human Verifier");
    assert.equal(args.allowPlaceholder, true);
    assert.equal(args.reset, false);
  });

  test("a flag with no value leaves the field unset rather than storing undefined as a name", () => {
    const args = parseArgs(["--jurisdiction", "tx", "--verifier"]);
    assert.equal(args.verifier, undefined);
    assert.equal("verifier" in args, false, "the key is absent, so usage fires instead of an empty-name roster miss");
  });
});
