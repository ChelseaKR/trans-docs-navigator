// TypeScript adapter over the canonical Python/data artifacts in this directory.
// The immutable STANDARDS package remains byte-identical; this adapter reads its
// constants and price table instead of maintaining a second language-local copy.

import { readFileSync } from "node:fs";

const attributesSource = readFileSync(new URL("./attributes.py", import.meta.url), "utf8");

function canonicalConstant(name: string): string {
  const match = new RegExp(`^${name} = "([^"]+)"`, "m").exec(attributesSource);
  if (!match?.[1]) throw new Error(`canonical GenAI shim is missing ${name}`);
  return match[1];
}

export const GENAI_SEMCONV_VERSION = canonicalConstant("SEMCONV_VERSION");
export const GEN_AI_OPERATION_NAME = canonicalConstant("GEN_AI_OPERATION_NAME");
export const GEN_AI_SYSTEM = canonicalConstant("GEN_AI_SYSTEM");
export const GEN_AI_REQUEST_MODEL = canonicalConstant("GEN_AI_REQUEST_MODEL");
export const GEN_AI_RESPONSE_MODEL = canonicalConstant("GEN_AI_RESPONSE_MODEL");
export const GEN_AI_RESPONSE_FINISH_REASONS = canonicalConstant(
  "GEN_AI_RESPONSE_FINISH_REASONS",
);
export const GEN_AI_USAGE_INPUT_TOKENS = canonicalConstant("GEN_AI_USAGE_INPUT_TOKENS");
export const GEN_AI_USAGE_OUTPUT_TOKENS = canonicalConstant("GEN_AI_USAGE_OUTPUT_TOKENS");
export const GEN_AI_USAGE_CACHE_CREATION_INPUT_TOKENS = canonicalConstant(
  "GEN_AI_USAGE_CACHE_CREATION_INPUT_TOKENS",
);
export const GEN_AI_USAGE_CACHE_READ_INPUT_TOKENS = canonicalConstant(
  "GEN_AI_USAGE_CACHE_READ_INPUT_TOKENS",
);
export const GEN_AI_RESPONSE_TIME_TO_FIRST_CHUNK = canonicalConstant(
  "GEN_AI_RESPONSE_TIME_TO_FIRST_CHUNK",
);
export const GEN_AI_TOKEN_TYPE = canonicalConstant("GEN_AI_TOKEN_TYPE");
export const PORTFOLIO_COST_USD = canonicalConstant("PORTFOLIO_COST_USD");
export const METRIC_OPERATION_DURATION = canonicalConstant("METRIC_OPERATION_DURATION");
export const METRIC_TOKEN_USAGE = canonicalConstant("METRIC_TOKEN_USAGE");

export interface GenAiUsage {
  /** Canonical total input: fresh + cache creation + cache read. */
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
  /** Required when the canonical provider price row is regional. */
  region?: string;
}

export const EMPTY_USAGE: GenAiUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheCreationInputTokens: 0,
  cacheReadInputTokens: 0,
};

interface Price {
  input: number;
  output?: number;
  cache_write_5m?: number;
  cache_write_1h?: number;
  cache_read?: number;
  region?: string;
}

interface PriceFile {
  models: Record<string, Record<string, unknown>>;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function price(value: unknown): Price | null {
  const row = record(value);
  if (!row || typeof row.input !== "number") return null;
  for (const key of ["output", "cache_write_5m", "cache_write_1h", "cache_read"]) {
    if (row[key] !== undefined && typeof row[key] !== "number") return null;
  }
  return row as unknown as Price;
}

function loadPriceFile(): PriceFile {
  const parsed = record(
    JSON.parse(readFileSync(new URL("./pricing.json", import.meta.url), "utf8")),
  );
  const rawModels = record(parsed?.models);
  if (!rawModels) throw new Error("canonical GenAI price table has no models object");
  const models: Record<string, Record<string, unknown>> = {};
  for (const [model, value] of Object.entries(rawModels)) {
    const row = record(value);
    if (!row) throw new Error(`canonical GenAI price row is malformed: ${model}`);
    models[model] = row;
  }
  return { models };
}

const PRICE_FILE = loadPriceFile();

type EndpointType = "global" | "regional" | "multi_region";

function stringList(value: unknown): readonly string[] | null {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && item)
    ? value
    : null;
}

function bedrockEndpointForId(
  model: string,
  row: Record<string, unknown>,
): EndpointType | null {
  const bedrock = record(row.aws_bedrock);
  if (!bedrock) return null;
  const modelIds = stringList(bedrock.model_ids);
  const profileModelIds = stringList(bedrock.profile_model_ids);
  const profilePrefixes = stringList(bedrock.profile_prefixes);
  if (!modelIds || !profileModelIds || !profilePrefixes) return null;
  if (modelIds.includes(model)) return "regional";
  for (const prefix of profilePrefixes) {
    if (profileModelIds.some((profileId) => model === `${prefix}.${profileId}`)) {
      return prefix === "global" ? "global" : "multi_region";
    }
  }
  return null;
}

/** Resolve only exact table-declared aliases and Bedrock model/profile IDs. */
export function resolveModel(model: string): string | null {
  if (!model) return null;
  if (PRICE_FILE.models[model]) return model;
  for (const [key, row] of Object.entries(PRICE_FILE.models)) {
    const aliases = stringList(row.aliases ?? []);
    if (!aliases) continue;
    if (aliases.includes(model) || bedrockEndpointForId(model, row)) return key;
  }
  return null;
}

export function priceForModel(model: string, region?: string): Price | null {
  const resolved = resolveModel(model);
  if (!resolved || (region !== undefined && !region)) return null;
  let row = PRICE_FILE.models[resolved];
  if (!row) return null;

  if (row.service === "aws.bedrock") {
    // Amazon-authored rows are already direct in-region service prices.
  } else if (row.provider !== undefined) {
    const endpoint = bedrockEndpointForId(model, row);
    if (endpoint) {
      const bedrock = record(row.aws_bedrock);
      const multiplier = bedrock?.[endpoint];
      if (typeof multiplier !== "number" || !Number.isFinite(multiplier)) return null;
      row = { ...row };
      for (const key of [
        "input",
        "output",
        "cache_write_5m",
        "cache_write_1h",
        "cache_read",
      ]) {
        const rate = row[key];
        if (rate !== undefined) {
          if (typeof rate !== "number" || !Number.isFinite(rate)) return null;
          row[key] = Number((rate * multiplier).toFixed(12));
        }
      }
    }
  }

  const regions = record(row.regions);
  if (!regions) return price(row);
  if (!region) return null;
  const regional = record(regions[region]);
  if (!regional) return null;
  return price({ ...row, ...regional, regions: undefined, region });
}

function nonnegativeInteger(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

/** Normalize provider fresh/create/read counts into canonical total input. */
export function usageFromResponse(value: unknown, region?: string): GenAiUsage {
  const source = record(value);
  if (!source) return { ...EMPTY_USAGE, ...(region ? { region } : {}) };
  const fresh = nonnegativeInteger(source.input_tokens);
  const cacheCreation = nonnegativeInteger(source.cache_creation_input_tokens);
  const cacheRead = nonnegativeInteger(source.cache_read_input_tokens);
  return {
    inputTokens: fresh + cacheCreation + cacheRead,
    outputTokens: nonnegativeInteger(source.output_tokens),
    cacheCreationInputTokens: cacheCreation,
    cacheReadInputTokens: cacheRead,
    ...(region ? { region } : {}),
  };
}

/** Mirror canonical pricing.py exactly: 5-minute cache writes, six-decimal USD. */
export function estimatedCostUsd(model: string, usage: GenAiUsage): number | null {
  const counts = [
    usage.inputTokens,
    usage.outputTokens,
    usage.cacheCreationInputTokens,
    usage.cacheReadInputTokens,
  ];
  if (
    counts.some((count) => !Number.isSafeInteger(count) || count < 0) ||
    usage.cacheCreationInputTokens + usage.cacheReadInputTokens > usage.inputTokens ||
    (usage.region !== undefined && !usage.region)
  ) {
    return null;
  }
  const modelPrice = priceForModel(model, usage.region);
  if (!modelPrice) return null;
  const freshInput =
    usage.inputTokens - usage.cacheCreationInputTokens - usage.cacheReadInputTokens;
  const components: readonly [number, number | undefined][] = [
    [freshInput, modelPrice.input],
    [usage.cacheReadInputTokens, modelPrice.cache_read],
    [usage.cacheCreationInputTokens, modelPrice.cache_write_5m],
    [usage.outputTokens, modelPrice.output],
  ];
  let estimate = 0;
  for (const [count, rate] of components) {
    if (rate === undefined) {
      if (count > 0) return null;
      continue;
    }
    estimate += (count * rate) / 1_000_000;
  }
  return Number(estimate.toFixed(6));
}
