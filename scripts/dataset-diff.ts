// Dataset release diff (ROADMAP EXP-08 / FIX-03 changelog requirement): compares two
// `records.json` arrays keyed by record `id` and reports exactly which legal facts
// changed and who verified them — the excellence bar a third party needs to audit a
// release without re-deriving it from git log.
//
//   node --experimental-strip-types scripts/dataset-diff.ts <old> <new> [outDir]
//
// <old> / <new> may each be:
//   - a path to a records.json file
//   - a path to a dataset directory containing records.json (as scripts/dataset-build.ts emits)
//   - `git:<ref>` — the corpus as it stood at <ref>, reconstructed from
//     corpus/jurisdictions/*.json via `git show <ref>:<path>` (for diffing the current
//     build against a previous tagged release with no on-disk dataset directory).
//
// Writes diff.json (machine-readable) and changelog.md (human-readable) to [outDir]
// (default: cwd). Exits 0 always — a diff is a report, not a gate.

import { readFileSync, writeFileSync, mkdirSync, statSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { REPO_ROOT } from "../api/corpus.ts";
import type { CorpusRecord } from "../api/types.ts";
import { pass, fail } from "./util.ts";

const [oldSpec, newSpec, outDirArg] = process.argv.slice(2);
if (!oldSpec || !newSpec) {
  fail("dataset-diff", "usage: dataset-diff.ts <old> <new> [outDir]", [
    "<old>/<new>: a records.json file, a dataset directory, or git:<ref>",
  ]);
}
const outDir = outDirArg ?? process.cwd();

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function flatten(parsed: unknown): CorpusRecord[] {
  const list = Array.isArray(parsed) ? parsed : [parsed];
  const out: CorpusRecord[] = [];
  for (const raw of list) {
    if (isObj(raw) && typeof raw.id === "string") out.push(raw as unknown as CorpusRecord);
  }
  return out;
}

function fromGitRef(ref: string): CorpusRecord[] {
  let names: string;
  try {
    names = execFileSync("git", ["ls-tree", "-r", "--name-only", ref, "--", "corpus/jurisdictions"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
  } catch (e) {
    fail("dataset-diff", `could not list corpus/jurisdictions at git ref "${ref}"`, [(e as Error).message]);
  }
  const files = names.split("\n").map((l) => l.trim()).filter((l) => l.endsWith(".json"));
  const records: CorpusRecord[] = [];
  for (const file of files) {
    const content = execFileSync("git", ["show", `${ref}:${file}`], { cwd: REPO_ROOT, encoding: "utf8" });
    records.push(...flatten(JSON.parse(content)));
  }
  return records;
}

function resolveRecords(spec: string): CorpusRecord[] {
  if (spec.startsWith("git:")) return fromGitRef(spec.slice("git:".length));
  let path = spec;
  if (existsSync(path) && statSync(path).isDirectory()) path = join(path, "records.json");
  if (!existsSync(path)) fail("dataset-diff", `not found: ${path}`);
  return flatten(JSON.parse(readFileSync(path, "utf8")));
}

const oldRecords = resolveRecords(oldSpec);
const newRecords = resolveRecords(newSpec);

const oldById = new Map(oldRecords.map((r) => [r.id, r]));
const newById = new Map(newRecords.map((r) => [r.id, r]));

const addedIds = [...newById.keys()].filter((id) => !oldById.has(id)).sort();
const removedIds = [...oldById.keys()].filter((id) => !newById.has(id)).sort();
const commonIds = [...newById.keys()].filter((id) => oldById.has(id)).sort();

// Fields surfaced first in changelog output because they carry legal-fact weight;
// any other differing top-level field is still reported, just after these.
const PRIORITY_FIELDS = ["statement", "verification_status", "detail", "cost", "timeline"] as const;

interface FieldChange {
  field: string;
  old: unknown;
  new: unknown;
}
interface RecordChange {
  id: string;
  fields: FieldChange[];
  /** Convenience flag: true when the change touches the claim text or its verification state. */
  legal_fact_changed: boolean;
  verifier: { old: string; new: string };
}

function diffRecord(oldRec: CorpusRecord, newRec: CorpusRecord): RecordChange | null {
  const keys = new Set([...Object.keys(oldRec), ...Object.keys(newRec)]);
  keys.delete("id");
  const fields: FieldChange[] = [];
  for (const key of [...keys].sort()) {
    const a = (oldRec as unknown as Record<string, unknown>)[key];
    const b = (newRec as unknown as Record<string, unknown>)[key];
    if (JSON.stringify(a) !== JSON.stringify(b)) fields.push({ field: key, old: a, new: b });
  }
  if (fields.length === 0) return null;
  const legalFactChanged = fields.some(
    (f) => PRIORITY_FIELDS.includes(f.field as (typeof PRIORITY_FIELDS)[number]) || f.field === "source",
  );
  return {
    id: oldRec.id,
    fields,
    legal_fact_changed: legalFactChanged,
    verifier: { old: oldRec.source?.verifier ?? "?", new: newRec.source?.verifier ?? "?" },
  };
}

const changed: RecordChange[] = [];
for (const id of commonIds) {
  const c = diffRecord(oldById.get(id)!, newById.get(id)!);
  if (c) changed.push(c);
}

const diff = {
  generated_at: new Date().toISOString(),
  old: oldSpec,
  new: newSpec,
  summary: { added: addedIds.length, removed: removedIds.length, changed: changed.length },
  added: addedIds,
  removed: removedIds,
  changed,
};

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "diff.json"), JSON.stringify(diff, null, 2) + "\n", "utf8");

function fmt(v: unknown): string {
  if (v === undefined) return "_(absent)_";
  if (typeof v === "string") return v.length > 120 ? v.slice(0, 117) + "..." : v;
  return "`" + JSON.stringify(v) + "`";
}

let md = `# Dataset changelog\n\n`;
md += `Comparing \`${oldSpec}\` -> \`${newSpec}\`, generated ${diff.generated_at}.\n\n`;
md += `**${addedIds.length}** added · **${removedIds.length}** removed · **${changed.length}** changed.\n\n`;

if (addedIds.length > 0) {
  md += `## Added (${addedIds.length})\n\n`;
  for (const id of addedIds) md += `- \`${id}\`\n`;
  md += `\n`;
}
if (removedIds.length > 0) {
  md += `## Removed (${removedIds.length})\n\n`;
  for (const id of removedIds) md += `- \`${id}\`\n`;
  md += `\n`;
}
if (changed.length > 0) {
  md += `## Changed (${changed.length})\n\n`;
  md += `Which legal facts changed, and who verified them:\n\n`;
  for (const c of changed) {
    md += `### \`${c.id}\`\n\n`;
    md += `Verifier: ${c.verifier.old === c.verifier.new ? c.verifier.new : `${c.verifier.old} -> **${c.verifier.new}**`}\n\n`;
    for (const f of c.fields) {
      md += `- **${f.field}**: ${fmt(f.old)} -> ${fmt(f.new)}\n`;
    }
    md += `\n`;
  }
}
if (addedIds.length === 0 && removedIds.length === 0 && changed.length === 0) {
  md += `No differences — the corpus is unchanged between these two releases.\n`;
}

writeFileSync(join(outDir, "changelog.md"), md, "utf8");

pass(
  "dataset-diff",
  `${addedIds.length} added, ${removedIds.length} removed, ${changed.length} changed -> ${outDir.replace(REPO_ROOT + "/", "")}`,
);
