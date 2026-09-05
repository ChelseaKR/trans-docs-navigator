// Gate-efficacy negative controls (FIX-05, docs/ideation/02-large-scale-fixes.md).
//
// "The gates must be able to fail." Each test here poisons ONE gate's input with a
// fixture embodying the exact harm that gate exists to catch, spawns the gate as a
// real child process (the same invocation `make verify` uses), and asserts it exits
// non-zero with a message naming the harm. A gate that has been accidentally
// short-circuited (e.g. refactored to `return pass(...)`) fails these tests even
// though every OTHER test in the repo stays green — that is the whole point.
//
// SCOPE: covers the 20 CLI/spawnable merge gates. Two gates are out of scope per the
// roadmap item's own spec and are covered by CI broken-fixture pages instead:
//   - a11y-lint.ts (pa11y-ci runs the deep accessibility pass in a real browser)
//   - i18n-overflow (Playwright pseudolocale-overflow gate; starts a browser+server)
// One remains deferred (typecheck) — see the note at the bottom of this file for why.
//
// A gate with more than one half needs a control per half. `security` has two (a
// dependency audit and a secret scan) and only the secret half was covered here, which
// is exactly how the audit half came to fail open — silently printing "0C/0H" for an
// audit that never ran. Both halves are covered now, and so is `eval`.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { runGate, runScript, fixture, REPO_ROOT, isolatedChildEnv } from "./runner.ts";

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

// ── fidelity (scripts/source-fidelity.ts) ───────────────────────────────────────
// Harm: THE bug this whole gate exists for. A record asserts a fee, a form, and a timeline
// that its cited source never states — and every other gate stays green, because the citation
// is perfectly valid and the source's hash never moved. The fixture is the California DMV
// record as it actually shipped: "Gender Category Request (Form DL 329)", "no fee", "2 weeks",
// citing a page that says none of those things.
test("fidelity gate fails on a record asserting a fee and a form its cited source never states", () => {
  const dir = fixture("fidelity-poison");
  const r = runGate("source-fidelity", {
    env: {
      CORPUS_DIR: join(dir, "corpus"),
      FIDELITY_INDEX: join(dir, "snapshots", "index.json"),
      FIDELITY_SNAPSHOT_DIR: join(dir, "snapshots"),
      FIDELITY_BASELINE: join(dir, "source-hashes.json"),
    },
  });
  assert.notEqual(r.code, 0);
  assert.match(r.output, /the source never states it is free/);
  assert.match(r.output, /the source never names DL329/);
  assert.match(r.output, /"2 week" does not appear anywhere in the source/);
});

// Harm: someone "fixes" a red fidelity gate by editing the committed snapshot instead of the
// record — laundering an unsourced legal claim into a green build. The snapshot's hash must
// still equal the human-review-only drift baseline in corpus/source-hashes.json, so it can't.
test("fidelity gate fails when a snapshot has been edited to make a record pass", () => {
  const src = fixture("fidelity-poison");
  const dir = mkdtempSync(join(tmpdir(), "gate-efficacy-fidelity-"));
  try {
    cpSync(src, dir, { recursive: true });
    const index = JSON.parse(readFileSync(join(dir, "snapshots", "index.json"), "utf8")) as {
      snapshots: Record<string, { file: string; sha256: string }>;
    };
    const entry = Object.values(index.snapshots)[0]!;
    const snapshotPath = join(dir, "snapshots", entry.file);
    // Doctor the snapshot so it now "says" everything the poisoned record claims, and update
    // the index hash to match — i.e. do the laundering as competently as possible.
    const doctored =
      readFileSync(snapshotPath, "utf8") +
      " complete the gender category request form dl 329. there is no fee. the card arrives in 2 weeks.";
    writeFileSync(snapshotPath, doctored);
    index.snapshots[Object.keys(index.snapshots)[0]!]!.sha256 = createHash("sha256")
      .update(doctored)
      .digest("hex");
    writeFileSync(join(dir, "snapshots", "index.json"), JSON.stringify(index, null, 2));

    const r = runGate("source-fidelity", {
      env: {
        CORPUS_DIR: join(dir, "corpus"),
        FIDELITY_INDEX: join(dir, "snapshots", "index.json"),
        FIDELITY_SNAPSHOT_DIR: join(dir, "snapshots"),
        // The drift baseline is NOT doctored — it is the one artifact the procedure in
        // docs/OPERATIONS.md says a human must review before it ever changes.
        FIDELITY_BASELINE: join(src, "source-hashes.json"),
      },
    });
    assert.notEqual(r.code, 0, "a doctored snapshot must not be able to make the gate pass");
    assert.match(r.output, /baseline-mismatch/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── launch-gates (scripts/launch-gates.ts) ──────────────────────────────────────
// Harm: the README claims the corpus has been human-verified (or that counsel signed off)
// when no such thing happened. The launch-gate status is derived from the artifacts, so a
// doc that says otherwise fails the build — it cannot be cleared with a text editor.
test("launch-gates gate fails when a doc overclaims a launch gate the artifacts don't support", () => {
  const r = runGate("launch-gates", {
    env: { LAUNCH_GATES_DOC_ROOT: fixture("launch-gates-poison") },
  });
  assert.notEqual(r.code, 0);
  assert.match(r.output, /drifted from the derived launch-gate status/);
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
// This gate has TWO halves and needs a negative control for each. Only the secret-scan
// half was covered here originally, which is exactly why the dependency-advisory half
// was free to fail open for as long as it did: `JSON.parse(stdout || "{}")` never
// throws, so an audit that never ran left the counters at 0 and printed a green
// "no high/critical dependency advisories (0C/0H)". Three controls now:
//   1. secret half — a hardcoded credential.
//   2. advisory half, positive — a lockfile with a real critical advisory.
//   3. advisory half, fail-closed — an audit that cannot run must not be a pass.

// Harm: a hardcoded credential committed to app code.
test("security gate fails on a hardcoded secret", () => {
  const r = runGate("security-scan", { env: { SECURITY_SCAN_ROOT: fixture("security-poison") } });
  assert.notEqual(r.code, 0);
  assert.match(r.output, /possible hardcoded bearer\/secret/);
});

// Harm: a dependency carrying a high/critical advisory ships (SEC-12). The poisoned
// tree is written to a temp dir rather than committed as a fixture on purpose: a
// checked-in lockfile pinning a known-vulnerable package would be picked up by the
// repository's own dependency graph and raise a permanent, bogus Dependabot alert
// against this repo. lodash 4.17.4 carries GHSA-jf85-cpcp-j695 (prototype pollution,
// CRITICAL); the advisory is a decade-stable historical record, and `npm audit`
// resolves it from the lockfile alone, with no node_modules install.
test("security gate fails on a dependency carrying a critical advisory", () => {
  const dir = mkdtempSync(join(tmpdir(), "gate-efficacy-audit-"));
  try {
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify(
        { name: "advisory-poison-fixture", private: true, version: "0.0.0", dependencies: { lodash: "4.17.4" } },
        null,
        2,
      ),
    );
    writeFileSync(
      join(dir, "package-lock.json"),
      JSON.stringify(
        {
          name: "advisory-poison-fixture",
          version: "0.0.0",
          lockfileVersion: 3,
          requires: true,
          packages: {
            "": { name: "advisory-poison-fixture", version: "0.0.0", dependencies: { lodash: "4.17.4" } },
            "node_modules/lodash": {
              version: "4.17.4",
              resolved: "https://registry.npmjs.org/lodash/-/lodash-4.17.4.tgz",
              integrity: "sha1-eCA6TRwyiuHBsdsJdnrhsCPpHD8=",
            },
          },
        },
        null,
        2,
      ),
    );

    const r = runGate("security-scan", { env: { SECURITY_SCAN_ROOT: dir } });
    assert.notEqual(r.code, 0, `a critical advisory must fail the gate. Output:\n${r.output}`);
    // Either verdict is a correctly-closed gate: the advisory was counted, or the
    // audit could not reach the registry and the gate refused to claim it was clean.
    // What must never appear is a green line — asserted by the exit code above.
    assert.match(r.output, /dependency audit: [1-9]\d* critical|dependency audit did not run/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// Harm: THE fail-open bug. `npm audit` produces no usable report (no lockfile here;
// equally: npm absent from PATH, no network, a registry error) and the gate reports
// success anyway, asserting a 0C/0H figure it never obtained. SEC-12 is an AUTO-GATE;
// a gate that can be silenced by taking away its network is not one.
test("security gate fails closed when the dependency audit cannot run", () => {
  const r = runGate("security-scan", { env: { SECURITY_SCAN_ROOT: fixture("security-audit-poison") } });
  assert.notEqual(r.code, 0, `an audit that did not run must not pass. Output:\n${r.output}`);
  assert.match(r.output, /dependency audit did not run, so SEC-12 is unverified/);
  assert.doesNotMatch(r.output, /0C\/0H/);
});

// The offline escape hatch must be explicit and must name itself in the verdict, so a
// skipped advisory check can never be mistaken for a clean one. `CI`/`GITHUB_ACTIONS`
// are blanked here because this suite itself runs inside `make verify`, which runs in
// CI — and in CI the opt-out is refused (next test).
test("security gate's offline opt-out is loud and does not claim an advisory count", () => {
  const r = runGate("security-scan", {
    env: {
      SECURITY_SCAN_ROOT: fixture("security-audit-poison"),
      SECURITY_SCAN_ALLOW_NO_AUDIT: "1",
      CI: "",
      GITHUB_ACTIONS: "",
    },
  });
  assert.equal(r.code, 0, `the explicit opt-out should let a local run proceed. Output:\n${r.output}`);
  assert.match(r.output, /SECURITY_SCAN_ALLOW_NO_AUDIT=1/);
  assert.match(r.output, /SKIPPED/);
  assert.doesNotMatch(r.output, /no high\/critical dependency advisories/);
});

// Harm: the escape hatch becomes the bypass. This repository is PUBLIC, and for a
// `pull_request` event GitHub runs the workflow definition from the PR head — so a
// contributor who reads scripts/security-scan.ts (anyone can) could add
// `SECURITY_SCAN_ALLOW_NO_AUDIT: 1` to the verify job's env and turn the
// dependency-advisory half of a merge-blocking gate green in the same commit that
// introduces the advisory, relying on a reviewer to catch it in a YAML diff.
test("security gate REFUSES the offline opt-out in CI", () => {
  for (const ciVar of ["GITHUB_ACTIONS", "CI"]) {
    const r = runGate("security-scan", {
      env: {
        SECURITY_SCAN_ROOT: fixture("security-audit-poison"),
        SECURITY_SCAN_ALLOW_NO_AUDIT: "1",
        [ciVar]: "true",
      },
    });
    assert.notEqual(r.code, 0, `${ciVar}: the opt-out must not work in CI. Output:\n${r.output}`);
    assert.match(r.output, /REFUSED in CI/);
    assert.doesNotMatch(r.output, /0C\/0H/);
  }
});

// A scan pointed somewhere other than this repository must never render as a plain
// green line, so a redirected run is visible in the CI log and not only in the diff
// that redirected it.
test("security gate labels its verdict when SECURITY_SCAN_ROOT redirects the scan", () => {
  const r = runGate("security-scan", { env: { SECURITY_SCAN_ROOT: fixture("security-clean") } });
  assert.equal(r.code, 0, `a clean fixture tree should pass. Output:\n${r.output}`);
  assert.match(r.output, /SECURITY_SCAN_ROOT override in effect — NOT a scan of this repository/);
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

// ── eval (eval/run.ts, stage 20) ────────────────────────────────────────────────
// The accuracy oracle: the only gate that can tell a well-formed answer from a CORRECT
// one. Its scoring and thresholding are not covered by any other test in this repo — if
// a metric with no data started returning a pass, or a threshold comparison inverted,
// everything else here would stay green. Poisoning is by whole-gold-set replacement
// (EVAL_GOLD_POISON, eval/gold.ts), with the report redirected to a throwaway directory
// (EVAL_REPORT_DIR) so a deliberately-failing run never rewrites docs/audits/.
//
// Each poison changes ONE thing against a shared clean base of three items, so the
// assertion names the metric that must block. See fixtures/eval-poison/README.md.
function runEvalGate(goldFixture: string): ReturnType<typeof runScript> {
  const dir = mkdtempSync(join(tmpdir(), "gate-efficacy-eval-"));
  try {
    return runScript(join("eval", "run.ts"), {
      env: {
        EVAL_GOLD_POISON: fixture("eval-poison", goldFixture),
        EVAL_REPORT_DIR: dir,
      },
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// The control for the controls: without this, a harness that failed on EVERY input
// would satisfy all three poison assertions below while proving nothing at all.
test("eval gate passes on the clean baseline gold set (so the poisons below mean something)", () => {
  const r = runEvalGate("baseline-clean.json");
  assert.equal(r.code, 0, `the clean baseline must pass. Output:\n${r.output}`);
  assert.match(r.output, /✅ eval:/);
});

// Harm: the served answer diverges from the expert-reviewed truth — the accuracy
// regression this gate is the sole detector for. The poisoned item pins "NC-100", the
// wrong California name-change form for this app's users (see eval/gold.ts's own note),
// which the system correctly never emits.
test("eval gate fails when a gold item's expected answer is not the one served", () => {
  const r = runEvalGate("wrong-answer.json");
  assert.notEqual(r.code, 0, `an accuracy miss must fail the gate. Output:\n${r.output}`);
  assert.match(r.output, /❌ factual_accuracy: 50\.0% \(≥ 98\.0%/);
  assert.match(r.output, /one or more eval gates below threshold/);
});

// Harm: THE fail-closed property eval/harness.ts asserts in its own header —
// "a metric with no data is a failure, never a silent pass". With no gold items at all,
// every metric is unmeasured, and unmeasured must never read as met. Note
// citation_coverage's value is a vacuous 100% here: it is n=0 that blocks it, which is
// precisely the rule under test.
test("eval gate fails closed when a metric has no scored data", () => {
  const r = runEvalGate("empty-gold.json");
  assert.notEqual(r.code, 0, `an unmeasured metric must not pass. Output:\n${r.output}`);
  assert.match(r.output, /❌ groundedness: .*n=0/);
  assert.match(r.output, /❌ citation_coverage: 100\.0% .*n=0/);
  assert.doesNotMatch(r.output, /✅ eval:/);
});

// Harm: a retrieval regression — the expected record is no longer in the top-K, so the
// generator can never cite it. This is the metric pair (AIEV-03/04) that a retriever
// seam swap (lexical → embedding, ADR-2) would silently break.
test("eval gate fails when the expected record is outside the retrieved top-K", () => {
  const r = runEvalGate("retrieval-miss.json");
  assert.notEqual(r.code, 0, `a retrieval miss must fail the gate. Output:\n${r.output}`);
  assert.match(r.output, /❌ context_recall_at_8: 50\.0% \(≥ 80\.0%/);
  assert.match(r.output, /❌ context_precision_at_1: 50\.0% \(≥ 70\.0%/);
});

// ── Deferred (documented, not covered here) ─────────────────────────────────────
// - typecheck (`tsc --noEmit`): not a scripts/*.ts gate with a pass()/fail() message
//   contract — it's a whole-project compile, and its "failure message" is tsc's own
//   diagnostic output, not ours. A meaningful negative control here means standing up
//   an isolated tsconfig + fixture module, which is a bigger side-quest than this
//   suite's scope. Tracked as its own follow-up rather than a bare TODO here; it stays
//   covered indirectly, since it compiles the same api/* code paths that the gates
//   above exercise as real child processes.
// `eval` is no longer deferred — see the four tests immediately above.
