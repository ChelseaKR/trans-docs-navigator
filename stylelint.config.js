// G10 (static) — CSS logical properties for RTL readiness.
// INTERNATIONALIZATION-STANDARD.md §4 (G10) + §8: layout MUST use CSS logical
// properties so the design mirrors correctly when an RTL locale (ar/he) ships.
//
// SCOPE (locked): this gate enforces the *inline* (writing-direction) axis only —
// the axis that flips under RTL. It flags physical `left`/`right`,
// `margin-/padding-/border-left|right`, and physical `text-align`/`float`/`clear`
// values, requiring `inset-inline-*`, `margin-inline-*`, `padding-inline-*`,
// `border-inline-*`, and `text-align: start|end`.
//
// The block (vertical) axis and box sizing do NOT flip under RTL, so `top`/
// `bottom`, `margin-/padding-/border-top|bottom`, and `width`/`height` are
// intentionally left as physical properties via `except` — converting them would
// be churn with no RTL benefit and is out of G10's scope. When an RTL locale
// ships, the deferred dynamic ar/he dir=rtl mirror smoke (see docs/I18N.md)
// verifies the runtime result; this static gate keeps new physical inline CSS
// from landing in the meantime.
//
// The app stylesheet is the typed `STYLE` template in src/render.ts (served at
// /assets/app.css). `make i18n-logical-css` extracts it to a git-ignored
// artifact (scripts/i18n-css-extract.ts) and lints that; fix any finding in
// src/render.ts, not the artifact.
export default {
  plugins: ["stylelint-use-logical"],
  rules: {
    "csstools/use-logical": [
      "always",
      {
        except: [
          // Block (vertical) axis — unaffected by inline direction / RTL.
          /^(top|bottom)$/,
          /^margin-(top|bottom)$/,
          /^padding-(top|bottom)$/,
          /^border-(top|bottom)(-|$)/,
          // Box sizing — physical width/height do not mirror under RTL.
          /^(min-|max-)?(width|height)$/,
          /^overflow-(x|y)$/,
        ],
      },
    ],
  },
};
