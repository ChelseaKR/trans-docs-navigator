// "Which state?" comparison pages: the form at /compare and the results table at
// /compare?doc=...&change=.... Server-rendered, works with no client JavaScript — the
// sort control is two plain links (a new GET request), not a script.
//
// NO EDITORIAL RANKING (read this before touching this file). This renders exactly four
// STRUCTURAL statuses (api/types.ts:CoverageStatus), each one a fact about what the
// corpus holds, never a characterization of a state. There is no score, no color scale
// implying good/bad, and the one sort this page offers is a literal count ("number of
// documented paths"), labelled as exactly that. If you're about to write a sentence
// comparing states to each other, stop — that sentence does not belong here.

import type { ChangeType, CompareCell, CompareRow, CompareTable, CorpusRecord, CoverageStatus, DocumentType, JurisdictionId, Language } from "../api/types.ts";
import { documentedPathCount } from "../api/compare.ts";
import { page, uiStrings, escapeHtml, sourceItem } from "./render.ts";
import { t as locale } from "./i18n/index.ts";
import { RELOCATION_JURISDICTIONS, jurisdictionName } from "./relocation.ts";

const SELECTABLE_DOCS: DocumentType[] = ["court-order", "ssa-card", "drivers-license", "passport", "birth-certificate", "financial-records"];
const CHANGE_ORDER: ChangeType[] = ["name", "gender-marker"];

export type CompareSort = "alpha" | "count";

/** The comparison form: what to update, and (optionally) the state you're in now. */
export function renderCompareFormPage(lang: Language = "en"): string {
  const s = uiStrings(lang);
  const c = locale(lang).compare;

  const docs = SELECTABLE_DOCS.map(
    (d) => `<label><input type="checkbox" name="doc" value="${d}"> ${escapeHtml(locale(lang).docLabels[d])}</label>`,
  ).join("");
  const changes = CHANGE_ORDER.map(
    (ct) =>
      `<label><input type="checkbox" name="change" value="${ct}" checked> ${escapeHtml(ct === "name" ? s.changeNameLabel : s.changeMarkerLabel)}</label>`,
  ).join("");
  const stateOptions = RELOCATION_JURISDICTIONS.map((j) => `<option value="${j.id}">${escapeHtml(j.label)}</option>`).join("");

  const body = `
<p>${escapeHtml(c.formLead)}</p>
<form action="/compare" method="get" aria-label="${escapeHtml(c.formHeading)}">
  <fieldset>
    <legend>${escapeHtml(s.whatChanging)}</legend>
    ${changes}
  </fieldset>
  <fieldset>
    <legend>${escapeHtml(s.whichDocs)}</legend>
    ${docs}
  </fieldset>
  <fieldset>
    <legend>${escapeHtml(c.currentLegend)}</legend>
    <label for="compare-current">${escapeHtml(s.stateLabel)}</label>
    <select id="compare-current" name="current">
      <option value="">${escapeHtml(c.currentBlankOption)}</option>
      ${stateOptions}
    </select>
  </fieldset>
  <fieldset>
    <legend>${escapeHtml(s.languageLegend)}</legend>
    <label for="compare-language">${escapeHtml(s.languageLegend)}</label>
    <select id="compare-language" name="language">
      <option value="en"${lang === "en" ? " selected" : ""}>English</option>
      <option value="es"${lang === "es" ? " selected" : ""}>Español</option>
    </select>
  </fieldset>
  <button type="submit">${escapeHtml(c.submit)}</button>
</form>
<p class="no-print"><a href="/move${lang === "es" ? "?language=es" : ""}">🚚 ${escapeHtml(locale(lang).relocation.planCta)}</a></p>
<p class="no-print"><a href="/">${escapeHtml(s.backToStart)}</a></p>`;

  return page({
    lang,
    title: c.formTitle,
    heading: c.formHeading,
    body,
    seo: { path: "/compare", description: locale(lang).seo.compareDescription, index: true },
  });
}

/** Rebuild a canonical /compare query — never echoes the raw request query string. */
function compareQuery(table: CompareTable, opts: { current?: JurisdictionId; sort: CompareSort }): string {
  const sp = new URLSearchParams();
  for (const d of table.documents) sp.append("doc", d);
  for (const c of table.change_types) sp.append("change", c);
  if (opts.current) sp.set("current", opts.current);
  if (opts.sort !== "alpha") sp.set("sort", opts.sort);
  return sp.toString();
}

const STATUS_CLASS: Record<CoverageStatus, string> = {
  documented: "status-documented",
  needs_reverification: "status-needs-reverification",
  no_path_documented: "status-no-path",
  not_covered: "status-not-covered",
};

function statusLabel(status: CoverageStatus, c: ReturnType<typeof locale>["compare"]): string {
  switch (status) {
    case "documented":
      return c.statusDocumented;
    case "needs_reverification":
      return c.statusNeedsReverification;
    case "no_path_documented":
      return c.statusNoPath;
    case "not_covered":
      return c.statusNotCovered;
  }
}

/** Column header for one (document × change) pair — short labels, not full sentences,
 *  so the table stays legible under text expansion. The change is dropped from the
 *  header when only one was selected (nothing to disambiguate). */
function columnHeader(doc: DocumentType, change: ChangeType, singleChange: boolean, lang: Language): string {
  const s = uiStrings(lang);
  const docLabel = locale(lang).docLabels[doc];
  if (singleChange) return docLabel;
  const changeLabel = change === "name" ? s.changeNameLabel : s.changeMarkerLabel;
  return `${docLabel} — ${changeLabel}`;
}

/**
 * The records to actually show for one cell: prefer the display language, falling back
 * to the (English) records the cell was classified from when no translation exists yet
 * — a presentation gap, never a reason to show nothing for a cell already known to have
 * a record. Mirrors api/checklist.ts:hasThinnerLanguageCoverage's English-is-canonical
 * choice, applied to what's actually rendered rather than to the coverage signal.
 */
function cellRecords(corpus: CorpusRecord[], cell: CompareCell, lang: Language): CorpusRecord[] {
  const inLang = corpus.filter(
    (r) =>
      r.jurisdiction === cell.jurisdiction &&
      r.document_type === cell.document_type &&
      r.change_type.includes(cell.change_type) &&
      r.language === lang,
  );
  if (inLang.length > 0) return inLang;
  const byId = new Map(corpus.map((r) => [r.id, r]));
  return cell.record_ids.map((id) => byId.get(id)).filter((r): r is CorpusRecord => !!r);
}

/** One cell: a short status badge, and — whenever a record backs it — a disclosure
 *  linking straight to it. Never a link with no context: "not_covered" carries nothing
 *  to link to, so it renders as plain text. */
function renderCell(cell: CompareCell, corpus: CorpusRecord[], lang: Language, header: string): string {
  const s = uiStrings(lang);
  const c = locale(lang).compare;
  const badge = `<span class="cell-status ${STATUS_CLASS[cell.status]}">${escapeHtml(statusLabel(cell.status, c))}</span>`;
  if (cell.status === "not_covered") {
    return `<td role="cell" data-label="${escapeHtml(header)}">${badge}</td>`;
  }
  const records = cellRecords(corpus, cell, lang);
  const claims = records.map((r) => `<li>${escapeHtml(r.statement)}</li>`).join("");
  const sources = records.map((r) => sourceItem(r.source, lang)).join("");
  const details = `<details class="step-detail no-print"><summary>${escapeHtml(s.sources)}</summary><ul>${claims}</ul><ul>${sources}</ul></details>`;
  return `<td role="cell" data-label="${escapeHtml(header)}">${badge}${details}</td>`;
}

function sortRows(rows: CompareRow[], sort: CompareSort, lang: Language): CompareRow[] {
  const byName = (r: CompareRow) => jurisdictionName(r.jurisdiction);
  const sorted = [...rows];
  if (sort === "count") {
    sorted.sort((a, b) => documentedPathCount(b) - documentedPathCount(a) || byName(a).localeCompare(byName(b), lang));
  } else {
    sorted.sort((a, b) => byName(a).localeCompare(byName(b), lang));
  }
  return sorted;
}

export function renderCompareResultsPage(
  table: CompareTable,
  corpus: CorpusRecord[],
  lang: Language,
  opts: { current?: JurisdictionId; sort?: CompareSort; thinnerCoverage?: boolean } = {},
): string {
  const s = uiStrings(lang);
  const c = locale(lang).compare;
  const sort: CompareSort = opts.sort === "count" ? "count" : "alpha";
  const singleChange = table.change_types.length === 1;

  const columns = table.documents.flatMap((doc) => table.change_types.map((ct) => ({ doc, change: ct })));
  const headers = columns.map((col) => columnHeader(col.doc, col.change, singleChange, lang));

  const coverageNote = opts.thinnerCoverage ? `<p class="flag" role="note">${escapeHtml(s.thinnerCoverage)}</p>` : "";
  const intro = `<p>${escapeHtml(c.resultsIntro)}</p>
<p class="flag" role="note">${escapeHtml(s.verifyNote)}</p>${coverageNote}`;

  const legend = `<section class="more" aria-labelledby="compare-legend-h">
  <h2 id="compare-legend-h">${escapeHtml(c.legendHeading)}</h2>
  <ul>
    <li>${escapeHtml(c.legendDocumented)}</li>
    <li>${escapeHtml(c.legendNeedsReverification)}</li>
    <li>${escapeHtml(c.legendNoPath)}</li>
    <li>${escapeHtml(c.legendNotCovered)}</li>
  </ul>
</section>`;

  // Sort toggle — two plain GET links (no JS): the inactive option is a link to the
  // same table re-sorted; the active one renders as plain text so it's clear which
  // applies. A literal count, never a ranking — see api/compare.ts:documentedPathCount.
  const sortLinkOrText = (which: CompareSort) => {
    const label = which === "alpha" ? c.sortAlpha : c.sortCount;
    if (which === sort) return `<strong aria-current="true">${escapeHtml(label)}</strong>`;
    const q = compareQuery(table, { ...(opts.current ? { current: opts.current } : {}), sort: which });
    return `<a href="/compare?${q}${lang === "es" && !q.includes("language=") ? "&language=es" : ""}">${escapeHtml(label)}</a>`;
  };
  const sortControls = `<p class="meta no-print">${escapeHtml(c.sortLabel)} ${sortLinkOrText("alpha")} · ${sortLinkOrText("count")}</p>`;

  const rows = sortRows(table.rows, sort, lang);
  const bodyRows = rows
    .map((row) => {
      const isCurrent = !!opts.current && row.jurisdiction === opts.current;
      const rowHeader = `${escapeHtml(jurisdictionName(row.jurisdiction))}${isCurrent ? ` <span class="meta">(${escapeHtml(c.currentMarker)})</span>` : ""}`;
      const cells = row.cells.map((cell, i) => renderCell(cell, corpus, lang, headers[i] ?? "")).join("");
      return `<tr role="row"><th scope="row" role="rowheader">${rowHeader}</th>${cells}</tr>`;
    })
    .join("");

  // Explicit table/rowgroup/row/cell roles: the mobile card layout (src/render.ts
  // STYLE, <640px) sets display:block on every table-related element so it can be
  // restyled as stacked cards, and browsers drop the IMPLICIT table-related ARIA role
  // the moment display leaves the table/table-row/table-cell family. Explicit roles
  // keep a screen reader's table semantics (row/column header associations) intact
  // regardless of which layout the viewport is using.
  const table_ = `<div class="table-scroll"><table class="compare-table" role="table">
  <caption>${escapeHtml(c.caption)}</caption>
  <thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader">${escapeHtml(c.columnState)}</th>${headers.map((h) => `<th scope="col" role="columnheader">${escapeHtml(h)}</th>`).join("")}</tr></thead>
  <tbody role="rowgroup">${bodyRows}</tbody>
</table></div>`;

  const actions = `<p class="no-print"><a href="/compare${lang === "es" ? "?language=es" : ""}">${escapeHtml(s.backToStart)}</a></p>`;

  const body = intro + legend + sortControls + table_ + actions;
  return page({ lang, title: c.resultsTitle, heading: c.resultsHeading, body });
}
