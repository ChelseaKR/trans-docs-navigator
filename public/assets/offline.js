// "Save for offline" wiring (EXP-01; progressive enhancement — the page works
// without it). Everything here is EXPLICIT and LOCAL: the service worker is only
// registered when the user presses save, pages are cached only by that press, and
// nothing is ever sent to a server. One button deletes all offline copies and
// unregisters the worker. Config (URLs to save + localized messages + the re-check
// window keyed to the corpus freshness SLA) arrives in the #offline-cfg JSON island,
// so this file stays static and CSP needs no inline JS.
//
// FORENSIC TRADE-OFF (stated in the panel and on /privacy): saved copies live
// unencrypted in the browser's Cache Storage and are discoverable by anyone with
// access to the device/browser. Saving is opt-in per page for exactly this reason.

const cfgEl = document.getElementById("offline-cfg");
if (cfgEl) {
  const CFG = JSON.parse(cfgEl.textContent);
  const M = CFG.M;
  const status = document.getElementById("offline-status");
  const saveBtn = document.getElementById("offline-save");
  const removeBtn = document.getElementById("offline-remove");
  const list = document.getElementById("offline-list");
  const SAVED_CACHE = "tdn-saved-v1";
  const supported = "serviceWorker" in navigator && "caches" in window;

  const say = (msg) => {
    if (status) status.textContent = msg;
  };

  // Burn the "saved on DATE — laws change" banner into the HTML *before* caching,
  // so every offline render carries its save date + expiry warning even if this
  // script never runs again. Uses the DEVICE clock (the saved copy must degrade
  // honestly even when the copy outlives the server). Text comes from our own
  // localized bundle; escaped anyway, defense-in-depth.
  const burnBanner = (html, dateIso) => {
    const text = M.banner.replace("{date}", dateIso).replace("{days}", String(CFG.staleAfterDays));
    const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const note = '<p class="banner" role="note">' + escaped + "</p>";
    return html.replace("</header>", note + "</header>");
  };

  const save = async () => {
    say(M.saving);
    try {
      await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready; // shell precache is complete once active
      const cache = await caches.open(SAVED_CACHE);
      const dateIso = new Date().toISOString().slice(0, 10);
      for (const url of CFG.urls) {
        const res = await fetch(url, { credentials: "same-origin" });
        if (!res.ok) throw new Error("save fetch failed");
        const html = burnBanner(await res.text(), dateIso);
        await cache.put(url, new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } }));
      }
      say(M.saved.replace("{date}", dateIso));
    } catch {
      say(M.error);
    }
  };

  const removeAll = async () => {
    try {
      for (const key of await caches.keys()) {
        if (key.indexOf("tdn-") === 0) await caches.delete(key);
      }
      for (const reg of await navigator.serviceWorker.getRegistrations()) {
        await reg.unregister();
      }
      say(M.removed);
    } catch {
      say(M.error);
    }
  };

  if (saveBtn && removeBtn) {
    if (!supported) {
      saveBtn.disabled = true;
      removeBtn.disabled = true;
      say(M.unsupported);
    } else {
      saveBtn.addEventListener("click", save);
      removeBtn.addEventListener("click", removeAll);
      // Update flow: when a byte-changed /sw.js activates and takes over, say so.
      navigator.serviceWorker.addEventListener("controllerchange", () => say(M.updated));
      // On revisit, surface that an offline copy of this page already exists.
      if (CFG.urls.length > 0) {
        caches
          .match(CFG.urls[0], { cacheName: SAVED_CACHE })
          .then((hit) => {
            if (hit) say(M.haveCopy);
          })
          .catch(() => {});
      }
    }
  }

  // On the /offline notice page: list the pages the user saved, straight from the
  // cache keys (no separate bookkeeping to leak or desync).
  if (list && supported) {
    caches
      .open(SAVED_CACHE)
      .then((cache) => cache.keys())
      .then((reqs) => {
        if (reqs.length === 0) {
          say(M.noneSaved);
          return;
        }
        for (const req of reqs) {
          const u = new URL(req.url);
          const li = document.createElement("li");
          const a = document.createElement("a");
          a.href = u.pathname + u.search;
          a.textContent = u.pathname + u.search;
          li.appendChild(a);
          list.appendChild(li);
        }
      })
      .catch(() => say(M.noneSaved));
  } else if (list) {
    say(M.noneSaved);
  }
}
