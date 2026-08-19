// The false-assurance guard (methodology honesty). A placeholder verifier must
// never borrow verification language in any user-facing caption, and the
// README's headline verification count must be COMPUTED truth, not prose that
// can drift. This test exists because the UI once rendered every seed record's
// date under a verification-flavored label while the corpus's only "verifier"
// was the Pilot Seed Reviewer placeholder.
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { loadCorpus, loadVerifierRoster, isHumanVerified, humanVerifiedCount } from "../api/corpus.ts";
import { loadForms } from "../api/forms.ts";
import { loadReferrals } from "../api/referrals.ts";
import { verificationCaption } from "../src/render.ts";
import { t as locale } from "../src/i18n/index.ts";
import type { Source } from "../api/types.ts";

/** The population the README's verification row cites: corpus records, referral
 *  records, and form-registry entries — each carrying a source.verifier. */
function verifierBearingSources(): Array<{ source: { verifier: string } }> {
  return [...loadCorpus(), ...loadReferrals(), ...loadForms()];
}

const PLACEHOLDER = "Pilot Seed Reviewer";

function src(verifier: string): Source {
  return {
    url: "https://example.gov/policy",
    title: "Example policy page",
    last_verified: "2026-06-05",
    verifier,
  };
}

test("the roster's placeholder entry is not human verification", () => {
  const roster = loadVerifierRoster();
  assert.ok(roster.has(PLACEHOLDER), "placeholder must stay on the roster so records validate");
  assert.equal(isHumanVerified(PLACEHOLDER, roster), false);
});

test("an unknown verifier is not human verification either", () => {
  assert.equal(isHumanVerified("Nobody In The Roster", loadVerifierRoster()), false);
});

for (const lang of ["en", "es"] as const) {
  test(`placeholder caption carries the not-yet state and no verification language (${lang})`, () => {
    const t = locale(lang).ui;
    const caption = verificationCaption(src(PLACEHOLDER), t);
    assert.ok(caption.includes(t.notHumanVerified), caption);
    assert.ok(caption.includes(t.recordedOn), caption);
    // A verified caption has the shape "{verifiedBy} {name}, {date}" — assert the
    // placeholder caption does not take that shape (plain substring would false-positive
    // on the honest "not yet verified by a named reviewer" copy).
    assert.ok(!caption.startsWith(t.verifiedBy), `must not read as verified: ${caption}`);
    assert.ok(!caption.includes(PLACEHOLDER), `must not surface the placeholder name: ${caption}`);
  });

  test(`a real roster human renders as verification with name and date (${lang})`, () => {
    const t = locale(lang).ui;
    const roster = new Map(loadVerifierRoster());
    roster.set("Jane Reviewer", { name: "Jane Reviewer" });
    const caption = verificationCaption(src("Jane Reviewer"), t, roster);
    assert.ok(caption.startsWith(t.verifiedBy), caption);
    assert.ok(caption.includes("Jane Reviewer"), caption);
    assert.ok(caption.includes("2026-06-05"), caption);
    assert.ok(!caption.includes(t.notHumanVerified), caption);
  });
}

test("every seed corpus record currently renders the not-yet state", () => {
  const records = loadCorpus();
  const t = locale("en").ui;
  for (const r of records) {
    const caption = verificationCaption(r.source, t);
    if (!isHumanVerified(r.source.verifier)) {
      assert.ok(caption.includes(t.notHumanVerified), `${r.id ?? r.source.title}: ${caption}`);
    }
  }
});

test("the README verification row states the computed count, so it cannot drift", () => {
  const records = verifierBearingSources();
  const verified = humanVerifiedCount(records);
  const total = records.length;
  const readme = readFileSync(join(import.meta.dirname, "..", "README.md"), "utf8");
  const m = readme.match(/\*\*(\d+) of (\d+)\*\* records verified by a named human/);
  assert.ok(m, "README must keep the '<x> of <y> records verified by a named human' row");
  assert.equal(Number(m[1]), verified, "README verified count drifted from the corpus");
  assert.equal(Number(m[2]), total, "README total record count drifted from the corpus");
});
