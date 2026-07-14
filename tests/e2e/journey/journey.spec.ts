import { expect, test, type Page } from "@playwright/test";

// D2 — intake → checklist → packet → form helper → encrypted save/resume in a
// real browser against api/server.ts. Synthetic names are deliberately obvious test
// fixtures; neither those values nor the encrypted-resume interaction may generate a
// request after the page has settled.
const DISCLOSURE = "Information, not legal advice";
const RESUME_KEY = "tdn.resume";
const PASSPHRASE = "correct horse battery staple";

type NavResponse = Awaited<ReturnType<Page["goto"]>>;

function assertStrictCsp(response: NavResponse): void {
  expect(response, "no navigation response captured").not.toBeNull();
  const csp = response?.headers()["content-security-policy"] ?? "";
  expect(csp).toContain("script-src 'self'");
  expect(csp).not.toContain("unsafe-inline");
}

test.describe("D2 — full journey (production server)", () => {
  test("on-device copy and encrypted resume round-trip stay local", async ({ page }) => {
    const intakeResponse = await page.goto("/");
    assertStrictCsp(intakeResponse);

    await page.selectOption("#jurisdiction", "US-CA");
    await page.locator('input[name="change"][value="name"]').check();
    await page.locator('input[name="change"][value="gender-marker"]').check();

    const [checklistResponse] = await Promise.all([
      page.waitForResponse((response) => response.request().isNavigationRequest() && new URL(response.url()).pathname === "/checklist"),
      page.waitForURL((url) => url.pathname === "/checklist"),
      page.click('button[type="submit"]'),
    ]);
    assertStrictCsp(checklistResponse);

    const checklistUrl = new URL(page.url());
    expect(checklistUrl.searchParams.get("jurisdiction")).toBe("US-CA");
    expect(checklistUrl.searchParams.getAll("change").sort()).toEqual(["gender-marker", "name"]);
    await expect(page.locator("body")).toContainText(DISCLOSURE);
    await expect(page.locator("body")).toContainText("Step 1");
    const checklistQuery = checklistUrl.search;

    const [packetResponse] = await Promise.all([
      page.waitForResponse((response) => response.request().isNavigationRequest() && new URL(response.url()).pathname === "/packet"),
      page.waitForURL((url) => url.pathname === "/packet"),
      page.locator('a[href^="/packet"]').click(),
    ]);
    assertStrictCsp(packetResponse);
    await expect(page.locator("body")).toContainText("Prepared on");

    // The print packet intentionally contains source links rather than app form-helper
    // links. Return to the same checklist selection before exercising that helper.
    const checklistAgainResponse = await page.goto(`/checklist${checklistQuery}`);
    assertStrictCsp(checklistAgainResponse);

    const formLink = page.locator('a[href^="/forms/"]').first();
    await expect(formLink).toBeVisible();
    const [formResponse] = await Promise.all([
      page.waitForResponse((response) => response.request().isNavigationRequest() && new URL(response.url()).pathname.startsWith("/forms/")),
      page.waitForURL((url) => url.pathname.startsWith("/forms/")),
      formLink.click(),
    ]);
    assertStrictCsp(formResponse);
    await page.waitForLoadState("networkidle");

    const copyRequests: string[] = [];
    const recordCopyRequest = (request: { url(): string }): void => { copyRequests.push(request.url()); };
    page.on("request", recordCopyRequest);
    await page.fill("#copy-current", "Example Current");
    await page.fill("#copy-new", "Example New");
    await page.click("#copy-btn");
    await expect(page.locator("#copy-out")).toContainText("Example Current");
    await expect(page.locator("#copy-out")).toContainText("Example New");
    await page.waitForTimeout(100);
    page.off("request", recordCopyRequest);
    expect(copyRequests, "the on-device form helper issued a request").toEqual([]);

    const backResponse = await page.goto(`/checklist${checklistQuery}`);
    assertStrictCsp(backResponse);
    await page.waitForLoadState("networkidle");

    const saveRequests: string[] = [];
    const recordSaveRequest = (request: { url(): string }): void => { saveRequests.push(request.url()); };
    page.on("request", recordSaveRequest);
    await page.fill("#resume-pass", PASSPHRASE);
    await page.click("#resume-save");
    await expect(page.locator("#resume-status")).toHaveText(
      "Encrypted resume copy saved on this device. This save made no network request.",
    );
    await page.waitForTimeout(100);
    page.off("request", recordSaveRequest);
    expect(saveRequests, "encrypted resume save issued a request").toEqual([]);

    const stored = await page.evaluate((key) => localStorage.getItem(key), RESUME_KEY);
    expect(stored, "tdn.resume should be populated after save").toBeTruthy();
    expect(stored).not.toContain("jurisdiction");
    expect(stored).not.toContain("US-CA");
    expect(stored).toMatch(/^[A-Za-z0-9+/]+=*$/);

    const otherResponse = await page.goto("/checklist?jurisdiction=US-NY&change=name");
    assertStrictCsp(otherResponse);
    await page.fill("#resume-pass", "definitely the wrong passphrase");
    await page.click("#resume-load");
    await expect(page.locator("#resume-status")).toHaveText("Wrong passphrase, or the saved data was changed.");
    expect(new URL(page.url()).searchParams.get("jurisdiction")).toBe("US-NY");

    await page.fill("#resume-pass", PASSPHRASE);
    const [restoreResponse] = await Promise.all([
      page.waitForResponse((response) => response.request().isNavigationRequest() && response.url().includes("jurisdiction=US-CA")),
      page.waitForURL((url) => url.searchParams.get("jurisdiction") === "US-CA"),
      page.click("#resume-load"),
    ]);
    assertStrictCsp(restoreResponse);
    const restoredUrl = new URL(page.url());
    expect(restoredUrl.pathname).toBe("/checklist");
    expect(restoredUrl.searchParams.getAll("change").sort()).toEqual(["gender-marker", "name"]);
  });
});
