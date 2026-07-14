# Trans Docs Navigator — gate-driven build.
# `make verify` runs the same blocking pipeline locally that CI runs on every PR
# (QUALITY-AND-METRICS-STANDARD.md §"enforcement pipeline"). No stage is advisory.

NODE := node --experimental-strip-types --no-warnings
SHELL := /bin/bash

.PHONY: help install dev verify eval eval-bedrock a11y loadtest \
        gate-count lint typecheck test security content forms citation fidelity privacy freshness disclosure readability i18n-utf8 i18n-bcp47 i18n i18n-logical-css i18n-overflow seo launch-gates launch-gates-write deploy-plan clean \
        smoke e2e-journey coverage link-check source-watch source-baseline source-snapshot policy-watch policy-baseline new-record slo corpus-manifest build dataset

help:
	@echo "Targets:"
	@echo "  make install      Install dependencies"
	@echo "  make dev          Run the local dev server"
	@echo "  make verify       Run the full merge-blocking gate set (CI parity, 24 stages)"
	@echo "  make eval         Run the groundedness/accuracy/refusal eval harness"
	@echo "  make a11y         Run the accessibility gate"
	@echo "  make loadtest     In-process p95 latency guard (merge-blocking, no server needed)"
	@echo "  make build        Build the production container image"
	@echo "  make deploy-plan  Validate infra (terraform plan)"

install:
	npm install

dev:
	NODE_ENV=development $(NODE) api/server.ts

# ---------------------------------------------------------------------------
# The blocking pipeline, in standard order. Any non-zero exit fails the build.
# gate-count runs first so a drifted self-description count fails fast.
# ---------------------------------------------------------------------------
verify: gate-count lint typecheck test security content forms citation fidelity privacy freshness disclosure readability i18n-utf8 i18n-bcp47 i18n i18n-logical-css a11y seo eval i18n-overflow loadtest slo launch-gates
	@echo ""
	@echo "✅ make verify: all merge-blocking gates passed."

# Derives the stage count from this file's own `verify:` prerequisite list and fails
# if README.md / docs/STATUS.md / the PR template state a different number.
gate-count:
	@echo "── [1/24] gate-count (self-description drift check) ──────"
	@$(NODE) scripts/gate-count.ts

lint:
	@echo "── [2/24] lint ───────────────────────────────────────────"
	@$(NODE) scripts/lint.ts

typecheck:
	@echo "── [3/24] type-check (tsc --strict) ──────────────────────"
	@npx --no-install tsc --noEmit

test:
	@echo "── [4/24] unit + integration tests (coverage-gated) ──────"
	@$(NODE) scripts/run-tests.ts

security:
	@echo "── [5/24] security: dependency audit + secret scan ───────"
	@$(NODE) scripts/security-scan.ts

content:
	@echo "── [6/24] corpus content validation (source+verifier+date)"
	@$(NODE) scripts/content-validate.ts

forms:
	@echo "── [7/24] forms: official links, no fake auto-fill ───────"
	@$(NODE) scripts/forms-check.ts

citation:
	@echo "── [8/24] citation coverage (100% required) ──────────────"
	@$(NODE) scripts/citation-coverage.ts

# The bottom link of the citation chain. `citation` proves an answer cites a RECORD;
# `fidelity` proves the RECORD is supported by the SOURCE IT CITES. Nothing checked that
# before, which is how the corpus came to assert a form and a $0 fee the DMV page never
# mentioned — with an unchanged source hash, so source-watch saw nothing either. Runs
# offline against the committed snapshots in corpus/snapshots/ (refresh: make source-snapshot).
fidelity:
	@echo "── [9/24] source fidelity (does each record match its cited source?) ─"
	@$(NODE) scripts/source-fidelity.ts --report

privacy:
	@echo "── [10/24] privacy lint (no runtime identity fields / log references)"
	@$(NODE) scripts/privacy-lint.ts

freshness:
	@echo "── [11/24] corpus freshness SLA ───────────────────────────"
	@$(NODE) scripts/freshness.ts

disclosure:
	@echo "── [12/24] disclosure strings (info-not-advice / AI label) ─"
	@$(NODE) scripts/disclosure-check.ts

readability:
	@echo "── [13/24] readability (plain-language ~8th-grade target) ─"
	@$(NODE) scripts/readability.ts

# Mechanical i18n gates (INTERNATIONALIZATION-STANDARD §4). G1 UTF-8 and G3 BCP-47
# tag-validity join the existing G6 EN/ES key-parity gate below, plus the G10 static
# logical-CSS gate (stylelint). The G9 pseudolocale overflow gate is i18n-overflow
# (browser, below). G2 (no-hardcoded-string extraction) and the MF1→MF2 audit (§9) are
# deferred; G12 (CLDR/tzdata pin) is N/A-until-used — the frontend does no Intl
# number/date formatting yet. ar/he RTL mirror smoke is deferred. See docs/I18N.md.
i18n-utf8:
	@echo "── [14/24] i18n: UTF-8 encoding (all tracked text files) ──"
	@$(NODE) scripts/i18n-utf8.ts

i18n-bcp47:
	@echo "── [15/24] i18n: BCP 47 language-tag validity ────────────"
	@$(NODE) scripts/i18n-bcp47.ts

i18n:
	@echo "── [16/24] locale key-parity (EN/ES, no empty translations) ─"
	@$(NODE) scripts/i18n-parity.ts

# G10 (static) — logical-CSS for RTL readiness. Extracts the typed STYLE from
# src/render.ts to a git-ignored artifact and lints the inline (writing-direction)
# axis with stylelint-use-logical (stylelint.config.js). Fix findings in render.ts.
i18n-logical-css:
	@echo "── [17/24] i18n: logical-CSS (G10 static, stylelint use-logical) ─"
	@$(NODE) scripts/i18n-css-extract.ts
	@npx --no-install stylelint tmp/app.generated.css

a11y:
	@echo "── [18/24] accessibility gate ────────────────────────────"
	@$(NODE) scripts/a11y-lint.ts

seo:
	@echo "── [19/24] SEO (indexing contract, metadata, sitemap) ────"
	@$(NODE) scripts/seo-lint.ts

eval:
	@echo "── [20/24] eval harness (groundedness/accuracy/refusal) ──"
	@$(NODE) eval/run.ts

# G9 (live) — pseudolocale overflow. Renders the key routes under the en-XA
# pseudolocale (~40% expansion, ⟦…⟧) on desktop + mobile and asserts no clipping,
# truncation, or horizontal scroll. Playwright starts the test server itself
# (TDN_I18N_TEST_HOOKS=1); production never registers en-XA. See docs/I18N.md.
i18n-overflow:
	@echo "── [21/24] i18n: pseudolocale overflow (G9, Playwright desktop+mobile) ─"
	@npx --no-install playwright test

# Deterministic in-process latency guard for the request path (QM-02, ROADMAP §7).
# Measures routing + retrieval + composition + render latency with no server/network
# dependency, so it runs merge-blocking in `make verify` == CI without flake risk.
# The network-level p95-first-token target remains a *separate*, opt-in check:
# `BASE=http://localhost:8080 k6 run loadtest/p95.k6.js` against a live instance
# (needs k6 + a running server, so it is not part of this merge-blocking target).
loadtest:
	@echo "── [22/24] request-path latency benchmark (in-process p95 guard) ─"
	@$(NODE) scripts/latency-bench.ts

slo:
	@echo "── [23/24] SLO definitions + multi-window burn alerts ────────────"
	@$(NODE) scripts/slo-check.ts

# Anti-drift on the OPEN REVIEW GATES, the way gate-count is anti-drift on the stage count.
# Derives each launch gate's status from the artifacts themselves (verifier roster, the
# source-fidelity audit, drift baselines, gold provenance, docs/signoffs/) and fails if
# README.md or docs/STATUS.md claim anything else. A launch gate cannot be cleared by
# editing a sentence — only by producing the evidence.
launch-gates:
	@echo "── [24/24] launch-gate status (machine-derived, anti-drift) ──────"
	@$(NODE) scripts/launch-gates.ts

# Regenerate the launch-gate block in README.md + docs/STATUS.md after a real change.
launch-gates-write:
	@$(NODE) scripts/launch-gates.ts --write

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

# D2 — real-browser journey against the production server. This complements `smoke`
# by executing the copy/resume client modules and pinning their no-request boundary.
e2e-journey:
	@echo "── real-browser E2E journey (Playwright, desktop+mobile) ─"
	@npx --no-install playwright test --config playwright.journey.config.ts

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

# Refresh the offline snapshots the merge-blocking `fidelity` gate reads (corpus/snapshots/).
# ⚠️ Deliberate, human-driven, and NOT a way to make a red gate green: every snapshot must
# still hash to the drift baseline in corpus/source-hashes.json, so refreshing a snapshot over
# genuine upstream drift makes `make fidelity` fail with a baseline-mismatch until a human runs
# the review-only re-baseline procedure. See docs/OPERATIONS.md.
source-snapshot:
	@$(NODE) scripts/source-snapshot.ts

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

# Build the versioned, signed public-dataset release bundle (EXP-08): schema,
# records, verifier roster, per-jurisdiction labels, and a hash manifest under
# dist/dataset/. `.github/workflows/release.yml`'s `dataset` job runs the same
# command on tagged releases and attests provenance over the result.
dataset:
	@echo "── dataset release bundle (schema+records+verifiers+labels+manifest) ─"
	@$(NODE) scripts/dataset-build.ts

deploy-plan:
	@cd infra && terraform init -backend=false >/dev/null 2>&1 && terraform validate || \
		echo "terraform not installed — see infra/README.md for the validated plan"

# ---------------------------------------------------------------------------
# Build (FIX-09 §A): the corpus integrity attestation. Regenerates
# corpus.manifest.json from the corpus/forms bytes about to ship, so the digest
# baked into the image always matches what's actually in it. The Dockerfile also
# runs `scripts/corpus-manifest.ts` itself as a RUN step, so the manifest is baked
# in regardless of whether the image is built through this target or a bare
# `docker build .` (as CI's container-scan/release/deploy workflows do).
# ---------------------------------------------------------------------------
corpus-manifest:
	@echo "── corpus integrity manifest (FIX-09 §A) ─────────────────"
	@npm run --silent corpus:manifest

build: corpus-manifest
	docker build -t trans-docs-navigator .

clean:
	rm -rf coverage dist tmp
