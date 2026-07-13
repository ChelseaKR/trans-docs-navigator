# Accessibility Audit — 2026-05-31

> RESPONSIBLE-TECH-FRAMEWORK §E / WCAG 2.2 AA. Target task: complete
> intake → checklist → form-fill using a screen reader, keyboard, or magnification.

> ⚠️ **STALENESS NOTE (added 2026-07-05, remediation pass — not a re-walkthrough):**
> This artifact predates the offline-capable PWA shell (EXP-01, merged 2026-07-01,
> commit `1bd85c4`) and its "Save for offline" / "delete all saved pages" UI, and the
> client-side encrypted save/resume panel (2026-06-05). Neither JS-enhanced widget has
> ever had a human keyboard/screen-reader pass. As of 2026-07-05, the **mechanical**
> gate now also covers the offline-shell notice page (`scripts/a11y-lint.ts` templates
> `offline`/`offline-es`; `.pa11yci.json` now includes `/offline` and
> `/offline?language=es`) — that part of this note is a verified, mechanical fact, run
> and green as of this pass. **The manual walkthrough below is still exactly as PENDING
> as it was on 2026-05-31, now for a larger surface than it was written against.** No
> screen-reader/keyboard pass has been fabricated or implied here — this note only
> identifies what widened the walkthrough's scope; it does not perform it.

## Automated (auto-gated, merge-blocking) — PASS
`make a11y` renders every page template and asserts the mechanical WCAG checks
(~30–40% per the standard): `<html lang>`, non-empty `<title>`, viewport meta, exactly
one `<h1>`, skip-to-content link + `#main` landmark, visible-focus styles,
`prefers-reduced-motion` handling, image `alt`, labelled form controls, no positive
`tabindex`, non-empty link/button text. **Result (2026-05-31): 0 violations across the
page templates then covered** (intake EN/ES, checklist EN/ES, printable packet, form-fill,
form-degraded — this original count of 7 was itself already behind the gate's actual
coverage by 2026-05-31, which had grown to include the legal/guide pages too).
Keyboard-path properties are additionally asserted in `tests/pages.test.ts`.
**(2026-07-05: the gate covers 19 templates total: 17 previously covered, plus the
offline-shell notice page in EN/ES added in that remediation pass — see the staleness
note above. Still 0 violations.)**

The printable packet (`/packet`) ships a print stylesheet (`@media print`) that switches
to a high-contrast light palette, hides navigation (`.no-print`), expands link URLs for
paper, and avoids breaking a step across pages — and it works with no JavaScript (the
print button progressively enhances `window.print()`).

Production CI additionally runs **pa11y-ci / axe-core in a real browser**
(`.github/workflows/ci.yml`); the static linter is the local fast gate, not a
replacement for axe.

## Manual walkthrough (review-gated) — PENDING sign-off
Cannot be automated; requires a human and assistive tech. Each must be signed before launch:

- [ ] Keyboard-only completion of intake → checklist → form-fill (no traps; logical order)
- [ ] VoiceOver pass (macOS/iOS)
- [ ] NVDA pass (Windows)
- [ ] 200% zoom — no loss of content or function
- [ ] 320 px reflow — no horizontal scroll
- [ ] Form-error messages announced programmatically (`aria-live`)
- [ ] Reduced-motion respected (verified: no animations defined; CSS guard present)
- [ ] Readability target (~8th grade) met for English and Spanish content
- [ ] **[Added 2026-07-05]** Save/resume panel: keyboard-operable save/restore/clear
      controls, passphrase field correctly labelled and errors announced
      (`public/assets/resume-panel.js`, `src/secure-resume.ts`)
- [ ] **[Added 2026-07-05]** Offline shell: "Save for offline" and "delete all saved
      pages" controls are keyboard-operable and announce their result; the offline
      notice page (`/offline`) is navigable and announced correctly by a screen reader
      when reached via a dead network (`src/offline.ts`, `public/assets/offline.js`)

## Design choices supporting AA
- High-contrast dark palette (tokens in `src/render.ts`); 3px visible focus ring.
- `role="status"` `aria-live="polite"` on the form-fill status line.
- The whole intake→checklist flow works with **no client JavaScript**; form-fill is the
  only JS, and it degrades to "download the blank form" if it fails.

## Accessibility statement
To be published at launch, committing to WCAG 2.2 AA and providing a contact for
accessibility issues. **Status: drafted, not published.**
