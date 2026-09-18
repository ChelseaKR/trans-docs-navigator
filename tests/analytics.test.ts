// Google Analytics 4 page counts (docs/adr/0007-google-analytics-4-page-counts.md).
//
// public/assets/analytics.js runs unmodified in a node:vm context against a stubbed window,
// navigator, document and localStorage, so these tests check what it does, not only what its
// source says. Because this service is used by trans people in hostile places, the central
// assertions are about what can never reach Google: the query string (every state, change,
// document, court-order and minor choice), the fragment, and any free-text question.
//
// The negative controls at the end each break the loader in one place, assert the break
// actually landed in the source they run, and then assert the harness notices. A sabotage
// that silently no-ops would otherwise read as a pass.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { handleRoute } from "../api/router.ts";
import { CONTENT_SECURITY_POLICY } from "../api/csp.ts";
import { SHELL_ASSETS } from "../src/offline.ts";
import { page } from "../src/render.ts";
import { en } from "../src/i18n/en.ts";
import { es } from "../src/i18n/es.ts";

const ROOT = join(import.meta.dirname, "..");
const SOURCE = readFileSync(join(ROOT, "public", "assets", "analytics.js"), "utf8");
const ID = "G-8HZFD5R23E";
const ID_LINE = `var GA4_ID = "${ID}";`;
const KEY = "trans-docs-navigator:analytics-opt-out";
const HOST = "https://7cddozrk6sfpsq7foszis7tcza0boyka.lambda-url.us-west-2.on.aws";
const CHECKLIST =
  `${HOST}/checklist?jurisdiction=US-TX&change=name&change=gender_marker&doc=birth_certificate` +
  "&court_order=1&for_minor=1&language=es#step-3";
const CONSENT_REQUIRED = [
  "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GR", "HR", "HU",
  "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI", "SK",
  "IS", "LI", "NO", "GB", "CH",
];
const ATTRS: Record<string, string> = {
  "label-out": "Opt out of analytics",
  "label-in": "Opt back in",
  "msg-opted-out": "OPTED-OUT",
  "msg-is-out": "IS-OUT",
  "msg-back-in": "BACK-IN",
  "msg-signal": "SIGNAL",
  "msg-no-storage": "NO-STORAGE",
};

interface Scenario {
  source?: string;
  url?: string;
  referrer?: string;
  gpc?: boolean;
  dnt?: string;
  windowDnt?: string;
  msDnt?: string;
  storage?: Record<string, string>;
  storageThrows?: boolean;
  clicks?: number;
}

interface Stub {
  textContent: string;
  hidden: boolean;
}

interface Outcome {
  loaded: boolean;
  pushed: unknown[][] | null;
  scripts: { src: string; async: boolean }[];
  wired: boolean;
  data: Map<string, string>;
  button: Stub;
  status: Stub;
  box: Stub;
  gaDisable: unknown;
}

function run(s: Scenario = {}): Outcome {
  const appended: { src: string; async: boolean }[] = [];
  const data = new Map(Object.entries(s.storage ?? {}));
  const store = {
    getItem: (k: string) => (data.has(k) ? (data.get(k) ?? null) : null),
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
  };
  let onClick: (() => void) | null = null;
  const button = {
    textContent: "",
    hidden: false,
    addEventListener: (_type: string, handler: () => void) => {
      onClick = handler;
    },
  };
  const status = { textContent: "", hidden: false };
  const box = {
    hidden: true,
    textContent: "",
    getAttribute: (name: string) => ATTRS[name.replace(/^data-/, "")] ?? null,
    querySelector: (sel: string) => (sel === "button" ? button : sel === "[role=status]" ? status : null),
  };
  const location = new URL(s.url ?? CHECKLIST);
  const navigator = { globalPrivacyControl: s.gpc, doNotTrack: s.dnt, msDoNotTrack: s.msDnt };
  const window: Record<string, unknown> = {
    navigator,
    doNotTrack: s.windowDnt,
    location: {
      protocol: location.protocol,
      hostname: location.hostname,
      pathname: location.pathname,
      origin: location.origin,
      href: location.href,
      search: location.search,
      hash: location.hash,
    },
  };
  Object.defineProperty(window, "localStorage", {
    get() {
      if (s.storageThrows) throw new Error("SecurityError");
      return store;
    },
  });
  const document = {
    readyState: "complete",
    referrer: s.referrer ?? "",
    head: { appendChild: (el: { src: string; async: boolean }) => appended.push(el) },
    documentElement: { appendChild: (el: { src: string; async: boolean }) => appended.push(el) },
    createElement: () => ({ src: "", async: false }),
    querySelector: (sel: string) => (sel === "[data-analytics-choice]" ? box : null),
    addEventListener: () => {},
  };
  vm.runInNewContext(s.source ?? SOURCE, { window, navigator, document, URL, Date });
  for (let i = 0; i < (s.clicks ?? 0); i += 1) (onClick as (() => void) | null)?.();
  const layer = window["dataLayer"] as ArrayLike<unknown>[] | undefined;
  return {
    loaded: layer !== undefined || appended.length > 0,
    // A JSON round trip moves the vm realm's objects into this one for deepEqual.
    pushed: layer ? (JSON.parse(JSON.stringify(layer.map((args) => Array.from(args)))) as unknown[][]) : null,
    scripts: appended.map((el) => ({ src: el.src, async: el.async })),
    wired: (onClick as (() => void) | null) !== null,
    data,
    button,
    status,
    box,
    gaDisable: window[`ga-disable-${ID}`],
  };
}

function config(o: Outcome): Record<string, unknown> {
  const entry = o.pushed?.[3];
  assert.ok(entry, "no config was pushed");
  assert.equal(entry[0], "config");
  return entry[2] as Record<string, unknown>;
}

function sabotaged(marker: string, replacement: string): string {
  assert.equal(SOURCE.split(marker).length - 1, 1, `sabotage marker must occur exactly once: ${marker}`);
  const changed = SOURCE.replace(marker, replacement);
  assert.notEqual(changed, SOURCE, "the sabotage did not change the source");
  return changed;
}

// --- what the loader does ------------------------------------------------------------------

test("analytics: production loads gtag once with the consent defaults and the config", () => {
  const o = run({ referrer: "https://www.google.com/search?q=texas+gender+marker+change" });
  assert.deepEqual(o.scripts, [{ src: `https://www.googletagmanager.com/gtag/js?id=${ID}`, async: true }]);
  const ads = { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" };
  assert.deepEqual(o.pushed?.[0], ["consent", "default", { ...ads, analytics_storage: "denied", region: CONSENT_REQUIRED }]);
  assert.deepEqual(o.pushed?.[1], ["consent", "default", { ...ads, analytics_storage: "granted" }]);
  assert.equal(o.pushed?.[2]?.[0], "js");
  assert.deepEqual(o.pushed?.[3], [
    "config",
    ID,
    {
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      page_location: `${HOST}/checklist`,
      page_referrer: "https://www.google.com/",
    },
  ]);
  assert.equal(o.pushed?.length, 4);
  assert.equal(new Set(CONSENT_REQUIRED).size, 32);
});

test("analytics: page_location is the path only; no choice, fragment or referrer path reaches Google", () => {
  const o = run({ referrer: "https://example.org/forum/thread?user=someone#post-9" });
  assert.equal(config(o)["page_location"], `${HOST}/checklist`);
  assert.equal(config(o)["page_referrer"], "https://example.org/");
  const sent = JSON.stringify(o.pushed);
  for (const leak of ["US-TX", "jurisdiction", "gender_marker", "birth_certificate", "court_order", "for_minor", "language=es", "step-3", "forum", "someone", "post-9"]) {
    assert.equal(sent.includes(leak), false, `${leak} reached the data layer`);
  }
});

test("analytics: a page carrying a question or any GA site-search parameter loads nothing at all", () => {
  for (const query of [
    "?jurisdiction=US-WA&q=can+i+change+my+name+without+a+court+hearing",
    "?q=my+deadname+is",
    "?language=es&q=x",
    "?s=x",
    "?search=x",
    "?query=x",
    "?keyword=x",
    "?Q=x",
  ]) {
    const o = run({ url: `${HOST}/answer${query}` });
    assert.equal(o.loaded, false, query);
  }
  // A parameter that merely ends in q is not a search parameter.
  assert.equal(run({ url: `${HOST}/checklist?faq=1` }).loaded, true);
});

test("analytics: the relocation planner never loads analytics, even without its origin/destination", () => {
  for (const path of ["/move", "/move/", "/plan", "/plan?origin=US-TX&destination=US-WA&hold=passport", "/plan/"]) {
    assert.equal(run({ url: `${HOST}${path}` }).loaded, false, path);
  }
  for (const path of ["/planner-guide", "/moves", "/guide/US-TX"]) {
    assert.equal(run({ url: `${HOST}${path}` }).loaded, true, path);
  }
});

test("analytics: nothing loads off the production host", () => {
  for (const url of [
    "http://127.0.0.1:8080/checklist?jurisdiction=US-TX",
    "http://localhost:8080/",
    `${HOST.replace("https:", "http:")}/`,
    "https://trans-docs-navigator.onrender.com/",
    "https://example.lambda-url.us-west-2.on.aws/",
  ]) {
    const o = run({ url });
    assert.equal(o.loaded, false, url);
    assert.equal(o.wired, true, `${url}: the control is still wired for local accessibility runs`);
  }
});

test("analytics: Global Privacy Control or Do Not Track stops it, and the control says why", () => {
  for (const signal of [{ gpc: true }, { dnt: "1" }, { dnt: "yes" }, { windowDnt: "1" }, { msDnt: "1" }]) {
    const o = run(signal);
    assert.equal(o.loaded, false, JSON.stringify(signal));
    assert.equal(o.button.hidden, true);
    assert.equal(o.status.textContent, "SIGNAL");
    assert.equal(o.box.hidden, false);
  }
  for (const off of [{ gpc: false }, { dnt: "0" }, { dnt: "unspecified" }]) {
    assert.equal(run(off).loaded, true, JSON.stringify(off));
  }
});

test("analytics: only the exact opt-out flag stops it", () => {
  const out = run({ storage: { [KEY]: "1" } });
  assert.equal(out.loaded, false);
  assert.equal(out.button.textContent, "Opt back in");
  assert.equal(out.status.textContent, "IS-OUT");
  for (const storage of [{ [KEY]: "0" }, { [KEY]: "true" }, { "another-site:analytics-opt-out": "1" }]) {
    assert.equal(run({ storage }).loaded, true, JSON.stringify(storage));
  }
});

test("analytics: the control toggles both ways with the page's own words", () => {
  const once = run({ clicks: 1 });
  assert.deepEqual([...once.data.entries()], [[KEY, "1"]]);
  assert.equal(once.gaDisable, true);
  assert.equal(once.button.textContent, "Opt back in");
  assert.equal(once.status.textContent, "OPTED-OUT");
  const twice = run({ clicks: 2 });
  assert.deepEqual([...twice.data.entries()], []);
  assert.equal(twice.gaDisable, false);
  assert.equal(twice.button.textContent, "Opt out of analytics");
  assert.equal(twice.status.textContent, "BACK-IN");
});

test("analytics: blocked storage hides the button and says why", () => {
  const o = run({ storageThrows: true });
  assert.equal(o.button.hidden, true);
  assert.equal(o.status.textContent, "NO-STORAGE");
});

test("analytics: an empty or malformed ID loads nothing and wires no control", () => {
  for (const value of ["", "UA-12345-1", 'G-ABC"+alert(1)+"', "g-8hzfd5r23e"]) {
    const o = run({ source: sabotaged(ID_LINE, `var GA4_ID = ${JSON.stringify(value)};`) });
    assert.equal(o.loaded, false, value);
    assert.equal(o.wired, false, value);
    assert.equal(o.box.hidden, true, value);
  }
});

// --- the pages, the headers and the offline shell --------------------------------------------

test("analytics: every page loads the loader in <head> and carries one localized footer control", () => {
  for (const [lang, bundle] of [["en", en], ["es", es]] as const) {
    const h = page({ lang, title: "t", heading: "h", body: "<p>b</p>" });
    assert.equal(h.split('<script src="/assets/analytics.js" defer></script>').length - 1, 1, lang);
    assert.ok(h.indexOf("/assets/analytics.js") < h.indexOf("</head>"), lang);
    assert.equal(h.split("data-analytics-choice").length - 1, 1, lang);
    const footer = h.slice(h.indexOf("<footer>"), h.indexOf("</footer>"));
    assert.match(footer, /<p class="analytics-choice" data-analytics-choice hidden /);
    for (const value of [bundle.ui.analyticsOptOut, bundle.ui.analyticsOptIn, bundle.ui.analyticsOptedOut, bundle.ui.analyticsSignal]) {
      assert.ok(footer.includes(value.replace(/'/g, "&#39;")), `${lang}: ${value}`);
    }
    assert.doesNotMatch(h, /googletagmanager|google-analytics/, lang);
  }
});

test("analytics: routed pages carry the loader, and the CSP admits exactly the GA origins", () => {
  for (const path of ["/", "/privacy", "/privacy?language=es", "/checklist?jurisdiction=US-TX&change=name&doc=birth_certificate"]) {
    const r = handleRoute("GET", new URL(path, "http://localhost:8080"));
    assert.equal(r.status, 200, path);
    assert.ok(r.body.includes('<script src="/assets/analytics.js" defer></script>'), path);
  }
  const directives = new Map(
    CONTENT_SECURITY_POLICY.split(";").map((part) => {
      const [name, ...values] = part.trim().split(/\s+/);
      return [name ?? "", values] as const;
    }),
  );
  const google = (name: string) => (directives.get(name) ?? []).filter((v) => v.includes("google"));
  assert.deepEqual(google("script-src"), ["https://www.googletagmanager.com"]);
  assert.deepEqual(google("connect-src"), [
    "https://*.google-analytics.com",
    "https://*.analytics.google.com",
    "https://www.googletagmanager.com",
  ]);
  assert.deepEqual(google("img-src"), ["https://*.google-analytics.com", "https://www.googletagmanager.com"]);
  assert.deepEqual(directives.get("default-src"), ["'self'"]);
  assert.deepEqual(directives.get("style-src"), ["'self'"]);
  const server = readFileSync(join(ROOT, "api", "server.ts"), "utf8");
  assert.match(server, /"content-security-policy": CONTENT_SECURITY_POLICY,/);
});

test("analytics: the loader is in the offline shell, and nothing else names Google", () => {
  assert.ok(SHELL_ASSETS.includes("/assets/analytics.js"));
  assert.equal(SOURCE.split("https://www.googletagmanager.com/gtag/js?id=").length - 1, 1);
  for (const name of ["form-copy.js", "offline.js", "packet.js", "progress.js", "reminders.js", "resume-crypto.js", "resume-panel.js"]) {
    const text = readFileSync(join(ROOT, "public", "assets", name), "utf8");
    assert.doesNotMatch(text, /googletagmanager|google-analytics|gtag\(/, name);
  }
});

// --- negative controls -------------------------------------------------------------------------

test("analytics negative control: each removed guard lets GA load where it must not", () => {
  const cases: [string, Scenario][] = [
    ["  if (signal) return;\n", { gpc: true }],
    ["  if (signal) return;\n", { dnt: "1" }],
    ["  if (optedOut()) return;\n", { storage: { [KEY]: "1" } }],
    ["  if (SEARCH_PARAMS.test(loc.search)) return;\n", { url: `${HOST}/answer?q=my+name` }],
    ["  if (NO_ANALYTICS_PATHS.test(loc.pathname)) return;\n", { url: `${HOST}/plan?origin=US-TX&destination=US-WA` }],
    ['  if (loc.protocol !== "https:" || loc.hostname !== PRODUCTION_HOST) return;\n', { url: "http://127.0.0.1:8080/" }],
  ];
  for (const [guard, scenario] of cases) {
    assert.equal(run(scenario).loaded, false, `baseline must not load: ${guard.trim()}`);
    assert.equal(run({ ...scenario, source: sabotaged(guard, "") }).loaded, true, `harness missed: ${guard.trim()}`);
  }
});

test("analytics negative control: a full page_location is caught", () => {
  const source = sabotaged("page_location: loc.origin + loc.pathname,", "page_location: loc.href,");
  assert.match(String(config(run({ source }))["page_location"]), /jurisdiction=US-TX/);
});

test("analytics negative control: a full page_referrer is caught", () => {
  const source = sabotaged('return new URL(ref).origin + "/";', "return ref;");
  const o = run({ source, referrer: "https://example.org/forum/thread?user=someone" });
  assert.match(String(config(o)["page_referrer"]), /user=someone/);
});

test("analytics negative control: Google signals turned on is caught", () => {
  const source = sabotaged("allow_google_signals: false,", "allow_google_signals: true,");
  assert.equal(config(run({ source }))["allow_google_signals"], true);
});
