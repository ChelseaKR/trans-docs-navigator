import { expect, test, type Page } from "@playwright/test";

// D2 — real-browser E2E of the full user journey (ROADMAP-2 D2).
//
// Walks intake → checklist → form-fill → encrypted save/resume round-trip through an
// actual browser, against the PRODUCTION server (api/server.ts) — NOT the pseudolocale
// test entry (tests/e2e/i18n/pseudo-server.ts registers en-XA only under
// TDN_I18N_TEST_HOOKS=1; the "journey-*" Playwright projects never set that flag and
// boot api/server.ts directly on their own port — see playwright.config.ts). This is
// the browser-driven sibling of scripts/smoke-journey.ts (a non-browser HTTP walk): it
// proves the CLIENT-SIDE modules (resume-panel.js, resume-crypto.js, form-copy.js)
// actually execute in a real browser under the real strict CSP, which a fetch-only
// smoke test can't observe.
//
// Routes, selectors, and copy mirror scripts/smoke-journey.ts and src/pages.ts.

const DISCLOSURE = "Information, not legal advice";
const RESUME_KEY = "tdn.resume";
const PASSPHRASE = "correct horse battery staple";

type NavResponse = Awaited<ReturnType<Page["goto"]>>;

/** Every HTML response must carry the strict CSP — no inline-script escape hatch
 *  (mirrors scripts/smoke-journey.ts's CSP invariant, now proven under a real browser). */
function assertStrictCSP(response: NavResponse): void {
  expect(response, "no navigation response captured").not.toBeNull();
  const csp = response?.headers()["content-security-policy"] ?? "";
  expect(csp).toContain("script-src 'self'");
  expect(csp).not.toContain("unsafe-inline");
}

test.describe("D2 — full user journey (real browser, production server)", () => {
  test("intake → checklist → form-fill → encrypted save/resume round-trip", async ({ page }) => {
    // ---- 1) Intake -----------------------------------------------------
    const intakeResponse = await page.goto("/");
    assertStrictCSP(intakeResponse);

    await page.selectOption("#jurisdiction", "US-CA");
    // Both change-type checkboxes ship checked by default; explicitly (re)check them
    // per the spec so the test doesn't depend on that default surviving a future edit.
    await page.locator('input[name="change"][value="name"]').check();
    await page.locator('input[name="change"][value="gender-marker"]').check();

    // Race waitForResponse (fires on headers-received) together with waitForURL (fires
    // once the frame actually commits) so page.url() below is guaranteed up to date.
    const [checklistResponse] = await Promise.all([
      page.waitForResponse((r) => r.request().isNavigationRequest() && r.url().includes("/checklist")),
      page.waitForURL((url) => url.pathname === "/checklist"),
      page.click('button[type="submit"]'),
    ]);
    assertStrictCSP(checklistResponse);

    const checklistUrl = new URL(page.url());
    expect(checklistUrl.pathname).toBe("/checklist");
    expect(checklistUrl.searchParams.get("jurisdiction")).toBe("US-CA");
    expect(checklistUrl.searchParams.getAll("change").sort()).toEqual(["gender-marker", "name"]);
    await expect(page.locator("body")).toContainText(DISCLOSURE);
    await expect(page.locator("body")).toContainText("Step 1");
    const checklistQuery = checklistUrl.search; // includes the leading "?"

    // ---- 2) Form-fill: follow a /forms/... link from the checklist -----
    const formLink = page.locator('a[href^="/forms/"]').first();
    await expect(formLink).toBeVisible();
    const [formResponse] = await Promise.all([
      page.waitForResponse((r) => r.request().isNavigationRequest() && r.url().includes("/forms/")),
      page.waitForURL((url) => url.pathname.startsWith("/forms/")),
      formLink.click(),
    ]);
    assertStrictCSP(formResponse);

    // form-copy.js is clipboard-based (on-device, non-PII), not a file download, so we
    // assert the copy affordance actually rendered and its script loaded, rather than a
    // download event.
    await expect(page.locator("body")).toContainText("Your details, ready to copy");
    await expect(page.locator('script[src="/assets/form-copy.js"]')).toHaveCount(1);
    await expect(page.locator("#copy-btn")).toBeVisible();
    await expect(page.locator("#copy-current")).toBeVisible();
    await expect(page.locator("#copy-new")).toBeVisible();

    // ---- 3) Encrypted save/resume round-trip, back on the checklist ----
    const backResponse = await page.goto(`/checklist${checklistQuery}`);
    assertStrictCSP(backResponse);

    await page.fill("#resume-pass", PASSPHRASE);
    await page.click("#resume-save");
    await expect(page.locator("#resume-status")).toHaveText("Saved on this device, encrypted. Nothing was sent anywhere.");

    const stored = await page.evaluate((key) => localStorage.getItem(key), RESUME_KEY);
    expect(stored, "tdn.resume should be populated after save").toBeTruthy();
    const blob = stored ?? "";
    // Non-plaintext: an AES-GCM blob is base64 of [salt|iv|ciphertext] — no query-string
    // structure survives, and it must not simply be the raw query.
    expect(blob).not.toBe(checklistQuery.replace(/^\?/, ""));
    expect(blob).not.toContain("jurisdiction");
    expect(blob).not.toContain("US-CA");
    expect(blob).toMatch(/^[A-Za-z0-9+/]+=*$/);

    // Navigate away, then land on a DIFFERENT checklist selection so the eventual
    // restore is provably not a no-op against an already-matching URL.
    await page.goto("/");
    const otherResponse = await page.goto("/checklist?jurisdiction=US-NY&change=name");
    assertStrictCSP(otherResponse);
    expect(new URL(page.url()).searchParams.get("jurisdiction")).toBe("US-NY");

    // Negative check: wrong passphrase must fail closed — status shows the "wrong"
    // message, and there must be no navigation away from the US-NY selection.
    await page.fill("#resume-pass", "definitely the wrong passphrase");
    await page.click("#resume-load");
    await expect(page.locator("#resume-status")).toHaveText("Wrong passphrase, or the saved data was changed.");
    expect(new URL(page.url()).searchParams.get("jurisdiction")).toBe("US-NY");

    // Correct passphrase restores the originally-saved (US-CA) selection.
    await page.fill("#resume-pass", PASSPHRASE);
    const [restoreResponse] = await Promise.all([
      page.waitForResponse((r) => r.request().isNavigationRequest() && r.url().includes("jurisdiction=US-CA")),
      page.waitForURL((url) => url.searchParams.get("jurisdiction") === "US-CA"),
      page.click("#resume-load"),
    ]);
    assertStrictCSP(restoreResponse);

    const restoredUrl = new URL(page.url());
    expect(restoredUrl.pathname).toBe("/checklist");
    expect(restoredUrl.searchParams.get("jurisdiction")).toBe("US-CA");
    expect(restoredUrl.searchParams.getAll("change").sort()).toEqual(["gender-marker", "name"]);
  });
});
