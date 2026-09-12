// The portable single-file edition (#233), proven against the edition it copies.
//
// The whole risk of shipping a second edition of a legal-information tool is that it
// becomes a second, quieter answer: a bundle that renders, looks right, and has silently
// lost a module, a corpus directory, or a binding. Nothing about a page that opens tells
// a reader it is short a step. So the load-bearing test here is byte-equality — the
// bundle's own `handleRoute`, evaluated out of the SHIPPED FILE, against the
// repository's, across the eval gold set and a route matrix, in both languages.
//
// Everything is measured against the built artifact, never against the builder's
// intermediate values: the script is extracted from the HTML that would be handed to a
// reader, and evaluated in a context with no `document`, which is the one branch
// scripts/portable/driver.js takes when it is not in a browser.
//
// The real-browser half of this — that it opens from `file://` with the network off,
// issues no request, and degrades on the device clock — is tests/e2e/journey/portable.spec.ts.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createContext, runInContext } from "node:vm";

import { buildPortable, verifyPortable, SIZE_BUDGET_BYTES } from "../scripts/portable-build.ts";
import { handleRoute } from "../api/router.ts";
import { REPO_ROOT, loadCorpus } from "../api/corpus.ts";
import { loadReferrals } from "../api/referrals.ts";
import { SW_VERSION, staleAfterDays } from "../src/offline.ts";
import { escapeHtml } from "../src/render.ts";
import { t, SUPPORTED_LOCALES } from "../src/i18n/index.ts";
import { GOLD } from "../eval/gold.ts";
import type { ChangeType, DocumentType, Language } from "../api/types.ts";

/** Fixed so the artifact under test is reproducible run to run. */
const BUILT = "2026-09-07";

/** Evaluation date for the parity matrix. Chosen inside the corpus's serving window so
 *  the comparison exercises rendered steps rather than a uniformly degraded page. */
const TODAY = "2026-09-07";

const build = buildPortable({ built: BUILT });

/**
 * Pull the script out of the built document and run it. This is deliberately the
 * artifact's own bytes: a test that evaluated the builder's `script` variable would
 * prove nothing about the file, and the defect that actually happened during
 * development — an unescaped `</script>` inside a page template truncating the whole
 * bundle — was invisible to everything except loading the assembled document.
 */
interface ShimHash {
  update: (d: string | Uint8Array) => ShimHash;
  digest: (encoding: string) => string;
}
interface BundleContext {
  __tdn_require?: (id: string) => Record<string, unknown>;
  __tdn_crypto?: { createHash: (algorithm: string) => ShimHash };
}

function loadBundle(html: string): {
  require: (id: string) => Record<string, unknown>;
  crypto: { createHash: (algorithm: string) => ShimHash };
} {
  const match = /<script>\n([\s\S]*)\n<\/script>/.exec(html);
  assert.ok(match, "the built document has exactly one inline script block");
  const context = createContext({ TextEncoder, TextDecoder, URL, URLSearchParams, Blob, console }) as BundleContext;
  runInContext(match[1] as string, context as object, { filename: "portable-bundle.js" });
  assert.equal(typeof context.__tdn_require, "function", "the bundle exposes its module registry");
  assert.equal(typeof context.__tdn_crypto, "object", "the bundle exposes its node:crypto shim");
  return {
    require: context.__tdn_require as (id: string) => Record<string, unknown>,
    crypto: context.__tdn_crypto as { createHash: (algorithm: string) => ShimHash },
  };
}

const bundle = loadBundle(build.html);
const bundleRouter = bundle.require("api/router.ts") as {
  handleRoute: (m: string, u: URL, today?: string) => { status: number; contentType?: string; body: string };
};

/** Routes covering every page a reader can reach, both languages, plus the probes. */
const ROUTE_MATRIX: string[] = [
  "/",
  "/?language=es",
  "/terms",
  "/terms?language=es",
  "/privacy",
  "/accessibility",
  "/methodology",
  "/transparency",
  "/guide",
  "/guide?language=es",
  "/guide/california/name-change",
  "/guide/texas/gender-marker-change?language=es",
  "/checklist?jurisdiction=US-CA&change=name&doc=court-order&doc=ssa-card",
  "/checklist?jurisdiction=US-AL&change=name&doc=birth-certificate",
  "/checklist?jurisdiction=US-TX&change=gender-marker&language=es",
  "/checklist?jurisdiction=US-MT&change=gender-marker&doc=drivers-license",
  "/checklist?jurisdiction=US-IL&change=name&for_minor=1",
  "/packet?jurisdiction=US-NY&change=name&doc=court-order",
  "/packet?jurisdiction=US-NY&change=name&doc=court-order&language=es",
  "/changes?since=2026-06-01&jurisdiction=US-CA&change=name&doc=court-order",
  "/move?origin=US-TX&destination=US-CA&change=name",
  "/move?origin=US-TX&destination=US-CA&change=name&language=es",
  "/compare",
  "/compare?current=US-CA&change=name",
  "/compare?current=US-TX&change=gender-marker&sort=count&language=es",
  "/offline",
  "/offline?language=es",
  "/feeds",
  "/feeds/US-CA.xml",
  "/healthz",
  "/livez",
  "/readyz",
  "/version",
  "/robots.txt",
  "/sitemap.xml",
  "/assets/app.css",
  "/sw.js",
  "/nope-does-not-exist",
];

/** A gold item's query, as the URL a reader would actually land on. */
function goldRoute(query: {
  jurisdiction: string;
  change_types: ChangeType[];
  documents?: DocumentType[];
  language?: Language;
  for_minor?: boolean;
}): string {
  const params = new URLSearchParams();
  params.set("jurisdiction", query.jurisdiction);
  for (const c of query.change_types) params.append("change", c);
  for (const d of query.documents ?? []) params.append("doc", d);
  if (query.language) params.set("language", query.language);
  if (query.for_minor) params.set("for_minor", "1");
  return `/checklist?${params.toString()}`;
}

function compare(route: string): void {
  const mine = handleRoute("GET", new URL(route, "https://portable.invalid"), TODAY);
  const theirs = bundleRouter.handleRoute("GET", new URL(route, "https://portable.invalid"), TODAY);
  assert.equal(theirs.status, mine.status, `status differs on ${route}`);
  assert.equal(theirs.contentType, mine.contentType, `content type differs on ${route}`);
  assert.equal(theirs.body, mine.body, `body differs on ${route}`);
}

test("every route renders byte-identically in the portable bundle and the server", () => {
  for (const route of ROUTE_MATRIX) compare(route);
});

test("every gold query renders byte-identically in the portable bundle and the server", () => {
  assert.ok(GOLD.length >= 200, `the gold set is loaded, not an empty override (got ${GOLD.length})`);
  const seen = new Set<string>();
  for (const item of GOLD) {
    const route = goldRoute(item.query);
    if (seen.has(route)) continue;
    seen.add(route);
    compare(route);
  }
  assert.ok(seen.size >= 200, `expected the gold set to produce many distinct routes, got ${seen.size}`);
});

test("the bundle's citations are the server's, record for record", () => {
  // A page can match byte for byte and still be reached by a different retrieval path,
  // so the citation surface is asserted directly as well: every official-source URL the
  // server puts on a checklist must be on the bundle's, and no others.
  const hrefs = (html: string): string[] =>
    [...html.matchAll(/href="(https?:\/\/[^"]+)"/g)].map((m) => m[1] as string).sort();
  for (const route of ROUTE_MATRIX.filter((r) => r.startsWith("/checklist") || r.startsWith("/packet"))) {
    const mine = handleRoute("GET", new URL(route, "https://portable.invalid"), TODAY);
    const theirs = bundleRouter.handleRoute("GET", new URL(route, "https://portable.invalid"), TODAY);
    const a = hrefs(mine.body);
    assert.ok(a.length > 0, `${route} cites at least one source`);
    assert.equal(hrefs(theirs.body).join("\n"), a.join("\n"), `citations differ on ${route}`);
  }
});

test("the bundle's hand-written sha256 agrees with node:crypto", () => {
  const shim = bundle.crypto;
  const inputs: (string | Uint8Array)[] = ["", "a", "abc", "árbol · 日本語 · ñ", "x".repeat(55), "x".repeat(56), "x".repeat(63), "x".repeat(64), "x".repeat(65), "x".repeat(119), "x".repeat(120), "x".repeat(1000)];
  for (const asset of ["favicon.svg", "offline.js", "packet.js", "reminders.js", "resume-crypto.js", "site.webmanifest"]) {
    inputs.push(readFileSync(join(REPO_ROOT, "public", "assets", asset)));
  }
  for (const input of inputs) {
    const expected = createHash("sha256").update(input).digest("hex");
    const actual = shim.createHash("sha256").update(input).digest("hex");
    assert.equal(actual, expected, `sha256 differs for a ${typeof input === "string" ? `${input.length}-char string` : `${input.length}-byte buffer`}`);
  }
});

test("the bundle computes the same shell fingerprint as the server", () => {
  // Independent of the vector test above: it proves the shim hashes the SAME BYTES the
  // server does, through the real code path, over the real assets. A virtual filesystem
  // that returned text where the server reads bytes would pass every vector and fail here.
  const offline = bundle.require("src/offline.ts") as { SW_VERSION: string; staleAfterDays: () => number };
  assert.equal(offline.SW_VERSION, SW_VERSION);
  assert.equal(offline.staleAfterDays(), staleAfterDays());
});

test("the bundle carries the whole corpus and every referral, not a subset", () => {
  // The realistic way this artifact goes wrong is not a wrong answer; it is a SHORT one,
  // because a directory never made it into the virtual filesystem. A missing corpus file
  // renders a page with fewer steps and no error at all.
  const mine = loadCorpus().map((r) => r.id).sort();
  const theirs = (bundle.require("api/corpus.ts") as { loadCorpus: () => { id: string }[] })
    .loadCorpus()
    .map((r) => r.id)
    .sort();
  // Joined rather than deep-compared: the bundle's arrays come from the vm's own realm,
  // where deepStrictEqual fails a prototype identity check on values that are equal.
  assert.equal(theirs.join("\n"), mine.join("\n"));
  assert.ok(mine.length > 600, `expected the real corpus, got ${mine.length} records`);

  const mineRefs = loadReferrals().map((r) => r.id).sort();
  const theirRefs = (bundle.require("api/referrals.ts") as { loadReferrals: () => { id: string }[] })
    .loadReferrals()
    .map((r) => r.id)
    .sort();
  assert.equal(theirRefs.join("\n"), mineRefs.join("\n"));
  assert.ok(mineRefs.length > 0, "the referral directory is in the virtual filesystem");
});

test("the document declares a policy that forbids every network request", () => {
  const csp = /<meta http-equiv="Content-Security-Policy" content="([^"]+)">/.exec(build.html)?.[1];
  assert.ok(csp, "the shell declares a Content-Security-Policy");
  for (const directive of ["default-src 'none'", "connect-src 'none'", "form-action 'none'", "base-uri 'none'"]) {
    assert.ok((csp as string).includes(directive), `the policy includes ${directive}`);
  }
  // 'unsafe-eval' would let a future edit reintroduce a loader; blob: is in-memory and
  // is how the page re-attaches its own progressive-enhancement modules.
  assert.ok(!(csp as string).includes("unsafe-eval"), "the policy does not allow eval");
  assert.ok(!/https?:/.test(csp as string), "no host is allowlisted anywhere in the policy");
});

test("the assembled document closes its script exactly once", () => {
  // The application source contains `</script>` inside page templates. Unescaped, the
  // HTML parser ends the bundle there and renders the rest as markup: the page still
  // opens, shows its <noscript> fallback, and looks like JavaScript is switched off.
  assert.equal(build.html.split("</script").length - 1, 1);
  assert.ok(build.html.includes("<\\/script"), "the payload's own closing tags are escaped");
});

test("the artifact's embedded content hash verifies against the artifact", () => {
  const v = verifyPortable(build.html);
  assert.equal(v.declared, build.sha256);
  assert.ok(v.ok, `declared ${v.declared} but computed ${v.actual}`);

  // And a tampered file must not verify — otherwise the hash is decoration.
  const tampered = build.html.replace("Trans Docs Navigator — portable copy", "Trans Docs Navigator — tampered copy");
  assert.notEqual(tampered, build.html);
  assert.equal(verifyPortable(tampered).ok, false);
});

test("the build is reproducible for a given build date", () => {
  const again = buildPortable({ built: BUILT });
  assert.equal(again.sha256, build.sha256);
  assert.equal(again.html, build.html);
});

test("the artifact stays small enough to hand over on a USB stick", () => {
  assert.ok(
    build.bytes <= SIZE_BUDGET_BYTES,
    `portable build is ${(build.bytes / 1024 / 1024).toFixed(2)} MiB, budget is ${(SIZE_BUDGET_BYTES / 1024 / 1024).toFixed(0)} MiB`,
  );
  assert.ok(build.bytes > 512 * 1024, "a build this small is missing the corpus");
});

test("the bundle carries no telemetry, transport or model code", () => {
  // The generator seam and the Bedrock transport are server concerns. A portable file is
  // handed to people whose threat model is exactly "this device is examined", so the
  // absence of an outbound code path is asserted rather than assumed from the CSP.
  for (const forbidden of ["bedrock-transport.ts", "genai-telemetry.ts", "api/log.ts", "api/server.ts"]) {
    assert.ok(!build.html.includes(`__tdn_modules[${JSON.stringify(forbidden)}]`), `${forbidden} is not bundled`);
  }
  // A blunt substring scan over the whole payload, comments included. That bluntness is
  // the point: it cannot be evaded by indirection, and the cost — having to describe
  // these APIs rather than name them in a comment — is paid once, by whoever writes the
  // comment, rather than by a reader whose device made a request.
  const script = /<script>\n([\s\S]*)\n<\/script>/.exec(build.html)?.[1] as string;
  for (const api of ["XMLHttpRequest", "sendBeacon", "WebSocket", "EventSource", "importScripts", "eval("]) {
    assert.ok(!script.includes(api), `the bundle names ${api}; a portable copy must not be able to reach the network`);
  }
});

test("the code that runs on load cannot request anything, `fetch` included", () => {
  // MEASURED, and the reason this test exists at all: adding
  // `fetch("https://control.invalid/beacon")` to the driver's render path passed the
  // whole-payload scan above. `fetch(` cannot be forbidden across the payload, because
  // the bundled files include public/assets/offline.js and src/offline.ts's
  // service-worker template, both of which legitimately contain the word — and neither
  // executes here (a `file://` document has no service worker and offline.js
  // feature-detects one before doing anything).
  //
  // So the scan that can be blunt is the one over the code that actually runs on load:
  // the shim and the driver. Those two files are this edition's ENTIRE additional
  // surface, and nothing in them has any business making a request.
  for (const file of ["runtime.js", "driver.js"]) {
    const source = readFileSync(join(REPO_ROOT, "scripts", "portable", file), "utf8");
    for (const api of ["fetch(", "XMLHttpRequest", "sendBeacon", "WebSocket", "EventSource", "importScripts", "eval(", "import("]) {
      assert.ok(!source.includes(api), `scripts/portable/${file} names ${api}`);
    }
    assert.ok(source.includes("__tdn_"), "the scan is reading the real file, not an empty one");
  }
});

test("the build refuses a bundle whose import cycle would bind undefined", () => {
  // The graph has exactly one cycle (src/render.ts <-> src/seo.ts) and it is safe only
  // because both directions cross on hoisted function declarations. That is a property
  // of today's source, not a guarantee, so the builder checks it — and this asserts the
  // check is real rather than an empty loop over a graph nobody measured.
  assert.ok(build.cycles.length >= 1, "the builder actually walked the cycle it claims to check");
  assert.ok(
    build.cycles.some((c) => c.includes("src/render.ts") && c.includes("src/seo.ts")),
    `expected the render/seo cycle to be detected, got ${JSON.stringify(build.cycles)}`,
  );
});

test("every string a reader can see comes from the locale bundles", () => {
  // The artifact carries ONE surface the engine cannot render — the no-JavaScript
  // fallback, which has to be present in every language at once because nothing has run
  // yet to know which one the reader wants. It would have been the single piece of
  // user-facing copy in this edition that the key-parity gate could not see, so it is
  // sourced from src/i18n and asserted here for each registered locale.
  const noscript = /<noscript>([\s\S]*?)<\/noscript>/.exec(build.html)?.[1] as string;
  assert.ok(noscript, "the artifact carries a no-JavaScript fallback");
  for (const l of SUPPORTED_LOCALES) {
    const ui = t(l.language).ui;
    assert.ok(noscript.includes(`lang="${l.language}"`), `the fallback is present in ${l.language}`);
    assert.ok(noscript.includes(escapeHtml(ui.noscriptTitle)), `${l.language} title comes from the bundle`);
    assert.ok(noscript.includes(escapeHtml(ui.noscriptBody)), `${l.language} body comes from the bundle`);
  }
  // Compared ESCAPED, not raw. A raw-substring assertion against rendered HTML is the
  // check that cannot fail: these sentences contain no apostrophe today, and the day
  // someone writes one in, `'` renders as `&#39;` and a raw comparison silently stops
  // being able to catch anything. (Measured in this repository on 2026-09-07, where two
  // leak assertions had been un-failable for exactly that reason.)
  const shell = readFileSync(join(REPO_ROOT, "scripts", "portable", "shell.html"), "utf8");
  assert.ok(!/Esta copia|necesita JavaScript|La lista se genera/.test(shell), "no Spanish is typed into the shell template");
});

test("the portable header is built from the reviewed locale bundles", () => {
  // The banner a reader sees above every page must not be a fourth copy of translated
  // copy that no gate covers. Both strings it composes come from src/i18n, so a Spanish
  // reader gets Spanish that has been through the parity gate.
  const driver = readFileSync(join(REPO_ROOT, "scripts", "portable", "driver.js"), "utf8");
  assert.ok(driver.includes("t.offlineBanner"), "the banner uses the shipped offlineBanner string");
  assert.ok(driver.includes('gapReason(lang, "all-degraded")'), "the lapsed notice uses the shipped gap string");
  assert.ok(!/[áéíóúñ¿¡]/i.test(driver), "the driver hardcodes no Spanish of its own");
});
