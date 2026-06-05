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
  // Post-generation enforcement. A refusal carries no claims, so it passes trivially.
  return enforce(draft, loadCorpus(), query.today);
}

/**
 * Async answer path for model-backed generators (e.g. BedrockGenerator). It runs through
 * the IDENTICAL citation.enforce() gate as the sync path — so an ungrounded/hallucinated
 * sentence is rejected, never rendered, regardless of which generator produced it.
 */
export async function answerAsync(query: RetrievalQuery, opts: AsyncAnswerOptions): Promise<GroundedAnswer> {
  const draft = await opts.generator.generateAsync(buildInput(query, opts.retriever ?? retrieve, opts.maxRecords));
  return enforce(draft, loadCorpus(), query.today);
}
