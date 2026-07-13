// Offline faithfulness support for the deterministic eval lane.
//
// The production model path already rejects unsupported output in api/citation.ts.
// This module independently measures the eval answers at atomic-assertion granularity:
// the exact record-derived text made available to the composer is the support boundary,
// and every sentence/clause must clear that boundary. It intentionally has no
// "short/scaffolding" exemption: a two-token claim such as "cost: free" can be harmful.

import type { CorpusRecord } from "../api/types.ts";
import { t as locale } from "../src/i18n/index.ts";

export interface FaithfulnessResult {
  entailed: boolean;
  score: number;
  reason: string;
}

/** Synchronous seam for the deterministic lane; a networked judge belongs in eval-bedrock. */
export interface FaithfulnessJudge {
  judge(claim: string, sources: string[]): FaithfulnessResult;
}

/** Cheap lexical pre-filter; the stricter deterministic judge runs after this. */
export const PREFILTER_SUPPORT = 0.6;
/** Conservative claim-token support required by the default offline judge. */
export const DETERMINISTIC_SUPPORT = 0.8;

const STOP_WORDS = new Set([
  "the", "a", "an", "to", "of", "in", "for", "and", "or", "is", "are", "you", "your",
  "with", "that", "this", "will", "can", "may", "by", "on", "at", "it", "be", "do",
  "not", "no", "have", "has", "from", "use", "el", "la", "los", "las", "un", "una",
  "de", "del", "en", "para", "por", "con", "que", "se", "su", "sus", "es", "son",
  "puede", "como", "al", "never", "without", "cannot", "dont", "doesnt", "sin",
]);

/** Normalize to content-bearing words while retaining every numeric token, including 0. */
export function contentTokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9áéíóúüñ]+/gi) ?? []).filter(
    (token) => /^\d+$/.test(token) || (token.length > 2 && !STOP_WORDS.has(token)),
  );
}

const sentenceSegmenter = new Intl.Segmenter(undefined, { granularity: "sentence" });

/**
 * Split into atomic sentence/clause assertions without breaking U.S. abbreviations or
 * decimal amounts. Semicolons and line breaks are explicit clause boundaries.
 */
export function decomposeClaim(text: string): string[] {
  const assertions: string[] = [];
  for (const clause of text.split(/[;\n]+/)) {
    for (const part of sentenceSegmenter.segment(clause)) {
      const clean = part.segment.trim().replace(/[.!?]+$/u, "").trim();
      if (clean.length > 0) assertions.push(clean);
    }
  }
  return assertions;
}

function supportScore(claim: string, source: string): number {
  const needed = contentTokens(claim);
  if (needed.length === 0) return 0;
  const available = new Set(contentTokens(source));
  return needed.filter((token) => available.has(token)).length / needed.length;
}

/** Fast reject before judge work; accepts exact extracts or coarse lexical support. */
export function deterministicPrefilter(claim: string, sources: string[]): boolean {
  const normalizedClaim = claim.trim().toLowerCase();
  if (normalizedClaim.length === 0) return false;
  return sources.some((source) => {
    const normalizedSource = source.trim().toLowerCase();
    return normalizedSource.includes(normalizedClaim) || supportScore(claim, source) >= PREFILTER_SUPPORT;
  });
}

function normalizeLiteral(raw: string): string {
  return raw.replace(/[$,\s]/g, "").toLowerCase();
}

const MONEY_RE = /\$\s?\d[\d,]*(?:\.\d+)?/g;
const NUMBER_RE = /\b\d[\d,]*(?:\.\d+)?\b/g;
const ISO_DATE_RE = /\b\d{4}-\d{2}-\d{2}\b/g;
const FORM_ID_RE = /\b([a-z]{1,4})[- ]?(\d{2,4})\b/gi;

function numericLiterals(text: string): string[] {
  const values = new Set<string>();
  for (const expression of [MONEY_RE, NUMBER_RE, ISO_DATE_RE]) {
    for (const match of text.matchAll(expression)) values.add(normalizeLiteral(match[0]));
  }
  return [...values];
}

function formIds(text: string): string[] {
  return [...text.matchAll(FORM_ID_RE)].map((match) => `${match[1]!.toUpperCase()}${match[2]!}`);
}

const NEGATIONS = new Set(["not", "no", "never", "without", "cannot", "dont", "doesnt", "sin"]);
const NEGATION_WINDOW = 6;

function words(text: string): string[] {
  return (text.toLowerCase().replace(/[’']/g, "").match(/[a-z0-9áéíóúüñ]+/gi) ?? []);
}

function negatedAt(tokens: string[], index: number): boolean {
  for (let cursor = Math.max(0, index - NEGATION_WINDOW); cursor < index; cursor++) {
    if (NEGATIONS.has(tokens[cursor]!)) return true;
  }
  return false;
}

function polarityByStem(text: string): Map<string, { affirmed: boolean; negated: boolean }> {
  const tokens = words(text);
  const result = new Map<string, { affirmed: boolean; negated: boolean }>();
  for (let index = 0; index < tokens.length; index++) {
    const stem = tokens[index]!;
    if (!contentTokens(stem).includes(stem)) continue;
    const current = result.get(stem) ?? { affirmed: false, negated: false };
    if (negatedAt(tokens, index)) current.negated = true;
    else current.affirmed = true;
    result.set(stem, current);
  }
  return result;
}

function polarityFlips(claim: string, source: string): boolean {
  const claimPolarity = polarityByStem(claim);
  const sourcePolarity = polarityByStem(source);
  for (const [stem, claimState] of claimPolarity) {
    const sourceState = sourcePolarity.get(stem);
    if (!sourceState) continue;
    const claimOnlyNegated = claimState.negated && !claimState.affirmed;
    const claimOnlyAffirmed = claimState.affirmed && !claimState.negated;
    const sourceOnlyNegated = sourceState.negated && !sourceState.affirmed;
    const sourceOnlyAffirmed = sourceState.affirmed && !sourceState.negated;
    if ((claimOnlyNegated && sourceOnlyAffirmed) || (claimOnlyAffirmed && sourceOnlyNegated)) return true;
  }
  return false;
}

/** Text the deterministic composer is authorized to derive from this record. */
export function recordSupportSources(record: CorpusRecord): string[] {
  const messages = locale(record.language).generator;
  const raw = [record.statement, record.detail];
  if (record.cost) {
    raw.push(
      record.cost.amount_usd === null
        ? messages.costVaries(record.cost.note)
        : messages.costAbout(record.cost.amount_usd, record.cost.fee_waiver === true),
    );
  }
  if (record.timeline) raw.push(messages.timeline(record.timeline.typical, record.timeline.note));
  return raw
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .flatMap((value) => decomposeClaim(value));
}

/**
 * Offline, deterministic support judge. Numeric and form identifiers must occur in
 * the authorized source set, then the best lexical source must meet the conservative
 * threshold without reversing scoped negation.
 */
export class DeterministicSupportJudge implements FaithfulnessJudge {
  judge(claim: string, sources: string[]): FaithfulnessResult {
    const claimNumbers = numericLiterals(claim);
    const supportedNumbers = new Set(sources.flatMap((source) => numericLiterals(source)));
    if (claimNumbers.some((literal) => !supportedNumbers.has(literal))) {
      return { entailed: false, score: 0, reason: "unsupported numeric/date literal" };
    }

    const claimForms = formIds(claim);
    const supportedForms = new Set(sources.flatMap((source) => formIds(source)));
    if (claimForms.some((form) => !supportedForms.has(form))) {
      return { entailed: false, score: 0, reason: "unsupported form identifier" };
    }

    let bestScore = 0;
    let bestSource = "";
    for (const source of sources) {
      const score = supportScore(claim, source);
      if (score > bestScore) {
        bestScore = score;
        bestSource = source;
      }
    }
    if (bestScore < DETERMINISTIC_SUPPORT) {
      return {
        entailed: false,
        score: bestScore,
        reason: `insufficient atomic-claim support (${(bestScore * 100).toFixed(0)}%)`,
      };
    }
    if (polarityFlips(claim, bestSource)) {
      return { entailed: false, score: bestScore, reason: "scoped negation/polarity mismatch" };
    }
    return {
      entailed: true,
      score: bestScore,
      reason: `atomically supported (${(bestScore * 100).toFixed(0)}%)`,
    };
  }
}

export const defaultJudge: FaithfulnessJudge = new DeterministicSupportJudge();

/** Every atomic assertion in a claim must be supported; there is no short-claim bypass. */
export function claimIsFaithful(
  claimText: string,
  record: CorpusRecord,
  judge: FaithfulnessJudge = defaultJudge,
): boolean {
  const sources = recordSupportSources(record);
  const assertions = decomposeClaim(claimText);
  if (assertions.length === 0) return false;
  return assertions.every((assertion) =>
    deterministicPrefilter(assertion, sources) && judge.judge(assertion, sources).entailed,
  );
}
