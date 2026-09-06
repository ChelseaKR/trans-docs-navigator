// "Where to get help": the jurisdiction's legal-aid and guide referrals (corpus/referrals/),
// rendered wherever a person is looking at one jurisdiction's rules — the checklist, the
// printable packet, the SEO guide pages, and the relocation plan (for the destination).
// One renderer so the four surfaces cannot drift apart in ordering or escaping.
import type { Language } from "../api/types.ts";
import type { UiMessages } from "./i18n/types.ts";
import { referralsFor } from "../api/referrals.ts";
import { escapeHtml } from "./render.ts";

/**
 * State entries first, then federal. Printable on purpose — a checklist carried to a clerk
 * should carry the phone-a-friend list too. Returns "" when the jurisdiction has no
 * referrals at all (the federal fallbacks make that effectively impossible today).
 */
export function renderHelpSection(jurisdiction: string, lang: Language, s: UiMessages): string {
  const refs = referralsFor(jurisdiction);
  if (refs.length === 0) return "";
  const ordered = [...refs.filter((r) => r.jurisdiction !== "US"), ...refs.filter((r) => r.jurisdiction === "US")];
  // `note` is keyed by the shipping locales only (api/referrals.ts validates both en and es
  // are present), so this fallback can never fire in production. It exists for the G9
  // pseudolocale gate, which serves `?language=en-XA`: indexing by a non-shipping tag
  // yields undefined, escapeHtml(undefined) throws, the route 500s, and the gate times out
  // waiting for a marker that never renders — the same trap that keeps /guide excluded
  // from that gate (see tests/e2e/i18n/pseudo-overflow.spec.ts). Corpus-sourced text is
  // not pseudolocalised anyway, so English is the honest fallback, not a leak.
  const noteFor = (r: (typeof ordered)[number]): string => r.note[lang] ?? r.note.en;
  const items = ordered
    .map((r) => `<li><a href="${escapeHtml(r.url)}" rel="noopener noreferrer">${escapeHtml(r.name)}</a> — ${escapeHtml(noteFor(r))}</li>`)
    .join("");
  return `<section class="help" aria-labelledby="help-h"><h2 id="help-h">${escapeHtml(s.helpHeading)}</h2><p class="meta">${escapeHtml(s.helpIntro)}</p><ul>${items}</ul></section>`;
}
