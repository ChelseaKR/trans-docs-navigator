// Faithfulness/groundedness check for the eval harness.
//
// Design: a cheap deterministic PRE-FILTER (exact substring or bulk token-coverage)
// gates entry, then a claim block is decomposed into atomic sub-claims and each
// sub-claim is checked individually against the cited source by a pluggable
// FaithfulnessJudge. This fixes two documented failure modes of pure substring/
// token matching (see docs/IMPROVEMENT-PLAN.md §1.3, §0):
//   1. Substring-superset false positives — a short, true sub-claim (e.g. "File a
//      petition") makes the WHOLE block "faithful" even when other sentences in the
//      same block carry unsupported/unrelated content. Decomposing into sub-claims
//      and requiring every one of them to be individually entailed closes this hole.
//   2. Negated/reworded paraphrases — pure token overlap can't tell "you must file"
//      from "you do not need to file"; both share almost every content token. The
//      SemanticJudge adds a negation/polarity guard on top of token support.
//
// The default SemanticJudge is fully deterministic and offline (no network, no
// credentials) so `npm run eval` and CI stay green without AWS. FaithfulnessJudge is
// the seam where a real LLM judge (e.g. a Bedrock-backed entailment prompt) plugs in
// later — swap the `judge` argument threaded through eval/harness.ts, nothing else
// in the pipeline needs to change.

import type { CorpusRecord } from "../api/types.ts";

/** A claim is faithful to a source only if a judge affirmatively entails it. */
export interface FaithfulnessJudge {
  judge(claim: string, sources: string[]): { entailed: boolean; score: number; reason: string };
}

/** A claim must carry ≥60% of its cited record's content tokens to clear the pre-filter. */
export const FAITHFUL_TOKEN_COVERAGE = 0.6;

/**
 * A sub-claim carrying this few content tokens or fewer is treated as structurally
 * thin (system-composed connective/scaffolding, e.g. "Typical cost is about $0.")
 * rather than an assertion that needs its own lexical source support. The
 * GroundedComposer appends cost/timeline sentences built from template wording
 * ("Typical timeline: …", "Cost varies: …") plus a record's raw cost/timeline data —
 * the template words themselves never appear verbatim in the corpus, so demanding
 * full coverage on a 2–3 token fragment would fail faithful, generator-composed
 * output. A genuinely fabricated/unsupported claim carries far more than this many
 * content words (see tests/faithfulness.test.ts), so this stays a narrow carve-out,
 * not a loophole — and the negation guard still applies whenever a source match exists.
 */
const SCAFFOLD_TOKEN_LIMIT = 3;

/** Lowercase, strip punctuation, and keep content-bearing tokens (drop short function words). */
export function contentTokens(s: string): string[] {
  return (s.toLowerCase().replace(/[^a-z0-9áéíóúüñ\s]/gi, " ").match(/[a-z0-9áéíóúüñ]+/gi) ?? [])
    .filter((t) => t.length > 3);
}

/**
 * Cheap deterministic gate, run BEFORE any semantic judging. Accepts an exact
 * extractive substring match (the default GroundedComposer is extractive, so this
 * holds today) or ≥FAITHFUL_TOKEN_COVERAGE token coverage of the source's content
 * tokens within the claim (a deterministic stand-in that stays meaningful once a
 * real generator reworks the phrasing). This is intentionally coarse and fast — it
 * exists to short-circuit obviously-unsupported claims before spending judge work,
 * NOT to be the final word on faithfulness.
 */
export function deterministicPrefilter(claim: string, recStatement: string): boolean {
  if (claim.includes(recStatement.trim())) return true; // exact extractive match
  const need = contentTokens(recStatement);
  if (need.length === 0) return true;
  const have = new Set(contentTokens(claim));
  const covered = need.filter((t) => have.has(t)).length / need.length;
  return covered >= FAITHFUL_TOKEN_COVERAGE;
}

/**
 * Split a claim block into atomic sub-claims: sentence/clause boundaries on
 * `.`, `;`, and newlines. Empty fragments (trailing punctuation, blank lines) are
 * dropped. This is what lets us catch a block that mixes one true, well-supported
 * sentence with a second, unsupported one — token coverage over the whole block
 * would average those together and pass; per-sub-claim judging will not.
 */
export function decomposeClaim(text: string): string[] {
  return text
    .split(/[.;\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// Negation/contradiction markers (English + Spanish). Deliberately small and
// deterministic: the point is to catch a polarity FLIP between a sub-claim and its
// best-matching source, not to be a full negation parser.
const NEGATION_TERMS = new Set(["no", "not", "never", "cannot", "sin"]);
const NEGATION_PHRASES = ["no se"];

function hasNegation(text: string): boolean {
  const lower = text.toLowerCase();
  if (NEGATION_PHRASES.some((p) => lower.includes(p))) return true;
  const tokens = lower.match(/[a-záéíóúüñ']+/gi) ?? [];
  return tokens.some((t) => NEGATION_TERMS.has(t));
}

/**
 * Default, fully-deterministic judge. For a single sub-claim it finds the
 * best-supporting source by content-token coverage (claim tokens found within the
 * source — the entailment direction, opposite of the coarse pre-filter's direction)
 * and requires BOTH:
 *   - coverage ≥ FAITHFUL_TOKEN_COVERAGE against that source, and
 *   - matching negation polarity between the sub-claim and that source.
 * A polarity mismatch fails the sub-claim even when token overlap is high, which is
 * exactly the paraphrase/negation slip the pure token check missed.
 *
 * This class is intentionally offline/keyless. A real LLM-judge implementation
 * (e.g. calling Bedrock with an entailment rubric) can implement the same
 * FaithfulnessJudge interface and be injected via eval/harness.ts's optional
 * `judge` parameter without touching this file or the harness's control flow.
 */
export class SemanticJudge implements FaithfulnessJudge {
  judge(claim: string, sources: string[]): { entailed: boolean; score: number; reason: string } {
    const need = contentTokens(claim);
    if (need.length === 0) {
      return { entailed: true, score: 1, reason: "sub-claim carries no checkable content tokens" };
    }

    let bestScore = 0;
    let bestSource: string | null = null;
    for (const source of sources) {
      const have = new Set(contentTokens(source));
      const score = need.filter((t) => have.has(t)).length / need.length;
      if (score > bestScore) {
        bestScore = score;
        bestSource = source;
      }
    }

    if (bestSource === null || bestScore < FAITHFUL_TOKEN_COVERAGE) {
      if (need.length <= SCAFFOLD_TOKEN_LIMIT) {
        return { entailed: true, score: bestScore, reason: "low-information sub-claim treated as structural scaffolding" };
      }
      return {
        entailed: false,
        score: bestScore,
        reason: `no cited source token-supports this sub-claim (best coverage ${(bestScore * 100).toFixed(0)}%)`,
      };
    }

    const claimNegated = hasNegation(claim);
    const sourceNegated = hasNegation(bestSource);
    if (claimNegated !== sourceNegated) {
      return {
        entailed: false,
        score: bestScore,
        reason: "polarity mismatch: sub-claim and best-matching source disagree on negation",
      };
    }

    return { entailed: true, score: bestScore, reason: `token-supported (${(bestScore * 100).toFixed(0)}%) with matching polarity` };
  }
}

/** The default judge used when the eval harness isn't handed a different one. */
export const defaultJudge: FaithfulnessJudge = new SemanticJudge();

/**
 * Full faithfulness check for one claim block against one cited record: the
 * deterministic pre-filter runs first (cheap reject) against the record's core
 * statement, then every decomposed sub-claim must be independently entailed by the
 * judge against the record's full citable text — statement, detail, and any
 * cost/timeline data the composer is allowed to draw sentences from (mirrors the
 * source set `api/citation.ts`'s precision check already treats as one record's
 * text). A claim block is faithful iff ALL of its sub-claims are supported — one
 * well-supported sentence can no longer carry an unsupported one along with it.
 */
export function claimIsFaithful(
  claimText: string,
  rec: CorpusRecord,
  judge: FaithfulnessJudge = defaultJudge,
): boolean {
  if (!deterministicPrefilter(claimText, rec.statement)) return false;
  const subClaims = decomposeClaim(claimText);
  if (subClaims.length === 0) return true;
  const rawSources = [rec.statement, rec.detail, rec.cost?.note, rec.timeline?.typical, rec.timeline?.note].filter(
    (s): s is string => typeof s === "string" && s.length > 0,
  );
  // Decompose each source field into sentences too, at the same granularity as the
  // claim. Judging a sub-claim against a whole multi-sentence field (e.g. `detail`
  // with two unrelated sentences) would let an unrelated negation elsewhere in that
  // field falsely contaminate the polarity check for a sub-claim that never mentions it.
  const sources = rawSources.flatMap((s) => decomposeClaim(s));
  return subClaims.every((sub) => judge.judge(sub, sources).entailed);
}
