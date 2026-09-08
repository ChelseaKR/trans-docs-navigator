# Changelog

All notable changes to this project are documented in this file. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project has not yet cut a
tagged release (`package.json` is `0.1.0`, `git tag -l` is empty), so everything to date
lives under `[Unreleased]`.

## [Unreleased]

### Added
- **A staleness horizon: how much serving life the corpus has left, and the day it runs
  out** (`api/horizon.ts`, `/healthz`, `/metrics`, `scripts/freshness.ts --horizon-days=N`).
  Guardrail 4 had one clock and it only ever read the present tense. `make freshness` asks
  "is anything stale *now*", and the answer was 0 — accurately, and uselessly, because this
  corpus does not decay. It was seeded in a single pass: **436 of the 438 records serving on
  2026-09-07 share one `last_verified` (2026-07-13) and one 90-day SLA**, so they lapse
  together.

  ```
  2026-10-11   436 serving
  2026-10-12     0 serving
  ```

  On that day `readiness()` starts answering 503, every checklist step in every state
  renders degraded, and until now nothing in this repository said it was coming. A
  "how many are stale today" check reads clean right up to that morning; the shape of the
  failure is invisible to it.

  `stalenessHorizon()` reports, from the corpus and `freshnessOf` alone, when each
  currently-serving record lapses, how many are left after each date, and — separately —
  whether one single day takes at least half of everything serving. That last field is the
  cliff, and it is `null` for a corpus that decays evenly, so it is a property of the data
  rather than a line the report always prints. The lapse-date arithmetic restates a rule
  that lives in `api/freshness.ts`, so `tests/horizon.test.ts` checks it against `isCurrent`
  itself for every record in the real corpus, on the day before and the day of.

  **`/healthz` no longer publishes a record count alone.** `corpus_records: 688` counts
  files on disk and will still read 688 on 2026-10-12 with zero of them serveable; a
  monitor watching that number would see nothing wrong through a total content blackout.
  It now carries `serving_records`, `serving_until` and `days_until_none_serving` beside
  it. Its `status` is deliberately unchanged and it still answers 200 in every case: three
  deployment targets use `/healthz` as the container liveness path (the Dockerfile
  `HEALTHCHECK`, `AWS_LWA_READINESS_CHECK_PATH`, `render.yaml`'s `healthCheckPath`), so it
  is a statement about the process. The freshness verdict is `/readyz`'s and is untouched.

  `/metrics` gains `tdn_corpus_records`, `tdn_corpus_serving_records` and
  `tdn_corpus_days_until_none_serving`. The countdown gauge is **absent**, not zero, once
  nothing serves: "it lapses today" and "it lapsed already" are different facts, and an
  alert written against the first would fire forever on the second.

  The weekly `content-watch` sweep now passes `--horizon-days=30`, which turns the
  lookahead into a failure and therefore into a GitHub issue. That workflow's header
  already described this check — "does any record expire its SLA within the next 14 days" —
  and `scripts/freshness.ts` had never looked ahead at all; the header now matches what
  runs. The flag is passed **there and nowhere else**: the merge gate keeps its
  commit-driven contract, because a merge-blocking check that goes red on a calendar date
  stops every unrelated PR in the repository and teaches people to bypass it. The merge
  gate does now *print* the horizon on every run, since the interesting number is never
  today's.

- **A second, independently reviewed staleness signal** (`api/sentinel.ts`,
  `scripts/sentinel-sync.ts`, `make sentinel`; #228). Guardrail 4 says stale law is broken
  law, and staleness here had exactly two detectors: this project's own hash watcher and
  the SLA clock. Both are ours, and both share our blind spots — for a cited source we
  cannot fetch, `last_verified` is a human's assertion that nothing moved, never a checked
  one.

  `ChelseaKR/id-churn-sentinel` watches the same class of government pages and publishes
  every change with the name of the human who classified it. Its `changes.json` and
  `sources.json` are vendored under `corpus/external/id-churn-sentinel/` and pinned by
  sha256, so nothing fetches at runtime and a run is reproducible from the commit alone.
  A change flags a record only when it is human-confirmed, independently reviewed,
  substantive, still active, matched on the *page* rather than the host, and observed
  strictly after that record's own last check. A flagged record is degraded to
  `needs_reverification` and carries `flagged_by: { feed, change_id, reviewed_at }`; its
  Spanish twin is degraded with it, because verification state is a fact the pair shares.

  **The feed publishes nothing today, and the sync says so in those words.** "0 records
  flagged" and "the sentinel has published no changes yet" are the same number and
  different facts, and only one of them is about the law. A missing vendored file, a
  sha256 that disagrees with the pin, or a `schema_version` outside the pinned major all
  stop the run rather than matching nothing — silently matching nothing is how an absence
  gets published as an all-clear, on the one signal that exists to say "your source
  moved."

  `make content` gained the merge-blocking half: every `flagged_by` in the corpus must
  name a change that is actually in the vendored feed and still actionable, so a
  hand-written flag, or a vendored artifact edited to delete the entry that flags you,
  fails a blocking gate.

  `docs/audits/coverage.md` gained an **Externally unwatchable sources** section: nine
  hosts this corpus cites that the sentinel has publicly declared it cannot watch either —
  three of its own named, dated gaps (`robots-disallowed`, `blocked-403`) and six
  registered sources its crawler cannot reach, including `travel.state.gov` and
  `health.ny.gov`. A reader told "we cannot check this automatically" should not be left
  assuming somebody else is checking it.

- **An English record and its Spanish twin must now stay in step** (`api/translations.ts`,
  enforced by `make content`; #229 item 1). Measured on the corpus as it stands: 344
  English records, 344 Spanish records, a clean 1:1 match on the `<en-id>.es` id
  convention, zero orphans. All of that was true by care alone, and care does not fail a
  build. Nothing required an English record to have a Spanish twin, required a Spanish
  record to name a real English canonical, or required the two sides to agree on the
  fields that are facts about the rule rather than about the language. Add a record on one
  side only, delete one, or change a jurisdiction, a `verification_status`, a
  `recheck_sla_days` or a `form_ref` on one side, and every gate stayed green.

  That gap lands on the reader least able to check it. A Spanish reader is shown a step
  with exactly the confidence an English reader gets, so a silent divergence is discovered
  in a clerk's office.

  `make content` now fails on: a Spanish record whose id names no English canonical; a
  translation whose canonical is not in the corpus; a twin that disagrees on
  `jurisdiction`, `document_type`, `change_type`, `verification_status`,
  `recheck_sla_days`, `audience` or `form_ref`; a twin carrying its own
  `source.last_verified` (a translation inherits verification from the English source
  check, so the two dates are one fact); and a twin citing a different *host* from its
  canonical.

  Citing the same agency's Spanish-language page is expected and allowed — three records
  already do, and that is better sourcing, not drift — which is why the source check is at
  host level rather than URL level.

  **The gate is not "every English record must have Spanish."** That would make adding one
  English record require inventing Spanish for it, which is how a corpus acquires
  machine-drafted legal text nobody has read. An English record may instead be declared
  untranslated in the new `corpus/translation-status.json`, with a reason: the gap becomes
  a written, countable fact rather than an absence nobody notices. A record that is
  neither translated nor declared fails; so does a declaration for a record that has since
  been translated, because a coverage statement that drifts from the corpus is the thing
  this check exists to stop. An unreadable declaration file yields an **empty** set, never
  a permissive one, so a broken declaration makes the gate stricter rather than excusing
  every gap it was meant to account for. The list is empty today.

  No record was changed and no schema was migrated. #229 proposes adding `canonical_id`
  and `translation_of` fields to every record; this derives the same linkage from the id
  convention already in the data, because a half-migrated corpus is worse than an
  unmigrated one and the honesty value of that item is the enforcement, not the field.
  When the migration lands, `canonicalIdOf` reads the declared field instead of the
  suffix and every invariant is unchanged.

- **`GET /changes` — a printed packet can ask what has been re-checked since it printed**
  (`api/changes.ts`, EXP-03). A packet starts going stale the moment it prints, and
  guardrail 4 ("stale law is broken law") had no way to reach paper: someone three months
  into a court-order-then-DMV sequence could only find out by redoing intake and
  comparing by eye. The packet footer now prints an absolute URL carrying the date it was
  generated plus its existing selection-only fields, and `/changes` compares that date
  against the corpus as it stands today, per step, in the same order the paper shows.

  **What it will not say is the point of it.** EXP-03 asks for three states —
  `unchanged`, `re-verified`, and `CHANGED — see step N` with the entries after `since` —
  and names its dependency: per-record changelogs, which are corpus schema v2 (FIX-03)
  and are not built. So this ships EXP-03's own specified degraded mode, and the state it
  omits is `unchanged`. Without changelogs this repository does not know whether the law
  changed; it knows only whether anyone re-checked the cited page. Rendering "unchanged"
  would publish an absence of evidence as a reassurance, on the one artifact a person
  carries into a clerk's office. The honest state is narrower and is a fact about this
  project rather than about the law: "No re-check has been recorded since your packet
  printed." A test asserts the word `unchanged` does not appear in the rendered body at
  all, and the caveat that per-step change history does not exist is unconditional — it
  is on the page even when every step was re-verified yesterday.

  A packet older than the longest recheck SLA in the corpus is declared unusable outright
  (the number is derived from the records, not hard-coded). A `since` that is missing,
  malformed, or in the future is a 400, never a silent default to today: defaulting would
  answer "has anything changed since now", which always says no. `/changes` is `noindex`,
  `robots.txt`-disallowed, deliberately not memoized (a memo key on `since` is
  retention), and **nothing derived from `since` reaches the log** — not the date, and
  not the one-bit "is this packet expired", which would still narrow a person to a range
  of print dates. `docs/audits/dpia.md` carries the new row; `scripts/latency-bench.ts`
  and `loadtest/p95.k6.js` measure the uncached route against the same p95 budget
  (p95 0.44ms).

  The QR code EXP-03 also asks for is **not** here. A QR that silently fails to scan is
  itself an absence rendered as a value, and the printed short URL is the safer first
  step. #230 stays open for it, and for the real `changed` state once FIX-03 lands.

### Fixed
- **The birth-certificate step answered with the wrong state's rules and said nothing about
  it** (`api/checklist.ts`, `api/types.ts`, `src/render.ts`, `src/compare.ts`,
  `src/i18n/*`). A birth certificate is amended by the state that **issued** it. The engine
  resolves every step against `Intake.jurisdiction` — where the reader says they live —
  which for a birth record is the right state only for someone who never moved. Roughly a
  quarter to a third of US residents live outside their state of birth, and the share is
  higher among people who moved for safety, which is the situation this project exists for.

  Until now the only thing conditioning that step was each record's own prose. Measured on
  the corpus: **26 of 51 jurisdictions carry no such conditioning in any of their
  birth-certificate records** — California's happens to read "If you were born in
  California…", Texas's does not — so on half the country `/checklist?state=TX` presented
  Texas's amendment process with nothing on the page saying it applies only to a Texas
  birth certificate, and nothing telling someone born in Tennessee where to look instead.

  `ChecklistStep.governed_by_issuing_jurisdiction` (set from `PORTABILITY`'s
  `state-of-birth`, so there is no second hand-kept list to drift) now carries that fact,
  and every surface that renders steps says it: the screen, the printed packet, and a
  footnote under `/compare`'s birth-certificate column, in English and Spanish. The
  records shown are unchanged — routing them elsewhere needs a state of birth this app
  deliberately never asks for (#250) — and the line makes no claim that any state honours
  another state's document, which is a separate and still-unanswered question (#241).

- **A step whose sources had all gone stale told the reader to "check the official source"
  and deleted every official-source link from the page** (`api/checklist.ts`,
  `api/relocation.ts`, `src/render.ts`). A checklist step is emitted whenever any record
  matches it, but only records inside their recheck SLA reached `record_ids`, and every
  source list rendered from `record_ids`. So when a cell's records had all lapsed, the step
  rendered "Needs reverification, so we don't show it as current", the *Not yet covered*
  section said "Check the official source." — and the page contained no official source to
  check. The agency URL, the one thing on that step that had *not* gone stale, was the only
  thing removed.

  Measured on 2026-09-07 this was live for three cells: Alabama birth certificates, and
  Montana and South Dakota driver's licences. It is not a corner case for long. All 438
  records serving today carry a 90-day SLA, and 436 of them share `last_verified:
  2026-07-13`, so on **2026-10-12 the corpus goes from 436 serving records to zero in a
  single day** and every step in every state renders this way at once.

  Steps now carry `unverified_record_ids` alongside `record_ids`, and a step with no
  current citation renders the lapsed records' pages under their own heading — "Check
  these official pages yourself", with a sentence saying we have not re-read them and are
  not showing what they said. **Only the URL crosses.** No statement, detail, cost,
  timeline, prerequisite or discretionary flag is ever taken from a lapsed record;
  `record_ids` remains the sole source of all of those, and a test sweeps the whole corpus
  on the post-cliff date asserting no statement leaks through the stale path. The block is
  deliberately not shown when a current citation already exists — a live source and a stale
  one side by side blurs which is which.

  `/plan` had the identical defect in its own step type and renderer, and is fixed with it.
  A new corpus-wide test asserts the invariant the checklist page's own lede claims — that
  *every* rendered step links to at least one official source — on both today's date and
  2026-10-12.

- **The weekly content sweep could not tell anyone what it found.** Every check in
  `.github/workflows/content-watch.yml` was written as `run: make link-check 2>&1 | tee
  link-check.out` with no `shell:` key. Actions' default `run:` shell on Linux is
  `bash -e {0}` — **without `pipefail`** — so each step exited with `tee`'s status, which
  is always 0. All four checks reported `success` whatever they found, and the
  issue-opening step, whose `if:` reads those outcomes, could never fire.

  This was not theoretical. The live run of 2026-09-07
  ([`34092783935`](https://github.com/ChelseaKR/trans-docs-navigator/actions/runs/34092783935))
  logged `❌ link-check: 3/421 source URL(s) dead` while its step concluded `success` and
  the issue step was `skipped`. **No issue has ever carried the `content-watch` label.**
  Three cited sources were dead on a project whose first guardrail is that no claim ships
  without a working citation, and the machinery built to say so was structurally unable
  to. Measured: `bash -e -c 'false | tee /dev/null'` exits 0; `bash -eo pipefail` exits 1.

  Each check now declares `shell: bash`, which selects `-eo pipefail`.
  `tests/content-watch-workflow.test.ts` holds three properties: no piping step may run
  under a shell that swallows the status; the issue-opening `if:` must read the outcome of
  every step marked `continue-on-error`, so a check added later cannot fail silently; and
  every output-capturing check must stay `continue-on-error`, so the first drift does not
  abort the sweep before the rest run.

  The same commit wires `make sentinel` in as the sweep's **fifth** check, so the external
  drift signal added alongside it actually runs weekly rather than only when someone types
  the target by hand. It declares `shell: bash` like the rest, and the property test above
  is what stops a sixth check from being added without being wired into the issue.

- **`api/freshness.ts`'s `isValidIsoDate` threw instead of returning false.** A date that
  matches `YYYY-MM-DD` but cannot exist splits into two cases: JavaScript rolls some over
  (`2026-02-30` becomes `2026-03-02`, which the round-trip comparison catches) and
  rejects others outright (`2026-13-45` yields an Invalid Date). Calling `.toISOString()`
  on an Invalid Date raises a `RangeError`, so the predicate had a third outcome besides
  true and false and every caller inherited it. That contradicted `servingToday`'s own
  documented contract that a malformed `NAV_TODAY` pin is *ignored*: such a pin crashed
  the serving path on its first freshness evaluation rather than falling back to the real
  clock. Found while building `/changes`, where the same string is user-supplied and the
  throw would have been a 500 instead of the intended 400. One validator now, guarded and
  exported, with the `NAV_TODAY` case covered in `tests/freshness.test.ts`.

- **`GET /version` — what the running image was built from** (`api/version.ts`): the AWS
  preview deploys only on a manual `workflow_dispatch`, so the live service can be
  arbitrarily far behind `main`, and nothing on the wire said which commit it was
  running. The image now carries `BUILD_COMMIT`/`BUILD_TIME` build args (Dockerfile) and
  `/version` serves them alongside the package version and the corpus digest already
  verified at boot. It never invents an answer: a stamp that is not exactly 40 lowercase
  hex — unset, empty, an abbreviated SHA, a branch name, the literal `unknown` — is
  reported as `commit: null, stamped: false`, because a plausible-looking wrong commit is
  worse than an admitted absence (`tests/version.test.ts` drives every one of those
  inputs). `deploy-aws-preview.yml` now refuses to report success unless the live URL
  reports the exact SHA the run deployed, and then that `/readyz` answers 200.
- **The preview deploy no longer reports success when it deployed nothing**
  (`.github/workflows/deploy-aws-preview.yml`): the configuration guard was a first step
  that ran `exit 0` when `AWS_DEPLOY_ROLE_ARN` was unset, with every later step carrying
  `if: env.configured == 'true'`. Unconfigured, the job ran to completion with every real
  step skipped and reported **success** — a green check beside "deploy-aws-preview" that
  reads as "the preview deployed" when nothing was built, pushed, or activated. `vars`
  (unlike `secrets`) is readable from a job-level `if:`, so the gate moved there: an
  unconfigured run now renders the deploy job as *skipped*, and a companion job states in
  warning text that nothing shipped.
- **Referrals everywhere** (`src/help.ts`): the "Where to get help" block (the state's A4TE
  guide + legal-aid referrals from `corpus/referrals/`, state first then federal) now renders
  on the SEO guide pages (`/guide/<state>/<topic>`) and on the relocation plan (for the
  *destination* state) — not only on the checklist and printable packet. One shared renderer
  so the four surfaces cannot drift in ordering, escaping, or the pseudolocale fallback.
  The plan's block is static per-state links in the same outbound-only class as the
  checklist's; nothing queries a third party with the plan.
- **"Which state?" comparison** (`/compare`, `api/compare.ts` + `src/compare.ts`): the
  relocation planner's inverse question. `/move` → `/plan` answers "I'm moving from X to Y,
  what changes"; `/compare` answers "which states have a documented path for what I need,
  and which don't", as a table of every covered state against the documents/changes
  selected. Each cell is one of exactly four corpus-derived facts — `documented`,
  `documented, needs reverification`, `no path documented` (a record's own text says the
  official source describes no route — a fact about the source), or `not covered` (no
  record at all — this project simply hasn't checked). Those last two read differently on
  purpose: collapsing "we looked and the source says no" into "we haven't looked" is exactly
  the honesty failure `api/checklist.ts:hasNoStateCoverage` already guards against one level
  up. No editorial ranking anywhere: no score, no "safe"/"friendly"/"hostile" label, default
  sort is alphabetical, and the only other sort offered is a literal count
  (`documentedPathCount` — "number of documented paths"), labelled as exactly that. Every
  cell links to the record(s) it came from via a `<details>` disclosure. The results table
  (up to 51 rows) is responsive: a horizontally-scrolling box on wider viewports, a per-row
  card list under 640px — both proven against the pseudolocale-overflow gate (G9) at ~40%
  text expansion. Reuses `PORTABILITY` from `api/relocation.ts` (a federal document like the
  SSA card resolves to the same record for every state) rather than re-deriving it. No new
  `make verify` stage: enforced inside the existing gates, like the relocation planner
  before it. See [`docs/RELOCATION.md`](./docs/RELOCATION.md) §"The inverse question" and
  [`tests/compare.test.ts`](./tests/compare.test.ts).
- **Federal immigration/military/employment layer**: expands the federal layer (`jurisdiction:
  "US"`) beyond SSA and passport with 7 new document types — `green-card` (Form I-90),
  `naturalization-certificate` (Form N-565), `ead` (Form I-765), `selective-service`,
  `military-records` (DD-214 correction via DD Form 149 + a VA name-change record),
  `trusted-traveler` (TSA PreCheck + Global Entry), and `federal-employment-records`
  (OPM). 16 EN + 16 ES corpus records, 4 forms-registry entries, and 12 new eval/gold
  items (EN + ES). Sourced from uscis.gov (including the Policy Manual's April 2025
  "biological sexes" update, cited by name for the green-card and EAD gender-marker
  records, and its N-565 chapter for the naturalization-certificate records),
  sss.gov, archives.gov, va.gov, tsa.gov, and cbp.gov.

  Every gender-marker record either states the sourced policy or says plainly that the
  official page never addresses a gender-marker change at all (Selective Service,
  military records, TSA PreCheck, Global Entry, OPM) — an uncovered path renders as a
  disclosed gap, never a guessed process. OPM's federal-employment-records
  gender-marker record is backed by a full-text search of the entire Guide to
  Processing Personnel Actions (17,000+ lines): zero mentions of sex or gender.
  `federal-employment-records` and `military-records` (DD Form 149, the DD-149 PDF
  form entries, and the OPM guide PDF) cite unextractable-PDF or no-baseline sources
  and are UNCHECKABLE by `make fidelity`/drift-watch, never silently passed — added to
  `tests/watchability.test.ts`'s sorted pin. This is a schema change (`api/types.ts`
  `DocumentType`, `api/relocation.ts` `PORTABILITY` — all seven are federally
  portable — `api/checklist.ts` `CANONICAL_ORDER`, `src/pages.ts` `DOCUMENT_IDS`, and
  EN/ES `docTitles`/`docLabels`), opt-in only (not in `STANDARD_SET`, so they render
  only when selected) and, like every record in this corpus, verified only by the
  placeholder `Pilot Seed Reviewer` — mechanically valid, not launch-cleared.

- **Per-jurisdiction change-alert feeds** (RSS 2.0, no accounts/no PII): `/feeds/<jurisdiction>.xml`
  (e.g. `/feeds/US-WA.xml`) and an HTML index at `/feeds`. Entries are derived purely from
  each record's own `source.last_verified` date (grouped per jurisdiction/language) — not
  from git history or a generated manifest, since the production service runs on AWS Lambda
  with no git at request time and this needs no build step to stay in sync with the corpus.
  Every channel description and item description states plainly that the feed reports
  changes to OUR RECORDS, never that the law changed, and carries the same
  "information, not legal advice" disclosure as every other page. Surfaced as a plain
  "Get notified when we update <state>'s records (RSS)" link plus `<link rel="alternate"
  type="application/rss+xml">` autodiscovery on the checklist page. `/feeds` joins the
  indexable content surface (sitemap + seo-lint + a11y-lint + Lighthouse); the feed XML
  itself is discovered via autodiscovery, not the HTML sitemap. New: `api/feed.ts`,
  `src/feeds.ts`, `tests/feed.test.ts`; EN/ES strings added to `src/i18n/`.
- **District of Columbia, West Virginia, and Kentucky** (M6 — expand jurisdictions): 15 EN
  + 15 ES corpus records (court-order name change, driver's-license name and
  gender-marker, birth-certificate name and gender-marker), 6 referrals, and 8
  forms-registry entries. DC is modeled as a district under jurisdiction id `US-DC`
  (labeled "District of Columbia" throughout, never called a state) consistent with the
  existing `US-XX` convention. Sourced from DC Superior Court, DC Health Vital Records,
  and DC DMV; West Virginia's Judiciary, DMV, and Health Statistics Center; and Kentucky's
  Revised Statutes, Transportation Cabinet, and Cabinet for Health and Family Services'
  Office of Vital Statistics.

  DC Superior Court (`dccourts.gov`) refuses this project's declared user-agent
  domain-wide (like NY Courts), so `dc.court-order.name` cites the court's own name-change
  instructions PDF and is UNCHECKABLE by `make fidelity`, never silently passed. Two DC
  Health PDF forms are likewise unextractable-but-authoritative, matching the Georgia
  precedent.

  West Virginia's own statute portal (`code.wvlegislature.gov`) is fetchable but renders
  its actual statute text only via client-side JavaScript, so no automated snapshot can
  ever contain it; `wv.court-order.name` instead cites the Judiciary's county-court
  directory and plainly states that West Virginia publishes no standard name-change form
  or self-help guide online — the honest degradation this project's own standard calls
  for rather than describing a process that does not work.

  Kentucky's law (KRS 213.121(5)) is considerably more restrictive than most jurisdictions
  in this corpus: a birth certificate's gender marker may only be amended after a licensed
  physician swears the person's gender has been changed **by surgical procedure**, together
  with a certified court-ordered name change — sourced directly to the current statute and
  to the state's own VS-2J amendment form, which reprints it. Kentucky's Transportation
  Cabinet publishes no separate process for a driver's-license/ID gender-marker change on
  its own; `ky.drivers-license.gender-marker` says so plainly and is marked
  `needs_reverification` rather than describing a path that may not exist.

- **Indiana, Iowa, and Missouri** (M6 — expand jurisdictions): 7 + 6 + 7 EN corpus records
  (20 EN + 20 ES, 40 total), 6 referrals, and 2 forms-registry entries, each sourced from an
  official state page, a state statute, or a state administrative rule and fetched into
  `corpus/snapshots/`.
  - **Indiana** requires publishing a Notice of Petition for Change of Name in a newspaper
    once a week for three weeks, at least 30 days before the hearing (Ind. Code
    § 34-28-2-3(a)) — but Indiana's own statewide court-approved forms packet (Coalition
    for Court Access) lets a petitioner ask a judge to waive publication and seal the case
    instead, citing Indiana Court of Appeals decisions recognizing the risk transgender
    petitioners face if their case is public: *In re Name Change of A.L.*, 81 N.E.3d 283
    (Ind. Ct. App. 2017); *In Re M.E.B.*, 126 N.E.3d 932 (Ind. Ct. App. 2019); *In Re K.H.*,
    127 N.E.3d 257 (Ind. Ct. App. 2019). Separately, effective February 12, 2026, Indiana's
    BMV states it will no longer let a customer change the gender on a license or ID by a
    court-ordered gender change or physician statement (Amended Rule 140, 140 IAC 7-1.1-3) —
    recorded as a closed path, not a process that no longer works, and marked
    `needs_reverification`. Indiana's health department states a court order is needed to
    change the sex on a birth record, but this project could not find an official form or
    page describing how to get one, and a legal-aid guide (Indiana Legal Services'
    LGBTQ+ Project) says an Indiana birth certificate's gender marker cannot be changed at
    all — a conflict this project cannot resolve from official sources alone, so that record
    is also `needs_reverification`.
  - **Iowa** requires no newspaper publication for a name change (Iowa Code ch. 674) but
    does require a 30-day wait after filing, a $195 filing fee, and a certified copy of the
    petitioner's birth certificate. A 2025 Iowa law (Senate File 418, effective July 1,
    2025) removed the only path Iowa Code ever had for changing the sex shown on an Iowa
    birth certificate — a notarized physician's affidavit under the since-repealed
    § 144.23(3) — and added Iowa Code § 4.1A, which defines "sex" for state purposes as the
    sex observed or verified at birth. Iowa's DOT publishes no page describing any way to
    change the sex/gender marker on a license or ID. Both gender-marker records are
    recorded as closed/undocumented paths, not invented processes, and marked
    `needs_reverification`.
  - **Missouri** requires newspaper publication once a week for three consecutive weeks,
    unless the petitioner is a documented victim of domestic violence, child abuse, or
    family/household-member abuse (per Missouri's official Judgment for Change of Name
    form). Missouri's Department of Revenue acknowledges a driver's-license "gender" field
    exists and may require additional documents to change, but its own pages name no
    document, form, or process for doing so — recorded as an honest gap, not an invented
    one, and marked `needs_reverification`. Missouri's vital-records rule (19 CSR
    10-10.110) requires a court order to change a birth record's sex only when the change
    was by surgical procedure, or when paired with a name change to one typically used for
    the opposite sex — and the state's own public correction-affidavit form omits the
    "surgical procedure" trigger that the full regulation states, a discrepancy this record
    surfaces rather than resolves. Missouri's courts website (`courts.mo.gov`) refuses this
    project's declared user-agent domain-wide, so its self-help page on newspaper
    publication is recorded as `refuses-our-user-agent`, the same honest degradation
    already applied to NY Courts and the SSA.
  - Both Iowa and Missouri's gender-marker findings, and Indiana's newspaper-publication
    safety exception, directly demonstrate this repo's `needs_reverification` /
    honest-gap discipline on contested and recently-changed law rather than describing a
    process that does not work (PR #119's standard).

- **Idaho, Utah, and Wyoming** (M6 — expand jurisdictions): 19 EN + 19 ES corpus records
  (court-order name change, driver's-license name and gender-marker, and birth-certificate
  name and gender-marker) across all three states, 7 referrals, and 3 forms-registry
  entries, each sourced from an official state statute, court self-help page, DMV/driver's
  license page, or vital-records page and fetched into `corpus/snapshots/`. Idaho's current
  birth-certificate statute (Idaho Code § 39-245A, added 2020 and amended again in 2024)
  treats sex as a "material fact" fixed at birth, correctable after the first year only for
  "fraud, duress, or material mistake of fact" — an earlier version of this same policy was
  the subject of federal litigation, so both Idaho gender-marker records are marked
  **`needs_reverification`** rather than presented as a settled bar. Utah's *current* law
  (Utah Code § 26B-8-111) actually **permits** a court-ordered sex-designation change under
  detailed criteria (clear-and-convincing evidence, six months' consistent expression,
  clinically significant distress) — the opposite of a closed route — but Utah's courts and
  legislature have sent conflicting signals on this over time, so those records are also
  marked `needs_reverification` rather than asserted as durably settled either way. Wyoming's
  official vital-records pages and statute (W.S. 35-1-424) never mention a sex/gender
  designation at all; that silence is recorded as a genuine documentation gap, not inferred
  as either an open or a closed path (PR #119's standard). Idaho's, Utah's, and Wyoming's
  driver's-license pages are likewise silent on a sex/gender marker, recorded as `verified`
  plain absences (Tennessee's PR #119 pattern) rather than volatile facts. Idaho's birth
  certificate name-change source (a DHW instructions PDF) and Wyoming's and Utah's
  registered vital-records forms have no drift baseline and are pinned in
  `tests/watchability.test.ts` as deliberate, not silent, gaps.

- **Delaware, New Hampshire, and Maine** (M6 — expand jurisdictions): 20 EN + 20 ES corpus
  records (court-order name change, driver's-license name and gender-marker, and
  birth-certificate name and gender-marker for all three states), 6 referrals, and 5
  forms-registry entries, each sourced from an official state statute, court, DMV/BMV, or
  vital-records page and fetched into `corpus/snapshots/`.
  - **Delaware**: name changes go to the Court of Common Pleas (not Chancery), $85 filing
    fee, publication repealed in 2022 (Del. Code tit. 10, ch. 59). The DMV's gender-marker
    change needs a medical or social-service provider's certification (Form MV2020) —
    self-attestation, but not self-*certification*. Birth-certificate sex-designation
    changes need notarized Requester's and Healthcare Provider's affidavits; no court order
    unless the name is also changing. A pending bill (HB 375) would remove the
    provider-certification requirement and add an "X" marker but had not passed as of
    research — recorded as pending, not as current law.
  - **New Hampshire**: the probate court cannot require consent or public notice for an
    adult's own name change (RSA 547:3-i, RSA 550:4); filing costs $170 (Family Division:
    $140), per the court's own fee schedule. The DMV's gender-marker change is genuinely
    self-attested — the current page lists only a form, current ID, and a $10 fee, no court
    order or medical letter. A birth-certificate sex-designation change requires a court
    order and results in a **new** record rather than an annotated one (RSA 5-C:87 ¶V) —
    a meaningful difference from the name-change process that the record calls out.
    `courts.nh.gov` and `dmv.nh.gov` refuse this project's declared user-agent (confirmed
    403 from both `fetch` and `curl`); the court-order and birth-certificate records
    instead cite `gencourt.state.nh.us` (the statute site), which is not blocked.
  - **Maine**: 18-C M.R.S. §1-701 bars the court from requiring public notice for *any*
    adult name change (not only gender-identity-related ones, contrary to this task's
    original premise — see "what I could not verify" below); filing costs $75. Maine's BMV
    gender-marker change is self-attested on a form that offers male, female, or
    non-binary, under penalty of perjury, no court order or physician's letter. Maine's
    birth-certificate process is the most permissive of the three: an adult can change
    their own gender marker AND, in the same filing, a first/middle name, with no court
    order at all (form VS-7, notarized, $60) — the only route in this corpus that lets a
    name change proceed without a court order tied to a gender-marker change on the same
    document.

  **What I could not fully verify by machine:** the task brief cited "LD 1626" as Maine's
  vehicle for repealing the public-notice requirement; the current Maine Legislature bill
  tracker shows LD 1626 (130th Legislature) is an unrelated, unenacted bill about the
  Maine Indian Claims Settlement. The statute's own section-history line names several
  amending Public Laws (2017–2023) but none of the chapter-law PDFs needed to isolate which
  one first added the no-public-notice sentence could be fetched. The record states only
  what the *current, in-force* statutory text says, not which bill produced it. Separately,
  the exact BMV fee for a name-change license reissue in Maine, and the exact DE DMV fee
  for the same transaction, could not be confirmed from any fetchable page — both records
  carry `cost.amount_usd: null` with a note to call the agency, rather than a guessed
  number. New Hampshire's DMV gender-marker fee is stated as $10.00 on the DMV's own page,
  but a secondary advocacy source states $3.00; the corpus uses the primary source's figure
  and this discrepancy is worth a human re-check before launch.

  All 40 new records (20 EN + 20 ES) carry `"verifier": "Pilot Seed Reviewer"` and
  `verification_status: "verified"`; none are launch-cleared. Gender-marker records use
  `recheck_sla_days: 30`, matching this repo's existing convention for politically volatile
  topics.

  `make verify`: 24/24 gates pass (470/470 tests, Playwright 16/16). `make fidelity`: 0
  unsupported assertions across the new records (220 uncheckable corpus-wide, up from
  179 — all from Delaware's and Maine's PDF-only forms and New Hampshire's blocked
  courts.nh.gov/dmv.nh.gov pages, none newly introduced beyond what each state's own
  sources make unavoidable).

  Snapshot discipline: `make source-snapshot` also refreshed 23 pre-existing snapshots
  with live drift from this simulated environment's source pages, unrelated to this
  change, plus 3 orphaned passport snapshots that `travel.state.gov` now 403s on fetch.
  Those refreshes were reverted (`git checkout -- corpus/snapshots/`) rather than adopted
  blind, per `docs/OPERATIONS.md`'s re-baseline discipline — only the 11 new snapshots for
  Delaware/New Hampshire/Maine's checkable HTML sources and their
  `corpus/source-hashes.json` baselines were added.

- **Connecticut, Rhode Island, and Vermont** (M6 — expand jurisdictions): 17 EN + 17 ES
  corpus records (court-order name change, driver's-license name and gender-marker,
  birth-certificate name and gender-marker, plus a birth-certificate fees record for RI
  and VT), 6 referrals, and 3 forms-registry entries, each sourced from an official state
  probate/judiciary, DMV, or health-department page and fetched into `corpus/snapshots/`.
  - **Connecticut**: the Probate Court's own name-change page (`ctprobate.gov`), the DMV's
    driver's-license update page and its Gender Designation form B-385 (F/M/Non-Binary,
    no medical documentation required), and DPH's Gender Change and Corrections and
    Amendments pages — a court-order-supported gender-marker change on a birth certificate
    still requires a licensed provider's affidavit of surgical, hormonal, or other
    gender-transition treatment.
  - **Rhode Island**: the name-change statute (R.I. Gen. Laws § 33-22-28 — no publication
    required, fee waiver for indigent petitioners), the DMV's combined name/gender-designation
    page, and the state's own e-Regulations portal (`rules.sos.ri.gov`) for vital-records
    amendments — used instead of `health.ri.gov`, whose HTML pages return 403 to this
    project's declared user-agent (its PDF documents remain fetchable and are cited directly
    where the HTML page could not be).
  - **Vermont**: the Judiciary's probate name-change page ($150 fee, waivable), the DMV's
    Identity Documents page (gender is a self-designated descriptor alongside height,
    weight, and eye color — no documentation required by state or federal law), and the
    Department of Health's birth-certificate forms. Both Vermont birth-certificate records
    cite a PDF form directly (the Affidavit of Gender Identity, and the Application to
    Correct or Amend a Vermont Birth Certificate) because no HTML page states the same
    operative facts; `make source-snapshot` marks both `unextractable`, and every assertion
    sourced to them is reported UNCHECKABLE rather than silently passed.

  All 34 new records carry `"verifier": "Pilot Seed Reviewer"` and
  `verification_status: "verified"`; none are launch-cleared. Gender-marker records use
  `recheck_sla_days: 30`, matching this repo's existing convention for politically
  volatile topics.

- **Virginia** (M6 — expand jurisdictions): 7 EN + 7 ES corpus records (court-order name
  change, driver's-license name and gender-marker, a driver's-license replacement-fee
  record, birth-certificate name and gender-marker, and a birth-certificate fee record),
  2 referrals, and 1 forms-registry entry, each sourced from the Code of Virginia,
  Virginia's Judicial System self-help site, Virginia DMV, or the Virginia Department of
  Health, and fetched into `corpus/snapshots/`. Virginia's name-change statute
  (§ 8.01-217) directs a petitioner to the circuit court of the county or city where they
  live and requires the court to grant the change unless it finds fraud, an infringement
  of others' rights, or — for a minor — that it is not in the child's best interest; extra
  requirements apply to incarcerated, probationary, or registered petitioners. Virginia no
  longer requires a court order to change the sex designation on a birth certificate — an
  adult files form VS42, signed by a treating medical provider, directly with the State
  Registrar — but both the DMV and birth-certificate gender-marker records are marked
  **`needs_reverification`**: Virginia's gender-marker policy has shifted with changes in
  administration before, so the corpus degrades rather than asserts a settled fact. The
  Code of Virginia's own site (`law.lis.virginia.gov`) was observed to intermittently
  include or omit a footer HTML fragment across otherwise-identical fetches; the committed
  snapshot and drift baseline were pinned to the same fetch to keep `make fidelity`
  deterministic, but the weekly `source-watch` job may need a human's eye on that one
  domain (see the PR description).

- **Maryland** (M6 — expand jurisdictions): 5 EN + 5 ES corpus records (court-order name
  change, driver's-license name and gender-marker, birth-certificate name and
  gender-marker), 2 referrals, and 2 forms-registry entries, each sourced from an official
  Maryland Judiciary, MVA, or Department of Health page and fetched into
  `corpus/snapshots/`. Maryland is comparatively permissive on a couple of fronts, recorded
  exactly as its own sources state them rather than generalized: the MVA's own page says
  **no documentation** is required to change the gender marker on a driver's license or ID
  (M/F/X), only an in-person appointment; and Maryland's birth-certificate sex-designation
  change accepts **either** a licensed health care practitioner's signed statement (surgical,
  hormonal, "or other treatment appropriate for the individual") **or** a court order — no
  surgery requirement, unlike some other states already in this corpus. The name-change
  court petition (Circuit Court, CC-DR-60, $165 filing fee) describes a 30-day objection
  window for adults, not a newspaper-publication requirement. Both PDF sources cited (the
  CC-DR-60 form and the Division of Vital Records' sex-designation fact sheet) were
  fetchable and are under drift watch, unlike Georgia's Form 3977 below — but their own text
  still cannot be fidelity-checked (PDF, not HTML), so assertions sourced to them are
  reported UNCHECKABLE rather than silently passed.

- **Georgia** (M6 — expand jurisdictions): 6 EN + 6 ES corpus records (court-order name
  change, driver's-license name and gender-marker, birth-certificate name and
  gender-marker, and a birth-certificate fee record), 2 referrals, and 1 forms-registry
  entry, each sourced from an official Georgia state page or administrative rule and
  fetched into `corpus/snapshots/`. Georgia's driver's-license gender-marker rule
  (Ga. Comp. R. & Regs. 375-3-1-.17) is recorded as **restricted, not open**: it requires
  a gender-reassignment operation plus a court order or physician's letter, and even then
  leaves the decision to the Department's discretion. Georgia's vital-records rules fold a
  birth-certificate sex-designation change into the generic "All Other Amendments" rule
  (511-1-3-.25), with no separate gender-identity or court-order path described. A
  name-change amendment to a Georgia birth certificate also carries an unusual,
  directly-sourced requirement — a physician's letterhead statement of an
  "intersex/transgender diagnosis" — read from the official Affidavit for Amendment
  (Form 3977); as a PDF, that source cannot be automatically fidelity-checked and is
  reported UNCHECKABLE rather than silently passed, the same honest degradation already
  applied to the New York sources this project cannot fetch.

- **ADR directory completed** (`docs/adr/`): the five build ADRs migrated out of
  `docs/ROADMAP.md` §6 into individual Nygard-format files (0001–0005, decision content
  unchanged), plus a new ADR-0006 recording the deliberate no-ESLint/no-Prettier/no-bundler
  toolchain deviation, its compensating controls, and its known open limit (lint scope is
  `api/`+`src/` only). `docs/ROADMAP.md` §6 now points at the files; README conformance
  rows updated to match.
- **Birth-certificate corpus coverage** for all five jurisdictions (CA, IL, NY, TX, WA) in
  EN and ES, from each state's own vital-records/health-department source: 28 records,
  including the `court-order → birth-certificate` prerequisite edge every one of those
  states states in its own words, and a **cited, plainly-stated closed route in Texas**
  (Vital Statistics lists only hospital/clerical-error evidence for the sex field, and no
  route to change it to match gender identity). No fee is estimated anywhere: where a
  source states one it is recorded, and where it does not, the step is reported unpriced.
- **`DEFINITION_OF_DONE.md`** at the repo root (audit P2, QM-18/QM-13/CQ-42): defines
  "done" with an explicit gate/review/human-gate enforcement split — it claims nothing as
  machine-enforced that isn't. The PR template gains the matching rollback, observability,
  and ISO 25010 quality-characteristic lines; CONTRIBUTING links it.
- **`state-of-birth` portability** in the relocation planner (`api/relocation.ts`) — a birth
  certificate is governed by the state you were *born* in, which is neither the origin nor
  the destination of a move and which the app never asks for. It is therefore never
  classified `redo-in-destination`, never given a closing-residency window, and never marked
  done by the "what you already have" checkbox; it gets its own plan phase ("Where you were
  born") that says the move changes nothing about it. See `docs/RELOCATION.md`.
- Offline-capable PWA shell with explicit user-initiated saving (EXP-01) — service
  worker, save-for-offline UI, no background sync, review-gate approved before merge.
- Structured JSON logging + `/livez` and `/readyz` fail-closed health/readiness probes.
- EN/ES locale key-parity CI gate (G6), UTF-8 (G1) and BCP-47 (G3) mechanical i18n gates.
- G9 pseudolocale overflow gate (Playwright, desktop + mobile) and G10 logical-CSS
  static gate (stylelint-use-logical) for RTL readiness.
- Trivy container CVE scan (HIGH,CRITICAL, blocking) on every push/PR.
- Renovate configuration with GitHub Actions digest pinning and a 72-hour cooldown.
- `CITATION.cff` for scholarly/portfolio citation.
- `CHANGELOG.md` (this file), `.github/CODEOWNERS`, `.nvmrc`, `.standards-version`,
  `.pre-commit-config.yaml` (gitleaks + typecheck), gitleaks CI + scheduled TruffleHog
  full-history secret scanning, and a release-hardening pass on `release.yml`
  (re-verify at tag, version-tag consistency check, keyless cosign signing, SBOM schema
  validation, digest-only publish, post-publish verification) — standards remediation,
  2026-07-05.
- HSTS and Permissions-Policy response headers (`api/server.ts`).
- `## Observability` tier declaration in `docs/ROADMAP.md` (Tier A, hosted service).
- README standards-conformance table.

### Fixed
- **Two Washington records were serving a wrong-direction fact and have been corrected, EN +
  ES** (source-drift triage, #150 / #192). `wa.court-order.name` said a name-change petition is
  "usually filed in the district court of the county where you reside"; `courts.wa.gov` now
  states petitions **may be filed in any district court in the state** (RCW 4.24.130 decides
  which court for the exceptions) — the record no longer names a residency-bound venue rule its
  source dropped. `wa.birth-certificate.name` said the DOH "currently take[s] about ten months to
  process" a court-ordered name change on a birth certificate; `doh.wa.gov` now states a **two (2)
  month** turnaround — the old figure was wrong in the direction that would make someone give up
  on a filing that's five times faster than the record claimed. Both facts were independently
  re-fetched and read (not taken on a prior report's word) before editing. The $25 certified-copy
  fee is unchanged and unaffected. Re-baselined only these two URLs after correcting the records,
  per the reviewed procedure in `docs/OPERATIONS.md`.
- Re-verified and re-baselined the other 22 sources `make source-watch` reported as drifted
  (`docs/audits/source-drift-2026-09.md`): 2 were substantive rewrites elsewhere on the page that
  don't touch what the record cites (an Illinois FAQ's civil-rights/passport sections; the DS-82
  passport-renewal PDF's OMB expiration-date bump), and 20 were cosmetic (rotating banners,
  nav-menu taxonomy, footer-year/timestamp churn, an emoji/apostrophe encoding artifact) — each
  read against its live fetch before being cleared, not batch-adopted. The ~82 baseline-coverage
  gaps left by the M6 jurisdiction-expansion PRs (sources with no reviewed baseline at all) are a
  separate problem and remain out of scope; see the PR for the current count.
- **The two SSA records now state the real, bifurcated federal rule, cited to SSA's own policy
  manual.** Every page under `www.ssa.gov` 403s a non-browser client, so both records cited a
  source no gate could read: the sex-marker record said only "policy has changed and is being
  litigated" (a stale non-answer), and the name record asserted a `$0` fee and a `2–4 week`
  timeline behind that unreadable citation. Rather than spoof a browser user-agent, both were
  repointed to SSA's **Program Operations Manual System** on `secure.ssa.gov`, which serves our
  declared UA a clean HTTP 200 and is SSA's *binding internal policy manual* — a more
  authoritative source than the public page it replaced. The records now say plainly, EN + ES:
  the sex field is **only** changed to reflect **sex at birth** (POMS RM 10212.200, TN 36,
  effective 2026-06-29), while a **court-ordered name change still works** (POMS RM 10212.001 /
  RM 10212.010 → .080). The unsourceable `$0` and `2–4 weeks` claims were **dropped**, not
  re-cited — POMS states neither, and the timeline was contradicted by POMS RM 10205.100
  ("within 2 weeks"). Both URLs are now snapshotted, drift-baselined and fidelity-checked:
  UNCHECKABLE assertions fell **42 → 32**, and unwatchable cited sources **4 → 3**.
- **`make link-check` no longer reports a live link as dead because the server's TLS is broken.**
  CDPH (`www.cdph.ca.gov`) sends its leaf certificate without the intermediate that signs it, so
  Node's `fetch` threw `UNABLE_TO_VERIFY_LEAF_SIGNATURE` and four **live** CDPH URLs (HTTP 200 in
  any browser) were reported as rot. `link-check` now distinguishes the two on evidence — a chain
  error can only be raised *after* the server presents a certificate, so it proves the host is up,
  whereas a dead host fails with `ENOTFOUND`/`ECONNREFUSED`/timeout (still reported dead) — and
  names the condition `incomplete-TLS-chain`, printing it on every run without failing the build.
  **Certificate verification is never disabled** (no `-k`, no `rejectUnauthorized: false`); the
  real status is confirmed through a client that completes the chain from the cert's AIA the way a
  browser does. The carve-out is scoped to the TLS error, not the host: a genuine 404 behind
  CDPH's broken chain is still reported dead.
- Re-baselined the **MAP Nondiscrimination** and **A4TE Know Your Rights** policy trackers after
  reading them and re-verifying the eight federal records they implicate. Recorded in
  `docs/OPERATIONS.md`: `policy-watch` stores *hashes, not content*, so a true before/after diff of
  a tracker is impossible, and the *MAP Nondiscrimination* tracker is **mis-scoped** (`jurisdiction:
  US` points its drift at the federal SSA/passport records, but the map carries zero federal
  identity-document content).
- A router test's simulated clock (`2026-05-31`) had silently decayed past the corpus's
  verification dates, so it was asserting a freshness refusal rather than the change-param
  defaulting it exists to pin. `freshnessOf()`'s future-date guard is unchanged.
- Un-pinned the runtime freshness clock from a frozen date (FIX-02) — the freshness SLA
  now evaluates against the real calendar in production.
- Checklist save-for-offline URL no longer duplicates `language=es`.
- `docs/ROADMAP.md` §7 no longer overstates the p95-latency row as "merge-blocking" when
  it wasn't wired into `make verify`; the in-process latency guard
  (`scripts/latency-bench.ts`) is now an actual `make verify` step (see below), and the
  ledger reflects the real gate shape (in-process guard merge-blocking; network-level k6
  run remains opt-in via `make loadtest`, against a deployed instance).
- The last unpinned GitHub Action (`aws-actions/configure-aws-credentials` in
  `deploy-aws-preview.yml`) is now SHA-pinned; 26/26 actions pinned.

### Security
- `persist-credentials: false` hardening across workflow checkouts.
- Dockerfile base image aligned to `node:22-slim`, matching `engines.node` and the
  CI-tested Node 22 runtime (previously drifted to `node:26-slim`).

## Prior audit baseline

`STANDARDS/AUDIT-2026-06-21.md` recorded 0 high / 4 medium / 4 low findings as of that
date; the entries above are everything shipped since then. See
`docs/audits/` for the currently-committed audit artifacts (DPIA, model card, data card,
residual-risk register, accessibility audit, eval reports) and their own dated
recheck-cadence notes.
