/* AZA UNIVERSE capacity gate loader — safe one-slot test switch.
 * Normal site traffic is unaffected. Only ?capacity-test=1 activates the gate.
 * Add &capacity-test-worker=1 to use the isolated one-slot test Worker.
 */
(() => {
  "use strict";
  const params = new URLSearchParams(window.location.search);
  if (params.get("capacity-test") !== "1") return;
  if (window.__AZA_CAPACITY_GATE_LOADER_STARTED__) return;
  window.__AZA_CAPACITY_GATE_LOADER_STARTED__ = true;

  const useOneSlotTest = params.get("capacity-test-worker") === "1";
  window.AZA_CAPACITY_GATE_URL = useOneSlotTest
    ? "wss://aza-universe-capacity-test.azataycan2002.workers.dev/ws"
    : "wss://aza-universe-capacity.azataycan2002.workers.dev/ws";

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
  script.onerror = () => console.error("AZA capacity gate script failed to load.");
  document.body.appendChild(script);
})();
