// Source-fidelity gate (merge-blocking) — the missing bottom link in the citation chain.
//
// WHAT THE CITATION GATE ALREADY PROVES: every rendered claim resolves to a current
// corpus record (api/citation.ts, `make citation`), and — on the model path — that the
// claim's text is supported by THAT RECORD (eval/faithfulness.ts). Both are claim→record.
//
// WHAT NOTHING PROVED, UNTIL THIS GATE: that the RECORD is supported by ITS OWN CITED
// SOURCE. That is the bottom link, and it was missing. A record could assert a fee, a
// timeline, a form id, or a requirement that the page it cites never stated, and every
// gate in the pipeline stayed green — the answer was perfectly, verifiably cited to a
// record that was itself unsourced. That is not a hypothetical: the California DMV record
// asserted a paper form ("DL 329") and a $0 fee that its cited page never mentioned, and
// its normalized-text hash was UNCHANGED, so source-watch (which only detects *movement*,
// never *fit*) saw nothing. A human re-reading the page is what found it.
//
// WHAT THIS GATE DOES: for every corpus record, it re-reads the record's cited source —
// from a committed, offline snapshot (corpus/snapshots/) — and checks that the record's
// LOAD-BEARING assertions are actually locatable in that source text. Load-bearing means
// the things that hurt someone if wrong:
//
//   • money     — every fee the record states ($26, $12.50, "no fee"), structured and prose
//   • duration  — every timeline the record states (2–4 weeks, ten months, 3 business days)
//   • form-id   — every official form identifier the record names (VS 24B, MV-44NC, DL 329)
//   • requirement — a curated set of high-harm requirement topics (a court order is
//                   required, publication in a newspaper is required, an X marker exists,
//                   a notary is required, a fee waiver exists)
//
// HONESTY ABOUT WHAT IT CANNOT DO — read this before trusting a green run:
//
//   1. money/duration/form-id are LITERAL checks. They are normalized before comparison
//      (so "$435.00" matches "$435", "two to four weeks" matches "2–4 weeks", "NC-100"
//      matches "NC 100", "House Bill 229" matches "HB 229") and they are matched on
//      *extracted tokens*, never raw substrings — a raw substring search would "find" the
//      number 15 on every page that happens to contain it. A FAIL here is a real defect.
//      A PASS here means the literal appears in the source; it does NOT mean the source
//      says the same thing ABOUT that literal. "$26" appearing somewhere on the fee page
//      is not proof that $26 is the fee for THIS amendment.
//
//   2. requirement checks are NECESSARY-CONDITION checks only. They prove the source at
//      least *discusses* the topic the record asserts. They cannot prove the source
//      requires it. A record asserting "a court order is required", citing a page that
//      never says "court order", is caught. A record asserting the opposite of what the
//      page says, in a page that does discuss court orders, is NOT caught. This is
//      deliberate: a semantic-similarity judge here would quietly bless wrong records with
//      a number that looks like proof, which is worse than an honest gap.
//
//   3. Free prose is NOT verified at all. Every sentence that carries no extractable
//      literal is counted and reported as UNCHECKED PROSE, per record, in
//      docs/audits/source-fidelity.md. The blind spot is now measured instead of invisible.
//
//   4. A source the pipeline cannot fetch under its own declared user-agent (SSA and NY
//      Courts return 403 to any non-browser client; health.ny.gov WAFs it) has NO snapshot,
//      so every assertion in every record citing it is UNCHECKABLE — reported, never
//      passed. We do not spoof a browser user-agent to get around a site that has said no,
//      and we do not accept a hand-pasted snapshot: a snapshot whose provenance is "a human
//      pasted it" is a laundering path into a "verified" claim, which is the exact failure
//      docs/OPERATIONS.md warns about for `make source-baseline`.
//
// Anti-laundering: a snapshot's sha256 must equal the drift baseline already committed in
// corpus/source-hashes.json for the same URL (both are sha256 over the SAME normalize()
// output — scripts/source-watch.ts). So a snapshot cannot be edited to make this gate pass
// without breaking source-watch's baseline, which is human-review-only.
//
//   node scripts/source-fidelity.ts             # offline gate (CI)
//   node scripts/source-fidelity.ts --report    # also (re)write docs/audits/source-fidelity.md

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { loadCorpus, REPO_ROOT } from "../api/corpus.ts";
import { loadForms } from "../api/forms.ts";
import type { CorpusRecord, FormDef } from "../api/types.ts";
import { pass, fail } from "./util.ts";

export const SNAPSHOT_DIR = join(REPO_ROOT, "corpus", "snapshots");
export const SNAPSHOT_INDEX = join(SNAPSHOT_DIR, "index.json");
const BASELINE_PATH = join(REPO_ROOT, "corpus", "source-hashes.json");
const REPORT_MD = join(REPO_ROOT, "docs", "audits", "source-fidelity.md");
const REPORT_JSON = join(REPO_ROOT, "docs", "audits", "source-fidelity.json");

// ── Snapshot index ────────────────────────────────────────────────────────────────────

export interface SnapshotEntry {
  /** File under corpus/snapshots/, or null when the source could not be fetched. */
  file: string | null;
  /** ISO date the snapshot (or the unfetchable verdict) was taken. */
  fetched: string;
  /** sha256 over the stored normalized text — equals corpus/source-hashes.json for HTML. */
  sha256?: string;
  /** Set when the source refuses automated fetching under our declared user-agent. */
  unfetchable?: { status: string; note: string };
  /** Set for a source whose bytes are not HTML text (e.g. a PDF): no text to check against. */
  unextractable?: { reason: string };
}
export interface SnapshotIndex {
  _comment?: string;
  snapshots: Record<string, SnapshotEntry>;
}

export function loadSnapshotIndex(path: string = SNAPSHOT_INDEX): SnapshotIndex {
  if (!existsSync(path)) return { snapshots: {} };
  return JSON.parse(readFileSync(path, "utf8")) as SnapshotIndex;
}

export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/** Stable, human-legible snapshot filename for a URL. */
export function snapshotFileName(url: string): string {
  const digest = sha256(url).slice(0, 8);
  let host = "source";
  let path = "";
  try {
    const u = new URL(url);
    host = u.hostname.replace(/^www\./, "");
    path = u.pathname;
  } catch {
    /* fall through to the digest-only name */
  }
  const slug = `${host}${path}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
  return `${slug}-${digest}.txt`;
}

// ── Normalization primitives ──────────────────────────────────────────────────────────
// Every comparison below is token-level, never a raw substring scan. Substring matching is
// the classic false-confidence bug in a gate like this: `sourceText.includes("15")` is true
// for any page containing "2015", "$150", or a phone number, and it would have silently
// blessed the fee this gate exists to catch.

/** $1,234.50 → "1234.5"; $435.00 → "435"; 0 → "0". Currency/format noise removed. */
export function canonicalAmount(raw: string | number): string {
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? String(n) : String(raw);
}

const MONEY_RE = /\$\s?(\d[\d,]*(?:\.\d+)?)/g;
const BARE_MONEY_RE = /\b(\d[\d,]*(?:\.\d+)?)\s*(?:dollars?|d[óo]lares?)\b/gi;

/**
 * Official pages write durations as "three (3) business days" and "ten (10) months" —
 * the number word, then the digit in parentheses. Left alone, the parenthesis sits between
 * the digit and its unit and NO duration is extracted at all, so a perfectly well-sourced
 * record ("about 3 business days") reads as unsupported. Flattening brackets to spaces on
 * BOTH sides of the comparison is normalization, not interpretation: it is the same class
 * of fix as matching "$435.00" to "$435". It was found by this gate false-failing on
 * Washington, which is the failure mode worth being loudest about — a gate that cries wolf
 * gets switched off, and then it protects nobody.
 */
function flatten(text: string): string {
  return text.replace(/[()[\]]/g, " ");
}

/** Every money amount stated in `text`, canonicalized. */
export function extractMoney(text: string): string[] {
  const out: string[] = [];
  const flat = flatten(text);
  for (const re of [MONEY_RE, BARE_MONEY_RE]) {
    for (const m of flat.matchAll(re)) out.push(canonicalAmount(m[1] ?? ""));
  }
  return out;
}

/**
 * Phrases by which a source states that something is free. Both languages are always
 * checked against the source regardless of the record's language: Spanish records
 * routinely cite English-only official pages (that is the honest state of the corpus),
 * so the evidence may legitimately be in the other language.
 */
const FREE_EVIDENCE =
  /\b(?:no (?:fee|charge|cost)|free of charge|is free|are free|at no (?:cost|charge)|without (?:a )?(?:fee|charge)|does not charge|doesn['’]?t charge|no cobra|sin (?:costo|cargo)|gratis|gratuit[ao]s?|no hay (?:tarifa|costo|cargo))\b/i;

/** Does the source explicitly state that something is free (the honest reading of amount_usd: 0)? */
export function statesFree(sourceText: string): boolean {
  return FREE_EVIDENCE.test(sourceText) || extractMoney(sourceText).includes("0");
}

// Durations. Canonical form is `${n} ${unit}` with unit ∈ day|business-day|week|month|year,
// so "two to four weeks" (source) and "2–4 weeks" (record) both canonicalize to
// ["2 week", "4 week"], and "6–12 weeks" can never silently satisfy "2 to 3 months".
// Cross-unit equivalence is deliberately NOT performed: 12 weeks is not 3 months, and
// pretending it is would be the gate inventing a fact.
const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12,
  un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7,
  ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
};
const NUM_TOKEN = `\\d{1,3}|${Object.keys(NUMBER_WORDS).join("|")}`;
// Order matters: the multi-word units must be tried before their single-word suffixes,
// or "3 business days" degrades to "3 day" and stops being distinguishable.
const UNIT_ALTERNATION =
  "business\\s+days?|d[íi]as?\\s+h[áa]biles?|weeks?|semanas?|months?|meses|mes|years?|a[ñn]os?|days?|d[íi]as?";
const UNIT_CANON: [RegExp, string][] = [
  [/^business|^d[íi]as?\s+h[áa]bil/i, "business-day"],
  [/^week|^semana/i, "week"],
  [/^month|^mes/i, "month"],
  [/^year|^a[ñn]o/i, "year"],
  [/^day|^d[íi]a/i, "day"],
];
const DURATION_RE = new RegExp(
  `\\b(${NUM_TOKEN})\\s*(?:(?:-|–|—|to|a|or|y|and)\\s*(${NUM_TOKEN})\\s*)?(${UNIT_ALTERNATION})\\b`,
  "gi",
);

function canonicalUnit(raw: string): string | null {
  for (const [re, unit] of UNIT_CANON) if (re.test(raw.trim())) return unit;
  return null;
}
function canonicalCount(raw: string): number | null {
  const lower = raw.toLowerCase();
  if (/^\d+$/.test(lower)) return Number(lower);
  return NUMBER_WORDS[lower] ?? null;
}

/** Every duration stated in `text`, canonicalized (a range yields both endpoints). */
export function extractDurations(text: string): string[] {
  const out: string[] = [];
  for (const m of flatten(text).matchAll(DURATION_RE)) {
    const unit = canonicalUnit(m[3] ?? "");
    if (unit === null) continue;
    for (const raw of [m[1], m[2]]) {
      if (raw === undefined) continue;
      const n = canonicalCount(raw);
      if (n !== null) out.push(`${n} ${unit}`);
    }
  }
  return out;
}

// Form identifiers. The RECORD side is deliberately case-SENSITIVE (2–4 capitals + digits):
// official ids are written in capitals ("VS 24B", "MV-44NC", "DL 329"), while ordinary prose
// is not — without that, the Spanish record's "la Ley 229 de la Cámara" would be extracted as
// the form id "LEY229" and then demanded of an English source page, a pure false failure.
// The SOURCE side is case-insensitive, because normalize() lower-cases the page.
const RECORD_FORM_ID_RE = /\b([A-Z]{2,4})[\s-]?(\d{1,4}(?:-\d{1,4})?)([A-Z]{0,2})\b/g;
const SOURCE_FORM_ID_RE = /\b([a-z]{2,4})[\s-]?(\d{1,4}(?:-\d{1,4})?)([a-z]{0,2})\b/gi;

/**
 * Statute/bill abbreviations an official page routinely spells out in full. Expanding these
 * is normalization (like "$435.00" → "$435"), not semantic guessing: the Texas State Law
 * Library page says "House Bill 229" and the Spanish record says "HB 229". Refusing to match
 * those would be a false failure; guessing at meaning is what we will not do.
 */
const ID_EXPANSIONS: Record<string, string[]> = {
  HB: ["house bill"],
  SB: ["senate bill"],
  AB: ["assembly bill"],
  EO: ["executive order"],
};

function canonicalFormId(letters: string, digits: string, suffix: string): string {
  return `${letters}${digits}${suffix}`.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Form ids named in a corpus record's own prose (capitalized ids only — see above). */
export function extractRecordFormIds(text: string): string[] {
  return [...text.matchAll(RECORD_FORM_ID_RE)].map((m) =>
    canonicalFormId(m[1] ?? "", m[2] ?? "", m[3] ?? ""),
  );
}
/** Form ids present anywhere in a (lower-cased) source snapshot. */
export function extractSourceFormIds(text: string): string[] {
  return [...text.matchAll(SOURCE_FORM_ID_RE)].map((m) =>
    canonicalFormId(m[1] ?? "", m[2] ?? "", m[3] ?? ""),
  );
}

/** Is form id `id` (e.g. "VS24B") locatable in the source, allowing spelled-out statute names? */
export function sourceHasFormId(id: string, sourceText: string, sourceIds: Set<string>): boolean {
  if (sourceIds.has(id)) return true;
  const m = id.match(/^([A-Z]{2,4})(\d.*)$/);
  if (!m) return false;
  const expansions = ID_EXPANSIONS[m[1] ?? ""] ?? [];
  return expansions.some((phrase) => sourceText.includes(`${phrase} ${m[2]}`.toLowerCase()));
}

/**
 * The identifier(s) a forms-registry entry is known by. Taken from the registry title
 * first (authoritative: "Form DOH 422-143 — Request to Change Sex Designation…"), falling
 * back to the entry id ("wa-doh-422-143" → DOH422143). Some official forms have no
 * identifier at all (Illinois' "Affidavit and Certificate of Correction Request"); for
 * those there is nothing to match on, and the assertion is reported UNCHECKABLE rather
 * than passed.
 */
export function formIdCandidates(form: FormDef): string[] {
  const fromTitle = extractRecordFormIds(form.title);
  if (fromTitle.length > 0) return fromTitle;
  const idPart = form.id.replace(/^(?:us|ca|ny|il|tx|wa|ma)-/, "");
  return extractRecordFormIds(idPart.toUpperCase());
}

// ── Requirement families (NECESSARY-CONDITION checks — see the header) ────────────────
// `trigger` fires on a record that AFFIRMATIVELY asserts the requirement; `evidence` is the
// weakest thing the source must contain for the assertion to be even possible. A source that
// does not contain the evidence cannot support the assertion — that is all this proves, and
// the report labels every one of these as necessary-condition, never as verification.

export interface RequirementFamily {
  key: string;
  label: string;
  /** Fires on a record sentence that AFFIRMATIVELY asserts the requirement. */
  trigger: RegExp;
  /** The weakest thing the SOURCE must contain for that assertion to be even possible. */
  evidence: RegExp;
}

// Inflection matters and cost a false failure during development: `/\bcourt order\b/`
// does NOT match "court orders" (no word boundary before the "s"), so the Texas State Law
// Library page — which says "court orders" four times — read as having zero court-order
// content. Every pattern below is therefore written to tolerate the plural/participle.
const COURT_ORDER = /court[\s-]order|orden(?:es)? judicial/i;
// "X" alone is a letter that occurs in ordinary text, so it is only accepted next to a
// marker/designation word, or inside an M/F/X enumeration. Brackets are flattened first,
// so "M (male), F (female), and X" reads as an enumeration.
const X_MARKER =
  /\b(?:nonbinary|non-binary|no binario)\b|\bx\b[^.]{0,40}(?:marker|designation|gender|sex|category|marcador|designaci[óo]n|g[ée]nero|sexo)|(?:marker|designation|gender|sex|category|marcador|designaci[óo]n|g[ée]nero|sexo)[^.]{0,40}\bx\b|\bm\b[^.]{0,30}\bf\b[^.]{0,30}\bx\b/i;

export const REQUIREMENT_FAMILIES: RequirementFamily[] = [
  {
    key: "court-order-required",
    label: "a court order is required",
    trigger: COURT_ORDER,
    evidence: COURT_ORDER,
  },
  {
    key: "newspaper-publication",
    label: "publication in a newspaper is required",
    trigger: /newspaper|peri[óo]dico/i,
    evidence: /newspaper|publish|publication|peri[óo]dico|publicaci[óo]n/i,
  },
  {
    key: "x-marker-available",
    label: "an X sex/gender marker is available",
    trigger: X_MARKER,
    evidence: X_MARKER,
  },
  {
    key: "notarized",
    label: "a notarized signature is required",
    trigger: /notariz|notary|notario|notariad/i,
    evidence: /notariz|notary|notarial|notario|notariad/i,
  },
  {
    key: "background-check",
    label: "fingerprints / a criminal-history check are required",
    trigger: /fingerprint|background check|criminal[- ]history|huellas|antecedentes/i,
    evidence: /fingerprint|background check|criminal[- ]history|huellas|antecedentes/i,
  },
];

// Negation: a record sentence that DENIES a requirement ("you do not need a court order",
// "the guide no longer lists a newspaper step") must not be run through the affirmative
// necessary-condition check — presence of the keyword in the source neither supports nor
// refutes it. Those sentences are counted and reported as unverifiable-negation, which is
// exactly the class of claim a mechanical gate must not pretend to have checked.
const NEGATION_RE =
  /\b(?:no|not|never|without|cannot|can['’]?t|don['’]?t|does\s?n['’]?t|doesn['’]?t|no longer|is not|are not|nothing|neither|nor|sin|ya no|no (?:se|es|hay|tiene|necesita|acepta|indica|dice|pide|list)|tampoco|ninguna|ning[úu]n)\b/i;

export function isNegated(sentence: string): boolean {
  return NEGATION_RE.test(sentence);
}

/** Split prose into sentence-ish units for the negation / unchecked-prose accounting. */
export function sentences(text: string): string[] {
  return text
    .split(/(?<!\b(?:no|vs|ss|dr|mr|ms|u\.s))[.;]\s+/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// ── Assertions ────────────────────────────────────────────────────────────────────────

/**
 * Where-you-live evidence, for the `relocation.residency_bound` annotation. api/corpus.ts
 * already refuses that annotation unless the RECORD'S OWN PROSE says the action happens
 * where you live — and api/types.ts explains the intent: "the annotation may only restate
 * what the cited source already says". But nothing checked the SOURCE. That is this whole
 * bug class in miniature: the guard validated the claim against the claim. The annotation
 * drives the relocation planner's `origin-window-closes` hazard — "this route closes the
 * day you stop being a resident" — which is the single most consequential thing the planner
 * says, so it is checked here against the source itself.
 */
const RESIDENCY_EVIDENCE =
  /where you (?:live|reside)|county (?:where|in which) you (?:live|reside)|county where you|donde (?:usted )?(?:vive|reside)|condado donde/i;

export type AssertionKind =
  | "money"
  | "duration"
  | "form-id"
  | "requirement"
  | "fee-waiver"
  | "residency";
export type Verdict = "supported" | "unsupported" | "uncheckable";
/** literal: an extracted token must occur in the source. necessary-condition: topic presence only. */
export type Strength = "literal" | "necessary-condition";

export interface Assertion {
  kind: AssertionKind;
  /** Canonical key compared against the source (e.g. "435", "6 week", "VS24B"). */
  key: string;
  /** What the record asserts, in words, for the report. */
  label: string;
  /** Which record field it was asserted in. */
  field: string;
  strength: Strength;
}

export interface AssertionResult extends Assertion {
  verdict: Verdict;
  why: string;
}

export interface RecordAudit {
  recordId: string;
  language: string;
  url: string;
  results: AssertionResult[];
  /** Sentences carrying no extractable literal — the gate vouches for none of them. */
  uncheckedProse: number;
  /** Sentences that DENY something ("no court order is needed") — not mechanically checkable. */
  negatedClaims: number;
  /** Total sentences in statement + detail. */
  totalSentences: number;
}

/** The record fields that render to a user under this record's citation. */
function proseFields(rec: CorpusRecord): { field: string; text: string }[] {
  const out = [{ field: "statement", text: rec.statement }];
  if (rec.detail) out.push({ field: "detail", text: rec.detail });
  if (rec.cost?.note) out.push({ field: "cost.note", text: rec.cost.note });
  if (rec.timeline?.typical) out.push({ field: "timeline.typical", text: rec.timeline.typical });
  if (rec.timeline?.note) out.push({ field: "timeline.note", text: rec.timeline.note });
  return out;
}

/**
 * Every load-bearing assertion a record makes. Structured fields first (they are the
 * highest-value target and the only ones that can be checked with real confidence), then
 * the literals embedded in the record's prose — because prose that names "$480" or
 * "Form DL 329" is making exactly the same load-bearing claim as the structured field,
 * and renders to the user under exactly the same citation.
 */
export function extractAssertions(rec: CorpusRecord, forms: FormDef[]): Assertion[] {
  const out: Assertion[] = [];
  const seen = new Set<string>();
  const add = (a: Assertion): void => {
    const dedupe = `${a.kind}:${a.key}`;
    if (seen.has(dedupe)) return;
    seen.add(dedupe);
    out.push(a);
  };

  // Structured cost.
  if (rec.cost && rec.cost.amount_usd !== null && rec.cost.amount_usd !== undefined) {
    const amount = rec.cost.amount_usd;
    add({
      kind: "money",
      key: canonicalAmount(amount),
      label: amount === 0 ? "this step is free (amount_usd: 0)" : `costs $${amount}`,
      field: "cost.amount_usd",
      strength: "literal",
    });
  }
  if (rec.cost?.fee_waiver === true) {
    add({
      kind: "fee-waiver",
      key: "fee-waiver",
      label: "a fee waiver is available (cost.fee_waiver: true)",
      field: "cost.fee_waiver",
      strength: "necessary-condition",
    });
  }
  if (rec.relocation?.residency_bound === true) {
    add({
      kind: "residency",
      key: "residency-bound",
      label: "this action happens where you live, so the route closes when you move",
      field: "relocation.residency_bound",
      strength: "necessary-condition",
    });
  }

  // Structured form reference — it renders as "the official form for this step".
  if (rec.form_ref) {
    const form = forms.find((f) => f.id === rec.form_ref);
    const candidates = form ? formIdCandidates(form) : [];
    if (!form) {
      add({
        kind: "form-id",
        key: rec.form_ref.toUpperCase(),
        label: `form_ref "${rec.form_ref}" is not in the forms registry`,
        field: "form_ref",
        strength: "literal",
      });
    } else if (candidates.length === 0) {
      add({
        kind: "form-id",
        key: `unnamed:${form.id}`,
        label: `form_ref "${form.id}" (${form.title}) carries no form identifier to match on`,
        field: "form_ref",
        strength: "literal",
      });
    } else {
      for (const id of candidates) {
        add({
          kind: "form-id",
          key: id,
          label: `official form ${id} backs this step (form_ref: ${form.id})`,
          field: "form_ref",
          strength: "literal",
        });
      }
    }
  }

  // Prose literals + requirement topics.
  for (const { field, text } of proseFields(rec)) {
    for (const amount of extractMoney(text)) {
      add({ kind: "money", key: amount, label: `states $${amount}`, field, strength: "literal" });
    }
    for (const duration of extractDurations(text)) {
      add({ kind: "duration", key: duration, label: `states "${duration}"`, field, strength: "literal" });
    }
    for (const id of extractRecordFormIds(text)) {
      add({ kind: "form-id", key: id, label: `names form ${id}`, field, strength: "literal" });
    }
    for (const family of REQUIREMENT_FAMILIES) {
      // Only AFFIRMATIVE assertions. A sentence that denies the requirement is accounted
      // for separately (negatedClaims) and never silently passed.
      const affirmative = sentences(text).some(
        (s) => family.trigger.test(flatten(s)) && !isNegated(s),
      );
      if (affirmative) {
        add({
          kind: "requirement",
          key: family.key,
          label: family.label,
          field,
          strength: "necessary-condition",
        });
      }
    }
  }
  return out;
}

export interface SourceView {
  text: string;
  /** Brackets flattened to spaces — see flatten(). Requirement patterns run against this. */
  flatText: string;
  moneyTokens: Set<string>;
  durationTokens: Set<string>;
  formIds: Set<string>;
}

/** Pre-tokenize a source snapshot once, so every record citing it is checked against tokens. */
export function viewOf(text: string): SourceView {
  return {
    text,
    flatText: flatten(text),
    moneyTokens: new Set(extractMoney(text)),
    durationTokens: new Set(extractDurations(text)),
    formIds: new Set(extractSourceFormIds(text)),
  };
}

export function checkAssertion(a: Assertion, view: SourceView): AssertionResult {
  const supported = (why: string): AssertionResult => ({ ...a, verdict: "supported", why });
  const unsupported = (why: string): AssertionResult => ({ ...a, verdict: "unsupported", why });

  switch (a.kind) {
    case "money": {
      if (a.key === "0") {
        return statesFree(view.text)
          ? supported("the source states there is no fee")
          : unsupported("the record says this is free; the source never states it is free");
      }
      return view.moneyTokens.has(a.key)
        ? supported(`the source states $${a.key}`)
        : unsupported(`$${a.key} does not appear anywhere in the source`);
    }
    case "duration":
      return view.durationTokens.has(a.key)
        ? supported(`the source states "${a.key}"`)
        : unsupported(`"${a.key}" does not appear anywhere in the source`);
    case "form-id": {
      if (a.key.startsWith("unnamed:")) {
        return { ...a, verdict: "uncheckable", why: "the official form has no identifier to match on" };
      }
      return sourceHasFormId(a.key, view.text, view.formIds)
        ? supported(`the source names ${a.key}`)
        : unsupported(`the source never names ${a.key}`);
    }
    case "fee-waiver":
      return /waiv\w*|exenci[óo]n|exent\w*|inability to afford|cannot afford|can['’]?t afford|unable to pay|no puede pagar/i.test(
        view.flatText,
      )
        ? supported("the source describes a fee waiver / inability-to-pay route")
        : unsupported("the record claims a fee waiver; the source never mentions one");
    case "residency":
      return RESIDENCY_EVIDENCE.test(view.flatText)
        ? supported("the source itself conditions the action on where you live")
        : unsupported(
            "the record claims the route is residency-bound (and the relocation planner warns the door " +
              "closes when you move); the cited source never says the action happens where you live",
          );
    case "requirement": {
      const family = REQUIREMENT_FAMILIES.find((f) => f.key === a.key);
      if (!family) return { ...a, verdict: "uncheckable", why: "unknown requirement family" };
      return family.evidence.test(view.flatText)
        ? supported("the source discusses this topic (necessary condition only — NOT verified)")
        : unsupported("the source never mentions this topic at all");
    }
    default:
      return { ...a, verdict: "uncheckable", why: "unknown assertion kind" };
  }
}

/** Audit one record against its source snapshot. `view === null` means no snapshot exists. */
export function auditRecord(
  rec: CorpusRecord,
  view: SourceView | null,
  forms: FormDef[],
  uncheckableReason = "the cited source has no snapshot",
): RecordAudit {
  const assertions = extractAssertions(rec, forms);
  const results: AssertionResult[] = view
    ? assertions.map((a) => checkAssertion(a, view))
    : assertions.map((a) => ({ ...a, verdict: "uncheckable" as const, why: uncheckableReason }));

  const prose = sentences(`${rec.statement} ${rec.detail ?? ""}`);
  let unchecked = 0;
  let negated = 0;
  for (const s of prose) {
    if (isNegated(s)) negated++;
    const hasLiteral =
      extractMoney(s).length > 0 || extractDurations(s).length > 0 || extractRecordFormIds(s).length > 0;
    if (!hasLiteral) unchecked++;
  }

  return {
    recordId: rec.id,
    language: rec.language,
    url: rec.source.url,
    results,
    uncheckedProse: unchecked,
    negatedClaims: negated,
    totalSentences: prose.length,
  };
}

// ── Whole-corpus audit ────────────────────────────────────────────────────────────────

export interface FidelityReport {
  audits: RecordAudit[];
  /** URLs cited by a record with NO entry in the snapshot index at all — a hard failure. */
  missingSnapshots: string[];
  /** Snapshot files whose bytes no longer hash to the index (tampered or corrupted). */
  tamperedSnapshots: string[];
  /** Snapshots that disagree with the committed source-watch baseline for the same URL. */
  baselineMismatches: string[];
  /** Snapshotted URLs with no drift baseline — the snapshot is real but nothing watches it. */
  unbaselined: string[];
  /** URLs recorded as unfetchable (403 / no automated access) — reported, never passed. */
  unfetchable: string[];
  supported: number;
  unsupported: number;
  uncheckable: number;
}

export function auditCorpus(
  corpus: CorpusRecord[],
  forms: FormDef[],
  index: SnapshotIndex,
  opts: { snapshotDir?: string; baseline?: Record<string, string> } = {},
): FidelityReport {
  const dir = opts.snapshotDir ?? SNAPSHOT_DIR;
  const baseline = opts.baseline ?? {};
  const views = new Map<string, SourceView | null>();
  const reasons = new Map<string, string>();
  const missingSnapshots: string[] = [];
  const tamperedSnapshots: string[] = [];
  const baselineMismatches: string[] = [];
  const unbaselined: string[] = [];
  const unfetchable: string[] = [];

  const citedUrls = [...new Set(corpus.map((r) => r.source.url))];
  for (const url of citedUrls) {
    const entry = index.snapshots[url];
    if (!entry) {
      missingSnapshots.push(url);
      views.set(url, null);
      reasons.set(url, "no snapshot entry — run `make source-snapshot` and review the diff");
      continue;
    }
    if (entry.unfetchable) {
      unfetchable.push(`${url} → ${entry.unfetchable.status}: ${entry.unfetchable.note}`);
      views.set(url, null);
      reasons.set(url, `the source refuses automated fetching (${entry.unfetchable.status})`);
      continue;
    }
    if (entry.unextractable || entry.file === null) {
      views.set(url, null);
      reasons.set(url, entry.unextractable?.reason ?? "no snapshot file");
      continue;
    }
    const path = join(dir, entry.file);
    if (!existsSync(path)) {
      missingSnapshots.push(`${url} → indexed file ${entry.file} is not on disk`);
      views.set(url, null);
      reasons.set(url, "the indexed snapshot file is missing");
      continue;
    }
    const text = readFileSync(path, "utf8");
    const digest = sha256(text);
    if (entry.sha256 && digest !== entry.sha256) {
      // Someone edited the snapshot. That is the laundering path this check exists to close.
      tamperedSnapshots.push(`${entry.file} → sha256 ${digest.slice(0, 12)} ≠ indexed ${entry.sha256.slice(0, 12)}`);
    }
    const committed = baseline[url];
    if (committed === undefined) {
      // A snapshot with no drift baseline is a source nothing watches: this gate would keep
      // checking the record against a frozen copy of a page that has since moved, and report
      // "supported" forever. The two mechanisms are only safe together.
      unbaselined.push(`${url} → snapshotted but absent from corpus/source-hashes.json`);
    } else if (committed !== digest) {
      baselineMismatches.push(
        `${url} → snapshot ${digest.slice(0, 12)} ≠ source-watch baseline ${committed.slice(0, 12)}`,
      );
    }
    views.set(url, viewOf(text));
  }

  const audits = corpus.map((rec) =>
    auditRecord(rec, views.get(rec.source.url) ?? null, forms, reasons.get(rec.source.url) ?? "no snapshot"),
  );

  let supported = 0;
  let unsupported = 0;
  let uncheckable = 0;
  for (const a of audits) {
    for (const r of a.results) {
      if (r.verdict === "supported") supported++;
      else if (r.verdict === "unsupported") unsupported++;
      else uncheckable++;
    }
  }

  return {
    audits,
    missingSnapshots,
    tamperedSnapshots,
    baselineMismatches,
    unbaselined,
    unfetchable: [...new Set(unfetchable)],
    supported,
    unsupported,
    uncheckable,
  };
}

// ── Report ────────────────────────────────────────────────────────────────────────────

export function renderReport(report: FidelityReport): string {
  const unsupported = report.audits.flatMap((a) =>
    a.results.filter((r) => r.verdict === "unsupported").map((r) => ({ a, r })),
  );
  const uncheckableByReason = new Map<string, string[]>();
  for (const a of report.audits) {
    for (const r of a.results.filter((x) => x.verdict === "uncheckable")) {
      const list = uncheckableByReason.get(r.why) ?? [];
      list.push(`${a.recordId} · ${r.label}`);
      uncheckableByReason.set(r.why, list);
    }
  }
  const totalProse = report.audits.reduce((n, a) => n + a.totalSentences, 0);
  const uncheckedProse = report.audits.reduce((n, a) => n + a.uncheckedProse, 0);
  const negated = report.audits.reduce((n, a) => n + a.negatedClaims, 0);
  const checked = report.supported + report.unsupported;
  const total = checked + report.uncheckable;
  const literal = report.audits.flatMap((a) => a.results).filter((r) => r.strength === "literal" && r.verdict !== "uncheckable").length;
  const weak = report.audits.flatMap((a) => a.results).filter((r) => r.strength === "necessary-condition" && r.verdict !== "uncheckable").length;

  const lines: string[] = [];
  lines.push("# Source-fidelity coverage");
  lines.push("");
  lines.push("> Generated by `make fidelity` (`scripts/source-fidelity.ts`). Do not hand-edit.");
  lines.push(">");
  lines.push("> **What this measures:** whether each corpus record's load-bearing assertions are");
  lines.push("> locatable in the source the record itself cites. This is the link the citation gate");
  lines.push("> does not check: `make citation` proves an answer cites a record, not that the record");
  lines.push("> matches its source. **A green run here is not a verification of the corpus** — read");
  lines.push("> the \"cannot vouch for\" section, which is the honest measure of what remains unchecked.");
  lines.push("");
  lines.push("## Totals");
  lines.push("");
  lines.push("| | Count |");
  lines.push("|---|---|");
  lines.push(`| Records audited | ${report.audits.length} |`);
  lines.push(`| Load-bearing assertions found | ${total} |`);
  lines.push(`| — checked and **supported** by the cited source | ${report.supported} |`);
  lines.push(`| — checked and **UNSUPPORTED** (merge-blocking) | ${report.unsupported} |`);
  lines.push(`| — **UNCHECKABLE** (reported, never passed) | ${report.uncheckable} |`);
  lines.push(`| of the checked: literal (fee / duration / form-id) matches | ${literal} |`);
  lines.push(`| of the checked: necessary-condition only (topic present, wording NOT verified) | ${weak} |`);
  lines.push("");
  lines.push("## What this gate cannot vouch for");
  lines.push("");
  lines.push(`- **${uncheckedProse} of ${totalProse} prose sentences** in the corpus carry no extractable`);
  lines.push("  literal (no fee, duration, or form id). Nothing in CI checks them against the source.");
  lines.push("  They are read by a human or they are not read at all.");
  lines.push(`- **${negated} sentences state a negative** (\`you do not need a court order\`, \`the page no`);
  lines.push("  longer lists a form`). A keyword check cannot verify an absence, so these are never");
  lines.push("  passed as supported — they are counted here and left to human review.");
  lines.push(`- **${weak} assertions are necessary-condition only**: the source discusses the topic, which`);
  lines.push("  is the weakest possible evidence. It rules out the `cites a page with zero content on");
  lines.push("  this subject` bug. It does not rule out a record that says the opposite of its source.");
  if (report.unfetchable.length > 0) {
    lines.push(`- **${report.unfetchable.length} cited sources refuse automated fetching entirely**, so no`);
    lines.push("  snapshot exists and every assertion in every record citing them is unverifiable by any");
    lines.push("  gate. We will not spoof a browser user-agent to get around a site that has said no.");
    for (const u of report.unfetchable) lines.push(`  - ${u}`);
  }
  lines.push("");

  lines.push("## Unsupported assertions (these fail the build)");
  lines.push("");
  if (unsupported.length === 0) {
    lines.push("None. Every load-bearing assertion the gate could check is locatable in its cited source.");
  } else {
    lines.push("| Record | Field | Assertion | Why |");
    lines.push("|---|---|---|---|");
    for (const { a, r } of unsupported) {
      lines.push(`| \`${a.recordId}\` | ${r.field} | ${r.label} | ${r.why} |`);
    }
  }
  lines.push("");

  lines.push("## Uncheckable assertions (reported, never passed)");
  lines.push("");
  if (uncheckableByReason.size === 0) {
    lines.push("None.");
  } else {
    for (const [why, items] of [...uncheckableByReason].sort((a, b) => b[1].length - a[1].length)) {
      lines.push(`**${why}** — ${items.length} assertion(s):`);
      lines.push("");
      for (const item of items) lines.push(`- \`${item}\``);
      lines.push("");
    }
  }

  lines.push("## Per-record coverage");
  lines.push("");
  lines.push("| Record | Lang | Supported | Unsupported | Uncheckable | Unchecked prose |");
  lines.push("|---|---|---|---|---|---|");
  for (const a of [...report.audits].sort((x, y) => x.recordId.localeCompare(y.recordId))) {
    const s = a.results.filter((r) => r.verdict === "supported").length;
    const u = a.results.filter((r) => r.verdict === "unsupported").length;
    const k = a.results.filter((r) => r.verdict === "uncheckable").length;
    lines.push(
      `| \`${a.recordId}\` | ${a.language} | ${s} | ${u === 0 ? "0" : `**${u}**`} | ${k} | ${a.uncheckedProse}/${a.totalSentences} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

// ── Gate ──────────────────────────────────────────────────────────────────────────────

function main(): void {
  // Test-only overrides (tests/gate-efficacy), mirroring the other gates: unset env →
  // identical production behavior.
  const corpusDir = process.env.CORPUS_DIR;
  const indexPath = process.env.FIDELITY_INDEX ?? SNAPSHOT_INDEX;
  const snapshotDir = process.env.FIDELITY_SNAPSHOT_DIR ?? SNAPSHOT_DIR;
  const baselinePath = process.env.FIDELITY_BASELINE ?? BASELINE_PATH;

  const corpus = loadCorpus(corpusDir ? { dir: corpusDir } : {});
  const forms = loadForms();
  const index = loadSnapshotIndex(indexPath);
  const baseline: Record<string, string> = existsSync(baselinePath)
    ? (JSON.parse(readFileSync(baselinePath, "utf8")) as Record<string, string>)
    : {};

  const report = auditCorpus(corpus, forms, index, { snapshotDir, baseline });

  if (process.argv.includes("--report") || process.env.FIDELITY_WRITE_REPORT === "1") {
    writeFileSync(REPORT_MD, renderReport(report));
    writeFileSync(
      REPORT_JSON,
      JSON.stringify(
        {
          generated_by: "scripts/source-fidelity.ts",
          records: report.audits.length,
          supported: report.supported,
          unsupported: report.unsupported,
          uncheckable: report.uncheckable,
          unfetchable_sources: report.unfetchable,
          unchecked_prose_sentences: report.audits.reduce((n, a) => n + a.uncheckedProse, 0),
          total_prose_sentences: report.audits.reduce((n, a) => n + a.totalSentences, 0),
          audits: report.audits,
        },
        null,
        2,
      ) + "\n",
    );
  }

  const blocking: string[] = [
    ...report.missingSnapshots.map((m) => `missing-snapshot: ${m}`),
    ...report.tamperedSnapshots.map((m) => `TAMPERED SNAPSHOT: ${m}`),
    ...report.baselineMismatches.map((m) => `baseline-mismatch: ${m}`),
    ...report.unbaselined.map((m) => `unwatched-snapshot: ${m}`),
    ...report.audits.flatMap((a) =>
      a.results
        .filter((r) => r.verdict === "unsupported")
        .map((r) => `${a.recordId} · ${r.field}: ${r.label} — ${r.why}`),
    ),
  ];

  // Honest-confidence: what the gate could NOT check is printed on every run, pass or fail.
  // A gate that silently passes what it cannot verify is worse than no gate, because it
  // will be trusted.
  if (report.uncheckable > 0) {
    console.log(
      `  ℹ️  ${report.uncheckable} assertion(s) UNCHECKABLE (not passed, not failed) — see docs/audits/source-fidelity.md`,
    );
    for (const u of report.unfetchable) console.log(`     · unfetchable source: ${u}`);
  }
  const uncheckedProse = report.audits.reduce((n, a) => n + a.uncheckedProse, 0);
  const totalProse = report.audits.reduce((n, a) => n + a.totalSentences, 0);
  console.log(
    `  ℹ️  ${uncheckedProse}/${totalProse} prose sentences carry no checkable literal — this gate vouches for NONE of them.`,
  );

  if (blocking.length > 0) {
    fail(
      "fidelity",
      `${blocking.length} record assertion(s) not supported by their cited source`,
      blocking,
    );
  }
  pass(
    "fidelity",
    `${report.supported} load-bearing assertion(s) across ${report.audits.length} records located in their cited source (${report.uncheckable} uncheckable, reported)`,
  );
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) main();
