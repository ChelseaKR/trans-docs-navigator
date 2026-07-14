// Gate-efficacy negative controls (FIX-05, docs/ideation/02-large-scale-fixes.md).
//
// "The gates must be able to fail." Each test here poisons ONE gate's input with a
// fixture embodying the exact harm that gate exists to catch, spawns the gate as a
// real child process (the same invocation `make verify` uses), and asserts it exits
// non-zero with a message naming the harm. A gate that has been accidentally
// short-circuited (e.g. refactored to `return pass(...)`) fails these tests even
// though every OTHER test in the repo stays green — that is the whole point.
//
// SCOPE: covers the 17 CLI/spawnable merge gates. Two gates are out of scope per the
// roadmap item's own spec and are covered by CI broken-fixture pages instead:
//   - a11y-lint.ts (pa11y-ci runs the deep accessibility pass in a real browser)
//   - i18n-overflow (Playwright pseudolocale-overflow gate; starts a browser+server)
// Two more are deferred with a TODO below (typecheck, eval) — see the note at the
// bottom of this file for why.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { runGate, fixture, REPO_ROOT, isolatedChildEnv } from "./runner.ts";

// ── content (scripts/content-validate.ts) ──────────────────────────────────────
// Harm: a corpus record ships with no source block (a claim with no provenance).
test("content gate fails on a corpus record missing its source block", () => {
  const r = runGate("content-validate", { env: { CORPUS_DIR: fixture("content-poison") } });
  assert.notEqual(r.code, 0);
  assert.match(r.output, /missing source block/);
});

// ── citation (scripts/citation-coverage.ts) ─────────────────────────────────────
// Harm: the generator emits a claim with no citation (should be structurally
// impossible via the deterministic composer — CITATION_POISON proves the CI gate
// still catches it if that "impossible" ever stops being true, e.g. a future
// model-backed generator).
test("citation gate fails on an uncited-claim answer path", () => {
  const r = runGate("citation-coverage", { env: { CITATION_POISON: "uncited-claim" } });
  assert.notEqual(r.code, 0);
  assert.match(r.output, /uncited-claim/);
});

// ── privacy (scripts/privacy-lint.ts) ───────────────────────────────────────────
// Harm: a PII field logged directly in app code.
test("privacy gate fails on a PII field in a log call", () => {
  const r = runGate("privacy-lint", { env: { PRIVACY_LINT_ROOT: fixture("privacy-poison") } });
  assert.notEqual(r.code, 0);
  assert.match(r.output, /PII in a log call/);
});

// Harm: runtime API code starts reading a direct identity-form field outside the thin
// HTTP shell. This proves the static gate covers the full runtime API directory.
test("privacy gate fails on direct identity-field handling anywhere in runtime API code", () => {
  const r = runGate("privacy-lint", { env: { PRIVACY_LINT_ROOT: fixture("privacy-api-poison") } });
  assert.notEqual(r.code, 0);
  assert.match(r.output, /runtime API references a direct identity field/);
});

// ── freshness (scripts/freshness.ts) ────────────────────────────────────────────
// Harm: a record marked `verified` whose last_verified date is years past its SLA —
// stale law served as current.
test("freshness gate fails on a stale-but-verified record", () => {
  const r = runGate("freshness", { env: { CORPUS_DIR: fixture("freshness-poison") } });
  assert.notEqual(r.code, 0);
  assert.match(r.output, /re-mark needs_reverification/);
});

// ── disclosure (scripts/disclosure-check.ts) ────────────────────────────────────
// Harm: a rendered page's visible banner is missing the "not legal advice" phrase.
test("disclosure gate fails on a page missing the visible disclosure", () => {
  const r = runGate("disclosure-check", { env: { DISCLOSURE_POISON: "1" } });
  assert.notEqual(r.code, 0);
  assert.match(r.output, /banner missing visible disclosure/);
});

// ── forms (scripts/forms-check.ts) ──────────────────────────────────────────────
// Harm: a form registry entry declares an auto-fill surface (the fake-form-fill bug
// this gate was built to prevent — see the script's own header comment).
test("forms gate fails on a registry entry declaring an auto-fill surface", () => {
  const r = runGate("forms-check", { env: { FORMS_REGISTRY: fixture("forms-poison", "registry.json") } });
  assert.notEqual(r.code, 0);
  assert.match(r.output, /must not declare "template_path"/);
});

// ── readability (scripts/readability.ts) ────────────────────────────────────────
// Harm: a record's prose falls below the hard reading-ease floor.
test("readability gate fails on prose below the reading-ease floor", () => {
  const r = runGate("readability", { env: { CORPUS_DIR: fixture("readability-poison") } });
  assert.notEqual(r.code, 0);
  assert.match(r.output, /below the ease-25 floor/);
});

// ── i18n / locale parity (scripts/i18n-parity.ts) ───────────────────────────────
// Harm: a key exists in the English bundle but was never ported to Spanish.
test("i18n-parity gate fails on an EN/ES key gap", () => {
  const r = runGate("i18n-parity", { env: { I18N_PARITY_POISON: "1" } });
  assert.notEqual(r.code, 0);
  assert.match(r.output, /es\.ui\.skip: missing/);
});

// ── i18n BCP 47 (scripts/i18n-bcp47.ts) ─────────────────────────────────────────
// Harm: a malformed/non-canonical language tag slips into the locale registry.
test("i18n-bcp47 gate fails on a malformed language tag", () => {
  const r = runGate("i18n-bcp47", { env: { I18N_BCP47_POISON: "1" } });
  assert.notEqual(r.code, 0);
  assert.match(r.output, /malformed BCP 47/);
});

// ── i18n logical CSS (scripts/i18n-css-extract.ts + stylelint) ─────────────────
// Harm: a physical (non-logical) inline-axis CSS property ships, breaking RTL
// mirroring. This gate is two Makefile steps (extract, then stylelint); reproduce
// both here against a throwaway output file so the real tmp/app.generated.css
// artifact is untouched.
test("i18n logical-css gate fails on a physical inline-axis property", () => {
  const dir = mkdtempSync(join(tmpdir(), "gate-efficacy-css-"));
  const out = join(dir, "poison.generated.css");
  try {
    const extract = runGate("i18n-css-extract", {
      env: { CSS_EXTRACT_POISON: "1", CSS_EXTRACT_OUT: out },
    });
    assert.equal(extract.code, 0, `extract step itself should succeed: ${extract.output}`);

    const stylelint = execFileSync(
      process.execPath,
      [join(REPO_ROOT, "node_modules", ".bin", "stylelint"), out],
      { cwd: REPO_ROOT, encoding: "utf8" },
    ).toString();
    assert.fail(`expected stylelint to reject the poisoned CSS, but it exited 0. Output:\n${stylelint}`);
  } catch (e) {
    // execFileSync throws on non-zero exit; that IS the expected outcome here.
    const err = e as { status?: number; stdout?: string; stderr?: string; message: string };
    if (!("status" in err)) throw err; // assert.fail() above re-thrown unchanged
    assert.notEqual(err.status, 0);
    const combined = `${err.stdout ?? ""}${err.stderr ?? ""}`;
    assert.match(combined, /logical/i);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── i18n UTF-8 (scripts/i18n-utf8.ts) ───────────────────────────────────────────
// Harm: a tracked text file is saved in a legacy 8-bit encoding, silently mangling
// accented Spanish characters. This gate has NO input parameter at all — it walks
// `git ls-files` in its cwd — so the negative control is a disposable, real git repo
// (never committed to the real repo) containing one non-UTF-8 tracked file. No
// source-code injection point was needed or added.
test("fixture child environments drop ambient Git repository identity", () => {
  assert.deepEqual(
    Object.keys(isolatedChildEnv()).filter((key) => key.startsWith("GIT_")),
    [],
  );
});

test("i18n-utf8 gate fails on a non-UTF-8 tracked file", () => {
  const dir = mkdtempSync(join(tmpdir(), "gate-efficacy-utf8-"));
  const gitEnv = isolatedChildEnv({
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
  });
  try {
    execFileSync("git", ["init", "-q"], { cwd: dir, env: gitEnv });
    execFileSync("git", ["config", "user.email", "poison@example.test"], {
      cwd: dir,
      env: gitEnv,
    });
    execFileSync("git", ["config", "user.name", "Poison Fixture"], {
      cwd: dir,
      env: gitEnv,
    });
    // A latin1 byte sequence (0xE9 = "é" in latin1) that is NOT valid UTF-8.
    writeFileSync(join(dir, "bad-encoding.txt"), Buffer.from([0x63, 0x61, 0x66, 0xe9]));
    execFileSync("git", ["add", "-A"], { cwd: dir, env: gitEnv });
    execFileSync("git", ["commit", "-q", "-m", "poison"], { cwd: dir, env: gitEnv });

    const r = runGate("i18n-utf8", { cwd: dir });
    assert.notEqual(r.code, 0);
    assert.match(r.output, /must be utf-8 or us-ascii/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── seo (scripts/seo-lint.ts) ───────────────────────────────────────────────────
// Harm: an indexable page is missing its self-referential canonical link.
test("seo gate fails on an indexable page missing its canonical link", () => {
  const r = runGate("seo-lint", { env: { SEO_POISON: "1" } });
  assert.notEqual(r.code, 0);
  assert.match(r.output, /canonical missing or wrong/);
});

// ── security (scripts/security-scan.ts) ─────────────────────────────────────────
// Harm: a hardcoded credential committed to app code.
test("security gate fails on a hardcoded secret", () => {
  const r = runGate("security-scan", { env: { SECURITY_SCAN_ROOT: fixture("security-poison") } });
  assert.notEqual(r.code, 0);
  assert.match(r.output, /possible hardcoded bearer\/secret/);
});

// ── lint (scripts/lint.ts) ──────────────────────────────────────────────────────
// Harm: a stray console.log left in shipping app code.
test("lint gate fails on a stray console.log in app code", () => {
  const r = runGate("lint", { env: { LINT_ROOT: fixture("lint-poison") } });
  assert.notEqual(r.code, 0);
  assert.match(r.output, /console\.log in app code/);
});

// ── test (scripts/run-tests.ts) ─────────────────────────────────────────────────
// Harm: the test gate silently swallows a real test failure instead of forwarding
// the Node test-runner's non-zero exit code.
test("test gate fails when the underlying test run fails", () => {
  const r = runGate("run-tests", {
    env: { RUN_TESTS_GLOB: fixture("run-tests-poison", "broken.fixture.ts") },
  });
  assert.notEqual(r.code, 0);
  assert.match(r.output, /tests failed or coverage below threshold/);
});

// ── Deferred (documented, not covered here) ─────────────────────────────────────
// - typecheck (`tsc --noEmit`): not a scripts/*.ts gate with a pass()/fail() message
//   contract — it's a whole-project compile, and its "failure message" is tsc's own
//   diagnostic output, not ours. A meaningful negative control here means standing up
//   an isolated tsconfig + fixture module, which is a bigger side-quest than this
//   suite's scope; TODO a follow-up item if this needs its own regression coverage.
// - eval (`eval/run.ts`): a groundedness/accuracy/refusal harness, not named in this
//   roadmap item's fixture list; poisoning it meaningfully needs its own eval-case
//   fixture set (a separate, larger effort). TODO a follow-up item.
// Both remain covered indirectly: eval and typecheck both call into api/* code paths
// that ARE exercised by tests/*.test.ts and by the OTHER gate-efficacy tests above
// (e.g. citation/disclosure poisoning both go through api/guidance.ts).
