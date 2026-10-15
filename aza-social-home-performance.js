/* AZA UNIVERSE — community banner, empty-chat cleanup and mobile performance polish. */
(() => {
  'use strict';
  if (window.__AZA_SOCIAL_HOME_PERF_V1__) return;
  window.__AZA_SOCIAL_HOME_PERF_V1__ = true;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const currentLang = () => (localStorage.getItem('aza-lang') || document.documentElement.lang || 'ky').toLowerCase() === 'ru' ? 'ru' : 'ky';
  const tr = (ky, ru) => currentLang() === 'ru' ? ru : ky;

  function ensureCss() {
    if ($('link[data-aza-social-home-perf]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('aza-social-home-performance.css?v=1', document.currentScript?.src || location.href).href;
    link.dataset.azaSocialHomePerf = '1';
    document.head.appendChild(link);
  }

  function createCommunityBanner() {
    const grid = $('.feature-grid');
    if (!grid) return;
    const legacy = $('.feature-community .aza-social-entry');
    if (legacy) legacy.setAttribute('aria-hidden','true');

    let banner = $('#azaCommunityWideBanner');
    if (!banner) {
      banner = document.createElement('button');
      banner.type = 'button';
      banner.id = 'azaCommunityWideBanner';
      banner.className = 'aza-community-wide-banner';
      banner.dataset.open = 'aza-social';
      banner.setAttribute('aria-label',tr('AZA UNIVERSE — чат жана достор','AZA UNIVERSE — чат и друзья'));
      // Append after the feature cards so it gets the same full-width treatment as Online Battle.
      grid.appendChild(banner);
    }
    const language = currentLang();
    if (banner.dataset.lang === language) return;
    banner.dataset.lang = language;
    const title = language === 'ru' ? 'ЧАТ И ДРУЗЬЯ' : 'ЧАТ ЖАНА ДОСТОР';
    const description = language === 'ru'
      ? 'Общайся, добавляй друзей и следи за игроками AZA UNIVERSE.'
      : 'Сүйлөш, досторду кош жана AZA UNIVERSE оюнчуларын тап.';
    const cta = language === 'ru' ? 'ОТКРЫТЬ SOCIAL HUB' : 'SOCIAL HUB АЧУУ';
    const eyebrow = language === 'ru' ? 'AZA UNIVERSE · СООБЩЕСТВО' : 'AZA UNIVERSE · КООМЧУЛУК';
    banner.setAttribute('aria-label',title);
    banner.innerHTML = `
      <span class="aza-community-banner-art" aria-hidden="true">
        <svg viewBox="0 0 92 92" fill="none" focusable="false">
          <circle cx="46" cy="46" r="37" stroke="#60DFFF" stroke-opacity=".55" stroke-width="1.5"/>
          <circle cx="46" cy="46" r="28" stroke="#B09AFF" stroke-opacity=".55" stroke-dasharray="3 5" stroke-width="1.5"/>
          <circle cx="32" cy="34" r="9" stroke="#8EF1FF" stroke-width="3"/>
          <circle cx="59" cy="32" r="8" stroke="#D0B7FF" stroke-width="3"/>
          <path d="M13 67c2-12 9-19 19-19s17 7 19 19" stroke="#8EF1FF" stroke-width="3.5" stroke-linecap="round"/>
          <path d="M43 64c2-10 7-16 16-16 8 0 14 6 17 16" stroke="#D0B7FF" stroke-width="3.5" stroke-linecap="round"/>
          <path d="M68 18v9M63.5 22.5h9" stroke="#FFD27C" stroke-width="2.7" stroke-linecap="round"/>
          <circle cx="16" cy="24" r="3" fill="#FFD27C"/><circle cx="76" cy="69" r="3" fill="#67E6FF"/>
        </svg>
      </span>
      <span class="aza-community-banner-copy">
        <span class="aza-community-banner-eyebrow">${esc(eyebrow)}</span>
        <strong>${esc(title)}</strong>
        <span class="aza-community-banner-description">${esc(description)}</span>
        <span class="aza-community-banner-chips"><i>${language === 'ru' ? 'ОБЩИЙ ЧАТ' : 'ЖАЛПЫ ЧАТ'}</i><i>${language === 'ru' ? 'ДРУЗЬЯ' : 'ДОСТОР'}</i><i>${language === 'ru' ? 'ЛИЧНЫЕ СООБЩЕНИЯ' : 'ЖЕКЕ ЧАТ'}</i></span>
      </span>
      <span class="aza-community-banner-cta"><span aria-hidden="true">↗</span><small>${esc(cta)}</small></span>`;
  }

  function cleanEmptyChatRows() {
    const overlay = $('#aza-social-overlay');
    const list = $('#azaSocialMessages',overlay || document);
    if (!list) return;
    const cards = [...list.querySelectorAll('.aza-social-message')];
    if (!cards.length && $('.aza-social-loading',list)) return;
    for (const card of cards) {
      const body = $('.aza-social-message-main p',card);
      if (!body || !String(body.textContent || '').trim()) card.remove();
    }
    const remaining = list.querySelector('.aza-social-message');
    if (!remaining && !$('.aza-social-empty-inline',list)) {
      list.innerHTML = `<div class="aza-social-empty-inline"><span>✦</span><p>${esc(tr('Азырынча билдирүү жок. Биринчи болуп жаз!','Сообщений пока нет. Напиши первым!'))}</p></div>`;
    }
  }

  let cleanupScheduled = false;
  function scheduleChatCleanup() {
    if (cleanupScheduled) return;
    cleanupScheduled = true;
    requestAnimationFrame(() => {
      cleanupScheduled = false;
      cleanEmptyChatRows();
    });
  }

  function init() {
    ensureCss();
    createCommunityBanner();
    const overlay = $('#aza-social-overlay');
    if (overlay && !overlay.dataset.azaEmptyChatObserver) {
      overlay.dataset.azaEmptyChatObserver = '1';
      const observer = new MutationObserver(scheduleChatCleanup);
      observer.observe(overlay,{childList:true,subtree:true});
      scheduleChatCleanup();
    }
    $('#langToggle')?.addEventListener('click',() => window.setTimeout(createCommunityBanner,0));
  }

  const bodyObserver = new MutationObserver(() => {
    if (!$('#azaCommunityWideBanner')) createCommunityBanner();
    const overlay = $('#aza-social-overlay');
    if (overlay && !overlay.dataset.azaEmptyChatObserver) init();
  });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded',() => {
      init();
      bodyObserver.observe(document.body,{childList:true,subtree:true});
    },{once:true});
  } else {
    init();
    bodyObserver.observe(document.body,{childList:true,subtree:true});
  }
})();
