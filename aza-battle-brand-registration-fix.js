/* AZA UNIVERSE: arena branding + registration note hotfix.
 * Load after online-battle.js and online-battle-arena.js.
 * Does not alter the battle RPCs, scoring, questions, or 60-second timer.
 */
(() => {
  'use strict';
  if (window.__AZA_BATTLE_BRAND_REGISTRATION_FIX_V1__) return;
  window.__AZA_BATTLE_BRAND_REGISTRATION_FIX_V1__ = true;

  const tx = (ky, ru) => {
    try {
      const language = (localStorage.getItem('aza-lang') || document.documentElement.lang || 'ky').toLowerCase();
      return language === 'ru' ? ru : ky;
    } catch (_) {
      return document.documentElement.lang === 'ru' ? ru : ky;
    }
  };

  function ensureCss() {
    if (document.querySelector('link[data-aza-battle-brand-registration-css]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'aza-battle-brand-registration-fix.css?v=1';
    link.dataset.azaBattleBrandRegistrationCss = 'true';
    document.head.appendChild(link);
  }

  function fixArenaLogo(root) {
    const scope = root && root.querySelectorAll ? root : document;
    const marks = [];
    if (scope.matches?.('.aza-arena-brand-mark')) marks.push(scope);
    scope.querySelectorAll('.aza-arena-brand-mark').forEach(el => marks.push(el));

    for (const mark of marks) {
      if (mark.dataset.azaBrandLogoApplied === '1') continue;
      const img = document.createElement('img');
      img.src = 'assets/aza-emblem.svg';
      img.alt = '';
      img.decoding = 'async';
      img.setAttribute('aria-hidden', 'true');
      mark.replaceChildren(img);
      mark.setAttribute('aria-label', 'AZA UNIVERSE');
      mark.dataset.azaBrandLogoApplied = '1';
    }
  }

  function fixRegistrationNote(root) {
    const scope = root && root.querySelectorAll ? root : document;
    const notes = [];
    if (scope.matches?.('.aza-battle-footnote')) notes.push(scope);
    scope.querySelectorAll('.aza-battle-footnote').forEach(el => notes.push(el));

    const ky = 'Онлайн беттешке катышуу үчүн каттоодон өтүп, аккаунтуңа кир.';
    const ru = 'Для участия в онлайн-баттле необходимо зарегистрироваться и войти в аккаунт.';
    const oldPhrases = [
      'Беттештин онлайн режими үчүн аккаунтка кирип, сервердин SQL орнотуусу жасалган болушу керек.',
      'Для онлайн-режима нужно войти в аккаунт и один раз настроить SQL в Supabase.'
    ];

    for (const note of notes) {
      const text = (note.textContent || '').replace(/\s+/g, ' ').trim();
      const isOwnedNotice = note.dataset.azaRegistrationNotice === '1';
      if (!isOwnedNotice && !oldPhrases.some(phrase => text.includes(phrase))) continue;
      const next = tx(ky, ru);
      if (text !== next) note.textContent = next;
      note.dataset.azaRegistrationNotice = '1';
    }
  }

  function enhance(root = document) {
    fixArenaLogo(root);
    fixRegistrationNote(root);
  }

  function init() {
    ensureCss();
    const content = document.querySelector('#azaBattleContent');
    if (content && !content.dataset.azaBrandRegistrationObserver) {
      content.dataset.azaBrandRegistrationObserver = '1';
      const observer = new MutationObserver(records => {
        let shouldEnhance = false;
        for (const record of records) {
          if (record.type === 'childList' && (record.addedNodes.length || record.removedNodes.length)) {
            shouldEnhance = true;
            break;
          }
        }
        if (shouldEnhance) enhance(content);
      });
      observer.observe(content, { childList: true, subtree: true });
      enhance(content);
    } else {
      enhance(document);
    }

    document.addEventListener('click', event => {
      if (event.target.closest('#langToggle')) {
        window.setTimeout(() => {
          const liveContent = document.querySelector('#azaBattleContent');
          if (liveContent) fixRegistrationNote(liveContent);
        }, 0);
      }
    }, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
