# Operations Runbook

> For a tired on-call human at 2 a.m. Production-ready criterion #5.
> The service stores **no PII**, so most "data incident" playbooks do not apply —
> there is nothing to leak. The real operational risk is **stale or wrong guidance**.

## What this service is
A stateless Node server (`api/server.ts`) that renders accessible pages and grounded,
cited guidance from a version-controlled corpus. No database. Form-fill is client-side.

## Health & rollback
- **Health:** `GET /healthz` → `{ "status": "ok", "corpus_records": N }`. Non-200 or a
  crash → the container healthcheck fails and the orchestrator restarts/replaces it.
- **It's stateless.** Rollback = redeploy the previous image tag. No migrations, no
  data to restore.
- **Kill switch:** scale to zero / take the ALB target out of service. No cleanup needed.

## Alarms → actions
| Alarm | Meaning | Action |
|-------|---------|--------|
| `freshness` job fails (CI or scheduled) | A `verified` record is past its SLA → would be served as stale | Re-verify the record against its source, then bump `last_verified` **or** flip `verification_status` to `needs_reverification`. Do NOT just bump the date without checking. |
| Eval regression (`make eval` red) | groundedness/accuracy/refusal/coverage dropped | Block the release. Inspect `docs/audits/eval-report.md` → the failing item's notes point at the corpus record or generator change. |
| Citation gate throws at runtime (500s spike) — CloudWatch alarm `trans-docs-navigator-500s-spike` (metric `ServerErrorCount`, filter `trans-docs-navigator-server-error`) | The generator produced an uncited claim | This is the gate working. Roll back the generator/corpus change. A 500 is correct behavior — better than rendering an unsourced legal claim. |
| `privacy` gate fails in CI | Code introduced PII handling on the server or in a log | Block the merge. Find the offending line from the gate output; move PII handling client-side. |
| `corpus_quarantine` log at startup (`quarantined > 0`) — CloudWatch alarm `trans-docs-navigator-corpus-quarantine` (metric `CorpusQuarantineCount`, filter `trans-docs-navigator-corpus-quarantine`) | A malformed record shipped; the server dropped it (fail-degraded) and is serving the rest | Inspect the bad record (CI `make content` names it), fix or revert it, redeploy. Service stays up meanwhile; the quarantined topic simply isn't served. |
| `answer` logs `degraded: true` spiking — CloudWatch alarm `trans-docs-navigator-degraded-answer-spike` (metric `DegradedAnswerCount`, filter `trans-docs-navigator-degraded-answer`) | Users are hitting stale/volatile records surfaced as "needs reverification" | Expected near a known volatile rule; if unexpected, check whether a record fell past its freshness SLA and reverify it. |
| `rate_limited` (429s) spiking — CloudWatch alarm `trans-docs-navigator-rate-limited-spike` (metric `Rate429Count`, filter `trans-docs-navigator-rate-limited`); coarse outer bound also enforced by the `aws_wafv2_web_acl.edge` WAF in front of the ALB | Sustained abuse past the in-process per-IP limiter (`api/server.ts`) and/or the edge WAF rate rule | Confirm it's not a single client retry-looping on a bug; if it's abuse, the WAF rate-based rule already blocks the offending IPs — no action needed beyond monitoring unless the edge limit itself needs tightening. |
| p95 first-token regression (Bedrock path) | Model latency | Confirm Bedrock region/endpoint; Haiku-first; check the VPC endpoint. |

Metrics are populated by `aws_cloudwatch_log_metric_filter` resources in `infra/main.tf`
reading `aws_cloudwatch_log_group.app` (`/trans-docs-navigator/app`), fed from the non-PII
structured events emitted by `api/log.ts`'s `safeLog`. Alarm notifications require setting
`alarm_sns_topic_arn`; the edge WAF association requires setting `alb_arn` — both default to
`""` so `terraform validate`/`fmt -check` pass credential-free in CI (D5 / Phase 5.1).

## Common tasks
- **Add/fix a jurisdiction record:** edit `corpus/jurisdictions/*.json`, run
  `make content && make freshness && make citation && make eval`. A PR requires a real
  source + named verifier (see contribution path, ROADMAP §9).
- **Mark volatile law as not-current:** set `verification_status: "needs_reverification"`.
  The runtime degrades it to "needs reverification" and the checklist flags the step.
- **Regenerate audit artifacts:** `make eval` (eval report); the other audit docs in
  `docs/audits/` are maintained by hand and reviewed per release.

## Logging & privacy
Logs are structured JSON via `api/log.ts`, which **allowlists only non-PII fields**.
If you need a new log field, add it to the allowlist — never log raw request data.
There is no PII in logs by construction (enforced by `make privacy`).

## Escalation
- Wrong legal guidance reported by a user → treat as **P1**: pull the record (flip to
  `needs_reverification`), redeploy, then verify. Guidance correctness is a safety property.
- Suspected security issue → see `docs/audits/residual-risk.md` owners.
