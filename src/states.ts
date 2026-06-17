// US states/territories for the intake picker, and which ones the corpus fully covers.
// A user in any state can now get *something* (federal steps + named referrals) instead
// of being unable to select their state at all (the panel's #2 blocker).

import type { JurisdictionId } from "../api/types.ts";

/** Jurisdiction ids with hand-built state-specific corpus content. */
export const COVERED: ReadonlySet<JurisdictionId> = new Set(["US-CA", "US-IL", "US-NY", "US-TX", "US-WA"]);

export interface UsState {
  id: JurisdictionId;
  name: string;
}

export const US_STATES: UsState[] = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"],
  ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"], ["DC", "District of Columbia"],
  ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"],
  ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"],
  ["ME", "Maine"], ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"],
  ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"],
  ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"], ["NY", "New York"],
  ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"], ["OR", "Oregon"],
  ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"], ["SD", "South Dakota"],
  ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"],
  ["WA", "Washington"], ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"],
].map(([code, name]) => ({ id: `US-${code}`, name: name! }));

const NAME_BY_ID = new Map(US_STATES.map((s) => [s.id, s.name]));

export function stateName(id: JurisdictionId): string {
  return NAME_BY_ID.get(id) ?? id;
}

export function isCovered(id: JurisdictionId): boolean {
  return COVERED.has(id);
}
