# Operations Runbook

> For a tired on-call human at 2 a.m. Production-ready criterion #5.
> The service has no account or identity-profile database, but it does process sensitive
> request URLs and emit bounded application/infrastructure records. Data incidents still
> require a real response; stale or wrong guidance is a separate primary operational risk.

## What this service is
A database-free Node server (`api/server.ts`) with bounded process-local render caches.
It renders accessible pages and grounded, cited guidance from a version-controlled corpus.
Direct identity-form fields stay in the browser.

## Health & rollback
- **Liveness:** `GET /livez` only proves the process can answer; it never calls a
  dependency. A non-200/crash means restart or replace the container.
- **Readiness:** `GET /readyz` checks that the corpus loads and at least one record is
  current. A 503 removes the instance from rotation; do not override it merely to keep
  traffic flowing. `GET /healthz` remains as a legacy inventory-compatible probe.
- **Metrics:** scrape `GET /metrics` as Prometheus text. Do not put this endpoint on a
  public internet route; restrict it to the deployment's monitoring network.
- **It's database-free.** Rollback = redeploy the previous image tag. There are no
  schema migrations or user-profile database to restore; bounded in-memory render caches
  disappear with the process, while logs follow their configured retention lifecycle.
- **Kill switch:** scale to zero / take the ALB target out of service. Preserve relevant
  logs under the incident policy before changing retention or deleting evidence.

## Alarms → actions
| Alarm | Meaning | Action |
|-------|---------|--------|
| `freshness` job fails (CI or scheduled) | A `verified` record is past its SLA → would be served as stale | Re-verify the record against its source, then bump `last_verified` **or** flip `verification_status` to `needs_reverification`. Do NOT just bump the date without checking. |
| `source-watch` reports **drift** | A cited official page changed under a record — the law, fee, timeline, or process may have moved | Read the page, reconcile the record (EN + ES), then re-baseline **only that URL** — see the safe procedure under Common tasks. Never run `make source-baseline` to clear it. |
| `source-watch` reports a **baseline coverage issue** | A cited URL has no baseline (`missingBaseline`), or a baseline URL is no longer cited (`staleBaseline`) | Review the addition/removal deliberately. Note that coverage issues and drift are reported **together in one run** — a coverage gap does not suppress the drift report (it used to; see docs/STATUS.md). |
| `link-check` reports a URL **dead** | A cited source 404/410s, its DNS is gone, or the connection fails outright | Fix the citation: find where the page moved and repoint the record (then re-snapshot + re-baseline that URL), or drop the claim. This is the one link-check condition that fails the build. |
| `link-check` reports **`incomplete-TLS-chain`** (🔒) | The host serves a certificate **without the intermediate that signs it**. The link is **alive** — a browser repairs the chain via the cert's AIA extension; a strict client cannot. Today: the 4 **CDPH** URLs | **Not rot, and not our bug — do not "fix" it in the corpus.** It is reported, counted, and printed on every run, but it does not fail the build. The real fix belongs to CDPH (send the intermediate). Never "resolve" this by disabling certificate verification — see below. |
| `fidelity` gate fails with **`… not supported by their cited source`** | A record asserts a fee, a timeline, a form id, or a requirement that **the page it cites never states**. This is the class of bug the citation gate structurally cannot see: the citation is valid, the source hash never moved, and the record is still wrong | **Do not touch the snapshot.** Open the cited page and read it. Either correct the record to what the page says (EN + ES), or repoint it to a source that actually supports the claim, or drop the claim. Then `make source-snapshot` + re-baseline that URL. |
| `fidelity` gate fails with **`baseline-mismatch`** | A committed snapshot no longer hashes to the drift baseline for the same URL. Either the page moved and the snapshot was refreshed without re-baselining, or someone edited a snapshot to make the gate pass | Treat as **drift**: read the page, reconcile the record, then re-baseline that one URL (procedure below). This mismatch is the anti-laundering interlock — a doctored snapshot cannot buy a green build. |
| `fidelity` gate fails with **`unwatched-snapshot`** | A cited source has a snapshot but no entry in `corpus/source-hashes.json` — the fidelity gate would keep checking records against a frozen copy of a page that has since moved | Add the drift baseline for that URL (procedure below). The two mechanisms are only safe together: the snapshot says *what the page said*, the baseline notices *when it stops saying it*. |
| Eval regression (`make eval` red) | groundedness/accuracy/refusal/coverage dropped | Block the release. Inspect `docs/audits/eval-report.md` → the failing item's notes point at the corpus record or generator change. |
| Citation gate throws at runtime (500s spike) — CloudWatch alarm `trans-docs-navigator-500s-spike` (metric `ServerErrorCount`, filter `trans-docs-navigator-server-error`) | The generator produced an uncited claim | This is the gate working. Roll back the generator/corpus change. A 500 is correct behavior — better than rendering an unsourced legal claim. |
| `privacy` gate fails in CI | Runtime API code references a direct identity field, a log call references one, or the session-artifact ignore rule drifted | Block the merge. Find the offending line; keep identity-form handling client-side and keep raw content out of application logs. |
| `corpus_quarantine` log at startup (`quarantined > 0`) — CloudWatch alarm `trans-docs-navigator-corpus-quarantine` (metric `CorpusQuarantineCount`, filter `trans-docs-navigator-corpus-quarantine`) | A malformed record shipped; the server dropped it (fail-degraded) and is serving the rest | Inspect the bad record (CI `make content` names it), fix or revert it, redeploy. Service stays up meanwhile; the quarantined topic simply isn't served. |
| `answer` logs `degraded: true` spiking — CloudWatch alarm `trans-docs-navigator-degraded-answer-spike` (metric `DegradedAnswerCount`, filter `trans-docs-navigator-degraded-answer`) | Users are hitting stale/volatile records surfaced as "needs reverification" | Expected near a known volatile rule; if unexpected, check whether a record fell past its freshness SLA and reverify it. |
| `rate_limited` (429s) spiking — CloudWatch alarm `trans-docs-navigator-rate-limited-spike` (metric `Rate429Count`, filter `trans-docs-navigator-rate-limited`); coarse outer bound also enforced by the `aws_wafv2_web_acl.edge` WAF in front of the ALB | Sustained abuse past the in-process per-IP limiter (`api/server.ts`) and/or the edge WAF rate rule | Confirm it's not a single client retry-looping on a bug; if it's abuse, the WAF rate-based rule already blocks the offending IPs — no action needed beyond monitoring unless the edge limit itself needs tightening. |
| p95 first-token regression (Bedrock path) | Model latency | Confirm Bedrock region/endpoint; Haiku-first; check the VPC endpoint. |
| `TdnAvailabilityFastBurn` | 5xx events are spending the 99.9% availability budget at ≥14.4× across both 5m and 1h | **Page.** Check recent deploys and correlated `trace_id`; roll back a bad release. A citation-gate 500 is still safer than uncited output, but it consumes the same budget. |
| `TdnAvailabilitySlowBurn` | Availability budget is spending at ≥6× across 30m and 6h | Open an incident ticket, identify the highest-error bounded route, and remediate before the long window exhausts the budget. |
| `TdnLatencyFastBurn` | Responses over 1.5 s are spending the 99% latency budget at ≥14.4× across 5m and 1h | **Page.** Split by `http_route`; inspect Bedrock client-span duration for model-path traffic and infrastructure latency otherwise. |
| `TdnLatencySlowBurn` | Latency budget is spending at ≥6× across 30m and 6h | Open a performance ticket, preserve traces, and run the live k6 check before and after the change. |

Metrics are populated by `aws_cloudwatch_log_metric_filter` resources in `infra/main.tf`
reading `aws_cloudwatch_log_group.app` (`/trans-docs-navigator/app`), fed from the content-minimized
structured events emitted by `api/log.ts`'s `safeLog`. Alarm notifications require setting
`alarm_sns_topic_arn`; the edge WAF association requires setting `alb_arn` — both default to
`""` so `terraform validate`/`fmt -check` pass credential-free in CI (D5 / Phase 5.1).

## Common tasks
- **Add/fix a jurisdiction record:** edit `corpus/jurisdictions/*.json`, run
  `make content && make freshness && make citation && make fidelity && make eval`. A PR requires a real
  source + named verifier (see contribution path, ROADMAP §9). If you cited a **new URL**, you must
  also produce its two artifacts — a snapshot (`make source-snapshot`) and a drift baseline (below) —
  or `make fidelity` fails closed with `missing-snapshot` / `unwatched-snapshot`.
- **Refresh the source snapshots (`make source-snapshot`):** fetches every cited corpus source,
  normalizes it through the *same* `normalize()` the drift watcher hashes, and writes
  `corpus/snapshots/`. The merge-blocking `fidelity` gate reads those files **offline** — a live
  fetch inside CI would be flaky, and hammering a state health department on every PR is rude.

  ⚠️ **The `make source-baseline` warning applies here too, but the interlock is different — and
  that difference is the whole design.** This command adopts whatever the sources serve right now.
  What stops that from laundering drift is not discipline, it is arithmetic: every snapshot's
  sha256 must equal the drift baseline committed in `corpus/source-hashes.json` (both hash the same
  `normalize()` output). So refreshing a snapshot over a page that genuinely moved makes
  `make fidelity` fail with `baseline-mismatch`, and it keeps failing until a human runs the
  review-only re-baseline procedure below for that URL. **You cannot make the fidelity gate green
  by editing a snapshot.** That is the one property that makes an offline gate trustworthy.

  After running it: `git diff corpus/snapshots` and **read it**. A changed snapshot means an
  official page changed under a record.
- **Three cited sources cannot be watched at all, and that is reported, not hidden.**
  `www.nycourts.gov` and `www.health.ny.gov` (corpus sources), and the **SS-5 PDF** on
  `www.ssa.gov` (the forms-registry link), return **HTTP 403 to this project's declared
  user-agent** — and to `curl` with the same UA. They serve a browser and refuse a bot. We do
  **not** spoof a browser user-agent to get around a host that has said no, and we do **not**
  accept a hand-pasted snapshot (a snapshot whose provenance is "a human pasted it" is precisely
  the laundering path this machinery exists to close). The consequence is stated plainly rather
  than papered over: **8 records — the New York court-order records and all six New York
  birth-certificate records — have claims that no gate can verify.** They are counted as
  UNCHECKABLE in `docs/audits/source-fidelity.md` and surfaced in the launch-gate table. A human
  reading those pages in a browser is the only verification available; that is exactly what the
  named-human review gate is for.
- **The SSA records used to be in that list, and are not any more — the fix was to cite the
  authority, not to defeat the block.** Every page under `www.ssa.gov` (and `faq.ssa.gov`,
  `blog.ssa.gov`) 403s a non-browser client, so the two SSA records cited sources no gate could
  read. Rather than spoof a UA, the records were repointed to SSA's **Program Operations Manual
  System** on `secure.ssa.gov`, which serves our declared user-agent a clean **HTTP 200**. POMS is
  not a workaround: it is SSA's own binding internal policy manual — a *more* authoritative source
  than the public web page it replaced. Those two URLs are now snapshotted, drift-baselined, and
  fidelity-checked like any other. **When a host blocks you, look for the authority it publishes
  somewhere you are allowed to read.**
- **Mark volatile law as not-current:** set `verification_status: "needs_reverification"`.
  The runtime degrades it to "needs reverification" and the checklist flags the step.
- **Regenerate audit artifacts:** `make eval` (eval report); the other audit docs in
  `docs/audits/` are maintained by hand and reviewed per release.
- **Baseline a source that Node cannot fetch:** `make source-baseline` hashes every cited
  URL with `scripts/source-watch.ts` (`contentHash` for corpus pages, raw-bytes `binaryHash`
  for form PDFs). A few government hosts reject Node's `fetch` outright — **CDPH**
  (`www.cdph.ca.gov`) serves an incomplete TLS chain, and **`health.ny.gov`** WAFs a
  non-browser user-agent. For those, `binaryHash` returns `null`, so `--update` writes **no**
  baseline entry at all. That matters, because a URL with no baseline is a *missingBaseline*
  error (**fails**), whereas a URL that has one but can't be fetched is merely *unreachable*
  (**tolerated** — an outage is not a content change). So a Node-unfetchable source must still
  get a baseline, produced through the **identical hash path**, just fetched with `curl`:

  ```sh
  curl -sL -A "$UA" "$URL" | shasum -a 256   # forms: raw response bytes, redirects followed
  ```

  and merged into `forms/form-hashes.json` (or `corpus/source-hashes.json`). This is only
  legitimate because it is byte-identical to what `binaryHash` computes — verify that against
  a form PDF on a host Node *can* reach before trusting it. Today this covers CA `VS 24B` /
  `VS 23` and NY `DOH-5305` / `DOH-5303`.
- **Why `make link-check` distinguishes a broken server from a dead link (and why that is not a
  loophole).** Link rot and server misconfiguration are different facts, and the gate used to
  collapse them: CDPH (`www.cdph.ca.gov`) sends only its **leaf** certificate and omits the Sectigo
  intermediate that signs it, so Node's `fetch` throws `UNABLE_TO_VERIFY_LEAF_SIGNATURE` and four
  **live** CDPH links (the birth-record page, the fee page, and the `VS 24B` / `VS 23` forms — all
  serving HTTP 200 to a browser this minute) were reported as **dead**. A rot-detector that cries
  wolf gets switched off, and then it protects nobody.

  The distinction is drawn from evidence, not preference: a chain-validation error can only be
  raised **after** a TCP connection and a TLS handshake in which the server *handed us a
  certificate*. A dead host cannot do that — it fails with `ENOTFOUND` / `ECONNREFUSED` / a
  timeout, which `link-check` still reports as **dead**. So the chain error is itself proof the
  host is alive; what is broken is its TLS config. The gate then confirms the real HTTP status
  through a **chain-completing client** (`curl`, which repairs the chain from the certificate's AIA
  exactly as a browser does) and reports the URL as a named `incomplete-TLS-chain` condition.

  ⚠️ **Certificate verification is never disabled to do this.** There is no `-k` / `--insecure`, no
  `rejectUnauthorized: false`, and no `NODE_TLS_REJECT_UNAUTHORIZED=0` anywhere in the repo.
  Completing a chain the server *should* have sent is not the same as skipping validation — the
  certificate is still verified to a trusted root. Turning verification off would make the gate
  assert "this link is fine" on evidence it never checked; that is the same class of dishonesty as
  spoofing a browser user-agent past a host that has said no, and we do neither. The carve-out is
  scoped to the TLS error, **not** to the host: a genuine `404` behind CDPH's broken chain is still
  reported **dead** (there is a negative control for exactly that).
- **⚠️ `make source-baseline` is a loaded gun. It adopts everything.** It rewrites *both*
  baseline files wholesale from whatever the sources serve at that moment, so it will
  **silently adopt genuine upstream drift** on any source you did not actually re-verify —
  converting "a human must re-check this record" into "unchanged", permanently and
  invisibly. The drift signal is destroyed, not deferred. It is human-review-only, and
  running it to "make the gate green" is the single worst thing you can do to this repo:
  the gate going green is precisely the failure.

  **The safe procedure — re-baseline only what you actually re-read:**
  1. Run `make source-watch` and write down exactly which URLs it reports as drifted.
  2. For each one, **open the official page and read it.** Reconcile the record against
     what the page says *now* — statement, fee, timeline, prerequisites, form ids. A drifted
     source may mean the law or the process changed; correcting the record is the whole
     point of the machinery. Do it in EN *and* ES (the i18n parity gate).
  3. Re-baseline **only those URLs**, computed through the *identical* hash path — import
     `contentHash` / `binaryHash` from `scripts/source-watch.ts` in a throwaway script and
     patch just those keys, rather than running `--update` over everything.
  4. **Diff both baseline files before committing** (`git diff corpus/source-hashes.json
     forms/form-hashes.json`) and confirm every changed hash corresponds to a page you
     personally read. Any hash that moved without a matching record review is drift you
     just adopted blind — restore it.
  5. Remove a baseline entry only when no record/form cites the URL any more (e.g. you
     repointed a record to a source that actually supports its claim). A leftover entry is
     reported as a *staleBaseline* coverage issue, which is the gate asking you that question.
  6. Re-run `make source-snapshot` so the offline snapshot for that URL matches the baseline you
     just took, then `make fidelity` to confirm the record's claims are actually in the new text.
     If they are not, the page changed the *substance*, not just the markup — fix the record.

  If `--update` is ever the convenient answer, you are about to launder unread content into
  a "verified" claim about someone's legal name or gender marker. Take the slow path.
- **Re-baselining a drifted policy tracker (`make policy-watch` red).** Same discipline as
  `source-baseline`, and the same prohibition: **never run a blanket `make policy-baseline`** — it
  rewrites every tracker hash from whatever the pages serve at that moment and adopts drift nobody
  read. Re-baseline **only** the trackers you actually opened and read, by patching just those keys
  through the identical `contentHash` path.

  A tracker moving does **not** mean a record is wrong: it means every record in that tracker's
  jurisdiction is now a **candidate for re-verification**. The bar for clearing it is therefore not
  "the tracker looks fine", it is **"the records it implicates have been re-verified against their
  own official sources."** Do that first; clear the tracker second.

  Two honest limitations to know before you trust a green `policy-watch`:
  1. **It stores hashes, not content, so a true before/after diff is impossible.** There is no
     committed snapshot of a tracker's previous text, so you cannot see *what* changed — only that
     *something* did. You can read what the page says **now** and check that it does not contradict
     any record; that is the available check, and it is weaker than a diff. (Fixing this would mean
     giving the trackers the same snapshot treatment `corpus/snapshots/` gives cited sources.)
  2. **A tracker's `jurisdiction` tag decides which records its drift annotates, and one tag is
     mis-scoped.** *MAP — Nondiscrimination Laws* is tagged `US`, so when it moves it points a human
     at the eight **federal** records (SSA + passport). But that map is about **state** housing /
     public-accommodations / credit law and contains **zero** federal identity-document content
     (`social security`: 0, `passport`: 0, `federal`: 0 — its only "gender marker" strings are nav
     links to *other* MAP maps, and its "ssa" substrings are *Ma-**ssa**-chusetts*). Its drift is
     therefore near-pure noise against the records it names. The on-point tracker for this corpus is
     *MAP — Identity Document Laws*; weight that one heavily and treat Nondiscrimination drift with
     suspicion until it is re-scoped.
- **Validate observability contracts:** run `make slo && make smoke`. The first checks
  parsed rule-YAML structure plus SLO/runtime/window/rate/scope consistency; the second
  checks normal and exceptional trace continuity and metrics on a real server. In
  production, run `promtool check rules slos/prometheus.rules.yml` before loading the
  definitions into the monitoring backend. The request-based SLI excludes `/metrics`,
  `/livez`, `/readyz`, and `/healthz` from every numerator and denominator so monitoring
  traffic cannot dilute user-visible error or latency rates.

## Logging & privacy
Logs are structured JSON via `api/log.ts`, which allowlists bounded route, selection,
trace, status, and lifecycle fields. These records exclude raw questions, prompts,
completions, direct identity-form fields, and full URL query strings, but selection
metadata can still be sensitive. If you need a new log field, perform a privacy review,
add only a bounded value to the allowlist, and update the Privacy Notice/DPIA as needed.
The live-preview application log group retains records for 14 days; the production
Terraform template uses 30 days. Infrastructure providers may maintain separate access
or network records under their own policies.

Every HTTP response carries a W3C `traceparent`. Request records are server spans and
real Bedrock call records are child client spans sharing the same `trace_id`. Search by
`trace_id`, never by query content. GenAI records contain token counts, duration,
model/finish/error metadata, and cost only; `content_captured` must remain `false`.

## Escalation
- Wrong legal guidance reported by a user → treat as **P1**: pull the record (flip to
  `needs_reverification`), redeploy, then verify. Guidance correctness is a safety property.
- Suspected security issue → see `docs/audits/residual-risk.md` owners.
