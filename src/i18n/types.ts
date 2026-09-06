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
  transparencyLink: string;
  a11yLink: string;
  methodologyLink: string;
  verifyNote: string;
  notFilingNote: string;
  sources: string;
  /** Caption for a source a REAL named roster human verified: "verified by {name}, {date}". */
  verifiedBy: string;
  /** Caption when the record's verifier is a placeholder: the honest not-yet state. */
  notHumanVerified: string;
  /** Label for the seed/recording date shown alongside the not-yet state. */
  recordedOn: string;
  /** Shown on a source that no automated drift watch can cover (api/watchability.ts). */
  sourceNotWatched: string;
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
  /** Accessible name for the `<section>` landmark wrapping a rendered answer (aria-label, not visible text — issue #151). */
  answerLandmarkLabel: string;
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
  /** Badge shown on a step the intake already marked complete (e.g. has_court_order). */
  alreadyDone: string;
  /** Per-step "report an error / law changed" link, wired to the law-changed issue template. */
  reportError: string;
  /** Destination disclosure rendered beside reportError: external GitHub link, public issue, account required. */
  reportErrorNote: string;
  /** Progress counter template with {done}/{total} placeholders. */
  progressTemplate: string;
  stepsLabel: string;
  estimatedCost: string;
  varies: string;
  /**
   * Shown when the corpus holds no record for the requested state, so every step on the
   * page is federal. Says only what is true of US — that we have nothing verified — and
   * asserts nothing about what that state does or does not require.
   */
  noStateCoverage: string;
  /**
   * Shown when some steps carry no fee in any cited source, so the summary total is a
   * floor rather than a cost. Mirrors the relocation planner's `costUnpriced`/`costHonesty`.
   */
  costIncomplete(unpricedSteps: number): string;
  moreHeading: string;
  seeDetailedAnswer: string;
  officialFormIntro: string;
  /** "What to bring" preparation-list heading on the form-fill page (rendered only when a form has cited items). */
  whatToBringTitle: string;
  // On-device "copy your details into the official form" helper (no PDF, no egress).
  copyTitle: string;
  copyIntro: string;
  copyBtn: string;
  copied: string;
  // Explicit "save for offline" shell (EXP-01): a user-initiated same-origin fetch,
  // local browser copies, statuses, the staleness banner, and the offline notice page.
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
  // Privacy-safe reminders: a client-side .ics task list of the steps (no server, no contact info).
  downloadIcs: string;
  downloadIcsNote: string;
}

/**
 * Strings for the relocation planner (docs/RELOCATION.md).
 *
 * READ THIS BEFORE ADDING ONE. Nothing in here may be a legal claim. These are STRUCTURAL
 * labels ("Do this before you move", "Cost we can't price yet") and CAUTIONS ("check this
 * against the official source") — the same non-substantive class as the existing
 * `ui.verifyNote` and `ui.discretionary`. Every substantive sentence on a relocation plan
 * comes from a corpus record's own statement, with its citation and last-verified date.
 * A jurisdiction-specific fact written here would be an uncited claim: the citation gate
 * (scripts/citation-coverage.ts, which now exercises the relocation surface) cannot see it,
 * which is precisely why it must not exist.
 */
export interface RelocationMessages {
  moveTitle: string;
  moveHeading: string;
  moveLead: string;
  /** The privacy promise for the most sensitive input this app takes. */
  movePrivacy: string;
  fromLegend: string;
  fromLabel: string;
  toLegend: string;
  toLabel: string;
  holdLegend: string;
  holdLead: string;
  submitPlan: string;
  sameStateError: string;

  planTitle: string;
  planHeading(originName: string, destName: string): string;
  planIntro: string;

  // Phase headings — structure, not law.
  phaseHave: string;
  phaseHaveLead: string;
  phaseBefore: string;
  phaseBeforeLead: string;
  phaseEither: string;
  phaseEitherLead: string;
  /**
   * The birth-certificate group. Structural, and the one place the plan states the asymmetry:
   * a birth record belongs to the state you were BORN in, the move does not change that, and we
   * never ask which state that is — so the plan shows both states it covers and says so. It
   * asserts no jurisdiction's rule; each state's rule comes from its own cited record.
   */
  phaseBirth: string;
  phaseBirthLead: string;
  phaseAfter: string;
  phaseAfterLead: string;

  // Per-step classification badges.
  classCarriesOver: string;
  classRedo: string;
  /** For a step taken under the OLD state's rules — must never read as "the new state". */
  classDoInOrigin: string;
  classKeep: string;
  /** For a birth certificate: the state of birth governs it, and moving does not change that. */
  classBirthState: string;
  classUnknown: string;
  /** Says plainly that we do not know what the destination does with an origin-issued document. */
  keepUnknownNote: string;
  /** Cross-link between the two routes to the same document: do ONE of them, not both. */
  alternativeRoute(otherStepOrder: number): string;

  // Ordering hazards.
  hazardsHeading: string;
  hazardPrereq(stepTitle: string, blockingTitle: string): string;
  hazardOriginWindow: string;
  hazardUnverified: string;
  /** The "applying is itself an act on a government record" caution. Asserts no rule. */
  hazardCreatesRecord: string;

  // Cost model — the #1 barrier, so it is explicit about its own gaps.
  costHeading: string;
  costFloor(amountUsd: number): string;
  costNothingPriced: string;
  costVariable(n: number): string;
  costUnpriced(n: number): string;
  costWaiver: string;
  costHonesty: string;

  gapsHeading: string;
  gapNoDestinationRecords(stateName: string): string;
  noStepsLead: string;
  planCta: string;
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
  transparencyTitle: string;
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
  /** Accessible name for the breadcrumb `<nav>` landmark (aria-label, not visible text — issue #151). */
  breadcrumbNav: string;
  /** Plain-language meta descriptions for the legal/trust pages. */
  legalDescription: { terms: string; privacy: string; accessibility: string; methodology: string };
  /** Meta description for the /transparency report page. */
  transparencyDescription: string;
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
  /** Relocation-planner chrome. Structural labels and cautions only — never a legal claim. */
  relocation: RelocationMessages;
  generator: GeneratorMessages;
  legal: LegalMessages;
  /**
   * Dated quarterly transparency-report entries (LegalSection[] shape: `h` is the
   * period label, `html` inventories records that may exist and local-only boundaries).
   * DRAFT POSTURE: no warrant-canary assertion ships here — see src/transparency.ts.
   */
  transparency: LegalSection[];
  seo: SeoMessages;
}
