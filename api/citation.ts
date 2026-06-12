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
const FAITH_STOP = new Set([
  "the", "a", "an", "to", "of", "in", "for", "and", "or", "is", "are", "you", "your",
  "with", "that", "this", "will", "can", "may", "by", "on", "at", "it", "be", "do",
  "not", "no", "have", "has", "from", "use",
]);
function contentTokens(s: string): string[] {
  return (s.toLowerCase().match(/[a-z0-9áéíóúüñ]+/gi) ?? []).filter((t) => t.length > 2 && !FAITH_STOP.has(t));
}
/** Precision: is the claim's content supported by the cited record's text? */
function isFaithfulTo(claimText: string, rec: CorpusRecord): boolean {
  const claimToks = contentTokens(claimText);
  if (claimToks.length === 0) return true;
  const recToks = new Set(
    contentTokens(`${rec.topic} ${rec.statement} ${rec.detail ?? ""} ${rec.cost?.note ?? ""} ${rec.timeline?.typical ?? ""} ${rec.timeline?.note ?? ""}`),
  );
  const covered = claimToks.filter((t) => recToks.has(t)).length;
  return covered / claimToks.length >= FAITHFUL_PRECISION;
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
      if (opts.requireFaithful && !isFaithfulTo(block.text, rec)) {
        // The citation is valid but the claim text isn't supported by it (hallucination).
        violations.push({ block, reason: "unfaithful-claim", detail: `${id}: ${block.text.slice(0, 60)}` });
        return false;
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
