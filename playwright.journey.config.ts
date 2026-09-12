import { defineConfig, devices } from "@playwright/test";

// D2 — real-browser full journey against the unmodified production server entry.
// Kept separate from playwright.config.ts so the pseudolocale gate never boots a
// second server, and this suite can never inherit the test-only en-XA registration.
const PORT = Number(process.env.PW_JOURNEY_PORT ?? 8092);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e/journey",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // A test that fails and then passes on its retry is reported `flaky`, and
  // Playwright exits 0 on flaky unless told otherwise, so the retry above would
  // turn an intermittent failure into a green run that records nothing. In CI
  // the retry still runs, so the report keeps both attempts, and the run fails.
  // Locally there is no retry, so a flake is already a failure there.
  failOnFlakyTests: !!process.env.CI,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL },
  projects: [
    { name: "journey-desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "journey-mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `NODE_ENV=test PORT=${PORT} node --experimental-strip-types --no-warnings api/server.ts`,
    url: `${baseURL}/livez`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
