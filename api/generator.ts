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
import { DISCLOSURE } from "./citation.ts";

export interface GenerateInput {
  retrieved: Retrieved[];
  question?: string;
  maxRecords?: number;
  /** Language for the system-composed scaffolding (intro/cost/timeline/refusal/disclosure). */
  language?: Language;
}

export interface Generator {
  generate(input: GenerateInput): GroundedAnswer;
}

/**
 * Language strings for the system-composed parts of an answer. Record statements/details
 * are already in the record's language; these are the scaffolding sentences around them.
 */
const STR = {
  en: {
    costVaries: (note?: string) => (note ? ` Cost varies: ${note}` : " Cost varies."),
    costAbout: (amt: number, waiver: boolean) =>
      ` The typical cost is about $${amt}.${waiver ? " A fee waiver may be available if you cannot afford it." : ""}`,
    timeline: (typ: string, note?: string) => ` Typical timeline: ${typ}.${note ? ` ${note}` : ""}`,
    intro: "Here is what the official sources say for your situation. Each point links to its source and the date it was last checked.",
    discretionary: "This step is discretionary — the outcome can vary by court or clerk, so treat it as a likely path, not a guarantee.",
    refusal:
      "I don't have verified information for that yet, so I can't give you an answer I'd stand behind. " +
      "Please check the official source directly, or try a jurisdiction and document I currently cover.",
    freshness: (topic: string, date: string, title: string) =>
      `One related rule (${topic}) may have changed and needs reverification — I last have it checked on ${date}, ` +
      `which is outside the freshness window, so I won't present it as current. Verify it directly at the official source: ${title}.`,
    disclosure: `${DISCLOSURE.notLegalAdvice} ${DISCLOSURE.aiAssisted}`,
  },
  es: {
    costVaries: (note?: string) => (note ? ` El costo varía: ${note}` : " El costo varía."),
    costAbout: (amt: number, waiver: boolean) =>
      ` El costo típico es de aproximadamente $${amt}.${waiver ? " Puede haber una exención de tarifa si no puede pagarla." : ""}`,
    timeline: (typ: string, note?: string) => ` Tiempo estimado: ${typ}.${note ? ` ${note}` : ""}`,
    intro: "Esto es lo que dicen las fuentes oficiales para su situación. Cada punto enlaza a su fuente y la fecha en que se verificó por última vez.",
    discretionary: "Este paso es discrecional — el resultado puede variar según el tribunal o el secretario, así que considérelo un camino probable, no una garantía.",
    refusal:
      "Todavía no tengo información verificada sobre eso, así que no puedo darle una respuesta que pueda respaldar. " +
      "Consulte directamente la fuente oficial, o pruebe una jurisdicción y un documento que cubra actualmente.",
    freshness: (topic: string, date: string, title: string) =>
      `Una regla relacionada (${topic}) puede haber cambiado y necesita reverificación — la verifiqué por última vez el ${date}, ` +
      `lo cual está fuera del período de vigencia, así que no la presentaré como actual. Verifíquela directamente en la fuente oficial: ${title}.`,
    disclosure: "Información, no asesoramiento legal. Asistido por IA, basado en fuentes citadas.",
  },
} as const;

function costSentence(cost: Cost, s: (typeof STR)[Language]): string {
  if (cost.amount_usd === null) return s.costVaries(cost.note);
  return s.costAbout(cost.amount_usd, cost.fee_waiver === true);
}

function timelineSentence(t: Timeline, s: (typeof STR)[Language]): string {
  return s.timeline(t.typical, t.note);
}

/** Compose the cited claim text for one record from its own fields only. */
function claimText(rec: CorpusRecord, s: (typeof STR)[Language]): string {
  let text = rec.statement.trim();
  if (rec.detail) text += ` ${rec.detail.trim()}`;
  if (rec.cost) text += costSentence(rec.cost, s);
  if (rec.timeline) text += timelineSentence(rec.timeline, s);
  return text;
}

export class GroundedComposer implements Generator {
  generate(input: GenerateInput): GroundedAnswer {
    const s = STR[input.language ?? "en"];
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

function freshnessBlock(rec: CorpusRecord, s: (typeof STR)[Language]): AnswerBlock {
  return {
    kind: "freshness",
    citations: [], // intentionally not a servable claim
    text: s.freshness(rec.topic, rec.source.last_verified, rec.source.title),
  };
}

function disclosureBlock(s: (typeof STR)[Language]): AnswerBlock {
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
  const s = STR[input.language ?? "en"];
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

/**
 * Parse model output into AnswerBlocks. Each text chunk is paired with the citation
 * tag(s) that FOLLOW it (so a tag at the end of a sentence stays attached to it). Any
 * trailing text with no following tag becomes an uncited claim — which enforce() rejects.
 */
export function parseTaggedOutput(text: string): AnswerBlock[] {
  const blocks: AnswerBlock[] = [];
  const unit = /([\s\S]*?)((?:\s*\[c:[a-z0-9._-]+\])+)/gi;
  let lastIndex = 0;
  for (const m of text.matchAll(unit)) {
    const ids = [...m[2]!.matchAll(/\[c:([a-z0-9._-]+)\]/gi)].map((t) => t[1]!);
    const clean = m[1]!.replace(/^[\s.!?,;:]+/, "").trim();
    lastIndex = m.index + m[0].length;
    if (clean.length > 0) blocks.push({ kind: "claim", citations: ids, text: clean });
  }
  const rest = text.slice(lastIndex).replace(/^[\s.!?,;:]+/, "").trim();
  if (rest.length > 0) blocks.push({ kind: "claim", citations: [], text: rest });
  return blocks;
}

export class BedrockGenerator implements AsyncGenerator {
  private readonly transport: BedrockTransport | null;
  private readonly config: { modelId: string; region: string };
  constructor(
    transport: BedrockTransport | null = null,
    config: { modelId: string; region: string } = { modelId: "anthropic.claude-3-5-haiku", region: "us-east-1" },
  ) {
    this.transport = transport;
    this.config = config;
  }

  async generateAsync(input: GenerateInput): Promise<GroundedAnswer> {
    if (!this.transport) {
      throw new Error(
        "BedrockGenerator has no transport configured (no AWS credentials). The deterministic " +
          "GroundedComposer is the default; wire api/bedrock-transport.ts to enable the model path (ADR-1).",
      );
    }
    const s = STR[input.language ?? "en"];
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
