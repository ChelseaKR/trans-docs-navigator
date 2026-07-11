# Trans Docs Navigator — gate-driven build.
# `make verify` runs the same blocking pipeline locally that CI runs on every PR
# (QUALITY-AND-METRICS-STANDARD.md §"enforcement pipeline"). No stage is advisory.

NODE := node --experimental-strip-types --no-warnings
SHELL := /bin/bash

.PHONY: help install dev verify eval eval-bedrock a11y loadtest \
        gate-count lint typecheck test security content forms citation privacy freshness disclosure readability i18n-utf8 i18n-bcp47 i18n i18n-logical-css i18n-overflow seo deploy-plan clean \
        smoke coverage link-check source-watch source-baseline policy-watch policy-baseline new-record

help:
	@echo "Targets:"
	@echo "  make install      Install dependencies"
	@echo "  make dev          Run the local dev server"
	@echo "  make verify       Run the full merge-blocking gate set (CI parity, 21 stages)"
	@echo "  make eval         Run the groundedness/accuracy/refusal eval harness"
	@echo "  make a11y         Run the accessibility gate"
	@echo "  make loadtest     In-process p95 latency guard (merge-blocking, no server needed)"
	@echo "  make deploy-plan  Validate infra (terraform plan)"

install:
	npm install

dev:
	$(NODE) api/server.ts

# ---------------------------------------------------------------------------
# The blocking pipeline, in standard order. Any non-zero exit fails the build.
# gate-count runs first so a drifted self-description count fails fast.
# ---------------------------------------------------------------------------
verify: gate-count lint typecheck test security content forms citation privacy freshness disclosure readability i18n-utf8 i18n-bcp47 i18n i18n-logical-css a11y seo eval i18n-overflow loadtest
	@echo ""
	@echo "✅ make verify: all merge-blocking gates passed."

# Derives the stage count from this file's own `verify:` prerequisite list and fails
# if README.md / docs/STATUS.md / the PR template state a different number.
gate-count:
	@echo "── [1/21] gate-count (self-description drift check) ──────"
	@$(NODE) scripts/gate-count.ts

lint:
	@echo "── [2/21] lint ───────────────────────────────────────────"
	@$(NODE) scripts/lint.ts

typecheck:
	@echo "── [3/21] type-check (tsc --strict) ──────────────────────"
	@npx --no-install tsc --noEmit

test:
	@echo "── [4/21] unit + integration tests (coverage-gated) ──────"
	@$(NODE) scripts/run-tests.ts

security:
	@echo "── [5/21] security: dependency audit + secret scan ───────"
	@$(NODE) scripts/security-scan.ts

content:
	@echo "── [6/21] corpus content validation (source+verifier+date)"
	@$(NODE) scripts/content-validate.ts

forms:
	@echo "── [7/21] forms: official links, no fake auto-fill ───────"
	@$(NODE) scripts/forms-check.ts

citation:
	@echo "── [8/21] citation coverage (100% required) ──────────────"
	@$(NODE) scripts/citation-coverage.ts

privacy:
	@echo "── [9/21] privacy lint (no PII in logs / no egress) ──────"
	@$(NODE) scripts/privacy-lint.ts

freshness:
	@echo "── [10/21] corpus freshness SLA ───────────────────────────"
	@$(NODE) scripts/freshness.ts

disclosure:
	@echo "── [11/21] disclosure strings (info-not-advice / AI label) ─"
	@$(NODE) scripts/disclosure-check.ts

readability:
	@echo "── [12/21] readability (plain-language ~8th-grade target) ─"
	@$(NODE) scripts/readability.ts

# Mechanical i18n gates (INTERNATIONALIZATION-STANDARD §4). G1 UTF-8 and G3 BCP-47
# tag-validity join the existing G6 EN/ES key-parity gate below, plus the G10 static
# logical-CSS gate (stylelint). The G9 pseudolocale overflow gate is i18n-overflow
# (browser, below). G2 (no-hardcoded-string extraction) and the MF1→MF2 audit (§9) are
# deferred; G12 (CLDR/tzdata pin) is N/A-until-used — the frontend does no Intl
# number/date formatting yet. ar/he RTL mirror smoke is deferred. See docs/I18N.md.
i18n-utf8:
	@echo "── [13/21] i18n: UTF-8 encoding (all tracked text files) ──"
	@$(NODE) scripts/i18n-utf8.ts

i18n-bcp47:
	@echo "── [14/21] i18n: BCP 47 language-tag validity ────────────"
	@$(NODE) scripts/i18n-bcp47.ts

i18n:
	@echo "── [15/21] locale key-parity (EN/ES, no empty translations) ─"
	@$(NODE) scripts/i18n-parity.ts

# G10 (static) — logical-CSS for RTL readiness. Extracts the typed STYLE from
# src/render.ts to a git-ignored artifact and lints the inline (writing-direction)
# axis with stylelint-use-logical (stylelint.config.js). Fix findings in render.ts.
i18n-logical-css:
	@echo "── [16/21] i18n: logical-CSS (G10 static, stylelint use-logical) ─"
	@$(NODE) scripts/i18n-css-extract.ts
	@npx --no-install stylelint tmp/app.generated.css

a11y:
	@echo "── [17/21] accessibility gate ────────────────────────────"
	@$(NODE) scripts/a11y-lint.ts

seo:
	@echo "── [18/21] SEO (indexing contract, metadata, sitemap) ────"
	@$(NODE) scripts/seo-lint.ts

eval:
	@echo "── [19/21] eval harness (groundedness/accuracy/refusal) ──"
	@$(NODE) eval/run.ts

# G9 (live) — pseudolocale overflow. Renders the key routes under the en-XA
# pseudolocale (~40% expansion, ⟦…⟧) on desktop + mobile and asserts no clipping,
# truncation, or horizontal scroll. Playwright starts the test server itself
# (TDN_I18N_TEST_HOOKS=1); production never registers en-XA. See docs/I18N.md.
i18n-overflow:
	@echo "── [20/21] i18n: pseudolocale overflow (G9, Playwright desktop+mobile) ─"
	@npx --no-install playwright test

# Deterministic in-process latency guard for the request path (QM-02, ROADMAP §7).
# Measures routing + retrieval + composition + render latency with no server/network
# dependency, so it runs merge-blocking in `make verify` == CI without flake risk.
# The network-level p95-first-token target remains a *separate*, opt-in check:
# `BASE=http://localhost:8080 k6 run loadtest/p95.k6.js` against a live instance
# (needs k6 + a running server, so it is not part of this merge-blocking target).
loadtest:
	@echo "── [21/21] request-path latency benchmark (in-process p95 guard) ─"
	@$(NODE) scripts/latency-bench.ts

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

# Weekly content-ops (content-watch.yml): watch the authoritative trackers (MAP, A4TE,
# legislative-tracker pages) upstream of any single cited source, and annotate affected
# records by jurisdiction when one changes.
policy-watch:
	@$(NODE) scripts/policy-watch.ts
policy-baseline:
	@$(NODE) scripts/policy-watch.ts --update

# Print a schema-valid corpus-record skeleton (dated today, placeholder verifier).
new-record:
	@$(NODE) scripts/new-record.ts

deploy-plan:
	@cd infra && terraform init -backend=false >/dev/null 2>&1 && terraform validate || \
		echo "terraform not installed — see infra/README.md for the validated plan"

clean:
	rm -rf coverage dist tmp
