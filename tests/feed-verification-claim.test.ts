// Issue #251, the feed surface: the RSS feed told every subscriber "We (re)verified N
// records for <state> on <date>" while all 688 corpus records carried the
// `Pilot Seed Reviewer` placeholder and the checklist page beside them read "not yet
// verified by a named reviewer" against the same record.
//
// WHY THE FEED FIRST, of the surfaces #251 lists. It is the one built for a subscriber
// in a hostile jurisdiction who hands over no identity — no account, no email address —
// so there is no channel through which a wrong claim in it can ever be corrected. A
// mistaken sentence on a web page can at least be replaced under the reader's next
// visit; a mistaken sentence delivered by RSS has already been read.
//
// The repair is not a better sentence. It is that the sentence is COMPUTED from the
// records the entry names (`FeedEntry.humanVerified` ← `isHumanVerified`), so it becomes
// true on its own the day a real reviewer lands rather than needing an edit nobody will
// remember to make. These tests hold all three branches — none, some, all — because a
// claim that can only ever print one string is not evidence that it reads anything.

import { test } from "node:test";
import assert from "node:assert/strict";

import { buildJurisdictionFeed, knownFeedJurisdictions } from "../api/feed.ts";
import { renderJurisdictionFeedXml } from "../src/feeds.ts";
import { loadCorpus, loadVerifierRoster, humanVerifiedCount, type VerifierEntry } from "../api/corpus.ts";
import { t as locale } from "../src/i18n/index.ts";
import { TEST_TODAY } from "../api/freshness.ts";
import type { CorpusRecord, Language } from "../api/types.ts";

const LANGS: readonly Language[] = ["en", "es"];
const PLACEHOLDER = "Pilot Seed Reviewer";
const REAL_HUMAN = "Jane Reviewer";

/** The shipped roster plus one real named human, for the accepted case. */
function rosterWithAHuman(): Map<string, VerifierEntry> {
  const roster = new Map(loadVerifierRoster());
  roster.set(REAL_HUMAN, { name: REAL_HUMAN });
  return roster;
}

function rec(over: Partial<CorpusRecord> & { verifier?: string; last_verified?: string }): CorpusRecord {
  const { verifier = PLACEHOLDER, last_verified = TEST_TODAY, ...rest } = over;
  return {
    id: "x",
    jurisdiction: "US-WA",
    document_type: "court-order",
    change_type: ["name"],
    topic: "t",
    statement: "A sufficiently long statement.",
    source: { url: "https://e.gov", title: "T", last_verified, verifier },
    verification_status: "verified",
    recheck_sla_days: 90,
    language: "en",
    ...rest,
  } as CorpusRecord;
}

// ── The entry carries the count, and the count reads the roster ──────────────────────

test("a feed entry counts how many of its records a named human confirmed", () => {
  const corpus = [
    rec({ id: "a", verifier: PLACEHOLDER }),
    rec({ id: "b", verifier: REAL_HUMAN }),
    rec({ id: "c", verifier: "Nobody In The Roster" }),
  ];
  const [entry] = buildJurisdictionFeed("US-WA", "en", TEST_TODAY, corpus, rosterWithAHuman());
  assert.ok(entry);
  assert.equal(entry.recordIds.length, 3);
  // The placeholder is on the roster and is still not a human; an off-roster name is
  // not one either. Only the real entry counts.
  assert.equal(entry.humanVerified, 1);
});

test("the feed's human-verification total cannot disagree with the launch gate's", () => {
  // The README's launch-gate row and `scripts/launch-gates.ts` both publish
  // `humanVerifiedCount()`. If the feed ever computed its own answer some other way,
  // the two public numbers could drift — which is the failure mode this whole issue is
  // about, one level up. Sum the feed's per-entry counts over every jurisdiction and
  // language and hold it to the same function.
  const corpus = loadCorpus();
  const roster = loadVerifierRoster();
  let fromFeed = 0;
  for (const jurisdiction of knownFeedJurisdictions(corpus)) {
    for (const lang of LANGS) {
      for (const e of buildJurisdictionFeed(jurisdiction, lang, TEST_TODAY, corpus, roster)) {
        fromFeed += e.humanVerified;
      }
    }
  }
  assert.equal(fromFeed, humanVerifiedCount(corpus, roster));
  // And state today's value outright, so this test is not vacuous while it is zero:
  // if this ever fails upward, real verification has landed and that is news.
  assert.equal(fromFeed, 0, "no corpus record is human-verified today");
});

// ── The rendered feed says so, in both languages ─────────────────────────────────────

for (const lang of LANGS) {
  test(`the published feed does not claim a human verified the seed corpus (${lang})`, () => {
    const seo = locale(lang).seo;
    const corpus = loadCorpus();
    const xml = renderJurisdictionFeedXml("US-WA", "Washington", lang, TEST_TODAY, corpus);

    const entries = buildJurisdictionFeed("US-WA", lang, TEST_TODAY, corpus);
    assert.ok(entries.length > 0, `US-WA must have ${lang} entries for this test to mean anything`);

    for (const e of entries) {
      assert.equal(e.humanVerified, 0);
      const sentence = seo.feedEntryHumanVerification(0, e.recordIds.length);
      assert.ok(
        xml.includes(sentence),
        `entry ${e.date} must carry the computed no-human sentence: ${sentence}`,
      );
    }
  });

  test(`the "some" and "all" branches are reachable and distinct (${lang})`, () => {
    // A refusal that fires on every input proves nothing. If the only branch this can
    // ever print is "nobody checked this", the sentence is a constant, not a reading of
    // the data — and it would stay wrong in the other direction once reviewers arrive.
    const seo = locale(lang).seo;
    const corpus = [
      rec({ id: "a", verifier: REAL_HUMAN, language: lang }),
      rec({ id: "b", verifier: PLACEHOLDER, language: lang }),
    ];
    const roster = rosterWithAHuman();

    const some = renderJurisdictionFeedXml("US-WA", "Washington", lang, TEST_TODAY, corpus, roster);
    assert.ok(some.includes(seo.feedEntryHumanVerification(1, 2)));
    assert.ok(!some.includes(seo.feedEntryHumanVerification(0, 2)));

    const allVerified = [rec({ id: "a", verifier: REAL_HUMAN, language: lang })];
    const all = renderJurisdictionFeedXml("US-WA", "Washington", lang, TEST_TODAY, allVerified, roster);
    assert.ok(all.includes(seo.feedEntryHumanVerification(1, 1)));

    // The three branches must be three different sentences, or the reader learns nothing.
    const none = seo.feedEntryHumanVerification(0, 2);
    assert.notEqual(none, seo.feedEntryHumanVerification(1, 2));
    assert.notEqual(seo.feedEntryHumanVerification(1, 2), seo.feedEntryHumanVerification(2, 2));
  });

  test(`no feed string claims WE verified a record (${lang})`, () => {
    // The exact wording that shipped, in both locales, plus the shape it belongs to.
    // Held against the whole rendered feed rather than against the one function, so a
    // reintroduction anywhere in the channel or an item is caught.
    const xml = renderJurisdictionFeedXml("US-WA", "Washington", lang, TEST_TODAY);
    const banned = lang === "en" ? [/\bWe \(re\)verified\b/i] : [/\(Re\)verificamos\b/i, /\bverificamos\b/i];
    for (const pattern of banned) {
      assert.ok(!pattern.test(xml), `feed must not assert first-person verification: ${pattern}`);
    }
  });
}

test("the feed's date wording does not describe a recorded date as a human reading", () => {
  // `source.last_verified` is a recorded date. The English entry body used to say the
  // records were "(re)verified" on it; the entry title still says "updated on", which is
  // true of a record we wrote down. This pins the body to the recorded-date reading in
  // both locales without pinning the whole sentence, which a translator may legitimately
  // rephrase.
  for (const lang of LANGS) {
    const seo = locale(lang).seo;
    const body = seo.feedEntryDescription(3, "Washington", "2026-05-01", "court order");
    assert.ok(body.includes("2026-05-01"), body);
    const claimsVerification = lang === "en" ? /verif/i.test(body) : /verific/i.test(body);
    assert.equal(claimsVerification, false, `entry body must not use verification language: ${body}`);
  }
});
