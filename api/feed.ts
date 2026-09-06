// Per-jurisdiction change-alert feed — data layer (no accounts, no PII, RSS/Atom only).
//
// THE PRODUCT IDEA: someone mid-process in Washington wants to know if OUR RECORDS for
// Washington change. An RSS/Atom feed lets them subscribe with zero personal data — no
// email signup, no account — which matters because this app's threat model is a user in
// a hostile jurisdiction (docs/audits/dpia.md).
//
// ── DATA-SOURCE DECISION (Option B — record-field-derived, not a generated manifest) ──
// This app runs on AWS Lambda with no git at runtime (the Dockerfile COPYs api/src/
// scripts/corpus/forms/public only — never `.git` — see Dockerfile), so feed content
// cannot be computed from `git log` when a request arrives. Two designs were open:
//
//   (a) Generate a committed manifest at BUILD time (a `make` target reading git history
//       of corpus/jurisdictions/*.json into e.g. corpus/changelog.json), plus a gate that
//       fails the build if it drifts from that history — the same shape as
//       corpus.manifest.json (Dockerfile RUN step) or docs/audits/coverage.md.
//   (b) Derive entries PURELY from fields already on each record: `source.last_verified`
//       is the date a named verifier last (re)confirmed it against its official source —
//       exactly the "did someone recheck this for me, and on what" signal a subscriber
//       wants. Group a jurisdiction's current records by that date; each distinct date is
//       one feed entry, honestly labelled as OUR verification history, never the law.
//
// This module takes (b). It is simpler, and — more importantly — it has NO artifact that
// can drift: there is no manifest to regenerate, no staleness gate to add, and nothing
// that needs `git` at build OR request time. The corpus itself (already merge-gated by
// `content`/`fidelity`/`freshness`) is the single source of truth for what the feed
// reports; a corpus edit changes the feed on its very next request, deterministically,
// with no extra build step. The trade-off, stated plainly: this can't show an edit that
// never moved a record's `last_verified` (a wording fix with no re-verification), and if
// a record's date is bumped again the PREVIOUS date's entry quietly loses that record
// (recomputed fresh from current state each time, not accumulated history) — acceptable
// here because a re-verification event, not prose churn, is the meaningful "this changed"
// signal for a reader deciding whether to re-check their plan.
//
// Deterministic under TEST_TODAY (api/freshness.ts): grouping is by the *recorded* date on
// each record, never today's date, so it needs no injected clock at all; `today` is only
// threaded through to flag which of those already-dated records are CURRENTLY degraded
// (freshnessOf), exactly like every other route in this app.

import type { CorpusRecord, DocumentType, JurisdictionId, Language } from "./types.ts";
import { loadCorpus } from "./corpus.ts";
import { freshnessOf } from "./freshness.ts";

/** Canonical document-type ordering for a feed entry's list (matches api/checklist.ts). */
const DOCUMENT_ORDER: readonly DocumentType[] = [
  "court-order",
  "ssa-card",
  "drivers-license",
  "passport",
  "birth-certificate",
  "financial-records",
];

/** Every jurisdiction id actually present in the corpus (any language), "US" included. */
export function knownFeedJurisdictions(corpus: CorpusRecord[] = loadCorpus()): JurisdictionId[] {
  return [...new Set(corpus.map((r) => r.jurisdiction))].sort();
}

/**
 * Is `id` a jurisdiction this app can serve a feed for? Checked against the CORPUS
 * itself, not just the `US`/`US-XX` shape api/router.ts's `validJurisdiction` allows —
 * a well-formed but uncovered id (e.g. a territory with no records yet) must 404, not
 * render an empty-looking feed for a place we say nothing about.
 */
export function isKnownJurisdiction(id: string, corpus: CorpusRecord[] = loadCorpus()): boolean {
  return corpus.some((r) => r.jurisdiction === id);
}

/** One dated update: every current record sharing a `source.last_verified` date. */
export interface FeedEntry {
  /** ISO date (YYYY-MM-DD) a named verifier last confirmed every record below. */
  date: string;
  /** Record ids sharing this date, sorted for a stable, deterministic render. */
  recordIds: string[];
  /** Distinct document types touched, in canonical order. */
  documentTypes: DocumentType[];
  /** True when at least one of these records is no longer serveable as current
   *  (past its freshness SLA or otherwise degraded) as of `today`. */
  degraded: boolean;
}

/**
 * The update history for one jurisdiction, in one language: every distinct
 * `source.last_verified` date among its corpus records, newest first, each flagged
 * `degraded` when a backing record is no longer serveable as current. A record's
 * verification date is a historical fact that doesn't change when it later goes
 * stale — so a record stays visible in its dated entry either way, honestly
 * annotated, rather than silently dropped once its freshness SLA lapses. See the
 * module header for why this is derived from record fields rather than git/manifest
 * history.
 */
export function buildJurisdictionFeed(
  jurisdiction: JurisdictionId,
  lang: Language,
  today?: string,
  corpus: CorpusRecord[] = loadCorpus(),
): FeedEntry[] {
  const records = corpus.filter((r) => r.jurisdiction === jurisdiction && r.language === lang);

  const byDate = new Map<string, CorpusRecord[]>();
  for (const r of records) {
    const list = byDate.get(r.source.last_verified);
    if (list) list.push(r);
    else byDate.set(r.source.last_verified, [r]);
  }

  const entries: FeedEntry[] = [];
  for (const [date, recs] of byDate) {
    entries.push({
      date,
      recordIds: recs.map((r) => r.id).sort(),
      documentTypes: DOCUMENT_ORDER.filter((d) => recs.some((r) => r.document_type === d)),
      degraded: recs.some((r) => !freshnessOf(r, today).current),
    });
  }
  entries.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)); // newest first
  return entries;
}
