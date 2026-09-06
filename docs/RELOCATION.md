# Relocation planner — the destination delta

> Status: shipped behind the same 22 merge-blocking gates as the rest of the app.
> Code: [`api/relocation.ts`](../api/relocation.ts) (engine), [`src/relocation.ts`](../src/relocation.ts) (pages),
> [`tests/relocation.test.ts`](../tests/relocation.test.ts). Routes: `/move` (intake) → `/plan` (the delta).

## Why this exists

Relocation is a mass phenomenon among trans people, and the tooling stops short of it.
The Williams Institute finds that roughly **half** of trans adults have moved or are
considering moving because of state laws; a Plume survey of 2,200 trans people found
**28.3% had moved within 12 months** and **51.1% of those staying were considering it**.
The most-cited barrier, by a wide margin, is **cost (82%)**.

What exists today are **risk maps** — Erin in the Morning's state-by-state ratings are the
best known. A rating tells you Texas is dangerous and Washington is not. It does not tell
you that your Texas name-change petition has to be filed in the county where you live, that
this route disappears the day you stop living there, and that Washington's DOL will ask you
for a court order you no longer have an easy way to get.

That gap — from *rating* to *ordered, costed, cited plan* — is what this mode fills.

## What the mode does

Intake (`/move`) takes an origin state, a destination state, which documents you already
hold, which changes you're making, and a language. No account. No identity fields. The same
bounded-enum discipline as the checklist intake.

The engine (`buildRelocationPlan`) then computes a **destination delta** over the existing
corpus and classifies each document:

| Class | Meaning | Derived from |
|---|---|---|
| `carries-over` | Federal document. The move doesn't change which records govern it. | Records are `jurisdiction: "US"` |
| `redo-in-destination` | The destination has its own cited requirements for this. | Destination records exist |
| `keep-from-origin` | You already hold it, issued by the state you're leaving. | `held` + `state-of-record` |
| `governed-by-birth-state` | A birth certificate. The state that issued it is the state you were **born** in — not the one you're leaving, not the one you're moving to. | `state-of-birth` |
| `unknown` | We have no serveable record. Say so; never guess. | No current records |

### The birth-certificate asymmetry

Every other document in this model is anchored to a place you can *move*. A birth certificate is
anchored to a place you cannot: **moving does not change where you were born.** Washington's own
page says it only changes birth certificates "for people who were born in Washington State";
Illinois's says "an individual born in Illinois, with an existing Illinois birth certificate";
New York State's says it has no birth records at all for people born in New York City. So the
governing jurisdiction is the **state of birth**, and this app never asks for it — a birth state
is an identity field, and the relocation surface holds none.

The engine therefore refuses to answer the question it cannot answer. `governingJurisdiction()`
returns `null` for a `state-of-birth` document instead of guessing the origin or the destination,
and the plan emits **one step per state it covers in that plan**, each labelled with whose rules
they are, grouped under its own phase ("Where you were born") whose lead says the move changes
nothing about it — and says that a birth in a sixth state is not covered. The records' own cited
prose does the conditioning ("if you were born in California…").

Three failure modes are closed by construction, each with a test:

- **Never `redo-in-destination`.** Telling someone leaving Texas that Washington will re-issue
  their Texas birth record would be false, and no source says it. (It is also the single most
  plausible-sounding thing a naive planner would emit.)
- **Never a closing window.** The court-order route closes when you stop being a resident. The
  birth-certificate route does not — it was never keyed to residency — so no `origin-window-closes`
  hazard is raised for it, and none of the birth-certificate records carries `residency_bound`
  (their sources say *born in*, not *live in*; the content gate would reject the flag anyway).
- **Never "already done".** Checking "birth certificate" in *what you already have* says you hold
  a copy. It says nothing about whether the sex or name on it was amended, and nothing about which
  state issued it — so it never marks the amendment complete, and the step keeps its cost and its
  "applying creates a government record" caution.

## The dependency graph

This is the part that has real value, and the part most likely to hurt someone if it's
wrong. Three things are modelled explicitly.

**1. Prerequisite edges come from the corpus, not from us.** Records already carry a
`prerequisites` field (Washington's driver's-license record says to bring a court order —
because [Washington DOL's own page](https://dol.wa.gov/driver-licenses-and-permits/update-driver-license-information/change-your-name-or-address-your-driver-license)
says so). The planner reads those edges, topologically sorts the plan so nothing precedes
its own prerequisite, and renders each edge as a hazard **citing the record that states it**.
A cycle in the corpus degrades gracefully rather than hanging the planner (tested).

The birth-certificate records add the edge that matters most: **court order → birth certificate**,
in all six states. Each state's vital-records page says it in its own words (Washington: "send a
certified copy of the court-order name change"; New York: "a name change cannot be authorized
without a court order"; Illinois: "a certified copy of the Court Order of Legal Name Change also
must be submitted"; Pennsylvania: the amendment form asks for "a certified court order that
authorized the change"). Note the direction: in the six states we cover, **no** source makes an
amended birth certificate a prerequisite for a driver's-licence marker change — all five states
that still allow one let you self-attest. We did not encode an edge no source states.

**2. The closing door — steps that are only available while you still live in the origin
state.** This is the strand. Texas's cited source says you petition "in the district court
of **the county where you live**." Once you're a Washington resident, that route is gone.

This is expressed as a corpus annotation, `relocation.residency_bound`, and it is
constrained by a rule that matters:

> **A record may only claim `residency_bound: true` if its own cited prose actually says the
> action happens where you live.** [`api/corpus.ts`](../api/corpus.ts) rejects the annotation
> otherwise, in English *and* Spanish, as a content-gate violation.

So the flag can never assert something the source doesn't. Texas, California and Illinois
carry it ("the county where you live" / "del condado donde vive"). **New York and Washington
do not** — their sources never mention residency, so the planner raises no residency hazard
for them, even though it would be a plausible-sounding thing to say. That asymmetry is the
guardrail working, and there's a test asserting it stays that way.

**3. Alternative routes, not phantom steps.** If you don't hold a court order, there are two
routes to one: file in the origin while you still live there, or file in the destination
once you arrive. Those are **alternatives**. Emitting both as sequential steps would be a lie
of structure, so both are emitted, cross-linked (`alternative_to`), and labelled "do this one
or step N — not both."

## The cost model

Cost is the #1 barrier, so the model is deliberately **not tidy**:

- **`known_total_usd`** — a floor, summing *only* fees the corpus actually states.
- **`variable_step_keys`** — steps whose source says the fee varies (e.g. "varies by county").
  California's record mentions "commonly around $435–$480"; the planner **does not** take that
  as a number. It reports the step as variable.
- **`unpriced_step_keys`** — steps the corpus prices not at all. Counted, and said out loud.
- **`fee_waiver_step_keys`** — surfaced prominently. Where a source documents a waiver
  (Texas's Statement of Inability to Afford Payment, California's FW-001), that is often the
  difference between possible and impossible.
- **`potentially_waivable_usd`** — a *subtotal* of `known_total_usd` (never money on top of
  it): the sum of known fees for steps whose source also documents a waiver path. "Potentially"
  describes the FEE — a waiver process is documented for it — never a prediction of whether a
  given reader would get it. The per-step detail (form + the court's own quoted criteria, when
  a source states them) renders on the checklist step and the printable packet, not here; this
  panel only totals what is already sourced per step. See the line this app will not cross,
  below.

The panel says *"This is a floor, not a total"* in both languages. Nothing is extrapolated.

### The line this app will not cross (fee waivers)

`cost.fee_waiver_form` and `cost.fee_waiver_criteria` (api/types.ts:Cost) surface *what the
court publishes* — the official form, linked via `forms/registry.json`, and a literal quote of
the court's own eligibility criteria — never this app's judgement about a specific reader's
odds. GOVERNANCE.md forbids adjudicating eligibility, so there is no income calculator, no "you
likely qualify," and no "you probably don't need to pay" anywhere in this feature. Concretely:

- `cost.fee_waiver_criteria`, when present, must be a literal quote locatable in the fetched
  snapshot (`make fidelity` enforces this — see `scripts/source-fidelity.ts`'s
  `fee-waiver-criteria` assertion kind) and must not read as a prediction about the reader
  (`api/corpus.ts`'s `feeWaiverIssues` rejects phrasing like "you likely qualify").
- Where a source names a waiver and a form but never states criteria (e.g. Indiana), the record
  carries `fee_waiver_form` only, and the rendered sentence says the criteria aren't published
  — it does not guess at them.
- Where a source states criteria but no confirmed statewide form exists (e.g. Rhode Island's
  probate-court statute), the record carries `fee_waiver_criteria` only; there is no form line.
- `cost.fee_waiver_form`/`cost.fee_waiver_criteria` are checked against `cost.fee_waiver_source`
  when a record carries one — a state's general filing-fee page and its dedicated fee-waiver
  page are frequently different official documents (California, Arizona, Illinois, Michigan,
  Vermont, and Massachusetts all cite a second page this way). Absent that field, both are
  checked against the record's own primary `source`, exactly like every other assertion.

### Known gaps in the cost model

- **The corpus prices few things.** Most state filing fees are `null` + "varies by county",
  because that is what the sources say. The floor is therefore often small and the honest
  answer is "we can't total this." That is a **corpus coverage** problem, not an engine one.
- **A `$0` cost can be narrower than it looks.** Washington's license record prices the
  *gender-designation change* at $0 ("no additional fee ... during another transaction"). The
  license itself is not priced. The engine renders the source's note next to the amount so the
  caveat travels with the number, but it inherits `pickCost`'s existing single-cost behaviour
  from the checklist engine rather than diverging from it.
- **Moving costs themselves are out of scope.** Movers, deposits, lost income — the actual
  bulk of the 82% cost barrier — are not document fees and are not in this corpus.

## What the engine will not say

Deliberate silences, each one a thing a plausible-sounding planner would get wrong:

- **Whether the destination honours an origin-issued document.** No corpus record addresses
  interstate recognition, so no step asserts it. A held court order is `keep-from-origin`,
  and the page says plainly: *"Our sources do not say what the new state does with a document
  issued elsewhere, so we will not guess."*
- **That a move requires a new driver's license.** True, and not in the corpus. The plan shows
  the destination's cited *name/marker* requirements, and does not invent a new-resident
  transfer rule.
- **Any residency requirement a source doesn't state** (see New York and Washington above).
- **Which state's birth-certificate rules apply to *you*.** The corpus now covers birth
  certificates in all six states, in EN and ES — but the app does not ask where you were born,
  so it shows both states in the plan and says the state of birth is what governs. It will not
  infer a birth state from an origin state.
- **That a court order from one state will be accepted by another state's vital-records office.**
  California's, Illinois's, New York's, Texas's and Washington's pages each ask for "a certified
  copy of the court order"; none of them says whose court. The prerequisite edge we encode is
  "you need a court order first," which is what they say. Whether *your* court order satisfies
  *that* registrar is a question no source here answers.

## Safety

An (origin → destination) pair is the single most sensitive thing this app can learn: it is
intent to leave a hostile state, timestamped. The posture is stricter than anywhere else in
the app, and the deltas from the checklist flow are all deliberate:

| Control | Checklist | Relocation plan | Why |
|---|---|---|---|
| Server log | logs jurisdiction/selections | **no log descriptor at all** | Not "redacted" — *absent*. `api/log.ts`'s allowlist has no `origin`/`destination` field, so `safeLog` would drop them anyway; emitting nothing is the second, independent lock. |
| Render cache | memoized | **not cached** | A memo key *is* retention. It would hold "someone is leaving Texas for Washington" in process memory for the process lifetime. We pay the recompute instead. |
| Offline save | offered (unencrypted) | **not offered** | An unencrypted on-device copy of a relocation plan is a forensic artifact on a phone that may be searched. |
| Save/resume | offered (AES-GCM) | **not offered** | Same reasoning; print-and-go instead. |
| Indexing | noindex | noindex + `robots.txt` `Disallow` | Belt and braces on a URL that carries the pair in its query string. |

Each of these is asserted by a test in `tests/relocation.test.ts`, so they can't quietly
regress.

### Applying can itself create a record

The plan carries a plain caution on every government-document step: *applying to a government
agency creates a government record of your application.* It names no agency and alleges no
practice — it is a caution, in the same non-substantive class as the existing "check this
against the official source" note, and it carries no citation because it asserts no
jurisdiction-specific fact.

**On the Texas allegation:** Erin in the Morning has reported that Texas may be compiling a
list of people who apply to change the gender marker on a license. This is recorded here
because it is decision-relevant for the maintainers. It is **single-sourced**, and it is
therefore **never rendered to users as established fact** — there is a test asserting the
plan page emits no "database"/"watchlist"/"registry of applicants" language. If it becomes
corroborated and a verifier can stand behind it, it belongs in the corpus as a record with a
source and a last-verified date, like every other claim. Not before.

## Care continuity — deferred, on purpose

The NPPES / CMS NPI Registry is free, public-domain and auth-free, and "are there
endocrinologists where I'm going" is a real question. It is **not shipped**. Two independent
blockers, either one sufficient ([`api/care-density.ts`](../api/care-density.ts) holds the
full reasoning):

1. **Privacy.** Querying it means sending the destination to a third party at the exact moment
   someone builds a relocation plan — leaking the fact this whole mode is built to protect.
   The request *is* the disclosure; doing it client-side moves the leak rather than removing it.
2. **The signal doesn't mean what people would read it to mean.** NPPES records a provider's
   self-selected taxonomy code. It does not record whether a provider is trans-affirming,
   accepting patients, or safe. "14 endocrinologists near your destination," printed beside a
   trans document checklist, invites exactly one inference — and NPPES cannot support it.
   Inferring affirmation from a specialty code is the same error the portfolio's guardrails
   forbid elsewhere: **never infer, only source.**

**What would unblock it:** verified provider/clinic records in `corpus/referrals/`, whose
sources themselves state that the clinic serves trans patients, under the existing
named-verifier gate. That is a content problem, not an API problem. A test asserts no runtime
module reaches the NPPES host, so "just call the API" cannot land quietly.

## How the gates cover this

No new `make verify` stage was added — the count stays at 22. That is the stronger choice: the
relocation surface is enforced *inside* the existing gates rather than in a stage of its own
that a future refactor could forget to run.

- **citation** — `relocationAnswer()` pushes every plan through the *same* `citation.enforce()`
  as `/answer`. `scripts/citation-coverage.ts` now exercises the full
  (origin × destination × language × held) matrix — 80 plans — and fails if any claim is
  uncited, stale-cited, or unresolvable. Every substantive sentence on a plan page is a record
  statement; the structural chrome (phase headings, badges, totals) is non-substantive by
  construction, and there is nowhere in the engine to put a legal claim that lacks a record.
- **content** — the `relocation.residency_bound` rule above.
- **disclosure / a11y / seo** — `/move` and `/plan` are in each gate's page list, in both
  languages, including the same-state error state and the held-document render branch.
- **i18n** — EN/ES parity is enforced by the existing key-parity gate; the Spanish bundle
  carries the same `PENDING native-speaker review` posture as the rest of the app.
