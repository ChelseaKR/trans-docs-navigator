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
  reason: "uncited-claim" | "unresolved-citation" | "stale-citation";
  detail: string;
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
 * Independently audit an answer's citations against the corpus. Used both at
 * runtime (before render) and by the citation-coverage CI gate.
 */
export function checkCoverage(
  answer: GroundedAnswer,
  corpus: CorpusRecord[],
  today?: string,
): CoverageReport {
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
      const rec = resolvable(id, corpus);
      if (!rec) {
        violations.push({ block, reason: "unresolved-citation", detail: id });
        return false;
      }
      if (!isCurrent(rec, today)) {
        // A claim block must never be backed solely by a stale record.
        violations.push({ block, reason: "stale-citation", detail: id });
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
 * Reject an answer that contains any uncited/unsupported claim. Returns the answer
 * unchanged when coverage is 100%, throws otherwise. This is the post-generation
 * check ROADMAP §6 requires.
 */
export function enforce(answer: GroundedAnswer, corpus: CorpusRecord[], today?: string): GroundedAnswer {
  const report = checkCoverage(answer, corpus, today);
  if (report.coverage < 1) {
    const why = report.violations.map((v) => `${v.reason}: ${v.detail}`).join("; ");
    throw new Error(
      `Citation coverage ${(report.coverage * 100).toFixed(1)}% < 100% — answer rejected. ${why}`,
    );
  }
  return answer;
}
