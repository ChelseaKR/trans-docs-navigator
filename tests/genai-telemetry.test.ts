import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { makeAwsBedrockTransport } from "../api/bedrock-transport.ts";
import { priceForModel, resolveModel } from "../api/_vendor/genai_telemetry/adapter.ts";
import {
  GEN_AI_REQUEST_MODEL,
  GEN_AI_TOKEN_TYPE,
  GEN_AI_USAGE_CACHE_READ_INPUT_TOKENS,
  asGenAiRecord,
  estimatedCostUsd,
  usageFromResponse,
  type GenAiCall,
} from "../api/genai-telemetry.ts";
import { walk } from "../scripts/util.ts";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const MODEL = "anthropic.claude-haiku-4-5-20251001-v1:0";
const VENDOR_COMMIT = "e8150c82fc35267f022af46ac71fe5a851e2d042";

test("cache tokens are normalized and priced without double counting", () => {
  const usage = usageFromResponse({
    input_tokens: 500_000,
    output_tokens: 1_000_000,
    cache_creation_input_tokens: 200_000,
    cache_read_input_tokens: 300_000,
  });
  assert.deepEqual(usage, {
    inputTokens: 1_000_000,
    outputTokens: 1_000_000,
    cacheCreationInputTokens: 200_000,
    cacheReadInputTokens: 300_000,
  });
  assert.equal(estimatedCostUsd("claude-haiku-4-5-20251001", usage), 5.78);
  assert.deepEqual(usageFromResponse({ input_tokens: "10", output_tokens: -1 }), {
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
  });
});

test("canonical vendor pin owns semantic names and the shared price table", () => {
  const vendor = join(ROOT, "api/_vendor/genai_telemetry");
  assert.equal(readFileSync(join(vendor, ".standards-version"), "utf8").trim(), VENDOR_COMMIT);
  assert.equal(GEN_AI_TOKEN_TYPE, "gen" + "_ai.token.type");
  assert.equal(priceForModel(MODEL)?.input, 1.1);

  const marker = "gen" + "_ai.";
  for (const file of walk(join(ROOT, "api"), (path) => path.endsWith(".ts"))) {
    if (file.includes(`${join("api", "_vendor")}`)) continue;
    assert.doesNotMatch(readFileSync(file, "utf8"), new RegExp(marker));
  }
});

test("only declared Bedrock inference-profile IDs resolve and price", () => {
  for (const prefix of ["us", "eu", "au", "jp"]) {
    const model = `${prefix}.${MODEL}`;
    assert.equal(resolveModel(model), "claude-haiku-4-5");
    assert.equal(priceForModel(model)?.input, 1.1);
  }
  assert.equal(resolveModel(`global.${MODEL}`), "claude-haiku-4-5");
  assert.equal(priceForModel(`global.${MODEL}`)?.input, 1);

  for (const undeclared of [
    `apac.${MODEL}`,
    `${MODEL}:future`,
    "arn:aws:bedrock:us-west-2:123456789012:foundation-model/anthropic.claude-haiku",
  ]) {
    assert.equal(resolveModel(undeclared), null);
    assert.equal(priceForModel(undeclared), null);
  }
});

test("regional Titan pricing requires the configured AWS region", () => {
  const model = "amazon.titan-embed-text-v2:0";
  assert.equal(priceForModel(model), null);
  assert.equal(priceForModel(model, "moon-1"), null);
  assert.equal(priceForModel(model, "us-west-2")?.input, 0.02);
  assert.equal(
    estimatedCostUsd(model, {
      inputTokens: 1_000_000,
      outputTokens: 0,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
      region: "us-west-2",
    }),
    0.02,
  );
  assert.equal(
    estimatedCostUsd(model, {
      inputTokens: 1_000_000,
      outputTokens: 1,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
      region: "us-west-2",
    }),
    null,
  );
});

test("exporter record uses the pinned shim and structurally excludes content", () => {
  const record = asGenAiRecord({
    system: "aws.bedrock",
    model: MODEL,
    operation: "chat",
    durationSeconds: 0.2,
    usage: {
      inputTokens: 17,
      outputTokens: 3,
      cacheCreationInputTokens: 3,
      cacheReadInputTokens: 4,
    },
  });
  assert.equal(
    record.span.attributes[GEN_AI_REQUEST_MODEL],
    MODEL,
  );
  assert.equal(record.span.attributes[GEN_AI_USAGE_CACHE_READ_INPUT_TOKENS], 4);
  assert.equal(record.content_captured, false);
  assert.doesNotMatch(JSON.stringify(record), /prompt|completion|legal question/i);
});

test("real Bedrock transport emits actual usage and reuses its SDK client", async () => {
  let loaderCalls = 0;
  let clientConstructions = 0;
  let sends = 0;
  const commands: FakeCommand[] = [];

  class FakeCommand {
    readonly input: {
      modelId: string;
      contentType: string;
      accept: string;
      body: string;
    };

    constructor(input: FakeCommand["input"]) {
      this.input = input;
    }
  }

  class FakeClient {
    constructor(_config: { region: string }) {
      clientConstructions++;
    }

    async send(command: unknown): Promise<unknown> {
      assert.ok(command instanceof FakeCommand);
      commands.push(command);
      sends++;
      return {
        body: new TextEncoder().encode(
          JSON.stringify({
            model: MODEL,
            stop_reason: "end_turn",
            usage: {
              input_tokens: 50,
              output_tokens: 8,
              cache_creation_input_tokens: 5,
              cache_read_input_tokens: 10,
            },
            content: [{ type: "text", text: "Cited answer." }],
          }),
        ),
      };
    }
  }

  const calls: GenAiCall[] = [];
  const transport = makeAwsBedrockTransport({
    modelId: MODEL,
    region: "us-west-2",
    telemetry: (call) => calls.push(call),
    sdkLoader: async () => {
      loaderCalls++;
      return { BedrockRuntimeClient: FakeClient, InvokeModelCommand: FakeCommand };
    },
  });

  const privatePrompt = "SENTINEL private legal question";
  assert.equal(await transport(privatePrompt), "Cited answer.");
  assert.equal(await transport(privatePrompt), "Cited answer.");

  assert.equal(loaderCalls, 1);
  assert.equal(clientConstructions, 1);
  assert.equal(sends, 2);
  assert.equal(commands.length, 2);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0]!.usage, {
    inputTokens: 65,
    outputTokens: 8,
    cacheCreationInputTokens: 5,
    cacheReadInputTokens: 10,
    region: "us-west-2",
  });
  assert.doesNotMatch(JSON.stringify(calls), /SENTINEL/);
});

test("Bedrock transport emits an error event without swallowing the failure", async () => {
  class FakeCommand {
    constructor(_input: {
      modelId: string;
      contentType: string;
      accept: string;
      body: string;
    }) {}
  }
  class BrokenClient {
    constructor(_config: { region: string }) {}
    async send(_command: unknown): Promise<unknown> {
      throw new RangeError("provider failed");
    }
  }
  const calls: GenAiCall[] = [];
  const transport = makeAwsBedrockTransport({
    modelId: MODEL,
    region: "us-west-2",
    telemetry: (call) => calls.push(call),
    sdkLoader: async () => ({
      BedrockRuntimeClient: BrokenClient,
      InvokeModelCommand: FakeCommand,
    }),
  });

  await assert.rejects(() => transport("never log me"), RangeError);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.errorType, "RangeError");
  assert.doesNotMatch(JSON.stringify(calls), /never log me/);
});
