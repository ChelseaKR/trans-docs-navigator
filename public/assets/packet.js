// Print-button wiring for the packet page (progressive enhancement: without JS the
// reader uses the browser's own print command; the page is print-styled either way).
const btn = document.getElementById("print-btn");
if (btn) btn.addEventListener("click", () => window.print());
