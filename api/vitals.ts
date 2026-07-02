// Cookieless Core Web Vitals beacon validation (OBSERVABILITY-STANDARD §8).
// Pure and unit-testable like api/router.ts: given the raw beacon body it returns
// the validated sample or null — no sockets, no fs, no PII. The PRIVACY INVARIANT
// holds: the accepted shape has no room for identifiers (fixed field set, enum
// name/rating, bounded numeric value) and the path is truncated and stripped of
// any query string before it can reach a log line.

export const WEB_VITAL_NAMES = ["CLS", "INP", "LCP"] as const;
export const WEB_VITAL_RATINGS = ["good", "needs-improvement", "poor"] as const;

export type WebVitalName = (typeof WEB_VITAL_NAMES)[number];
export type WebVitalRating = (typeof WEB_VITAL_RATINGS)[number];

export interface WebVitalSample {
  name: WebVitalName;
  value: number;
  rating: WebVitalRating;
  path: string;
}

/** Beacon bodies are tiny; anything bigger is abuse and is rejected outright. */
export const MAX_BEACON_BYTES = 4096;
const MAX_PATH_LEN = 200;

/** Parse + validate a raw beacon body. Returns null (→ 400) on any deviation. */
export function parseWebVital(raw: string): WebVitalSample | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > MAX_BEACON_BYTES) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
  const o = data as Record<string, unknown>;
  const name = o.name as WebVitalName;
  const rating = o.rating as WebVitalRating;
  if (!WEB_VITAL_NAMES.includes(name)) return null;
  if (!WEB_VITAL_RATINGS.includes(rating)) return null;
  if (typeof o.value !== "number" || !Number.isFinite(o.value) || o.value < 0) return null;
  if (typeof o.path !== "string" || !o.path.startsWith("/")) return null;
  // Defence in depth: even if a client sent a query string, it never survives.
  let path = o.path;
  const cut = path.search(/[?#]/);
  if (cut !== -1) path = path.slice(0, cut);
  return { name, value: o.value, rating, path: path.slice(0, MAX_PATH_LEN) };
}
