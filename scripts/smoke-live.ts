// Post-deploy smoke against a LIVE, deployed instance (not the in-process server that
// scripts/smoke-journey.ts spawns). The lesson from the form-fill incident: "works in
// a test harness" must be backed by "works deployed." Run after a deploy:
//
//   SMOKE_URL=https://...lambda-url... node --experimental-strip-types scripts/smoke-live.ts
//
// Exits non-zero on any failure so the deploy workflow fails loudly.

import { pass, fail } from "./util.ts";

const base = (process.env.SMOKE_URL ?? process.argv[2] ?? "").replace(/\/+$/, "");
if (!base) fail("smoke-live", "set SMOKE_URL (or pass the base URL as an argument)");

interface Check { name: string; path: string; contains?: string[]; contentType?: string }
const CHECKS: Check[] = [
  { name: "healthz", path: "/healthz", contentType: "application/json", contains: ["corpus_records"] },
  { name: "intake (en)", path: "/", contains: ["Information, not legal advice", "We fully cover California"] },
  { name: "intake (es)", path: "/?lang=es", contains: ["Información, no asesoramiento legal"] },
  { name: "checklist + help/referrals", path: "/checklist?jurisdiction=US-CA&change=name", contains: ["Get help from a real person", "ID Documents Center", "ask for a fee waiver"] },
  { name: "degraded keeps source + why", path: "/checklist?jurisdiction=US-TX&change=gender-marker", contains: ["Needs reverification", "Safest thing to do today", "noopener"] },
  { name: "out-of-state honest path", path: "/checklist?jurisdiction=US-OH&change=name", contains: ["fully cover Ohio yet", "ID Documents Center"] },
  { name: "official form page", path: "/forms/us-ss-5", contains: ["ssa.gov/forms/ss-5.pdf", "Your details, ready to copy"] },
  { name: "guide", path: "/guide/california/name-change", contains: ["HowTo"] },
  { name: "sitemap", path: "/sitemap.xml", contentType: "application/xml", contains: ["<urlset"] },
  { name: "client assets", path: "/assets/progress.js", contentType: "text/javascript", contains: ["localStorage"] },
];

const errors: string[] = [];
for (const c of CHECKS) {
  try {
    const res = await fetch(base + c.path, { signal: AbortSignal.timeout(20_000) });
    if (res.status !== 200) { errors.push(`${c.name}: HTTP ${res.status}`); continue; }
    const ct = res.headers.get("content-type") ?? "";
    if (c.contentType && !ct.includes(c.contentType)) errors.push(`${c.name}: content-type ${ct}`);
    const body = await res.text();
    for (const s of c.contains ?? []) if (!body.includes(s)) errors.push(`${c.name}: missing "${s}"`);
    if (ct.includes("text/html")) {
      const csp = res.headers.get("content-security-policy") ?? "";
      if (!csp.includes("script-src 'self'") || csp.includes("unsafe-inline")) errors.push(`${c.name}: weak/missing CSP`);
    }
  } catch (err) {
    errors.push(`${c.name}: ${(err as Error).message}`);
  }
}

if (errors.length > 0) fail("smoke-live", `${errors.length} failure(s) against ${base}`, errors);
pass("smoke-live", `${CHECKS.length} live checks healthy at ${base}`);
