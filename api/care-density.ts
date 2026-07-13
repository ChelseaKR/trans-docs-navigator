// Care-continuity signal — DEFERRED, deliberately, with the reasoning kept in code so the
// next person to reach for it has to read the reasons first.
//
// THE IDEA: NPPES (the CMS NPI Registry, https://npiregistry.cms.hhs.gov/api-page) is free,
// public-domain and auth-free. Query it by taxonomy + destination location and you get a
// count of providers in a specialty near where someone is moving. "Are there endocrinologists
// where I'm going" is a real question a relocating person has.
//
// WHY IT IS NOT SHIPPED (two independent blockers, either one sufficient):
//
//  1. PRIVACY — it would leak exactly the fact this whole mode exists to protect. Serving a
//     density figure means sending the DESTINATION (and, in practice, a ZIP) to a third-party
//     government API at the moment a user builds a relocation plan. The plan route is
//     designed so an (origin → destination) pair is never logged, never persisted, and never
//     leaves the process (docs/RELOCATION.md §Safety). A CMS query would hand that pair's
//     destination half to another party, timed to the request. There is no version of this
//     that is "just a lookup": the request itself is the disclosure. Doing it client-side
//     moves the leak to the user's IP rather than removing it, and doing it server-side ties
//     it to our egress. Both are worse than not answering.
//
//  2. THE SIGNAL DOES NOT MEAN WHAT PEOPLE WOULD READ IT TO MEAN. NPPES records a provider's
//     self-selected taxonomy code. It does not record whether a provider is trans-affirming,
//     accepting patients, or safe. Rendering "14 endocrinologists near your destination" next
//     to a trans document checklist invites exactly one inference — that these are providers
//     who will treat you — and NPPES cannot support it. Inferring affirmation from a
//     specialty code is the same error this portfolio's guardrails forbid elsewhere (never
//     infer an identity or a stance; only report what a source states). A misleading care
//     signal in a relocation decision is a safety harm, not a missing feature.
//
// WHAT WOULD UNBLOCK IT: a corpus of provider/clinic records that a named human verified
// against a source that ACTUALLY STATES the clinic serves trans patients — i.e. the same
// record + source + verifier + last-verified discipline as every other claim here, sourced
// from directories that make that assertion themselves. That is a content problem, not an
// API problem, and it belongs in corpus/referrals/ (api/referrals.ts) where the verifier
// gate already applies. NPPES would at best be a coverage-checking input to that work.
//
// This module is therefore inert by construction: it holds the decision, exports no fetch,
// and is wired to nothing. tests/relocation.test.ts asserts that no runtime module reaches
// the NPPES host, so "just call the API" cannot land quietly.

/** Why the care-density signal is not served. Rendered nowhere; read by humans and tests. */
export interface DeferredSignal {
  id: string;
  status: "deferred";
  /** The API that would have backed it, recorded so the deferral is checkable, not vague. */
  candidate_source: string;
  blockers: string[];
  unblocked_by: string;
}

export const CARE_DENSITY_DEFERRAL: DeferredSignal = {
  id: "care-continuity-density",
  status: "deferred",
  candidate_source: "https://npiregistry.cms.hhs.gov/api-page",
  blockers: [
    "privacy: querying it would disclose the destination of a relocation plan to a third party, " +
      "which is the exact fact the plan route is built never to log, persist, or emit",
    "validity: NPPES holds self-selected taxonomy codes, not whether a provider is affirming, " +
      "accepting patients, or safe — a density count next to a trans checklist would be read as a " +
      "claim the source cannot support",
  ],
  unblocked_by:
    "verified provider/clinic records in corpus/referrals/, whose sources themselves state that the " +
    "clinic serves trans patients, under the existing named-verifier gate",
};

/**
 * The host this signal would have talked to. Exported so the egress test can assert that
 * nothing in the runtime actually does — the deferral is enforced, not just documented.
 */
export const NPPES_HOST = "npiregistry.cms.hhs.gov";
