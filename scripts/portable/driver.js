// Portable-edition driver (#233). Injected verbatim into the single-file build by
// scripts/portable-build.ts, after the runtime shim and the application modules.
//
// WHAT IT DOES. It is the `file://` replacement for api/server.ts's socket plumbing and
// nothing more: it turns a click or a form submission into a call to the SAME
// `handleRoute` the server calls, and paints the result. Every decision about what the
// page SAYS — which steps, which citations, what is current — is made by the shipped
// api/ and src/ modules, unmodified. tests/portable.test.ts asserts byte-equality
// between this bundle's `handleRoute` and the repository's for the whole gold set and a
// route matrix, so a fork here would fail the build rather than ship a quieter answer.
//
// ROUTING WITHOUT NAVIGATION. Routes live in `location.hash` behind a `#!` prefix.
// That is not cosmetic: a real navigation from `file://` would leave the single file,
// and the `#!` marks route hashes apart from the page's own in-document anchors (the
// skip link is `#main`), which must keep working for keyboard and screen-reader users.
// Back and forward work because the hash is real history.
//
// THE DEVICE CLOCK IS THE ONLY CLOCK. `handleRoute` takes `today`, and here it is the
// reader's own device, evaluated fresh on every render. A portable copy carried past
// its corpus's re-check dates therefore degrades exactly as the live site would — the
// records stop being serveable as current and every step renders as needing
// reverification — with no server to ask and nothing to phone home to.

(function () {
  "use strict";

  // Nothing below can run without a document, and there is one deliberate consumer of
  // that fact: tests/portable.test.ts evaluates THE SHIPPED SCRIPT — the exact bytes of
  // the built file, not a re-derivation of them — outside a browser, so it can call the
  // bundle's own `handleRoute` and compare it to the repository's. Without this guard the
  // parity test would have to evaluate a substring of the artifact and hope it matched.
  if (typeof document === "undefined") return;

  var router = __tdn_require("api/router.ts");
  var corpus = __tdn_require("api/corpus.ts");
  var horizon = __tdn_require("api/horizon.ts");
  var offline = __tdn_require("src/offline.ts");
  var render = __tdn_require("src/render.ts");
  var i18n = __tdn_require("src/i18n/index.ts");

  var ROUTE_PREFIX = "#!";
  var BASE = "https://portable.invalid";
  var root = document.getElementById("tdn-root");
  var headerEl = document.getElementById("tdn-portable-header");

  /** The reader's own UTC date, in the same shape api/freshness.ts's isoToday returns. */
  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  /** The route currently in the address bar, or the intake page. */
  function currentRoute() {
    var h = window.location.hash;
    if (h.indexOf(ROUTE_PREFIX) !== 0) return "/";
    var r = h.slice(ROUTE_PREFIX.length);
    return r.charAt(0) === "/" ? r : "/";
  }

  /**
   * The banner above every page. It is DERIVED, not scheduled: it asks the corpus,
   * against the reader's clock, how many records can still be served as current, so a
   * copy that has outlived its content says so because the content has actually lapsed
   * — not because a build date crossed an arithmetic threshold. Reported in the
   * reader's own language using strings the repository already ships in both.
   */
  function renderHeader(lang) {
    var t = i18n.t(lang).ui;
    var h = horizon.stalenessHorizon(corpus.loadCorpus({ quarantine: true }), today());
    var days = offline.staleAfterDays();
    var banner = t.offlineBanner
      .replace("{date}", __tdn_build.built)
      .replace("{days}", String(days));
    var lapsed = h.serving_records === 0
      ? '<p class="flag" role="alert">' + render.escapeHtml(render.gapReason(lang, "all-degraded")) + "</p>"
      : "";
    // The two prose lines are localized strings the repository already ships and its
    // parity gate already covers. The third line is deliberately not prose: a build date,
    // a content-hash prefix, and how many of the bundled records this device's clock still
    // lets the engine serve. It is the number that decides what the page above can say, so
    // it is shown rather than kept in the engine.
    headerEl.setAttribute("lang", lang);
    headerEl.innerHTML =
      '<p class="banner" role="note">' + render.escapeHtml(banner) + "</p>" +
      lapsed +
      '<p class="meta"><code id="tdn-build">' +
      render.escapeHtml(__tdn_build.built + " · " + __tdn_build.payload_sha256.slice(0, 16)) +
      '</code> <code id="tdn-serving">' +
      render.escapeHtml(String(h.serving_records) + "/" + String(h.total_records)) +
      "</code></p>";
  }

  /**
   * Re-attach the page's progressive-enhancement scripts. A `<script src>` inserted via
   * innerHTML never executes, and the sources live in the bundle rather than on disk, so
   * each one is re-created as a module from a blob URL built here. Blob URLs are
   * in-memory and same-process — no request leaves the device, and the shell's
   * Content-Security-Policy still forbids `connect-src` entirely.
   *
   * Dependency order matters for exactly one edge today (resume-panel imports
   * resume-crypto); relative specifiers are rewritten to the blob URL of the module they
   * name, and an unknown specifier throws rather than silently loading nothing.
   */
  var blobUrls = {};
  function assetUrl(name) {
    if (blobUrls[name]) return blobUrls[name];
    var source = __tdn_fs.readFileSync("/tdn/public/assets/" + name, "utf8");
    var rewritten = source.replace(/(\bfrom\s*")\.\/([A-Za-z0-9._-]+)(")/g, function (_m, pre, dep, post) {
      return pre + assetUrl(dep) + post;
    });
    var url = URL.createObjectURL(new Blob([rewritten], { type: "text/javascript" }));
    blobUrls[name] = url;
    return url;
  }

  function activateScripts(container) {
    var scripts = container.querySelectorAll('script[src^="/assets/"]');
    for (var i = 0; i < scripts.length; i++) {
      var old = scripts[i];
      var name = old.getAttribute("src").slice("/assets/".length);
      var next = document.createElement("script");
      next.type = old.getAttribute("type") || "text/javascript";
      next.src = assetUrl(name);
      old.parentNode.replaceChild(next, old);
    }
  }

  function paint() {
    var route = currentRoute();
    var url = new URL(route, BASE);
    var res = router.handleRoute("GET", url, today());
    var isHtml = String(res.contentType || "").indexOf("text/html") === 0;

    if (!isHtml) {
      // Not a page a reader navigates to (a feed, a probe). Show it verbatim rather
      // than pretending the route does not exist.
      root.replaceChildren();
      var pre = document.createElement("pre");
      pre.textContent = res.body;
      root.appendChild(pre);
      renderHeader("en");
      return;
    }

    var doc = new DOMParser().parseFromString(res.body, "text/html");
    var lang = doc.documentElement.getAttribute("lang") === "es" ? "es" : "en";
    document.documentElement.setAttribute("lang", lang);
    document.title = doc.title;

    root.replaceChildren();
    var nodes = Array.prototype.slice.call(doc.body.childNodes);
    for (var i = 0; i < nodes.length; i++) root.appendChild(document.importNode(nodes[i], true));
    activateScripts(root);
    renderHeader(lang);
    window.scrollTo(0, 0);
  }

  // Same-file navigation. An in-document anchor (`#main`, the skip link) is left alone;
  // an off-file link (an official .gov source, which is the one thing a degraded page
  // must still hand the reader) is left alone too and opens the way any link does.
  document.addEventListener("click", function (event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    var el = event.target;
    while (el && el.nodeName !== "A") el = el.parentNode;
    if (!el) return;
    var href = el.getAttribute("href");
    if (!href || href.charAt(0) !== "/") return;
    event.preventDefault();
    window.location.hash = ROUTE_PREFIX + href;
  });

  document.addEventListener("submit", function (event) {
    var form = event.target;
    if (!form || form.nodeName !== "FORM") return;
    var action = form.getAttribute("action");
    if (!action || action.charAt(0) !== "/") return;
    var method = (form.getAttribute("method") || "get").toLowerCase();
    if (method !== "get") return;
    event.preventDefault();
    var params = new URLSearchParams(new FormData(form)).toString();
    window.location.hash = ROUTE_PREFIX + action + (params ? "?" + params : "");
  });

  window.addEventListener("hashchange", paint);
  paint();
})();
