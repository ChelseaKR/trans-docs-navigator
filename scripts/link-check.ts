// Link-rot check (scheduled, not merge-blocking): every corpus source URL must still
// resolve. A dead citation is a broken safety property — the user is told to "confirm
// with the official source" and the link goes nowhere. Run weekly by
// .github/workflows/content-watch.yml, which opens an issue on failure.
//
// HEAD first, GET on 405/501 (some gov servers reject HEAD). Hard-fails only on
// definitive death (404/410) or DNS/conn errors; 403/429/5xx are reported as warnings
// since gov sites often bot-block, and a block is not rot.

import { loadCorpus } from "../api/corpus.ts";
import { loadForms } from "../api/forms.ts";
import { pass, fail } from "./util.ts";

const TIMEOUT_MS = 15_000;
const UA = "trans-docs-navigator-link-check/1.0 (+https://github.com/ChelseaKR/trans-docs-navigator)";

async function probe(url: string): Promise<{ ok: boolean; note?: string }> {
  for (const method of ["HEAD", "GET"]) {
    try {
      const res = await fetch(url, {
        method,
        redirect: "follow",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "user-agent": UA },
      });
      if (res.status === 405 || res.status === 501) continue; // try GET
      if (res.status === 404 || res.status === 410) return { ok: false, note: `HTTP ${res.status}` };
      if (!res.ok) return { ok: true, note: `HTTP ${res.status} (warning — possibly bot-blocked, not rot)` };
      return { ok: true };
    } catch (err) {
      if (method === "GET") return { ok: false, note: (err as Error).name };
    }
  }
  return { ok: true };
}

// Both corpus citations and the official-form links must stay live — a dead form link
// sends a user nowhere. (The form links rotted undetected before this gate covered them.)
const urls = [...new Set([...loadCorpus().map((r) => r.source.url), ...loadForms().map((f) => f.source.url)])];
const dead: string[] = [];
const warnings: string[] = [];

for (const url of urls) {
  const r = await probe(url);
  if (!r.ok) dead.push(`${url} — ${r.note}`);
  else if (r.note) warnings.push(`${url} — ${r.note}`);
}

for (const w of warnings) console.log(`  ⚠️  ${w}`);
if (dead.length > 0) fail("link-check", `${dead.length}/${urls.length} source URL(s) dead`, dead);
pass("link-check", `${urls.length} source URLs resolve (${warnings.length} warning(s))`);
