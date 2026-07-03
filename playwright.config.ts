import { defineConfig, devices } from "@playwright/test";

// Two independent real-browser suites share this harness, each against its own server:
//
//   • i18n (G9 pseudolocale overflow — INTERNATIONALIZATION-STANDARD §4 / §8): runs
//     tests/e2e/i18n/pseudo-overflow.spec.ts against a TEST server (pseudo-server.ts)
//     booted with TDN_I18N_TEST_HOOKS=1, which registers the generated `en-XA`
//     pseudolocale so `?language=en-XA` resolves. Production never sets that flag.
//
//   • journey (D2 full-journey E2E): runs tests/e2e/journey/**/*.spec.ts against the
//     REAL PRODUCTION server entry (api/server.ts, unmodified) on its own port, so it
//     proves intake → checklist → form-fill → encrypted save/resume actually works
//     under the exact server the app ships — en-XA is never registered here.
//
// Each suite gets its own project pair (desktop + Pixel-7 mobile) and its own
// `testDir`, so a project only ever discovers the files it's meant to run; each
// suite's server is declared as its own entry in the `webServer` array (Playwright
// supports multiple independent webServers since 1.28). Self-contained: local == CI.

const I18N_PORT = Number(process.env.PW_PORT ?? 8091);
const i18nBaseURL = `http://localhost:${I18N_PORT}`;

const JOURNEY_PORT = Number(process.env.PW_JOURNEY_PORT ?? 8092);
const journeyBaseURL = `http://localhost:${JOURNEY_PORT}`;

export default defineConfig({
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  projects: [
    { name: "desktop", testDir: "tests/e2e/i18n", use: { ...devices["Desktop Chrome"], baseURL: i18nBaseURL } },
    { name: "mobile", testDir: "tests/e2e/i18n", use: { ...devices["Pixel 7"], baseURL: i18nBaseURL } },
    { name: "journey-desktop", testDir: "tests/e2e/journey", use: { ...devices["Desktop Chrome"], baseURL: journeyBaseURL } },
    { name: "journey-mobile", testDir: "tests/e2e/journey", use: { ...devices["Pixel 7"], baseURL: journeyBaseURL } },
  ],
  webServer: [
    {
      // The pseudolocale is registered only when TDN_I18N_TEST_HOOKS=1 (test build);
      // the production server never sets it, so en-XA can never ship.
      command: `TDN_I18N_TEST_HOOKS=1 PORT=${I18N_PORT} node --experimental-strip-types --no-warnings tests/e2e/i18n/pseudo-server.ts`,
      url: `${i18nBaseURL}/livez`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      // The journey suite exercises the real server, not a test entry.
      command: `PORT=${JOURNEY_PORT} node --experimental-strip-types --no-warnings api/server.ts`,
      url: `${journeyBaseURL}/livez`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
