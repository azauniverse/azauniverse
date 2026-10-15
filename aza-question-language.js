/* AZA UNIVERSE — KG/RU quiz controls + founder crown v4.
 * Lightweight on question open: question-bank JSON is downloaded only when KG/RU is tapped.
 * Keeps the app's original answer buttons/indexes and uses a single observer on #modalContent.
 */
(() => {
  'use strict';
  if (window.__AZA_QUESTION_LANGUAGE_V4__) return;
  window.__AZA_QUESTION_LANGUAGE_V4__ = true;

  const scriptUrl = document.currentScript?.src || new URL('aza-question-language.js', location.href).href;
  const baseUrl = new URL('.', scriptUrl);
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const lang = () => (localStorage.getItem('aza-lang') || document.documentElement.lang || 'ky').toLowerCase() === 'ru' ? 'ru' : 'ky';
  const tr = (ky, ru) => lang() === 'ru' ? ru : ky;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const cfg = window.AZA_SUPABASE_CONFIG || {};
  const API = String(cfg.projectUrl || '').replace(/\/$/, '');
  const KEY = String(cfg.publishableKey || '');
  const categories = {
    general: ['Жалпы билим','Общие знания'], iq: ['IQ жана логика','IQ и логика'],
    anime: ['Аниме дүйнөсү','Мир аниме'], cars: ['Авто дүйнөсү','Мир авто'],
    driving: ['Жол эрежелери','Правила дорожного движения'], movies: ['Кино жана сериалдар','Фильмы и сериалы'],
    cartoons: ['Мультфильмдер','Мультфильмы'], islam: ['Ислам билими','Знания об исламе'],
    history: ['Дүйнө тарыхы','Всемирная история'], world: ['Дүйнө тааным','География мира'],
    science: ['Илим жана табият','Наука и природа'], riddles: ['Табышмактар','Загадки'],
    kids: ['Балдар үчүн','Для детей']
  };
  const difficultyNames = {
    easy: {ky:'ЖЕҢИЛ',ru:'ЛЁГКИЙ'}, medium: {ky:'ОРТОЧО',ru:'СРЕДНИЙ'}, hard: {ky:'ТАТАЛ',ru:'СЛОЖНЫЙ'}
  };
  const ranks = [
    {id:'bronze',min:0,ky:'Коло',ru:'Бронза'}, {id:'silver',min:500,ky:'Күмүш',ru:'Серебро'},
    {id:'gold',min:1500,ky:'Алтын',ru:'Золото'}, {id:'platinum',min:3000,ky:'Платина',ru:'Платина'},
    {id:'diamond',min:5000,ky:'Алмаз',ru:'Алмаз'}, {id:'master',min:8000,ky:'Мастер',ru:'Мастер'},
    {id:'ace',min:12000,ky:'Эйс',ru:'Эйс'}, {id:'conqueror',min:20000,ky:'Космостук жеңүүчү',ru:'Завоеватель'}
  ];
  // Crown is cosmetic and reserved to the owner's authenticated Supabase UUID.
  // Never grant it from a username, handle, or client-editable profile field.
  const FOUNDER_ID = '362b8778-de25-4846-9bf7-c514842d159e';
  const FOUNDER_NAME = 'AZAMAT AKMATOV';

  const bankPromises = new Map();
  const bankRows = new Map();
  const profilePromises = new Map();
  const profileCache = new Map();
  let preferredQuestionLanguage = lang();
  let debounceTimer = 0;
  let enhancing = false;

  function ensureCss() {
    if ($('link[data-aza-question-language-v4]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('aza-question-language.css?v=4', baseUrl).href;
    link.dataset.azaQuestionLanguageV3 = '1';
    document.head.appendChild(link);
  }

  function categoryFromEyebrow(text) {
    const first = String(text || '').split(/[•·]/)[0].trim();
    const key = norm(first);
    for (const [id, names] of Object.entries(categories)) {
      if (names.some(name => norm(name) === key)) return id;
    }
    return '';
  }

  function questionProgress(content) {
    const text = $('.eyebrow', content)?.textContent || '';
    return text.match(/\b\d+\s*\/\s*\d+\s*$/)?.[0]?.replace(/\s/g, '') || '';
  }

  function uiSignature(content, category, titleText) {
    return `${category}|${norm(titleText)}|${questionProgress(content)}`;
  }

  function ensureToolbar(content) {
    let toolbar = $('.aza-quiz-language-toolbar', content);
    if (toolbar) return toolbar;
    toolbar = document.createElement('div');
    toolbar.className = 'aza-quiz-language-toolbar';
    toolbar.setAttribute('role', 'group');
    toolbar.setAttribute('aria-label', 'Question language / Суроонун тили');
    toolbar.innerHTML = `
      <span data-aza-quiz-language-label>${tr('СУРООНУН ТИЛИ','ЯЗЫК ВОПРОСА')}</span>
      <button type="button" data-aza-quiz-language="ky" aria-label="Кыргызча" aria-pressed="false">KG</button>
      <button type="button" data-aza-quiz-language="ru" aria-label="Русский" aria-pressed="false">RU</button>`;
    const eyebrow = $('.eyebrow', content);
    // Put controls below the eyebrow so the modal's top-right × button cannot cover them.
    if (eyebrow) eyebrow.insertAdjacentElement('afterend', toolbar);
    else content.prepend(toolbar);
    return toolbar;
  }

  function setToolbarState(content, active, label = '') {
    const toolbar = $('.aza-quiz-language-toolbar', content);
    if (!toolbar) return;
    const labelEl = $('[data-aza-quiz-language-label]', toolbar);
    const nextLabel = label || (active === 'ru' ? 'ЯЗЫК ВОПРОСА' : 'СУРООНУН ТИЛИ');
    if (labelEl && labelEl.textContent !== nextLabel) labelEl.textContent = nextLabel;
    $$('[data-aza-quiz-language]', toolbar).forEach(button => {
      const isActive = button.dataset.azaQuizLanguage === active;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
  }

  function ensureProfileStrip(content) {
    let strip = $('.aza-quiz-profile-strip', content);
    if (strip) return strip;
    strip = document.createElement('div');
    strip.className = 'aza-quiz-profile-strip is-loading';
    strip.setAttribute('aria-label', tr('Оюнчу профили','Профиль игрока'));
    strip.innerHTML = `<span class="aza-quiz-profile-avatar">A</span><span class="aza-quiz-profile-details"><strong>${tr('Профиль жүктөлүүдө…','Загрузка профиля…')}</strong><small>${tr('Упай жана ранг','Очки и ранг')}</small></span><span class="aza-quiz-profile-rank">AZA</span>`;
    const toolbar = $('.aza-quiz-language-toolbar', content);
    if (toolbar) toolbar.insertAdjacentElement('afterend', strip);
    else content.prepend(strip);
    return strip;
  }

  function readSession() {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !/^sb-.+-auth-token$/.test(key)) continue;
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const session = parsed?.currentSession || parsed?.session || parsed;
        if (session?.access_token && session?.user?.id) return session;
      }
    } catch (_) {}
    return null;
  }

  function safeAvatar(value) {
    if (!value) return '';
    try {
      const u = new URL(String(value), location.href);
      const local = u.origin === location.origin && /(?:^|\/)avatar-[a-z0-9-]+\.svg$/i.test(u.pathname);
      const storage = API && u.origin === new URL(API).origin && u.pathname.startsWith('/storage/v1/object/public/profile-avatars/') && /\.(?:webp|png|jpe?g|svg)$/i.test(u.pathname);
      return local || storage ? u.href : '';
    } catch (_) { return ''; }
  }

  function rankFor(points) {
    let rank = ranks[0];
    for (const item of ranks) if (Number(points || 0) >= item.min) rank = item;
    return rank;
  }

  async function loadOwnProfile(session) {
    const userId = session?.user?.id;
    if (!userId || !API || !KEY) return null;
    const cached = profileCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) return cached.profile;
    if (profilePromises.has(userId)) return profilePromises.get(userId);

    const task = (async () => {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 6500);
      try {
        const url = new URL(`${API}/rest/v1/profiles`);
        url.searchParams.set('select','id,username,total_points,avatar_url,avatar_frame');
        url.searchParams.set('id',`eq.${userId}`);
        url.searchParams.set('limit','1');
        const response = await fetch(url.toString(), {
          headers: {apikey:KEY, Authorization:`Bearer ${session.access_token}`, Accept:'application/json'},
          cache:'no-store', signal:controller.signal
        });
        if (!response.ok) throw new Error(`Profile lookup HTTP ${response.status}`);
        const rows = await response.json();
        const profile = Array.isArray(rows) && rows.length ? rows[0] : null;
        profileCache.set(userId,{profile,expiresAt:Date.now()+60000});
        return profile;
      } catch (error) {
        console.warn('AZA quiz profile lookup failed',error);
        profileCache.set(userId,{profile:null,expiresAt:Date.now()+15000});
        return null;
      } finally {
        clearTimeout(timeout);
        profilePromises.delete(userId);
      }
    })();
    profilePromises.set(userId,task);
    return task;
  }

  async function decorateProfile(content) {
    const strip = ensureProfileStrip(content);
    if (strip.dataset.loading === '1' || strip.dataset.loaded === '1') return;
    const session = readSession();
    if (!session) {
      strip.dataset.loaded = '1';
      strip.classList.remove('is-loading','is-founder');
      strip.classList.add('is-guest');
      $('.aza-quiz-profile-avatar',strip).textContent = 'A';
      $('.aza-quiz-profile-details',strip).innerHTML = `<strong>${tr('Конок оюнчу','Гость')}</strong><small>${tr('Рейтинг сактоо үчүн аккаунтка кир','Войди, чтобы сохранять рейтинг')}</small>`;
      $('.aza-quiz-profile-rank',strip).textContent = tr('КИРҮҮ','ВХОД');
      return;
    }
    strip.dataset.loading = '1';
    const userId = session.user.id;
    const profile = await loadOwnProfile(session);
    if (!strip.isConnected) return;
    delete strip.dataset.loading;
    strip.dataset.loaded = '1';
    strip.classList.remove('is-loading');

    const isFounder = String(userId).toLowerCase() === FOUNDER_ID;
    strip.classList.toggle('is-founder', isFounder);
    const username = isFounder
      ? FOUNDER_NAME
      : String(profile?.username || session.user?.user_metadata?.username || (session.user?.email || 'AZA Player').split('@')[0] || 'AZA Player');
    const points = Number(profile?.total_points || 0);
    const rank = rankFor(points);
    const avatar = $('.aza-quiz-profile-avatar',strip);
    const details = $('.aza-quiz-profile-details',strip);
    const badge = $('.aza-quiz-profile-rank',strip);
    const pointsText = `${points.toLocaleString(lang()==='ru'?'ru-RU':'ky-KG')} ${tr('упай','очков')}`;
    if (details) {
      const founderHandle = isFounder ? '@AZAUNIVERSE · ' : '';
      details.innerHTML = `<strong>${esc(username)}</strong><small>${founderHandle}${pointsText} · ${tr('профиль рейтинги','рейтинг профиля')}</small>`;
    }
    if (badge) {
      if (isFounder) {
        badge.textContent = '♛ FOUNDER';
        badge.dataset.rank = 'founder';
        badge.title = tr('Долбоордун негиздөөчүсү','Основатель проекта');
        badge.setAttribute('aria-label', badge.title);
      } else {
        badge.textContent = `${rank.id==='bronze'?'✦ ':rank.id==='silver'?'◆ ':rank.id==='gold'?'✪ ':rank.id==='platinum'?'✧ ':'★ '}${rank[lang()]}`;
        badge.dataset.rank = rank.id;
        badge.removeAttribute('title');
        badge.removeAttribute('aria-label');
      }
    }
    if (avatar) {
      const profileFrame = ranks.some(item => item.id === profile?.avatar_frame) ? profile.avatar_frame : rank.id;
      const frame = isFounder ? 'founder' : profileFrame;
      avatar.classList.add('has-frame',`aza-quiz-frame-${frame}`);
      const url = safeAvatar(profile?.avatar_url);
      avatar.innerHTML = url ? `<img src="${esc(url)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : esc(username.slice(0,1).toUpperCase() || 'A');
    }
  }

  async function loadBank(category) {
    if (bankRows.has(category)) return bankRows.get(category);
    if (bankPromises.has(category)) return bankPromises.get(category);
    const task = (async () => {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 12000);
      try {
        const response = await fetch(new URL(`question-bank/${category}.json`,baseUrl),{cache:'force-cache',signal:controller.signal});
        if (!response.ok) throw new Error(`Question bank HTTP ${response.status}`);
        const data = await response.json();
        if (!Array.isArray(data.questions)) throw new Error('Invalid question bank file');
        bankRows.set(category,data.questions);
        return data.questions;
      } finally {
        clearTimeout(timeout);
        bankPromises.delete(category);
      }
    })();
    bankPromises.set(category,task);
    return task;
  }

  function findRecord(rows,title) {
    const key = norm(title);
    let item = rows.find(row => norm(row?.ky?.q) === key || norm(row?.ru?.q) === key);
    if (!item && key.length > 12) {
      const hits = rows.filter(row => {
        const ky = norm(row?.ky?.q), ru = norm(row?.ru?.q);
        return (ky && (ky.includes(key) || key.includes(ky))) || (ru && (ru.includes(key) || key.includes(ru)));
      });
      if (hits.length === 1) item = hits[0];
    }
    return item || null;
  }

  function questionLanguage(record,title) {
    const key = norm(title);
    const kyMatch = norm(record?.ky?.q) === key;
    const ruMatch = norm(record?.ru?.q) === key;
    if (kyMatch && !ruMatch) return 'ky';
    if (ruMatch && !kyMatch) return 'ru';
    return preferredQuestionLanguage;
  }

  function updateEyebrow(content,category,record,target) {
    const eyebrow = $('.eyebrow',content);
    if (!eyebrow) return;
    const progress = questionProgress(content);
    const name = (categories[category] || ['', ''])[target === 'ru' ? 1 : 0].toUpperCase();
    const difficulty = difficultyNames[record.difficulty]?.[target] || '';
    const next = `${name} • ${difficulty}${progress ? ` • ${progress}` : ''}`;
    if (eyebrow.textContent !== next) eyebrow.textContent = next;
  }

  function updateFeedback(content,record,target) {
    const paragraphs = $$('#quizFeedback .result-box p',content);
    if (!paragraphs.length) return;
    const old = paragraphs[0].textContent || '';
    const score = old.match(/\+\s*(\d+)/)?.[1] || '0';
    let next = old;
    if (/мурда туура|уже отвечали/i.test(old)) next = target==='ru' ? 'На этот вопрос уже отвечали правильно — повторные очки не начислены.' : 'Бул суроого мурда туура жооп берилген — упай кайра кошулган жок.';
    else if (/туура эмес|неверно|ошибка/i.test(old)) next = target==='ru' ? 'В этот раз неверно.' : 'Бул жолу туура эмес.';
    else if (/туура!|верно!/i.test(old)) next = target==='ru' ? `Верно! +${score} очков` : `Туура! +${score} упай`;
    if (paragraphs[0].textContent !== next) paragraphs[0].textContent = next;
    if (paragraphs[1] && paragraphs[1].textContent !== (record[target]?.why || '')) paragraphs[1].textContent = record[target]?.why || '';
    const nextButton = $('#nextQuestion',content);
    if (nextButton) {
      const isResult = /РЕЗУЛЬТАТ|ЖЫЙЫНТЫК/.test(nextButton.textContent);
      const nextText = target==='ru' ? (isResult?'РЕЗУЛЬТАТ':'СЛЕДУЮЩИЙ ВОПРОС →') : (isResult?'ЖЫЙЫНТЫК':'КИЙИНКИ СУРОО →');
      if (nextButton.textContent !== nextText) nextButton.textContent = nextText;
    }
  }

  function applyQuestionLanguage(content,category,record,target) {
    const title = $('#modalTitle',content);
    const options = $('#quizOptions',content);
    if (!title || !options || !record?.[target]) return false;
    const sourceLang = questionLanguage(record,title.textContent);
    const source = record[sourceLang];
    const destination = record[target];
    const buttons = $$('.quiz-option[data-answer]',options);
    if (!source?.a || !destination?.a || buttons.length !== 4) return false;
    const indexes = buttons.map(button => source.a.findIndex(answer => norm(answer) === norm(button.textContent)));
    if (indexes.some(index => index < 0) || new Set(indexes).size !== 4) return false;

    preferredQuestionLanguage = target;
    content.dataset.azaQuestionUiSignature = `${category}|${norm(destination.q)}|${questionProgress(content)}`;
    if (title.textContent !== destination.q) title.textContent = destination.q;
    buttons.forEach((button,index) => {
      const translated = destination.a[indexes[index]];
      if (button.textContent !== translated) button.textContent = translated;
    });
    updateEyebrow(content,category,record,target);
    const pointLine = options.previousElementSibling;
    if (pointLine?.tagName === 'P') {
      const points = pointLine.textContent.match(/\d+/)?.[0] || '10';
      const text = target === 'ru' ? `За правильный ответ — ${points} очков.` : `Туура жооп үчүн ${points} упай.`;
      if (pointLine.textContent !== text) pointLine.textContent = text;
    }
    updateFeedback(content,record,target);
    content.dataset.azaQuestionLanguage = target;
    setToolbarState(content,target);
    return true;
  }

  async function enhanceQuestion() {
    if (enhancing) return;
    const content = $('#modalContent');
    const title = $('#modalTitle',content || document);
    const options = $('#quizOptions',content || document);
    if (!content || !title || !options || $$('.quiz-option[data-answer]',options).length !== 4) return;
    const category = categoryFromEyebrow($('.eyebrow',content)?.textContent || '');
    if (!category) return;
    const questionText = title.textContent || '';
    const signature = uiSignature(content,category,questionText);
    ensureToolbar(content);
    ensureProfileStrip(content);
    if (content.dataset.azaQuestionUiSignature === signature) {
      setToolbarState(content,content.dataset.azaQuestionLanguage || preferredQuestionLanguage);
      void decorateProfile(content);
      return;
    }
    content.dataset.azaQuestionUiSignature = signature;
    void decorateProfile(content);

    // Only reuse the bank if the player already selected KG/RU in this category.
    // Opening a question never triggers a large JSON download or parsing work.
    if (!bankRows.has(category)) {
      const visibleLanguage = lang();
      preferredQuestionLanguage = visibleLanguage;
      content.dataset.azaQuestionLanguage = visibleLanguage;
      setToolbarState(content,visibleLanguage);
      return;
    }
    enhancing = true;
    try {
      const record = findRecord(bankRows.get(category),questionText);
      if (!record) { setToolbarState(content,lang(),tr('КОТОРМО ТАБЫЛГАН ЖОК','ПЕРЕВОД НЕ НАЙДЕН')); return; }
      const sourceLanguage = questionLanguage(record,questionText);
      if (preferredQuestionLanguage !== sourceLanguage) {
        if (!applyQuestionLanguage(content,category,record,preferredQuestionLanguage)) setToolbarState(content,sourceLanguage,tr('КОТОРМО БУЛ СУРООДО ЖОК','ПЕРЕВОД НЕДОСТУПЕН'));
      } else {
        content.dataset.azaQuestionLanguage = sourceLanguage;
        setToolbarState(content,sourceLanguage);
      }
    } finally {
      enhancing = false;
    }
  }

  async function onLanguageClick(button,content) {
    const target = button.dataset.azaQuizLanguage;
    const category = categoryFromEyebrow($('.eyebrow',content)?.textContent || '');
    const title = $('#modalTitle',content);
    if (!category || !title || !['ky','ru'].includes(target)) return;
    const toolbar = $('.aza-quiz-language-toolbar',content);
    const buttons = $$('[data-aza-quiz-language]',toolbar);
    buttons.forEach(item => { item.disabled = true; item.setAttribute('aria-busy','true'); });
    setToolbarState(content,target,target==='ru'?'КОТОРМО КҮТҮЛҮҮДӨ…':'КОТОРМО КҮТҮЛҮҮДӨ…');
    try {
      const rows = await loadBank(category);
      if (!content.isConnected || !$('#quizOptions',content)) return;
      const record = findRecord(rows,$('#modalTitle',content)?.textContent || '');
      if (!record) {
        setToolbarState(content,lang(),target==='ru'?'ПЕРЕВОД НЕ НАЙДЕН':'КОТОРМО ТАБЫЛГАН ЖОК');
        return;
      }
      const currentLang = questionLanguage(record,$('#modalTitle',content).textContent);
      if (currentLang === target) {
        preferredQuestionLanguage = target;
        content.dataset.azaQuestionLanguage = target;
        content.dataset.azaQuestionUiSignature = uiSignature(content,category,$('#modalTitle',content).textContent);
        setToolbarState(content,target);
        return;
      }
      if (!applyQuestionLanguage(content,category,record,target)) {
        setToolbarState(content,currentLang,target==='ru'?'TRANSLATION UNAVAILABLE':'КОТОРМО БУЛ СУРООДО ЖОК');
      }
    } catch (error) {
      console.warn('AZA question language switch failed',error);
      setToolbarState(content,lang(),target==='ru'?'TRANSLATION ERROR':'КОТОРМОДО КАТА');
    } finally {
      buttons.forEach(item => { item.disabled = false; item.removeAttribute('aria-busy'); });
    }
  }

  function scheduleEnhance() {
    clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => { void enhanceQuestion(); },100);
  }

  function init() {
    ensureCss();
    const content = $('#modalContent');
    if (!content || content.dataset.azaQuestionLanguageObserverV4 === '1') return;
    content.dataset.azaQuestionLanguageObserverV4 = '1';
    const observer = new MutationObserver(() => scheduleEnhance());
    observer.observe(content,{childList:true,subtree:true});
    void enhanceQuestion();
  }

  document.addEventListener('click',event => {
    const button = event.target.closest('[data-aza-quiz-language]');
    if (!button) return;
    const content = button.closest('#modalContent');
    if (!content) return;
    event.preventDefault();
    event.stopPropagation();
    void onLanguageClick(button,content);
  },true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
