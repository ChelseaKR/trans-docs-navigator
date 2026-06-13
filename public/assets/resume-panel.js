// Save/resume panel wiring (progressive enhancement; the page works without it).
// Saves ONLY the allowlisted non-PII selection query — already stripped server-side
// by toResumeState — AES-GCM-encrypted via resume-crypto.js, into localStorage.
// Nothing is ever sent to a server. Config (query + localized messages) arrives in
// the #resume-cfg JSON island, so this file stays static and CSP needs no inline JS.

import { encryptState, decryptState } from "./resume-crypto.js";

const cfgEl = document.getElementById("resume-cfg");
const status = document.getElementById("resume-status");
const pass = document.getElementById("resume-pass");
if (cfgEl && status && pass) {
  const CFG = JSON.parse(cfgEl.textContent);
  const KEY = "tdn.resume";

  document.getElementById("resume-save").addEventListener("click", async () => {
    if (!pass.value) {
      status.textContent = CFG.M.enterPass;
      return;
    }
    localStorage.setItem(KEY, await encryptState(CFG.query, pass.value));
    status.textContent = CFG.M.saved;
  });

  document.getElementById("resume-load").addEventListener("click", async () => {
    const stored = localStorage.getItem(KEY);
    if (!stored) {
      status.textContent = CFG.M.nothing;
      return;
    }
    try {
      location.href = "/checklist?" + (await decryptState(stored, pass.value));
    } catch {
      status.textContent = CFG.M.wrong;
    }
  });

  document.getElementById("resume-del").addEventListener("click", () => {
    localStorage.removeItem(KEY);
    status.textContent = CFG.M.deleted;
  });
}
