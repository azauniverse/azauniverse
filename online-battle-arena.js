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
    link.href = 'online-battle-arena.css?v=1';
    link.dataset.azaArenaCss = 'true';
    document.head.appendChild(link);
  }

  function rankForPoints(points) {
    const p = Math.max(0, Number(points) || 0);
    const ranks = [
      { id: 'bronze', min: 0, ky: 'БРОНЗА', ru: 'БРОНЗА', icon: '🥉' },
      { id: 'silver', min: 500, ky: 'КҮМҮШ', ru: 'СЕРЕБРО', icon: '🥈' },
      { id: 'gold', min: 1200, ky: 'АЛТЫН', ru: 'ЗОЛОТО', icon: '🥇' },
      { id: 'platinum', min: 2000, ky: 'ПЛАТИНА', ru: 'ПЛАТИНА', icon: '💠' },
      { id: 'diamond', min: 3000, ky: 'АЛМАЗ', ru: 'АЛМАЗ', icon: '💎' },
      { id: 'master', min: 4500, ky: 'МАСТЕР', ru: 'МАСТЕР', icon: '⚡' },
      { id: 'legend', min: 6500, ky: 'ЛЕГЕНДА', ru: 'ЛЕГЕНДА', icon: '👑' }
    ];
    return [...ranks].reverse().find(r => p >= r.min) || ranks[0];
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
        url.searchParams.set('select', 'username,total_points');
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
        return { username: rows[0].username, total_points: Number(rows[0].total_points || 0) };
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
    if (!content || content.querySelector(':scope > .aza-arena-match-header')) return;
    const header = document.createElement('div');
    header.className = 'aza-arena-match-header';
    header.innerHTML = `<span class="aza-arena-brand-mark" aria-hidden="true">A</span><span class="aza-arena-brand-copy"><strong>AZA UNIVERSE</strong><small>${tx('ONLINE BATTLE ARENA', 'ОНЛАЙН-БАТТЛ АРЕНА')}</small></span><span class="aza-arena-live-pill">${tx('АРЕНА', 'АРЕНА')}</span>`;
    content.prepend(header);
  }

  async function decoratePlayer(row) {
    if (!row || row.classList.contains('empty') || row.dataset.azaArenaDecorated === '1') return;
    const info = row.querySelector('.aza-battle-player-info');
    const username = displayName(row);
    if (!info || !username) return;

    row.dataset.azaArenaDecorated = '1';
    const meta = document.createElement('div');
    meta.className = 'aza-arena-player-meta';
    meta.innerHTML = `<span class="aza-arena-rank" data-rank="bronze">✦ ${tx('ПРОФИЛЬ', 'ПРОФИЛЬ')}</span><span class="aza-arena-profile-points">${tx('Упай жүктөлүүдө…', 'Загрузка очков…')}</span>`;
    info.appendChild(meta);

    const profile = await getProfile(username);
    // Row may be replaced by the next server snapshot while the request is pending.
    if (!row.isConnected) return;
    const badge = meta.querySelector('.aza-arena-rank');
    const pointsLabel = meta.querySelector('.aza-arena-profile-points');
    if (!profile) {
      badge.dataset.rank = 'bronze';
      badge.textContent = `✦ ${tx('ОЮНЧУ', 'ИГРОК')}`;
      pointsLabel.textContent = tx('Профиль жеткиликсиз', 'Профиль недоступен');
      return;
    }
    const rank = rankForPoints(profile.total_points);
    badge.dataset.rank = rank.id;
    badge.textContent = `${rank.icon} ${rank[lang()]}`;
    pointsLabel.textContent = `★ ${profile.total_points.toLocaleString(lang() === 'ru' ? 'ru-RU' : 'ky-KG')} ${tx('жалпы упай', 'общ. очков')}`;
    const strong = info.querySelector('strong');
    if (strong && profile.username) {
      const first = Array.from(strong.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
      if (first && first.textContent.trim() !== profile.username) first.textContent = `${profile.username} `;
    }
    const avatar = row.querySelector('.aza-battle-player-avatar');
    if (avatar) {
      avatar.title = `${profile.username} · ${rank[lang()]}`;
      avatar.setAttribute('aria-label', `${tx('Оюнчу', 'Игрок')} ${profile.username}`);
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
