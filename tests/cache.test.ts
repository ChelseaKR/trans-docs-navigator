import { test } from "node:test";
import assert from "node:assert/strict";
import { memoize, clearAllCaches } from "../api/cache.ts";

test("memoize returns the cached value without recomputing on a repeat key", () => {
  let calls = 0;
  const compute = (n: number) => {
    calls++;
    return n * 2;
  };
  const doubled = memoize(compute);
  assert.equal(doubled(3), 6);
  assert.equal(doubled(3), 6);
  assert.equal(doubled(3), 6);
  assert.equal(calls, 1);
  assert.equal(doubled(4), 8);
  assert.equal(calls, 2);
});

test("memoize evicts the oldest entry once size exceeds max", () => {
  let calls = 0;
  const compute = (n: number) => {
    calls++;
    return n;
  };
  const cached = memoize(compute, { max: 2 });
  cached(1);
  cached(2);
  calls = 0;
  cached(1); // still cached
  cached(2); // still cached
  assert.equal(calls, 0);

  cached(3); // pushes size to 3 > max(2) -> evicts the oldest (1)
  calls = 0;
  cached(2); // was refreshed as MRU by the earlier hit, should still be cached
  cached(3); // just inserted, should still be cached
  assert.equal(calls, 0);
  cached(1); // was evicted -> recompute
  assert.equal(calls, 1);
});

test("memoize respects a custom keyOf for non-string keys", () => {
  let calls = 0;
  const cached = memoize<{ a: number; b: number }, number>(
    (k) => {
      calls++;
      return k.a + k.b;
    },
    { keyOf: (k) => `${k.a}:${k.b}` },
  );
  assert.equal(cached({ a: 1, b: 2 }), 3);
  assert.equal(cached({ a: 1, b: 2 }), 3);
  assert.equal(calls, 1);
});

test("clearAllCaches empties every cache created via memoize", () => {
  let calls = 0;
  const cached = memoize((n: number) => {
    calls++;
    return n;
  });
  cached(1);
  cached(1);
  assert.equal(calls, 1);
  clearAllCaches();
  cached(1);
  assert.equal(calls, 2);
});

test("a cache's own .clear() only empties that cache", () => {
  let aCalls = 0;
  let bCalls = 0;
  const a = memoize((n: number) => {
    aCalls++;
    return n;
  });
  const b = memoize((n: number) => {
    bCalls++;
    return n;
  });
  a(1);
  b(1);
  a.clear();
  a(1);
  b(1);
  assert.equal(aCalls, 2);
  assert.equal(bCalls, 1);
});
