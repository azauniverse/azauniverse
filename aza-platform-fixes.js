/* AZA UNIVERSE platform fixes v1
 * Adds a prominent registration/profile ribbon, per-question KG/RU controls,
 * and decorates online battle players with public profile avatar/frame/rank/points.
 * Existing game state, scoring RPCs, and 60-second timer are not replaced here.
 */
(() => {
  'use strict';
  if (window.__AZA_PLATFORM_FIXES_V1__) return;
  window.__AZA_PLATFORM_FIXES_V1__ = true;

  const currentScript = document.currentScript;
  const baseUrl = currentScript?.src ? new URL('.', currentScript.src) : new URL('./', location.href);
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const language = () => (localStorage.getItem('aza-lang') || document.documentElement.lang || 'ky').toLowerCase() === 'ru' ? 'ru' : 'ky';
  const tr = (ky, ru) => language() === 'ru' ? ru : ky;
  const cfg = window.AZA_SUPABASE_CONFIG || {};
  const API = String(cfg.projectUrl || '').replace(/\/$/, '');
  const KEY = String(cfg.publishableKey || '');
  const RANKS = [
    {id:'bronze', min:0, ky:'Коло', ru:'Бронза'},
    {id:'silver', min:500, ky:'Күмүш', ru:'Серебро'},
    {id:'gold', min:1500, ky:'Алтын', ru:'Золото'},
    {id:'platinum', min:3000, ky:'Платина', ru:'Платина'},
    {id:'diamond', min:5000, ky:'Алмаз', ru:'Алмаз'},
    {id:'master', min:8000, ky:'Мастер', ru:'Мастер'},
    {id:'ace', min:12000, ky:'Эйс', ru:'Эйс'},
    {id:'conqueror', min:20000, ky:'Космостук жеңүүчү', ru:'Завоеватель'}
  ];
  const profileCache = new Map();
  const pendingProfiles = new Map();

  function addStylesheet() {
    if ($('link[data-aza-platform-fixes]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('aza-platform-fixes.css', baseUrl).href;
    link.dataset.azaPlatformFixes = 'true';
    document.head.appendChild(link);
  }

  function readSession() {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !/^sb-.+-auth-token$/.test(key)) continue;
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const s = parsed?.currentSession || parsed?.session || parsed;
        if (s?.access_token && s?.user?.id) return {access_token:s.access_token, user:s.user};
      }
    } catch (e) { console.warn('AZA platform fixes: session read failed', e); }
    return null;
  }

  function accountRibbon() {
    const header = $('.site-header');
    if (!header || $('#azaRegistrationRibbon')) return;
    const session = readSession();
    const ribbon = document.createElement('section');
    ribbon.id = 'azaRegistrationRibbon';
    ribbon.className = 'aza-registration-ribbon';
    ribbon.innerHTML = `
      <span class="aza-registration-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0M18 5.5h4M20 3.5v4"/></svg></span>
      <span class="aza-registration-copy"><strong>${esc(session ? tr('Профилим жана рейтингим', 'Мой профиль и рейтинг') : tr('AZA аккаунтуңду түз', 'Создай аккаунт AZA'))}</strong><small>${esc(session ? tr('Аватар • рамка • ранг • онлайн-баттл', 'Аватар • рамка • ранг • онлайн-баттл') : tr('Каттал • профилиңди түз • онлайн беттешке кошул', 'Зарегистрируйся • создай профиль • играй онлайн'))}</small></span>
      <button type="button" class="aza-registration-cta" data-aza-account-cta>${esc(session ? tr('Профилим', 'Профиль') : tr('Катталуу / Кирүү', 'Регистрация / Вход'))}<span aria-hidden="true">↗</span></button>`;
    header.insertAdjacentElement('afterend', ribbon);
    $('[data-aza-account-cta]', ribbon)?.addEventListener('click', () => {
      const trigger = $('.site-header [data-open="profile"]') || $('[data-open="profile"]');
      if (trigger) trigger.click();
      else location.hash = '#home';
    });
  }

  function selectedLanguageInBattle() {
    return language();
  }

  function switchLanguage(target) {
    const now = language();
    if (now === target) return;
    // Click the site's own control so the main app's translation state and localStorage stay in sync.
    const toggle = $('#langToggle');
    if (toggle) {
      toggle.click();
      return;
    }
    // Fallback for a page variant without the language button.
    localStorage.setItem('aza-lang', target);
    document.documentElement.lang = target;
  }

  function installQuestionLanguageControls() {
    const content = $('#azaBattleContent');
    if (!content) return;
    const cards = $$('.aza-battle-question', content);
    for (const card of cards) {
      if ($('.aza-q-language-switch', card)) continue;
      card.classList.add('aza-question-language-ready');
      const controls = document.createElement('div');
      controls.className = 'aza-q-language-switch';
      controls.setAttribute('role', 'group');
      controls.setAttribute('aria-label', 'Question language / Суроонун тили');
      controls.innerHTML = `
        <button type="button" data-aza-question-lang="ky" aria-label="Кыргызча">KG</button>
        <button type="button" data-aza-question-lang="ru" aria-label="Русский">RU</button>`;
      const active = selectedLanguageInBattle();
      $$('[data-aza-question-lang]', controls).forEach(btn => {
        btn.classList.toggle('is-active', btn.dataset.azaQuestionLang === active);
        btn.setAttribute('aria-pressed', String(btn.dataset.azaQuestionLang === active));
      });
      card.prepend(controls);
    }
  }

  function safeAvatar(value) {
    if (!value) return '';
    try {
      const u = new URL(String(value), location.href);
      const sameSite = u.origin === location.origin && /(?:^|\/)avatar-[a-z0-9-]+\.svg$/i.test(u.pathname);
      const storage = API && u.origin === new URL(API).origin && u.pathname.startsWith('/storage/v1/object/public/profile-avatars/') && /\.(?:webp|png|jpe?g)$/i.test(u.pathname);
      return (sameSite || storage) ? u.href : '';
    } catch { return ''; }
  }

  function getRank(points) {
    let rank = RANKS[0];
    for (const item of RANKS) if (Number(points || 0) >= item.min) rank = item;
    return rank;
  }

  function playerName(player) {
    const strong = $('.aza-battle-player-info strong', player);
    if (!strong) return '';
    const raw = strong.childNodes.length ? (strong.childNodes[0].textContent || '') : strong.textContent;
    return String(raw || '').replace(/\s*\((?:сен|ты)\)\s*$/i, '').trim();
  }

  async function fetchProfiles(names, force = false) {
    if (!API || !KEY || !names.length) return;
    const now = Date.now();
    const unique = [...new Set(names.filter(Boolean))];
    const need = unique.filter(name => force || !profileCache.has(name) || profileCache.get(name).expiresAt <= now);
    if (!need.length) return;
    const key = need.sort().join('|');
    if (pendingProfiles.has(key)) return pendingProfiles.get(key);
    const promise = (async () => {
      const safeNames = need.slice(0, 20).map(name => `"${String(name).replace(/[\\"]/g, '\\$&')}"`).join(',');
      const session = readSession();
      const headers = {apikey:KEY, Accept:'application/json'};
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
      const response = await fetch(`${API}/rest/v1/profiles?select=username,avatar_url,avatar_frame,total_points&username=in.(${encodeURIComponent(safeNames)})`, {headers, cache:'no-store'});
      if (!response.ok) throw new Error(`Profile lookup HTTP ${response.status}`);
      const rows = await response.json();
      for (const p of rows || []) profileCache.set(p.username, {...p, expiresAt:now + 120000});
      for (const name of need) if (!profileCache.has(name)) profileCache.set(name, {username:name, avatar_url:null, avatar_frame:'bronze', total_points:0, expiresAt:now + 30000});
    })().catch(err => console.warn('AZA battle profile decoration:', err)).finally(() => pendingProfiles.delete(key));
    pendingProfiles.set(key, promise);
    return promise;
  }

  function decoratePlayer(player, profile) {
    if (!profile) return;
    const avatar = $('.aza-battle-player-avatar', player);
    const info = $('.aza-battle-player-info', player);
    if (!avatar || !info) return;
    const frame = RANKS.some(r => r.id === profile.avatar_frame) ? profile.avatar_frame : getRank(profile.total_points).id;
    avatar.classList.add('aza-arena-avatar', `aza-frame-${frame}`);
    const url = safeAvatar(profile.avatar_url);
    const name = profile.username || playerName(player) || 'A';
    const contentKey = `${url}|${name.slice(0,1)}|${frame}`;
    if (avatar.dataset.azaContentKey !== contentKey) {
      avatar.innerHTML = url
        ? `<img src="${esc(url)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
        : `<span>${esc(name.slice(0,1).toUpperCase())}</span>`;
      avatar.dataset.azaContentKey = contentKey;
    }
    const rank = getRank(profile.total_points);
    let meta = $('.aza-battle-profile-meta', info);
    if (!meta) {
      meta = document.createElement('small');
      meta.className = 'aza-battle-profile-meta';
      info.appendChild(meta);
    }
    meta.innerHTML = `<span class="aza-battle-rank-badge aza-rank-${esc(rank.id)}">${esc(tr(rank.ky, rank.ru))}</span><span class="aza-battle-profile-points">★ ${Number(profile.total_points || 0).toLocaleString(language() === 'ru' ? 'ru-RU' : 'ky-KG')} ${esc(tr('упай', 'очков'))}</span>`;
    player.dataset.azaProfileDecorated = name;
  }

  let decorateTimer = 0;
  async function decorateBattlePlayers(force = false) {
    const content = $('#azaBattleContent');
    if (!content) return;
    const players = $$('.aza-battle-player:not(.empty)', content);
    const names = players.map(playerName).filter(Boolean);
    if (!names.length) return;
    await fetchProfiles(names, force);
    for (const player of players) {
      const name = playerName(player);
      const profile = profileCache.get(name);
      if (profile) decoratePlayer(player, profile);
    }
  }

  function observeBattle() {
    const content = $('#azaBattleContent');
    if (!content || content.dataset.azaFixObserver === '1') return;
    content.dataset.azaFixObserver = '1';
    const mo = new MutationObserver(() => {
      installQuestionLanguageControls();
      clearTimeout(decorateTimer);
      decorateTimer = window.setTimeout(() => {
        const result = $('.aza-battle-result-hero', content);
        void decorateBattlePlayers(!!result && content.dataset.azaRatingRefresh !== '1');
        if (result) content.dataset.azaRatingRefresh = '1';
        else delete content.dataset.azaRatingRefresh;
      }, 90);
    });
    mo.observe(content, {childList:true, subtree:true});
    installQuestionLanguageControls();
    void decorateBattlePlayers();
  }

  function updateSocialLanguageOnToggle() {
    $('#langToggle')?.addEventListener('click', () => {
      window.setTimeout(() => {
        const overlay = $('#aza-social-overlay');
        if (!overlay || overlay.hidden) return;
        const intro = $('.aza-social-head p', overlay);
        if (intro) intro.textContent = tr('Достор менен байланыш, жалпы чат жана оюнчулардын абалы.', 'Общий чат, друзья и статус игроков в одном месте.');
        const buttons = $$('[data-social-tab]', overlay);
        const badge = $('#azaSocialFriendBadge', overlay);
        const labels = {global:tr('🌐 Жалпы чат','🌐 Общий чат'),friends:tr('♧ Достор','♧ Друзья'),dms:tr('✉ Жеке чаттар','✉ Личные чаты')};
        for (const button of buttons) {
          const tab = button.dataset.socialTab;
          const tail = tab === 'friends' && badge ? badge.outerHTML : '';
          button.innerHTML = `${esc(labels[tab] || tab)} ${tail}`;
          if (tab === 'friends' && badge) {
            const b = $('.aza-social-badge', button);
            if (b) b.hidden = badge.hidden;
          }
        }
        // Update the open global chat's interface labels in place without discarding messages.
        const chatTitle = $('.aza-social-chat-title h3', overlay);
        const chatHint = $('.aza-social-chat-title p', overlay);
        if (chatTitle && chatTitle.textContent.includes('чат')) chatTitle.textContent = tr('🌐 Жалпы чат','🌐 Общий чат');
        if (chatHint) chatHint.textContent = tr('Сылык сүйлөш. HTML жана активдүү шилтемелер иштетилбейт.','Общайся уважительно. HTML и активные ссылки не выполняются.');
        const input = $('#azaSocialMessageInput', overlay);
        if (input) input.placeholder = tr('Билдирүү жаз…','Напиши сообщение…');
        const send = $('#azaSocialComposer button[type="submit"]', overlay);
        if (send) send.textContent = `${tr('Жөнөтүү','Отправить')} ↗`;
      }, 0);
    });
  }

  function init() {
    addStylesheet();
    accountRibbon();
    observeBattle();
    updateSocialLanguageOnToggle();
    const bodyObserver = new MutationObserver(() => {
      if (!$('#azaRegistrationRibbon')) accountRibbon();
      observeBattle();
    });
    bodyObserver.observe(document.body, {childList:true, subtree:true});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();

  document.addEventListener('click', event => {
    const langButton = event.target.closest('[data-aza-question-lang]');
    if (langButton) {
      event.preventDefault();
      event.stopPropagation();
      const target = langButton.dataset.azaQuestionLang;
      if (!['ky','ru'].includes(target)) return;
      switchLanguage(target);
      window.setTimeout(() => {
        installQuestionLanguageControls();
        $$('[data-aza-question-lang]').forEach(btn => {
          const active = btn.dataset.azaQuestionLang === language();
          btn.classList.toggle('is-active', active);
          btn.setAttribute('aria-pressed', String(active));
        });
      }, 50);
    }
  }, true);
})();
