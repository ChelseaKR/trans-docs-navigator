# Manual accessibility walkthrough — screen reader / keyboard / 200% zoom

> ## This document does not clear the launch gate
>
> This file is a **test script**: a set of steps a human runs with real assistive
> technology. It is not a test **result**, and finishing it — checking every box,
> filling in every row of the recording table in §9 — does **not** move the
> "Manual screen-reader / keyboard / 200%-zoom walkthrough" row in `docs/STATUS.md` /
> `README.md` from 🔴 OPEN to ✅ DONE.
>
> That row is *generated* by `scripts/launch-gates.ts` from `docs/signoffs/*.json`
> (see `deriveLaunchGates()` → `humanGate("accessibility-walkthrough", ...)`). It can
> only read DONE when:
>
> 1. A real person actually performs the checks below with the actual assistive
>    technologies named, on the actual running app — not by reading this document.
> 2. That person is a **named, non-placeholder verifier** — an entry in
>    `corpus/VERIFIERS.json` with `"placeholder": false`. As of this writing the
>    roster contains exactly one entry, `Pilot Seed Reviewer`, and it is
>    `"placeholder": true`. **No sign-off by that name can ever count** —
>    `loadSignOffs()` rejects it. A real verifier has to be added to that roster
>    first, by whoever owns it, before anyone can sign this gate at all.
> 3. That person commits a `docs/signoffs/accessibility-walkthrough.json` file
>    shaped `{ "gate": "accessibility-walkthrough", "signer": "<real roster name>",
>    "date": "YYYY-MM-DD", "artifact": "<link to the completed findings>" }`.
>
> This document, and whoever is running it, does none of that. **Nothing in this
> repository may create, edit, or backdate that sign-off file, and no automated
> process should ever attempt to.** See PRs #118 and #119 for why: a placeholder
> that reads as verification is the one failure mode this project is built to
> refuse.

---

## 0. What this is, and what it replaces

Per `docs/adr/0004-split-accessibility-gating.md`, accessibility here has three
layers, each labeled honestly:

1. **`make a11y`** (`scripts/a11y-lint.ts`) — mechanical, dependency-free, merge-blocking.
2. **Real-browser pa11y-ci / axe-core**, in CI (`.pa11yci.json`).
3. **This** — the manual screen-reader / keyboard / zoom pass. Layers 1 and 2 catch
   roughly 30–40% of WCAG (the standard's own estimate for what automation can
   decide). This script exists to cover the rest: does it actually make sense out
   loud, in order, with a keyboard, at 200%?

Nothing here duplicates 1 or 2. Where useful, a section says which automated layer
already covers a mechanical subset of the same page, so the human tester knows
where to spend attention that a machine cannot.

---

## 1. Scope: every page template the app renders, derived from the code

This list was built by reading the route table in `api/router.ts` and the render
functions it calls (`src/pages.ts`, `src/relocation.ts`, `src/legal.ts`,
`src/guide.ts`, `src/offline.ts`) — not by copying an older document's list forward.

| # | Route pattern | Renderer | File | EN | ES | Notes |
|---|---|---|---|:-:|:-:|---|
| 1 | `/` | `renderIntakePage` | `src/pages.ts` | ✓ | ✓ | Home / intake form |
| 2 | `/checklist?...` | `renderChecklistPage` | `src/pages.ts` | ✓ | ✓ | Parameterized by jurisdiction × change × doc; has an empty-plan state and a gaps state |
| 3 | `/packet?...` | `renderPacketPage` | `src/pages.ts` | ✓ | ✓ | Print-optimized full plan |
| 4 | `/answer?...` | `renderAnswer` (wrapped by `api/router.ts`) | `src/render.ts` | ✓ | ✓ | Grounded-answer detail page; has a no-citation "uncertainty" state |
| 5 | `/forms/:id` | `renderFormFillPage` | `src/pages.ts` | ✓ | ✓ | One template, many form ids (`forms/registry.json`); tested against `us-ss-5` and `us-ds-82` |
| 6 | `/move` | `renderMovePage` | `src/relocation.ts` | ✓ | ✓ | Relocation intake; has a `same-state` error state |
| 7 | `/plan?...` | `renderPlanPage` | `src/relocation.ts` | ✓ | ✓ | Relocation delta plan; has an empty-plan state, a gaps state, and per-step hazard notes |
| 8 | `/offline` | `renderOfflinePage` | `src/pages.ts` | ✓ | ✓ | Shown with no network and no cached copy |
| 9 | `/guide` | `renderGuideIndex` | `src/guide.ts` | ✓ | ✓ | Index of state × topic guides |
| 10 | `/guide/:state/:topic` | `renderGuidePage` | `src/guide.ts` | ✓ | ✓ | 5 states × 2 topics = 10 pages per language (`STATES` × `TOPICS` in `src/guide.ts`) |
| 11 | `/terms` | `renderTermsPage` | `src/legal.ts` | ✓ | ✓ | |
| 12 | `/privacy` | `renderPrivacyPage` | `src/legal.ts` | ✓ | ✓ | |
| 13 | `/accessibility` | `renderAccessibilityPage` | `src/legal.ts` | ✓ | ✓ | The public accessibility statement — see §5.10 |
| 14 | `/methodology` | `renderMethodologyPage` | `src/legal.ts` | ✓ | ✓ | |
| 15 | `/transparency` | `renderTransparencyPage` | `src/transparency.ts` | ✓ | ✓ | |
| 16 | 400 (bad request) | `badRequest()` | `api/router.ts` | ✓ | ✓ | Malformed jurisdiction |
| 17 | 404 (not found) | `notFound()` | `api/router.ts` | ✓ | ✓ | |
| 18 | 405 (method not allowed) | inline in `handleRoute` | `api/router.ts` | ✓ | ✓ | Non-GET/HEAD request |

Non-HTML routes (`/assets/app.css`, `/sw.js`, `/robots.txt`, `/sitemap.xml`,
`/healthz`, `/livez`, `/readyz`, `/metrics`) are infrastructure, not user-facing
screens, and are out of scope for this walkthrough.

### 1.1 How big is the mechanically-covered surface, really?

`docs/STATUS.md`'s M5 row currently reads *"mechanical a11y auto-gated across 19
templates."* **That number is stale.** Run the gate yourself:

```
$ make a11y
  ✅ a11y: 0 mechanical WCAG violations across 25 page templates + contrast on 2 themes
```

As of this writing `scripts/a11y-lint.ts` renders and checks **25** named template
instances (the `pages` array in that file), not 19 — the relocation planner's
`move`, `move-es`, `move-error`, `plan`, `plan-es`, and `plan-held` templates were
added after that sentence was last hand-typed, and the sentence never caught up.
This walkthrough is scoped against the **current, derived** count, not the prose
figure — and per the instructions for this work, that stale sentence in
`docs/STATUS.md` is **not** being edited here (only `scripts/launch-gates.ts`'s
generated block, and dated notes, are the legitimate way to update that file; the
launch-gate table itself is untouched by this change).

**Real-browser pa11y-ci** (`.pa11yci.json`, CI-only, axe + htmlcs) covers a
*smaller* set — 15 URLs — than the mechanical linter. Notably absent from it today:
`/move`, `/plan`, `/methodology`, `/transparency`, 8 of the 10 `/guide/:state/:topic`
combinations, and the second (`us-ds-82`) form-fill fixture. None of that is this
walkthrough's job to fix, but the human tester should not assume "CI runs a real
browser over this page" for those routes — for them, this manual pass plus the
static linter is the only accessibility coverage that exists before this gate.

---

## 2. Environment setup

1. `make dev` (or `NODE_ENV=development node --experimental-strip-types --no-warnings api/server.ts`).
   Default port is **8080** (`api/server.ts`, `PORT` env var) — `http://localhost:8080/`.
2. Test each screen at **100% zoom / default viewport** first (this is also where
   you do the keyboard-only pass), then again at **200% browser zoom**, then again
   at a **320 CSS px** wide viewport (WCAG 2.2 SC 1.4.10 reflow — equivalent to 400%
   zoom on a 1280px-wide design; use your browser's responsive/device-toolbar mode
   set to a custom width of 320, or physically narrow the window).
3. Screen-reader pairing (standard combinations — using an unpaired combination,
   e.g. NVDA+Chrome, as a spot check is fine but not a substitute):
   - **macOS: VoiceOver + Safari.**
   - **Windows: NVDA + Firefox** (Chrome is an acceptable substitute).
4. Keyboard-only pass: any browser, mouse/trackpad untouched — every action must be
   reachable and performable from the keyboard alone.
5. Test **both languages**: append `?language=es` (or `&language=es` on a page
   that already has a `?`) to every URL below for the Spanish pass, except where
   noted that Spanish isn't relevant to that state.

### 2.1 Quick reference: VoiceOver (macOS)

| Action | Keys |
|---|---|
| Toggle VoiceOver on/off | `Cmd+F5` (or triple-press the Touch ID / side button on newer Macs) |
| "VO" modifier used below | `Control+Option` |
| Move to next / previous item | `VO+Right Arrow` / `VO+Left Arrow` |
| Read from current position | `VO+A` |
| Open the Rotor (headings, landmarks, links, form controls) | `VO+U`, then `Left`/`Right` arrow to pick a category, `Up`/`Down` to move in it, `Return` to jump |
| Jump to next / previous heading directly | `VO+Cmd+H` / `VO+Cmd+Shift+H` |
| Jump to next / previous landmark directly | `VO+Cmd+L` / `VO+Cmd+Shift+L` |
| Activate a control | `VO+Space` |
| Interact with / stop interacting with a group | `VO+Shift+Down` / `VO+Shift+Up` |
| Stop speech | `Control` |

### 2.2 Quick reference: NVDA (Windows)

| Action | Keys |
|---|---|
| "NVDA" modifier used below | `Insert` (or `CapsLock`, if configured) |
| Read next / previous line | `Down Arrow` / `Up Arrow` (browse mode) |
| Say all | `NVDA+Down Arrow` |
| Elements list (headings / landmarks / links / form fields, filterable) | `NVDA+F7` |
| Next / previous heading | `H` / `Shift+H` (`1`–`6` for a specific level) |
| Next / previous landmark | `D` / `Shift+D` |
| Next / previous form field | `F` / `Shift+F` |
| Toggle browse/focus mode | `NVDA+Space` |
| Activate a control | `Enter` or `Space` |
| Stop speech | `Ctrl` |

---

## 3. The shared page shell (test once per language; every page below inherits it)

Every page renders through `page()` in `src/render.ts`. Test this shell **once** in
each language/AT combination, then for the page-specific walkthroughs below, only
the differences from this baseline need re-checking.

Expected structure, top to bottom:

1. A visually-hidden **skip link**, `<a class="skip" href="#main">Skip to main
   content</a>` — first focus stop on `Tab` from the top of the page. Activating it
   must jump focus to `<main id="main">`, skipping the banner.
2. `<header role="banner">` containing a persistent disclosure paragraph — "**Information, not legal advice**" (title) + the AI-assistance disclosure body. This is guardrail #2 (`docs/STATUS.md`) and must be reachable/announced on **every** page, including error pages.
3. `<main id="main">` starting with exactly **one `<h1>`** (checked mechanically — verify a screen reader agrees it's announced as a top-level heading, not a generic block).
4. Page-specific body (§5 below).
5. `<footer>` with a short privacy/session sentence and `<nav aria-label="Legal and policies">` containing 5 links: Terms of Use, Privacy, Transparency report, Accessibility, How we source & verify.

**Keyboard path from a blank tab**: `Tab` → skip link (focused, visually revealed) →
`Enter` → focus moves to `#main` → continue `Tab`bing through the page body → the 5
footer nav links → (if present) browser chrome. **No stop should be reachable that
isn't visually indicated** (2.4.7 Focus Visible — the stylesheet defines a 3px
outline on `:focus-visible` for links/buttons/inputs/selects; confirm it's visible
against both the dark screen palette and (on `/packet`) the print palette preview).

**VoiceOver / NVDA**: landmark navigation should surface exactly `banner` → `main`
→ `contentinfo` (footer) — 3 top-level landmarks, in that order, on every page.

---

## 4. Per-screen walkthrough

For each screen: the keyboard path to reach it fresh (from `/`), the landmark/
heading structure beyond the shared shell, and what a screen reader should
announce. Read §3 first — it isn't repeated here.

### 4.1 Intake (`/`)

**Reach it**: it's the start page.
**Structure**: `<h1>` "Plan your legal name and gender-marker changes" → one
`<form aria-label="…">` containing four `<fieldset>`/`<legend>` groups (state
dropdown; what's changing — 2 checkboxes; which documents — 6 checkboxes; "I have a
court order" — 1 checkbox) and a language `<fieldset>`, then a submit button, then
two plain links (`/move`, `/guide`).
**Keyboard path**: `Tab` from skip link lands on the jurisdiction `<select>`, then
each checkbox/legend group in DOM order, then the language `<select>`, then "Show
my checklist", then the two footer-of-body links, then the shared footer nav.
**Screen reader**: each `<legend>` must be announced when its first control gets
focus (e.g., "What are you changing?, Legal name, checkbox, checked"). Confirm the
🔒 private-mode note (`role="note"`) is announced, not skipped as decorative.
**Both languages**: `/` and `/?language=es` — same structure, Spanish strings.

### 4.2 Checklist (`/checklist?...`)

**Reach it**: submit the intake form, or navigate directly, e.g.
`/checklist?jurisdiction=US-CA&change=name&change=gender-marker`.
**Structure**: intro paragraph → a `role="note"` disclaimer paragraph (always
present) → conditionally a "not covered"/"thinner language" flag paragraph (§5) →
a plan summary (step count + cost, with a `role="status" aria-live="polite"`
progress counter that starts **empty** and is filled in only by client JS) → print/
start-over links → an `<ol>` of steps, each an `<li>` containing an `<h2>` "Step N:
{title}", a "Mark done" checkbox, cost/timeline/prerequisite/discretionary/
reverification flags, a `<details>` "More detail" disclosure, form-CTA link(s), and
an `h3`/`h4`-level "Sources" list with one link per backing record → a "Go deeper"
`<section>` linking to matching `/guide` pages and `/answer` → a "Not yet covered"
gaps `<section>` when applicable → the save/resume panel (§6) → the offline-save
panel (§6) → the reminders (.ics) button.
**Keyboard path**: Tab order must follow that same top-to-bottom order; the
per-step "Mark done" checkbox and the `<details>` disclosure triangle must both be
independently reachable and operable with `Enter`/`Space`.
**Screen reader**: heading levels must read `h1` → (`h2` per step) with **no
skipped level**; confirm each step's `h2` announces the step number and title
together (not just "heading level 2, Step"). Confirm the reverification flag (when
present) is read as part of the step's content, immediately after
prerequisite/discretionary info and before "More detail" — not off in a
disconnected region.
**Empty-plan state**: request a jurisdiction/doc/change combination with zero
current or degraded records (e.g. `doc=financial-records`, any jurisdiction — see
§5.4) — confirm the reassuring "we couldn't build any verified steps for these
choices yet" message reads as a normal paragraph, not silently as an empty `<ol>`.
**Both languages**: append `&language=es` (or use the intake's language picker).

### 4.3 Printable packet (`/packet?...`)

Same step structure as the checklist, minus the interactive widgets (progress,
resume, offline, "mark done", `<details>`) — everything is expanded and static.
**Screen-reader-specific check**: `@media print` styles must not be relied on by
assistive tech reading the *screen* rendering — confirm the on-screen (non-print)
rendering is itself fully labeled; the print stylesheet is a visual-only transform.
**Keyboard**: the "Print or save as PDF" button and "Start over" link, then the
same step list, then the offline-save panel.

### 4.4 Detailed answer (`/answer?...`)

**Reach it**: the checklist page's "See what the sources say in detail" link, or
directly, e.g. `/answer?jurisdiction=US-CA&change=name`.
**Structure**: `<h1>` "What the sources say" → `<section aria-label="answer">`
containing a sequence of `<p>` blocks (claim / freshness-flag / uncertainty /
meta), then a `Sources` `<h2>` list → "back to checklist" / "start over" links.
**Screen-reader-specific check**: `<section aria-label="answer">` is a **hardcoded
English string** (`src/render.ts`) regardless of `lang` — on the Spanish page this
landmark's accessible name will still announce as "answer" in English while its
content is Spanish. Confirm with VoiceOver/NVDA whether this reads as confusing
enough to log as a finding (record it in §9 either way — this is exactly the kind
of thing automated linting cannot catch, since the linter checks presence of a
label, not its language).
**Both languages**: `/answer?jurisdiction=US-CA&change=name&language=es`.

### 4.5 Official-form page (`/forms/:id`)

**Reach it**: a checklist step's "Get the official form" link, or directly:
`/forms/us-ss-5` and `/forms/us-ds-82`.
**Structure**: intro paragraph → a prominent link to the real, external, official
PDF (`rel="noopener noreferrer"`, opens in the same tab — confirm no unannounced
new-tab behavior; there is no `target="_blank"` in the code, so this should be a
normal same-tab navigation) → an optional "What to bring" list (only rendered when
`form.preparation` is non-empty; check whether the two test forms have one) → a
copy-helper `<section>` with two labeled text inputs (current/new legal name), a
"Copy" button, an `aria-live="polite"` `<pre>` preview, and an `aria-live="polite"`
status line → a closing "this tool doesn't file anything for you" flag note.
**Privacy-specific screen-reader check**: the two name inputs are **not** inside a
`<form>` and carry no `name` attribute — confirm a screen reader still announces
them as ordinary labeled text fields (nothing about the missing form semantics
should read as broken or unlabeled).
**Keyboard**: type in both fields, `Tab` to "Copy", `Enter`/`Space` activates it;
confirm the "Copied to clipboard" status is announced without moving focus.

### 4.6 Relocation intake (`/move`)

**Structure**: lead paragraph → 🔒 privacy note → conditional error note (§5.6) →
one `<form>` with 5 `<fieldset>` groups (from-state, to-state, what's changing,
documents already held, language) → "Show me the plan" → "Start over".
**Same-state error**: `/plan?origin=US-CA&destination=US-CA` redirects into this
same page with `role="alert"` error text ("Pick two different states…") —
confirm a screen reader announces this **assertively** (an `alert` region should
interrupt, unlike the `status`/`note` regions used elsewhere) as soon as the page
loads.

### 4.7 Relocation plan (`/plan?...`)

**Reach it**: submit `/move`, or directly, e.g.
`/plan?origin=US-TX&destination=US-WA&change=name&change=gender-marker`.
**Structure**: intro → verify-note → 🔒 privacy note → print/start-over → a cost
`<section>` (`h2` "Go deeper"-style, id `cost-h`) → up to 5 phase `<section>`s (Already
have it / Before you move / Either order / Governed by your birth state / After
you arrive — only the phases with steps render, each `aria-labelledby` its own
`h2`) → each phase's `<ol>` of steps (`h3` per step, one level under the phase
`h2` — confirm no level is skipped) → a hazards `<ul>` per step where applicable →
a "Not yet covered" gaps `<section>` when applicable.
**No caching, no logging**: this route is deliberately excluded from the render
cache and from structured logs (see the comment block above `/move`/`/plan` in
`api/router.ts`) — nothing to verify visually, but worth knowing if a finding here
needs to reference server behavior.
**Empty-plan state**: an origin/destination pair with literally nothing to say
(not expected with the 5 supported states, but check the "we could not build a
verified plan" message renders sanely if you find one).
**Both languages**, plus the `held`-document variant:
`/plan?origin=US-TX&destination=US-WA&change=name&change=gender-marker&hold=court-order`
(changes some steps' class to "already have it" and suppresses their
government-record caution).

### 4.8 Offline notice (`/offline`)

Reach it only by actually going offline with no saved copy (or navigate directly —
the route always renders regardless of real connectivity). Structure: lead
paragraph → `<h2>` "Saved on this device" → an initially-empty `<ul id="offline-list">`
populated by client JS from the Cache Storage API. **Screen-reader check**: confirm
the "No pages are saved for offline use" fallback text is announced when the list
stays empty (via the `aria-live` region wired in `public/assets/offline.js`), not
silently blank.

### 4.9 Guide index (`/guide`) and guide pages (`/guide/:state/:topic`)

**Index**: `<h1>` → lead → a visually-hidden `<h2 class="sr-only">` (confirm it's
still exposed to a screen reader, just not sighted users) → 5 `<section>`s, one per
state, each its own `<h2>` and a `<ul>` of 2 topic links.
**Guide page** (e.g. `/guide/california/name-change`,
`/guide/texas/gender-marker?language=es`): a `<nav aria-label="Breadcrumb"
class="breadcrumb">` → lead → verify-note → a CTA link → the full checklist
render (same step structure as §4.2, read-only — no "mark done"/progress/resume/
offline widgets on this surface) → a second CTA → a "last reviewed" date.
**Screen-reader-specific check, same class of issue as §4.4**: the breadcrumb's
`aria-label="Breadcrumb"` is **hardcoded English** in `src/guide.ts` regardless of
`lang` — on `/guide/texas/gender-marker?language=es` the landmark's accessible name
still announces "Breadcrumb" while the link text inside it ("Inicio", "Guías") is
Spanish. Same instruction as §4.4: confirm with real AT and log a finding either
way.
**All 10 state×topic combinations exist** (`STATES` × `TOPICS` in `src/guide.ts`);
spot-check at least 2 per language (this walkthrough doesn't require all 20, but
the mechanical gate only renders 2 of the 20 today — see §1.1 — so this is the only
check most of them get before launch).

### 4.10 Legal / policy pages (`/terms`, `/privacy`, `/accessibility`, `/methodology`, `/transparency`)

**Structure**: each is a sequence of `<section><h2>…</h2>…</section>` blocks built
from a locale bundle, plus a "last updated" date. No interactive widgets. Check
heading order (must be a flat sequence of `h2`s, no nesting) and that any `<ul>`/
`<strong>` inside a section's HTML (see `legalBody()` in `src/legal.ts`) reads
sensibly aloud.
**`/accessibility` specifically**: confirm the page's own "What is still in
progress" section — which already states in plain language that the manual
walkthrough is not yet complete — is itself fully readable; it would be an
unwelcome irony if the page announcing this gate's status were itself
inaccessible.

### 4.11 Error pages (400 / 404 / 405)

**400** — request a malformed jurisdiction, e.g. `/checklist?jurisdiction=ZZ`.
**404** — request any unknown path, e.g. `/nope`.
**405** — requires a non-GET/HEAD request (e.g. `curl -X POST`); not reachable by
normal browser navigation, so this one is a code-reading confirmation rather than
an interactive check: `api/router.ts` returns an `Allow: GET, HEAD` header and a
rendered page through the same `page()` shell, so §3's shell checks apply.
**400/404 screen-reader check**: confirm the shared shell (skip link, banner, one
`h1`, footer nav) is intact and the error explanation reads as a normal paragraph
before the "start over" link.

---

## 5. Honest-degradation states (highest priority — read this section carefully)

These are exactly the screens the task calls out as most likely to have unlabeled
or confusing semantics, because they are where the app is actively *withholding*
confidence rather than presenting a clean answer. Test them with the same rigor as
the "happy path" screens above — arguably more, since a screen-reader user who
cannot see the visual "⚠" styling (`.flag`, `color:var(--warn)`) depends entirely
on the text and its position in reading order to understand that something here is
not to be trusted at face value.

### 5.1 Uncovered jurisdiction (corpus has zero records for the state)

The corpus currently covers `US`, `US-CA`, `US-IL`, `US-NY`, `US-TX`, `US-WA`. A
well-formed but uncovered state id (any other two-letter USPS code) passes
`validJurisdiction`'s shape check and is accepted — `hasNoStateCoverage()`
(`api/checklist.ts`) is what tells the page to say so instead of silently
rendering only the federal steps as if that were the whole plan (this is exactly
the honesty fix in commit `3e66554` / PR #119 — read its message for the full
reasoning).

**Test URLs** (Florida, EN):
- `/checklist?jurisdiction=US-FL&change=name&change=gender-marker` — expect the
  `noStateCoverage` flag paragraph **before** the plan summary/steps (per the code
  comment: "said BEFORE the steps, because after them the page already reads as a
  finished plan"). Confirm a screen reader actually encounters it in that order —
  i.e., before the 2 federal steps (SSA, passport), not buried after them.
- `/packet?jurisdiction=US-FL&change=name&change=gender-marker` — same note,
  positioned so it also survives onto a **printed** page (it does not carry
  `no-print`).
- `/answer?jurisdiction=US-FL&change=name` — the note here is different in kind:
  it's prepended as the **first** answer block, with **no citation**, styled the
  same as the `freshness`/`uncertainty` categories (`<p class="flag">`, no
  `role="note"` on this particular template — verify whether its position at the
  very top of the `<section aria-label="answer">` is enough for a screen reader
  user to register it before the (cited) federal claims that follow).
- Spanish: append `&language=es` to all three.

Do **not** confuse this with a jurisdiction that has records but they're all
degraded (§5.2) — `hasNoStateCoverage` fires only when the corpus has *nothing at
all* for that state, regardless of language or freshness.

### 5.2 `needs_reverification` records (deterministic — reproduce any day)

These are seeded by `verification_status: "needs_reverification"` in the corpus
JSON, so — unlike §5.3 — they do **not** depend on what today's date is. They are
the correct comparison case for making sure a screen reader announces "degraded"
content distinctly from confidently-stated content.

| Record | Jurisdiction(s) it shows on | Language | Test URL (EN) |
|---|---|---|---|
| `us.ssa-card.gender-marker` | **every** jurisdiction (federal) | en | `/checklist?jurisdiction=US-CA&change=gender-marker&doc=ssa-card` |
| `us.passport.gender-marker` | **every** jurisdiction (federal) | en | `/checklist?jurisdiction=US-CA&change=gender-marker&doc=passport` |
| `tx.drivers-license.gender-marker` | US-TX only | en | `/checklist?jurisdiction=US-TX&change=gender-marker&doc=drivers-license` |
| `ny.drivers-license.gender-marker` | US-NY only | en | `/checklist?jurisdiction=US-NY&change=gender-marker&doc=drivers-license` |
| `us.ssa-card.gender-marker.es` | every jurisdiction | es | same as above `+&language=es` |
| `us.passport.gender-marker.es` | every jurisdiction | es | same as above `+&language=es` |
| `ny.drivers-license.gender-marker.es` | US-NY only | es | `/checklist?jurisdiction=US-NY&change=gender-marker&doc=drivers-license&language=es` |
| `tx.drivers-license.gender-marker.es` | US-TX only | es | `/checklist?jurisdiction=US-TX&change=gender-marker&doc=drivers-license&language=es` |

The first two rows are the most important to test: they mean **every** state's
gender-marker checklist that includes an SSA card or passport step will show the
"Needs reverification" flag — this is not a rare edge case, it is the SSA/passport
sex-marker content described at length in `docs/STATUS.md`'s 2026-07-13 entry (the
policy manual now says there is *no route* to a marker matching gender identity).
Confirm:
- The flag paragraph (`role="note"`, text "Needs reverification, so we don't show
  it as current.") is announced **as part of the same step**, immediately after
  cost/timeline/prerequisite info, not as an unrelated aside.
- The step's **citation is still present and still readable** — degrading a claim
  must never mean losing its source link.
- On `/plan?origin=US-TX&destination=US-WA&change=name&change=gender-marker` (the
  same fixture `scripts/a11y-lint.ts` uses), the SSA-card and passport steps show
  the `unverified-destination-rule` hazard note. **Read the code before you file a
  finding here**: the visible source citation on that step is for the *current*
  "name" record (`us.ssa-card.name` / `us.passport.name`); the flag is triggered by
  a *sibling* record for the other change type (`us.ssa-card.gender-marker`) being
  degraded. That is intentional (`buildChecklist`'s `needs_reverification` is
  `currentRecords.length === 0 || degraded.length > 0`) — it is not a citation/flag
  mismatch bug, but it IS worth confirming a screen-reader user isn't misled into
  thinking the flag applies to the visible name-change citation specifically.

### 5.3 Stale, real-clock-driven content (`past-sla`) — a *different* mechanism from §5.2

`api/freshness.ts` distinguishes a record explicitly marked `needs_reverification`
(§5.2, clock-independent) from one still marked `verified` but that has silently
aged **past its own `recheck_sla_days`** on the real calendar (`past-sla`). This
second kind only shows up when you run the **live server**, because
`servingToday()` reads the real system clock — `make freshness` (the CI gate)
deliberately evaluates against a **frozen** `TEST_TODAY` constant instead
(`api/freshness.ts`), specifically so the merge-blocking gate stays reproducible.
The two are not the same test: a CI-green `make freshness` run tells you nothing
about what `servingToday()` will find live in a browser weeks later, which is
exactly why this has to be a manual, dated pass and not something the automated
gates already cover.

**This means the exact set of `past-sla` records will have changed by the time you
run this.** As of the date this document was written (early September 2026, i.e.
roughly 7–8 weeks after the corpus's `2026-07-13` `last_verified` dates), the
following were observed past their SLA on the live clock:

- `ny.court-order.name` (EN + ES) — 90-day SLA, ~97 days old
- `tx.birth-certificate.gender-marker` and `tx.birth-certificate.gender-marker.law` (EN + ES) — 30-day SLA, ~54 days old

Test URLs, **as an illustration, not a guarantee**:
`/checklist?jurisdiction=US-NY&change=name&doc=court-order` and
`/checklist?jurisdiction=US-TX&change=gender-marker&doc=birth-certificate`.

**What to actually do**: don't assume the list above still holds. Instead, browse
each of the 5 states' checklists with **all 6 document types selected** and both
change types checked, in both languages, and note *every* step that shows the
"Needs reverification" flag. Compare against the deterministic §5.2 list — any
step flagged that is **not** one of those seeded records is a live `past-sla`
instance; test it the same way (citation still present, flag in the right reading
position). If the only flagged steps you find are the §5.2 ones, this sub-case
is not currently observable and should be recorded as "not observed on this pass"
in §9 — not silently skipped, and not faked by reusing the illustrative list above
after it's gone stale.

### 5.4 A document type with zero corpus records anywhere (`no-records` gap)

`financial-records` has no record in any jurisdiction file, in either language —
this is the one gap that will reproduce identically forever (it doesn't depend on
freshness or on jurisdiction coverage; selecting it always yields nothing).

**Test URL**: `/checklist?jurisdiction=US-CA&change=name&doc=financial-records`
(EN) and `&language=es`. Expect: **zero steps rendered**, the "we couldn't build
any verified steps for these choices yet" empty-state message, and a "Not yet
covered" `<section>` with one `<li>` reading "Financial & other records: We don't
have verified steps for this yet…" (`gapNoRecords`). Confirm the empty-state
message and the gaps section are **both** announced — a screen reader landing on
an apparently-empty page with no steps needs the reassurance text, not silence.

Relocation has its own version of this: destination Illinois currently has no
`drivers-license` record for a **name** change (only for gender-marker — see
`corpus/jurisdictions/illinois.json`). Test:
`/plan?origin=US-CA&destination=US-IL&change=name` — expect a "Not yet covered"
gap for the Illinois driver's-license step rather than it silently vanishing from
the plan.

### 5.5 Relocation-specific hazard notes

Using the TX→WA fixture (`/plan?origin=US-TX&destination=US-WA&change=name&change=gender-marker`),
confirm each hazard type reads sensibly and in the right place relative to its
step:
- `prerequisite-order` — "you need the {other step} first" — cited.
- `origin-window-closes` (⏳) — the residency-bound court-order step warns that the
  filing window closes once you stop living in the origin state — cited.
- `unverified-destination-rule` — covered in §5.2.
- `creates-government-record` — an **uncited** caution (by design — see the code
  comment in `api/relocation.ts` above `hazardsFor()`); confirm a screen reader
  doesn't announce it as if it carried a source, since it deliberately doesn't.
- `keep-from-origin` steps get an additional plain-language "we don't know how
  {state} treats a document you already have" note (`keepUnknownNote`).

### 5.6 Thinner-language-coverage banner — currently dormant, confirm it's still dormant

`hasThinnerLanguageCoverage()` (`api/checklist.ts`) exists to say, honestly, "full
Spanish steps for this state aren't ready yet" when English coverage is ahead of
Spanish. **As of this writing, it does not fire for any jurisdiction × document ×
change-type combination in the shipped corpus** — Spanish parity work (see the
`spanish-parity-for-*` history) has closed every gap this code path was written to
flag. This was confirmed by exhaustively checking every (state × document ×
change-type) combination, not assumed.

Spot-check 2–3 combinations yourself (e.g. any state, `language=es`, all 6
documents, both change types) to confirm this is still true at the time you run
the walkthrough. If it fires anywhere, test it fully like the other flags above
(position before the steps, `role="note"`, correct copy). If it doesn't, record
"not currently reproducible with the shipped corpus" in §9 rather than leaving that
row blank — the distinction between "checked and found nothing to test" and
"not checked" matters here as much as it does anywhere else in this project.

### 5.7 The passphrase field is an authentication mechanism (WCAG 2.2 SC 3.3.8)

The save/resume panel's passphrase field (§6) is new in the sense that WCAG 2.2
added an "Accessible Authentication" success criterion. Confirm: the passphrase is
one the user **creates and controls themselves** (not an imposed cognitive-function
test like a CAPTCHA or a memorized-elsewhere password), pasting into the field is
not blocked, and there is no arbitrary complexity/timing requirement — all of which
should already be true by inspection of `public/assets/resume-crypto.js`, but this
SC exists to catch UI-level obstruction, which only a live pass can see (e.g., does
the browser's password manager get suppressed on this field? does copy/paste work
in your OS/browser combination?).

---

## 6. JS-enhanced interactive widgets (keyboard + screen-reader specific)

All of these are progressive enhancement — every one of them is absent (and the
page still fully usable) with JavaScript disabled; confirm that too, once, as part
of this pass.

| Widget | Where | Keyboard check | Screen-reader check |
|---|---|---|---|
| Save / resume (encrypted, local-only) | checklist page, when a selection query is present | `Tab` to passphrase field, type, `Tab` to Save/Resume/Delete buttons, activate with `Enter`/`Space` | `#resume-status` is `role="status" aria-live="polite"` — confirm each outcome message (saved / nothing saved / wrong passphrase / deleted) is spoken without moving focus |
| Checklist progress + "mark done" toggles | checklist page | Each step's "Mark done" checkbox is independently `Tab`-reachable; toggling updates the counter | `#progress-count` is `role="status" aria-live="polite"` — confirm the updated "N of M steps done" is announced on toggle |
| Save for offline / delete offline copies | checklist, packet, offline-notice pages | `Tab` to Save/Delete buttons | `#offline-status` is `role="status" aria-live="polite"`; confirm the "no browser support" disabled-button state is itself announced, not just visually greyed out |
| Download reminders (.ics) | checklist page (when steps exist) | Button is reachable and activatable | Confirm the button's accessible name doesn't rely on the 📅 emoji alone |
| Copy-helper (name fields → clipboard) | form-fill pages | `Tab` through both inputs and the Copy button | `#copy-out` and `#copy-status` are both `aria-live="polite"` — confirm typing updates the live preview without spamming the screen reader on every keystroke (check whether this is more disruptive than helpful in practice) |
| Print button | packet, plan pages | Reachable, activatable with `Enter`/`Space` | Announces as a button with clear text, not just an icon |

---

## 7. WCAG 2.2 AA success-criterion map

Use this table to tag each row you log in §9. It is not exhaustive of WCAG — it is
the set of criteria this app's design actually puts in play, per the areas
exercised in §§3–6.

| SC | Name | Where it's exercised here |
|---|---|---|
| 1.3.1 | Info and Relationships | Landmarks, headings, `<fieldset>`/`<legend>`, label associations — §3, §4.1–4.2 |
| 1.3.2 | Meaningful Sequence | Reading order of flag/gap notes relative to steps — §5 throughout |
| 1.4.3 | Contrast (Minimum) | Mechanically pre-checked (`make a11y`); spot-check in a real browser under 200% zoom, where sub-pixel rendering can shift things |
| 1.4.4 | Resize Text | 200% browser zoom pass — §2 |
| 1.4.10 | Reflow | 320px viewport pass — §2 |
| 1.4.11 | Non-text Contrast | Focus ring, form-control borders |
| 1.4.13 | Content on Hover or Focus | N/A — no hover-triggered content in this app |
| 2.1.1 | Keyboard | Every widget in §4 and §6 |
| 2.1.2 | No Keyboard Trap | `<details>`, the save/resume panel, all form controls |
| 2.4.1 | Bypass Blocks | Skip link — §3 |
| 2.4.3 | Focus Order | §3 shell path + each page's DOM-order path in §4 |
| 2.4.6 | Headings and Labels | Heading-level checks throughout §4; label checks in §4.1, §4.5, §5.7 |
| 2.4.7 | Focus Visible | §3 |
| 2.4.11 | Focus Not Obscured (Minimum) | Confirm the sticky/persistent banner never covers a focused control when scrolled |
| 2.5.8 | Target Size (Minimum) | Checkbox/button tap targets at default zoom, especially the compact "Mark done" toggle |
| 3.2.3 | Consistent Navigation | Footer nav identical across all pages |
| 3.2.4 | Consistent Identification | "Sources", flag styling, and CTA labels used the same way on every step across checklist/packet/plan/guide |
| 3.3.1 | Error Identification | 400 page, `/move` same-state error (§4.11, §4.6) |
| 3.3.2 | Labels or Instructions | Every form field, §4.1, §4.5, §4.6 |
| 3.3.8 | Accessible Authentication (Minimum) | Passphrase field — §5.7 |
| 4.1.2 | Name, Role, Value | All custom-styled controls (checkboxes, buttons) |
| 4.1.3 | Status Messages | Every `aria-live`/`role="status"`/`role="alert"` region — §6, §4.6 |

---

## 8. What "pass," "fail," and "blocked" mean here

- **Pass** — checked with the real AT/condition named, behaved as expected.
- **Fail** — checked, did not behave as expected; describe the actual behavior and
  cite the WCAG SC it violates. File it the way this project files any other bug
  (an issue, or a dated note in a new `docs/audits/accessibility-YYYY-MM-DD.md`
  entry, following the format of `docs/audits/accessibility-2026-05-31.md`) —
  **not** by editing this script.
- **N/A** — the criterion doesn't apply to this screen (say why).
- **Not observed on this pass** — used specifically for §5.3/§5.6's dormant/
  time-dependent states when they don't currently reproduce; this is not the same
  as "pass" and not the same as "not checked."
- **Blocked** — an environment problem (AT crashed, page didn't load) prevented
  testing; not a verdict on the app.

## 9. Pass/fail recording table (template — to be filled in by the human tester)

The row below is an **illustration of the format only** — replace it; it is not a
real result, and this document ships with no rows filled in for real.

| # | Page / screen | URL | Lang | Condition | WCAG 2.2 AA SC | Expected | Observed | Result | Tester | Date | Notes / issue link |
|---|---|---|---|---|---|---|---|---|---|---|---|
| EXAMPLE | Checklist — needs_reverification | `/checklist?jurisdiction=US-CA&change=gender-marker&doc=ssa-card` | en | VoiceOver | 1.3.2, 4.1.3 | "Needs reverification…" announced immediately after the SSA-card step's cost/timeline info | *(replace with what you actually heard)* | *(Pass/Fail/N/A/Blocked)* | *(your name, matching `corpus/VERIFIERS.json` if this is the sign-off run)* | *(YYYY-MM-DD)* | |

Add one row per (screen × condition × language) combination actually tested.
Every §4 and §5 subsection above should generate at least one row; §5's
degradation states should generate one row *per condition* (keyboard, VoiceOver,
NVDA, 200% zoom, 320px reflow) since they're the highest-priority surfaces.

---

## 10. If you find failures

Do not weaken this script, and do not soften a failure into a pass to make the
table look better. Record it plainly (§8), then either open an issue or add a new
dated file under `docs/audits/` (e.g. `docs/audits/accessibility-2026-MM-DD.md`)
describing what failed and against which SC, following the structure of the
existing `docs/audits/accessibility-2026-05-31.md`. That is where remediation
tracking belongs — this file is the reusable instrument, not the changing record
of results.

## 11. Clearing the gate (for reference — this document cannot do this step)

Once every row in §9 is filled in and every failure has a tracked remediation
path, the gate is cleared by a **named, real, roster-listed human** (see the box
at the top of this document) committing
`docs/signoffs/accessibility-walkthrough.json` in the shape
`scripts/launch-gates.ts`'s `loadSignOffs()` expects:

```json
{
  "gate": "accessibility-walkthrough",
  "signer": "<a real name from corpus/VERIFIERS.json, not a placeholder>",
  "date": "YYYY-MM-DD",
  "artifact": "<link to the completed §9 table / audit entry>"
}
```

That step — adding a real verifier to `corpus/VERIFIERS.json`, running this
script, and committing that sign-off — is explicitly **out of scope for this
change** and has not been done here. `make verify`'s `launch-gates` stage will
keep reporting this gate 🔴 OPEN, correctly, until a human actually does it.
