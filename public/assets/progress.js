// Checklist progress, client-side and local-only (privacy-safe, like the resume
// panel). Persists which steps you've marked done to localStorage, keyed by the plan's
// query so different plans don't collide. Nothing is sent anywhere; progressive
// enhancement, so no-JS users simply don't see the toggles' effect persist.

const cfgEl = document.getElementById("progress-cfg");
const counter = document.getElementById("progress-count");
if (cfgEl) {
  const CFG = JSON.parse(cfgEl.textContent);
  const KEY = CFG.key;

  let done = new Set();
  try {
    done = new Set(JSON.parse(localStorage.getItem(KEY) || "[]"));
  } catch {
    done = new Set();
  }

  const steps = [...document.querySelectorAll("[data-step]")];
  const toggles = [...document.querySelectorAll("[data-step-toggle]")];

  function render() {
    for (const li of steps) li.classList.toggle("done", done.has(li.getAttribute("data-step")));
    for (const cb of toggles) cb.checked = done.has(cb.getAttribute("data-step-toggle"));
    if (counter) counter.textContent = CFG.template.replace("{done}", String(done.size)).replace("{total}", String(toggles.length));
  }

  for (const cb of toggles) {
    cb.addEventListener("change", () => {
      const k = cb.getAttribute("data-step-toggle");
      if (cb.checked) done.add(k);
      else done.delete(k);
      localStorage.setItem(KEY, JSON.stringify([...done]));
      render();
    });
  }

  render();
}
