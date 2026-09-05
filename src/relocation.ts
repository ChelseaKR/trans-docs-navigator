// Relocation planner pages: the "moving from X to Y" intake and the destination-delta plan.
//
// Both render through the shared `page()` shell (src/render.ts), so they inherit the
// persistent "information, not legal advice" banner, the legal footer, the skip link and
// main landmark, and — because they pass no `seo` — the noindex default. The disclosure,
// a11y and SEO gates all check these pages by name; see scripts/{disclosure-check,a11y-lint,
// seo-lint}.ts.
//
// SAFETY NOTE — what is deliberately ABSENT here. The checklist page offers a "save for
// offline" panel (an UNENCRYPTED local copy) and an encrypted save/resume panel. Neither is
// rendered on a relocation plan. An unencrypted on-device copy of "I am leaving Texas for
// Washington" is a forensic artifact on a device that may be searched, and it is the single
// most sensitive thing this app can know. The plan is print-and-go instead. See
// docs/RELOCATION.md §Safety.

import type {
  CorpusRecord,
  DocumentType,
  FormDef,
  Language,
  OrderingHazard,
  RelocationPlan,
  RelocationPhase,
  RelocationStep,
} from "../api/types.ts";
import { page, uiStrings, escapeHtml, sourceItem } from "./render.ts";
import { t as locale } from "./i18n/index.ts";
import { formById } from "../api/forms.ts";

/** The states the planner offers, mirroring the checklist intake's list. */
export const RELOCATION_JURISDICTIONS: { id: string; label: string }[] = [
  { id: "US-AZ", label: "Arizona" },
  { id: "US-CA", label: "California" },
  { id: "US-FL", label: "Florida" },
  { id: "US-GA", label: "Georgia" },
  { id: "US-CO", label: "Colorado" },
  { id: "US-IL", label: "Illinois" },
  { id: "US-MI", label: "Michigan" },
  { id: "US-NJ", label: "New Jersey" },
  { id: "US-NY", label: "New York" },
  { id: "US-PA", label: "Pennsylvania" },
  { id: "US-TX", label: "Texas" },
  { id: "US-WA", label: "Washington" },
];

const HOLDABLE: DocumentType[] = ["court-order", "ssa-card", "drivers-license", "passport", "birth-certificate"];

/** Display name for a jurisdiction id; falls back to the raw id (e.g. "US" → "US"). */
export function jurisdictionName(id: string): string {
  return RELOCATION_JURISDICTIONS.find((j) => j.id === id)?.label ?? id;
}

/** The relocation intake. Bounded enums only — no identity fields, exactly like /. */
export function renderMovePage(lang: Language = "en", error?: "same-state"): string {
  const s = uiStrings(lang);
  const r = locale(lang).relocation;

  const options = (selected: string) =>
    RELOCATION_JURISDICTIONS.map(
      (j) => `<option value="${j.id}"${selected === j.id ? " selected" : ""}>${escapeHtml(j.label)}</option>`,
    ).join("");

  const docs = HOLDABLE.map(
    (d) => `<label><input type="checkbox" name="hold" value="${d}"> ${escapeHtml(locale(lang).docLabels[d])}</label>`,
  ).join("");

  const changeTypes = (["name", "gender-marker"] as const)
    .map(
      (c) =>
        `<label><input type="checkbox" name="change" value="${c}" checked> ${escapeHtml(c === "name" ? s.changeNameLabel : s.changeMarkerLabel)}</label>`,
    )
    .join("");

  const errorNote = error === "same-state" ? `<p class="flag" role="alert">${escapeHtml(r.sameStateError)}</p>` : "";

  const body = `
<p>${escapeHtml(r.moveLead)}</p>
<p class="meta" role="note">🔒 ${escapeHtml(r.movePrivacy)}</p>
${errorNote}
<form action="/plan" method="get" aria-label="${escapeHtml(r.moveHeading)}">
  <fieldset>
    <legend>${escapeHtml(r.fromLegend)}</legend>
    <label for="origin">${escapeHtml(r.fromLabel)}</label>
    <select id="origin" name="origin" required>${options("US-TX")}</select>
  </fieldset>
  <fieldset>
    <legend>${escapeHtml(r.toLegend)}</legend>
    <label for="destination">${escapeHtml(r.toLabel)}</label>
    <select id="destination" name="destination" required>${options("US-WA")}</select>
  </fieldset>
  <fieldset>
    <legend>${escapeHtml(s.whatChanging)}</legend>
    ${changeTypes}
  </fieldset>
  <fieldset>
    <legend>${escapeHtml(r.holdLegend)}</legend>
    <p class="meta">${escapeHtml(r.holdLead)}</p>
    ${docs}
  </fieldset>
  <fieldset>
    <legend>${escapeHtml(s.languageLegend)}</legend>
    <label for="rl-language">${escapeHtml(s.languageLegend)}</label>
    <select id="rl-language" name="language">
      <option value="en"${lang === "en" ? " selected" : ""}>English</option>
      <option value="es"${lang === "es" ? " selected" : ""}>Español</option>
    </select>
  </fieldset>
  <button type="submit">${escapeHtml(r.submitPlan)}</button>
</form>
<p class="no-print"><a href="/">${escapeHtml(s.backToStart)}</a></p>`;

  return page({ lang, title: r.moveTitle, heading: r.moveHeading, body });
}

/** Badge text for a step's classification. Structural label — never a legal claim. */
function classBadge(step: RelocationStep, lang: Language): string {
  const r = locale(lang).relocation;
  switch (step.step_class) {
    case "carries-over":
      return r.classCarriesOver;
    case "redo-in-destination":
      return r.classRedo;
    case "do-in-origin":
      return r.classDoInOrigin;
    case "keep-from-origin":
      return r.classKeep;
    case "governed-by-birth-state":
      return r.classBirthState;
    case "unknown":
      return r.classUnknown;
  }
}

/** The hazards attached to one step, rendered as visible warnings, not footnotes. */
function stepHazards(
  step: RelocationStep,
  plan: RelocationPlan,
  lang: Language,
): string {
  const r = locale(lang).relocation;
  const byKey = new Map(plan.steps.map((s) => [s.key, s]));
  const mine = plan.hazards.filter((h: OrderingHazard) => h.step_key === step.key);
  if (mine.length === 0) return "";

  const items = mine
    .map((h) => {
      switch (h.kind) {
        case "prerequisite-order": {
          const blocker = h.blocked_by ? byKey.get(h.blocked_by) : undefined;
          const blockerTitle = blocker ? locale(lang).docTitles[blocker.document_type] : "";
          return `<li class="flag">${escapeHtml(r.hazardPrereq(locale(lang).docTitles[step.document_type], blockerTitle))}</li>`;
        }
        case "origin-window-closes":
          return `<li class="flag">⏳ ${escapeHtml(r.hazardOriginWindow)}</li>`;
        case "unverified-destination-rule":
          return `<li class="flag">${escapeHtml(r.hazardUnverified)}</li>`;
        case "creates-government-record":
          return `<li class="meta">${escapeHtml(r.hazardCreatesRecord)}</li>`;
      }
    })
    .join("");
  return `<ul class="hazards">${items}</ul>`;
}

/** Source list for a step — the same record → citation rendering the checklist uses. */
function sources(records: CorpusRecord[], lang: Language): string {
  if (records.length === 0) return "";
  const t = locale(lang).ui;
  // Shared with the checklist/answer source list (src/render.ts) so the
  // "cannot be drift-watched" disclosure can never be present on one page and missing
  // on another — a relocation plan cites the same records under more time pressure.
  const items = records.map((rec) => sourceItem(rec.source, lang)).join("");
  return `<h4>${escapeHtml(t.sources)}</h4><ul>${items}</ul>`;
}

function renderStep(step: RelocationStep, plan: RelocationPlan, records: CorpusRecord[], lang: Language): string {
  const t = locale(lang).ui;
  const r = locale(lang).relocation;
  const langQ = lang === "es" ? "?language=es" : "";
  const byId = new Map(records.map((rec) => [rec.id, rec]));
  const stepRecords = step.record_ids.map((id) => byId.get(id)).filter((rec): rec is CorpusRecord => !!rec);

  // The ONLY substantive prose on this page: each backing record's own statement, cited.
  const claims = stepRecords.map((rec) => `<li>${escapeHtml(rec.statement)}</li>`).join("");
  const details = stepRecords.map((rec) => rec.detail).filter((d): d is string => !!d);
  const detailBlock = details.length
    ? `<details class="step-detail no-print"><summary>${escapeHtml(t.moreDetail)}</summary><ul>${details
        .map((d) => `<li>${escapeHtml(d)}</li>`)
        .join("")}</ul></details>`
    : "";

  const cost = step.cost
    ? `<p class="meta"><strong>${escapeHtml(t.cost)}:</strong> ${step.cost.amount_usd === null ? escapeHtml(step.cost.note ?? t.varies) : "$" + step.cost.amount_usd}${
        step.cost.amount_usd !== null && step.cost.note ? ` — ${escapeHtml(step.cost.note)}` : ""
      }</p>`
    : "";
  const time = step.timeline
    ? `<p class="meta"><strong>${escapeHtml(t.timeline)}:</strong> ${escapeHtml(step.timeline.typical)}</p>`
    : "";
  const disc = step.discretionary ? `<p class="flag">${escapeHtml(t.discretionary)}</p>` : "";

  const keepNote =
    step.step_class === "keep-from-origin" ? `<p class="flag" role="note">${escapeHtml(r.keepUnknownNote)}</p>` : "";

  const alt = step.alternative_to ? plan.steps.find((s) => s.key === step.alternative_to) : undefined;
  const altNote = alt ? `<p class="meta alt-route">🔀 ${escapeHtml(r.alternativeRoute(alt.order))}</p>` : "";

  // A step can need more than one official form (see ChecklistStep.form_refs) — link each.
  const formCta = (step.form_refs ?? [])
    .map((id) => formById(id))
    .filter((f): f is FormDef => !!f)
    .map(
      (form) =>
        `<p class="step-cta no-print"><a href="/forms/${escapeHtml(form.id)}${langQ}">📝 ${escapeHtml(t.getFormCta)}: ${escapeHtml(form.title)}</a></p>`,
    )
    .join("");

  return `<li class="step" data-step="${escapeHtml(step.key)}">
  <div class="step-head"><h3>${escapeHtml(t.step)} ${step.order}: ${escapeHtml(locale(lang).docTitles[step.document_type])}</h3></div>
  <p class="meta"><strong>${escapeHtml(classBadge(step, lang))}</strong> · ${escapeHtml(jurisdictionName(step.jurisdiction))}</p>
  ${altNote}${keepNote}
  ${claims ? `<ul>${claims}</ul>` : ""}
  ${cost}${time}${disc}
  ${stepHazards(step, plan, lang)}
  ${detailBlock}${formCta}
  ${sources(stepRecords, lang)}
</li>`;
}

const PHASES: RelocationPhase[] = [
  "already-have",
  "before-you-move",
  "either",
  "birth-state",
  "after-you-arrive",
];

function phaseCopy(phase: RelocationPhase, lang: Language): { heading: string; lead: string } {
  const r = locale(lang).relocation;
  switch (phase) {
    case "already-have":
      return { heading: r.phaseHave, lead: r.phaseHaveLead };
    case "before-you-move":
      return { heading: r.phaseBefore, lead: r.phaseBeforeLead };
    case "either":
      return { heading: r.phaseEither, lead: r.phaseEitherLead };
    case "birth-state":
      return { heading: r.phaseBirth, lead: r.phaseBirthLead };
    case "after-you-arrive":
      return { heading: r.phaseAfter, lead: r.phaseAfterLead };
  }
}

/**
 * The cost panel. Cost is the #1 reported barrier to relocation, so it leads with what the
 * sources actually state and is explicit — in the copy, not a footnote — about what it
 * cannot price. It never extrapolates a missing fee.
 */
function renderCosts(plan: RelocationPlan, lang: Language): string {
  const r = locale(lang).relocation;
  const c = plan.costs;
  if (c.lines.length === 0) return "";

  const parts: string[] = [];
  const anyStated = c.lines.some((l) => l.amount_usd !== null);
  parts.push(
    anyStated
      ? `<p class="plan-summary"><strong>${escapeHtml(r.costFloor(c.known_total_usd))}</strong></p>`
      : `<p class="plan-summary"><strong>${escapeHtml(r.costNothingPriced)}</strong></p>`,
  );
  if (c.variable_step_keys.length > 0) parts.push(`<p class="flag">${escapeHtml(r.costVariable(c.variable_step_keys.length))}</p>`);
  if (c.unpriced_step_keys.length > 0) parts.push(`<p class="flag">${escapeHtml(r.costUnpriced(c.unpriced_step_keys.length))}</p>`);
  if (c.fee_waiver_step_keys.length > 0) parts.push(`<p class="meta">💸 ${escapeHtml(r.costWaiver)}</p>`);
  parts.push(`<p class="meta">${escapeHtml(r.costHonesty)}</p>`);

  return `<section class="more" aria-labelledby="cost-h"><h2 id="cost-h">${escapeHtml(r.costHeading)}</h2>${parts.join("")}</section>`;
}

export function renderPlanPage(
  plan: RelocationPlan,
  records: CorpusRecord[],
  lang: Language,
  opts: { thinnerCoverage?: boolean } = {},
): string {
  const s = uiStrings(lang);
  const r = locale(lang).relocation;

  const coverageNote = opts.thinnerCoverage ? `<p class="flag" role="note">${escapeHtml(s.thinnerCoverage)}</p>` : "";
  const intro = `<p>${escapeHtml(r.planIntro)}</p>
<p class="flag" role="note">${escapeHtml(s.verifyNote)}</p>${coverageNote}
<p class="meta" role="note">🔒 ${escapeHtml(r.movePrivacy)}</p>`;

  const sections = PHASES.map((phase) => {
    const steps = plan.steps.filter((st) => st.phase === phase);
    if (steps.length === 0) return "";
    const copy = phaseCopy(phase, lang);
    const id = `phase-${phase}`;
    return `<section class="phase" aria-labelledby="${id}">
  <h2 id="${id}">${escapeHtml(copy.heading)}</h2>
  <p class="meta">${escapeHtml(copy.lead)}</p>
  <ol>${steps.map((st) => renderStep(st, plan, records, lang)).join("")}</ol>
</section>`;
  }).join("");

  const gaps = plan.gaps.length
    ? `<section aria-labelledby="gaps-h"><h2 id="gaps-h">${escapeHtml(r.gapsHeading)}</h2><ul>${plan.gaps
        .map(
          (g) =>
            `<li class="flag">${escapeHtml(locale(lang).docLabels[g.document_type])}: ${escapeHtml(
              r.gapNoDestinationRecords(jurisdictionName(g.jurisdiction)),
            )}</li>`,
        )
        .join("")}</ul></section>`
    : "";

  const empty =
    plan.steps.length === 0
      ? `<p class="flag" role="note">${escapeHtml(r.noStepsLead)}</p><p class="no-print"><a href="/move">${escapeHtml(s.backToStart)}</a></p>`
      : "";

  const actions = `<p class="no-print"><button type="button" id="print-btn">🖨️ ${escapeHtml(s.print)}</button> <a href="/move">${escapeHtml(s.startOver)}</a></p>
<script type="module" src="/assets/packet.js"></script>`;

  const body = intro + actions + empty + renderCosts(plan, lang) + sections + gaps;

  return page({
    lang,
    title: r.planTitle,
    heading: r.planHeading(jurisdictionName(plan.origin), jurisdictionName(plan.destination)),
    body,
  });
}
