# Accessibility Audit — 2026-05-31

> RESPONSIBLE-TECH-FRAMEWORK §E / WCAG 2.2 AA. Target task: complete
> intake → checklist → form-fill using a screen reader, keyboard, or magnification.

## Automated (auto-gated, merge-blocking) — PASS
`make a11y` renders every page template and asserts the mechanical WCAG checks
(~30–40% per the standard): `<html lang>`, non-empty `<title>`, viewport meta, exactly
one `<h1>`, skip-to-content link + `#main` landmark, visible-focus styles,
`prefers-reduced-motion` handling, image `alt`, labelled form controls, no positive
`tabindex`, non-empty link/button text. **Result: 0 violations across 7 page templates**
(intake EN/ES, checklist EN/ES, printable packet, form-fill, form-degraded). Keyboard-path
properties are additionally asserted in `tests/pages.test.ts`.

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

## Design choices supporting AA
- High-contrast dark palette (tokens in `src/render.ts`); 3px visible focus ring.
- `role="status"` `aria-live="polite"` on the form-fill status line.
- The whole intake→checklist flow works with **no client JavaScript**; form-fill is the
  only JS, and it degrades to "download the blank form" if it fails.

## Accessibility statement
To be published at launch, committing to WCAG 2.2 AA and providing a contact for
accessibility issues. **Status: drafted, not published.**
