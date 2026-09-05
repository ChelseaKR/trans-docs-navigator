# eval-poison fixtures

Negative controls for stage 20 of `make verify` (`eval/run.ts`), the accuracy oracle.

Each file is a complete replacement gold set, loaded through `EVAL_GOLD_POISON`
(`eval/gold.ts`). Every set shares the same three-item clean base — one accuracy item,
one refusal item, one adversarial item — so that exactly one metric goes red per
fixture and the assertion is about that metric, not about collateral damage.

| Fixture | Poison | Metric that must block |
|---|---|---|
| `baseline-clean.json` | none — the control for the controls | none; the harness must PASS |
| `wrong-answer.json` | an accuracy item the served answer does not satisfy | `factual_accuracy` (≥ 0.98) |
| `empty-gold.json` | no items at all | every metric, via the fail-closed "a metric with no data is a failure" rule |
| `retrieval-miss.json` | an accuracy item whose expected record is not retrievable for its query | `context_recall_at_8` (≥ 0.80) and `context_precision_at_1` (≥ 0.70) |

`baseline-clean.json` matters as much as the poisons: without it, a harness that failed
on *everything* would satisfy all three poison assertions while proving nothing.

Runs are pointed at a throwaway `EVAL_REPORT_DIR` so a deliberately-failing report never
overwrites the committed artifacts in `docs/audits/`.
