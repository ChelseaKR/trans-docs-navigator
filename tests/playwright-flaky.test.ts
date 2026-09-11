// Every Playwright config at the repository root that retries in CI must also
// fail the run on a flaky result.
//
// Playwright reports a test that failed and then passed on a retry as `flaky`,
// and exits 0 on flaky unless `failOnFlakyTests` is set. With `retries` above
// zero in CI, that turns an intermittent failure into a green check with
// nothing to show for it. This imports each config the way Playwright reads it,
// with CI set, rather than matching its text, so a key that is commented out,
// misspelt or set to `false` cannot satisfy it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

process.env.CI = "1";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CONFIGS = readdirSync(ROOT)
  .filter((name) => /^playwright(\.[a-z]+)?\.config\.ts$/.test(name))
  .sort();

test("both known Playwright configs are found, so the check below is not vacuous", () => {
  for (const known of ["playwright.config.ts", "playwright.journey.config.ts"]) {
    assert.ok(CONFIGS.includes(known), `${known} is missing from ${JSON.stringify(CONFIGS)}`);
  }
});

for (const name of CONFIGS) {
  test(`${name}: a CI run that retries fails when a retry was needed`, async () => {
    const config = (await import(pathToFileURL(join(ROOT, name)).href)).default;
    const retries = config.retries ?? 0;
    assert.ok(
      retries === 0 || config.failOnFlakyTests === true,
      `${name} retries ${retries} time(s) in CI but does not set failOnFlakyTests: true, ` +
        "so a test that passes only on its retry reads as green",
    );
  });
}
