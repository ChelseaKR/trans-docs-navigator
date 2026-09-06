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
    // Mississippi's enacted 2026 name-change act (SB 2126) is only published as a PDF
    // on the Legislature's own bill-document site, so no baseline can be taken —
    // deliberate, with the Mississippi corpus.
    "https://billstatus.ls.state.ms.us/documents/2026/pdf/SB/2100-2199/SB2126SG.pdf",
    // Delaware: the Court of Common Pleas name-change petition packet, the DMV's gender-
    // designation procedure and its Form MV2020, and the Division of Public Health's
    // Gender Reassignment instructions and Requester's Affidavit are all PDFs whose text
    // this pipeline cannot extract, so no baseline can be taken — deliberate, with the
    // Delaware corpus.
    "https://courts.delaware.gov/forms/download.aspx?id=16858",
    "https://dhss.delaware.gov/wp-content/uploads/sites/12/dph/pdf/GenderReassignment.pdf",
    "https://dhss.delaware.gov/wp-content/uploads/sites/12/dph/pdf/RequesterAffidavitSexChange.pdf",
    "https://dmv.de.gov/DriverServices/drivers_license/pdfs/gender_designation_change_procedure.pdf",
    "https://dmv.de.gov/forms/driver_serv_forms/pdfs/gender_change_request_form.pdf",
    // Alaska's DMV pages refuse this project's declared user-agent domain-wide.
    // Verified directly with curl sending the same UA (and a browser UA, for good
    // measure) from this environment — the host refuses the request outright, before
    // even a redirect — so this is the host refusing us, not a client artifact.
    // Deliberate, with the Alaska corpus.
    "https://doa.alaska.gov/dmv/akol/namchg.htm",
    "https://doa.alaska.gov/dmv/forms/pdfs/427.pdf",
    // Georgia's Affidavit for Amendment (Form 3977) is a PDF whose text this
    // pipeline cannot extract, so no baseline can be taken — deliberate addition
    // with the Georgia corpus, not a silent drift in the watch set.
    "https://dph.georgia.gov/document/document/affidavit-amendment-form-3977-revisedpdf/download",
    // Montana's Gender Designation Form is a PDF whose text this pipeline cannot
    // extract, so no baseline can be taken — deliberate, with the Montana corpus.
    // It is also the source for a contested, litigated rule (see docs/audits): a
    // human should re-read it periodically, not just trust the last snapshot.
    "https://dphhs.mt.gov/assets/Statistics/VitalStats/MTGenderDesignationForm.pdf",
    // Montana's Affidavit for Correction of a Vital Record — the general-purpose
    // form the Gender Designation Form is filed alongside — is also a PDF whose
    // text this pipeline cannot extract, so no baseline can be taken.
    "https://dphhs.mt.gov/assets/Statistics/VitalStats/affidavitcorr.pdf",
    // Alabama's Request to Change Name (Form PS-12) is a PDF whose text this pipeline
    // cannot extract, so no baseline can be taken — deliberate, with the Alabama corpus.
    "https://eforms.alacourt.gov/media/jtzbncuw/request-to-change-name.pdf",
    // Missouri's birth-record correction-affidavit form (MO 580-0645) is a PDF whose
    // text this pipeline cannot extract — deliberate addition with the Missouri corpus.
    "https://health.mo.gov/sites/health/files/media/pdf/2026/04/Aff_for_Correction.pdf",
    // Wyoming's Form to Correct a Wyoming Vital Record — registered in forms/registry.json
    // (form_ref for wy.birth-certificate.name) but never fetched via `make source-baseline`,
    // so it has no drift baseline — deliberate, with the Wyoming corpus.
    "https://health.wyo.gov/wp-content/uploads/2026/07/WDH-VRS-Correction-Form-2026.pdf",
    // Indiana's Adult Name Change packet (Coalition for Court Access) is a PDF whose
    // text this pipeline cannot extract — deliberate addition with the Indiana corpus.
    "https://indianalegalhelp.org/wp-content/uploads/2024/09/Adult-Name-Change-Packet-INSTRUCTIONS-202409-Update.pdf",
    // Louisiana's Department of Health birth-records amendment page refuses this
    // project's declared user-agent (HTTP 403) — deliberate, with the Louisiana corpus.
    "https://ldh.la.gov/vital-records/amendments-to-birth-records",
    // Mississippi's Vital Records rules (birth-certificate name and sex-designation
    // amendment) are only published as a PDF, so no baseline can be taken —
    // deliberate, with the Mississippi corpus.
    "https://msdh.ms.gov/phs/VR_rules_2023_new_format.pdf",
    // North Dakota's Century Code chapter 23-02.1 (the statute restricting
    // gender-identity-based sex-designation amendments, 23-02.1-25.1) is only
    // published as a PDF of the whole chapter, so no baseline can be taken —
    // deliberate, with the North Dakota corpus.
    "https://ndlegis.gov/cencode/t23c02-1.pdf",
    // Ohio's vital-records page refuses this project's declared user-agent
    // domain-wide, so no baseline can be taken — deliberate, with the Ohio corpus.
    "https://odh.ohio.gov/know-our-programs/vital-statistics/changing-correcting-birth-record",
    // Connecticut's Gender Designation form (B-385) is a PDF whose text this pipeline
    // cannot extract, so no baseline can be taken — deliberate addition with the
    // Connecticut corpus.
    "https://portal.ct.gov/-/media/DMV/20/29/B-385.pdf",
    // Alaska's court-order instructions and petition forms (CIV-699, CIV-700) are PDFs
    // whose text this pipeline cannot extract, so no baseline can be taken —
    // deliberate, with the Alaska corpus.
    "https://public.courts.alaska.gov/web/forms/docs/civ-699.pdf",
    "https://public.courts.alaska.gov/web/forms/docs/civ-700.pdf",
    // Louisiana's OMV internal gender-change policy (Policy 22.01) is a PDF whose text
    // this pipeline cannot extract, so no baseline can be taken — deliberate, with the
    // Louisiana corpus.
    "https://public.powerdms.com/ladpsc/documents/368304",
    // Idaho's Instructions to Request a Court Ordered Name Change on an Idaho Birth
    // Certificate is a PDF whose text this pipeline cannot extract, so no baseline can
    // be taken — deliberate addition with the Idaho corpus.
    "https://publicdocuments.dhw.idaho.gov/WebLink/ElectronicFile.aspx?docid=1294&dbid=0&repo=PUBLIC-DOCUMENTS",
    // New Mexico's MVD Request for Sex Designation Change (Form MVD-10237) is a PDF
    // whose text this pipeline cannot extract, so no baseline can be taken —
    // deliberate, with the New Mexico corpus.
    "https://realfile.tax.newmexico.gov/mvd10237.pdf",
    // Arizona: both are PDFs whose text this pipeline cannot extract, so no
    // baseline can be taken — deliberate, with the Arizona corpus.
    "https://superiorcourt.maricopa.gov/media/emucljue/name-gender-change-eng-spa.pdf",
    // North Carolina's Birth Certificate Modification Application (Form DHHS 1578) is
    // a PDF whose text this pipeline cannot extract, so no baseline can be taken —
    // deliberate addition with the North Carolina corpus.
    "https://vitalrecords.nc.gov/documents/NCOVR-BirthModificationsApplicationFinal-07072022v6.pdf",
    // Utah's Form UDOH-OVRS-902 (Amendment of a Record by Court Order) — registered in
    // forms/registry.json (form_ref for ut.birth-certificate.name) but never fetched via
    // `make source-baseline`, so it has no drift baseline — deliberate, with the Utah corpus.
    "https://vitalrecords.utah.gov/wp-content/uploads/902-Affidavit-to-Amend-by-Court-Order.pdf",
    "https://www.azdhs.gov/documents/vital-records/manuals/correction-affidavit-correct-amend-birth.pdf?v=20260409",
    // Tennessee's enacted "definition of sex" bill (SB 1440 / HB 239, 2023) is only
    // published as a PDF on the General Assembly's own site, so no baseline can be
    // taken — deliberate, with the Tennessee corpus.
    "https://www.capitol.tn.gov/Bills/113/Bill/SB1440.pdf",
    // Missouri's courts website blocks this project's declared user-agent domain-wide
    // (an explicit anti-scraper 403 on every internal page) — deliberate, with the
    // Missouri corpus.
    "https://www.courts.mo.gov/page.jsp?id=3834",
    // New Hampshire: courts.nh.gov and dmv.nh.gov both refuse this project's declared
    // user-agent (confirmed 403 from both Node's fetch and curl sending the same UA), so
    // no baseline can be taken — deliberate, with the New Hampshire corpus. The court-order
    // and birth-certificate records instead cite gencourt.state.nh.us (the statute site),
    // which is not blocked and is checkable.
    "https://www.courts.nh.gov/sites/g/files/ehbemt471/files/documents/2021-06/filing_fees.pdf",
    // DC Superior Court (dccourts.gov) refuses this project's declared user-agent
    // domain-wide (an Azure Application Gateway WAF, verified on multiple paths
    // including robots.txt itself), so no baseline can be taken — deliberate, with
    // the District of Columbia corpus. This is the SAME URL as dc.court-order.name's
    // source and the dc-name-change-adult form_ref.
    "https://www.dccourts.gov/sites/default/files/2024-01/Name_Change_Application_Full_Fillable.pdf",
    // Arkansas: both are PDFs whose text this pipeline cannot extract, so no
    // baseline can be taken — deliberate, with the Arkansas corpus.
    "https://www.dfa.arkansas.gov/wp-content/uploads/Affidavit_of_Legal_Name_Change_2019.pdf",
    "https://www.dfa.arkansas.gov/wp-content/uploads/DS_GenderApplication.pdf",
    "https://www.dmv.nh.gov/drivers-licensenon-driver-ids/update-personal-information",
    // Nevada: all three are PDFs whose text this pipeline cannot extract, so no
    // baseline can be taken — deliberate, with the Nevada corpus.
    "https://www.dpbh.nv.gov/siteassets/programs/birthdeath/dta/forms/Court_Ordered_Change_ONLY.pdf",
    "https://www.dpbh.nv.gov/siteassets/programs/pco/Changing_Your_Gender_In_Nevada_Guide_08.24.2018_1.pdf",
    "https://www.dpbh.nv.gov/uploadedFiles/dpbh.nv.gov/content/Programs/BirthDeath/dta/Forms/Corrections%20-%20Birth.pdf",
    "https://www.health.ny.gov/vital_records/gender_designation_corrections.htm",
    // Vermont: both the Affidavit of Gender Identity and the Application to Correct or
    // Amend a Vermont Birth Certificate are PDFs whose text this pipeline cannot
    // extract, so no baseline can be taken — deliberate, with the Vermont corpus.
    "https://www.healthvermont.gov/sites/default/files/document/hsi-vr-gender-affidavit.pdf",
    "https://www.healthvermont.gov/sites/default/files/documents/pdf/HS_VR_BC_Correct_Amend.pdf",
    // North Dakota's Birth Record Amendment Application (Form SFN 60183) is a PDF
    // whose text this pipeline cannot extract, so no baseline can be taken —
    // deliberate addition with the North Dakota corpus.
    "https://www.hhs.nd.gov/sites/www/files/documents/DOH%20Legacy/Vital/SFN%2060183%20-%20Birth%20Amendment%20Changes.pdf",
    // Iowa Code chapter 674 (name-change statute) and § 144.23 (birth-certificate sex
    // designation) are only published as PDFs whose text this pipeline cannot extract —
    // deliberate addition with the Iowa corpus.
    "https://www.legis.iowa.gov/docs/code/2026/144.23.pdf",
    "https://www.legis.iowa.gov/docs/code/2026/674.pdf",
    // Maine: the VS-7 vital-records amendment form, the BMV's Gender Designation Form
    // (MVL-20), and the Secretary of State's gender-designation guidance memo are all
    // PDFs whose text this pipeline cannot extract, so no baseline can be taken —
    // deliberate, with the Maine corpus.
    "https://www.maine.gov/dhhs/mecdc/sites/maine.gov.dhhs.mecdc/files/Application%20to%20Correct%20a%20Vital%20Record%20in%20Maine%20%28VS-7%29.pdf",
    "https://www.maine.gov/sos/sites/maine.gov.sos/files/inline-files/GENDER%20DESIGNATION%20FORM2019.pdf",
    "https://www.maine.gov/sos/sites/maine.gov.sos/files/inline-files/Guidance%20about%20Gender%20Designations%20on%20Maine%20Drivers%20Licenses_1.pdf",
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
    // New Mexico's Request to Change Gender Designation on a Birth Certificate (Adult
    // Form) has no drift baseline recorded — deliberate, with the New Mexico corpus.
    "https://www.nmhealth.org/publication/view/form/5429/",
    "https://www.nycourts.gov/courthelp/Family/nameChange.shtml",
    // The Sixth Circuit's Gore v. Lee opinion (the source for Tennessee's birth-certificate
    // gender-marker bar) is only published as a PDF on the court's own site, so no baseline
    // can be taken — deliberate, with the Tennessee corpus.
    "https://www.opn.ca6.uscourts.gov/opinions.pdf/24a0151p-06.pdf",
    // Missouri's vital-records rule (19 CSR 10-10.110) is only published as a PDF
    // compilation whose text this pipeline cannot extract — deliberate, with the
    // Missouri corpus.
    "https://www.sos.mo.gov/cmsimages/adrules/csr/current/19csr/19c10-10.pdf",
    "https://www.ssa.gov/forms/ss-5.pdf",
    // Tennessee's general vital-records amendment form (PH-1186) is only published as a
    // PDF, so no baseline can be taken — deliberate, with the Tennessee corpus.
    "https://www.tn.gov/content/dam/tn/health/documents/vital-records/PH-1186-Application-to-Amend-A-Tennessee-Birth-Record.pdf",
    // Virginia's VS42 (Changing Sex Designation) form is a PDF whose text this pipeline
    // cannot extract, so no baseline can be taken — deliberate, with the Virginia corpus.
    "https://www.vdh.virginia.gov/content/uploads/sites/93/2020/07/VS42_Gender-Designation-Form.pdf",
    // Hawaii's Driver's License Application (also used for the State ID Application) is
    // a PDF whose text this pipeline cannot extract, so no baseline can be taken —
    // deliberate, with the Hawaii corpus.
    "https://www4.honolulu.gov/docushare/dsweb/Get/Document-325980/State%20of%20Hawaii%20Driver_s%20License%20Application.pdf",
  ]);
  // ...and the two reasons are genuinely different failures, which is why the launch-gate
  // evidence names them separately instead of calling all three a 403.
  assert.equal(
    unwatchableReason("https://www.health.ny.gov/vital_records/gender_designation_corrections.htm"),
    "refuses-our-user-agent",
  );
  assert.equal(unwatchableReason("https://www.ssa.gov/forms/ss-5.pdf"), "no-baseline");
});
