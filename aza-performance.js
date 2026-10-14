/* AZA UNIVERSE — Lightweight Performance Guard
 * Browser-side rendering optimizations only. No external libraries or network calls.
 * This improves scrolling/animation behavior on mobile; it cannot increase database or hosting capacity.
 */
(() => {
  "use strict";
  if (window.__AZA_PERFORMANCE_GUARD_V1__) return;
  window.__AZA_PERFORMANCE_GUARD_V1__ = true;

  const root = document.documentElement;
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
  const reducedMotion = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const lowMemory = Number.isFinite(navigator.deviceMemory) && navigator.deviceMemory <= 4;
  const lowCPU = Number.isFinite(navigator.hardwareConcurrency) && navigator.hardwareConcurrency <= 4;
  const saveData = !!connection?.saveData;
  const slowNetwork = !!connection?.effectiveType && /(^|-)2g$/.test(connection.effectiveType);
  const liteMode = reducedMotion || lowMemory || lowCPU || saveData || slowNetwork;

  root.classList.toggle("aza-perf-lite", liteMode);
  root.dataset.azaPerformance = liteMode ? "lite" : "standard";

  // Keep only light, non-blocking CSS rules. No third-party code, timers or repeated API calls.
  const style = document.createElement("style");
  style.id = "aza-performance-guard-style";
  style.textContent = `
    html { -webkit-tap-highlight-color: transparent; }
    button, a, [role="button"] { touch-action: manipulation; }

    /* Let the browser postpone painting long below-the-fold sections until needed. */
    @supports (content-visibility: auto) {
      #challenge, .popular-layout, #testCatalog, .tools-strip, .bottom-cta, .site-footer {
        content-visibility: auto;
        contain-intrinsic-size: auto 360px;
      }
      #testCatalog { contain-intrinsic-size: auto 900px; }
      .site-footer { contain-intrinsic-size: auto 280px; }
    }

    /* Pause decorative motion when the relevant cards are far outside the viewport. */
    .feature-card[data-aza-perf-offscreen="true"] .feature-emoji,
    .feature-card[data-aza-perf-offscreen="true"] .art-orbit,
    .feature-card[data-aza-perf-offscreen="true"] .spark,
    .feature-card[data-aza-perf-offscreen="true"] .gift-glow,
    .feature-card[data-aza-perf-offscreen="true"] .community-orbs,
    .popular-card[data-aza-perf-offscreen="true"] *,
    .challenge-banner[data-aza-perf-offscreen="true"] .challenge-backdrop *,
    .hero-space-art[data-aza-perf-offscreen="true"] .hero-planet,
    .hero-space-art[data-aza-perf-offscreen="true"] .hero-emblem,
    .hero-space-art[data-aza-perf-offscreen="true"] .stars,
    .hero-space-art[data-aza-perf-offscreen="true"] .light-streak,
    .aza-founder-home[data-aza-perf-offscreen="true"] .aza-founder-aurora,
    .aza-founder-home[data-aza-perf-offscreen="true"] .aza-founder-home-orb {
      animation-play-state: paused !important;
    }

    /* Background tabs should not spend effort animating decorative effects. */
    html.aza-perf-hidden .ambient,
    html.aza-perf-hidden .space-noise,
    html.aza-perf-hidden .hero-planet,
    html.aza-perf-hidden .hero-emblem,
    html.aza-perf-hidden .stars,
    html.aza-perf-hidden .light-streak,
    html.aza-perf-hidden .feature-emoji,
    html.aza-perf-hidden .art-orbit,
    html.aza-perf-hidden .spark,
    html.aza-perf-hidden .gold-rays,
    html.aza-perf-hidden .gift-glow,
    html.aza-perf-hidden .community-orbs,
    html.aza-perf-hidden .aza-founder-aurora,
    html.aza-perf-hidden .aza-profile-avatar::before,
    html.aza-perf-hidden .aza-profile-avatar::after {
      animation-play-state: paused !important;
    }

    /* Phones with limited CPU/RAM/data get simpler background motion and less blur. */
    html.aza-perf-lite .ambient { opacity: .45 !important; filter: none !important; }
    html.aza-perf-lite .space-noise { opacity: .18 !important; }
    html.aza-perf-lite .hero-planet,
    html.aza-perf-lite .hero-emblem,
    html.aza-perf-lite .stars,
    html.aza-perf-lite .light-streak,
    html.aza-perf-lite .feature-emoji,
    html.aza-perf-lite .art-orbit,
    html.aza-perf-lite .spark,
    html.aza-perf-lite .gold-rays,
    html.aza-perf-lite .gift-glow,
    html.aza-perf-lite .community-orbs,
    html.aza-perf-lite .aza-founder-aurora,
    html.aza-perf-lite .aza-profile-avatar::before,
    html.aza-perf-lite .aza-profile-avatar::after {
      animation: none !important;
      transition-duration: .12s !important;
    }
    html.aza-perf-lite .feature-card,
    html.aza-perf-lite .popular-card,
    html.aza-perf-lite .mobile-bottom-nav {
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
    }

    @media (prefers-reduced-motion: reduce) {
      html { scroll-behavior: auto !important; }
      *, *::before, *::after { scroll-behavior: auto !important; }
    }
  `;
  (document.head || root).appendChild(style);

  // Pause off-screen decorative animations. IntersectionObserver is supported by modern mobile browsers.
  const animatedSelectors = [
    ".feature-card", ".popular-card", ".challenge-banner", ".hero-space-art", ".aza-founder-home"
  ];
  if ("IntersectionObserver" in window) {
    const targets = document.querySelectorAll(animatedSelectors.join(","));
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        entry.target.dataset.azaPerfOffscreen = entry.isIntersecting ? "false" : "true";
      }
    }, { root: null, rootMargin: "180px 0px", threshold: 0.01 });
    targets.forEach(target => observer.observe(target));
  }

  // Let browser decoding happen off the main paint path; preserve eager loading for visible branding/hero.
  const prepareImages = scope => {
    const imgs = scope.querySelectorAll ? scope.querySelectorAll("img") : [];
    imgs.forEach(img => {
      if (!img.hasAttribute("decoding")) img.decoding = "async";
      if (img.closest(".site-header, .hero, .aza-founder-home-orb")) {
        if (!img.hasAttribute("loading")) img.loading = "eager";
        return;
      }
      const rect = img.getBoundingClientRect();
      const nearViewport = rect.width > 0 && rect.top < window.innerHeight * 1.25 && rect.bottom > -100;
      if (!nearViewport && !img.hasAttribute("loading")) img.loading = "lazy";
      if (!nearViewport && !img.hasAttribute("fetchpriority")) img.setAttribute("fetchpriority", "low");
    });
  };
  prepareImages(document);

  // Dynamic content is scanned only when image elements are added; work is batched once per frame.
  if ("MutationObserver" in window && document.body) {
    let pending = false;
    const mutationObserver = new MutationObserver(records => {
      const addedImageScopes = [];
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.matches?.("img")) addedImageScopes.push(node.parentElement || node);
          else if (node.querySelector?.("img")) addedImageScopes.push(node);
        }
      }
      if (!addedImageScopes.length || pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        for (const scope of addedImageScopes.slice(0, 30)) {
          if (scope.matches?.("img")) {
            if (!scope.hasAttribute("decoding")) scope.decoding = "async";
            if (!scope.closest(".site-header, .hero, .aza-founder-home-orb") && !scope.hasAttribute("loading")) scope.loading = "lazy";
          } else prepareImages(scope);
        }
      });
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });
  }

  const setVisibilityState = () => root.classList.toggle("aza-perf-hidden", document.hidden);
  document.addEventListener("visibilitychange", setVisibilityState, { passive: true });
  setVisibilityState();

  // Re-evaluate only on meaningful capability changes (not on every scroll/click).
  if (connection?.addEventListener) {
    connection.addEventListener("change", () => {
      const currentSaveData = !!connection.saveData;
      root.classList.toggle("aza-perf-lite", reducedMotion || lowMemory || lowCPU || currentSaveData || slowNetwork);
      root.dataset.azaPerformance = root.classList.contains("aza-perf-lite") ? "lite" : "standard";
    }, { passive: true });
  }
})();
