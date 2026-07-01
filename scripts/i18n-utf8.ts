// UTF-8 encoding gate (INTERNATIONALIZATION-STANDARD §4, G1) — merge-blocking.
// Asserts every TRACKED text file is UTF-8 (or its pure-ASCII subset). A file saved in
// a legacy 8-bit encoding (iso-8859-1 / windows-1252) or a UTF-16 BOM would silently
// mangle the Spanish accented characters this bilingual legal surface depends on
// (á é í ó ú ñ ¿ ¡), so the check is fail-closed.
//
// Mechanism mirrors the standard verbatim:
//   git ls-files -z | xargs -0 file --mime-encoding   → assert utf-8 / us-ascii
// Binary blobs (PNG screenshots, the OG card, favicons) legitimately report "binary"
// and are skipped — the gate governs human-language text, not asset bytes. It runs over
// `git ls-files`, i.e. exactly the set CI checks out and ships, and is deterministic.

import { execFileSync } from "node:child_process";
import { pass, fail } from "./util.ts";

const ACCEPTED = new Set(["utf-8", "us-ascii"]);
const SKIP = new Set(["binary"]); // non-text assets: images, fonts, compiled blobs

// Tracked files only — NUL-delimited so paths with spaces/newlines are handled safely.
const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter((f) => f.length > 0);

if (files.length === 0) fail("i18n-utf8", "git ls-files returned no tracked files");

// `file --mime-encoding` emits exactly one line per input file, in input order, as
// `<path><TAB><encoding>`. We match positionally (never re-parse the filename) and
// batch to stay well under ARG_MAX.
function encodingsFor(batch: string[]): string[] {
  const raw = execFileSync("file", ["--mime-encoding", "-F", "\t", "--", ...batch], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const lines = raw.split("\n").filter((l) => l.length > 0);
  if (lines.length !== batch.length) {
    fail("i18n-utf8", `file(1) returned ${lines.length} result(s) for ${batch.length} input file(s)`);
  }
  return lines.map((l) => {
    const tab = l.lastIndexOf("\t");
    return (tab < 0 ? l : l.slice(tab + 1)).trim();
  });
}

const problems: string[] = [];
let checked = 0;
let skipped = 0;
const BATCH = 200;
for (let i = 0; i < files.length; i += BATCH) {
  const batch = files.slice(i, i + BATCH);
  const encs = encodingsFor(batch);
  batch.forEach((path, j) => {
    const enc = encs[j]!;
    if (SKIP.has(enc)) {
      skipped++;
    } else if (ACCEPTED.has(enc)) {
      checked++;
    } else {
      problems.push(`${path}: ${enc} (must be utf-8 or us-ascii)`);
    }
  });
}
problems.sort();

if (problems.length > 0) {
  fail("i18n-utf8", `${problems.length} tracked file(s) not UTF-8/US-ASCII`, problems);
}
pass(
  "i18n-utf8",
  `${checked} tracked text file(s) UTF-8/US-ASCII, ${skipped} binary asset(s) skipped`,
);
