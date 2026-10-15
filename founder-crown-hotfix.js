/* AZA UNIVERSE — Founder crown hotfix.
 * The founder crown is granted only to the configured Supabase auth UUID.
 * UI decoration only; never use client-side CSS as an authorization mechanism.
 */
(() => {
  'use strict';
  if (window.__AZA_FOUNDER_CROWN_HOTFIX_V1__) return;
  window.__AZA_FOUNDER_CROWN_HOTFIX_V1__ = true;

  const FOUNDER_ID = '362b8778-de25-4846-9bf7-c514842d159e';
  const scriptUrl = document.currentScript?.src || new URL('founder-crown-hotfix.js', location.href).href;
  const baseUrl = new URL('.', scriptUrl);
  const $ = (selector, root = document) => root.querySelector(selector);

  function currentUserId() {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !/^sb-.+-auth-token$/.test(key)) continue;
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const session = parsed?.currentSession || parsed?.session || parsed;
        const id = session?.user?.id;
        if (session?.access_token && id) return String(id).toLowerCase();
      }
    } catch (error) {
      console.warn('AZA founder crown: session lookup failed', error);
    }
    return '';
  }

  function ensureCss() {
    if ($('link[data-aza-founder-crown-hotfix]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('founder-crown-hotfix.css?v=1', baseUrl).href;
    link.dataset.azaFounderCrownHotfix = '1';
    document.head.appendChild(link);
  }

  function decorateFounderRow(row) {
    if (!row || String(row.dataset?.userId || '').toLowerCase() !== FOUNDER_ID) return;
    row.querySelectorAll('.aza-social-avatar, .aza-profile-avatar').forEach(avatar => {
      avatar.classList.add('aza-frame-founder');
      avatar.setAttribute('data-aza-founder-crown', 'true');
    });
  }

  function scanFounderRows(root = document) {
    if (root instanceof Element && root.matches('[data-user-id]')) decorateFounderRow(root);
    root.querySelectorAll?.('[data-user-id]').forEach(decorateFounderRow);

    // The signed-in founder sees the crown on their own profile/avatar widgets too.
    if (currentUserId() === FOUNDER_ID) {
      document.querySelectorAll('#modalContent .aza-profile-avatar, #modalContent .aza-social-avatar').forEach(avatar => {
        avatar.classList.add('aza-frame-founder');
        avatar.setAttribute('data-aza-founder-crown', 'true');
      });
    }
  }

  let scanQueued = false;
  function scheduleScan(root) {
    if (scanQueued) return;
    scanQueued = true;
    requestAnimationFrame(() => {
      scanQueued = false;
      scanFounderRows(root || document);
    });
  }

  function init() {
    ensureCss();
    scanFounderRows(document);

    const socialOverlay = $('#aza-social-overlay');
    if (socialOverlay && !socialOverlay.dataset.azaFounderCrownObserver) {
      socialOverlay.dataset.azaFounderCrownObserver = '1';
      const observer = new MutationObserver(() => scheduleScan(socialOverlay));
      observer.observe(socialOverlay, { childList: true, subtree: true });
      scanFounderRows(socialOverlay);
    }

    const modalContent = $('#modalContent');
    if (modalContent && !modalContent.dataset.azaFounderCrownObserver) {
      modalContent.dataset.azaFounderCrownObserver = '1';
      const observer = new MutationObserver(() => scheduleScan(modalContent));
      observer.observe(modalContent, { childList: true, subtree: true });
      scanFounderRows(modalContent);
    }
  }

  // Most pages create the Social Hub only when the user opens it. Discover it once,
  // then observe only that panel so the rest of the page is not watched continuously.
  const discoveryObserver = new MutationObserver(() => {
    const overlay = $('#aza-social-overlay');
    if (overlay) {
      init();
      discoveryObserver.disconnect();
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      init();
      if (!$('#aza-social-overlay')) discoveryObserver.observe(document.body, { childList: true, subtree: true });
    }, { once: true });
  } else {
    init();
    if (!$('#aza-social-overlay')) discoveryObserver.observe(document.body, { childList: true, subtree: true });
  }
})();
