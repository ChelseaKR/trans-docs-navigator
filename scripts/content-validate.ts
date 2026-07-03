// Content gate (data quality §9): every corpus record schema-validates and carries
// a source + named verifier + ISO date. Fails closed on any issue.

import { validateCorpus } from "../api/corpus.ts";
import { pass, fail } from "./util.ts";

// Test-only override (tests/gate-efficacy): point the gate at a poisoned corpus
// directory instead of corpus/jurisdictions/. validateCorpus() already defaults to
// the real CORPUS_DIR when the argument is undefined, so production behavior is
// unchanged whenever CORPUS_DIR is unset.
const { records, issues, placeholderVerified } = validateCorpus(process.env.CORPUS_DIR);

if (issues.length > 0) {
  fail(
    "content",
    `${issues.length} validation issue(s) across ${records} record(s)`,
    issues.map((i) => `${i.recordId} · ${i.field}: ${i.message}`),
  );
}

// Honest-confidence: surface (don't hide) that the corpus is still seed-verified.
// This is informational, not a failure — ADR-3 makes seed verification an explicit,
// currently-OPEN review-gate. The number must reach 0 (real named verifiers) before launch.
if (placeholderVerified > 0) {
  console.log(
    `  ℹ️  ${placeholderVerified}/${records} record(s) carry a PLACEHOLDER verifier (ADR-3) — ` +
      `mechanically valid but NOT launch-cleared. Replace with named human verifiers before launch.`,
  );
}
pass("content", `${records} corpus records valid (source + verifier in roster + date present)`);
