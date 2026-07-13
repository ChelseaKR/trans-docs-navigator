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
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL },
  projects: [
    { name: "journey-desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "journey-mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `PORT=${PORT} node --experimental-strip-types --no-warnings api/server.ts`,
    url: `${baseURL}/livez`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
