// "Copy your details into the official form" helper. Entirely on-device: the name you
// type is shown back as a copyable block and put on your clipboard — it is never sent
// anywhere (the inputs aren't in a form and have no name attribute). Progressive
// enhancement; config (labels + confirmation text) rides in the #copy-cfg JSON island.

const cfgEl = document.getElementById("copy-cfg");
const out = document.getElementById("copy-out");
const status = document.getElementById("copy-status");
const btn = document.getElementById("copy-btn");
const cur = document.getElementById("copy-current");
const nw = document.getElementById("copy-new");

if (cfgEl && out && btn && cur && nw) {
  const CFG = JSON.parse(cfgEl.textContent);

  function build() {
    const lines = [];
    if (cur.value.trim()) lines.push(`${CFG.labels.current}: ${cur.value.trim()}`);
    if (nw.value.trim()) lines.push(`${CFG.labels.new}: ${nw.value.trim()}`);
    out.textContent = lines.join("\n");
    return lines.join("\n");
  }

  cur.addEventListener("input", () => { build(); status.textContent = ""; });
  nw.addEventListener("input", () => { build(); status.textContent = ""; });

  btn.addEventListener("click", async () => {
    const text = build();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      status.textContent = CFG.copied;
    } catch {
      // Clipboard blocked (older browser / no permission): the block is still visible
      // to select and copy manually.
      status.textContent = "";
    }
  });

  build();
}
