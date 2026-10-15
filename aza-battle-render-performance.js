/* AZA UNIVERSE — Online Battle render performance hotfix.
 * Place immediately after online-battle.js and before online-battle-arena.js.
 * Keeps RPC polling and the 60-second rules unchanged, but avoids rebuilding
 * the entire question DOM when only the timer value changed.
 */
(() => {
  'use strict';
  if (window.__AZA_BATTLE_RENDER_PERF_V1__) return;
  window.__AZA_BATTLE_RENDER_PERF_V1__ = true;

  const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  if (!descriptor || typeof descriptor.get !== 'function' || typeof descriptor.set !== 'function') return;
  const nativeSet = descriptor.set;
  const TIMER_RE = /<span class="aza-battle-timer(?:\s+urgent)?\s*">[^<]*<\/span>/;
  const TIMER_SECONDS_RE = /<span class="aza-battle-timer(?:\s+urgent)?\s*">\s*⏱️?\s*(\d+)\s*с\s*<\/span>/;

  function stableMarkup(html) {
    return html.replace(TIMER_RE, '<span class="aza-battle-timer">__AZA_TIMER__</span>');
  }

  function updateExistingTimer(content, seconds) {
    const timer = content.querySelector('.aza-battle-timer');
    if (!timer) return false;

    const number = timer.querySelector('.aza-arena-timer-number');
    if (number) {
      if (number.firstChild && number.firstChild.nodeType === Node.TEXT_NODE) {
        number.firstChild.nodeValue = String(seconds);
      } else if (!number.firstChild) {
        // Do not rebuild the child tree during a timer-only tick.
        number.appendChild(document.createTextNode(String(seconds)));
      }
    } else if (timer.firstChild && timer.firstChild.nodeType === Node.TEXT_NODE) {
      timer.firstChild.nodeValue = `⏱️ ${seconds} с`;
    } else {
      return false;
    }

    timer.classList.toggle('urgent', seconds <= 5);
    timer.setAttribute('aria-label', `${seconds} секунд`);
    return true;
  }

  Object.defineProperty(Element.prototype, 'innerHTML', {
    configurable: descriptor.configurable,
    enumerable: descriptor.enumerable,
    get: descriptor.get,
    set(value) {
      if (this?.id === 'azaBattleContent' && typeof value === 'string') {
        const isLiveQuestion = value.includes('class="aza-battle-livebar"');
        const match = isLiveQuestion ? value.match(TIMER_SECONDS_RE) : null;

        if (isLiveQuestion && match) {
          const nextKey = stableMarkup(value);
          const oldKey = this.dataset.azaBattleStableRenderKey;

          // Same room/question/answers/player state: update only the countdown.
          if (oldKey && oldKey === nextKey && this.querySelector('.aza-battle-livebar')) {
            if (updateExistingTimer(this, Number(match[1]))) {
              const skipped = Number(this.dataset.azaBattleTimerOnlyUpdates || 0) + 1;
              this.dataset.azaBattleTimerOnlyUpdates = String(skipped);
              return;
            }
          }

          nativeSet.call(this, value);
          this.dataset.azaBattleStableRenderKey = nextKey;
          return;
        }

        delete this.dataset.azaBattleStableRenderKey;
        delete this.dataset.azaBattleTimerOnlyUpdates;
      }

      return nativeSet.call(this, value);
    }
  });
})();
