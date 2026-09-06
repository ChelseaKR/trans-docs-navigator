# Model-path eval against real AWS Bedrock — 2026-09-06

**Status: evidence, not a sign-off.** Launch gate *"Real Bedrock-backed eval run"* stays
🔴 OPEN. It clears when a named human runs this and signs off in `docs/signoffs/`, not
because this file exists. This records what a real run produced, so that a human has
something to review.

## What ran

`make eval-bedrock` with the model path pointed at real AWS Bedrock:

```
TDN_BEDROCK=aws
TDN_BEDROCK_MODEL=us.anthropic.claude-haiku-4-5-20251001-v1:0
TDN_BEDROCK_REGION=us-west-2
```

204 gold items (161 accuracy · 35 refusal · 8 adversarial) through
`BedrockGenerator → api/citation.enforce()`.

## Result

```
116 rendered · 37 refused · 51 rejected by the citation gate
✅ every rendered answer 100% cited; refusals held
```

Telemetry confirming the model genuinely ran (not a stub, not an error path):

| metric | value |
|---|---|
| generator calls | 167 |
| transport errors | **0** |
| input tokens | 58,808 |
| output tokens | 37,907 |

**What this demonstrates:** the safety contract holds against a real hosted model, not
only the deterministic composer. Nothing ungrounded reached a rendered answer — 51 model
outputs were *rejected* by the citation gate rather than served, and every one of the 116
that rendered was fully cited. Refusal items refused.

**What this does NOT demonstrate:** content accuracy. `eval/run-bedrock.ts` asserts the
invariants that must hold for any generator; it does not score whether the model's prose
is factually right. That remains the deterministic harness's job, and the gold set is
still machine-flagged co-authored (#160), so accuracy is not independent either way.

## Two defects this run exposed

**1. The gate was fail-open.** The first attempt used the repo's then-default model id and
every single call failed with `ValidationException`. It reported:

```
0 rendered · 37 refused · 167 rejected by the citation gate
✅ eval-bedrock: model path is safe via bedrock(aws)
```

A totally broken model path reported itself safe, because `catch` treated *any* exception
as "the citation gate refused" and "every rendered answer is 100% cited" is vacuously true
when nothing renders. Fixed: transport failures are now distinguished from
`CitationRejectedError` and fail the gate, and a run that renders nothing fails outright.

**2. The default model id was not invocable.** `anthropic.claude-haiku-4-5-20251001-v1:0`
returns *"Invocation of model ID … with on-demand throughput isn't supported"* — newer
models need an inference profile. Default corrected to the `us.` prefixed id, and the
default region to `us-west-2` where this account has access.

## Reproducing

Requires AWS credentials with `bedrock:InvokeModel`, and
`npm install --no-save @aws-sdk/client-bedrock-runtime` (the repo ships zero production
dependencies by design, so the SDK is not vendored).

Run cost was a few cents on Haiku.
