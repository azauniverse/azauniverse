/* AZA UNIVERSE — professional SVG icon layer for Social Hub and Online Battle.
 * UI-only: preserves existing data attributes, click handlers, RPC calls and timer behavior.
 */
(() => {
  'use strict';
  if (window.__AZA_PREMIUM_ICONS_V1__) return;
  window.__AZA_PREMIUM_ICONS_V1__ = true;

  const scriptUrl = document.currentScript?.src || new URL('aza-premium-icons.js', location.href).href;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const lang = () => String(localStorage.getItem('aza-lang') || document.documentElement.lang || 'ky').toLowerCase().startsWith('ru') ? 'ru' : 'ky';

  const icons = {
    global: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9"/><path d="M3.5 12h17M12 3c2.4 2.4 3.5 5.4 3.5 9s-1.1 6.6-3.5 9c-2.4-2.4-3.5-5.4-3.5-9S9.6 5.4 12 3Z"/></svg>`,
    friends: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="9" cy="8" r="3.1"/><path d="M2.8 19c.4-3.5 2.6-5.4 6.2-5.4s5.8 1.9 6.2 5.4M16.3 5.4a3 3 0 0 1 0 5.8M17.1 13.8c2.4.5 3.7 2.2 4.1 4.8"/></svg>`,
    dms: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 4.5h16a1.8 1.8 0 0 1 1.8 1.8v10.2a1.8 1.8 0 0 1-1.8 1.8H9l-5.5 2v-14A1.8 1.8 0 0 1 5.3 4.5Z"/><path d="m6.5 8 5.5 4.2L17.5 8"/></svg>`,
    random: `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><circle cx="24" cy="24" r="17" stroke="#61E4FF" stroke-opacity=".48" stroke-width="1.6"/><circle cx="24" cy="24" r="10" stroke="#B19BFF" stroke-opacity=".7" stroke-width="1.6" stroke-dasharray="3 3"/><path d="M13 12 35 34M18 9l-5 3-3 6M30 39l5-5 6-3" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M34 12 12 34M29 9l5 3 3 6M17 39l-5-5-6-3" stroke="#FFD17A" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 17v14M17 24h14" stroke="#90F1FF" stroke-width="1.6" stroke-linecap="round"/></svg>`,
    create: `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path d="M6 21 24 7l18 14" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M11 19.5V40h26V19.5" stroke="currentColor" stroke-width="3.2" stroke-linejoin="round"/><path d="M20 40V27h8v13" stroke="#FFD17A" stroke-width="3" stroke-linejoin="round"/><path d="M36 7v9M31.5 11.5h9" stroke="#8BEAFF" stroke-width="2.7" stroke-linecap="round"/></svg>`
  };

  const labels = {
    global: { ky: 'Жалпы чат', ru: 'Общий чат' },
    friends: { ky: 'Достор', ru: 'Друзья' },
    dms: { ky: 'Жеке чат', ru: 'Личные чаты' }
  };

  function ensureCss() {
    if ($('link[data-aza-premium-icons]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('aza-premium-icons.css?v=1', scriptUrl).href;
    link.dataset.azaPremiumIcons = '1';
    document.head.appendChild(link);
  }

  function renderTab(button) {
    const key = button.dataset.socialTab;
    if (!labels[key]) return;
    const currentLang = lang();
    const labelText = labels[key][currentLang];
    const iconHost = $('.aza-premium-tab-icon', button);
    const labelHost = $('.aza-premium-tab-label', button);
    if (iconHost?.querySelector('svg') && labelHost?.textContent === labelText) return;

    const badge = $('#azaSocialFriendBadge', button);
    const icon = document.createElement('span');
    icon.className = 'aza-premium-tab-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = icons[key];
    const label = document.createElement('span');
    label.className = 'aza-premium-tab-label';
    label.textContent = labelText;
    button.replaceChildren(icon, label);
    if (badge) button.appendChild(badge);
    button.setAttribute('aria-label', labelText);
  }

  function decorateSocial(overlay) {
    if (!overlay) return;
    $$('[data-social-tab]', overlay).forEach(renderTab);
    const title = $('.aza-social-chat-title h3', overlay);
    if (title) {
      const current = title.querySelector('.aza-premium-heading-icon');
      const cleanText = title.textContent.replace(/^\s*[🌐🌍]\s*/u, '').trim();
      if (!current || $('.aza-premium-heading-label', title)?.textContent !== cleanText) {
        const icon = document.createElement('span');
        icon.className = 'aza-premium-heading-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.innerHTML = icons.global;
        const label = document.createElement('span');
        label.className = 'aza-premium-heading-label';
        label.textContent = cleanText || labels.global[lang()];
        title.replaceChildren(icon, label);
      }
    }
  }

  function decorateBattleActions() {
    const content = $('#modalContent');
    if (!content) return;
    for (const [action, key] of [['random', 'random'], ['create', 'create']]) {
      const button = $(`button[data-battle-action="${action}"]`, content);
      const host = button?.querySelector(':scope > span:first-child');
      if (!host || host.dataset.azaPremiumBattleIcon === key && host.querySelector('svg')) continue;
      host.classList.add('aza-premium-battle-icon');
      host.innerHTML = icons[key];
      host.dataset.azaPremiumBattleIcon = key;
      host.setAttribute('aria-hidden', 'true');
      button.classList.add(`aza-premium-action-${action}`);
    }
  }

  let raf = 0;
  function schedule(fn) {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      fn();
    });
  }

  let socialObserver = null;
  function attachSocialObserver() {
    const overlay = $('#aza-social-overlay');
    if (!overlay || overlay.dataset.azaPremiumIconsObserved) return;
    overlay.dataset.azaPremiumIconsObserved = '1';
    socialObserver = new MutationObserver(() => schedule(() => decorateSocial(overlay)));
    socialObserver.observe(overlay, { childList: true, subtree: true, characterData: true });
    decorateSocial(overlay);
  }

  function init() {
    ensureCss();
    decorateBattleActions();
    attachSocialObserver();
    const modalContent = $('#modalContent');
    if (modalContent && !modalContent.dataset.azaPremiumIconsObserved) {
      modalContent.dataset.azaPremiumIconsObserved = '1';
      const observer = new MutationObserver(() => schedule(decorateBattleActions));
      observer.observe(modalContent, { childList: true, subtree: true });
    }
    const bodyObserver = new MutationObserver(() => {
      if ($('#aza-social-overlay') && !$('#aza-social-overlay').dataset.azaPremiumIconsObserved) attachSocialObserver();
    });
    bodyObserver.observe(document.body, { childList: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
