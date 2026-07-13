// Tiny generic memoization helper (IP §5.2 — cache common (jurisdiction × change-type)
// answers and static checklist HTML for cost/perf). Mirrors the bounded-map discipline
// server.ts already uses for the rate limiter: a plain Map with a hard size cap and
// oldest-first eviction, never an unbounded process-lifetime grow. Process-local only —
// no durable persistence or network egress. Callers exclude free text and direct identity
// fields, but selection-only keys can still be sensitive; see
// api/router.ts and scripts/privacy-lint.ts).

const DEFAULT_MAX = 256;

export interface MemoizeOptions<K> {
  /** Max distinct cache entries before oldest-first eviction. Default 256. */
  max?: number;
  /** Turn a key into the string used for Map storage/eviction. Defaults to String(key). */
  keyOf?: (key: K) => string;
}

/** A caller-visible handle for clearing one memoized cache without going through the registry. */
export interface Memoized<K, V> {
  (key: K): V;
  clear(): void;
}

// Every cache created by memoize() registers its clear() here, so a single corpus
// change (api/corpus.ts mtime invalidation) can drop every derived cache at once.
const registry: Array<() => void> = [];

/**
 * Wrap `compute` in a bounded, process-local memo cache. LRU-ish: a hit is re-inserted
 * (delete + set) so it reads as most-recently-used under Map's insertion-order iteration;
 * once size exceeds `max`, the oldest entry (first in iteration order) is evicted.
 */
export function memoize<K, V>(compute: (key: K) => V, opts: MemoizeOptions<K> = {}): Memoized<K, V> {
  const max = opts.max ?? DEFAULT_MAX;
  const keyOf = opts.keyOf ?? ((k: K) => String(k));
  const cache = new Map<string, V>();

  const memoized = ((key: K): V => {
    const k = keyOf(key);
    const hit = cache.get(k);
    if (hit !== undefined || cache.has(k)) {
      cache.delete(k);
      cache.set(k, hit as V); // refresh recency
      return hit as V;
    }
    const value = compute(key);
    cache.set(k, value);
    if (cache.size > max) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    return value;
  }) as Memoized<K, V>;

  memoized.clear = () => cache.clear();
  registry.push(memoized.clear);
  return memoized;
}

/** Clear every cache created via memoize() — called on corpus mtime invalidation (dev ergonomics). */
export function clearAllCaches(): void {
  for (const clear of registry) clear();
}
