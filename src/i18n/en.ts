// English bundle. This is the reference locale: the LocaleBundle interfaces in
// ./types.ts describe its shape, and every other locale must match it key for key.

import type { LocaleBundle } from "./types.ts";
import { DISCLOSURE } from "../../api/citation.ts";

export const en: LocaleBundle = {
  language: "en",
  selfName: "English",

  ui: {
    skip: "Skip to main content",
    bannerTitle: "Information, not legal advice",
    bannerBody: DISCLOSURE.aiAssisted, // title already carries the "not legal advice" sentence
    footer: "No account. Form-fill identity details stay on your device. Checklist choices and optional questions are sent to the server to render a response; see Privacy.",
    legalNav: "Legal and policies",
    termsLink: "Terms of Use",
    privacyLink: "Privacy",
    transparencyLink: "Transparency report",
    a11yLink: "Accessibility",
    methodologyLink: "How we source & verify",
    verifyNote: "This is general information, not legal advice. Requirements change, so always confirm with the official source linked on each step, and talk to a lawyer or legal-aid organization about your specific situation.",
    notFilingNote: "This tool doesn't file anything for you and isn't legal advice. Download the official form, complete it, and submit it yourself.",
    sources: "Sources",
    verifiedBy: "verified by",
    notHumanVerified: "not yet verified by a named reviewer",
    recordedOn: "recorded",
    sourceNotWatched: "We cannot check this source automatically for changes. Check it yourself before you file.",
    needsRecheck: "Needs reverification, so we don't show it as current.",
    discretionary: "Varies by court/clerk.",
    cost: "Cost",
    timeline: "Timeline",
    prereq: "Do first",
    step: "Step",
    print: "Print or save as PDF",
    startOver: "Start over",
    prepared: "Prepared on",
    packetIntro: "Your full plan, ready to print or save. It contains no information about you beyond the choices you made.",
    private: "Private mode: no account or saved session. Closing this tab clears unsaved browser state; request metadata may be retained as described in Privacy.",
    notCovered: "Not yet covered",
    resumeTitle: "Save your progress (optional, on this device)",
    resumeIntro: "Save only your selections, never names, encrypted with a passphrase you choose. The encrypted resume copy stays on this device, and saving it makes no network request; the selections were already used to render this page. Forget the passphrase and it can't be recovered.",
    passLabel: "Passphrase",
    saveBtn: "Save (encrypted)",
    resumeBtn: "Resume",
    deleteBtn: "Delete saved",
    intakeHeading: "Plan your legal name and gender-marker changes",
    intakeLead: "Answer a few questions and get a personalized, ordered checklist with the right forms and official sources for your state. You can use it without entering your name or account details.",
    whereLive: "Where do you live?",
    stateLabel: "State",
    whatChanging: "What are you changing?",
    changeNameLabel: "Legal name",
    changeMarkerLabel: "Gender marker",
    whichDocs: "Which documents do you want to update? (leave all unchecked for the recommended set)",
    languageLegend: "Language",
    submitChecklist: "Show my checklist",
    checklistTitle: "Your checklist",
    checklistHeading: "Your personalized checklist",
    checklistIntro: "Your steps are listed in the order most people complete them. Each links to its official source and the date it was last checked.",
    packetTitle: "Your packet",
    packetHeading: "Your name & gender-marker change packet",
    answerHeading: "What the sources say",
    answerLandmarkLabel: "Answer",
    formPrivacy: "What you type here stays in your browser and is not transmitted by this form helper.",
    fillDownload: "Fill & download",
    flatScanIntro: "This official form is a flat scan that can't be auto-filled. Download the blank form and complete it by hand:",
    gapNoRecords: "We don't have verified steps for this yet. Check your state's official website or a trans legal-aid organization.",
    gapAllDegraded: "The information we have for this may have changed and needs reverification, so we won't show it as current. Check the official source.",
    noStepsLead: "We couldn't build any verified steps for these choices yet.",
    notFoundHeading: "Page not found",
    notFoundBody: "We couldn't find that page.",
    badRequestHeading: "Invalid request",
    badRequestBody: "That isn't a state we recognize. Please pick one from the list.",
    methodHeading: "Method not allowed",
    methodBody: "Please use GET.",
    backToChecklist: "Back to your checklist",
    backToStart: "Start over",
    privacyLabel: "Privacy:",
    resEnterPass: "Enter a passphrase first.",
    resSaved: "Encrypted resume copy saved on this device. This save made no network request.",
    resNothing: "Nothing saved on this device.",
    resWrong: "Wrong passphrase, or the saved data was changed.",
    resDeleted: "Deleted from this device.",
    fillFilling: "Filling on your device…",
    fillDone: "Done. Your filled form downloaded, and it was never sent to a server.",
    fillUnfilled: "Downloaded. We couldn't auto-fill these fields, so complete them by hand: ",
    fillError: "Could not fill the form. You can download the blank form instead.",
    thinnerCoverage: "Full steps in your language for this state aren't ready yet. Federal steps are shown; switch to English to see more.",
    fillFormCta: "Fill this form on your device",
    getFormCta: "Get the official form",
    moreDetail: "More detail",
    markDone: "Mark done",
    alreadyDone: "Already done",
    reportError: "Out of date? Report an error or a law that changed",
    // PENDING counsel review — destination-disclosure copy (privacy representation); see docs/audits/dpia.md [Added 2026-07-09] row.
    reportErrorNote: "This link opens GitHub in a new tab. Reports are public and need a GitHub account.",
    progressTemplate: "{done} of {total} steps done",
    stepsLabel: "steps",
    estimatedCost: "Estimated cost",
    varies: "varies",
    noStateCoverage:
      "We don't have verified information for this state yet, so the steps below cover federal documents only. This is not a complete plan for where you live, and it is not a sign that your state asks nothing of you — we simply have not checked it. Start with your state's official website, its courts' self-help pages, or a trans legal-aid organization.",
    costIncomplete: (n: number) =>
      `${n} step(s) have no fee listed in our sources, so this is a floor, not a complete cost. We don't estimate what a source doesn't state.`,
    moreHeading: "Go deeper",
    seeDetailedAnswer: "See what the sources say in detail",
    helpHeading: "Where to get help",
    helpIntro: "These organizations publish their own guides or can help you directly.",
    officialFormIntro: "This is an official government form. Download it from the source below and complete it yourself — we don't fill it in for you, so you always work from the authoritative version.",
    whatToBringTitle: "What to bring",
    copyTitle: "Your details, ready to copy in",
    copyIntro: "Enter your name once, then copy it into the official form. The name entered here stays in your browser and is not transmitted by this helper.",
    copyBtn: "Copy",
    copied: "Copied to clipboard.",
    offlineTitle: "Save for offline (optional, on this device)",
    offlineIntro: "Keep a copy of your checklist and packet on this device so you can re-read them with no internet connection. When you press Save, your browser requests those pages and the offline shell from this service, then stores them locally; no background sync or push follows. Saved copies are not encrypted: anyone who can open this browser can read them. If someone checking your device is a risk for you, don't save—or delete the copies when you're done.",
    offlineSaveBtn: "Save for offline",
    offlineRemoveBtn: "Delete offline copies",
    offlineSaving: "Saving on this device...",
    offlineSaved: "Fetched from this service and saved on this device on {date}. No background sync is enabled.",
    offlineHaveCopy: "An offline copy of this page is saved on this device.",
    offlineRemoved: "All offline copies were deleted from this device.",
    offlineError: "Couldn't save on this device. You can still print or save as PDF.",
    offlineUnsupported: "This browser can't save pages for offline use.",
    offlineUpdated: "The offline app was updated. Your saved pages were kept.",
    offlineBanner: "Saved copy from {date}. Laws change: if more than {days} days have passed, re-check every step at its official source before you act.",
    offlinePageTitle: "You're offline",
    offlineHeading: "You're offline",
    offlineLead: "This page appears because you have no internet connection right now. If you saved pages for offline use, they're listed below and will open without a connection.",
    offlineSavedHeading: "Saved on this device",
    offlineNoneSaved: "No pages are saved for offline use on this device.",
    downloadIcs: "Add these steps to your calendar (.ics)",
    // PENDING counsel review — privacy-representation copy (docs/audits/dpia.md [Added 2026-07-09] .ics row).
    downloadIcsNote: "Creates a to-do list file on your device. It holds only the step names—no personal details—and creating it makes no network request. If you add the file to an online calendar, your calendar provider will store the step names.",
  },

  docTitles: {
    "court-order": "Get a court order for your name change",
    "ssa-card": "Update your Social Security record",
    "drivers-license": "Update your driver's license or state ID",
    passport: "Update your U.S. passport",
    "birth-certificate": "Amend your birth certificate",
    "financial-records": "Update financial and other records",
    "green-card": "Update your green card (Form I-90)",
    "naturalization-certificate": "Update your naturalization certificate (Form N-565)",
    ead: "Update your work permit (Employment Authorization Document)",
    "selective-service": "Update your Selective Service registration",
    "military-records": "Correct your military service record (DD-214)",
    "trusted-traveler": "Update your TSA PreCheck or Global Entry membership",
    "federal-employment-records": "Update your federal employment records",
  },

  docLabels: {
    "court-order": "Court order",
    "ssa-card": "Social Security card",
    "drivers-license": "Driver's license / state ID",
    passport: "U.S. passport",
    "birth-certificate": "Birth certificate",
    "financial-records": "Financial & other records",
    "green-card": "Green card (Form I-90)",
    "naturalization-certificate": "Naturalization certificate (Form N-565)",
    ead: "Work permit (EAD)",
    "selective-service": "Selective Service registration",
    "military-records": "Military service record (DD-214)",
    "trusted-traveler": "TSA PreCheck / Global Entry",
    "federal-employment-records": "Federal employment records",
  },

  fieldLabels: {
    new_legal_name: "New legal name",
    current_legal_name: "Current legal name",
    has_court_order: "I have a court order",
  },

  // Relocation planner. Structural labels + cautions ONLY — see RelocationMessages.
  relocation: {
    moveTitle: "Plan a move to another state",
    moveHeading: "Moving to another state",
    moveLead:
      "Tell us where you are moving from and to, and which documents you already have. We will show you what the move changes, in what order, and what each step costs — with a source for every step.",
    movePrivacy:
      "Where you are moving is not saved. There is no account. We do not log the states you pick or keep them after this page is built.",
    fromLegend: "Where you live now",
    fromLabel: "Current state",
    toLegend: "Where you are moving",
    toLabel: "New state",
    holdLegend: "What you already have",
    holdLead: "Check the documents you already hold. Leave them all unchecked if you are not sure.",
    submitPlan: "Show me the plan",
    sameStateError: "Pick two different states so we can show you what changes.",

    planTitle: "Your moving plan",
    planHeading: (from: string, to: string) => `Moving from ${from} to ${to}`,
    planIntro:
      "Each step below comes from an official source, with the date we last checked it. Steps are ordered so you do not get stuck: anything that is easier to do before you move comes first.",

    phaseHave: "What you already have",
    phaseHaveLead:
      "You told us you already hold these. They are here for reference, and because later steps ask for them.",
    phaseBefore: "Before you move",
    phaseBeforeLead:
      "These steps follow the rules of the state you are leaving. Our source for that state says the step happens where you live — so this route is open to you now and may not be later.",
    phaseEither: "Any time",
    phaseEitherLead: "These are federal documents. The same rules apply in both states, so the move does not change them.",
    phaseBirth: "Where you were born",
    phaseBirthLead:
      "Your birth certificate is held by the state you were born in. Moving does not change that, so it does not change whose rules apply. We do not ask where you were born, so both states in this plan are shown below. If you were born in another state, that state's rules apply and we do not cover it yet.",
    phaseAfter: "After you arrive",
    phaseAfterLead: "These steps follow the rules of the state you are moving to.",

    classCarriesOver: "Federal — the move does not change this",
    classRedo: "The new state has its own requirements",
    classDoInOrigin: "Done under the rules of the state you are leaving",
    classKeep: "You already have this",
    classBirthState: "Handled by the state you were born in — the move does not change this",
    classUnknown: "We do not have a verified source for this yet",
    keepUnknownNote:
      "This document was issued by the state you are leaving. Our sources do not say what the new state does with a document issued elsewhere, so we will not guess. Check the source on the step that asks for it.",
    alternativeRoute: (n: number) => `This is one of two routes to the same document. Do this one or step ${n} — not both.`,

    hazardsHeading: "Order matters",
    hazardPrereq: (step: string, blocker: string) =>
      `“${step}” asks you to bring the result of “${blocker}”. Do that one first, or you may be turned away.`,
    hazardOriginWindow:
      "The source for the state you are leaving says this step happens where you live. If you move first, you will likely have to start it over under the new state's rules instead.",
    hazardUnverified:
      "At least one rule behind this step changed recently, or our check on it is out of date. We will not show that rule as current. Read the official source before you act on this step.",
    hazardCreatesRecord:
      "Applying to a government agency creates a government record of your application. That is true of any application, and it is worth deciding on purpose — not by accident.",

    costHeading: "What this costs",
    costFloor: (amt: number) => `Fees our sources actually state: $${amt}.`,
    costNothingPriced: "Our sources do not state a fee for any step in this plan.",
    costVariable: (n: number) => `${n} step(s) have a fee that varies (for example, by county). We do not estimate it.`,
    costUnpriced: (n: number) => `${n} step(s) have no fee listed in our sources at all. Treat the total as incomplete.`,
    costWaiver: "A fee waiver is documented for at least one step. Look for it on the step below.",
    costHonesty:
      "This is a floor, not a total. We add up only the fees our sources state, and we say when we cannot price a step rather than guessing.",

    gapsHeading: "What we could not cover",
    gapNoDestinationRecords: (state: string) => `We do not have a verified source for this document in ${state} yet.`,
    noStepsLead: "We could not build a verified plan for that pair of states yet. Please check the official sources directly.",
    planCta: "Plan a move to another state",
  },

  generator: {
    costVaries: (note?: string) => (note ? ` Cost varies: ${note}` : " Cost varies."),
    costAbout: (amt: number, waiver: boolean) =>
      ` The typical cost is about $${amt}.${waiver ? " A fee waiver may be available if you cannot afford it." : ""}`,
    timeline: (typ: string, note?: string) => ` Typical timeline: ${typ}.${note ? ` ${note}` : ""}`,
    intro: "Here is what the official sources say for your situation. Each point links to its source and the date it was last checked.",
    discretionary: "This step is discretionary. The outcome can vary by court or clerk, so treat it as a likely path, not a guarantee.",
    refusal:
      "I don't have verified information for that yet, so I can't give you an answer I'd stand behind. " +
      "Please check the official source directly, or try a jurisdiction and document I currently cover.",
    freshness: (topic: string, date: string, title: string) =>
      `One related rule (${topic}) may have changed and needs reverification. I last checked it on ${date}, ` +
      `which is outside the freshness window, so I won't present it as current. Verify it directly at the official source: ${title}.`,
    disclosure: `${DISCLOSURE.notLegalAdvice} ${DISCLOSURE.aiAssisted}`,
  },

  legal: {
    updatedLabel: "Last updated:",
    termsTitle: "Terms of Use",
    privacyTitle: "Privacy Notice",
    accessibilityTitle: "Accessibility Statement",
    methodologyTitle: "How We Source & Verify",
    transparencyTitle: "Transparency Report",
    terms: [
      {
        h: "Information, not legal advice",
        html:
          "<p>Trans Docs Navigator gives you general, public information to help you understand the steps for a legal name or gender-marker change. It is <strong>not legal advice</strong>, it is not a substitute for a lawyer, and using it does not create an attorney–client relationship. For advice about your specific situation, talk to a licensed attorney or a trans legal-aid organization.</p>",
      },
      {
        h: "We don't guarantee accuracy — verify before you act",
        html:
          "<p>Laws, forms, fees, and timelines change, and they differ by court and county. We cite an official source and the date we last checked it for every requirement, but <strong>you must confirm the current rule with the official source before you act or file</strong>. The Service is provided “as is,” without warranties of any kind.</p>",
      },
      {
        h: "Not a filing service",
        html:
          "<p>The Service does not submit anything to any court or agency for you. Any forms it helps you fill are filled on your own device, and <strong>you are responsible</strong> for reviewing, completing, and filing them yourself.</p>",
      },
      {
        h: "Limitation of liability",
        html:
          "<p>To the fullest extent permitted by law, the project and its contributors are not liable for any loss or harm arising from your use of, or reliance on, the Service or its content. <em>(This section is subject to review by counsel before public launch.)</em></p>",
      },
      {
        h: "Your responsibilities",
        html:
          "<p>Use the information lawfully and for your own purposes. Confirm every requirement against the official source, and seek professional advice where your situation is uncertain or high-stakes.</p>",
      },
      {
        h: "Privacy",
        html:
          '<p>The Service minimizes records: it has no account or identity-profile database, while server-rendered pages still require request data and create bounded operational records. See the <a href="/privacy">Privacy Notice</a> for the exact boundaries.</p>',
      },
      {
        h: "Content and licensing",
        html:
          "<p>Government forms and texts are generally public; we record where each fact comes from. The Service's source code is licensed under AGPL-3.0. You may not present the Service as official, government, or legal-professional advice.</p>",
      },
      {
        h: "Changes to these terms",
        html: "<p>We may update these Terms. When we do, the “last updated” date below changes. Continued use means you accept the current version.</p>",
      },
    ],
    privacy: [
      {
        h: "The short version",
        html:
          "<p>The Service has no account or user-profile database. Identity details entered in the form helper stay on your device. To render a checklist or answer, your browser sends the choices in the page address and any optional free-text question to the server. <strong>Do not put a name, Social Security number, or other identifying detail in a question.</strong></p>",
      },
      {
        h: "Identity details used for forms",
        html:
          "<p>The on-device form helper does not transmit your name, date of birth, Social Security number, or identity-document data. That local-only boundary does not apply to the optional question box: a question is sent to the server exactly as entered.</p>",
      },
      {
        h: "What the server processes",
        html:
          "<p>The server transiently reads your state, change and document choices, language, court-order bookkeeping choice, and any optional question from the request URL. Free-text questions bypass the application cache and are not copied into application logs or responses. Selection-only checklist and answer renders may remain in a bounded in-memory cache until eviction or process restart. Because these are GET URLs, the full address may also remain in browser history or in infrastructure-provider access records.</p>",
      },
      {
        h: "Application and infrastructure logs",
        html:
          "<p>Application logs use a fixed allowlist: route template, response status, jurisdiction, selected change/document types, language, and other bounded operational fields. They exclude the raw question and identity-form fields. The live preview's application-log retention is 14 days; the production infrastructure template uses 30 days. Hosting and edge providers may keep separate network or access metadata under their own retention policies.</p>",
      },
      {
        h: "No cookies, no trackers",
        html: "<p>The Service uses no advertising or analytics trackers and sets no tracking cookies.</p>",
      },
      {
        h: "Optional “Save your progress” (on your device)",
        html:
          "<p>If you choose to save your progress, only your <em>selections</em>, never your name, are encrypted with a passphrase you choose and stored on your own device. The encrypted resume blob is not transmitted by the save action; the selections were already sent in the page request as described above. You can delete the local blob at any time with the “Delete saved” button or by clearing your browser storage.</p>",
      },
      {
        h: "Optional \"Save for offline\" (on your device)",
        html:
          "<p>If you choose to save pages for offline use, your browser makes explicit same-origin requests for the listed pages and offline shell; those request URLs and metadata are handled as described above. The resulting copies are stored <strong>unencrypted</strong> in browser storage on your device. Anyone who can open your browser or inspect the device may be able to read them. After that user-initiated fetch, the feature does no background syncing, push notifications, or periodic fetching. Opening a saved copy while offline makes no fresh request. Use “Delete offline copies” (or clear browser storage) when done. Every saved page shows its save date because laws change and an old copy can go stale.</p>",
      },
      {
        h: "Why we built it this way",
        html:
          "<p>We assume some people who use this may be in places that are hostile to trans people. The Service therefore avoids accounts and identity databases, keeps form identity details on-device, prevents raw questions from entering application logs or caches, and bounds application-log retention. This minimizes records; it does not mean no server or infrastructure record can exist.</p>",
      },
      {
        h: "Your choices",
        html:
          "<p>You can delete encrypted resume state and offline copies from your device at any time. The Service has no account or user-profile database. In-memory render entries expire through eviction or restart, application logs follow the retention periods above, and infrastructure providers may hold separate records outside this application's control.</p>",
      },
    ],
    accessibility: [
      {
        h: "Our goal",
        html: "<p>We aim to meet <strong>WCAG 2.2 Level AA</strong>. Accessibility is a release requirement, not an afterthought.</p>",
      },
      {
        h: "What we do",
        html:
          "<ul><li>Semantic HTML with a skip link and labelled controls.</li><li>The core flow works with <strong>no JavaScript</strong>.</li><li>Keyboard-complete paths and always-visible focus.</li><li>Sufficient colour contrast, checked automatically on every change.</li><li>Reduced-motion support and a calm, low-stimulation default.</li><li>Readable at 200% zoom and on small screens.</li></ul>",
      },
      {
        h: "What is still in progress",
        html:
          "<p>A full manual screen-reader, keyboard-only, and zoom walkthrough is part of our release process and is being completed before public launch. Automated checks (axe/pa11y and colour contrast) run on every change.</p>",
      },
      {
        h: "Tell us about a barrier",
        html:
          "<p>If something is hard to use, please let us know by opening an issue on the project repository. We treat accessibility barriers as bugs.</p>",
      },
    ],
    methodology: [
      {
        h: "Official sources only",
        html:
          "<p>Every requirement we show — a fee, a form, a wait time, a step order — is sourced from an <strong>official government source</strong>: a court, a state agency (DMV, vital records), the Social Security Administration, or the U.S. Department of State. We don't rely on forums, secondhand summaries, or other advocacy sites as a primary source, though we may link to a legal-aid guide for extra context.</p>",
      },
      {
        h: "How we verify a requirement",
        html:
          "<p>Before a fact enters the corpus, a reviewer reads the official source directly, records the exact page or document it came from, and records the date it was checked. That source URL and date travel with the fact everywhere it's shown — on a guide page, a checklist step, or a generated answer — so you can check our work. <strong>Current status:</strong> this is a demonstration preview. Independent, named-human verification of the seed corpus is still in progress, and no jurisdiction is presented as having completed it yet.</p>",
      },
      {
        h: "“Last checked” and going stale",
        html:
          "<p>Every requirement carries the date we last checked it and a re-check deadline (its freshness SLA). If a requirement passes that deadline before we've re-verified it, we don't keep showing it as current: it's automatically marked <strong>needs reverification</strong> and flagged in the interface, rather than silently going stale.</p>",
      },
      {
        h: "Report an error or a law change",
        html:
          "<p>Laws change faster than any small team can track alone. If you notice a requirement that's out of date or wrong, please open an issue on the project repository using the “law changed” report template. We treat a wrong requirement as a bug, and we prioritize fixing it over new features.</p>",
      },
      {
        h: "Partner review cadence",
        html:
          "<p>Beyond individual reports, our target operating model is a standing <strong>quarterly review</strong> of every jurisdiction's requirements with trans legal-aid partners: each quarter, a partner organization (or a named volunteer reviewer) re-checks that jurisdiction's official sources against what we publish; corrections are applied immediately, re-dated, and, where the change is substantive, noted in the project's release history. <strong>This cadence is not yet established:</strong> no partner organizations are onboarded today and no quarterly review cycle has run yet. Until a jurisdiction has an assigned reviewer and a completed review, it is marked accordingly rather than presented as partner-reviewed.</p>",
      },
    ],
  },

  transparency: [
    {
      h: "About this report",
      html:
        "<p>Data minimization is an architecture commitment, not a claim that the Service has zero server contact. This quarterly page summarizes what records the reference build may create and what stays on a user's device; see the <a href=\"/privacy\">Privacy Notice</a> for the complete boundary.</p>" +
        "<p><strong>This is not a legal-demand statistics report and does not include a warrant canary.</strong> Any statement about demands received, disclosures made, or canary status requires review by licensed counsel, which remains an explicit, <strong>open</strong> launch gate (see <a href=\"/terms\">Terms of Use</a>). No canary status — present or absent — should be inferred from this page.</p>",
    },
    {
      h: "Q2 2026 architecture snapshot (reviewed July 12, 2026)",
      html:
        "<p>This is a code-and-infrastructure inventory for the reference build, not a representation about any production legal demand. As documented in <code>docs/audits/dpia.md</code>:</p>" +
        "<p><strong>Records that may exist:</strong> request URLs carrying checklist selections and an optional question; bounded in-memory selection-only render-cache entries; allowlisted application logs containing route and selection metadata (14-day retention in the live preview, 30 days in the production template); and hosting-provider network, account, or access metadata under provider-controlled retention. Raw questions are excluded from the application cache, application logs, and rendered response, but a full GET URL may still appear in browser history or upstream access records.</p>" +
        "<p><strong>Local-storage boundaries:</strong> identity details typed into the form helper and the encrypted “save your progress” blob are not transmitted by those features. “Save for offline” explicitly requests the listed same-origin pages and shell assets, then keeps the resulting unencrypted copies in browser storage; it performs no background sync. None of these statements is an absolute claim about provider records, and users should not enter identifying details in an optional question.</p>",
    },
  ],

  seo: {
    homeTitle: "Legal name & gender-marker change guide, by state",
    homeDescription:
      "Plain-language, cited steps to change your legal name and gender marker in the US, with the right forms and official sources for your state. Not legal advice.",
    guideIndexTitle: "State-by-state name & gender-marker change guides",
    guideIndexDescription:
      "Cited, current guides to changing your legal name and gender marker in each state we cover, from court order through SSA, DMV, and passport.",
    guideIndexLead:
      "Pick your state and what you're changing. Each guide lists the steps in order, with costs, timelines, and a link to the official source for every requirement.",
    guideIndexAllHeading: "All guides",
    topicName: { name: "Name change", "gender-marker": "Gender-marker change" },
    guideTitle: (state, topic) => `${topic} in ${state}: steps, forms & costs`,
    guideHeading: (state, topic) => `${topic} in ${state}`,
    guideDescription: (state, topic) =>
      `How to complete a ${topic.toLowerCase()} in ${state}: the steps in order, what each costs, how long it takes, and the official source for every requirement.`,
    guideLead: (state, topic) =>
      `These are the steps most people follow for a ${topic.toLowerCase()} in ${state}, in order. Each links to its official source and the date we last checked it. When you're ready, build a personalized checklist that covers every document at once.`,
    guideCta: "Build my personalized checklist",
    guideReviewed: "Last reviewed",
    breadcrumbHome: "Home",
    breadcrumbGuides: "Guides",
    breadcrumbNav: "Breadcrumb",
    legalDescription: {
      terms: "The terms for using Trans Docs Navigator: general information, not legal advice, with no warranty. Verify every requirement against the official source.",
      privacy: "How Trans Docs Navigator handles server-rendered choices and questions, keeps identity form data on-device, and limits application logs and retention.",
      accessibility: "Our WCAG 2.2 AA accessibility commitment for Trans Docs Navigator, what we test automatically, and how to report a barrier.",
      methodology: "How Trans Docs Navigator sources and verifies every requirement from official government sources, plus the quarterly partner-review cadence we are establishing.",
    },
    transparencyDescription:
      "Dated quarterly entries on what Trans Docs Navigator could and could not produce under legal compulsion. No warrant canary yet — counsel review is pending.",

    feedIndexTitle: "Get notified when a state's records change (RSS)",
    feedIndexDescription:
      "Subscribe by RSS or Atom to updates for any state's name and gender-marker change records. No account, no email address, no tracking.",
    feedIndexLead:
      "Pick a state to get its feed link. Each feed tells you when we update our own records for that state — never a claim that the law itself changed.",
    feedIndexAllHeading: "All state feeds",
    feedLinkLabel: (state: string) => `Get notified when we update ${state}'s records (RSS)`,
    feedChannelTitle: (state: string) => `${state}: records updated`,
    feedChannelDescription: (state: string) =>
      `Notifications when Trans Docs Navigator updates its own cited records for ${state} — never a notification that the law itself changed. Subscribe with any RSS or Atom reader. No account, no email address, and nothing about you is collected to deliver this feed.`,
    feedEntryTitle: (count: number, state: string, date: string) =>
      `${count} record${count === 1 ? "" : "s"} for ${state} updated on ${date}`,
    feedEntryDescription: (count: number, state: string, date: string, docTypes: string) =>
      `We (re)verified ${count} record${count === 1 ? "" : "s"} for ${state} on ${date}, covering: ${docTypes}. This means our records changed — not necessarily the law. Always confirm with the official source linked on each step.`,
    feedEntryDegradedNote:
      "At least one of these records currently needs reverification and is not shown as current elsewhere on the site.",
    feedEmptyNote: "We don't have any dated records for this jurisdiction in this language yet.",
  },
};
