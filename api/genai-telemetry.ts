// App-facing content-free record/sink wrapper. Convention names, model resolution,
// and prices are owned by the immutable artifacts under api/_vendor/genai_telemetry.

import {
  EMPTY_USAGE,
  GENAI_SEMCONV_VERSION,
  GEN_AI_OPERATION_NAME,
  GEN_AI_REQUEST_MODEL,
  GEN_AI_RESPONSE_FINISH_REASONS,
  GEN_AI_RESPONSE_MODEL,
  GEN_AI_RESPONSE_TIME_TO_FIRST_CHUNK,
  GEN_AI_SYSTEM,
  GEN_AI_TOKEN_TYPE,
  GEN_AI_USAGE_CACHE_CREATION_INPUT_TOKENS,
  GEN_AI_USAGE_CACHE_READ_INPUT_TOKENS,
  GEN_AI_USAGE_INPUT_TOKENS,
  GEN_AI_USAGE_OUTPUT_TOKENS,
  METRIC_OPERATION_DURATION,
  METRIC_TOKEN_USAGE,
  PORTFOLIO_COST_USD,
  estimatedCostUsd,
  usageFromResponse,
  type GenAiUsage,
} from "./_vendor/genai_telemetry/adapter.ts";
import { safeLog } from "./log.ts";
import { currentTraceLogFields } from "./trace.ts";

export {
  GENAI_SEMCONV_VERSION,
  GEN_AI_REQUEST_MODEL,
  GEN_AI_TOKEN_TYPE,
  GEN_AI_USAGE_CACHE_READ_INPUT_TOKENS,
  estimatedCostUsd,
  usageFromResponse,
};
export type { GenAiUsage };

const ERROR_TYPE = "error.type";

export interface GenAiCall {
  system: string;
  model: string;
  operation: "chat" | "embeddings";
  durationSeconds: number;
  usage?: GenAiUsage;
  responseModel?: string;
  finishReason?: string;
  timeToFirstChunkSeconds?: number;
  errorType?: string;
}

export type GenAiTelemetrySink = (call: GenAiCall) => void;

export interface GenAiRecord {
  [key: string]: unknown;
  semconv_version: string;
  span: { name: string; attributes: Record<string, unknown> };
  metrics: readonly {
    name: string;
    value: number;
    unit: string;
    attributes: Record<string, unknown>;
  }[];
  unpriced: boolean;
  content_captured: false;
}

/** Build an exporter-ready record without ever accepting content fields. */
export function asGenAiRecord(call: GenAiCall): GenAiRecord {
  const usage = call.usage ?? EMPTY_USAGE;
  const attributes: Record<string, unknown> = {
    [GEN_AI_OPERATION_NAME]: call.operation,
    [GEN_AI_SYSTEM]: call.system,
    [GEN_AI_REQUEST_MODEL]: call.model,
    [GEN_AI_USAGE_INPUT_TOKENS]: usage.inputTokens,
    [GEN_AI_USAGE_OUTPUT_TOKENS]: usage.outputTokens,
    [GEN_AI_USAGE_CACHE_CREATION_INPUT_TOKENS]: usage.cacheCreationInputTokens,
    [GEN_AI_USAGE_CACHE_READ_INPUT_TOKENS]: usage.cacheReadInputTokens,
  };
  if (call.responseModel) attributes[GEN_AI_RESPONSE_MODEL] = call.responseModel;
  if (call.finishReason) attributes[GEN_AI_RESPONSE_FINISH_REASONS] = [call.finishReason];
  if (call.timeToFirstChunkSeconds !== undefined) {
    attributes[GEN_AI_RESPONSE_TIME_TO_FIRST_CHUNK] = call.timeToFirstChunkSeconds;
  }
  if (call.errorType) attributes[ERROR_TYPE] = call.errorType;

  const metricAttributes = {
    [GEN_AI_OPERATION_NAME]: call.operation,
    [GEN_AI_SYSTEM]: call.system,
    [GEN_AI_REQUEST_MODEL]: call.model,
  };
  const cost = estimatedCostUsd(call.model, usage);
  return {
    semconv_version: GENAI_SEMCONV_VERSION,
    span: { name: `${call.operation} ${call.model}`, attributes },
    metrics: [
      {
        name: METRIC_OPERATION_DURATION,
        value: Math.max(call.durationSeconds, 0),
        unit: "s",
        attributes: metricAttributes,
      },
      ...(["input", "output"] as const).map((tokenType) => ({
        name: METRIC_TOKEN_USAGE,
        value: tokenType === "input" ? usage.inputTokens : usage.outputTokens,
        unit: "{token}",
        attributes: { ...metricAttributes, [GEN_AI_TOKEN_TYPE]: tokenType },
      })),
    ],
    [PORTFOLIO_COST_USD]: cost,
    unpriced: cost === null,
    content_captured: false,
  };
}

/** Default JSON-lines sink; deployments may inject a native OTel exporter sink. */
export function emitGenAiCall(call: GenAiCall): void {
  const usage = call.usage ?? EMPTY_USAGE;
  const cost = estimatedCostUsd(call.model, usage);
  safeLog(
    "genai_client_call",
    {
      semconv_version: GENAI_SEMCONV_VERSION,
      provider: call.system,
      model: call.model,
      response_model: call.responseModel,
      operation: call.operation,
      duration_ms: Math.max(call.durationSeconds, 0) * 1_000,
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
      cache_creation_input_tokens: usage.cacheCreationInputTokens,
      cache_read_input_tokens: usage.cacheReadInputTokens,
      finish_reason: call.finishReason,
      error_type: call.errorType,
      estimated_cost_usd: cost,
      unpriced: cost === null,
      content_captured: false,
      span_kind: "client",
      span_name: `${call.operation} ${call.model}`,
      ...currentTraceLogFields(),
    },
    call.errorType ? "error" : "info",
  );
}

export function recordGenAiCallSafely(sink: GenAiTelemetrySink, call: GenAiCall): void {
  try {
    sink(call);
  } catch {
    // Telemetry can never turn a successful model operation into an application failure.
  }
}
