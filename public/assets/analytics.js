// Google Analytics 4 page counts (docs/adr/0007-google-analytics-4-page-counts.md).
//
// GA4_ID below is the one place the measurement ID goes. It is public: every page that
// loads GA sends it to the browser. Set it to "" and this file loads nothing from Google
// on any page, and the footer opt-out control stays hidden.
//
// This service helps trans people with name and gender-marker changes, so what Google
// receives is kept to page counts and nothing that describes the person:
//
// - GA loads only over HTTPS on the production Lambda URL host, so local development,
//   the test servers on 127.0.0.1, CI, previews, and any other deployment never contact
//   Google.
// - It never loads under Global Privacy Control (`navigator.globalPrivacyControl ===
//   true`), under Do Not Track (`navigator.doNotTrack`, `window.doNotTrack` or
//   `navigator.msDoNotTrack` is "1" or "yes"), or after the footer opt-out
//   (localStorage OPT_OUT_KEY is "1").
// - It never loads on a page whose address carries a free-text question or any other
//   parameter GA treats as a site search (`q`, `s`, `search`, `query`, `keyword`), so no
//   setting in the GA property can ever turn a question into a "search term".
// - It never loads on the relocation planner (`/move`, `/plan`). Even without its
//   origin/destination pair, a visit there is timestamped interest in leaving a state,
//   the most sensitive thing this app can learn, and the DPIA keeps it out of every log.
// - `page_location` is the page's origin and path only. The query string, which holds the
//   state, change, document, court-order and minor choices, never reaches Google, and
//   neither does the fragment. `page_referrer` is the linking site's origin only.
// - Consent Mode v2: the three advertising signals are denied everywhere; analytics
//   storage is denied in the EEA, the UK and Switzerland (Google receives cookieless
//   pings there) and granted elsewhere. Google signals and ad personalization are off.
// - This file never reads a form field, the on-device form helper, the saved-progress
//   blob, the packet, or any page content, and it sends no custom events.
//
// The footer control's words come from the page (data-* attributes rendered from the
// en/es catalogs), so this file carries no user-facing text of its own.
(function () {
  "use strict";

  // The one place the measurement ID goes. "" = no Google Analytics anywhere.
  // G-8HZFD5R23E is the web stream of GA4 property 554877190 (provisioned 2026-09-17
  // with 14-month retention and Google signals disabled).
  var GA4_ID = "G-8HZFD5R23E";
  var PRODUCTION_HOST = "7cddozrk6sfpsq7foszis7tcza0boyka.lambda-url.us-west-2.on.aws";
  // Renaming this key would silently opt every opted-out visitor back in.
  var OPT_OUT_KEY = "trans-docs-navigator:analytics-opt-out";
  var LOADER = "https://www.googletagmanager.com/gtag/js?id=";
  // GA4's site-search parameters (enhanced measurement). A page carrying any of them
  // loads no analytics at all.
  var SEARCH_PARAMS = /(?:^|[?&])(?:q|s|search|query|keyword)=/i;
  // The relocation planner loads no analytics at all (see the header).
  var NO_ANALYTICS_PATHS = /^\/(?:move|plan)\/?$/;
  // analytics_storage stays denied for these ISO 3166-1 regions: the 27 EU member
  // states, Iceland, Liechtenstein and Norway (the EEA), the United Kingdom and
  // Switzerland.
  var CONSENT_REQUIRED = [
    "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GR", "HR", "HU",
    "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI", "SK",
    "IS", "LI", "NO",
    "GB",
    "CH",
  ];

  var w = window;
  var n = w.navigator || {};
  var d = document;
  var hasId = /^G-[A-Z0-9]{4,20}$/.test(GA4_ID);

  var store = null;
  try {
    store = w.localStorage;
    store.getItem(OPT_OUT_KEY);
  } catch (e) {
    store = null;
  }
  function optedOut() {
    try {
      return !!store && store.getItem(OPT_OUT_KEY) === "1";
    } catch (e) {
      return false;
    }
  }
  var dnt = n.doNotTrack || w.doNotTrack || n.msDoNotTrack;
  var signal = n.globalPrivacyControl === true || dnt === "1" || dnt === "yes";

  // The footer control. It is wired on every host, so the local accessibility runs
  // check the real, visible button, but it only ever changes the flag.
  function wireChoice() {
    var box = d.querySelector("[data-analytics-choice]");
    if (!box) return;
    var button = box.querySelector("button");
    var status = box.querySelector("[role=status]");
    if (!button || !status) return;
    function text(name) {
      return box.getAttribute("data-" + name) || "";
    }
    var gaDisable = "ga-disable-" + GA4_ID;
    function render(message) {
      button.textContent = optedOut() ? text("label-in") : text("label-out");
      button.hidden = signal || !store;
      status.textContent = message ? text("msg-" + message) : "";
      box.hidden = false;
    }
    button.addEventListener("click", function () {
      try {
        if (optedOut()) {
          store.removeItem(OPT_OUT_KEY);
          w[gaDisable] = false;
          render("back-in");
        } else {
          store.setItem(OPT_OUT_KEY, "1");
          w[gaDisable] = true;
          render("opted-out");
        }
      } catch (e) {
        store = null;
        render("no-storage");
      }
    });
    render(signal ? "signal" : !store ? "no-storage" : optedOut() ? "is-out" : "");
  }
  if (hasId) {
    if (d.readyState === "loading") {
      d.addEventListener("DOMContentLoaded", wireChoice);
    } else {
      wireChoice();
    }
  }

  if (!hasId) return;
  var loc = w.location;
  if (loc.protocol !== "https:" || loc.hostname !== PRODUCTION_HOST) return;
  if (SEARCH_PARAMS.test(loc.search)) return;
  if (NO_ANALYTICS_PATHS.test(loc.pathname)) return;
  if (signal) return;
  if (optedOut()) return;

  function referrerOrigin() {
    var ref = d.referrer;
    if (!ref) return "";
    try {
      return new URL(ref).origin + "/";
    } catch (e) {
      return "";
    }
  }

  w.dataLayer = w.dataLayer || [];
  // gtag reads the arguments object itself, not an array made from it.
  function gtag() {
    w.dataLayer.push(arguments);
  }
  gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
    region: CONSENT_REQUIRED,
  });
  gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "granted",
  });
  gtag("js", new Date());
  gtag("config", GA4_ID, {
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    page_location: loc.origin + loc.pathname,
    page_referrer: referrerOrigin(),
  });

  var script = d.createElement("script");
  script.async = true;
  script.src = LOADER + encodeURIComponent(GA4_ID);
  (d.head || d.documentElement).appendChild(script);
})();
