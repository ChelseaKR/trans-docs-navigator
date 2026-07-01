# Trans Docs Navigator — gate-driven build.
# `make verify` runs the same blocking pipeline locally that CI runs on every PR
# (QUALITY-AND-METRICS-STANDARD.md §"enforcement pipeline"). No stage is advisory.

NODE := node --experimental-strip-types --no-warnings
SHELL := /bin/bash

.PHONY: help install dev verify eval eval-bedrock a11y loadtest \
        lint typecheck test security content forms citation privacy freshness disclosure readability i18n-utf8 i18n-bcp47 i18n i18n-logical-css i18n-overflow seo deploy-plan clean \
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
verify: lint typecheck test security content forms citation privacy freshness disclosure readability i18n-utf8 i18n-bcp47 i18n i18n-logical-css a11y seo eval i18n-overflow
	@echo ""
	@echo "✅ make verify: all merge-blocking gates passed."

lint:
	@echo "── [1/17] lint ───────────────────────────────────────────"
	@$(NODE) scripts/lint.ts

typecheck:
	@echo "── [2/17] type-check (tsc --strict) ──────────────────────"
	@npx --no-install tsc --noEmit

test:
	@echo "── [3/17] unit + integration tests (coverage-gated) ──────"
	@$(NODE) scripts/run-tests.ts

security:
	@echo "── [4/17] security: dependency audit + secret scan ───────"
	@$(NODE) scripts/security-scan.ts

content:
	@echo "── [5/17] corpus content validation (source+verifier+date)"
	@$(NODE) scripts/content-validate.ts

forms:
	@echo "── [6/17] forms: official links, no fake auto-fill ───────"
	@$(NODE) scripts/forms-check.ts

citation:
	@echo "── [7/17] citation coverage (100% required) ──────────────"
	@$(NODE) scripts/citation-coverage.ts

privacy:
	@echo "── [8/17] privacy lint (no PII in logs / no egress) ──────"
	@$(NODE) scripts/privacy-lint.ts

freshness:
	@echo "── [9/17] corpus freshness SLA ───────────────────────────"
	@$(NODE) scripts/freshness.ts

disclosure:
	@echo "── [10/17] disclosure strings (info-not-advice / AI label) ─"
	@$(NODE) scripts/disclosure-check.ts

readability:
	@echo "── [11/17] readability (plain-language ~8th-grade target) ─"
	@$(NODE) scripts/readability.ts

# Mechanical i18n gates (INTERNATIONALIZATION-STANDARD §4). G1 UTF-8 and G3 BCP-47
# tag-validity join the existing G6 EN/ES key-parity gate below, plus the G10 static
# logical-CSS gate (stylelint). The G9 pseudolocale overflow gate is i18n-overflow
# (browser, below). G2 (no-hardcoded-string extraction) and the MF1→MF2 audit (§9) are
# deferred; G12 (CLDR/tzdata pin) is N/A-until-used — the frontend does no Intl
# number/date formatting yet. ar/he RTL mirror smoke is deferred. See docs/I18N.md.
i18n-utf8:
	@echo "── [12/19] i18n: UTF-8 encoding (all tracked text files) ──"
	@$(NODE) scripts/i18n-utf8.ts

i18n-bcp47:
	@echo "── [13/19] i18n: BCP 47 language-tag validity ────────────"
	@$(NODE) scripts/i18n-bcp47.ts

i18n:
	@echo "── [14/19] locale key-parity (EN/ES, no empty translations) ─"
	@$(NODE) scripts/i18n-parity.ts

# G10 (static) — logical-CSS for RTL readiness. Extracts the typed STYLE from
# src/render.ts to a git-ignored artifact and lints the inline (writing-direction)
# axis with stylelint-use-logical (stylelint.config.js). Fix findings in render.ts.
i18n-logical-css:
	@echo "── [15/19] i18n: logical-CSS (G10 static, stylelint use-logical) ─"
	@$(NODE) scripts/i18n-css-extract.ts
	@npx --no-install stylelint tmp/app.generated.css

a11y:
	@echo "── [16/19] accessibility gate ────────────────────────────"
	@$(NODE) scripts/a11y-lint.ts

seo:
	@echo "── [17/19] SEO (indexing contract, metadata, sitemap) ────"
	@$(NODE) scripts/seo-lint.ts

eval:
	@echo "── [18/19] eval harness (groundedness/accuracy/refusal) ──"
	@$(NODE) eval/run.ts

# G9 (live) — pseudolocale overflow. Renders the key routes under the en-XA
# pseudolocale (~40% expansion, ⟦…⟧) on desktop + mobile and asserts no clipping,
# truncation, or horizontal scroll. Playwright starts the test server itself
# (TDN_I18N_TEST_HOOKS=1); production never registers en-XA. See docs/I18N.md.
i18n-overflow:
	@echo "── [19/19] i18n: pseudolocale overflow (G9, Playwright desktop+mobile) ─"
	@npx --no-install playwright test

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
