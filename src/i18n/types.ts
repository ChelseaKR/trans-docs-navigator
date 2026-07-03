// Shape of one language's complete string bundle. Every user-visible string in the
// app lives in a LocaleBundle — UI chrome, document titles/labels, form-field labels,
// the generator's scaffolding sentences, and the legal pages. Adding a language means
// writing one new bundle module and registering it in ./index.ts; the compiler
// enforces completeness against these interfaces.

import type { ChangeType, DocumentType, Language } from "../../api/types.ts";

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
  methodologyLink: string;
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
  // Checklist enrichment (surfaced form-fill, plan summary, progress, deeper links).
  fillFormCta: string;
  getFormCta: string;
  moreDetail: string;
  markDone: string;
  /** Progress counter template with {done}/{total} placeholders. */
  progressTemplate: string;
  stepsLabel: string;
  estimatedCost: string;
  varies: string;
  moreHeading: string;
  seeDetailedAnswer: string;
  officialFormIntro: string;
  // On-device "copy your details into the official form" helper (no PDF, no egress).
  copyTitle: string;
  copyIntro: string;
  copyBtn: string;
  copied: string;
  // Explicit "save for offline" shell (EXP-01): panel, statuses, the burned-in
  // staleness banner, and the offline notice page. All local-only, like resume.
  offlineTitle: string;
  /** Plain-language intro that states the forensic trade-off (unencrypted, device-discoverable). */
  offlineIntro: string;
  offlineSaveBtn: string;
  offlineRemoveBtn: string;
  offlineSaving: string;
  /** Save confirmation with a {date} placeholder. */
  offlineSaved: string;
  offlineHaveCopy: string;
  offlineRemoved: string;
  offlineError: string;
  offlineUnsupported: string;
  offlineUpdated: string;
  /** Burned into every saved page with {date} and {days} placeholders. */
  offlineBanner: string;
  offlinePageTitle: string;
  offlineHeading: string;
  offlineLead: string;
  offlineSavedHeading: string;
  offlineNoneSaved: string;
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

/** The legal/policy + trust pages plus their titles and "last updated" label. */
export interface LegalMessages {
  updatedLabel: string;
  termsTitle: string;
  privacyTitle: string;
  accessibilityTitle: string;
  methodologyTitle: string;
  terms: LegalSection[];
  privacy: LegalSection[];
  accessibility: LegalSection[];
  methodology: LegalSection[];
}

/**
 * Strings for search-engine metadata and the indexable guide pages. Kept in the
 * locale bundle so the Spanish surface is a real, separately-rankable page, not an
 * afterthought. Templated entries are functions because the state name and topic vary.
 */
export interface SeoMessages {
  /** Keyword-shaped homepage <title> (brand is appended by the renderer). */
  homeTitle: string;
  homeDescription: string;
  guideIndexTitle: string;
  guideIndexDescription: string;
  guideIndexLead: string;
  guideIndexAllHeading: string;
  /** Display name of each change type, e.g. "Name change" / "Cambio de nombre". */
  topicName: Record<ChangeType, string>;
  guideTitle(stateName: string, topicName: string): string;
  guideHeading(stateName: string, topicName: string): string;
  guideDescription(stateName: string, topicName: string): string;
  guideLead(stateName: string, topicName: string): string;
  /** Call-to-action linking a guide page into the personalized checklist flow. */
  guideCta: string;
  guideReviewed: string;
  breadcrumbHome: string;
  breadcrumbGuides: string;
  /** Plain-language meta descriptions for the legal/trust pages. */
  legalDescription: { terms: string; privacy: string; accessibility: string; methodology: string };
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
  seo: SeoMessages;
}
