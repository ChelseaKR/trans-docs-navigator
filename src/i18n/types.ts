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
  /**
   * Heading for the sources of a step whose every backing record has lapsed. A separate
   * heading from `sources` on purpose: these links are NOT a citation for anything shown,
   * because nothing from those records is shown. They are the agency's own page, handed
   * over so "check the official source" is something the reader can act on.
   */
  staleSources: string;
  /** Sentence under `staleSources` saying what the link is and is not. */
  staleSourcesNote: string;
  /** Caption for a source a REAL named roster human verified: "verified by {name}, {date}". */
  verifiedBy: string;
  /** Caption when the record's verifier is a placeholder: the honest not-yet state. */
  notHumanVerified: string;
  /** Label for the seed/recording date shown alongside the not-yet state. */
  recordedOn: string;
  /** Shown on a source that no automated drift watch can cover (api/watchability.ts). */
  sourceNotWatched: string;
  needsRecheck: string;
  /**
   * Scope line for a step whose records belong to the state that ISSUED the document
   * rather than the one the reader lives in (`ChecklistStep.governed_by_issuing_jurisdiction`).
   * Says which government holds the record. It must never say, or let a reader infer, that
   * any state will honour another state's document — that is a separate, unbuilt question.
   */
  issuingJurisdictionScope(stateName: string): string;
  /** The same line where no state name resolves (a federal-jurisdiction request). */
  issuingJurisdictionScopeUnnamed: string;
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
  /**
   * Packet staleness check (/changes, EXP-03). These strings are load-bearing in a way
   * the rest of this bundle is not: they are what a person reads three months after
   * printing a packet, deciding whether to walk into a clerk's office with it. Without
   * per-record changelogs this page must never say a step is unchanged — see
   * api/changes.ts. `changesStateNoRecheck` is the wording that keeps that promise, and
   * it is phrased as a fact about this project, not about the law.
   */
  changesTitle: string;
  changesHeading: string;
  /** Link printed on the packet itself, so the check survives onto paper. */
  packetChangesLink: string;
  /** "Your packet was prepared on {date}." — the date is appended by the caller. */
  changesSince: string;
  changesIntro: string;
  /** Says plainly that per-record change history does not exist yet (FIX-03). */
  changesNoChangelog: string;
  /** The packet is older than the longest recheck window; run a fresh checklist. */
  changesExpired: string;
  changesStateReverified: string;
  changesStateNoRecheck: string;
  changesStateNeedsRecheck: string;
  /** Label for the newest verification date shown beside a step. */
  changesLastChecked: string;
  changesFreshChecklist: string;
  changesNoSteps: string;
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
   * Fee-waiver detail on a checklist/packet step (cost.fee_waiver_form/fee_waiver_criteria).
   * A FACT about the fee — "this fee can be waived" — never a judgement about whether THIS
   * reader would get it waived. See GOVERNANCE.md: this app does not adjudicate eligibility.
   */
  feeWaiverAvailable: string;
  /** Label preceding the official form's own title/link, e.g. "Form: Request to Waive Court Fees". */
  feeWaiverFormLabel: string;
  /** `The court says: "{quote}"` — {quote} is cost.fee_waiver_criteria, the court's own words. */
  feeWaiverCriteriaQuote(quote: string): string;
  /** Shown when a waiver form is sourced but its source never states specific criteria. */
  feeWaiverCriteriaUnstated: string;
  /**
   * Shown when the corpus holds no record for the requested state, so every step on the
   * page is federal. Says only what is true of US — that we have nothing verified — and
   * asserts nothing about what that state does or does not require.
   */
  noStateCoverage: string;
  /**
   * Shown when the intake said "this is for someone under 18" and the corpus holds no
   * minor-audience record for the requested state (every state outside the five-state
   * minors pilot — California, Illinois, New York, Texas, Washington — today). Says only
   * that WE have not checked minors here, and that the steps rendered below are the adult
   * ones and may not apply — never that the state itself requires or permits nothing for
   * a minor. See api/checklist.ts `hasNoMinorCoverage`.
   */
  noMinorCoverage: string;
  /**
   * Shown when some steps carry no fee in any cited source, so the summary total is a
   * floor rather than a cost. Mirrors the relocation planner's `costUnpriced`/`costHonesty`.
   */
  costIncomplete(unpricedSteps: number): string;
  moreHeading: string;
  seeDetailedAnswer: string;
  /** "Where to get help": legal-aid and guide referrals for the jurisdiction (corpus/referrals/). */
  helpHeading: string;
  helpIntro: string;
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
  /**
   * The "potentially waivable" subtotal (CostModel.potentially_waivable_usd) — a slice of
   * the floor above, not money on top of it. "Potentially" describes the FEE (a waiver
   * process is documented for it), never a prediction of whether this reader would get it.
   */
  costPotentiallyWaivable(amountUsd: number): string;
  costHonesty: string;

  gapsHeading: string;
  gapNoDestinationRecords(stateName: string): string;
  noStepsLead: string;
  planCta: string;
}

/**
 * Strings for the "which state?" comparison table (api/compare.ts) — the inverse of the
 * relocation planner: not "I'm moving from X to Y", but "which states have a documented
 * path for what I need, and which don't".
 *
 * READ THIS BEFORE ADDING ONE. This is the single most politically exposed surface in
 * the app: it must never rank, score, or characterize a state ("safe", "friendly",
 * "hostile", "better") — see docs/RELOCATION.md's sibling discipline for
 * RelocationMessages. Every string here is either UI chrome (form labels, a sort
 * toggle), a STRUCTURAL status label naming what the corpus holds (`documented`, `needs
 * reverification`, `no path documented`, `not covered`), or a plain-language definition
 * of those four labels. If a string you're about to add would let a reader rank states
 * against each other, it does not belong here — delete it instead.
 */
export interface CompareMessages {
  formTitle: string;
  formHeading: string;
  formLead: string;
  currentLegend: string;
  currentBlankOption: string;
  submit: string;
  /** Link text from /move and the intake page to this tool. */
  cta: string;

  resultsTitle: string;
  resultsHeading: string;
  resultsIntro: string;
  /** Table <caption> — what the table shows, never a value judgement about it. */
  caption: string;
  columnState: string;
  /** Appended to the row header of the jurisdiction matching the optional "current state". */
  currentMarker: string;

  // The four statuses. Short badge text (the table cell) + a plain-language definition
  // of what it means (the legend above the table). See CoverageStatus (api/types.ts).
  statusDocumented: string;
  statusNeedsReverification: string;
  statusNoPath: string;
  statusNotCovered: string;
  legendHeading: string;
  legendDocumented: string;
  legendNeedsReverification: string;
  legendNoPath: string;
  legendNotCovered: string;

  // Sort — a count of records, never a ranking. Exactly the neutral label the count is
  // named by; see api/compare.ts:documentedPathCount.
  sortLabel: string;
  sortAlpha: string;
  sortCount: string;

  /**
   * Footnote for the birth-certificate column. Structural, like the four status labels:
   * it names which government holds a birth record, which is a fact about the document
   * and not a comparison between states. Every other column in this table is about a
   * state the reader could move to; this one is not, and without the note the table reads
   * as though moving could change it.
   */
  birthCertificateScopeNote: string;
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
  /** Meta description for the /compare form — shorter than CompareMessages.formLead,
   *  which is the on-page paragraph and runs well past the SERP length budget. */
  compareDescription: string;
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

  // ── Per-jurisdiction change-alert feeds (RSS/Atom; no accounts, no PII) ──────────────
  // Entries must report only that OUR RECORDS changed, never that the law changed — see
  // api/feed.ts. Every string below carries that framing so a translator can't drop it.
  /** /feeds/ HTML index page: links every jurisdiction's feed. */
  feedIndexTitle: string;
  feedIndexDescription: string;
  feedIndexLead: string;
  feedIndexAllHeading: string;
  /** Plain link surfaced on a jurisdiction's checklist page (and each row of the index). */
  feedLinkLabel(stateName: string): string;
  /** RSS `<title>`, and the `<link rel="alternate" title="...">` autodiscovery label. */
  feedChannelTitle(stateName: string): string;
  /** RSS channel `<description>` — what this feed reports, before the trailing disclosure. */
  feedChannelDescription(stateName: string): string;
  /** One entry's `<title>`, e.g. "3 records for Washington updated on 2026-09-06". */
  feedEntryTitle(count: number, stateName: string, date: string): string;
  /**
   * One entry's `<description>` body (before the trailing disclosure is appended).
   *
   * `date` is the `source.last_verified` field the entry groups on. That field is a
   * RECORDED date and nothing more — it does not assert that a named human read the
   * source. This string must not say otherwise; `feedEntryHumanVerification` below is
   * where the human-reading question is answered, and it is computed.
   */
  feedEntryDescription(count: number, stateName: string, date: string, docTypes: string): string;
  /**
   * How many of an entry's records a NAMED HUMAN has confirmed against their official
   * source — computed from the records themselves (`isHumanVerified`), never written.
   *
   * The feed is the one surface whose subscribers hand over no identity, so there is no
   * channel through which a wrong claim here can later be corrected. It said
   * "We (re)verified N records" while every record in the corpus carried the
   * `Pilot Seed Reviewer` placeholder and the site's own caption beside each of them
   * read "not yet verified by a named reviewer" (issue #251).
   *
   * All three branches — none, some, all — are written here so this becomes true on its
   * own the day a real reviewer lands, rather than needing an edit nobody will remember.
   */
  feedEntryHumanVerification(humanVerified: number, count: number): string;
  /** Appended to an entry when at least one backing record currently needs reverification. */
  feedEntryDegradedNote: string;
  /** Shown when a jurisdiction has no dated records yet in the feed's language. */
  feedEmptyNote: string;
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
  /** "Which state?" comparison table chrome. Structural labels + plain-language status
   *  definitions only — see CompareMessages for why nothing here may rank a state. */
  compare: CompareMessages;
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
