// Shape of one language's complete string bundle. Every user-visible string in the
// app lives in a LocaleBundle — UI chrome, document titles/labels, form-field labels,
// the generator's scaffolding sentences, and the legal pages. Adding a language means
// writing one new bundle module and registering it in ./index.ts; the compiler
// enforces completeness against these interfaces.

import type { DocumentType, Language } from "../../api/types.ts";

/** Strings for page chrome, the intake form, checklist, packet, form-fill, and errors. */
export interface UiMessages {
  skip: string;
  bannerTitle: string;
  bannerBody: string;
  footer: string;
  legalNav: string;
  termsLink: string;
  privacyLink: string;
  a11yLink: string;
  verifyNote: string;
  notFilingNote: string;
  sources: string;
  lastChecked: string;
  needsRecheck: string;
  discretionary: string;
  cost: string;
  timeline: string;
  prereq: string;
  step: string;
  print: string;
  startOver: string;
  prepared: string;
  packetIntro: string;
  private: string;
  notCovered: string;
  resumeTitle: string;
  resumeIntro: string;
  passLabel: string;
  saveBtn: string;
  resumeBtn: string;
  deleteBtn: string;
  intakeHeading: string;
  intakeLead: string;
  whereLive: string;
  stateLabel: string;
  whatChanging: string;
  changeNameLabel: string;
  changeMarkerLabel: string;
  whichDocs: string;
  languageLegend: string;
  submitChecklist: string;
  checklistTitle: string;
  checklistHeading: string;
  checklistIntro: string;
  packetTitle: string;
  packetHeading: string;
  answerHeading: string;
  formPrivacy: string;
  fillDownload: string;
  flatScanIntro: string;
  gapNoRecords: string;
  gapAllDegraded: string;
  noStepsLead: string;
  notFoundHeading: string;
  notFoundBody: string;
  badRequestHeading: string;
  badRequestBody: string;
  methodHeading: string;
  methodBody: string;
  backToChecklist: string;
  backToStart: string;
  privacyLabel: string;
  resEnterPass: string;
  resSaved: string;
  resNothing: string;
  resWrong: string;
  resDeleted: string;
  fillFilling: string;
  fillDone: string;
  fillUnfilled: string;
  fillError: string;
  thinnerCoverage: string;
}

/**
 * Scaffolding sentences the answer composer writes around record statements
 * (which are already in the record's own language).
 */
export interface GeneratorMessages {
  costVaries(note?: string): string;
  costAbout(amountUsd: number, waiverAvailable: boolean): string;
  timeline(typical: string, note?: string): string;
  intro: string;
  discretionary: string;
  refusal: string;
  freshness(topic: string, lastVerified: string, sourceTitle: string): string;
  disclosure: string;
}

/** One section of a legal/policy page. `html` is static, trusted markup — never user input. */
export interface LegalSection {
  h: string;
  html: string;
}

/** The three legal/policy pages plus their titles and "last updated" label. */
export interface LegalMessages {
  updatedLabel: string;
  termsTitle: string;
  privacyTitle: string;
  accessibilityTitle: string;
  terms: LegalSection[];
  privacy: LegalSection[];
  accessibility: LegalSection[];
}

/** Everything one language needs. The compiler enforces parity across languages. */
export interface LocaleBundle {
  language: Language;
  /** The language's own name for itself, shown in the language picker. */
  selfName: string;
  ui: UiMessages;
  /** Full step titles, e.g. "Get a court order for your name change". */
  docTitles: Record<DocumentType, string>;
  /** Short document labels for prerequisites and gap lists. */
  docLabels: Record<DocumentType, string>;
  /** Friendly labels for form-fill intake keys (a small fixed set; unknown keys fall back). */
  fieldLabels: Record<string, string>;
  generator: GeneratorMessages;
  legal: LegalMessages;
}
