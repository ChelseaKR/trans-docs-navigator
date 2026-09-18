// The detector that answers "is the live preview the service this repository has?".
//
// Written from both directions, because the failure this replaces was a green gate. A
// detector that cannot fire is noise and gets deleted; a detector that reports a number
// it did not really measure is worse than none, because the number reads as a
// measurement and nobody re-derives it.
//
// So the cases below cover the drift it must report AND every way the comparison can be
// meaningless. This sentinel reads a LIVE ENDPOINT rather than a deployment record —
// this repository has no deployment record and no Pages site — which buys a stronger
// ground truth and costs a network dependency, so it has more ways to be meaningless
// than its siblings, not fewer: the endpoint can be unreachable, answer the wrong
// status, answer the wrong shape, or answer honestly that the image it is running was
// never stamped. Every one of those must end in a refusal. None may end in a
// comfortable zero.
//
// The sharpest case is `a_404_is_a_refusal_not_an_up_to_date_service`. On 2026-09-13 the
// live preview answered 200 on /, /livez, /healthz and /readyz, and 404 on /version —
// because the running image predates api/version.ts (added 2026-09-06, #243). The one
// endpoint that could date the deploy has itself never been deployed. A sentinel that
// treated a non-200 as "nothing to report" would have called that preview current.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "js-yaml";

import {
  COPIED_BUT_NOT_SERVED,
  DEFAULT_MAX_AGE_DAYS,
  StalenessUnknown,
  asJson,
  commitsBetween,
  main,
  measure,
  parseArgs,
  newestCommitWithoutVersionEndpoint,
  parseVersionPayload,
  readLiveService,
  render,
  shipsToVisitors,
} from "../scripts/deploy-staleness.ts";
import type { LiveReport } from "../scripts/deploy-staleness.ts";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SHA = "0123456789abcdef0123456789abcdef01234567";
const NOW = new Date("2026-09-13T12:00:00Z");

/** The exact five fields api/version.ts serves and docs/OPERATIONS.md prints. */
function versionBody(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    version: "0.1.0",
    commit: SHA,
    built_at: "2026-09-06T12:40:00.000Z",
    stamped: true,
    corpus_hash: "f".repeat(64),
    ...over,
  };
}

// ── what /version is allowed to mean ────────────────────────────────────────────

test("a well-formed build stamp is read as the live commit", () => {
  const live = parseVersionPayload(versionBody());
  assert.equal(live.commit, SHA);
  assert.equal(live.version, "0.1.0");
  assert.equal(live.corpusHash, "f".repeat(64));
});

test("a response that is not a JSON object is a refusal", () => {
  for (const body of [null, [], "ok", 7, true]) {
    assert.throws(
      () => parseVersionPayload(body),
      (err: Error) => err instanceof StalenessUnknown && /did not answer with a JSON object/.test(err.message),
      `${JSON.stringify(body)} must not read as a build identity`,
    );
  }
});

test("a response missing any BuildInfo field is a refusal naming that field", () => {
  for (const field of ["commit", "stamped", "version", "built_at", "corpus_hash"]) {
    const body = versionBody();
    delete body[field];
    assert.throws(
      () => parseVersionPayload(body),
      (err: Error) => err instanceof StalenessUnknown && err.message.includes(`missing the '${field}' field`),
      `a body without '${field}' must be refused`,
    );
  }
});

test("an unstamped image is an honest absence, and still a refusal", () => {
  // api/version.ts answers `commit: null, stamped: false` when BUILD_COMMIT was not a
  // 40-hex name. That is the endpoint being honest; it is still no commit to compare.
  assert.throws(
    () => parseVersionPayload(versionBody({ stamped: false, commit: null })),
    (err: Error) => err instanceof StalenessUnknown && /stamped: false/.test(err.message),
  );
});

test("stamped: true with anything that is not a 40-hex name is a refusal", () => {
  for (const commit of [null, "", "main", SHA.slice(0, 7), `${SHA}0`, SHA.replace("0", "g"), 12345]) {
    assert.throws(
      () => parseVersionPayload(versionBody({ stamped: true, commit })),
      (err: Error) => err instanceof StalenessUnknown && /names no usable commit/.test(err.message),
      `commit=${JSON.stringify(commit)} must not be placed on main`,
    );
  }
});

// ── which files change what a reader receives ───────────────────────────────────

test("everything the running server reads ships to readers", () => {
  for (const path of [
    "api/router.ts",
    "api/watchability.ts",
    "src/render.ts",
    "public/assets/app.css",
    "forms/registry.json",
    "forms/form-hashes.json",
    "corpus/jurisdictions/ca.json",
    "corpus/VERIFIERS.json",
    "corpus/referrals/national.json",
    "corpus/translation-status.json",
    "corpus/source-hashes.json",
    "corpus/external/id-churn-sentinel/feed.json",
    "package.json",
    "package-lock.json",
    "Dockerfile",
    "scripts/corpus-manifest.ts",
  ]) {
    assert.equal(shipsToVisitors(path), true, `${path} changes what the service returns`);
  }
});

test("nothing that cannot reach a reader is counted", () => {
  for (const path of [
    "tests/deploy-staleness.test.ts",
    "eval/run.ts",
    "loadtest/p95.k6.js",
    "docs/OPERATIONS.md",
    "docs/HELP-WANTED.md",
    "infra/preview/main.tf",
    "slos/api.yaml",
    ".github/workflows/ci.yml",
    ".github/workflows/deploy-staleness.yml",
    "README.md",
    "CONTRIBUTING.md",
    "CHANGELOG.md",
    "tsconfig.json",
    "renovate.json",
    "scripts/link-check.ts",
    "scripts/deploy-staleness.ts",
  ]) {
    assert.equal(shipsToVisitors(path), false, `${path} cannot change what the service returns`);
  }
});

test("the raw source snapshots are not served, but the index api/watchability.ts reads is", () => {
  // corpus/snapshots/*.txt are offline evidence for the merge-blocking `fidelity` gate:
  // 228 files, refreshed in bulk by `make source-snapshot`, none of them read by
  // api/server.ts. Counting them would make every snapshot refresh look like a deploy
  // that readers are missing. index.json is the one file in there the server does read
  // (api/watchability.ts), and it decides whether a citation renders with the "no
  // automated drift watch covers this source" line.
  assert.equal(shipsToVisitors("corpus/snapshots/a-arlawhelp-org-name-change-adults-7f4b5c65.txt"), false);
  assert.equal(shipsToVisitors("corpus/README.md"), false);
  assert.equal(shipsToVisitors("corpus/snapshots/index.json"), true);
});

test("every path the Dockerfile copies into the image is classified", () => {
  // Anti-drift, in the shape this repository already uses for `gate-count` and
  // `launch-gates`: the visitor-visible list is derived from what the image contains,
  // so a future `COPY <newdir> ./<newdir>` must be either on the list or explicitly
  // exempted with a reason. Otherwise a whole new served directory joins the image and
  // the sentinel silently stops counting changes to it.
  const dockerfile = readFileSync(join(REPO_ROOT, "Dockerfile"), "utf8");
  const copied: string[] = [];
  for (const line of dockerfile.split("\n")) {
    const trimmed = line.trim();
    if (!/^COPY\s/i.test(trimmed)) continue;
    if (/^COPY\s+--from=/i.test(trimmed)) continue; // an external image layer, not repo content
    const parts = trimmed.split(/\s+/).slice(1);
    copied.push(...parts.slice(0, -1)); // the last token is the destination
  }
  assert.ok(copied.length > 0, "the Dockerfile must copy something, or this test proves nothing");

  for (const src of copied) {
    if (src in COPIED_BUT_NOT_SERVED) {
      assert.ok(COPIED_BUT_NOT_SERVED[src], `${src} must carry a reason for being exempt`);
      continue;
    }
    const abs = join(REPO_ROOT, src);
    assert.ok(existsSync(abs), `Dockerfile copies ${src}, which does not exist in the repo`);
    const probe = statSync(abs).isDirectory() ? `${src}/probe-file` : src;
    assert.equal(
      shipsToVisitors(probe),
      true,
      `Dockerfile copies ${src} into the serving image but deploy-staleness.ts does not count it, ` +
        "and it carries no COPIED_BUT_NOT_SERVED reason",
    );
  }
});

// ── the comparison against main, and every way it can be meaningless ────────────

function git(root: string, args: string[]): string {
  const res = spawnSync("git", ["-C", root, ...args], { encoding: "utf8" });
  assert.equal(res.status, 0, `git ${args.join(" ")} failed: ${res.stderr}`);
  return (res.stdout ?? "").trim();
}

function scratchRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "tdn-staleness-"));
  git(root, ["init", "-b", "main"]);
  git(root, ["config", "user.email", "sentinel@example.test"]);
  git(root, ["config", "user.name", "sentinel"]);
  git(root, ["config", "commit.gpgsign", "false"]);
  return root;
}

/** Commit `path` with an explicit commit date, so "how long has this waited" is testable. */
function commit(root: string, path: string, daysAgo = 0): string {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${path}:${Math.random()}`, "utf8");
  git(root, ["add", "--", path]);
  const when = new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString();
  const res = spawnSync("git", ["-C", root, "commit", "-m", `touch ${path}`], {
    encoding: "utf8",
    env: { ...process.env, GIT_AUTHOR_DATE: when, GIT_COMMITTER_DATE: when },
  });
  assert.equal(res.status, 0, `commit failed: ${res.stderr}`);
  return git(root, ["rev-parse", "HEAD"]);
}

function live(commitSha: string): LiveReport {
  return {
    kind: "stamped",
    build: { commit: commitSha, version: "0.1.0", builtAt: null, corpusHash: null },
  };
}

/** The measured-but-bounded case: /version absent on a service that proves it is alive. */
function absent(): LiveReport {
  return { kind: "endpoint-absent", evidence: "/version → 404 while /livez → 200 answered" };
}

test("it counts the commits and names the reader-visible ones", () => {
  const root = scratchRepo();
  const deployed = commit(root, "README.md", 40);
  commit(root, "tests/x.test.ts", 30);
  commit(root, "corpus/jurisdictions/ca.json", 20);
  commit(root, "src/render.ts", 5);

  const drift = measure(live(deployed), "HEAD", NOW, DEFAULT_MAX_AGE_DAYS, root);

  assert.equal(drift.commits, 3);
  assert.equal(drift.visitorCommits, 2);
  assert.equal(drift.deployedAgeDays, 40);
  assert.equal(drift.waitingDays, 20, "the OLDEST unpublished reader-visible commit sets the wait");
  assert.equal(drift.overdue, true);
});

test("age alone is not overdue", () => {
  // A service nobody redeployed because nothing it serves changed is correct, not
  // stale. Reporting on age alone would make this fire on every repository that is
  // simply finished, and a sentinel that always fires is one nobody reads.
  const root = scratchRepo();
  const deployed = commit(root, "README.md", 200);
  commit(root, "docs/OPERATIONS.md", 190);
  commit(root, "tests/x.test.ts", 100);

  const drift = measure(live(deployed), "HEAD", NOW, DEFAULT_MAX_AGE_DAYS, root);

  assert.equal(drift.commits, 2);
  assert.equal(drift.visitorCommits, 0);
  assert.equal(drift.deployedAgeDays, 200);
  assert.equal(drift.overdue, false, "200 days of non-reader-visible work is not a stale deploy");
  assert.match(render(drift), /Up to date/);
});

test("a reader-visible commit inside the threshold is not overdue", () => {
  const root = scratchRepo();
  const deployed = commit(root, "README.md", 30);
  commit(root, "api/router.ts", 3);

  const drift = measure(live(deployed), "HEAD", NOW, DEFAULT_MAX_AGE_DAYS, root);

  assert.equal(drift.visitorCommits, 1);
  assert.equal(drift.waitingDays, 3);
  assert.equal(drift.overdue, false, "the deploy is 30 days old but nothing has waited more than 3");
});

test("nothing since the deploy is up to date", () => {
  const root = scratchRepo();
  const deployed = commit(root, "api/router.ts", 1);

  const drift = measure(live(deployed), "HEAD", NOW, DEFAULT_MAX_AGE_DAYS, root);

  assert.equal(drift.commits, 0);
  assert.equal(drift.visitorCommits, 0);
  assert.equal(drift.waitingDays, 0);
  assert.equal(drift.overdue, false);
});

test("a bounded measurement always reports, because a bound can never say 'fine'", () => {
  // The trap this rule closes. An at-least measurement says "the deploy is AT LEAST this
  // far behind"; the true deploy may be far older. So a bound that lands inside the
  // 14-day threshold proves nothing, and applying the threshold to it would manufacture
  // exactly the comfortable zero this file exists to refuse -- reached by arithmetic
  // instead of by a silent failure. Here the bound is 1 day and 1 commit, well inside
  // the threshold, and it must STILL report.
  const root = scratchRepo();
  commit(root, "api/router.ts", 30);
  commit(root, "api/version.ts", 2); // the commit that introduced the endpoint
  commit(root, "src/render.ts", 1);

  const drift = measure(absent(), "HEAD", NOW, DEFAULT_MAX_AGE_DAYS, root);

  assert.equal(drift.basis, "at-least");
  assert.equal(drift.live, null, "no build identity was reported, and none may be invented");
  assert.ok(drift.waitingDays <= DEFAULT_MAX_AGE_DAYS, "the bound is inside the threshold");
  assert.equal(drift.overdue, true, "and it reports anyway");
  assert.match(render(drift), /lower bound/);
  assert.match(render(drift), /UNIDENTIFIED/);
});

test("the bound is anchored at the last commit before /version existed", () => {
  const root = scratchRepo();
  commit(root, "api/router.ts", 30);
  const lastWithout = commit(root, "corpus/jurisdictions/ca.json", 20);
  commit(root, "api/version.ts", 10);
  commit(root, "src/render.ts", 1);

  assert.equal(newestCommitWithoutVersionEndpoint(root, "HEAD"), lastWithout);
  assert.equal(measure(absent(), "HEAD", NOW, DEFAULT_MAX_AGE_DAYS, root).anchor, lastWithout);
});

test("a history that never added api/version.ts cannot be bounded, so it refuses", () => {
  // The shallow-clone shape again: the add-commit lookup returns nothing silently, and
  // an anchor picked from nothing would put the bound wherever the truncation fell.
  const root = scratchRepo();
  commit(root, "api/router.ts", 5);

  assert.throws(
    () => measure(absent(), "HEAD", NOW, DEFAULT_MAX_AGE_DAYS, root),
    (err: Error) => err instanceof StalenessUnknown && /cannot locate the commit that added/.test(err.message),
  );
});

test("a commit this clone does not have is a refusal, never a zero", () => {
  // The shallow-checkout case, the one that reports zero silently: `git log
  // <absent>..HEAD` on a shallow clone lists nothing, so the service reads as current.
  // This is why the workflow checks out with fetch-depth: 0, and why this refuses
  // rather than trusting that it did.
  const root = scratchRepo();
  commit(root, "api/router.ts", 1);

  assert.throws(
    () => measure(live("a".repeat(40)), "HEAD", NOW, DEFAULT_MAX_AGE_DAYS, root),
    (err: Error) => err instanceof StalenessUnknown && /not in this clone/.test(err.message),
  );
});

test("a diverged history is a refusal", () => {
  const root = scratchRepo();
  commit(root, "api/router.ts", 10);
  git(root, ["checkout", "-b", "other"]);
  const orphan = commit(root, "orphan.txt", 9);
  git(root, ["checkout", "main"]);

  assert.throws(
    () => measure(live(orphan), "main", NOW, DEFAULT_MAX_AGE_DAYS, root),
    (err: Error) => err instanceof StalenessUnknown && /not an ancestor/.test(err.message),
  );
});

test("a malformed live commit is a refusal", () => {
  const root = scratchRepo();
  commit(root, "api/router.ts", 1);

  assert.throws(
    () => measure(live("nope"), "HEAD", NOW, DEFAULT_MAX_AGE_DAYS, root),
    (err: Error) => err instanceof StalenessUnknown && /not a commit id/.test(err.message),
  );
});

test("commitsBetween reports every touched path, not just the first", () => {
  const root = scratchRepo();
  const deployed = commit(root, "README.md", 5);
  const target = join(root, "docs");
  mkdirSync(target, { recursive: true });
  writeFileSync(join(target, "a.md"), "a", "utf8");
  mkdirSync(join(root, "api"), { recursive: true });
  writeFileSync(join(root, "api", "b.ts"), "b", "utf8");
  git(root, ["add", "--", "docs/a.md", "api/b.ts"]);
  git(root, ["commit", "-m", "two files"]);

  const records = commitsBetween(root, deployed, "HEAD");
  assert.equal(records.length, 1);
  assert.deepEqual([...(records[0]?.paths ?? [])].sort(), ["api/b.ts", "docs/a.md"]);
});

// ── the report and the JSON ─────────────────────────────────────────────────────

test("the report states the measurement before its verdict", () => {
  const root = scratchRepo();
  const deployed = commit(root, "README.md", 60);
  commit(root, "corpus/jurisdictions/ca.json", 40);
  const drift = measure(live(deployed), "HEAD", NOW, DEFAULT_MAX_AGE_DAYS, root);

  const report = render(drift);

  assert.ok(report.includes(deployed.slice(0, 9)), "the report must name the live commit");
  assert.match(report, /OVERDUE/);
  assert.ok(report.indexOf("Behind by") < report.indexOf("OVERDUE"), "measurement first, verdict second");
});

test("the JSON carries every number the report states", () => {
  const root = scratchRepo();
  const deployed = commit(root, "README.md", 60);
  commit(root, "public/assets/app.css", 40);
  const payload = asJson(measure(live(deployed), "HEAD", NOW, DEFAULT_MAX_AGE_DAYS, root));

  assert.equal(payload["live_commit"], deployed);
  assert.equal(payload["commits"], 1);
  assert.equal(payload["visitor_commits"], 1);
  assert.equal(payload["waiting_days"], 40);
  assert.equal(payload["overdue"], true);
});

// ── reaching the live service: the refusals only this model has ─────────────────

async function withServer(
  handler: (path: string) => { status: number; body: string; contentType?: string },
  run: (base: string) => Promise<void>,
): Promise<void> {
  const server: Server = createServer((req, res) => {
    const { status, body, contentType } = handler(req.url ?? "/");
    res.writeHead(status, { "content-type": contentType ?? "application/json" });
    res.end(body);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object", "the test server must report a port");
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

const noSleep = { attempts: 2, sleep: async (): Promise<void> => {} };

test("a live service that answers /version is read", async () => {
  await withServer(
    () => ({ status: 200, body: JSON.stringify(versionBody()) }),
    async (base) => {
      const report = await readLiveService(base, noSleep);
      assert.equal(report.kind, "stamped");
      assert.equal(report.kind === "stamped" && report.build.commit, SHA);
    },
  );
});

/** The live preview's real shape on 2026-09-13: healthy, but with no /version. */
function absentVersionService(path: string): { status: number; body: string; contentType?: string } {
  if (path.startsWith("/livez")) return { status: 200, body: JSON.stringify({ status: "ok" }) };
  if (path.startsWith("/readyz")) {
    return { status: 200, body: JSON.stringify({ status: "ok", checks: { corpus: "ok" } }) };
  }
  return { status: 404, body: "<!doctype html>Page not found", contentType: "text/html" };
}

test("an absent /version on a demonstrably live service is a MEASUREMENT, not a refusal", async () => {
  // The real state of this preview on 2026-09-13: 200 on /, /livez, /healthz and
  // /readyz, 404 on /version, because the running image predates api/version.ts. The
  // endpoint built to date the deploy has itself never been deployed.
  //
  // This must not be red. A red run here would be permanent -- only a deploy can change
  // it, and deploying is a deliberate cost-bearing human act -- and a check that is red
  // for weeks stops being read, which is the failure this whole file guards against.
  // The 404 is evidence ABOUT the image, so it is measured, reported, and green.
  await withServer(absentVersionService, async (base) => {
    const report = await readLiveService(base, noSleep);
    assert.equal(report.kind, "endpoint-absent");
    assert.match(
      report.kind === "endpoint-absent" ? report.evidence : "",
      /404/,
      "the evidence must record what was actually observed",
    );
  });
});

test("a 404 whose liveness probes do not answer is still a refusal", async () => {
  // The distinction that makes the case above legitimate. A parked domain, a dead host
  // behind a CDN, or a misrouted proxy also 404s. Only a service that proves it is alive
  // AND is this application turns a 404 into evidence about the deployed image.
  await withServer(
    () => ({ status: 404, body: "not found", contentType: "text/html" }),
    async (base) => {
      await assert.rejects(
        readLiveService(base, noSleep),
        (err: Error) => err instanceof StalenessUnknown && /not evidence/.test(err.message),
      );
    },
  );
});

test("a 404 whose probes answer something that is not this application is a refusal", async () => {
  await withServer(
    (path) =>
      path.startsWith("/livez") || path.startsWith("/readyz")
        ? { status: 200, body: "<html>hello from a proxy</html>", contentType: "text/html" }
        : { status: 404, body: "nope", contentType: "text/html" },
    async (base) => {
      await assert.rejects(
        readLiveService(base, noSleep),
        (err: Error) =>
          err instanceof StalenessUnknown && /nothing proves it is this service/.test(err.message),
      );
    },
  );
});

test("a 200 that is not JSON is a refusal that quotes what it got", async () => {
  await withServer(
    () => ({ status: 200, body: "<!doctype html><title>login</title>", contentType: "text/html" }),
    async (base) => {
      await assert.rejects(
        readLiveService(base, noSleep),
        (err: Error) => err instanceof StalenessUnknown && /not JSON/.test(err.message),
      );
    },
  );
});

test("a 200 of the wrong shape is a refusal", async () => {
  await withServer(
    () => ({ status: 200, body: JSON.stringify({ status: "ok" }) }),
    async (base) => {
      await assert.rejects(
        readLiveService(base, noSleep),
        (err: Error) => err instanceof StalenessUnknown && /not the BuildInfo shape/.test(err.message),
      );
    },
  );
});

test("an unreachable service is a refusal after bounded retries, never a pass", async () => {
  let attempts = 0;
  const fetchImpl = (async () => {
    attempts += 1;
    throw new Error("connect ECONNREFUSED");
  }) as unknown as typeof fetch;

  await assert.rejects(
    readLiveService("http://127.0.0.1:1", { attempts: 3, sleep: async () => {}, fetchImpl }),
    (err: Error) => err instanceof StalenessUnknown && /the request failed/.test(err.message),
  );
  assert.equal(attempts, 3, "retries must be bounded and must all be spent before refusing");
});

test("a flaky fetch that succeeds on a later attempt is a measurement, not a refusal", async () => {
  // The preview is a scale-to-zero Lambda; the first request after idle pays a cold
  // start. A transient miss is not evidence about main, so retries are real — but
  // bounded, and the test above proves exhaustion is still a refusal.
  let attempts = 0;
  const fetchImpl = (async () => {
    attempts += 1;
    if (attempts < 3) throw new Error("timed out");
    return new Response(JSON.stringify(versionBody()), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;

  const report = await readLiveService("http://example.invalid", {
    attempts: 4,
    sleep: async () => {},
    fetchImpl,
  });
  assert.equal(report.kind === "stamped" && report.build.commit, SHA);
  assert.equal(attempts, 3);
});

test("the trailing slash on the homepage URL does not become a double slash", async () => {
  // The repository homepage is stored with a trailing slash. `//version` is a different
  // path and answers 404, which would refuse forever for a cosmetic reason.
  let seen = "";
  const fetchImpl = (async (url: string) => {
    seen = url;
    return new Response(JSON.stringify(versionBody()), { status: 200 });
  }) as unknown as typeof fetch;

  await readLiveService("https://example.invalid/", { attempts: 1, sleep: async () => {}, fetchImpl });
  assert.equal(seen, "https://example.invalid/version");
});

// ── the CLI and its exit code ───────────────────────────────────────────────────

test("the CLI refuses with a non-zero exit when it cannot reach the service", async () => {
  // Exit 2, not 0 with a reassuring report. The workflow turns a measurement into an
  // issue and a refusal into a red run, so this exit code is the whole difference
  // between "the preview is fine" and "nobody can tell".
  await withServer(
    () => ({ status: 404, body: "nope", contentType: "text/html" }),
    async (base) => {
      const code = await main(["--url", base], noSleep);
      assert.equal(code, 2);
    },
  );
});

test("parseArgs rejects what it cannot honor instead of guessing", () => {
  assert.equal(parseArgs([]).maxAgeDays, DEFAULT_MAX_AGE_DAYS);
  assert.equal(parseArgs(["--max-age-days", "30"]).maxAgeDays, 30);
  assert.equal(parseArgs(["--url", "https://x.test/"]).url, "https://x.test/");
  for (const argv of [["--max-age-days", "soon"], ["--max-age-days", "-1"], ["--nope"], ["--repo"]]) {
    assert.throws(() => parseArgs(argv), StalenessUnknown, `${JSON.stringify(argv)} must be refused`);
  }
});

// ── the workflow: it must not be able to publish ────────────────────────────────

interface WorkflowDoc {
  on: Record<string, unknown>;
  permissions: unknown;
  concurrency: { group: string; "cancel-in-progress": boolean };
  jobs: Record<
    string,
    {
      permissions: Record<string, string>;
      "timeout-minutes"?: number;
      steps: { uses?: string; with?: Record<string, unknown> }[];
    }
  >;
}

function workflow(): WorkflowDoc {
  return load(
    readFileSync(join(REPO_ROOT, ".github", "workflows", "deploy-staleness.yml"), "utf8"),
  ) as WorkflowDoc;
}

test("the sentinel holds nothing that could deploy", () => {
  // The point of separating the clock from the publisher. This workflow watches a
  // service whose deploy costs money and is a deliberate human act; if it could
  // deploy, "make staleness visible" would quietly have become "change publishing
  // policy", which is not its call to make.
  const doc = workflow();
  assert.deepEqual(doc.permissions, {}, "workflow-level permissions must be empty");

  const jobs = Object.values(doc.jobs);
  assert.equal(jobs.length, 1);
  for (const job of jobs) {
    assert.deepEqual(Object.keys(job.permissions).sort(), ["contents", "issues"]);
    assert.equal(job.permissions["contents"], "read");
    assert.equal(job.permissions["issues"], "write");
    for (const forbidden of ["id-token", "packages", "deployments", "actions"]) {
      assert.ok(!(forbidden in job.permissions), `${forbidden} must not be granted`);
    }
    assert.ok((job["timeout-minutes"] ?? 0) > 0, "the job must carry a timeout");
  }

  // Comment lines are stripped before this check, and deliberately: the header says in
  // prose that the sentinel holds no AWS role and runs no `gh workflow run`, and a
  // matcher that counts a promise not to do something as doing it would make the
  // honest documentation the thing that fails. The inverse of that mistake — a
  // conformance check satisfied by a tool named only in a comment — is the one this
  // portfolio has already made; both come from matching prose instead of code.
  const executable = readFileSync(join(REPO_ROOT, ".github", "workflows", "deploy-staleness.yml"), "utf8")
    .split("\n")
    .filter((line) => !line.trim().startsWith("#"))
    .join("\n");
  for (const forbidden of [
    "id-token",
    "configure-aws-credentials",
    "AWS_DEPLOY_ROLE_ARN",
    "aws lambda",
    "gh workflow run",
    "aws-actions/",
  ]) {
    assert.ok(!executable.includes(forbidden), `the sentinel must not invoke ${forbidden}`);
  }
});

test("the sentinel runs weekly, cannot cancel itself mid-write, and checks out full history", () => {
  const doc = workflow();
  assert.ok("schedule" in doc.on, "a clock nobody winds is the defect this replaces");
  assert.ok("workflow_dispatch" in doc.on);
  assert.ok(!("push" in doc.on) && !("pull_request" in doc.on));
  assert.equal(doc.concurrency["cancel-in-progress"], false, "never cancel a run mid-issue-write");

  const steps = Object.values(doc.jobs)[0]?.steps ?? [];
  const checkout = steps.find((s) => s.uses?.startsWith("actions/checkout@"));
  assert.ok(checkout, "the comparison needs the repository");
  assert.equal(
    checkout.with?.["fetch-depth"],
    0,
    "a shallow clone reports zero drift; the script refuses that case, and this keeps it from having to",
  );
  assert.equal(checkout.with?.["persist-credentials"], false);
  for (const step of steps) {
    if (!step.uses) continue;
    assert.match(step.uses, /@[0-9a-f]{40}/, `${step.uses} must be pinned to a full commit SHA`);
  }
});
