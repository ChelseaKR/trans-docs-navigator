// EN/ES linkage (#229 item 1).
//
// The pairing in the corpus is correct today: 344 English records, 344 Spanish records,
// a clean 1:1 match, zero orphans. It is correct by care alone, and care does not fail a
// build. Nothing required an English record to have a Spanish twin, required a Spanish
// record to name a real English canonical, or required the two sides to agree on the
// facts that are about the rule rather than about the language.
//
// These tests are written from the other side: each one puts a specific divergence into
// a small corpus and asserts the gate names it. If any of them can be made to pass with
// the check removed, the check is decoration.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadCorpus } from "../api/corpus.ts";
import {
  auditTranslations,
  canonicalIdOf,
  declaredUntranslated,
  sameSourceHost,
  translationIdFor,
  twinIssues,
} from "../api/translations.ts";
import type { CorpusRecord } from "../api/types.ts";

function record(over: Partial<CorpusRecord> & { id: string }): CorpusRecord {
  return {
    jurisdiction: "US-CA",
    document_type: "court-order",
    change_type: ["name"],
    topic: "court-ordered name change",
    statement: "File a petition for change of name with the superior court in your county.",
    source: {
      url: "https://selfhelp.courts.ca.gov/name-change",
      title: "California Courts Self-Help",
      last_verified: "2026-07-13",
      verifier: "Pilot Seed Reviewer",
    },
    verification_status: "verified",
    recheck_sla_days: 90,
    language: "en",
    ...over,
  } as CorpusRecord;
}

/** A canonical and a faithful translation of it. */
function pair(over: Partial<CorpusRecord> = {}): [CorpusRecord, CorpusRecord] {
  const canonical = record({ id: "ca.court-order.name" });
  const translation = record({
    id: "ca.court-order.name.es",
    language: "es",
    statement: "Presente una peticion de cambio de nombre.",
    ...over,
  });
  return [canonical, translation];
}

// ── the corpus as it stands ──────────────────────────────────────────────────

test("the real corpus is fully linked, with no orphan and no undeclared gap", () => {
  const audit = auditTranslations(loadCorpus(), declaredUntranslated());
  assert.deepEqual(audit.issues, []);
  assert.deepEqual(audit.undeclaredGaps, []);
  assert.deepEqual(audit.staleDeclarations, []);
  // The measured shape this gate was built to hold in place. Pinned as a literal so a
  // record added on one side only moves this number and has to be explained.
  assert.equal(audit.links.length, 344);
});

test("the three Spanish records that cite a Spanish official page are not drift", () => {
  // Real cases: ca.court-order.name, ca.court-order.gender-marker and us.passport.name
  // each cite the same agency's Spanish-language page. Better sourcing, not divergence,
  // and a host-level check is what tells the two apart.
  const corpus = loadCorpus();
  const byId = new Map(corpus.map((r) => [r.id, r]));
  let differingPaths = 0;
  for (const translation of corpus.filter((r) => r.language === "es")) {
    const canonical = byId.get(canonicalIdOf(translation)!);
    assert.ok(canonical, `${translation.id} has no canonical`);
    if (canonical.source.url !== translation.source.url) {
      differingPaths += 1;
      assert.ok(
        sameSourceHost(canonical, translation),
        `${translation.id} cites a different host from its canonical`,
      );
    }
  }
  assert.equal(differingPaths, 3);
});

// ── linkage ─────────────────────────────────────────────────────────────────

test("canonicalIdOf strips the suffix, and English records claim no canonical", () => {
  assert.equal(canonicalIdOf({ id: "ca.court-order.name.es", language: "es" }), "ca.court-order.name");
  assert.equal(canonicalIdOf({ id: "ca.court-order.name", language: "en" }), null);
  assert.equal(canonicalIdOf({ id: "ca.court-order.name", language: "es" }), null);
  assert.equal(translationIdFor("ca.court-order.name", "es"), "ca.court-order.name.es");
  assert.equal(translationIdFor("ca.court-order.name", "en"), "ca.court-order.name");
});

test("a Spanish record naming no canonical is refused", () => {
  const [canonical] = pair();
  const stray = record({ id: "ca.court-order.stray", language: "es" });
  const audit = auditTranslations([canonical, stray], new Set(["ca.court-order.name"]));
  assert.equal(audit.issues.length, 1);
  assert.equal(audit.issues[0]!.recordId, "ca.court-order.stray");
  assert.match(audit.issues[0]!.message, /names no English canonical|does not end in/);
});

test("a Spanish record whose canonical is not in the corpus is refused as an orphan", () => {
  const orphan = record({ id: "ca.court-order.gone.es", language: "es" });
  const audit = auditTranslations([orphan]);
  assert.equal(audit.issues.length, 1);
  assert.equal(audit.issues[0]!.field, "id");
  assert.match(audit.issues[0]!.message, /is not in the corpus/);
  assert.match(audit.issues[0]!.message, /nothing checks or re-verifies it/);
});

// ── the gap has to be written down, not merely absent ───────────────────────

test("an English record with no twin and no declaration is a failure", () => {
  const [canonical] = pair();
  const audit = auditTranslations([canonical]);
  assert.deepEqual(audit.undeclaredGaps, ["ca.court-order.name"]);
  assert.deepEqual(audit.declaredGaps, []);
});

test("a declared gap is a stated fact, not a failure", () => {
  const [canonical] = pair();
  const audit = auditTranslations([canonical], new Set(["ca.court-order.name"]));
  assert.deepEqual(audit.undeclaredGaps, []);
  assert.deepEqual(audit.declaredGaps, ["ca.court-order.name"]);
  assert.deepEqual(audit.issues, []);
});

test("a declaration for a record that HAS been translated is stale and fails", () => {
  const [canonical, translation] = pair();
  const audit = auditTranslations(
    [canonical, translation],
    new Set(["ca.court-order.name"]),
  );
  assert.deepEqual(audit.staleDeclarations, ["ca.court-order.name"]);
  assert.deepEqual(audit.undeclaredGaps, []);
});

test("an unreadable declaration file yields an EMPTY set, never a permissive one", () => {
  // The failure direction matters. A declaration nobody can read must make the gate
  // stricter -- every gap becomes undeclared and fails -- not silently excuse every gap
  // it was supposed to account for.
  const dir = mkdtempSync(join(tmpdir(), "tdn-translation-status-"));
  assert.equal(declaredUntranslated(join(dir, "does-not-exist.json")).size, 0);

  const broken = join(dir, "broken.json");
  writeFileSync(broken, "{not json", "utf8");
  assert.equal(declaredUntranslated(broken).size, 0);

  const wrongShape = join(dir, "wrong.json");
  writeFileSync(wrongShape, JSON.stringify({ untranslated: "all of them" }), "utf8");
  assert.equal(declaredUntranslated(wrongShape).size, 0);

  const good = join(dir, "good.json");
  writeFileSync(good, JSON.stringify({ untranslated: ["a.b.c", 7, "d.e.f"] }), "utf8");
  assert.deepEqual([...declaredUntranslated(good)].sort(), ["a.b.c", "d.e.f"]);
});

test("the committed declaration file parses and is currently empty", () => {
  assert.equal(declaredUntranslated().size, 0);
});

// ── the two sides must agree on what is a fact about the rule ───────────────

test("a mirrored field that disagrees is named, field by field", () => {
  const cases: [Partial<CorpusRecord>, string][] = [
    [{ jurisdiction: "US-NY" }, "jurisdiction"],
    [{ document_type: "passport" }, "document_type"],
    [{ change_type: ["gender-marker"] }, "change_type"],
    [{ verification_status: "needs_reverification" }, "verification_status"],
    [{ recheck_sla_days: 30 }, "recheck_sla_days"],
    [{ audience: "minor" }, "audience"],
    [{ form_ref: "ca-nc-100" }, "form_ref"],
  ];
  for (const [override, field] of cases) {
    const [canonical, translation] = pair(override);
    const issues = twinIssues(canonical, translation);
    assert.equal(issues.length, 1, `${field}: expected exactly one issue`);
    assert.equal(issues[0]!.field, field);
    assert.match(issues[0]!.message, /fact about the rule, not about the language/);
  }
});

test("a field set on one side and unset on the other is a disagreement", () => {
  // "(unset)" vs a value has to read as drift, or a translation could quietly drop the
  // form its English canonical hands the reader.
  const [canonical, translation] = pair();
  const withForm = { ...canonical, form_ref: "ca-nc-100" } as CorpusRecord;
  const issues = twinIssues(withForm, translation);
  assert.equal(issues.length, 1);
  assert.equal(issues[0]!.field, "form_ref");
});

test("a translation may not carry its own verification date", () => {
  const [canonical, translation] = pair({
    source: {
      url: "https://selfhelp.courts.ca.gov/name-change",
      title: "T",
      last_verified: "2026-01-01",
      verifier: "Pilot Seed Reviewer",
    },
  });
  const issues = twinIssues(canonical, translation);
  assert.equal(issues.length, 1);
  assert.equal(issues[0]!.field, "source.last_verified");
  assert.match(issues[0]!.message, /inherits verification from the English source check/);
});

test("the same agency's Spanish page is allowed; a different agency is not", () => {
  const [canonical, spanishPage] = pair({
    source: {
      url: "https://selfhelp.courts.ca.gov/es/cambie-su-nombre-en-california",
      title: "Ayuda Legal",
      last_verified: "2026-07-13",
      verifier: "Pilot Seed Reviewer",
    },
  });
  assert.deepEqual(twinIssues(canonical, spanishPage), []);

  const [, elsewhere] = pair({
    source: {
      url: "https://example.org/name-change",
      title: "Somewhere else",
      last_verified: "2026-07-13",
      verifier: "Pilot Seed Reviewer",
    },
  });
  const issues = twinIssues(canonical, elsewhere);
  assert.equal(issues.length, 1);
  assert.equal(issues[0]!.field, "source.url");
  assert.match(issues[0]!.message, /different agency is not/);
});

test("an unparseable URL is not a host match", () => {
  // Answering "yes, same host" from two values we could not read would turn a broken URL
  // into a passing check.
  const [canonical, translation] = pair({
    source: {
      url: "not a url",
      title: "T",
      last_verified: "2026-07-13",
      verifier: "Pilot Seed Reviewer",
    },
  });
  assert.equal(sameSourceHost(canonical, translation), false);
  assert.ok(twinIssues(canonical, translation).some((i) => i.field === "source.url"));
});

test("a faithful translation raises nothing at all", () => {
  const [canonical, translation] = pair();
  assert.deepEqual(twinIssues(canonical, translation), []);
  const audit = auditTranslations([canonical, translation]);
  assert.deepEqual(audit.issues, []);
  assert.deepEqual(audit.undeclaredGaps, []);
  assert.deepEqual(audit.links, [
    { canonicalId: "ca.court-order.name", translationId: "ca.court-order.name.es" },
  ]);
});
