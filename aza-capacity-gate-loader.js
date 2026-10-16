/* AZA UNIVERSE — production capacity gate loader.
 * Enables the 10,000-session main Worker for normal visits.
 * Keep this file in the repository root as aza-capacity-gate-loader.js.
 */
(() => {
  "use strict";
  if (window.__AZA_CAPACITY_GATE_LOADER_STARTED__) return;
  window.__AZA_CAPACITY_GATE_LOADER_STARTED__ = true;

  // Main production Worker. The separate one-slot test Worker is not used here.
  window.AZA_CAPACITY_GATE_URL = "wss://aza-universe-capacity.azataycan2002.workers.dev/ws";

  const cssHref = "aza-capacity-gate.css?v=1";
  if (![...document.querySelectorAll('link[rel="stylesheet"]')].some((link) => link.href.includes("aza-capacity-gate.css"))) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = cssHref;
    document.head.appendChild(link);
  }

  const script = document.createElement("script");
  script.src = "aza-capacity-gate.js?v=1";
  script.async = false;
  script.onerror = () => {
    // Keep the error visible in diagnostics; the gate script itself is responsible
    // for the connection UI and retry handling if it loaded successfully.
    console.error("AZA capacity gate script failed to load.");
  };
  document.body.appendChild(script);
})();
