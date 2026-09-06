// Guidance orchestration: retrieval → grounded generation → citation enforcement.
// This is the single path every answer takes. There is no way to produce an answer
// that skips retrieval or the citation gate.

import type { GroundedAnswer } from "./types.ts";
import type { RetrievalQuery, Retriever } from "./retrieval.ts";
import type { Generator, AsyncGenerator, GenerateInput } from "./generator.ts";
import { retrieve } from "./retrieval.ts";
import { defaultGenerator } from "./generator.ts";
import { enforce } from "./citation.ts";
import { loadCorpus } from "./corpus.ts";
import { hasNoStateCoverage, hasNoMinorCoverage } from "./checklist.ts";
import { t as locale } from "../src/i18n/index.ts";

/**
 * Federal records match inside every state (api/retrieval.ts `jurisdictionMatches`), so a
 * question asked about a state we have NO records for still retrieves the SSA and passport
 * records and composes a fluent, cited answer out of them. Nothing in that answer says the
 * state layer is missing — the reader cannot tell "we haven't checked your state" apart
 * from "your state adds nothing", and the second reading is the dangerous one.
 *
 * The disclosure is an `uncertainty` block: the category the composer already reserves for
 * what we do not know. It carries no citations because it asserts no rule — it is a fact
 * about this corpus, not about any jurisdiction — which is exactly why citation.enforce()
 * lets it through while it would reject the same sentence phrased as a claim.
 */
function withCoverageDisclosure(answer: GroundedAnswer, query: RetrievalQuery, corpus = loadCorpus()): GroundedAnswer {
  if (!hasNoStateCoverage(query.jurisdiction, corpus)) return answer;
  const text = locale(query.language ?? "en").ui.noStateCoverage;
  return { ...answer, blocks: [{ kind: "uncertainty", citations: [], text }, ...answer.blocks] };
}

/**
 * The minors-pilot twin of `withCoverageDisclosure`, one level narrower. A state can be
 * fully covered for adults (so `withCoverageDisclosure` says nothing) and still have no
 * minor-audience record at all — every state outside the five-state pilot. Retrieval
 * (api/retrieval.ts `selectAudience`) already falls through to the adult records for that
 * jurisdiction rather than returning nothing, so without this the reader could not tell
 * "we checked minors here" from "we have nothing for minors here and you're reading the
 * adult rule" — exactly the failure `withCoverageDisclosure` exists to prevent one level up.
 */
function withMinorCoverageDisclosure(answer: GroundedAnswer, query: RetrievalQuery, corpus = loadCorpus()): GroundedAnswer {
  if (!query.for_minor) return answer;
  if (!hasNoMinorCoverage(query.jurisdiction, corpus)) return answer;
  const text = locale(query.language ?? "en").ui.noMinorCoverage;
  return { ...answer, blocks: [{ kind: "uncertainty", citations: [], text }, ...answer.blocks] };
}

export interface AnswerOptions {
  generator?: Generator;
  /** Pluggable retriever; defaults to the deterministic lexical one (eval-stable). */
  retriever?: Retriever;
  maxRecords?: number;
}

export interface AsyncAnswerOptions {
  generator: AsyncGenerator;
  retriever?: Retriever;
  maxRecords?: number;
}

function buildInput(query: RetrievalQuery, retriever: Retriever, maxRecords?: number): GenerateInput {
  return {
    retrieved: retriever(query, loadCorpus()),
    question: query.question,
    maxRecords,
    language: query.language ?? "en",
  };
}

/** Answer a grounded question. Throws if the generated answer fails the citation gate. */
export function answer(query: RetrievalQuery, opts: AnswerOptions = {}): GroundedAnswer {
  const generator = opts.generator ?? defaultGenerator;
  const draft = generator.generate(buildInput(query, opts.retriever ?? retrieve, opts.maxRecords));
  // Order matters: state coverage (the broader absence) reads first, then the narrower
  // minor-coverage note, then the cited claims themselves.
  const disclosed = withCoverageDisclosure(withMinorCoverageDisclosure(draft, query), query);
  // Post-generation enforcement. A refusal carries no claims, so it passes trivially.
  return enforce(disclosed, loadCorpus(), query.today);
}

/**
 * Async answer path for model-backed generators (e.g. BedrockGenerator). It runs through
 * the IDENTICAL citation.enforce() gate as the sync path — so an ungrounded/hallucinated
 * sentence is rejected, never rendered, regardless of which generator produced it.
 */
export async function answerAsync(query: RetrievalQuery, opts: AsyncAnswerOptions): Promise<GroundedAnswer> {
  const input = buildInput(query, opts.retriever ?? retrieve, opts.maxRecords);
  const draft = await opts.generator.generateAsync(input);
  // Untrusted (model) generator: citations must resolve within the RETRIEVED set and each
  // claim's text must be faithful to its cited record — not merely carry a valid id.
  const grounding = input.retrieved.map((r) => r.record);
  const disclosed = withCoverageDisclosure(withMinorCoverageDisclosure(draft, query), query);
  return enforce(disclosed, loadCorpus(), query.today, { grounding, requireFaithful: true });
}
