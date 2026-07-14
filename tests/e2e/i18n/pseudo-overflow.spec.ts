import { expect, test } from "@playwright/test";

// G9 — pseudolocale overflow (INTERNATIONALIZATION-STANDARD §4 / §8).
//
// Loads the key routes under an `en-XA`-style pseudolocale (~40% longer than
// English, bracketed with ⟦ … ⟧) and asserts nothing clips, truncates, or forces
// horizontal scroll. This catches layouts that only fit because English happens to
// be short — the failure mode that surfaces the moment Spanish (the shipping second
// locale) or any longer locale renders. Runs under both projects (desktop +
// Pixel-7 mobile), so narrow-viewport expansion is covered too.
//
// The app is server-rendered, so the pseudolocale is activated by `?language=en-XA`
// (the test server registers it behind TDN_I18N_TEST_HOOKS=1; production never does
// — see tests/e2e/i18n/pseudo-server.ts). The pseudo strings therefore arrive in
// the initial HTML; we still wait for the ⟦ marker before measuring.

// The marker every pseudo value carries; its presence in the DOM proves the
// pseudolocale actually rendered.
const MARK = "⟦"; // ⟦

// Structurally distinct, content-heavy routes (mirrors the a11y URL set), each
// forced to the pseudolocale: the intake form, the checklist (steps/lists/plan
// summary/resume panel), the print packet, the grounded answer prose, the
// form-fill copy helper, and the long legal prose. Together these exercise every
// distinct layout in the app.
//
// The /guide surfaces are intentionally EXCLUDED: they key a hardcoded state-name
// map (src/guide.ts STATES[].name) strictly by the shipping Language union, so a
// non-shipping test locale has no entry there. This never affects production
// (asLanguage() only ever yields en/es in prod), and the guide layout — a
// renderChecklist() list plus prose — is already covered by /checklist and /terms.
// The relocation planner (/move, /plan) is included: it is a new user-facing surface with
// its own layout (phase sections, hazard lists with a logical border, a cost panel), and its
// copy is the longest in the app — the classification badges and hazard sentences are exactly
// the strings a 40%-expanding locale would break first.
const ROUTES = [
  "/?language=en-XA",
  "/checklist?jurisdiction=US-CA&change=name&change=gender-marker&language=en-XA",
  "/packet?jurisdiction=US-CA&change=name&change=gender-marker&language=en-XA",
  "/answer?jurisdiction=US-CA&change=name&language=en-XA",
  "/forms/us-ss-5?language=en-XA",
  "/terms?language=en-XA",
  "/move?language=en-XA",
  "/plan?origin=US-TX&destination=US-WA&hold=court-order&language=en-XA",
];

test.describe("G9 — pseudolocale overflow (en-XA, ~40% expansion)", () => {
  for (const route of ROUTES) {
    test(`${route} has no clipping / truncation / horizontal scroll under en-XA`, async ({ page }) => {
      await page.goto(route);
      // Confirm the pseudolocale rendered, then let fonts + layout settle.
      await page.waitForFunction((mark) => document.body.innerText.includes(mark), MARK);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(300);

      const offenders = await page.evaluate(() => {
        const EPS = 1.5; // sub-pixel rounding tolerance
        const problems: string[] = [];

        // 1) The page itself must not scroll horizontally — the canonical
        //    "something is wider than the viewport" signal.
        const doc = document.documentElement;
        if (doc.scrollWidth > doc.clientWidth + EPS) {
          problems.push(`page: horizontal scroll (scrollWidth ${doc.scrollWidth} > clientWidth ${doc.clientWidth})`);
        }

        const describe = (el: Element): string => {
          const id = el.id ? `#${el.id}` : "";
          const cn = el.getAttribute("class");
          const cls = cn && cn.trim() ? "." + cn.trim().split(/\s+/).join(".") : "";
          return `${el.tagName.toLowerCase()}${id}${cls}`;
        };
        const overflowsX = (el: Element): boolean => el.scrollWidth > el.clientWidth + EPS;

        for (const el of Array.from(document.querySelectorAll("body *"))) {
          const cs = getComputedStyle(el);
          if (cs.display === "none" || cs.visibility === "hidden") continue;
          // Skip sr-only / zero-size utilities (e.g. .sr-only: 1px clipped, nowrap),
          // whose content intentionally overflows their 1px box.
          if (el.clientWidth < 4 || el.clientHeight < 4) continue;

          const scroller = /(auto|scroll)/.test(cs.overflowX);
          const hasText = !!el.textContent && el.textContent.trim().length > 0;

          // 2) A clipping container whose text content is cut off horizontally.
          const clipsX = cs.overflowX === "hidden" || cs.overflowX === "clip";
          if (clipsX && hasText && overflowsX(el)) {
            problems.push(`${describe(el)}: clipped content (scrollWidth ${el.scrollWidth} > clientWidth ${el.clientWidth})`);
          }

          // 3) Text truncated by ellipsis or nowrap.
          const truncates = cs.textOverflow === "ellipsis" || cs.whiteSpace === "nowrap";
          if (truncates && !scroller && hasText && overflowsX(el)) {
            problems.push(`${describe(el)}: truncated text (scrollWidth ${el.scrollWidth} > clientWidth ${el.clientWidth})`);
          }
        }

        // 4) The main layout containers explicitly: their content must fit
        //    (scrollWidth ≤ clientWidth), regardless of any ancestor clipping.
        for (const sel of ["main", ".banner", "fieldset", ".step", ".copy-out"]) {
          for (const el of Array.from(document.querySelectorAll(sel))) {
            const cs = getComputedStyle(el);
            if (cs.display === "none" || /(auto|scroll)/.test(cs.overflowX)) continue;
            if (el.clientWidth < 4) continue;
            if (el.scrollWidth > el.clientWidth + EPS) {
              problems.push(`${describe(el)}: container overflow (scrollWidth ${el.scrollWidth} > clientWidth ${el.clientWidth})`);
            }
          }
        }

        return [...new Set(problems)];
      });

      expect(offenders, `pseudolocale overflow on ${route}`).toEqual([]);
    });
  }
});
