// Opt-in model-path eval lane. Runs the gold queries through the BedrockGenerator
// (async) path so the SAFETY contract is exercised against a real generator, not just
// the deterministic composer. It asserts the invariants that must hold for ANY
// generator — every rendered answer is 100% cited, refusal items refuse, and no
// uncited/hallucinated claim ever renders — and does NOT assert content accuracy, which
// requires the hosted model.
//
//   TDN_BEDROCK=aws  TDN_BEDROCK_MODEL=... TDN_BEDROCK_REGION=...  → real Bedrock (needs creds)
//   (unset)                                                        → offline grounded stub
//
// Run: `make eval-bedrock`. This is intentionally NOT part of `make verify` (the default
// build has no AWS credentials and `verify` must stay deterministic and offline).

import { GOLD } from "./gold.ts";
import { EVAL_TODAY } from "./harness.ts";
import { answerAsync } from "../api/guidance.ts";
import { checkCoverage, CitationRejectedError } from "../api/citation.ts";
import { loadCorpus } from "../api/corpus.ts";
import { BedrockGenerator } from "../api/generator.ts";
import { localGroundedTransport, makeAwsBedrockTransport } from "../api/bedrock-transport.ts";
import { pass, fail } from "../scripts/util.ts";

const useAws = process.env.TDN_BEDROCK === "aws";
const transport = useAws
  ? makeAwsBedrockTransport({
      modelId: process.env.TDN_BEDROCK_MODEL ?? "us.anthropic.claude-haiku-4-5-20251001-v1:0",
      region: process.env.TDN_BEDROCK_REGION ?? "us-west-2",
    })
  : localGroundedTransport;
const label = useAws ? "bedrock(aws)" : "bedrock(local-stub)";

console.log(`  ℹ️  model-path eval via ${label} (safety invariants only; content accuracy needs the hosted model)`);

const corpus = loadCorpus();
const generator = new BedrockGenerator(transport);
const problems: string[] = [];
let rendered = 0;
let refused = 0;
let rejectedByGate = 0;
const transportErrors: string[] = [];

for (const item of GOLD) {
  let ans;
  try {
    ans = await answerAsync({ ...item.query, today: EVAL_TODAY }, { generator });
  } catch (e) {
    if (e instanceof CitationRejectedError) {
      // The citation gate REFUSED to render an unsafe answer. That is the safety
      // property working. (Content-wise it means the model produced something ungrounded.)
      rejectedByGate++;
      continue;
    }
    // Anything else is the generator or its transport failing — a ValidationException,
    // an auth error, a network fault. Counting these as "the gate refused" is how a
    // completely broken model path reports itself as safe: every call errors, nothing
    // renders, and "every rendered answer is 100% cited" is vacuously true.
    transportErrors.push(`${item.id}: ${(e as Error).name}: ${String((e as Error).message).slice(0, 160)}`);
    continue;
  }

  if (ans.refused) {
    refused++;
    continue;
  }

  rendered++;
  // Invariant 1: anything rendered is 100% cited.
  const cov = checkCoverage(ans, corpus, EVAL_TODAY);
  if (cov.coverage < 1) {
    problems.push(`${item.id}: rendered an answer with citation coverage ${(cov.coverage * 100).toFixed(0)}% (uncited claim leaked)`);
  }
  // Invariant 2: refusal-suite items must NOT render a confident answer.
  if (item.suite === "refusal" && item.expect.refused === true) {
    problems.push(`${item.id}: refusal-case item rendered an answer instead of refusing`);
  }
}

console.log(`     ${rendered} rendered · ${refused} refused · ${rejectedByGate} rejected by the citation gate`);

if (transportErrors.length > 0) {
  fail(
    "eval-bedrock",
    `${transportErrors.length} of ${GOLD.length} generator call(s) failed — the model path did not run, so this proves nothing`,
    transportErrors.slice(0, 10),
  );
}
if (rendered === 0) {
  fail(
    "eval-bedrock",
    `0 of ${GOLD.length} gold items rendered an answer — a run that renders nothing cannot demonstrate the model path is safe`,
    ["every invariant below is vacuously true when nothing renders; refusing to report that as a pass"],
  );
}
if (problems.length > 0) {
  fail("eval-bedrock", `${problems.length} SAFETY violation(s) on the model path`, problems);
}
pass("eval-bedrock", `model path is safe via ${label}: ${rendered} answer(s) rendered, every one 100% cited; refusals held`);
