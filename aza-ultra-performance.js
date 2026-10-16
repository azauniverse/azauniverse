/* AZA UNIVERSE — Ultra Performance Guard v1.0
 * Client-side rendering optimization for phones and low-resource devices.
 * No external dependencies, no tracking, no repeated timers, no server/API calls.
 * This improves page rendering only; it cannot fix Cloudflare/Durable Objects quotas.
 */
(() => {
  'use strict';
  if (window.__AZA_ULTRA_PERFORMANCE_V1__) return;
  window.__AZA_ULTRA_PERFORMANCE_V1__ = true;

  const root = document.documentElement;
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
  const mobileQuery = window.matchMedia ? window.matchMedia('(max-width: 820px)') : { matches: false };
  const coarseQuery = window.matchMedia ? window.matchMedia('(pointer: coarse)') : { matches: false };
  const reducedMotionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  function isLiteDevice() {
    const memoryLimited = Number.isFinite(navigator.deviceMemory) && navigator.deviceMemory <= 6;
    const cpuLimited = Number.isFinite(navigator.hardwareConcurrency) && navigator.hardwareConcurrency <= 6;
    const saveData = !!connection?.saveData;
    const slowNetwork = !!connection?.effectiveType && /(^|-)2g$/.test(connection.effectiveType);
    return mobileQuery.matches || coarseQuery.matches || reducedMotionQuery.matches || memoryLimited || cpuLimited || saveData || slowNetwork;
  }

  function applyProfile() {
    const lite = isLiteDevice();
    root.classList.toggle('aza-up-lite', lite);
    root.dataset.azaUltraPerformance = lite ? 'lite' : 'standard';
  }

  const style = document.createElement('style');
  style.id = 'aza-ultra-performance-style';
  style.textContent = `
    html { -webkit-tap-highlight-color: transparent; }
    button, a, [role="button"] { touch-action: manipulation; }

    /* Phones / low-resource devices: preserve layout and brand, remove costly effects. */
    html.aza-up-lite body::before { opacity: .28 !important; }
    html.aza-up-lite .ambient { display: none !important; }
    html.aza-up-lite .space-noise { opacity: .07 !important; }

    html.aza-up-lite .hero-emblem,
    html.aza-up-lite .hero-planet,
    html.aza-up-lite .planet-rim,
    html.aza-up-lite .light-streak,
    html.aza-up-lite .hero-bottom-glow,
    html.aza-up-lite .challenge-planet,
    html.aza-up-lite .hooded-figure,
    html.aza-up-lite .question-glow,
    html.aza-up-lite .feature-emoji,
    html.aza-up-lite .art-orbit,
    html.aza-up-lite .spark,
    html.aza-up-lite .gold-rays,
    html.aza-up-lite .gift-glow,
    html.aza-up-lite .community-orbs,
    html.aza-up-lite .aza-founder-aurora,
    html.aza-up-lite .aza-founder-home-orb,
    html.aza-up-lite .aza-founder-aurora b,
    html.aza-up-lite .aza-profile-avatar::before,
    html.aza-up-lite .aza-profile-avatar::after,
    html.aza-up-lite .aza-profile-avatar.aza-frame-founder::before,
    html.aza-up-lite .aza-social-live-pill i,
    html.aza-up-lite .aza-social-online-total i,
    html.aza-up-lite .aza-social-avatar::before,
    html.aza-up-lite .aza-social-avatar::after {
      animation: none !important;
      transition: none !important;
    }

    html.aza-up-lite .ambient,
    html.aza-up-lite .hero-emblem,
    html.aza-up-lite .hero-planet,
    html.aza-up-lite .planet-rim,
    html.aza-up-lite .light-streak,
    html.aza-up-lite .feature-emoji,
    html.aza-up-lite .popular-art,
    html.aza-up-lite .aza-founder-home-orb,
    html.aza-up-lite .aza-founder-home-orb img,
    html.aza-up-lite .brand-symbol img,
    html.aza-up-lite .trophy-symbol {
      filter: none !important;
    }

    html.aza-up-lite .hero-planet { box-shadow: inset -24px -18px 30px #01040a !important; }
    html.aza-up-lite .feature-card,
    html.aza-up-lite .popular-card,
    html.aza-up-lite .popular-block,
    html.aza-up-lite .ranking-panel,
    html.aza-up-lite .challenge-banner,
    html.aza-up-lite .test-catalog-section,
    html.aza-up-lite .modal-card,
    html.aza-up-lite .aza-community-wide-banner,
    html.aza-up-lite .aza-social-window,
    html.aza-up-lite .aza-social-person {
      box-shadow: 0 4px 14px rgba(0,0,0,.22) !important;
    }

    html.aza-up-lite .mobile-bottom-nav,
    html.aza-up-lite .modal-backdrop,
    html.aza-up-lite .aza-social-backdrop,
    html.aza-up-lite .aza-battle-backdrop,
    html.aza-up-lite .aza-social-message-main,
    html.aza-up-lite .aza-social-chat-panel,
    html.aza-up-lite .aza-social-window,
    html.aza-up-lite .feature-card,
    html.aza-up-lite .popular-card,
    html.aza-up-lite .challenge-banner {
      -webkit-backdrop-filter: none !important;
      backdrop-filter: none !important;
    }

    html.aza-up-lite .mobile-bottom-nav { background: #050b13f7 !important; }
    html.aza-up-lite .modal-backdrop,
    html.aza-up-lite .aza-social-backdrop,
    html.aza-up-lite .aza-battle-backdrop { background: #020610f5 !important; }

    html.aza-up-lite .feature-card:hover,
    html.aza-up-lite .popular-card:hover,
    html.aza-up-lite .aza-community-wide-banner:hover,
    html.aza-up-lite .aza-founder-link:hover { transform: none !important; }

    /* Defer paint for distant content. Native controls and quiz/modal content remain live. */
    @supports (content-visibility: auto) {
      #challenge, .popular-layout, #testCatalog, .tools-strip, .bottom-cta, .site-footer {
        content-visibility: auto;
        contain-intrinsic-size: auto 420px;
      }
      #testCatalog { contain-intrinsic-size: auto 900px; }
      .site-footer { contain-intrinsic-size: auto 280px; }
    }

    /* Small screens: avoid expensive compositing even on powerful phones. */
    @media (max-width: 820px), (hover: none) and (pointer: coarse) {
      .ambient { display: none !important; }
      .space-noise { opacity: .05 !important; }
      .hero-emblem, .hero-planet, .planet-rim, .light-streak,
      .hero-bottom-glow, .feature-emoji, .art-orbit, .spark, .gold-rays,
      .gift-glow, .community-orbs, .aza-founder-aurora,
      .aza-founder-home-orb, .aza-founder-home-orb img,
      .aza-profile-avatar::before, .aza-profile-avatar::after,
      .aza-profile-avatar.aza-frame-founder::before,
      .aza-social-live-pill i, .aza-social-online-total i,
      .aza-social-avatar::before, .aza-social-avatar::after {
        animation: none !important;
        transition: none !important;
      }
      .hero-emblem, .planet-rim, .light-streak, .feature-emoji,
      .brand-symbol img, .aza-founder-home-orb img, .trophy-symbol { filter: none !important; }
      .mobile-bottom-nav, .modal-backdrop, .aza-social-backdrop,
      .aza-battle-backdrop, .aza-social-message-main, .aza-social-chat-panel,
      .aza-social-window, .feature-card, .popular-card, .challenge-banner {
        -webkit-backdrop-filter: none !important;
        backdrop-filter: none !important;
      }
      .mobile-bottom-nav { background: #050b13f7 !important; }
      .modal-backdrop, .aza-social-backdrop, .aza-battle-backdrop { background: #020610f5 !important; }
      .feature-card, .popular-card, .popular-block, .ranking-panel,
      .challenge-banner, .test-catalog-section, .modal-card,
      .aza-social-window, .aza-community-wide-banner {
        box-shadow: 0 4px 14px rgba(0,0,0,.22) !important;
      }
      .feature-card:hover, .popular-card:hover, .aza-community-wide-banner:hover,
      .aza-founder-link:hover { transform: none !important; }
    }

    @media (prefers-reduced-motion: reduce) {
      html { scroll-behavior: auto !important; }
      *, *::before, *::after { scroll-behavior: auto !important; }
    }
  `;

  applyProfile();
  (document.head || root).appendChild(style);

  // Recalculate only when device/network capability changes; no scroll listeners or timers.
  for (const query of [mobileQuery, coarseQuery, reducedMotionQuery]) {
    if (typeof query.addEventListener === 'function') query.addEventListener('change', applyProfile, { passive: true });
    else if (typeof query.addListener === 'function') query.addListener(applyProfile);
  }
  if (connection?.addEventListener) connection.addEventListener('change', applyProfile, { passive: true });
})();
