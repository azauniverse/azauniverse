/* AZA UNIVERSE Arena stability hotfix.
 * Load after online-battle-arena.js. No SQL/RPC changes; timer remains 60 seconds.
 * 1) skips identical #azaBattleContent rewrites (reduces lobby flicker and DOM churn)
 * 2) retries are still handled by online-battle.js; this file never stops polling
 * 3) fixes legacy Arena UI copy that incorrectly says 20 seconds
 */
(() => {
  'use strict';
  if (window.__AZA_BATTLE_RENDER_STABILITY_V1__) return;
  window.__AZA_BATTLE_RENDER_STABILITY_V1__ = true;

  // online-battle-render-performance.js already wraps this setter to optimize timer-only ticks.
  // Wrapping its current setter lets that optimization keep working while identical markup is skipped.
  const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  if (descriptor && typeof descriptor.get === 'function' && typeof descriptor.set === 'function') {
    const previousSetter = descriptor.set;
    const lastRequestedMarkup = new WeakMap();

    Object.defineProperty(Element.prototype, 'innerHTML', {
      configurable: descriptor.configurable,
      enumerable: descriptor.enumerable,
      get: descriptor.get,
      set(value) {
        if (this?.id === 'azaBattleContent' && typeof value === 'string') {
          const previous = lastRequestedMarkup.get(this);
          if (previous === value) return;
          lastRequestedMarkup.set(this, value);
        }
        return previousSetter.call(this, value);
      }
    });
  }

  const isRussian = () => {
    try {
      return String(localStorage.getItem('aza-lang') || document.documentElement.lang || 'ky').toLowerCase() === 'ru';
    } catch (_) {
      return document.documentElement.lang === 'ru';
    }
  };

  function fixTimerLabels(root = document) {
    const ru = isRussian();
    const bannerTimer = root.querySelector?.('.aza-arena-wide-chips b');
    const bannerText = ru ? '60 СЕК НА ВОПРОС' : 'СУРООГО 60 СЕК';
    if (bannerTimer && bannerTimer.textContent !== bannerText) bannerTimer.textContent = bannerText;

    const footnote = root.querySelector?.('.aza-arena-answer-footnote');
    const footnoteText = ru
      ? '10 ВОПРОСОВ • 60 СЕКУНД НА ОТВЕТ'
      : '10 СУРОО • АР БИР ЖООПКА 60 СЕКУНД';
    if (footnote && footnote.textContent !== footnoteText) footnote.textContent = footnoteText;
  }

  function init() {
    fixTimerLabels();
    if (document.body && typeof MutationObserver === 'function') {
      const observer = new MutationObserver(() => fixTimerLabels());
      observer.observe(document.body, { childList: true, subtree: true });
    }
    document.addEventListener('click', event => {
      if (event.target?.closest?.('#langToggle')) window.setTimeout(() => fixTimerLabels(), 0);
    }, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
