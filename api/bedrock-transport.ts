// Transport adapters for BedrockGenerator. The transport is the ONLY part that talks to
// the network, kept separate so (a) no AWS SDK is bundled into the reference build and
// (b) the generator's prompt/parse/enforce logic is testable with a plain function.
//
// Two transports:
//   • makeAwsBedrockTransport — the real production path: invokes Claude on AWS Bedrock.
//     The SDK is loaded by DYNAMIC import so it isn't a hard dependency; calling this
//     without `@aws-sdk/client-bedrock-runtime` installed (or without creds) throws a
//     clear error rather than breaking the credential-free build.
//   • localGroundedTransport — a deterministic, offline stand-in that emits faithfully
//     tagged sentences straight from the prompt's SOURCES block. It lets the model PATH
//     (prompt → parse → citation.enforce) run end-to-end in CI/tests without credentials.
//     It is NOT a model and proves nothing about answer quality — only that the pipeline
//     is wired and safe. Real accuracy needs the hosted model via the AWS transport.

import type { BedrockTransport } from "./generator.ts";
import {
  emitGenAiCall,
  recordGenAiCallSafely,
  usageFromResponse,
  type GenAiTelemetrySink,
} from "./genai-telemetry.ts";
import { runInChildTrace } from "./trace.ts";

interface BedrockSdk {
  BedrockRuntimeClient: new (config: { region: string }) => {
    send(command: unknown): Promise<unknown>;
  };
  InvokeModelCommand: new (input: {
    modelId: string;
    contentType: string;
    accept: string;
    body: string;
  }) => unknown;
}

type BedrockSdkLoader = () => Promise<BedrockSdk>;

export interface AwsBedrockConfig {
  modelId: string; // e.g. "anthropic.claude-haiku-4-5-20251001-v1:0"
  region: string; // e.g. "us-east-1"
  maxTokens?: number;
  telemetry?: GenAiTelemetrySink;
  /** Injectable only so the real production adapter can be tested without credentials. */
  sdkLoader?: BedrockSdkLoader;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asSdk(value: unknown): BedrockSdk {
  const sdk = asRecord(value);
  if (
    !sdk ||
    typeof sdk.BedrockRuntimeClient !== "function" ||
    typeof sdk.InvokeModelCommand !== "function"
  ) {
    throw new TypeError("Bedrock SDK module is missing the runtime client exports");
  }
  return sdk as unknown as BedrockSdk;
}

function responseBody(value: unknown): Uint8Array {
  const response = asRecord(value);
  if (!response || !(response.body instanceof Uint8Array)) {
    throw new TypeError("Bedrock response body must be bytes");
  }
  return response.body;
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "UnknownError";
}

/** Real Bedrock transport. Requires `@aws-sdk/client-bedrock-runtime` + AWS credentials. */
export function makeAwsBedrockTransport(config: AwsBedrockConfig): BedrockTransport {
  const telemetry = config.telemetry ?? emitGenAiCall;
  const sdkName = "@aws-sdk/client-bedrock-runtime";
  const loadSdk: BedrockSdkLoader =
    config.sdkLoader ??
    (async () => {
      try {
        return asSdk(await import(sdkName));
      } catch (error) {
        if (error instanceof TypeError) throw error;
        throw new Error(
          `${sdkName} is not installed. Run \`npm i ${sdkName}\` and provide AWS credentials to enable the Bedrock model path.`,
          { cause: error },
        );
      }
    });
  let sdkPromise: Promise<BedrockSdk> | null = null;
  let clientPromise: Promise<InstanceType<BedrockSdk["BedrockRuntimeClient"]>> | null = null;

  async function sdk(): Promise<BedrockSdk> {
    if (!sdkPromise) sdkPromise = loadSdk();
    return sdkPromise;
  }

  async function client(): Promise<InstanceType<BedrockSdk["BedrockRuntimeClient"]>> {
    if (!clientPromise) {
      clientPromise = sdk().then(
        (sdk) => new sdk.BedrockRuntimeClient({ region: config.region }),
      );
    }
    return clientPromise;
  }

  return async (prompt: string): Promise<string> => {
    return runInChildTrace(async () => {
      const started = performance.now();
      try {
        const bedrockSdk = await sdk();
        const runtimeClient = await client();
        const body = {
          anthropic_version: "bedrock-2023-05-31",
          max_tokens: config.maxTokens ?? 1024,
          messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
        };
        const response = await runtimeClient.send(
          new bedrockSdk.InvokeModelCommand({
            modelId: config.modelId,
            contentType: "application/json",
            accept: "application/json",
            body: JSON.stringify(body),
          }),
        );
        const decoded = asRecord(JSON.parse(new TextDecoder().decode(responseBody(response))));
        if (!decoded) throw new TypeError("Bedrock response must be a JSON object");
        const content = decoded.content;
        if (!Array.isArray(content)) throw new TypeError("Bedrock response content must be a list");
        const text = content
          .map((item) => {
            const block = asRecord(item);
            return typeof block?.text === "string" ? block.text : "";
          })
          .join("\n");
        recordGenAiCallSafely(telemetry, {
          system: "aws.bedrock",
          model: config.modelId,
          operation: "chat",
          durationSeconds: (performance.now() - started) / 1_000,
          usage: usageFromResponse(decoded.usage, config.region),
          ...(typeof decoded.model === "string" ? { responseModel: decoded.model } : {}),
          ...(typeof decoded.stop_reason === "string" ? { finishReason: decoded.stop_reason } : {}),
        });
        return text;
      } catch (error) {
        recordGenAiCallSafely(telemetry, {
          system: "aws.bedrock",
          model: config.modelId,
          operation: "chat",
          durationSeconds: (performance.now() - started) / 1_000,
          errorType: errorName(error),
        });
        throw error;
      }
    });
  };
}

function firstSentence(text: string): string {
  const m = /^.*?[.!?](\s|$)/.exec(text.trim());
  return (m ? m[0] : text).trim();
}

/**
 * Offline, deterministic stand-in for a faithful model: echoes each source's leading
 * sentence with its citation tag, so the generated answer is grounded and 100%-cited by
 * construction. Use ONLY to exercise the model code path without credentials.
 */
export const localGroundedTransport: BedrockTransport = async (prompt: string): Promise<string> => {
  const lines = prompt.split("\n");
  const start = lines.findIndex((l) => l.trim() === "SOURCES:");
  const out: string[] = [];
  for (const line of start >= 0 ? lines.slice(start + 1) : []) {
    const m = /^\[([a-z0-9._-]+)\]\s+(.*)$/i.exec(line.trim());
    if (m) out.push(`${firstSentence(m[2]!)} [c:${m[1]}]`);
  }
  return out.join("\n");
};
