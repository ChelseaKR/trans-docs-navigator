# Trans Docs Navigator — gate-driven build.
# `make verify` runs the same blocking pipeline locally that CI runs on every PR
# (QUALITY-AND-METRICS-STANDARD.md §"enforcement pipeline"). No stage is advisory.

NODE := node --experimental-strip-types --no-warnings
SHELL := /bin/bash

.PHONY: help install dev verify eval eval-bedrock a11y loadtest \
        lint typecheck test security content citation privacy freshness disclosure readability deploy-plan clean \
        smoke coverage link-check source-watch source-baseline new-record

help:
	@echo "Targets:"
	@echo "  make install      Install dependencies"
	@echo "  make dev          Run the local dev server"
	@echo "  make verify       Run the full merge-blocking gate set (CI parity)"
	@echo "  make eval         Run the groundedness/accuracy/refusal eval harness"
	@echo "  make a11y         Run the accessibility gate"
	@echo "  make deploy-plan  Validate infra (terraform plan)"

install:
	npm install

dev:
	$(NODE) api/server.ts

# ---------------------------------------------------------------------------
# The blocking pipeline, in standard order. Any non-zero exit fails the build.
# ---------------------------------------------------------------------------
verify: lint typecheck test security content citation privacy freshness disclosure readability a11y eval
	@echo ""
	@echo "✅ make verify: all merge-blocking gates passed."

lint:
	@echo "── [1/12] lint ───────────────────────────────────────────"
	@$(NODE) scripts/lint.ts

typecheck:
	@echo "── [2/12] type-check (tsc --strict) ──────────────────────"
	@npx --no-install tsc --noEmit

test:
	@echo "── [3/12] unit + integration tests (coverage-gated) ──────"
	@$(NODE) scripts/run-tests.ts

security:
	@echo "── [4/12] security: dependency audit + secret scan ───────"
	@$(NODE) scripts/security-scan.ts

content:
	@echo "── [5/12] corpus content validation (source+verifier+date)"
	@$(NODE) scripts/content-validate.ts

citation:
	@echo "── [6/12] citation coverage (100% required) ──────────────"
	@$(NODE) scripts/citation-coverage.ts

privacy:
	@echo "── [7/12] privacy lint (no PII in logs / no egress) ──────"
	@$(NODE) scripts/privacy-lint.ts

freshness:
	@echo "── [8/12] corpus freshness SLA ───────────────────────────"
	@$(NODE) scripts/freshness.ts

disclosure:
	@echo "── [9/12] disclosure strings (info-not-advice / AI label) ─"
	@$(NODE) scripts/disclosure-check.ts

readability:
	@echo "── [10/12] readability (plain-language ~8th-grade target) ─"
	@$(NODE) scripts/readability.ts

a11y:
	@echo "── [11/12] accessibility gate ────────────────────────────"
	@$(NODE) scripts/a11y-lint.ts

eval:
	@echo "── [12/12] eval harness (groundedness/accuracy/refusal) ──"
	@$(NODE) eval/run.ts

# Opt-in model-path safety lane (not in `verify`; offline by default, real Bedrock with
# TDN_BEDROCK=aws + AWS credentials). Proves the citation gate holds for the model path.
eval-bedrock:
	@echo "── model-path eval (BedrockGenerator → citation.enforce) ──"
	@$(NODE) eval/run-bedrock.ts

# ---------------------------------------------------------------------------
# Operational checks (not in `verify`; run on push/schedule by CI workflows).
# ---------------------------------------------------------------------------

# Real-server journey: intake → checklist → packet → form-fill in EN+ES, plus
# assets and the strict CSP. Catches what render-level tests can't.
smoke:
	@echo "── synthetic user journey (real server) ──────────────────"
	@$(NODE) scripts/smoke-journey.ts

# Regenerate the public coverage matrix (docs/audits/coverage.md).
coverage:
	@$(NODE) scripts/coverage-matrix.ts

# Weekly content-ops (content-watch.yml): do the cited sources still resolve,
# and has any source page changed under a record since its baseline?
link-check:
	@$(NODE) scripts/link-check.ts
source-watch:
	@$(NODE) scripts/source-watch.ts
source-baseline:
	@$(NODE) scripts/source-watch.ts --update

# Print a schema-valid corpus-record skeleton (dated today, placeholder verifier).
new-record:
	@$(NODE) scripts/new-record.ts

# Deterministic in-process latency guard for the request path. The network-level p95
# first-token target (ROADMAP §7) is loadtest/p95.k6.js, run against a live instance.
loadtest:
	@echo "── request-path latency benchmark ───────────────────────"
	@$(NODE) scripts/latency-bench.ts

deploy-plan:
	@cd infra && terraform init -backend=false >/dev/null 2>&1 && terraform validate || \
		echo "terraform not installed — see infra/README.md for the validated plan"

clean:
	rm -rf coverage dist tmp
