// Verifier workbench (EXP-04) — a LOCAL-ONLY tool that makes one record verification a
// five-minute act. Never deployed, never hosted, no multi-user surface: verification stays
// a signed local act by a named human (ADR-3).
//
//   npm run verify-record -- --jurisdiction tx --verifier "Jane Doe"
//
// THE TOOL MUST NEVER APPROVE. It fetches the cited source, shows the record beside it, and
// asks the one question a verifier can answer — does this source support this claim as
// written? — then RECORDS the answer. It does not score, rank, or suggest a verdict, and it
// deliberately implements no text-similarity heuristic: a machine that hints at "looks fine"
// is a machine that gets nodded through, and launch gate 1 exists precisely because 0 of
// ~1000 records have been read by an accountable human.
//
// Three invariants are enforced in code rather than in the prompt text, because a rule that
// lives only in a prompt is a rule the tired 40th record breaks:
//
//   1. A verifier name absent from corpus/VERIFIERS.json is refused BEFORE any record is
//      shown and before any write. See assertVerifier().
//   2. A source that cannot be read — HTTP 403, a host that refuses automation, a PDF with
//      no extractable text, or no committed snapshot to compare against — is presented as
//      UNCHECKABLE and CANNOT be marked verified from here. applyVerdict() throws rather
//      than trusting the caller. This is the repo's dominant defect class ("absence
//      rendered as a value") pointed at its own verification record: "I could not read the
//      source" must never be storable as "a human read the source and it was right".
//   3. A rejection is NOT a verification event, so `source.last_verified` is left untouched
//      on "not supported". Only the status moves. Writing today's date there would make a
//      record that just FAILED review look freshly checked to the freshness gate.
//
// Resumable per jurisdiction: quitting costs nothing, and progress lives in a gitignored
// .verifier-workbench/ directory that is never part of the corpus.

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { loadVerifierRoster, isPlaceholderVerifier, validateRecord, REPO_ROOT, type VerifierEntry } from "../api/corpus.ts";
import type { CorpusRecord } from "../api/types.ts";
import { normalize, TIMEOUT_MS as SOURCE_FETCH_TIMEOUT_MS, UA as SOURCE_FETCH_UA } from "./source-watch.ts";
import { loadSnapshotIndex, sha256, SNAPSHOT_DIR, type SnapshotEntry } from "./source-fidelity.ts";
import { isoToday } from "../api/freshness.ts";

const JURISDICTIONS_DIR = join(REPO_ROOT, "corpus", "jurisdictions");
/** Local, gitignored working state. Never part of the corpus, never committed, never served. */
export const WORKBENCH_DIR = join(REPO_ROOT, ".verifier-workbench");

// ── Source checkability ───────────────────────────────────────────────────────────────

export type UncheckableReason =
  | "source-refuses-automation"
  | "not-text"
  | "fetch-failed"
  | "no-snapshot";

export type Checkability =
  | { kind: "checkable"; drifted: boolean; liveSha: string; snapshotSha: string }
  | { kind: "uncheckable"; reason: UncheckableReason; detail: string };

/** What a live fetch of the cited source produced. `text` is the NORMALIZED page text. */
export interface LiveFetch {
  ok: boolean;
  status: number | null;
  text: string | null;
  /** Transport-level error (DNS, TLS, timeout) when there was no HTTP response at all. */
  error?: string;
}

/**
 * Decide whether this source can be checked at all, and why not when it cannot.
 *
 * Durable facts recorded in the snapshot index win over the live attempt, because they are
 * the reviewed explanation: a host on the unfetchable list will always 403, and reporting
 * that as a generic "fetch failed" would send a verifier chasing a network problem that is
 * really a standing policy. Ordering is therefore: recorded-unfetchable, recorded-not-text,
 * live failure, missing snapshot.
 */
export function classifySource(entry: SnapshotEntry | undefined, live: LiveFetch): Checkability {
  if (entry?.unfetchable) {
    return {
      kind: "uncheckable",
      reason: "source-refuses-automation",
      detail: `${entry.unfetchable.status} — ${entry.unfetchable.note}`,
    };
  }
  if (entry?.unextractable) {
    return { kind: "uncheckable", reason: "not-text", detail: entry.unextractable.reason };
  }
  if (!live.ok || live.text === null) {
    const how = live.status !== null ? `HTTP ${live.status}` : (live.error ?? "no response");
    return {
      kind: "uncheckable",
      reason: "fetch-failed",
      detail: `the cited page could not be read just now (${how})`,
    };
  }
  if (!entry || entry.file === null || !entry.sha256) {
    return {
      kind: "uncheckable",
      reason: "no-snapshot",
      detail: "no committed snapshot to compare the live page against — run `make source-snapshot` first",
    };
  }
  const liveSha = sha256(live.text);
  return { kind: "checkable", drifted: liveSha !== entry.sha256, liveSha, snapshotSha: entry.sha256 };
}

/** Fetch a cited source with the SAME user-agent and timeout the watcher uses. */
export async function fetchSource(url: string): Promise<LiveFetch> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(SOURCE_FETCH_TIMEOUT_MS),
      headers: { "user-agent": SOURCE_FETCH_UA },
    });
    if (!res.ok) return { ok: false, status: res.status, text: null };
    const type = res.headers.get("content-type") ?? "";
    const body = Buffer.from(await res.arrayBuffer());
    // A non-HTML body (a PDF, most often) has no text to compare at this layer; the
    // fidelity store records those as `unextractable` rather than pretending otherwise.
    if (!type.includes("html")) return { ok: false, status: res.status, text: null, error: `content-type ${type || "unknown"} is not HTML` };
    return { ok: true, status: res.status, text: normalize(body.toString("utf8")) };
  } catch (err) {
    return { ok: false, status: null, text: null, error: err instanceof Error ? err.message : String(err) };
  }
}

// ── Verifier roster ───────────────────────────────────────────────────────────────────

export interface VerifierCheck {
  ok: boolean;
  message: string;
  entry?: VerifierEntry;
}

/**
 * A verifier must appear in corpus/VERIFIERS.json by exact name before anything is shown or
 * written. Placeholder ("seed") reviewers are refused by default: the roster's own comment
 * says a record carrying one is NEVER launch-cleared, so letting the workbench stamp real
 * records with a placeholder would manufacture verification theatre at exactly the gate this
 * tool exists to move. `--allow-placeholder` is available for fixture and demo runs and says
 * so out loud.
 */
export function assertVerifier(
  name: string,
  roster: Map<string, VerifierEntry>,
  opts: { allowPlaceholder?: boolean } = {},
): VerifierCheck {
  const trimmed = name.trim();
  if (trimmed === "") return { ok: false, message: "no verifier name given (--verifier \"Exact Name\")" };
  const entry = roster.get(trimmed);
  if (!entry) {
    const known = [...roster.keys()].map((k) => `"${k}"`).join(", ") || "(roster is empty)";
    return {
      ok: false,
      message:
        `"${trimmed}" is not on the verifier roster in corpus/VERIFIERS.json, so nothing was ` +
        `read and nothing was written. Add the verifier to the roster in a reviewed PR first. ` +
        `Known: ${known}`,
    };
  }
  if (isPlaceholderVerifier(trimmed, roster) && !opts.allowPlaceholder) {
    return {
      ok: false,
      message:
        `"${trimmed}" is a PLACEHOLDER (seed) reviewer. Records carrying it are mechanically ` +
        `valid but are never launch-cleared, so the workbench refuses to stamp real records ` +
        `with it. Use a real, accountable human verifier — or pass --allow-placeholder if you ` +
        `are deliberately exercising the tool against fixtures.`,
    };
  }
  return { ok: true, message: `verifier "${trimmed}" is on the roster`, entry };
}

// ── Recording a verdict ───────────────────────────────────────────────────────────────

export type Answer = "supported" | "not-supported";

export interface Verdict {
  answer: Answer;
  verifier: string;
  /** ISO date of the verification act. Injected so tests are deterministic. */
  today: string;
}

/**
 * Produce the updated record. PURE — it returns a new object and touches no disk, so the
 * two invariants below are unit-testable and cannot be bypassed by a caller that forgot.
 *
 * `supported` on an UNCHECKABLE source throws: see the header, invariant 2.
 * `not-supported` leaves `source.last_verified` alone: see the header, invariant 3.
 */
export function applyVerdict(record: CorpusRecord, check: Checkability, verdict: Verdict): CorpusRecord {
  if (verdict.answer === "supported" && check.kind === "uncheckable") {
    throw new Error(
      `refusing to mark ${record.id} verified: its cited source is UNCHECKABLE ` +
        `(${check.reason} — ${check.detail}). A source that could not be read cannot have ` +
        `supported a claim.`,
    );
  }
  if (verdict.answer === "supported") {
    return {
      ...record,
      source: { ...record.source, last_verified: verdict.today, verifier: verdict.verifier },
      verification_status: "verified",
    };
  }
  return { ...record, verification_status: "needs_reverification" };
}

// ── Corpus file I/O ───────────────────────────────────────────────────────────────────

export interface JurisdictionFile {
  path: string;
  name: string;
  records: CorpusRecord[];
  /** True when JSON.stringify round-trips the file byte-for-byte (see saveJurisdictionFile). */
  roundTrips: boolean;
}

export function loadJurisdictionFiles(dir: string = JURISDICTIONS_DIR): JurisdictionFile[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((name) => {
      const path = join(dir, name);
      const raw = readFileSync(path, "utf8");
      const records = JSON.parse(raw) as CorpusRecord[];
      return { path, name, records, roundTrips: JSON.stringify(records, null, 2) + "\n" === raw };
    });
}

/**
 * Normalize a jurisdiction argument to the corpus's `US-XX` form. Accepts `tx`, `TX`,
 * `us-tx` and `US-TX` so a verifier does not have to remember which one the JSON uses.
 */
export function normalizeJurisdiction(arg: string): string {
  const up = arg.trim().toUpperCase();
  return up.startsWith("US-") ? up : `US-${up}`;
}

export function saveJurisdictionFile(file: JurisdictionFile, records: CorpusRecord[]): void {
  writeFileSync(file.path, JSON.stringify(records, null, 2) + "\n");
}

// ── Resumable progress ────────────────────────────────────────────────────────────────

export interface Progress {
  done: string[];
}

export function progressPath(jurisdiction: string, dir: string = WORKBENCH_DIR): string {
  return join(dir, `progress-${jurisdiction.toLowerCase()}.json`);
}

export function loadProgress(jurisdiction: string, dir: string = WORKBENCH_DIR): Progress {
  const path = progressPath(jurisdiction, dir);
  if (!existsSync(path)) return { done: [] };
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Progress;
    // Defend against a hand-edited or truncated file: a non-array `done` would make
    // `.includes` throw mid-session and lose the verifier's place.
    return Array.isArray(parsed?.done) ? { done: parsed.done.filter((d) => typeof d === "string") } : { done: [] };
  } catch {
    // A corrupt progress file must not block verification; it only costs re-reading records.
    return { done: [] };
  }
}

export function saveProgress(jurisdiction: string, progress: Progress, dir: string = WORKBENCH_DIR): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(progressPath(jurisdiction, dir), JSON.stringify(progress, null, 2) + "\n");
}

/**
 * The verifier's free-text reason for a rejection, appended to a LOCAL log.
 *
 * It deliberately does not go into the corpus record. There is no private-note field in the
 * schema today (that arrives with the schema-v2 changelog, #229), and inventing one here
 * would both change the corpus schema underneath ~40 in-flight jurisdiction branches and
 * risk a reviewer note reaching rendered output. Local log now; corpus changelog when #229
 * lands. See docs/VERIFIER-WORKBENCH.md.
 */
export function logRejection(entry: Record<string, unknown>): void {
  mkdirSync(WORKBENCH_DIR, { recursive: true });
  appendFileSync(join(WORKBENCH_DIR, "review-log.jsonl"), JSON.stringify(entry) + "\n");
}

// ── Presentation ──────────────────────────────────────────────────────────────────────

const RULE = "─".repeat(78);

export function renderRecord(record: CorpusRecord, check: Checkability, snapshotFile: string | null): string {
  const lines: string[] = [];
  lines.push(RULE, `RECORD  ${record.id}`, RULE);
  lines.push(`topic          ${record.topic}`);
  lines.push(`document       ${record.document_type}   change: ${record.change_type.join(", ")}`);
  if (record.audience) lines.push(`audience       ${record.audience}`);
  lines.push("", "STATEMENT (the claim you are checking)", indent(record.statement));
  if (record.detail) lines.push("", "DETAIL", indent(record.detail));
  if (record.cost) {
    const amount = record.cost.amount_usd === null || record.cost.amount_usd === undefined ? "not a fixed amount" : `$${record.cost.amount_usd}`;
    lines.push("", `COST           ${amount}`);
    if (record.cost.note) lines.push(indent(record.cost.note));
  }
  if (record.timeline) lines.push("", `TIMELINE       ${JSON.stringify(record.timeline)}`);
  if (record.form_ref) lines.push(`FORM           ${record.form_ref}`);
  lines.push("", "CITED SOURCE");
  lines.push(`  title        ${record.source.title}`);
  lines.push(`  url          ${record.source.url}`);
  lines.push(`  last_verified ${record.source.last_verified}   by: ${record.source.verifier}`);
  lines.push(`  status       ${record.verification_status}   SLA: ${record.recheck_sla_days}d`);
  lines.push("", "SOURCE STATE");
  if (check.kind === "uncheckable") {
    lines.push(`  ⛔ UNCHECKABLE (${check.reason}) — ${check.detail}`);
    lines.push("  This record CANNOT be marked verified from the workbench.");
  } else if (check.drifted) {
    lines.push("  ⚠ the live page DIFFERS from the committed snapshot — read the live page, not the snapshot.");
    lines.push(`  snapshot ${check.snapshotSha.slice(0, 12)}  live ${check.liveSha.slice(0, 12)}`);
    if (snapshotFile) lines.push(`  snapshot text: ${join(SNAPSHOT_DIR, snapshotFile)}`);
  } else {
    lines.push("  ✓ the live page matches the committed snapshot byte-for-byte (normalized).");
    if (snapshotFile) lines.push(`  snapshot text: ${join(SNAPSHOT_DIR, snapshotFile)}`);
  }
  return lines.join("\n");
}

function indent(text: string): string {
  return text
    .split("\n")
    .map((l) => `    ${l}`)
    .join("\n");
}

// ── CLI ───────────────────────────────────────────────────────────────────────────────

export interface Args {
  jurisdiction?: string;
  verifier?: string;
  record?: string;
  allowPlaceholder: boolean;
  dir?: string;
  reset: boolean;
}

export function parseArgs(argv: string[]): Args {
  const args: Args = { allowPlaceholder: false, reset: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    // A flag whose value is missing (`--verifier` as the last argument) leaves the field
    // unset rather than storing `undefined` as if it were a name — the usage text then
    // fires, instead of a confusing "" is not on the roster.
    const next = argv[i + 1];
    if (a === "--jurisdiction" || a === "-j") {
      if (next !== undefined) args.jurisdiction = next;
      i++;
    } else if (a === "--verifier" || a === "-v") {
      if (next !== undefined) args.verifier = next;
      i++;
    } else if (a === "--record" || a === "-r") {
      if (next !== undefined) args.record = next;
      i++;
    } else if (a === "--dir") {
      if (next !== undefined) args.dir = next;
      i++;
    } else if (a === "--allow-placeholder") args.allowPlaceholder = true;
    else if (a === "--reset") args.reset = true;
  }
  return args;
}

const USAGE = `
Verifier workbench — record one human's reading of one cited source.

  npm run verify-record -- --jurisdiction tx --verifier "Exact Roster Name"

  --jurisdiction, -j   jurisdiction to walk (tx, TX, US-TX)
  --verifier, -v       your name, exactly as it appears in corpus/VERIFIERS.json
  --record, -r         verify a single record id instead of the whole jurisdiction
  --reset              forget saved progress for this jurisdiction and start over
  --allow-placeholder  permit a seed/placeholder verifier (fixtures and demos only)
  --dir                jurisdiction directory to read (fixtures; defaults to the corpus)

The tool never decides. It shows you the record and the live source, asks whether the
source supports the claim as written, and records your answer.
`.trim();

/**
 * Ask a question, returning null when there is no one left to answer.
 *
 * `rl.question` THROWS `ERR_USE_AFTER_CLOSE` once stdin has ended — which happens whenever
 * the tool is driven from a pipe or the verifier hits Ctrl-D. Left unhandled that ends a
 * session in a stack trace AFTER records have been written, so the verifier cannot tell
 * whether their last answer was saved. EOF is a legitimate "I am done": it is reported as
 * such and the caller stops cleanly with progress already on disk.
 */
async function ask(rl: ReturnType<typeof createInterface>, prompt: string): Promise<string | null> {
  try {
    return await rl.question(prompt);
  } catch {
    return null;
  }
}

async function main(argv: string[]): Promise<number> {
  const args = parseArgs(argv);
  if (!args.jurisdiction || !args.verifier) {
    console.log(USAGE);
    return args.jurisdiction || args.verifier ? 1 : 0;
  }

  // Invariant 1: the roster check happens before anything is read, shown, or written.
  const roster = loadVerifierRoster();
  const verifierCheck = assertVerifier(args.verifier, roster, { allowPlaceholder: args.allowPlaceholder });
  if (!verifierCheck.ok) {
    console.error(`\n  ❌ ${verifierCheck.message}\n`);
    return 1;
  }
  console.log(`\n  ✅ ${verifierCheck.message}`);

  const jurisdiction = normalizeJurisdiction(args.jurisdiction);
  const files = loadJurisdictionFiles(args.dir ?? JURISDICTIONS_DIR);
  const targets = files
    .flatMap((file) => file.records.map((record, index) => ({ file, record, index })))
    .filter((t) => t.record.jurisdiction === jurisdiction)
    .filter((t) => (args.record ? t.record.id === args.record : true));

  if (targets.length === 0) {
    console.error(`\n  ❌ no records found for ${jurisdiction}${args.record ? ` with id ${args.record}` : ""}.\n`);
    return 1;
  }

  if (args.reset) saveProgress(jurisdiction, { done: [] });
  const progress = loadProgress(jurisdiction);
  const remaining = targets.filter((t) => !progress.done.includes(t.record.id));

  console.log(
    `  ${targets.length} record(s) in ${jurisdiction}; ${progress.done.length} already done this session, ` +
      `${remaining.length} to go.\n`,
  );
  if (remaining.length === 0) {
    console.log("  Nothing left. Use --reset to walk this jurisdiction again.\n");
    return 0;
  }

  const index = loadSnapshotIndex();
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const today = isoToday();
  let verified = 0;
  let rejected = 0;
  let skipped = 0;

  try {
    for (const target of remaining) {
      const { file, record } = target;
      console.log(`\n  fetching ${record.source.url} …`);
      const live = await fetchSource(record.source.url);
      const entry = index.snapshots[record.source.url];
      const check = classifySource(entry, live);
      console.log("\n" + renderRecord(record, check, entry?.file ?? null) + "\n");

      const options = check.kind === "uncheckable" ? "[n]o / [s]kip / [q]uit" : "[y]es / [n]o / [s]kip / [q]uit";
      const question =
        check.kind === "uncheckable"
          ? `  Source UNCHECKABLE — cannot verify. Mark needs_reverification? ${options}: `
          : `  Does this source support the statement AS WRITTEN? ${options}: `;

      let answer = "";
      while (!["y", "n", "s", "q"].includes(answer)) {
        // No default. An empty Enter re-asks rather than accepting anything, because a
        // default answer is the tool making the call.
        const raw = await ask(rl, question);
        if (raw === null) {
          answer = "q"; // stdin ended — treat as quit, not as an answer
          break;
        }
        answer = raw.trim().toLowerCase().slice(0, 1);
        if (answer === "y" && check.kind === "uncheckable") {
          console.log("  ⛔ refused: the source could not be read, so it cannot have supported the claim.");
          answer = "";
        }
      }

      if (answer === "q") {
        console.log("\n  Stopped. Progress saved — rerun the same command to continue.\n");
        break;
      }
      if (answer === "s") {
        skipped += 1;
        continue;
      }

      let reason = "";
      if (answer === "n") {
        while (reason.trim() === "") {
          const raw = await ask(rl, "  Why not? (one line, recorded locally): ");
          if (raw === null) {
            // No reason means no record of WHY, so nothing is written for this record at
            // all — a bare needs_reverification with no explanation is the kind of
            // unexplained state this corpus keeps having to re-investigate.
            console.log("\n  Input ended before a reason was given — this record was left unchanged.\n");
            return 0;
          }
          reason = raw;
        }
      }

      const updated = applyVerdict(record, check, {
        answer: answer === "y" ? "supported" : "not-supported",
        verifier: args.verifier,
        today,
      });

      // Refuse to write a record the corpus validator would reject: a workbench that can
      // produce an invalid corpus is a workbench that breaks `make content` for someone else.
      const issues = validateRecord(updated);
      if (issues.length > 0) {
        console.error(`  ❌ not written — the result would fail corpus validation:`);
        for (const issue of issues) console.error(`     - ${JSON.stringify(issue)}`);
        return 1;
      }

      if (!file.roundTrips) {
        console.log(
          `  ⚠ ${file.name} is not in canonical JSON formatting, so saving will also reformat ` +
            `unrelated parts of it. Review the diff before committing.`,
        );
      }

      const records = file.records.map((r) => (r.id === record.id ? updated : r));
      saveJurisdictionFile(file, records);
      file.records = records;

      if (answer === "n") {
        logRejection({ record: record.id, verifier: args.verifier, at: today, reason: reason.trim(), source: record.source.url });
        rejected += 1;
        console.log(`  recorded: ${record.id} → needs_reverification (reason logged locally).`);
      } else {
        verified += 1;
        console.log(`  recorded: ${record.id} → verified by ${args.verifier} on ${today}.`);
      }
      progress.done.push(record.id);
      saveProgress(jurisdiction, progress);
    }
  } finally {
    rl.close();
  }

  console.log(
    `\n  Session: ${verified} verified, ${rejected} marked needs_reverification, ${skipped} skipped.\n` +
      `  Review the diff (git diff corpus/jurisdictions/) and open a PR — the workbench never commits.\n`,
  );
  return 0;
}

const invokedDirectly = process.argv[1]?.endsWith("verify-record.ts") ?? false;
if (invokedDirectly) {
  process.exitCode = await main(process.argv.slice(2));
}
