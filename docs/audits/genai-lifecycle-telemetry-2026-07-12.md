# GenAI lifecycle telemetry audit — 2026-07-12

## Decision

The application has one real GenAI network boundary:
`makeAwsBedrockTransport` in `api/bedrock-transport.ts`. That boundary is instrumented
on success and error. The deterministic composer and `localGroundedTransport` are
offline test paths, not model calls, and intentionally do not fabricate provider usage.

## Canonical contract

Semantic-convention names, model normalization, cache-token semantics, and pricing are
pinned to portfolio commit
`e8150c82fc35267f022af46ac71fe5a851e2d042` under
`api/_vendor/genai_telemetry/`. The canonical Python/data/README artifacts are copied
byte-for-byte and are non-executable in this TypeScript consumer. The TypeScript adapter
inside the same vendor boundary reads the canonical constants, pricing JSON, and
exact table-declared aliases and Bedrock IDs at runtime; app code does not redefine
`gen_ai.*` names or a price table.

The gate tests the immutable pin, canonical token-type key, shared price entry, and all
supported Bedrock prefixes for the selected model (`us`, `eu`, `au`, `jp`, `global`).
Provider-separated fresh, cache-creation, and cache-read input are summed into canonical
total input, then split into the three price buckets. Estimated cost is rounded to six
decimal places. Undeclared prefixes, suffixes, revisions, and ARNs remain visible with a
null cost and `unpriced: true`; they are never guessed or mislabeled as free.

## Captured fields

- provider/system, requested and response model, and operation;
- actual input/output/cache-create/cache-read usage returned by Bedrock;
- duration, finish reason, and error class;
- derived estimated USD cost;
- W3C trace/span identity and server→client parentage.

Prompt text, completion text, identity fields, and raw exception messages are neither
accepted by the record type nor logged. `content_captured` is always `false`. Telemetry
sink failure is isolated and cannot turn a successful provider call into an application
failure.

## Evaluation and operating status

The credential-free merge gate evaluates retrieval, groundedness, citation coverage,
accuracy, refusal safety, and adversarial cases deterministically. The opt-in
`make eval-bedrock` lane uses the same citation enforcement seam and defaults to a
currently priced Haiku model when real Bedrock is enabled.

A recurring production judge/model run is not claimed as complete: it requires a
deployed cloud model, credentials, an exporter/trace store, and a cost owner. Those are
external launch dependencies tracked in `docs/PRODUCTIONIZATION-PLAN.md` and
`docs/STATUS.md`. The repository already runs a weekly corpus source/freshness watch.
Streaming time-to-first-chunk is N/A because the current Bedrock transport is a single
request/response invocation; end-to-end HTTP response latency has a separate SLO.

## Verification

- `tests/genai-telemetry.test.ts` exercises the real production adapter through injected
  AWS SDK constructors, including success, error, actual usage, client reuse, content
  exclusion, prefix resolution, and vendor pinning.
- `tests/trace.test.ts` checks W3C continuation and async child context.
- `tests/metrics.test.ts` checks bounded labels, RED accounting, units, and `/metrics`.
- `make slo` parses the rule YAML and validates runtime thresholds, request-based SLI
  scope, windows, and rates against the committed objectives. PromQL parsing with
  `promtool check rules` is explicitly a deployment gate; `make verify` does not claim a
  PromQL parser it does not vendor.
