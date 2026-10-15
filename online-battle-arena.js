/* AZA UNIVERSE Online Battle Arena UI addon.
 * Load after online-battle.js. Does not change match RPCs or the 60-second timer rules.
 */
(() => {
  'use strict';
  if (window.__AZA_BATTLE_ARENA_ADDON__) return;
  window.__AZA_BATTLE_ARENA_ADDON__ = true;

  const cfg = window.AZA_SUPABASE_CONFIG || {};
  const API = String(cfg.projectUrl || '').replace(/\/$/, '');
  const KEY = String(cfg.publishableKey || '');
  const profileCache = new Map();
  let scheduled = false;

  const lang = () => (localStorage.getItem('aza-lang') || document.documentElement.lang || 'ky') === 'ru' ? 'ru' : 'ky';
  const tx = (ky, ru) => lang() === 'ru' ? ru : ky;

  function session() {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !/^sb-.+-auth-token$/.test(key)) continue;
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const s = parsed?.currentSession || parsed?.session || parsed;
        if (s?.access_token && s?.user?.id) return s;
      }
    } catch (_) {}
    return null;
  }

  function ensureCss() {
    if (document.querySelector('link[data-aza-arena-css]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'online-battle-arena.css?v=2';
    link.dataset.azaArenaCss = 'true';
    document.head.appendChild(link);
  }

  const rankDefs = [
    { id: 'bronze', min: 0, ky: 'КОЛО', ru: 'БРОНЗА', icon: '✦' },
    { id: 'silver', min: 500, ky: 'КҮМҮШ', ru: 'СЕРЕБРО', icon: '✧' },
    { id: 'gold', min: 1500, ky: 'АЛТЫН', ru: 'ЗОЛОТО', icon: '◆' },
    { id: 'platinum', min: 3000, ky: 'ПЛАТИНА', ru: 'ПЛАТИНА', icon: '◇' },
    { id: 'diamond', min: 5000, ky: 'АЛМАЗ', ru: 'АЛМАЗ', icon: '❖' },
    { id: 'master', min: 8000, ky: 'МАСТЕР', ru: 'МАСТЕР', icon: '✧' },
    { id: 'ace', min: 12000, ky: 'ЭЙС', ru: 'ЭЙС', icon: '⬡' },
    { id: 'conqueror', min: 20000, ky: 'КОСМОСТУК ЖЕҢҮҮЧҮ', ru: 'ЗАВОЕВАТЕЛЬ', icon: '✦' }
  ];
  const frameIds = ['bronze','silver','gold','platinum','diamond','master','ace','conqueror'];
  const FOUNDER_ID = '362b8778-de25-4846-9bf7-c514842d159e';

  function rankForPoints(points) {
    const p = Math.max(0, Number(points) || 0);
    return [...rankDefs].reverse().find(r => p >= r.min) || rankDefs[0];
  }

  function safeAvatarUrl(value) {
    if (!value) return '';
    try {
      const u = new URL(String(value), location.href);
      const siteOk = u.origin === location.origin && (
        (u.pathname.includes('/azauniverse/avatar-') && u.pathname.endsWith('.svg')) ||
        /^\/avatar-[a-z0-9-]+\.svg$/i.test(u.pathname)
      );
      const storageOk = API && u.origin === new URL(API).origin &&
        u.pathname.startsWith('/storage/v1/object/public/profile-avatars/');
      return siteOk || storageOk ? u.href : '';
    } catch (_) { return ''; }
  }

  function frameForProfile(profile, points) {
    if (String(profile?.id || '').toLowerCase() === FOUNDER_ID) return 'conqueror';
    const frame = String(profile?.avatar_frame || '');
    return frameIds.includes(frame) ? frame : rankForPoints(points).id;
  }

  function modeIconSvg(mode) {
    const common = 'viewBox="0 0 56 56" width="48" height="48" fill="none" aria-hidden="true" focusable="false"';
    if (mode === '1v1') return `<svg ${common}><path d="M13 10 37 34M10 19 30 39M19 10 10 19M37 34l-8 8M42 15 18 39M46 24 25 45M42 15l4 9M18 39l7 6" stroke="currentColor" stroke-width="3.3" stroke-linecap="round" stroke-linejoin="round"/><path d="m12 12 5 1 1 5M39 37l5 1 1 5" stroke="#ffc86e" stroke-width="2.7" stroke-linecap="round"/></svg>`;
    if (mode === '2v2') return `<svg ${common}><path d="M8 15 21 9l13 6v10c0 9-6 15-13 19C14 40 8 34 8 25V15Z" stroke="currentColor" stroke-width="2.8" stroke-linejoin="round"/><path d="m35 15 7-3 7 3v9c0 7-3 11-7 14-3-2-5-4-6-7" stroke="#88f0ff" stroke-width="2.7" stroke-linejoin="round"/><circle cx="21" cy="23" r="4" stroke="#ffc86e" stroke-width="2.5"/><path d="M14 34c1.5-4 4-6 7-6s5.5 2 7 6" stroke="#ffc86e" stroke-width="2.5" stroke-linecap="round"/><circle cx="42" cy="22" r="3" stroke="currentColor" stroke-width="2.4"/><path d="M37 31c1-3 2.5-4.5 5-4.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`;
    return `<svg ${common}><path d="M8 15 15 19l6-9 7 9 7-9 6 9 7-4-4 15H12L8 15Z" stroke="currentColor" stroke-width="2.8" stroke-linejoin="round"/><path d="M14 36h28M17 42h22" stroke="#ffc86e" stroke-width="2.8" stroke-linecap="round"/><circle cx="15" cy="14" r="2.3" fill="#ffc86e"/><circle cx="28" cy="10" r="2.3" fill="#ffc86e"/><circle cx="41" cy="14" r="2.3" fill="#ffc86e"/><path d="M18 27c2.5-4 6-6 10-6s7.5 2 10 6" stroke="#8df0ff" stroke-width="2.4" stroke-linecap="round"/></svg>`;
  }

  function decorateModeButtons(content) {
    content.querySelectorAll('[data-battle-mode]').forEach(button => {
      const mode = button.dataset.battleMode;
      const icon = button.querySelector(':scope > span');
      if (!icon || !['1v1','2v2','4v4'].includes(mode) || icon.dataset.azaArenaModeIcon === mode) return;
      icon.classList.add('aza-arena-mode-icon');
      icon.innerHTML = modeIconSvg(mode);
      icon.dataset.azaArenaModeIcon = mode;
      button.classList.add(`aza-arena-mode-${mode.replace('v','-v-')}`);
    });
  }

  function displayName(row) {
    const strong = row.querySelector('.aza-battle-player-info strong');
    if (!strong) return '';
    // The game adds a localized own-player tag in a <small>; only use the first text node.
    const first = Array.from(strong.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
    return String(first?.textContent || strong.textContent || '').replace(/\s+/g, ' ').trim();
  }

  async function getProfile(username) {
    const clean = String(username || '').trim();
    if (!clean || !API || KEY.length < 20) return null;
    const key = clean.toLocaleLowerCase();
    if (profileCache.has(key)) return profileCache.get(key);

    const s = session();
    if (!s) return null;

    const pending = (async () => {
      try {
        const url = new URL(`${API}/rest/v1/profiles`);
        url.searchParams.set('select', 'id,username,total_points,avatar_url,avatar_frame');
        url.searchParams.set('username', `eq.${clean}`);
        url.searchParams.set('limit', '1');
        const response = await fetch(url.toString(), {
          headers: {
            apikey: KEY,
            Authorization: `Bearer ${s.access_token}`,
            Accept: 'application/json'
          },
          cache: 'no-store'
        });
        if (!response.ok) return null;
        const rows = await response.json();
        if (!Array.isArray(rows) || !rows.length) return null;
        return { id: rows[0].id, username: rows[0].username, total_points: Number(rows[0].total_points || 0), avatar_url: rows[0].avatar_url || '', avatar_frame: rows[0].avatar_frame || 'bronze' };
      } catch (_) {
        return null;
      }
    })();
    profileCache.set(key, pending);
    const result = await pending;
    profileCache.set(key, result);
    return result;
  }

  function ensureArenaHeader(content) {
    if (!content) return;
    let header = content.querySelector(':scope > .aza-arena-match-header');
    if (!header) {
      header = document.createElement('div');
      header.className = 'aza-arena-match-header';
      header.innerHTML = `<span class="aza-arena-brand-mark" aria-hidden="true">A</span><span class="aza-arena-brand-copy"><strong>AZA UNIVERSE</strong><small>${tx('ОНЛАЙН-БАТТЛ АРЕНА', 'ОНЛАЙН-БАТТЛ АРЕНА')}</small></span><span class="aza-arena-live-pill">${tx('АРЕНА', 'АРЕНА')}</span><button class="aza-arena-close" type="button" data-battle-close aria-label="${tx('Жабуу', 'Закрыть')}">×</button>`;
      content.prepend(header);
    } else {
      let close = header.querySelector('.aza-arena-close');
      if (!close) {
        close = document.createElement('button');
        close.className = 'aza-arena-close';
        close.type = 'button';
        close.dataset.battleClose = '';
        close.setAttribute('aria-label', tx('Жабуу', 'Закрыть'));
        close.textContent = '×';
        header.appendChild(close);
      }
      close.setAttribute('aria-label', tx('Жабуу', 'Закрыть'));
      const pill = header.querySelector('.aza-arena-live-pill');
      if (pill) pill.textContent = tx('АРЕНА', 'АРЕНА');
      const sub = header.querySelector('.aza-arena-brand-copy small');
      if (sub) sub.textContent = tx('ОНЛАЙН-БАТТЛ АРЕНА', 'ОНЛАЙН-БАТТЛ АРЕНА');
    }
  }

  async function decoratePlayer(row) {
    if (!row || row.classList.contains('empty') || row.dataset.azaArenaDecorated === '1') return;
    const info = row.querySelector('.aza-battle-player-info');
    const username = displayName(row);
    if (!info || !username) return;

    row.dataset.azaArenaDecorated = '1';
    const meta = document.createElement('div');
    meta.className = 'aza-arena-player-meta';
    meta.innerHTML = `<span class="aza-arena-rank" data-rank="bronze"><span class="aza-arena-rank-glyph" aria-hidden="true">✦</span><span>${tx('ПРОФИЛЬ', 'ПРОФИЛЬ')}</span></span><span class="aza-arena-profile-points">${tx('Упай жүктөлүүдө…', 'Загрузка очков…')}</span>`;
    info.appendChild(meta);

    const profile = await getProfile(username);
    if (!row.isConnected) return;
    const badge = meta.querySelector('.aza-arena-rank');
    const badgeText = meta.querySelector('.aza-arena-rank > span:last-child');
    const pointsLabel = meta.querySelector('.aza-arena-profile-points');
    const avatar = row.querySelector('.aza-battle-player-avatar');
    if (!profile) {
      badge.dataset.rank = 'bronze';
      badgeText.textContent = tx('ПРОФИЛЬ ЖОК', 'НЕТ ПРОФИЛЯ');
      pointsLabel.textContent = tx('Рейтинг жүктөлгөн жок', 'Рейтинг недоступен');
      if (avatar) avatar.classList.add('aza-arena-avatar', 'aza-frame-bronze');
      return;
    }

    const points = Number(profile.total_points || 0);
    const rank = rankForPoints(points);
    const frame = frameForProfile(profile, points);
    badge.dataset.rank = rank.id;
    badgeText.textContent = `${rank.icon} ${rank[lang()]}`;
    pointsLabel.textContent = `★ ${points.toLocaleString(lang() === 'ru' ? 'ru-RU' : 'ky-KG')} ${tx('жалпы упай', 'общ. очков')}`;

    const strong = info.querySelector('strong');
    if (strong && profile.username) {
      const first = Array.from(strong.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
      if (first && first.textContent.trim() !== profile.username) first.textContent = `${profile.username} `;
    }

    if (avatar) {
      avatar.classList.add('aza-arena-avatar', 'aza-profile-avatar', `aza-frame-${frame}`, `aza-arena-frame-${frame}`);
      avatar.dataset.azaFrame = frame;
      avatar.dataset.azaRank = rank.id;
      avatar.title = `${profile.username} · ${rank[lang()]} · ${points} ${tx('упай', 'очков')}`;
      avatar.setAttribute('aria-label', `${tx('Оюнчу', 'Игрок')} ${profile.username}, ${rank[lang()]}, ${points} ${tx('упай', 'очков')}`);
      const safeUrl = safeAvatarUrl(profile.avatar_url);
      const currentImg = avatar.querySelector('img');
      if (safeUrl) {
        if (!currentImg || currentImg.src !== safeUrl) avatar.innerHTML = `<img src="${safeUrl}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"><span class="aza-arena-avatar-corner" aria-hidden="true">${rank.icon}</span>`;
        else if (!avatar.querySelector('.aza-arena-avatar-corner')) avatar.insertAdjacentHTML('beforeend', `<span class="aza-arena-avatar-corner" aria-hidden="true">${rank.icon}</span>`);
      } else {
        const initial = String(profile.username || 'A').trim().slice(0,1).toUpperCase() || 'A';
        avatar.innerHTML = `<span class="aza-avatar-initial">${initial}</span><span class="aza-arena-avatar-corner" aria-hidden="true">${rank.icon}</span>`;
      }
    }
  }

  function decorateTimer(content) {
    const timer = content.querySelector('.aza-battle-timer');
    if (!timer || timer.dataset.azaArenaTimer === '1') return;
    const match = timer.textContent.match(/\d+/);
    if (!match) return;
    const number = match[0];
    timer.innerHTML = `<span aria-hidden="true">⏱</span><span class="aza-arena-timer-number">${number}</span><small class="aza-arena-timer-unit">${tx('СЕК', 'СЕК')}</small>`;
    timer.dataset.azaArenaTimer = '1';
    timer.setAttribute('aria-label', `${number} ${tx('секунд калды', 'секунд осталось')}`);
  }

  function decorate() {
    scheduled = false;
    ensureCss();
    const overlay = document.querySelector('#azaBattleOverlay');
    const content = document.querySelector('#azaBattleContent');
    const modal = overlay?.querySelector('.aza-battle-modal');
    if (!overlay || !content || !modal) return;

    const playing = !!content.querySelector('.aza-battle-livebar');
    modal.classList.toggle('is-playing', playing);
    modal.classList.toggle('is-lobby', !playing && !!content.querySelector('.aza-battle-players'));

    // Add the consistent arena identity above every screen state.
    ensureArenaHeader(content);
    decorateModeButtons(content);
    if (playing) {
      decorateTimer(content);
      const footnote = content.querySelector('.aza-battle-live-foot');
      if (footnote && !footnote.querySelector('.aza-arena-answer-footnote')) {
        const note = document.createElement('p');
        note.className = 'aza-arena-answer-footnote';
        note.textContent = tx('10 СУРОО • АР БИР ЖООПКА 60 СЕКУНД', '10 ВОПРОСОВ • 60 СЕКУНД НА ОТВЕТ');
        footnote.appendChild(note);
      }
    }

    content.querySelectorAll('.aza-battle-player:not(.empty)').forEach(row => { void decoratePlayer(row); });
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(decorate);
  }

  function init() {
    ensureCss();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    schedule();
    // Language can change without a full page reload; refresh the labels on the next render.
    document.addEventListener('click', event => {
      if (event.target.closest('#langToggle')) window.setTimeout(schedule, 80);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
