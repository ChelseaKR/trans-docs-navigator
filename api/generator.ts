// Grounded generation. The model only ever speaks from retrieved, cited corpus
// chunks (ROADMAP §6, ADR-1). Every substantive sentence carries a citation; the
// output is always passed through citation.enforce() before it can render.
//
// `GroundedComposer` is the default deterministic implementation — extractive
// composition from retrieved records. It is faithful by construction (a claim's
// text derives from its cited record) and makes the eval reproducible.
//
// `BedrockGenerator` is the production seam: it would call Claude on AWS Bedrock
// with a retrieval-grounded prompt, but its output is subject to the IDENTICAL
// post-generation enforcement, so an ungrounded sentence can never render.

import type { GroundedAnswer, AnswerBlock, CorpusRecord, Cost, Timeline, Language } from "./types.ts";
import type { Retrieved } from "./retrieval.ts";
import type { GeneratorMessages } from "../src/i18n/index.ts";
import { t as locale } from "../src/i18n/index.ts";

export interface GenerateInput {
  retrieved: Retrieved[];
  question?: string | undefined;
  maxRecords?: number | undefined;
  /** Language for the system-composed scaffolding (intro/cost/timeline/refusal/disclosure). */
  language?: Language;
}

export interface Generator {
  generate(input: GenerateInput): GroundedAnswer;
}


function costSentence(cost: Cost, s: GeneratorMessages): string {
  if (cost.amount_usd === null) return s.costVaries(cost.note);
  return s.costAbout(cost.amount_usd, cost.fee_waiver === true);
}

function timelineSentence(t: Timeline, s: GeneratorMessages): string {
  return s.timeline(t.typical, t.note);
}

/** Compose the cited claim text for one record from its own fields only. */
function claimText(rec: CorpusRecord, s: GeneratorMessages): string {
  let text = rec.statement.trim();
  if (rec.detail) text += ` ${rec.detail.trim()}`;
  if (rec.cost) text += costSentence(rec.cost, s);
  if (rec.timeline) text += timelineSentence(rec.timeline, s);
  return text;
}

export class GroundedComposer implements Generator {
  generate(input: GenerateInput): GroundedAnswer {
    const s = locale(input.language ?? "en").generator;
    const max = input.maxRecords ?? 8;
    const current = input.retrieved.filter((r) => r.current).slice(0, max);
    const degraded = input.retrieved.filter((r) => !r.current);

    const blocks: AnswerBlock[] = [];

    // Refusal path: nothing serveable. Never fabricate; point to official sources.
    if (current.length === 0) {
      blocks.push({ kind: "refusal", citations: [], text: s.refusal });
      for (const d of degraded) blocks.push(freshnessBlock(d.record, s));
      blocks.push(disclosureBlock(s));
      return { blocks, cited_records: [], refused: true };
    }

    blocks.push({ kind: "boilerplate", citations: [], text: s.intro });

    const citedRecords: CorpusRecord[] = [];
    for (const { record } of current) {
      blocks.push({ kind: "claim", citations: [record.id], text: claimText(record, s) });
      if (record.discretionary) {
        blocks.push({ kind: "uncertainty", citations: [record.id], text: s.discretionary });
      }
      citedRecords.push(record);
    }

    // Surface (never serve) anything stale/volatile that matched.
    for (const d of degraded) blocks.push(freshnessBlock(d.record, s));

    blocks.push(disclosureBlock(s));
    return { blocks, cited_records: citedRecords, refused: false };
  }
}

function freshnessBlock(rec: CorpusRecord, s: GeneratorMessages): AnswerBlock {
  return {
    kind: "freshness",
    citations: [], // intentionally not a servable claim
    text: s.freshness(rec.topic, rec.source.last_verified, rec.source.title),
  };
}

function disclosureBlock(s: GeneratorMessages): AnswerBlock {
  return { kind: "boilerplate", citations: [], text: s.disclosure };
}

export const defaultGenerator: Generator = new GroundedComposer();

// ── Production seam: Claude on Bedrock ────────────────────────────────────────
// The model only ever sees retrieved, cited records and is required to tag every
// sentence with the source id it came from ([c:<id>]). We supply the boilerplate
// intro + disclosure ourselves; the model produces ONLY tagged claim sentences. Any
// sentence it emits WITHOUT a valid, current citation becomes an uncited claim and is
// REJECTED by citation.enforce() — so a hallucination can never render. This is the
// whole point of the post-generation gate: the safety property holds for ANY generator.

/** Transport boundary — a function that sends the prompt to the model and returns raw text.
 *  Kept injectable so no AWS SDK is bundled; see api/bedrock-transport.ts for the adapter. */
export type BedrockTransport = (prompt: string) => Promise<string>;

export interface AsyncGenerator {
  generateAsync(input: GenerateInput): Promise<GroundedAnswer>;
}

/** Build the retrieval-grounded prompt. The context lists each servable record by id. */
export function buildBedrockPrompt(input: GenerateInput): string {
  const s = locale(input.language ?? "en").generator;
  const current = input.retrieved.filter((r) => r.current).slice(0, input.maxRecords ?? 8);
  const context = current
    .map((r) => `[${r.record.id}] ${claimText(r.record, s)}`)
    .join("\n");
  return [
    "You are a careful assistant for legal name and gender-marker changes.",
    "Answer ONLY using the SOURCES below. Every sentence you write MUST end with the",
    "citation tag [c:<id>] of the source it came from. Do NOT state anything that is not",
    "directly supported by a source. Do NOT add an introduction or a disclaimer.",
    input.question ? `\nQUESTION: ${input.question}` : "",
    "\nSOURCES:",
    context,
    "\nANSWER (tagged sentences only):",
  ].join("\n");
}

/** Hard cap on model output we'll parse — defense against pathological/giant output. */
const MAX_PARSE_LEN = 16_000;

/**
 * Parse model output into AnswerBlocks. Each text chunk is paired with the citation
 * tag(s) that FOLLOW it (so a tag at the end of a sentence stays attached to it). Any
 * trailing text with no following tag becomes an uncited claim — which enforce() rejects.
 *
 * Implemented as a LINEAR single pass over `[c:<id>]` tag matches (no lazy-star global
 * regex — that backtracks O(n²) on adversarial input). Input is length-capped.
 */
export function parseTaggedOutput(text: string): AnswerBlock[] {
  const src = text.length > MAX_PARSE_LEN ? text.slice(0, MAX_PARSE_LEN) : text;
  const blocks: AnswerBlock[] = [];
  const tag = /\[c:([a-z0-9._-]+)\]/gi;
  let cursor = 0; // start of the current text chunk
  let chunkStart = 0;
  let ids: string[] = [];
  let m: RegExpExecArray | null;

  const flush = (textEnd: number) => {
    const clean = src.slice(chunkStart, textEnd).replace(/^[\s.!?,;:]+/, "").replace(/\s*\[c:[a-z0-9._-]+\]\s*/gi, " ").trim();
    if (clean.length > 0) blocks.push({ kind: "claim", citations: ids, text: clean });
    ids = [];
  };

  while ((m = tag.exec(src)) !== null) {
    // Collect consecutive tags (possibly separated by spaces) into the same claim.
    ids.push(m[1]!);
    const after = m.index + m[0].length;
    // Peek: if the next non-space is another tag, keep accumulating into this chunk.
    const restAfter = src.slice(after);
    if (/^\s*\[c:/i.test(restAfter)) continue;
    flush(after);
    chunkStart = after;
    cursor = after;
  }
  // Trailing text after the last tag (no citation) → uncited claim (rejected by enforce).
  const rest = src.slice(cursor).replace(/^[\s.!?,;:]+/, "").trim();
  if (rest.length > 0) blocks.push({ kind: "claim", citations: [], text: rest });
  return blocks;
}

export class BedrockGenerator implements AsyncGenerator {
  private readonly transport: BedrockTransport | null;
  // No modelId/region config field here: the transport (api/bedrock-transport.ts)
  // owns its own AWS SDK client config. A prior `config` constructor param was
  // accepted but never read anywhere (dead code, caught by `noUnusedLocals`) —
  // removed 2026-07-05 rather than wired to fake behavior it never had.
  constructor(transport: BedrockTransport | null = null) {
    this.transport = transport;
  }

  async generateAsync(input: GenerateInput): Promise<GroundedAnswer> {
    if (!this.transport) {
      throw new Error(
        "BedrockGenerator has no transport configured (no AWS credentials). The deterministic " +
          "GroundedComposer is the default; wire api/bedrock-transport.ts to enable the model path (ADR-1).",
      );
    }
    const s = locale(input.language ?? "en").generator;
    const current = input.retrieved.filter((r) => r.current).slice(0, input.maxRecords ?? 8);
    const degraded = input.retrieved.filter((r) => !r.current);

    if (current.length === 0) {
      const blocks: AnswerBlock[] = [{ kind: "refusal", citations: [], text: s.refusal }];
      for (const d of degraded) blocks.push(freshnessBlock(d.record, s));
      blocks.push(disclosureBlock(s));
      return { blocks, cited_records: [], refused: true };
    }

    const raw = await this.transport(buildBedrockPrompt(input));
    const byId = new Map(current.map((r) => [r.record.id, r.record]));

    const blocks: AnswerBlock[] = [{ kind: "boilerplate", citations: [], text: s.intro }];
    const claimBlocks = parseTaggedOutput(raw);
    blocks.push(...claimBlocks);

    // Records the model actually (and validly) cited, for the rendered source list.
    const citedIds = new Set(claimBlocks.flatMap((b) => b.citations));
    const citedRecords = [...citedIds].map((id) => byId.get(id)).filter((r): r is CorpusRecord => !!r);

    for (const d of degraded) blocks.push(freshnessBlock(d.record, s));
    blocks.push(disclosureBlock(s));
    // refused stays false; if the model produced nothing usable, enforce() will reject (0/0 → but
    // no claims means coverage 1.0, so guard: an empty body is treated as a refusal here).
    return { blocks, cited_records: citedRecords, refused: claimBlocks.length === 0 };
  }
}
