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

export interface AwsBedrockConfig {
  modelId: string; // e.g. "anthropic.claude-3-5-haiku-20241022-v1:0"
  region: string; // e.g. "us-east-1"
  maxTokens?: number;
}

/** Real Bedrock transport. Requires `@aws-sdk/client-bedrock-runtime` + AWS credentials. */
export function makeAwsBedrockTransport(config: AwsBedrockConfig): BedrockTransport {
  return async (prompt: string): Promise<string> => {
    // Variable specifier ⇒ the type-checker doesn't require the (optional) SDK to be present.
    const sdkName = "@aws-sdk/client-bedrock-runtime";
    let sdk: any;
    try {
      sdk = await import(sdkName);
    } catch {
      throw new Error(
        `${sdkName} is not installed. Run \`npm i ${sdkName}\` and provide AWS credentials to enable the Bedrock model path.`,
      );
    }
    const client = new sdk.BedrockRuntimeClient({ region: config.region });
    const body = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: config.maxTokens ?? 1024,
      messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
    };
    const res = await client.send(
      new sdk.InvokeModelCommand({
        modelId: config.modelId,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify(body),
      }),
    );
    const decoded = JSON.parse(new TextDecoder().decode(res.body));
    // Claude messages API: { content: [{ type: "text", text }] }
    return (decoded?.content ?? []).map((c: { text?: string }) => c.text ?? "").join("\n");
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
