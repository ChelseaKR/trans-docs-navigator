// Readability gate (ROADMAP §5: plain language, ~8th-grade target). Computes a
// language-calibrated reading-EASE score (0–100, higher = easier) for every corpus
// record's user-facing prose: Flesch Reading Ease for English, Fernández–Huerta for
// Spanish (the FK grade formula is English-tuned and over-penalizes Spanish, whose
// words simply carry more syllables — so a single formula would be unfair across langs).
//
// Two bars, honestly separated:
//   • HARD FLOOR (merge-blocking): no record may fall below MIN_EASE — that is
//     unreadable-grade prose for this audience.
//   • TARGET (informational): records below TARGET_EASE are surfaced so content can be
//     simplified toward the ~8th-grade aspiration (ease ≈ 60–70) without blocking.

import { loadCorpus } from "../api/corpus.ts";
import type { CorpusRecord, Language } from "../api/types.ts";
import { pass, fail } from "./util.ts";

const TARGET_EASE = 50; // aspiration: simplify toward 60–70 (≈ 8th grade)
const MIN_EASE = 25; // hard floor: below this is unacceptable for the audience

function sentenceCount(text: string): number {
  return Math.max(1, (text.match(/[.!?]+/g) ?? []).length);
}
function wordList(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}
function syllablesEn(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  let groups = (w.match(/[aeiouy]+/g) ?? []).length;
  if (w.endsWith("e") && groups > 1) groups -= 1; // silent final e
  return Math.max(1, groups);
}
function syllablesEs(word: string): number {
  const w = word.toLowerCase().replace(/[^a-záéíóúüñ]/g, "");
  if (!w) return 0;
  return Math.max(1, (w.match(/[aeiouáéíóúü]+/g) ?? []).length); // vowel groups ≈ syllables
}

/** Language-calibrated reading ease (0–100, higher = easier). */
function readingEase(text: string, lang: Language): number {
  const ws = wordList(text);
  if (ws.length === 0) return 100;
  const syl = ws.reduce((n, w) => n + (lang === "es" ? syllablesEs(w) : syllablesEn(w)), 0);
  const wordsPerSentence = ws.length / sentenceCount(text);
  const syllablesPerWord = syl / ws.length;
  return lang === "es"
    ? 206.84 - 60 * syllablesPerWord - 1.02 * wordsPerSentence // Fernández–Huerta
    : 206.835 - 1.015 * wordsPerSentence - 84.6 * syllablesPerWord; // Flesch Reading Ease
}

function prose(rec: CorpusRecord): string {
  return [rec.statement, rec.detail ?? "", rec.cost?.note ?? "", rec.timeline?.note ?? ""].join(" ").trim();
}

const corpus = loadCorpus();
const failures: string[] = [];
const belowTarget: string[] = [];
let worst = 100;

for (const rec of corpus) {
  const ease = readingEase(prose(rec), rec.language);
  worst = Math.min(worst, ease);
  if (ease < MIN_EASE) failures.push(`${rec.id} (${rec.language}): ease ${ease.toFixed(1)} < ${MIN_EASE}`);
  else if (ease < TARGET_EASE) belowTarget.push(`${rec.id}: ease ${ease.toFixed(1)}`);
}

if (belowTarget.length > 0) {
  console.log(`  ℹ️  ${belowTarget.length}/${corpus.length} record(s) below the ease-${TARGET_EASE} target (simplify toward ~8th grade):`);
  for (const o of belowTarget.slice(0, 8)) console.log(`     - ${o}`);
}
if (failures.length > 0) {
  fail("readability", `${failures.length} record(s) below the ease-${MIN_EASE} floor`, failures);
}
pass("readability", `all ${corpus.length} records ≥ ease ${MIN_EASE} (worst ${worst.toFixed(1)}; ${belowTarget.length} below the ease-${TARGET_EASE} target)`);
