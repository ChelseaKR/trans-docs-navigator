// Poison fixture: a deliberately failing test, run in isolation via RUN_TESTS_GLOB
// to prove run-tests.ts (the "test" gate) forwards a non-zero Node test-runner exit
// code into its own fail() contract, instead of silently swallowing it.
import { test } from "node:test";
import assert from "node:assert/strict";

test("intentionally broken — proves the test gate fails closed", () => {
  assert.equal(1, 2);
});
