// Content gate (data quality §9): every corpus record schema-validates and carries
// a source + named verifier + ISO date. Fails closed on any issue.

import { validateCorpus } from "../api/corpus.ts";
import { validateReferrals } from "../api/referrals.ts";
import { loadCorpus } from "../api/corpus.ts";
import { auditTranslations, declaredUntranslated } from "../api/translations.ts";
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

// Legal-aid/official referrals ride the same verifier gate as the corpus (api/referrals.ts).
// Fail closed here too — a bad referral link must never ship.
const { records: referralCount, issues: referralIssues } = validateReferrals();
if (referralIssues.length > 0) {
  fail(
    "content",
    `${referralIssues.length} referral validation issue(s) across ${referralCount} record(s)`,
    referralIssues.map((i) => `${i.recordId} · ${i.field}: ${i.message}`),
  );
}

// EN/ES linkage (#229 item 1). The pairing is correct today by care alone, and care does
// not fail a build: nothing required an English record to have a Spanish twin, required a
// Spanish record to name a real English canonical, or required the two to agree on the
// facts that are about the rule rather than about the language. A Spanish reader is shown
// a step with the same confidence an English reader gets, so a silent divergence is felt
// by the reader least able to check it.
const corpusDir = process.env.CORPUS_DIR;
const audit = auditTranslations(
  loadCorpus(corpusDir ? { dir: corpusDir } : {}),
  declaredUntranslated(),
);
const linkageProblems = [
  ...audit.issues.map((i) => `${i.recordId} · ${i.field}: ${i.message}`),
  ...audit.undeclaredGaps.map(
    (id) =>
      `${id} · translation: has no Spanish twin and is not listed in ` +
      "corpus/translation-status.json. Either add the translation, or declare the gap " +
      "with a reason so it is a written fact rather than an absence.",
  ),
  ...audit.staleDeclarations.map(
    (id) =>
      `${id} · translation-status: declared untranslated, but a Spanish twin exists. ` +
      "Remove the declaration; a coverage statement that drifts from the corpus is the " +
      "thing this check exists to stop.",
  ),
];
if (linkageProblems.length > 0) {
  fail("content", `${linkageProblems.length} EN/ES linkage issue(s)`, linkageProblems);
}
if (audit.declaredGaps.length > 0) {
  console.log(
    `  ℹ️  ${audit.declaredGaps.length} English record(s) are declared untranslated in ` +
      "corpus/translation-status.json — a stated gap, not a silent one.",
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
pass(
  "content",
  `${records} corpus records + ${referralCount} referral records valid (source + verifier in roster + date present); ` +
    `${audit.links.length} EN/ES record pairs linked and consistent, ${audit.declaredGaps.length} gap(s) declared`,
);
