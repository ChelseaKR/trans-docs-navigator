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
    footer: "Your answers stay in your browser. Nothing you enter is sent to or stored on a server.",
    legalNav: "Legal and policies",
    termsLink: "Terms of Use",
    privacyLink: "Privacy",
    a11yLink: "Accessibility",
    verifyNote: "This is general information, not legal advice. Requirements change, so always confirm with the official source linked on each step, and talk to a lawyer or legal-aid organization about your specific situation.",
    notFilingNote: "Filling this form here does not file it for you and is not legal advice. Review the official instructions and submit it yourself.",
    sources: "Sources",
    lastChecked: "last checked",
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
    private: "Private mode: no account, nothing saved. Closing this tab erases everything.",
    notCovered: "Not yet covered",
    resumeTitle: "Save your progress (optional, on this device)",
    resumeIntro: "Save only your selections, never names, encrypted with a passphrase you choose. It stays on this device and is never sent anywhere. Forget the passphrase and it can't be recovered.",
    passLabel: "Passphrase",
    saveBtn: "Save (encrypted)",
    resumeBtn: "Resume",
    deleteBtn: "Delete saved",
    intakeHeading: "Plan your legal name and gender-marker changes",
    intakeLead: "Answer a few questions and get a personalized, ordered checklist with the right forms and official sources for your state. You can also use this without entering any personal details.",
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
    formPrivacy: "What you type here stays in your browser. The form is filled on your device and never sent anywhere.",
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
    resSaved: "Saved on this device, encrypted. Nothing was sent anywhere.",
    resNothing: "Nothing saved on this device.",
    resWrong: "Wrong passphrase, or the saved data was changed.",
    resDeleted: "Deleted from this device.",
    fillFilling: "Filling on your device…",
    fillDone: "Done. Your filled form downloaded, and it was never sent to a server.",
    fillUnfilled: "Downloaded. We couldn't auto-fill these fields, so complete them by hand: ",
    fillError: "Could not fill the form. You can download the blank form instead.",
    thinnerCoverage: "Full steps in your language for this state aren't ready yet. Federal steps are shown; switch to English to see more.",
  },

  docTitles: {
    "court-order": "Get a court order for your name change",
    "ssa-card": "Update your Social Security record",
    "drivers-license": "Update your driver's license or state ID",
    passport: "Update your U.S. passport",
    "birth-certificate": "Amend your birth certificate",
    "financial-records": "Update financial and other records",
  },

  docLabels: {
    "court-order": "Court order",
    "ssa-card": "Social Security card",
    "drivers-license": "Driver's license / state ID",
    passport: "U.S. passport",
    "birth-certificate": "Birth certificate",
    "financial-records": "Financial & other records",
  },

  fieldLabels: {
    new_legal_name: "New legal name",
    current_legal_name: "Current legal name",
    has_court_order: "I have a court order",
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
          '<p>The Service is built to collect essentially nothing about you. See the <a href="/privacy">Privacy Notice</a> for details.</p>',
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
          "<p>We designed this Service to collect essentially nothing about you. You don't need an account. Your answers stay in your browser. Forms are filled on your device. <strong>Nothing you type is sent to or stored on our servers.</strong></p>",
      },
      {
        h: "What we never receive",
        html:
          "<p>Your name, date of birth, Social Security number, and any identity-document data are <strong>never sent to a server</strong>. Form pre-fill happens entirely in your browser.</p>",
      },
      {
        h: "What is processed to show your checklist",
        html:
          "<p>To build your checklist, the Service reads only non-identifying choices from the web address: your state, the document types you picked, and your language. These are not linked to you as a person.</p>",
      },
      {
        h: "Server logs",
        html:
          "<p>Our server keeps minimal technical logs limited to a fixed allowlist of non-identifying fields (for example: which page, the response status, and a jurisdiction code). No identifying information is logged, by design.</p>",
      },
      {
        h: "No cookies, no trackers",
        html: "<p>The Service uses no advertising or analytics trackers and sets no tracking cookies.</p>",
      },
      {
        h: "Optional “Save your progress” (on your device)",
        html:
          "<p>If you choose to save your progress, only your <em>selections</em>, never your name, are encrypted with a passphrase you choose and stored on your own device. They are never sent anywhere, and you can delete them at any time with the “Delete saved” button or by clearing your browser storage.</p>",
      },
      {
        h: "Why we built it this way",
        html:
          "<p>We assume some people who use this may be in places that are hostile to trans people. The strongest protection is to have nothing to hand over, so the Service is built to hold nothing about you.</p>",
      },
      {
        h: "Your choices",
        html:
          "<p>Because we store nothing about you on our servers, there is nothing for us to delete or disclose on request. You remain in control of any data saved locally on your device.</p>",
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
  },
};
