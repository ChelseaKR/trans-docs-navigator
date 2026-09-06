// Poison fixture: src/i18n/ is the locale catalog itself, not a rendering template.
// This file deliberately contains the literal attribute shape the gate looks for
// (in a comment, as data a bundle could plausibly hold) to prove the gate's
// directory exclusion actually works rather than happening to never match here.
// Literal for the test only — not real markup: aria-label="Should never be reported".
export const poisonBundleNote = "not a template — aria-label=\"Should never be reported\"";
