// Per-jurisdiction change-alert feeds — presentation layer (RSS 2.0 XML + the HTML
// index page). The data this renders comes from api/feed.ts; see that file's header
// for the data-source decision (record-field-derived, not git/manifest history).
//
// HONESTY (see api/feed.ts and the disclosure gate, scripts/disclosure-check.ts): every
// channel description and every item description says plainly that this reports changes
// to OUR RECORDS, never a claim that the law itself changed, and carries the same
// "information, not legal advice" disclosure every other page/answer does.
//
// PRIVACY: a feed is a public, stateless GET — no accounts, no email signup, nothing
// about the subscriber is collected or logged to deliver it (api/router.ts logs only
// the already-public jurisdiction + language + status, same allowlisted shape as every
// other route).

import type { CorpusRecord, JurisdictionId, Language } from "../api/types.ts";
import { loadCorpus, loadVerifierRoster } from "../api/corpus.ts";
import { buildJurisdictionFeed } from "../api/feed.ts";
import { STATES, stateNameFor } from "./guide.ts";
import { page, escapeHtml, type FeedLink } from "./render.ts";
import { t as locale } from "./i18n/index.ts";
import { SITE_ORIGIN } from "./seo.ts";

/** The route path (no origin, no query) for a jurisdiction's feed. */
export function feedPath(jurisdiction: JurisdictionId): string {
  return `/feeds/${jurisdiction}.xml`;
}

/**
 * The feed link to surface on a jurisdiction's checklist page: `undefined` for a
 * jurisdiction with no display name (today, only federal "US" — same reasoning as
 * src/guide.ts's per-state-only guide pages: there is no per-jurisdiction surface to
 * point at, so none is offered rather than a link that can never resolve to content
 * a user would recognize as "their state").
 */
export function feedLinkFor(jurisdiction: JurisdictionId, lang: Language): (FeedLink & { stateName: string }) | undefined {
  const stateName = stateNameFor(jurisdiction, lang);
  if (!stateName) return undefined;
  const href = `${feedPath(jurisdiction)}${lang === "es" ? "?language=es" : ""}`;
  return { href, title: locale(lang).seo.feedChannelTitle(stateName), stateName };
}

/** Escape for an XML TEXT node (element content). `"`/`'` need no escaping there —
 *  only inside an attribute value (see `escapeXmlAttr`) — so plain text (a state's
 *  name with an apostrophe, a record's own statement) renders unmangled. */
function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Escape for an XML ATTRIBUTE value (double-quoted, per this file's own templates). */
function escapeXmlAttr(s: string): string {
  return escapeXml(s).replace(/"/g, "&quot;");
}

/** RFC 822/1123 date (the RSS `pubDate`/`lastBuildDate` format), from a YYYY-MM-DD date. */
function rfc822(dateIso: string): string {
  return new Date(`${dateIso}T00:00:00Z`).toUTCString();
}

/**
 * RSS 2.0 XML for one jurisdiction, in one language. Pure and deterministic: given the
 * same corpus + `today`, byte-identical every time — no wall-clock `now`, no git.
 */
export function renderJurisdictionFeedXml(
  jurisdiction: JurisdictionId,
  stateName: string,
  lang: Language,
  today?: string,
  corpus: CorpusRecord[] = loadCorpus(),
  roster: ReturnType<typeof loadVerifierRoster> = loadVerifierRoster(),
): string {
  const entries = buildJurisdictionFeed(jurisdiction, lang, today, corpus, roster);
  const seo = locale(lang).seo;
  const docLabels = locale(lang).docLabels;
  const disclosure = locale(lang).generator.disclosure;

  const langQ = lang === "es" ? "?language=es" : "";
  const selfUrl = `${SITE_ORIGIN}${feedPath(jurisdiction)}${langQ}`;
  const channelLink = `${SITE_ORIGIN}/checklist?jurisdiction=${jurisdiction}${lang === "es" ? "&language=es" : ""}`;

  const itemsXml = entries
    .map((e) => {
      const docTypes = e.documentTypes.map((d) => docLabels[d]).join(", ");
      const title = seo.feedEntryTitle(e.recordIds.length, stateName, e.date);
      const description = [
        seo.feedEntryDescription(e.recordIds.length, stateName, e.date, docTypes),
        // Computed from the entry's own records, never written (issue #251). A
        // subscriber hands over no identity to read this, so there is no channel
        // through which a wrong claim about human verification could be corrected.
        seo.feedEntryHumanVerification(e.humanVerified, e.recordIds.length),
        e.degraded ? seo.feedEntryDegradedNote : "",
        disclosure,
      ]
        .filter(Boolean)
        .join(" ");
      const guid = `${selfUrl}#${e.date}`;
      return `  <item>
    <title>${escapeXml(title)}</title>
    <link>${escapeXml(channelLink)}</link>
    <guid isPermaLink="false">${escapeXml(guid)}</guid>
    <pubDate>${rfc822(e.date)}</pubDate>
    <description>${escapeXml(description)}</description>
  </item>`;
    })
    .join("\n");

  const channelDescription = [
    seo.feedChannelDescription(stateName),
    entries.length === 0 ? seo.feedEmptyNote : "",
    disclosure,
  ]
    .filter(Boolean)
    .join(" ");
  const lastBuildDate = entries[0] ? `\n  <lastBuildDate>${rfc822(entries[0].date)}</lastBuildDate>` : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${escapeXml(seo.feedChannelTitle(stateName))}</title>
  <link>${escapeXml(channelLink)}</link>
  <atom:link href="${escapeXmlAttr(selfUrl)}" rel="self" type="application/rss+xml"/>
  <description>${escapeXml(channelDescription)}</description>
  <language>${lang}</language>${lastBuildDate}
  <docs>https://www.rssboard.org/rss-specification</docs>
${itemsXml}
</channel>
</rss>
`;
}

/** The /feeds/ index: every covered jurisdiction's feed link, plus its most recent entry
 *  (so a visitor can tell a live, updating feed from an empty one before subscribing). */
export function renderFeedsIndex(lang: Language): string {
  const seo = locale(lang).seo;
  const corpus = loadCorpus();
  const rows = STATES.map((s) => {
    const name = s.name[lang];
    const href = `${feedPath(s.id)}${lang === "es" ? "?language=es" : ""}`;
    const entries = buildJurisdictionFeed(s.id, lang, undefined, corpus);
    const latest = entries[0];
    const meta = latest
      ? escapeHtml(seo.feedEntryTitle(latest.recordIds.length, name, latest.date))
      : escapeHtml(seo.feedEmptyNote);
    return `<li><a href="${escapeHtml(href)}">${escapeHtml(seo.feedLinkLabel(name))}</a><br><span class="meta">${meta}</span></li>`;
  }).join("");
  const body = `<p>${escapeHtml(seo.feedIndexLead)}</p><h2 class="sr-only">${escapeHtml(seo.feedIndexAllHeading)}</h2><ul>${rows}</ul>`;
  return page({
    lang,
    title: seo.feedIndexTitle,
    heading: seo.feedIndexTitle,
    body,
    seo: { path: "/feeds", description: seo.feedIndexDescription, index: true },
  });
}
