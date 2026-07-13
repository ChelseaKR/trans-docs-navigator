import { defineConfig, devices } from "@playwright/test";

// G9 — pseudolocale overflow gate (INTERNATIONALIZATION-STANDARD §4 / §8).
// Runs tests/e2e/i18n/pseudo-overflow.spec.ts on the key routes across a desktop and
// a narrow mobile viewport. Playwright starts the TEST server (pseudo-server.ts) with
// TDN_I18N_TEST_HOOKS=1 so `?language=en-XA` resolves to the generated pseudolocale;
// production (api/server.ts) never sets the flag. Self-contained: local == CI.

const PORT = Number(process.env.PW_PORT ?? 8091);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  // This config is exclusively the test-only pseudolocale lane. The production-entry
  // journey has its own config and server in playwright.journey.config.ts.
  testDir: "tests/e2e/i18n",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    // The pseudolocale is registered only when TDN_I18N_TEST_HOOKS=1 (test build);
    // the production server never sets it, so en-XA can never ship.
    command: `TDN_I18N_TEST_HOOKS=1 PORT=${PORT} node --experimental-strip-types --no-warnings tests/e2e/i18n/pseudo-server.ts`,
    url: `${baseURL}/livez`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
