// Citation enforcement — guardrail #1: "No claim without a citation."
// Every substantive claim must resolve to a loaded, current corpus record, or the
// answer is rejected before it can render. Citation coverage is merge-blocking
// (QUALITY-AND-METRICS-STANDARD §7) and checked at runtime on every answer.

import type { GroundedAnswer, AnswerBlock, CorpusRecord } from "./types.ts";
import { isCurrent } from "./freshness.ts";

/** Persistent, unmissable disclosure strings (guardrail #2 + audit §D). */
export const DISCLOSURE = {
  notLegalAdvice: "Information, not legal advice.",
  aiAssisted: "AI-assisted, grounded in cited sources.",
} as const;

export interface CitationViolation {
  block: AnswerBlock;
  reason: "uncited-claim" | "unresolved-citation" | "stale-citation" | "unfaithful-claim";
  detail: string;
}

export interface CoverageOptions {
  /**
   * Resolve citations against THIS set instead of the whole corpus. For an untrusted
   * (model) generator this MUST be the retrieved/grounding set, so a model can't cite a
   * real-but-off-topic record from another jurisdiction (defense against mis-grounding).
   */
  grounding?: CorpusRecord[];
  /**
   * Also require each claim's TEXT to be supported by its cited record (not just that the
   * citation id is valid). Catches a model that fabricates a sentence and tags it with a
   * real, current id. The deterministic composer is faithful by construction, so it does
   * not set this.
   */
  requireFaithful?: boolean;
}

/**
 * Minimum fraction of a claim's content tokens that must appear in the cited record.
 * A deliberately conservative gate for the untrusted model path: a faithful, grounded
 * claim shares most of its vocabulary with its source (≥0.8 in practice), while a
 * fabrication that merely borrows a few domain words (e.g. "california/name/change")
 * falls below this. Tuned to reject known fabrication probes while passing the
 * extractive/grounded outputs. (Block-level precision; an attacker appending a tiny
 * fabrication to a long faithful claim is a known residual — see docs/IMPROVEMENT-PLAN-2.md.)
 */
const FAITHFUL_PRECISION = 0.6;
// "not"/"no" stay here (generic function words for bag-of-words purposes) and are joined
// by the rest of the negation vocabulary ("never", "without", "cannot", and the split
// halves of "don't"/"doesn't" — the tokenizer below drops apostrophes) so none of these
// polarity-bearing particles are mistaken for a "governing stem" in the polarity check.
const FAITH_STOP = new Set([
  "the", "a", "an", "to", "of", "in", "for", "and", "or", "is", "are", "you", "your",
  "with", "that", "this", "will", "can", "may", "by", "on", "at", "it", "be", "do",
  "not", "no", "have", "has", "from", "use",
  "never", "without", "cannot", "dont", "doesnt", "don", "doesn",
]);
function contentTokens(s: string): string[] {
  return (s.toLowerCase().match(/[a-z0-9áéíóúüñ]+/gi) ?? []).filter((t) => t.length > 2 && !FAITH_STOP.has(t));
}
function recordText(rec: CorpusRecord): string {
  return `${rec.topic} ${rec.statement} ${rec.detail ?? ""} ${rec.cost?.note ?? ""} ${rec.timeline?.typical ?? ""} ${rec.timeline?.note ?? ""}`;
}
/** Precision: is the claim's content supported by the cited record's text? */
function isFaithfulTo(claimText: string, rec: CorpusRecord): boolean {
  const claimToks = contentTokens(claimText);
  if (claimToks.length === 0) return true;
  const recToks = new Set(contentTokens(recordText(rec)));
  const covered = claimToks.filter((t) => recToks.has(t)).length;
  return covered / claimToks.length >= FAITHFUL_PRECISION;
}

// ── Deterministic invariants ────────────────────────────────────────────────────────
// A bag-of-words precision check alone is fooled by a claim that reuses the record's
// vocabulary but flips a number, an official form id, or a negation — the residual gap
// this module closes (FIX-04). Each invariant below is intentionally narrow (few, sharp
// regexes; only fires when claim and record share a comparable literal/stem) to avoid
// rejecting legitimate paraphrase.

/** Normalize a numeric/money literal for comparison: strip $, commas, whitespace. */
function normalizeNumber(raw: string): string {
  return raw.replace(/[$,\s]/g, "");
}
const MONEY_RE = /\$\s?\d[\d,]*(?:\.\d+)?/g;
const NUMBER_RE = /\b\d[\d,]*(?:\.\d+)?\b/g;
const ISO_DATE_RE = /\b\d{4}-\d{2}-\d{2}\b/g;
const MONTH_DATE_RE =
  /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{2,4}\b/gi;

/** Extract every numeric/money/date literal from `text`, normalized for comparison. */
function extractLiterals(text: string): string[] {
  const out: string[] = [];
  for (const re of [MONEY_RE, NUMBER_RE, ISO_DATE_RE, MONTH_DATE_RE]) {
    for (const m of text.matchAll(re)) out.push(normalizeNumber(m[0].toLowerCase()));
  }
  return out;
}

/**
 * (a) Numeric/dollar/date literals: every literal in the claim must appear (normalized)
 * among the record's literals. Catches a fee/date/quantity mutation riding on otherwise
 * faithful, on-topic vocabulary (e.g. "$50" swapped in for the record's "$435–$480").
 */
function numericLiteralsMatch(claimText: string, rec: CorpusRecord): boolean {
  const claimLits = extractLiterals(claimText);
  if (claimLits.length === 0) return true;
  const recLits = new Set(extractLiterals(recordText(rec)));
  return claimLits.every((l) => recLits.has(l));
}

/** Normalize a form id by upper-casing and collapsing the letter/number separator. */
function normalizeFormId(letters: string, digits: string): string {
  return `${letters.toUpperCase()}${digits}`;
}
const FORM_ID_RE = /\b([A-Z]{1,4})[- ]?(\d{2,4})\b/g;

/** Extract every form id in `text`, normalized (e.g. "NC-100" / "NC 100" → "NC100"). */
function extractFormIds(text: string): string[] {
  return [...text.matchAll(FORM_ID_RE)].map((m) => normalizeFormId(m[1]!, m[2]!));
}

/**
 * (b) Form identifiers: every official form id the claim cites (e.g. "NC-100", "DL 329")
 * must have a matching normalized id in the cited record. Catches a form swap (citing the
 * right record but naming the wrong form).
 */
function formIdsMatch(claimText: string, rec: CorpusRecord): boolean {
  const claimIds = extractFormIds(claimText);
  if (claimIds.length === 0) return true;
  const recIds = new Set(extractFormIds(recordText(rec)));
  return claimIds.every((id) => recIds.has(id));
}

// (c) Polarity: does the claim negate (or un-negate) something the record states the
// opposite way, on a stem the two texts share? Deliberately narrow — it only compares
// negation-particle presence around a SHARED content word, so it doesn't fire on claims
// that merely discuss an unrelated negated detail elsewhere in the record.
const NEGATIONS = new Set(["not", "no", "never", "without", "cannot", "dont", "doesnt"]);
const NEGATION_WINDOW = 6;

/**
 * Lowercased word tokens (apostrophes stripped so "don't" → "dont"), split into clauses
 * on sentence/clause punctuation so a negation in one clause can't "reach" a stem in another.
 *
 * The COMMA is a clause boundary here, and it has to be. Without it, negation scope bleeds
 * across a subordinate clause and this invariant rejects a faithful paraphrase purely for
 * reordering it: in "If you cannot afford it, you can ask the court to waive it", the stem
 * "ask" sits 5 tokens after "cannot" and is scored NEGATED, while in the identical claim
 * "You can ask the court to waive it if you cannot afford it" it is AFFIRMED — a clean
 * "polarity flip" between two sentences that mean exactly the same thing. That fires on the
 * live model path (`requireFaithful`), where the cost is a 500 on a correct answer. Narrowing
 * negation to its own clause is what the invariant already claims to do ("deliberately
 * narrow ... so it doesn't fire on claims that merely discuss an unrelated negated detail");
 * a real flip ("you do not need a court order" → "you need a court order") is inside one
 * clause and is still caught — tests/citation.test.ts pins both directions.
 */
function clauseTokens(text: string): string[][] {
  return text
    .toLowerCase()
    .split(/[.;:!?,]+/)
    .map((c) => c.replace(/[’']/g, "").match(/[a-z0-9]+/g) ?? [])
    .filter((toks) => toks.length > 0);
}
/** Is there a negation particle within NEGATION_WINDOW tokens before index `idx` (same clause)? */
function isNegatedAt(toks: string[], idx: number): boolean {
  const start = Math.max(0, idx - NEGATION_WINDOW);
  for (let i = start; i < idx; i++) {
    if (NEGATIONS.has(toks[i]!)) return true;
  }
  return false;
}
/** For each content stem in `clauses`, record whether every occurrence is negated / not-negated. */
function stemPolarity(clauses: string[][]): Map<string, { negated: boolean; affirmed: boolean }> {
  const out = new Map<string, { negated: boolean; affirmed: boolean }>();
  for (const toks of clauses) {
    for (let i = 0; i < toks.length; i++) {
      const w = toks[i]!;
      if (w.length <= 2 || FAITH_STOP.has(w)) continue;
      const neg = isNegatedAt(toks, i);
      const cur = out.get(w) ?? { negated: false, affirmed: false };
      if (neg) cur.negated = true;
      else cur.affirmed = true;
      out.set(w, cur);
    }
  }
  return out;
}

/**
 * Returns the offending stem if the claim asserts the opposite polarity of the record on
 * a shared content word (claim negates it while EVERY record occurrence is affirmative,
 * or vice-versa); null when polarity is consistent (or the stem isn't shared).
 */
function polarityFlip(claimText: string, rec: CorpusRecord): string | null {
  const claimStems = stemPolarity(clauseTokens(claimText));
  const recStems = stemPolarity(clauseTokens(recordText(rec)));
  for (const [stem, claimPol] of claimStems) {
    const recPol = recStems.get(stem);
    if (!recPol) continue; // not a shared stem — not this invariant's concern
    // Flag only a clean flip: claim is exclusively one polarity, record is exclusively
    // the other. Ambiguous (record states it both ways) never fires.
    const claimNeg = claimPol.negated && !claimPol.affirmed;
    const claimAff = claimPol.affirmed && !claimPol.negated;
    const recNeg = recPol.negated && !recPol.affirmed;
    const recAff = recPol.affirmed && !recPol.negated;
    if ((claimNeg && recAff) || (claimAff && recNeg)) return stem;
  }
  return null;
}

export interface CoverageReport {
  /** substantive claims that carry at least one valid, current citation. */
  cited: number;
  /** total substantive claims. */
  claims: number;
  /** cited / claims; 1 when there are no claims. */
  coverage: number;
  violations: CitationViolation[];
}

function resolvable(id: string, corpus: CorpusRecord[]): CorpusRecord | undefined {
  return corpus.find((r) => r.id === id);
}

/**
 * Independently audit an answer's citations. Used at runtime (before render) and by the
 * citation-coverage CI gate. With `opts.grounding`/`opts.requireFaithful` (the model
 * path) it additionally rejects off-grounding citations and claims whose text isn't
 * supported by the cited record.
 */
export function checkCoverage(
  answer: GroundedAnswer,
  corpus: CorpusRecord[],
  today?: string,
  opts: CoverageOptions = {},
): CoverageReport {
  const resolveSet = opts.grounding ?? corpus;
  const violations: CitationViolation[] = [];
  let claims = 0;
  let cited = 0;

  for (const block of answer.blocks) {
    if (block.kind !== "claim") continue; // boilerplate/uncertainty/refusal/freshness aren't factual claims
    claims++;
    if (block.citations.length === 0) {
      violations.push({ block, reason: "uncited-claim", detail: block.text.slice(0, 80) });
      continue;
    }
    const valid = block.citations.filter((id) => {
      const rec = resolvable(id, resolveSet);
      if (!rec) {
        // Not in the grounding set (model path) or not in the corpus at all.
        violations.push({ block, reason: "unresolved-citation", detail: id });
        return false;
      }
      if (!isCurrent(rec, today)) {
        // A claim block must never be backed by a stale record.
        violations.push({ block, reason: "stale-citation", detail: id });
        return false;
      }
      if (opts.requireFaithful) {
        // Deterministic invariants first (cheap, sharp rejections of drift that a
        // bag-of-words check would miss because the vocabulary otherwise overlaps).
        if (!numericLiteralsMatch(block.text, rec)) {
          violations.push({
            block,
            reason: "unfaithful-claim",
            detail: `${id}: quantity/date drift — ${block.text.slice(0, 60)}`,
          });
          return false;
        }
        if (!formIdsMatch(block.text, rec)) {
          violations.push({
            block,
            reason: "unfaithful-claim",
            detail: `${id}: form-id drift — ${block.text.slice(0, 60)}`,
          });
          return false;
        }
        const flipped = polarityFlip(block.text, rec);
        if (flipped) {
          violations.push({
            block,
            reason: "unfaithful-claim",
            detail: `${id}: polarity drift on "${flipped}" — ${block.text.slice(0, 60)}`,
          });
          return false;
        }
        if (!isFaithfulTo(block.text, rec)) {
          // The citation is valid but the claim text isn't supported by it (hallucination).
          violations.push({ block, reason: "unfaithful-claim", detail: `${id}: ${block.text.slice(0, 60)}` });
          return false;
        }
      }
      return true;
    });
    if (valid.length > 0) cited++;
  }

  const coverage = claims === 0 ? 1 : cited / claims;
  return { cited, claims, coverage, violations };
}

/**
 * Reject an answer that contains any uncited/unsupported/mis-cited claim. Returns the
 * answer unchanged when coverage is 100% AND there are no violations at all, throws
 * otherwise. Failing on ANY violation (not just the coverage ratio) means a claim can't
 * smuggle a stale/unfaithful citation alongside a valid one. This is the post-generation
 * check ROADMAP §6 requires — the safety property holds for any generator.
 */
export function enforce(
  answer: GroundedAnswer,
  corpus: CorpusRecord[],
  today?: string,
  opts: CoverageOptions = {},
): GroundedAnswer {
  const report = checkCoverage(answer, corpus, today, opts);
  if (report.coverage < 1 || report.violations.length > 0) {
    const why = report.violations.map((v) => `${v.reason}: ${v.detail}`).join("; ");
    throw new Error(
      `Citation check failed (coverage ${(report.coverage * 100).toFixed(1)}%, ${report.violations.length} violation(s)) — answer rejected. ${why}`,
    );
  }
  return answer;
}
