// Drift-watchability (issue #117). Two properties matter here and both are safety
// properties, not cosmetics:
//   1. the answer is DERIVED from the committed artifacts, never hand-declared, so it
//      cannot drift away from what source-watch can actually do; and
//   2. it fails toward disclosure — an unknown source is reported as unwatchable rather
//      than quietly presented to a reader as if a machine were checking it.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  defaultPaths,
  isDriftWatchable,
  resetWatchabilityCache,
  unwatchableAmong,
  unwatchableReason,
  unwatchableSources,
} from "../api/watchability.ts";
import { loadCorpus } from "../api/corpus.ts";
import { loadForms } from "../api/forms.ts";

/** A throwaway artifact tree, so these assertions never depend on the live corpus. */
function fixtureTree(opts: {
  corpusBaseline?: Record<string, string>;
  formsBaseline?: Record<string, string>;
  snapshots?: Record<string, unknown>;
}): { root: string; paths: ReturnType<typeof defaultPaths> } {
  const root = mkdtempSync(join(tmpdir(), "watchability-"));
  mkdirSync(join(root, "corpus", "snapshots"), { recursive: true });
  mkdirSync(join(root, "forms"), { recursive: true });
  writeFileSync(join(root, "corpus", "source-hashes.json"), JSON.stringify(opts.corpusBaseline ?? {}));
  writeFileSync(join(root, "forms", "form-hashes.json"), JSON.stringify(opts.formsBaseline ?? {}));
  writeFileSync(
    join(root, "corpus", "snapshots", "index.json"),
    JSON.stringify({ snapshots: opts.snapshots ?? {} }),
  );
  return { root, paths: defaultPaths(root) };
}

test("a source with a committed baseline and no fetch problem is watchable", () => {
  const { root, paths } = fixtureTree({ corpusBaseline: { "https://example.test/a": "abc" } });
  try {
    assert.equal(unwatchableReason("https://example.test/a", paths), null);
    assert.equal(isDriftWatchable("https://example.test/a", paths), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a 403 source is unwatchable even though it HAS a baseline", () => {
  // The case that made the count 3 rather than 2: source-watch reports the page
  // "unreachable (skipped)" and carries the old hash forward forever, so the baseline's
  // presence proves nothing about whether drift would ever be noticed.
  const { root, paths } = fixtureTree({
    corpusBaseline: { "https://example.test/403": "abc" },
    snapshots: { "https://example.test/403": { file: null, unfetchable: { status: "HTTP 403" } } },
  });
  try {
    assert.equal(unwatchableReason("https://example.test/403", paths), "refuses-our-user-agent");
    assert.equal(isDriftWatchable("https://example.test/403", paths), false);
    assert.deepEqual([...unwatchableSources(paths).keys()], ["https://example.test/403"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a source with no baseline is unwatchable, and an unknown URL fails toward disclosure", () => {
  const { root, paths } = fixtureTree({ formsBaseline: { "https://example.test/form": "abc" } });
  try {
    assert.equal(unwatchableReason("https://example.test/form", paths), null);
    assert.equal(unwatchableReason("https://example.test/never-seen", paths), "no-baseline");
    assert.deepEqual(
      unwatchableAmong(["https://example.test/form", "https://example.test/never-seen"], paths),
      ["https://example.test/never-seen"],
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("missing or unparseable artifacts do not make everything look watched", () => {
  // If the baselines cannot be read, nothing has been proved about any source. The
  // module must not answer "watchable" by accident — the same fail-closed reasoning the
  // dependency-audit gate needed.
  const root = mkdtempSync(join(tmpdir(), "watchability-empty-"));
  try {
    const paths = defaultPaths(root);
    assert.equal(unwatchableReason("https://example.test/anything", paths), "no-baseline");
    mkdirSync(join(root, "corpus"), { recursive: true });
    writeFileSync(join(root, "corpus", "source-hashes.json"), "{ not json");
    resetWatchabilityCache();
    assert.equal(unwatchableReason("https://example.test/anything", paths), "no-baseline");
  } finally {
    rmSync(root, { recursive: true, force: true });
    resetWatchabilityCache();
  }
});

test("the live corpus + forms report exactly the sources the launch-gate row names", () => {
  // The README's "Every cited source actually under drift watch" row and the sentence a
  // user reads under their step are now the same derivation; this pins the set so a
  // silent change to either has to be deliberate.
  const urls = [...loadCorpus().map((r) => r.source.url), ...loadForms().map((f) => f.source.url)];
  assert.deepEqual(unwatchableAmong(urls), [
    // Georgia's Affidavit for Amendment (Form 3977) is a PDF whose text this
    // pipeline cannot extract, so no baseline can be taken — deliberate addition
    // with the Georgia corpus, not a silent drift in the watch set.
    "https://dph.georgia.gov/document/document/affidavit-amendment-form-3977-revisedpdf/download",
    // Ohio's vital-records page refuses this project's declared user-agent
    // domain-wide, so no baseline can be taken — deliberate, with the Ohio corpus.
    "https://odh.ohio.gov/know-our-programs/vital-statistics/changing-correcting-birth-record",
    // Arizona: both are PDFs whose text this pipeline cannot extract, so no
    // baseline can be taken — deliberate, with the Arizona corpus.
    "https://superiorcourt.maricopa.gov/media/emucljue/name-gender-change-eng-spa.pdf",
    // North Carolina's Birth Certificate Modification Application (Form DHHS 1578) is
    // a PDF whose text this pipeline cannot extract, so no baseline can be taken —
    // deliberate addition with the North Carolina corpus.
    "https://vitalrecords.nc.gov/documents/NCOVR-BirthModificationsApplicationFinal-07072022v6.pdf",
    "https://www.azdhs.gov/documents/vital-records/manuals/correction-affidavit-correct-amend-birth.pdf?v=20260409",
    // Tennessee's enacted "definition of sex" bill (SB 1440 / HB 239, 2023) is only
    // published as a PDF on the General Assembly's own site, so no baseline can be
    // taken — deliberate, with the Tennessee corpus.
    "https://www.capitol.tn.gov/Bills/113/Bill/SB1440.pdf",
    // Arkansas: both are PDFs whose text this pipeline cannot extract, so no
    // baseline can be taken — deliberate, with the Arkansas corpus.
    "https://www.dfa.arkansas.gov/wp-content/uploads/Affidavit_of_Legal_Name_Change_2019.pdf",
    "https://www.dfa.arkansas.gov/wp-content/uploads/DS_GenderApplication.pdf",
    // Nevada: all three are PDFs whose text this pipeline cannot extract, so no
    // baseline can be taken — deliberate, with the Nevada corpus.
    "https://www.dpbh.nv.gov/siteassets/programs/birthdeath/dta/forms/Court_Ordered_Change_ONLY.pdf",
    "https://www.dpbh.nv.gov/siteassets/programs/pco/Changing_Your_Gender_In_Nevada_Guide_08.24.2018_1.pdf",
    "https://www.dpbh.nv.gov/uploadedFiles/dpbh.nv.gov/content/Programs/BirthDeath/dta/Forms/Corrections%20-%20Birth.pdf",
    "https://www.health.ny.gov/vital_records/gender_designation_corrections.htm",
    // Michigan's SOS and MDHHS pages refuse this project's declared user-agent.
    // Verified 403 from both Node's fetch and curl sending the same UA, so this is
    // the host refusing us, not a client artifact — deliberate, with the MI corpus.
    "https://www.michigan.gov/mdhhs/doing-business/vitalrecords/correct-change-a-vital-record-and-legal-name-change",
    "https://www.michigan.gov/sos/all-services/license-or-id-name-correction",
    "https://www.michigan.gov/sos/all-services/license-or-id-sex-designation-correction",
    // North Carolina's DMV Sex Designation Form (DL-300) is a PDF whose text this
    // pipeline cannot extract, so no baseline can be taken — deliberate addition
    // with the North Carolina corpus.
    "https://www.ncdot.gov/dmv/downloads/Documents/DL-300.pdf",
    // New Jersey: both are PDFs whose text this pipeline cannot extract, so no baseline
    // can be taken — deliberate addition with the New Jersey corpus. The REG-L2 form
    // backs nj.birth-certificate.gender-marker (which itself cites a checkable HTML
    // page); the name-change packet is both the court-order.name record's own source
    // and its form_ref.
    "https://www.nj.gov/health/forms/reg-l2_1.pdf",
    "https://www.njcourts.gov/sites/default/files/forms/10551_namechg_adult.pdf",
    "https://www.nycourts.gov/courthelp/Family/nameChange.shtml",
    // The Sixth Circuit's Gore v. Lee opinion (the source for Tennessee's birth-certificate
    // gender-marker bar) is only published as a PDF on the court's own site, so no baseline
    // can be taken — deliberate, with the Tennessee corpus.
    "https://www.opn.ca6.uscourts.gov/opinions.pdf/24a0151p-06.pdf",
    "https://www.ssa.gov/forms/ss-5.pdf",
    // Tennessee's general vital-records amendment form (PH-1186) is only published as a
    // PDF, so no baseline can be taken — deliberate, with the Tennessee corpus.
    "https://www.tn.gov/content/dam/tn/health/documents/vital-records/PH-1186-Application-to-Amend-A-Tennessee-Birth-Record.pdf",
    // Virginia's VS42 (Changing Sex Designation) form is a PDF whose text this pipeline
    // cannot extract, so no baseline can be taken — deliberate, with the Virginia corpus.
    "https://www.vdh.virginia.gov/content/uploads/sites/93/2020/07/VS42_Gender-Designation-Form.pdf",
  ]);
  // ...and the two reasons are genuinely different failures, which is why the launch-gate
  // evidence names them separately instead of calling all three a 403.
  assert.equal(
    unwatchableReason("https://www.health.ny.gov/vital_records/gender_designation_corrections.htm"),
    "refuses-our-user-agent",
  );
  assert.equal(unwatchableReason("https://www.ssa.gov/forms/ss-5.pdf"), "no-baseline");
});
