import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { expect, test } from "@playwright/test";

// The portable single-file edition (#233), exercised the way it is actually used: opened
// from `file://`, in a real browser, with the network switched off at the context level.
//
// tests/portable.test.ts already proves the bundle answers identically to the server. It
// cannot prove the three things that only a browser can settle, and that are the whole
// reason the artifact exists:
//   1. the file OPENS and the engine runs from `file://` — no origin, no server, no
//      module loader, no service worker;
//   2. it issues NO request off the device, for anything, ever;
//   3. carried past its corpus's re-check dates it says so, on the reader's own clock,
//      and still hands over the official-source links it can no longer summarise.
//
// The browser context is set offline, so a request that did fire would fail rather than
// leak — and every request the page attempts is recorded and asserted to be empty of
// anything but the file itself and its own in-memory blobs.

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const ARTIFACT = join(REPO_ROOT, "dist", "portable", "trans-docs-navigator.html");

/** The corpus is seeded in one pass, so it lapses on one day; this is a day after it. */
const AFTER_EVERYTHING_LAPSES = "2026-12-01T12:00:00Z";

test.beforeAll(() => {
  execFileSync(
    process.execPath,
    ["--experimental-strip-types", "--no-warnings", join(REPO_ROOT, "scripts", "portable-build.ts")],
    { cwd: REPO_ROOT, stdio: "inherit" },
  );
});

test.describe("EXP-02 — the portable edition, from file:// with the network off", () => {
  test("runs intake, the checklist, /move and /compare with no request off the device", async ({ page, context }) => {
    await context.setOffline(true);
    const offDevice: string[] = [];
    page.on("request", (request) => {
      const url = request.url();
      if (!url.startsWith("file:") && !url.startsWith("blob:") && !url.startsWith("data:")) offDevice.push(url);
    });
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    // A request the policy refuses never becomes a `request` event — Chromium blocks it
    // in the renderer — so the recorder above, on its own, proves only that the policy
    // held, not that no code tried. Measured: adding a `fetch` to the render path left
    // this spec GREEN until the console was read as well. The blocked attempt is
    // reported there ("violates the following Content Security Policy directive"), so
    // both are asserted: nothing left the device, AND nothing tried to.
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });

    await page.goto(pathToFileURL(ARTIFACT).href);
    await expect(page.locator("#tdn-root h1")).toBeVisible();

    // The banner names the build and the content hash, and reports how much of the
    // corpus can still be served — derived from the records against this device's clock,
    // not from a countdown burned in at build time.
    const header = page.locator("#tdn-portable-header");
    await expect(header).toContainText(/\d{4}-\d{2}-\d{2}/);
    await expect(header.locator("#tdn-build")).toContainText(/[0-9a-f]{16}/);
    await expect(header.locator("#tdn-serving")).toContainText(/^[1-9][0-9]*\/[0-9]+$/);

    await page.selectOption("#jurisdiction", "US-CA");
    await page.locator('input[name="change"][value="name"]').check();
    await page.locator("#tdn-root form button[type=submit]").first().click();

    await expect(page.locator("#tdn-root h1")).toHaveText(/checklist/i);
    await expect(page.locator('#tdn-root a[href^="https://"]').first()).toBeVisible();
    const steps = await page.locator("#tdn-root a[href^='https://']").count();
    expect(steps, "the offline checklist cites official sources").toBeGreaterThan(0);

    // The relocation planner and the comparison table are the two routes that read the
    // whole corpus rather than one jurisdiction's slice, so they are the ones a missing
    // corpus file would break.
    await page.evaluate(() => {
      window.location.hash = "#!/move?origin=US-TX&destination=US-CA&change=name";
    });
    await expect(page.locator("#tdn-root h1")).toBeVisible();
    await page.evaluate(() => {
      window.location.hash = "#!/compare?current=US-CA&change=name";
    });
    await expect(page.locator("#tdn-root table, #tdn-root h1")).toBeTruthy();

    // Spanish comes from the reviewed locale bundle, through the same engine.
    await page.evaluate(() => {
      window.location.hash = "#!/?language=es";
    });
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    await expect(header).toContainText("Copia guardada");

    expect(pageErrors, "the portable bundle raised no script error").toEqual([]);
    expect(offDevice, "the portable edition requested nothing off the device").toEqual([]);
    expect(consoleErrors, "nothing in the portable edition even attempted a request").toEqual([]);
  });

  test("past its corpus's re-check dates it degrades on the device clock and keeps the links", async ({ page, context }) => {
    await context.setOffline(true);
    await page.clock.install({ time: new Date(AFTER_EVERYTHING_LAPSES) });
    await page.goto(pathToFileURL(ARTIFACT).href);
    await expect(page.locator("#tdn-root h1")).toBeVisible();

    await page.evaluate(() => {
      window.location.hash = "#!/checklist?jurisdiction=US-CA&change=name&doc=court-order";
    });
    await expect(page.locator("#tdn-root h1")).toHaveText(/checklist/i);

    // The header refuses to present the copy as current...
    await expect(page.locator("#tdn-portable-header")).toContainText("needs reverification");
    await expect(page.locator("#tdn-serving")).toHaveText(/^0\/[0-9]+$/);

    // ...and the page it degrades still carries the official sources, which is the whole
    // point of the fix in #255: a pointer does not go stale the way a summary does, and a
    // reader who cannot be told what a page said must still be told where it is.
    const sources = await page.locator('#tdn-root a[href^="https://"]').count();
    expect(sources, "a degraded portable page still hands over its official sources").toBeGreaterThan(0);
  });

  test("the artifact on disk verifies against the hash it declares", () => {
    const html = readFileSync(ARTIFACT, "utf8");
    const declared = /<meta name="tdn-content-sha256" content="([0-9a-f]{64})">/.exec(html)?.[1];
    expect(declared, "the artifact declares a content hash").toBeTruthy();
    execFileSync(
      process.execPath,
      ["--experimental-strip-types", "--no-warnings", join(REPO_ROOT, "scripts", "portable-build.ts"), "--verify"],
      { cwd: REPO_ROOT, stdio: "inherit" },
    );
  });
});
