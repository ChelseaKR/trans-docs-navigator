// Is the service a reader gets at the preview URL the service this repository has?
//
// WHAT THIS MEASURES, AND WHAT IT DOES NOT
//
// *Deploy* staleness: how far the running image is behind `main`. Not *data*
// staleness — whether a corpus record's `last_verified` is inside its SLA is a
// different question with its own machinery (`make freshness`, `make content-watch`,
// `api/horizon.ts`). A record verified this morning is still invisible to every
// reader until a deploy carries it, and a deploy carried three weeks ago still serves
// records that were fresh then. The two clocks are independent and this one reads only
// the deploy clock.
//
// WHY IT EXISTS
//
// `.github/workflows/deploy-aws-preview.yml` is `workflow_dispatch` only, deliberately:
// its header says "Manual by design (workflow_dispatch only) so nothing bills until you
// choose to deploy." That is a cost policy, not an omission, and this file does not
// touch it. The same header names the cost it buys: "Nothing deploys on a push, so the
// running preview can be arbitrarily far behind `main` and no timestamp anywhere says
// how far."
//
// It then says that is answerable now — the build stamps the commit into the image,
// `/version` serves it (api/version.ts), and docs/OPERATIONS.md tells a reader how to
// check. All true. What did not exist was anything that asked on a schedule. A person
// has to remember to `curl`, and the whole failure mode here is that nobody remembers:
// a gate that is green because nobody ran it is indistinguishable from a gate that is
// green because it passed.
//
// WHICH PUBLISHING MODEL THIS ASSUMES
//
// A live endpoint that reports its own commit. This repository has no GitHub deployment
// record (`repos/.../deployments` is empty) and no Pages site (`repos/.../pages` 404s),
// so the measurement source the other sentinels in this portfolio use — a
// `github-pages` or `production` deployment row naming the commit its bytes came from —
// does not exist here. `/version` is the ground truth instead, and it is a better one:
// a deployment row records that a publish was *requested and reported success*, while
// `/version` is the running process answering for itself.
//
// That trade has a cost this file pays in full: the endpoint has to be reachable. This
// is the one sentinel in the set that REQUIRES NETWORK ACCESS. A fetch that fails, times
// out, or answers with anything other than a well-formed build stamp is a refusal —
// red, non-zero, no number — never a pass. An unreachable service is precisely the state
// in which a comfortable zero would be most wrong.
//
// THE RULE
//
// A detector that cannot tell must refuse, never report a comfortable zero. Every
// unmeasurable case below throws `StalenessUnknown` and exits non-zero rather than
// returning a number that would read as a measurement.
//
// Standard library and repo conventions only: no new dependency, and nothing imported
// from `api/` or `src/`, so the sentinel cannot be broken by the code it is watching.

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { appendFileSync } from "node:fs";

export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** A real git object name: exactly 40 lowercase hex characters, same rule api/version.ts applies. */
const COMMIT_RE = /^[0-9a-f]{40}$/;

/**
 * How long an unpublished visitor-visible commit may wait before this reports.
 *
 * Generous on purpose. Deploying costs money and is a deliberate human act here, so the
 * useful threshold catches "a fortnight of unpublished work", not "you did not deploy
 * on Tuesday".
 */
export const DEFAULT_MAX_AGE_DAYS = 14;

/**
 * Paths whose change alters what the running service returns.
 *
 * Derived from the Dockerfile's COPY list intersected with what `api/server.ts` actually
 * reads at runtime, because "shipped in the image" and "reachable by a reader" are not
 * the same set here:
 *
 *   api/, src/       the server, the router and every renderer.
 *   public/          the static assets api/server.ts serves (assets, vendor).
 *   forms/           forms/registry.json (api/forms.ts) and forms/form-hashes.json,
 *                    which api/watchability.ts turns into the "no automated drift watch
 *                    covers this source" line src/render.ts prints beside a citation.
 *   corpus/          the substance. api/corpus.ts reads jurisdictions/ and
 *                    VERIFIERS.json, api/referrals.ts reads referrals/,
 *                    api/translations.ts reads translation-status.json,
 *                    api/sentinel.ts reads external/id-churn-sentinel/, and
 *                    api/watchability.ts reads source-hashes.json and
 *                    snapshots/index.json. Every one of those renders into a page.
 *   package.json     `/version` reports its `version` field; it also pins the runtime deps.
 *   package-lock.json the exact production dependency tree `npm ci --omit=dev` bakes in.
 *   Dockerfile       the base image, the COPY list, and the env the service runs under.
 *   scripts/corpus-manifest.ts
 *                    the one file under scripts/ that runs during the image build (a
 *                    Dockerfile RUN step). It computes the corpus digest `/version`
 *                    serves as `corpus_hash` and `api/server.ts` re-verifies at boot.
 *
 * And what is deliberately NOT here, because changing it cannot change a byte a reader
 * receives: tests/, eval/, loadtest/, docs/, infra/, slos/, .github/, the top-level
 * prose and tool configs, the rest of scripts/ (gate and ops tooling, copied into the
 * image but never executed by it) — and corpus/snapshots/'s raw captures, which are
 * offline evidence for the merge-blocking `fidelity` gate. `corpus/snapshots/index.json`
 * is the exception inside that exception: api/watchability.ts reads it, so it is back on
 * the list.
 *
 * The direction of error matters in both directions. Too narrow and the sentinel misses
 * the change that mattered; too wide and it fires on every unrelated commit until nobody
 * reads it. `tests/deploy-staleness.test.ts` pins both edges, and pins the Dockerfile's
 * COPY list against this list so a future `COPY <newdir>` cannot slip past unclassified.
 */
export const VISITOR_VISIBLE_PREFIXES = [
  "api/",
  "src/",
  "public/",
  "forms/",
  "corpus/",
  "scripts/corpus-manifest.ts",
  "package.json",
  "package-lock.json",
  "Dockerfile",
] as const;

/**
 * Inside a visitor-visible prefix but not actually served. Checked before the prefixes,
 * with `VISITOR_VISIBLE_EXCEPTIONS` winning back the files that are.
 */
export const NOT_SERVED_WITHIN_VISITOR_PATHS = ["corpus/snapshots/", "corpus/README.md"] as const;

/** Re-included from `NOT_SERVED_WITHIN_VISITOR_PATHS`: api/watchability.ts reads this one. */
export const VISITOR_VISIBLE_EXCEPTIONS = ["corpus/snapshots/index.json"] as const;

/** Top-level paths the Dockerfile copies that are NOT visitor-visible, and why. */
export const COPIED_BUT_NOT_SERVED: Readonly<Record<string, string>> = {
  scripts:
    "gate and ops tooling; only scripts/corpus-manifest.ts runs (a Dockerfile RUN step) " +
    "and it is on the visitor-visible list by name. The CMD runs api/server.ts, which " +
    "imports nothing from scripts/.",
};

/**
 * The comparison could not be made, so no number is reported.
 *
 * Thrown in preference to returning zero anywhere the inputs do not support a
 * measurement. The caller turns this into a red run: a sentinel that cannot tell is a
 * broken sentinel, and it has to look broken.
 */
export class StalenessUnknown extends Error {
  override readonly name = "StalenessUnknown";
}

/** What `/version` says the running image is. */
export interface LiveBuild {
  commit: string;
  version: string | null;
  builtAt: string | null;
  corpusHash: string | null;
}

/** How far the running image is behind `main`. */
export interface Drift {
  live: LiveBuild;
  head: string;
  /** Days since the deployed commit was authored — how old the running code is. */
  deployedAgeDays: number;
  /**
   * Days the OLDEST unpublished visitor-visible commit has been waiting, or 0 when
   * there is none. This, not `deployedAgeDays`, is what the verdict reads: the question
   * is how long a reader has been denied something, not how old the running build is.
   */
  waitingDays: number;
  commits: number;
  visitorCommits: number;
  maxAgeDays: number;
  overdue: boolean;
}

// ── what /version is allowed to mean ────────────────────────────────────────────

/**
 * Read a `/version` body, or refuse.
 *
 * The shape is `api/version.ts`'s `BuildInfo` — `{ version, commit, built_at, stamped,
 * corpus_hash }` — and docs/OPERATIONS.md prints the same five fields as the answer a
 * reader should expect. Both halves are asserted, not just `commit`: an endpoint that
 * answered `{}` with a 200 would otherwise read as "no commit" rather than "this is not
 * the endpoint I think it is", and those need different fixes.
 *
 * `stamped` is checked separately from `commit` because api/version.ts states them
 * separately and for a reason: an unstamped image answers `commit: null, stamped:
 * false`, which is an honest "this image cannot say" and must be reported as such, never
 * silently folded into a transport failure.
 */
export function parseVersionPayload(raw: unknown): LiveBuild {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new StalenessUnknown(
      `/version did not answer with a JSON object (got ${Array.isArray(raw) ? "an array" : typeof raw}): ` +
        "this is not the build-identity endpoint api/version.ts serves",
    );
  }
  const body = raw as Record<string, unknown>;

  for (const field of ["commit", "stamped", "version", "built_at", "corpus_hash"]) {
    if (!(field in body)) {
      throw new StalenessUnknown(
        `/version is missing the '${field}' field: the response is not the BuildInfo shape ` +
          "api/version.ts serves, so nothing here can be read as a build identity",
      );
    }
  }

  if (body["stamped"] !== true) {
    throw new StalenessUnknown(
      "/version reports stamped: false — the running image was built without BUILD_COMMIT " +
        "and cannot say which commit it is. That is an honest absence, not a zero: there is " +
        "no commit to compare main against",
    );
  }

  const commit = body["commit"];
  if (typeof commit !== "string" || !COMMIT_RE.test(commit)) {
    throw new StalenessUnknown(
      `/version reports stamped: true but names no usable commit (${JSON.stringify(commit)}): ` +
        "a build identity that is not a 40-hex git object name cannot be placed on main",
    );
  }

  return {
    commit,
    version: typeof body["version"] === "string" ? body["version"] : null,
    builtAt: typeof body["built_at"] === "string" ? body["built_at"] : null,
    corpusHash: typeof body["corpus_hash"] === "string" ? body["corpus_hash"] : null,
  };
}

// ── which files change what a reader receives ───────────────────────────────────

/** Does changing this file change what the running service returns? */
export function shipsToVisitors(path: string): boolean {
  if (VISITOR_VISIBLE_EXCEPTIONS.some((exact) => path === exact)) return true;
  if (NOT_SERVED_WITHIN_VISITOR_PATHS.some((p) => (p.endsWith("/") ? path.startsWith(p) : path === p)))
    return false;
  return VISITOR_VISIBLE_PREFIXES.some((p) => (p.endsWith("/") ? path.startsWith(p) : path === p));
}

// ── placing the live commit on main ─────────────────────────────────────────────

function runGit(repoRoot: string, args: string[]): { status: number; stdout: string; stderr: string } {
  const res = spawnSync("git", ["-C", repoRoot, ...args], { encoding: "utf8" });
  return {
    status: res.status ?? 1,
    stdout: (res.stdout ?? "").trim(),
    stderr: (res.stderr ?? "").trim(),
  };
}

function git(repoRoot: string, args: string[]): string {
  const res = runGit(repoRoot, args);
  if (res.status !== 0) {
    throw new StalenessUnknown(`git ${args.join(" ")} failed: ${res.stderr}`);
  }
  return res.stdout;
}

/**
 * Whether this clone contains the commit, without throwing on absence.
 *
 * `git cat-file -e` exits non-zero for a commit that is simply not here, which is the
 * ordinary shallow-clone case and not a git failure. Routing it through `git()` would
 * report it as one, and the refusal below — the one that names the shallow checkout and
 * says why a zero would be wrong — would never be reached.
 */
function hasCommit(repoRoot: string, sha: string): boolean {
  return runGit(repoRoot, ["cat-file", "-e", `${sha}^{commit}`]).status === 0;
}

/**
 * Refuse unless this clone can actually place the live commit on `main`.
 *
 * Both failures below report zero drift if they are not caught, and both are ordinary.
 * A shallow checkout does not contain a commit from last month, so `git log
 * <live>..HEAD` lists nothing and the service reads as up to date — which is why the
 * sentinel workflow checks out with `fetch-depth: 0`, and why this refuses rather than
 * trusting that it did. A force-push or a rebase leaves the live commit off `main`
 * entirely, where "commits since the deploy" is not a question with an answer.
 */
export function requireComparable(repoRoot: string, liveSha: string, head: string): void {
  if (!COMMIT_RE.test(liveSha)) {
    throw new StalenessUnknown(`live commit ${JSON.stringify(liveSha)} is not a commit id`);
  }
  if (!hasCommit(repoRoot, liveSha)) {
    throw new StalenessUnknown(
      `live commit ${liveSha.slice(0, 9)} is not in this clone: the checkout is shallow, and a ` +
        "comparison against a history that does not reach the running build would report no drift at all",
    );
  }
  const mergeBase = git(repoRoot, ["merge-base", liveSha, head]);
  if (mergeBase !== git(repoRoot, ["rev-parse", liveSha])) {
    throw new StalenessUnknown(
      `live commit ${liveSha.slice(0, 9)} is not an ancestor of ${head}: the history has diverged ` +
        "and 'commits since the deploy' has no answer",
    );
  }
}

export interface CommitRecord {
  sha: string;
  committedAt: Date;
  paths: string[];
}

/** Each commit after the live one, with its commit date and the paths it touched. */
export function commitsBetween(repoRoot: string, liveSha: string, head: string): CommitRecord[] {
  const raw = git(repoRoot, ["log", "--format=%x00%H %cI", "--name-only", `${liveSha}..${head}`]);
  const out: CommitRecord[] = [];
  for (const block of raw.split("\0")) {
    const lines = block.split("\n").filter((l) => l.trim() !== "");
    const header = lines[0];
    if (header === undefined) continue;
    const [sha, iso] = header.split(" ");
    if (sha === undefined || iso === undefined) continue;
    out.push({ sha, committedAt: new Date(iso), paths: lines.slice(1) });
  }
  return out;
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

/** Place the running build against `main`, or refuse. */
export function measure(
  live: LiveBuild,
  head: string,
  now: Date,
  maxAgeDays: number = DEFAULT_MAX_AGE_DAYS,
  repoRoot: string = REPO_ROOT,
): Drift {
  const headSha = git(repoRoot, ["rev-parse", head]);
  requireComparable(repoRoot, live.commit, headSha);

  const commits = commitsBetween(repoRoot, live.commit, headSha);
  const visitor = commits.filter((c) => c.paths.some(shipsToVisitors));

  const liveCommittedAt = new Date(git(repoRoot, ["show", "-s", "--format=%cI", live.commit]));
  // `git log` is newest-first, so the last visitor-visible entry is the one that has
  // been waiting longest. That is the wait the threshold is about.
  const oldestWaiting = visitor[visitor.length - 1];

  const waitingDays = oldestWaiting ? daysBetween(oldestWaiting.committedAt, now) : 0;

  return {
    live,
    head: headSha,
    deployedAgeDays: daysBetween(liveCommittedAt, now),
    waitingDays,
    commits: commits.length,
    visitorCommits: visitor.length,
    maxAgeDays,
    // Age alone is never the verdict. A service nobody redeployed because nothing it
    // serves changed is correct, not stale.
    overdue: visitor.length > 0 && waitingDays > maxAgeDays,
  };
}

// ── the report ──────────────────────────────────────────────────────────────────

/** The report. States the measurement before its verdict, always. */
export function render(drift: Drift): string {
  const lines = [
    `Running image:    ${drift.live.commit.slice(0, 9)}  (${drift.deployedAgeDays} days old` +
      (drift.live.builtAt ? `, built ${drift.live.builtAt}` : "") +
      (drift.live.version ? `, package version ${drift.live.version}` : "") +
      ")",
    `main:             ${drift.head.slice(0, 9)}`,
    `Behind by:        ${drift.commits} commits, ${drift.visitorCommits} of them changing what a reader receives`,
  ];
  if (drift.visitorCommits > 0) {
    lines.push(
      `Longest wait:     ${drift.waitingDays} days (the oldest unpublished reader-visible commit)`,
    );
  }
  if (drift.overdue) {
    lines.push(
      `\nOVERDUE: ${drift.visitorCommits} reader-visible commit(s) have waited up to ` +
        `${drift.waitingDays} days, past the ${drift.maxAgeDays}-day threshold. ` +
        "The live preview is not what this repository says it is.",
    );
  } else if (drift.visitorCommits > 0) {
    lines.push(
      `\nWaiting: ${drift.visitorCommits} reader-visible commit(s), up to ${drift.waitingDays} days, ` +
        `within the ${drift.maxAgeDays}-day threshold.`,
    );
  } else {
    lines.push("\nUp to date: nothing a reader receives has changed since the running build.");
  }
  return lines.join("\n");
}

export function asJson(drift: Drift): Record<string, unknown> {
  return {
    live_commit: drift.live.commit,
    live_version: drift.live.version,
    live_built_at: drift.live.builtAt,
    live_corpus_hash: drift.live.corpusHash,
    head: drift.head,
    deployed_age_days: drift.deployedAgeDays,
    waiting_days: drift.waitingDays,
    commits: drift.commits,
    visitor_commits: drift.visitorCommits,
    overdue: drift.overdue,
  };
}

// ── reaching the live service ───────────────────────────────────────────────────

export interface FetchOptions {
  attempts?: number;
  timeoutMs?: number;
  /** Injected in tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
  /** Injected in tests so bounded retries do not make the suite sleep. */
  sleep?: (ms: number) => Promise<void>;
}

const DEFAULT_ATTEMPTS = 4;
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Ask the live service what it is, or refuse.
 *
 * Bounded retries because the preview is a scale-to-zero Lambda: the first request after
 * an idle period pays a cold start measured in seconds, and README.md says so to readers.
 * A transient miss is not evidence about `main`.
 *
 * Retries are bounded and every exhausted retry is a refusal, never a pass. That is the
 * whole reason this is a separate function with its own error text: "the service did not
 * answer" and "the service is up to date" must never reach the caller as the same thing.
 */
export async function fetchVersion(baseUrl: string, options: FetchOptions = {}): Promise<LiveBuild> {
  const attempts = options.attempts ?? DEFAULT_ATTEMPTS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const doFetch = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const url = `${baseUrl.replace(/\/+$/, "")}/version`;

  let lastFailure = "the request was never attempted";

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let status: number;
    let text: string;
    try {
      const res = await doFetch(url, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { accept: "application/json" },
        redirect: "follow",
      });
      status = res.status;
      text = await res.text();
    } catch (err) {
      lastFailure = `the request failed (${err instanceof Error ? err.message : String(err)})`;
      if (attempt < attempts) await sleep(attempt * 2000);
      continue;
    }

    if (status !== 200) {
      // Not retried past the loop's own bound, and never downgraded to a pass. A 404
      // here is the sharpest signal there is: it means the running image predates
      // api/version.ts, so the endpoint that would date the deploy has itself never
      // been deployed.
      lastFailure = `it answered HTTP ${status}`;
      if (attempt < attempts) await sleep(attempt * 2000);
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new StalenessUnknown(
        `${url} answered HTTP 200 with a body that is not JSON (first 120 bytes: ` +
          `${JSON.stringify(text.slice(0, 120))}): that is not the build-identity endpoint`,
      );
    }
    return parseVersionPayload(parsed);
  }

  throw new StalenessUnknown(
    `${url} did not report a build identity after ${attempts} attempt(s): ${lastFailure}. ` +
      "The live service could not be asked which commit it is running, so nothing here is a " +
      "measurement — reporting zero drift would claim the preview is current on no evidence",
  );
}

/**
 * The URL a reader actually visits, read from the repository's own `homepage` field.
 *
 * Not hard-coded. The homepage is where this project advertises its live preview (the
 * README's "Live demo" link is the same URL), so it is the one a reader reaches and the
 * one worth measuring; hard-coding a second copy here would be a third place for it to
 * drift. A repository with no homepage set is a refusal, because there is then no
 * agreed answer to "which service is the live one".
 */
export function resolveLiveUrl(repo: string): string {
  const res = spawnSync("gh", ["api", `repos/${repo}`, "--jq", ".homepage // empty"], {
    encoding: "utf8",
  });
  if ((res.status ?? 1) !== 0) {
    throw new StalenessUnknown(
      `gh api repos/${repo} failed, so the live URL could not be resolved: ${(res.stderr ?? "").trim()}`,
    );
  }
  const url = (res.stdout ?? "").trim();
  if (!/^https?:\/\/\S+$/.test(url)) {
    throw new StalenessUnknown(
      `repos/${repo} declares no usable homepage URL (${JSON.stringify(url)}): there is no live ` +
        "service to ask, and a deploy that cannot be located cannot be reported as current",
    );
  }
  return url;
}

// ── CLI ─────────────────────────────────────────────────────────────────────────

function writeGithubOutput(drift: Drift | null, error: string | null): void {
  const path = process.env["GITHUB_OUTPUT"];
  if (!path) return;
  const lines =
    drift === null
      ? ["measured=false", `error=${error ?? "unknown"}`]
      : [
          "measured=true",
          `overdue=${String(drift.overdue)}`,
          `waiting_days=${drift.waitingDays}`,
          `commits=${drift.commits}`,
          `visitor_commits=${drift.visitorCommits}`,
          `live_commit=${drift.live.commit}`,
        ];
  appendFileSync(path, lines.join("\n") + "\n", "utf8");
}

interface Args {
  repo: string;
  head: string;
  maxAgeDays: number;
  url: string | null;
  json: boolean;
}

export function parseArgs(argv: string[]): Args {
  const args: Args = {
    repo: "ChelseaKR/trans-docs-navigator",
    head: "origin/main",
    maxAgeDays: DEFAULT_MAX_AGE_DAYS,
    url: null,
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = (): string => {
      const v = argv[i + 1];
      if (v === undefined) throw new StalenessUnknown(`${arg} needs a value`);
      i += 1;
      return v;
    };
    if (arg === "--repo") args.repo = next();
    else if (arg === "--head") args.head = next();
    else if (arg === "--url") args.url = next();
    else if (arg === "--json") args.json = true;
    else if (arg === "--max-age-days") {
      const raw = next();
      const parsed = Number.parseInt(raw, 10);
      if (!Number.isFinite(parsed) || parsed < 0) {
        throw new StalenessUnknown(`--max-age-days needs a non-negative integer, got ${JSON.stringify(raw)}`);
      }
      args.maxAgeDays = parsed;
    } else throw new StalenessUnknown(`unknown argument ${JSON.stringify(arg)}`);
  }
  return args;
}

/**
 * `fetchOptions` exists so the tests can drive the refusal paths without the suite
 * sleeping through the real backoff. It is not CLI surface: a real run always uses the
 * bounded retries the cold start needs.
 */
export async function main(argv: string[], fetchOptions: FetchOptions = {}): Promise<number> {
  let drift: Drift;
  try {
    const args = parseArgs(argv);
    const baseUrl = args.url ?? resolveLiveUrl(args.repo);
    const live = await fetchVersion(baseUrl, fetchOptions);
    drift = measure(live, args.head, new Date(), args.maxAgeDays);
    console.log(args.json ? JSON.stringify(asJson(drift), null, 2) : render(drift));
  } catch (err) {
    if (!(err instanceof StalenessUnknown)) throw err;
    console.error(`cannot measure deploy staleness: ${err.message}`);
    writeGithubOutput(null, err.message);
    return 2;
  }
  writeGithubOutput(drift, null);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
