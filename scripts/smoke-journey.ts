// Synthetic user journey against the REAL server (not the render functions): spawns
// api/server.ts on an ephemeral port and walks intake → checklist → packet → form-fill
// in both languages, plus the static assets the pages depend on. Asserts status codes,
// the disclosure banner, and the strict CSP — the failure modes unit tests can't see
// (a header typo, an asset that 404s, a CSP that blocks the app's own scripts).
// Run with `make smoke`; CI runs it on every push.

import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = 8123;
const BASE = `http://localhost:${PORT}`;

const server = spawn(process.execPath, ["--experimental-strip-types", "--no-warnings", "api/server.ts"], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: "ignore",
});

async function waitForServer(): Promise<void> {
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(`${BASE}/healthz`);
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(100);
  }
  throw new Error("server did not start");
}

interface Check {
  name: string;
  path: string;
  /** Substrings that must appear in the body. */
  contains?: string[];
  contentType?: string;
}

const CHECKS: Check[] = [
  { name: "intake (en)", path: "/", contains: ["Information, not legal advice", "Plan your legal name", 'rel="canonical"'] },
  { name: "intake (es)", path: "/?language=es", contains: ["Información, no asesoramiento legal", "Planifique sus cambios", 'hreflang="es"'] },
  { name: "guide index (en)", path: "/guide", contains: ["All guides", 'rel="canonical"', "California"] },
  { name: "guide page (en)", path: "/guide/california/name-change", contains: ["HowTo", 'rel="canonical"', "Build my personalized checklist"] },
  { name: "guide page (es)", path: "/guide/illinois/gender-marker?language=es", contains: ["BreadcrumbList", "Crear mi lista"] },
  { name: "robots.txt", path: "/robots.txt", contentType: "text/plain", contains: ["Disallow: /checklist", "Sitemap:"] },
  { name: "sitemap.xml", path: "/sitemap.xml", contentType: "application/xml", contains: ["<urlset", "/guide/california/name-change", "hreflang"] },
  { name: "checklist (en)", path: "/checklist?jurisdiction=US-CA&change=name&change=gender-marker", contains: ["Information, not legal advice", "Step 1", "/forms/", "/assets/progress.js", "Go deeper"] },
  { name: "checklist (es)", path: "/checklist?jurisdiction=US-CA&change=name&language=es", contains: ["Información, no asesoramiento legal", "Paso 1"] },
  { name: "packet (en)", path: "/packet?jurisdiction=US-CA&change=name", contains: ["Information, not legal advice", "Prepared on"] },
  { name: "packet (es)", path: "/packet?jurisdiction=US-CA&change=name&language=es", contains: ["Preparado el"] },
  { name: "official form page", path: "/forms/us-ss-5", contains: ["Information, not legal advice", "ssa.gov/forms/ss-5.pdf", "Your details, ready to copy", "/assets/form-copy.js"] },
  { name: "terms (es)", path: "/terms?language=es", contains: ["Términos de uso"] },
  { name: "stylesheet", path: "/assets/app.css", contentType: "text/css", contains: ["focus-visible", "@media print"] },
  { name: "resume module", path: "/assets/resume-panel.js", contentType: "text/javascript", contains: ["resume-crypto.js"] },
  { name: "crypto module", path: "/assets/resume-crypto.js", contentType: "text/javascript", contains: ["AES-GCM"] },
  { name: "progress module", path: "/assets/progress.js", contentType: "text/javascript", contains: ["localStorage"] },
  { name: "copy-helper module", path: "/assets/form-copy.js", contentType: "text/javascript", contains: ["clipboard"] },
  { name: "packet module", path: "/assets/packet.js", contentType: "text/javascript" },
  { name: "healthz", path: "/healthz", contentType: "application/json", contains: ["corpus_records"] },
];

const errors: string[] = [];

try {
  await waitForServer();

  for (const c of CHECKS) {
    const res = await fetch(BASE + c.path);
    const body = await res.text();
    if (res.status !== 200) {
      errors.push(`${c.name}: HTTP ${res.status}`);
      continue;
    }
    const ct = res.headers.get("content-type") ?? "";
    if (c.contentType && !ct.includes(c.contentType)) errors.push(`${c.name}: content-type ${ct}`);
    for (const s of c.contains ?? []) {
      if (!body.includes(s)) errors.push(`${c.name}: missing "${s}"`);
    }
    // Every HTML response must carry the strict CSP — no inline escape hatches.
    if (ct.includes("text/html")) {
      const csp = res.headers.get("content-security-policy") ?? "";
      if (!csp.includes("script-src 'self'") || csp.includes("unsafe-inline")) {
        errors.push(`${c.name}: weak or missing CSP (${csp || "none"})`);
      }
      if (/<script>(?!<)/.test(body)) errors.push(`${c.name}: inline <script> would be blocked by the CSP`);
    }
  }

  // Error paths stay humane and localized.
  const bad = await fetch(`${BASE}/checklist?jurisdiction=US-XYZ&language=es`);
  if (bad.status !== 400) errors.push(`malformed jurisdiction: HTTP ${bad.status}, expected 400`);
  const missing = await fetch(`${BASE}/nope`);
  if (missing.status !== 404) errors.push(`unknown route: HTTP ${missing.status}, expected 404`);
} catch (err) {
  errors.push(`journey aborted: ${(err as Error).message}`);
} finally {
  server.kill();
}

if (errors.length > 0) {
  console.error(`  ❌ smoke: ${errors.length} failure(s)`);
  for (const e of errors) console.error(`     - ${e}`);
  process.exit(1);
}
console.log(`  ✅ smoke: ${CHECKS.length} pages/assets healthy in both languages (strict CSP everywhere)`);
