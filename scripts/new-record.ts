// Corpus-record scaffold: prints a schema-valid skeleton so a contributor can't
// mis-shape a record. Dated today, PLACEHOLDER verifier (the content gate reports it
// and the launch gate blocks on it until a named human verifies).
//
//   make new-record            # prints the skeleton to stdout
//
// Paste it into the right corpus/jurisdictions/*.json array, fill the real values,
// then run `make verify`.

const today = new Date().toISOString().slice(0, 10);

const skeleton = {
  id: "xx.document-type.change-type",
  jurisdiction: "US-XX",
  document_type:
    "court-order | ssa-card | drivers-license | passport | birth-certificate | financial-records | " +
    "green-card | naturalization-certificate | ead | selective-service | military-records | " +
    "trusted-traveler | federal-employment-records",
  change_type: ["name | gender-marker"],
  topic: "Short human-readable topic",
  statement: "One plain-language sentence a user will read, derived only from the official source.",
  detail: "Optional second sentence with practical detail. Delete if unused.",
  cost: { amount_usd: null, note: "varies — describe; or set amount_usd to a number", fee_waiver: false },
  timeline: { typical: "e.g. 2-4 weeks" },
  discretionary: false,
  prerequisites: [],
  source: {
    url: "https://official.source.gov/...",
    title: "Official page title",
    last_verified: today,
    verifier: "Pilot Seed Reviewer",
  },
  verification_status: "verified",
  recheck_sla_days: 90,
  language: "en",
};

console.log(JSON.stringify(skeleton, null, 2));
console.error(`\n(dated ${today}; replace every placeholder, keep the source official, run \`make verify\`)`);
