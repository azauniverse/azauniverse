/* AZA UNIVERSE — regular quiz KG/RU selector + compact signed-in profile, v2.
   Safe debounce: only observes the persistent #modalContent, not the whole page.
   Leaves quiz answer handlers and online battle's 60-second timer untouched. */
(() => {
  'use strict';
  if (window.__AZA_QUESTION_LANGUAGE_V2__) return;
  window.__AZA_QUESTION_LANGUAGE_V2__ = true;

  const scriptUrl = document.currentScript?.src || new URL('aza-question-language.js', location.href).href;
  const baseUrl = new URL('.', scriptUrl);
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const lang = () => (localStorage.getItem('aza-lang') || document.documentElement.lang || 'ky').toLowerCase() === 'ru' ? 'ru' : 'ky';
  const tr = (ky, ru) => lang() === 'ru' ? ru : ky;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const cfg = window.AZA_SUPABASE_CONFIG || {};
  const API = String(cfg.projectUrl || '').replace(/\/$/, '');
  const KEY = String(cfg.publishableKey || '');
  const cats = {
    general: ['Жалпы билим','Общие знания'], iq: ['IQ жана логика','IQ и логика'],
    anime: ['Аниме дүйнөсү','Мир аниме'], cars: ['Авто дүйнөсү','Мир авто'],
    driving: ['Жол эрежелери','Правила дорожного движения'], movies: ['Кино жана сериалдар','Фильмы и сериалы'],
    cartoons: ['Мультфильмдер','Мультфильмы'], islam: ['Ислам билими','Знания об исламе'],
    history: ['Дүйнө тарыхы','Всемирная история'], world: ['Дүйнө тааным','География мира'],
    science: ['Илим жана табият','Наука и природа'], riddles: ['Табышмактар','Загадки'],
    kids: ['Балдар үчүн','Для детей']
  };
  const difficultyText = {
    easy: {ky:'ЖЕҢИЛ',ru:'ЛЁГКИЙ'}, medium: {ky:'ОРТОЧО',ru:'СРЕДНИЙ'}, hard: {ky:'ТАТАЛ',ru:'СЛОЖНЫЙ'}
  };
  const ranks = [
    {id:'bronze', min:0, ky:'Коло', ru:'Бронза'},
    {id:'silver', min:500, ky:'Күмүш', ru:'Серебро'},
    {id:'gold', min:1500, ky:'Алтын', ru:'Золото'},
    {id:'platinum', min:3000, ky:'Платина', ru:'Платина'},
    {id:'diamond', min:5000, ky:'Алмаз', ru:'Алмаз'},
    {id:'master', min:8000, ky:'Мастер', ru:'Мастер'},
    {id:'ace', min:12000, ky:'Эйс', ru:'Эйс'},
    {id:'conqueror', min:20000, ky:'Космостук жеңүүчү', ru:'Завоеватель'}
  ];
  const bankCache = new Map();
  const profileCache = new Map();
  let debounceTimer = 0;
  let enhancing = false;

  function ensureCss() {
    if ($('link[data-aza-question-language-v2]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('aza-question-language.css?v=2', baseUrl).href;
    link.dataset.azaQuestionLanguageV2 = '1';
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
        const session = parsed?.currentSession || parsed?.session || parsed;
        if (session?.access_token && session?.user?.id) return session;
      }
    } catch (_) {}
    return null;
  }

  function categoryFromEyebrow(eyebrow) {
    const first = String(eyebrow || '').split(/[•·]/)[0].trim();
    const n = norm(first);
    for (const [id, names] of Object.entries(cats)) {
      if (names.some(name => norm(name) === n)) return id;
    }
    return '';
  }

  function loadBank(category) {
    if (!bankCache.has(category)) {
      const request = fetch(new URL(`question-bank/${category}.json`, baseUrl), {cache:'force-cache'})
        .then(response => {
          if (!response.ok) throw new Error(`Question bank HTTP ${response.status}`);
          return response.json();
        })
        .then(data => {
          if (!Array.isArray(data.questions)) throw new Error('Invalid question bank file');
          return data.questions;
        });
      bankCache.set(category, request);
    }
    return bankCache.get(category);
  }

  function currentRecord(content, category, questionText) {
    const known = content.__azaQuestionRecord;
    if (known && content.__azaQuestionRecordCategory === category) {
      if (norm(known?.ky?.q) === norm(questionText) || norm(known?.ru?.q) === norm(questionText)) return known;
    }
    return null;
  }

  async function findRecord(content, category, title) {
    const cached = currentRecord(content, category, title);
    if (cached) return cached;
    const signature = `${category}|${norm(title)}`;
    if (content.dataset.azaQuestionLookupSignature === signature) return null;
    const rows = await loadBank(category);
    if (!content.isConnected) return null;
    const wanted = norm(title);
    let record = rows.find(row => norm(row?.ky?.q) === wanted || norm(row?.ru?.q) === wanted);
    if (!record) {
      const close = rows.filter(row => {
        const ky = norm(row?.ky?.q), ru = norm(row?.ru?.q);
        return (ky && (ky.includes(wanted) || wanted.includes(ky))) || (ru && (ru.includes(wanted) || wanted.includes(ru)));
      });
      if (close.length === 1) record = close[0];
    }
    content.dataset.azaQuestionLookupSignature = signature;
    if (record) {
      content.__azaQuestionRecord = record;
      content.__azaQuestionRecordCategory = category;
    }
    return record || null;
  }

  function questionLanguage(record, title) {
    const key = norm(title);
    const ky = norm(record?.ky?.q) === key;
    const ru = norm(record?.ru?.q) === key;
    if (ky && !ru) return 'ky';
    if (ru && !ky) return 'ru';
    return lang();
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
    if (eyebrow) eyebrow.insertAdjacentElement('beforebegin', toolbar);
    else content.prepend(toolbar);
    return toolbar;
  }

  function setToolbarState(content, target, label = '') {
    const toolbar = $('.aza-quiz-language-toolbar', content);
    if (!toolbar) return;
    const labelEl = $('[data-aza-quiz-language-label]', toolbar);
    if (labelEl) {
      const next = label || (target === 'ru' ? 'ЯЗЫК ВОПРОСА' : 'СУРООНУН ТИЛИ');
      if (labelEl.textContent !== next) labelEl.textContent = next;
    }
    $$('[data-aza-quiz-language]', toolbar).forEach(button => {
      const active = button.dataset.azaQuizLanguage === target;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function updateEyebrow(content, category, record, target) {
    const eyebrow = $('.eyebrow', content);
    if (!eyebrow) return;
    const text = eyebrow.textContent || '';
    const progress = text.match(/\b\d+\s*\/\s*\d+\s*$/)?.[0]?.replace(/\s/g, '') || '';
    const catTitle = (cats[category] || ['', ''])[target === 'ru' ? 1 : 0].toUpperCase();
    const diff = difficultyText[record.difficulty]?.[target] || '';
    const next = `${catTitle} • ${diff}${progress ? ` • ${progress}` : ''}`;
    if (eyebrow.textContent !== next) eyebrow.textContent = next;
  }

  function updateFeedback(content, record, target) {
    const paragraphs = $$('#quizFeedback .result-box p', content);
    if (!paragraphs.length) return;
    const first = paragraphs[0];
    const old = first.textContent || '';
    const score = old.match(/\+\s*(\d+)/)?.[1];
    let next = old;
    if (/мурда туура|уже отвечали/i.test(old)) {
      next = target === 'ru' ? 'На этот вопрос уже отвечали правильно — повторные очки не начислены.' : 'Бул суроого мурда туура жооп берилген — упай кайра кошулган жок.';
    } else if (/туура эмес|неверно|ошибка/i.test(old)) {
      next = target === 'ru' ? 'В этот раз неверно.' : 'Бул жолу туура эмес.';
    } else if (/туура!|верно!/i.test(old)) {
      next = target === 'ru' ? `Верно! +${score || 0} очков` : `Туура! +${score || 0} упай`;
    }
    if (first.textContent !== next) first.textContent = next;
    if (paragraphs[1] && paragraphs[1].textContent !== (record[target]?.why || '')) paragraphs[1].textContent = record[target]?.why || '';
    const nextButton = $('#nextQuestion', content);
    if (nextButton) {
      const resultButton = nextButton.textContent.includes('РЕЗУЛЬТАТ') || nextButton.textContent.includes('ЖЫЙЫНТЫК');
      const nextText = target === 'ru' ? (resultButton ? 'РЕЗУЛЬТАТ' : 'СЛЕДУЮЩИЙ ВОПРОС →') : (resultButton ? 'ЖЫЙЫНТЫК' : 'КИЙИНКИ СУРОО →');
      if (nextButton.textContent !== nextText) nextButton.textContent = nextText;
    }
  }

  function applyQuestionLanguage(content, category, record, target) {
    const title = $('#modalTitle', content);
    const options = $('#quizOptions', content);
    if (!title || !options || !record?.[target]) return false;
    const sourceLang = questionLanguage(record, title.textContent);
    const source = record[sourceLang];
    const targetData = record[target];
    const buttons = $$('.quiz-option[data-answer]', options);
    if (!source?.a || !targetData?.a || buttons.length !== 4) return false;
    const indexes = buttons.map(button => source.a.findIndex(answer => norm(answer) === norm(button.textContent)));
    if (indexes.some(index => index < 0) || new Set(indexes).size !== 4) return false;

    // Mark the destination signature before mutating the DOM so the observer does not loop.
    content.dataset.azaQuestionProcessedSignature = `${category}|${norm(targetData.q)}`;
    if (title.textContent !== targetData.q) title.textContent = targetData.q;
    buttons.forEach((button, i) => {
      const translated = targetData.a[indexes[i]];
      if (button.textContent !== translated) button.textContent = translated;
    });
    updateEyebrow(content, category, record, target);
    const pointLine = options.previousElementSibling;
    if (pointLine?.tagName === 'P') {
      const points = pointLine.textContent.match(/\d+/)?.[0] || '10';
      const next = target === 'ru' ? `За правильный ответ — ${points} очков.` : `Туура жооп үчүн ${points} упай.`;
      if (pointLine.textContent !== next) pointLine.textContent = next;
    }
    updateFeedback(content, record, target);
    content.dataset.azaQuestionLang = target;
    localStorage.setItem('aza-question-language', target);
    setToolbarState(content, target);
    return true;
  }

  function readSafeAvatar(value) {
    if (!value) return '';
    try {
      const url = new URL(String(value), location.href);
      const localAvatar = url.origin === location.origin && /(?:^|\/)avatar-[a-z0-9-]+\.svg$/i.test(url.pathname);
      const storageAvatar = API && url.origin === new URL(API).origin && url.pathname.startsWith('/storage/v1/object/public/profile-avatars/') && /\.(?:webp|png|jpe?g|svg)$/i.test(url.pathname);
      return (localAvatar || storageAvatar) ? url.href : '';
    } catch (_) { return ''; }
  }

  async function loadOwnProfile() {
    const s = readSession();
    if (!s?.user?.id || !API || !KEY) return null;
    const cached = profileCache.get(s.user.id);
    if (cached && cached.expiresAt > Date.now()) return cached.profile;
    try {
      const url = new URL(`${API}/rest/v1/profiles`);
      url.searchParams.set('select','id,username,total_points,avatar_url,avatar_frame');
      url.searchParams.set('id',`eq.${s.user.id}`);
      url.searchParams.set('limit','1');
      const response = await fetch(url.toString(), {
        headers:{apikey:KEY,Authorization:`Bearer ${s.access_token}`,Accept:'application/json'},
        cache:'no-store'
      });
      if (!response.ok) throw new Error(`Profile lookup HTTP ${response.status}`);
      const rows = await response.json();
      const profile = Array.isArray(rows) && rows.length ? rows[0] : null;
      profileCache.set(s.user.id,{profile,expiresAt:Date.now()+60000});
      return profile;
    } catch (error) {
      console.warn('AZA quiz profile lookup failed',error);
      return null;
    }
  }

  function rankFor(points) {
    let rank = ranks[0];
    for (const item of ranks) if (Number(points || 0) >= item.min) rank = item;
    return rank;
  }

  function ensureProfileStrip(content) {
    let strip = $('.aza-quiz-profile-strip', content);
    if (strip) return strip;
    strip = document.createElement('div');
    strip.className = 'aza-quiz-profile-strip';
    strip.setAttribute('aria-label',tr('Оюнчу профили','Профиль игрока'));
    strip.innerHTML = `<span class="aza-quiz-profile-avatar">A</span><span class="aza-quiz-profile-details"><strong>${tr('Профиль жүктөлүүдө…','Загрузка профиля…')}</strong><small>${tr('Упай жана ранг','Очки и ранг')}</small></span><span class="aza-quiz-profile-rank">${tr('AZA','AZA')}</span>`;
    const toolbar = $('.aza-quiz-language-toolbar', content);
    if (toolbar) toolbar.insertAdjacentElement('afterend', strip);
    else content.prepend(strip);
    return strip;
  }

  async function decorateOwnProfile(content) {
    const strip = ensureProfileStrip(content);
    if (strip.dataset.loaded === '1' || strip.dataset.loading === '1') return;
    strip.dataset.loading = '1';
    const s = readSession();
    const profile = await loadOwnProfile();
    if (!strip.isConnected) return;
    delete strip.dataset.loading;
    strip.dataset.loaded = '1';
    const avatar = $('.aza-quiz-profile-avatar',strip);
    const details = $('.aza-quiz-profile-details',strip);
    const rankBadge = $('.aza-quiz-profile-rank',strip);
    if (!s) {
      if (avatar) avatar.textContent = 'A';
      if (details) details.innerHTML = `<strong>${tr('Конок оюнчу','Гость')}</strong><small>${tr('Рейтинг топтоо үчүн аккаунтка кир','Войди, чтобы сохранять рейтинг')}</small>`;
      if (rankBadge) rankBadge.textContent = tr('КИРҮҮ','ВХОД');
      strip.classList.add('is-guest');
      return;
    }
    const username = String(profile?.username || s.user?.user_metadata?.username || (s.user?.email || 'AZA Player').split('@')[0]);
    const points = Number(profile?.total_points || 0);
    const rank = rankFor(points);
    if (details) details.innerHTML = `<strong>${esc(username)}</strong><small>${points.toLocaleString(lang()==='ru'?'ru-RU':'ky-KG')} ${tr('упай','очков')} · ${tr('профиль рейтинги','рейтинг профиля')}</small>`;
    if (rankBadge) {
      rankBadge.textContent = `${rank.ky && lang()==='ky' ? rank.ky : rank.ru}`;
      rankBadge.dataset.rank = rank.id;
    }
    const image = readSafeAvatar(profile?.avatar_url);
    const frameId = ranks.some(item => item.id === profile?.avatar_frame) ? profile.avatar_frame : rank.id;
    if (avatar) {
      avatar.classList.add('has-frame',`aza-quiz-frame-${frameId}`);
      if (image) avatar.innerHTML = `<img src="${esc(image)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`;
      else avatar.textContent = username.slice(0,1).toUpperCase() || 'A';
    }
    strip.dataset.username = username;
  }

  async function enhanceRegularQuestion() {
    if (enhancing) return;
    const content = $('#modalContent');
    const options = $('#quizOptions',content || document);
    const title = $('#modalTitle',content || document);
    if (!content || !options || !title || $$('.quiz-option[data-answer]',options).length !== 4) return;
    const category = categoryFromEyebrow($('.eyebrow',content)?.textContent || '');
    if (!category) return;
    const questionText = title.textContent || '';
    const signature = `${category}|${norm(questionText)}`;
    if (content.dataset.azaQuestionProcessedSignature === signature) {
      ensureToolbar(content);
      void decorateOwnProfile(content);
      return;
    }
    enhancing = true;
    try {
      ensureToolbar(content);
      void decorateOwnProfile(content);
      const record = await findRecord(content,category,questionText);
      if (!record || !content.isConnected || !$('#quizOptions',content)) {
        content.dataset.azaQuestionProcessedSignature = signature;
        setToolbarState(content,lang(),lang()==='ru'?'ПЕРЕВОД НЕ НАЙДЕН':'КОТОРМО ТАБЫЛГАН ЖОК');
        return;
      }
      const sourceLang = questionLanguage(record,title.textContent);
      const saved = localStorage.getItem('aza-question-language');
      const target = saved === 'ky' || saved === 'ru' ? saved : sourceLang;
      if (target !== sourceLang) {
        const applied = applyQuestionLanguage(content,category,record,target);
        if (!applied) {
          content.dataset.azaQuestionProcessedSignature = signature;
          setToolbarState(content,sourceLang,sourceLang==='ru'?'ПЕРЕВОД НЕДОСТУПЕН':'КОТОРМО БУЛ СУРООДО ЖОК');
        }
      } else {
        content.dataset.azaQuestionProcessedSignature = signature;
        content.dataset.azaQuestionLang = sourceLang;
        setToolbarState(content,sourceLang);
      }
    } catch (error) {
      console.warn('AZA question language enhancement failed',error);
      const signatureNow = `${category}|${norm(title.textContent || '')}`;
      content.dataset.azaQuestionProcessedSignature = signatureNow;
      setToolbarState(content,lang(),lang()==='ru'?'КОТОРМО КАТАСЫ':'КОТОРМО КАТАСЫ');
    } finally {
      enhancing = false;
    }
  }

  function scheduleEnhance() {
    clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => { void enhanceRegularQuestion(); }, 90);
  }

  function init() {
    ensureCss();
    const content = $('#modalContent');
    if (!content || content.dataset.azaQuestionLanguageObserver === '1') return;
    content.dataset.azaQuestionLanguageObserver = '1';
    const observer = new MutationObserver(() => scheduleEnhance());
    observer.observe(content,{childList:true,subtree:true});
    void enhanceRegularQuestion();
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-aza-quiz-language]');
    if (!button) return;
    const content = button.closest('#modalContent');
    if (!content) return;
    event.preventDefault();
    // Stop only the KG/RU control click; ordinary answer buttons still reach app.js.
    event.stopPropagation();
    const target = button.dataset.azaQuizLanguage;
    if (!['ky','ru'].includes(target)) return;
    const category = categoryFromEyebrow($('.eyebrow',content)?.textContent || '');
    const title = $('#modalTitle',content);
    if (!category || !title) return;
    const known = currentRecord(content,category,title.textContent);
    void (known ? Promise.resolve(known) : findRecord(content,category,title.textContent)).then(record => {
      if (!record) {
        content.dataset.azaQuestionProcessedSignature = `${category}|${norm(title.textContent || '')}`;
        setToolbarState(content,lang(),target==='ru'?'ПЕРЕВОД НЕ НАЙДЕН':'КОТОРМО ТАБЫЛГАН ЖОК');
        return;
      }
      const success = applyQuestionLanguage(content,category,record,target);
      if (!success) setToolbarState(content,lang(),target==='ru'?'TRANSLATION UNAVAILABLE':'КОТОРМО БУЛ СУРООДО ЖОК');
    }).catch(error => {
      console.warn('AZA question language switch failed',error);
      setToolbarState(content,lang(),target==='ru'?'TRANSLATION ERROR':'КОТОРМОДО КАТА');
    });
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
