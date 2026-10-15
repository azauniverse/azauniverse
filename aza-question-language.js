/* AZA UNIVERSE — per-question KG/RU switch for regular quiz modal.
   Works alongside online-battle.js and aza-platform-fixes.js. */
(() => {
  'use strict';
  if (window.__AZA_QUESTION_LANGUAGE_V1__) return;
  window.__AZA_QUESTION_LANGUAGE_V1__ = true;

  const scriptUrl = document.currentScript?.src || new URL('aza-question-language.js', location.href).href;
  const baseUrl = new URL('.', scriptUrl);
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const lang = () => (localStorage.getItem('aza-lang') || document.documentElement.lang || 'ky').toLowerCase() === 'ru' ? 'ru' : 'ky';
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm = v => String(v ?? '').normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
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
  const bankCache = new Map();
  let observerTimer = 0;

  function ensureCss() {
    if ($('link[data-aza-question-language]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('aza-question-language.css', baseUrl).href;
    link.dataset.azaQuestionLanguage = '1';
    document.head.appendChild(link);
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
        .then(res => { if (!res.ok) throw new Error(`Question bank HTTP ${res.status}`); return res.json(); })
        .then(data => {
          if (!Array.isArray(data.questions)) throw new Error('Invalid question bank file');
          return data.questions;
        });
      bankCache.set(category, request);
    }
    return bankCache.get(category);
  }

  function languageOfQuestion(record, visibleQuestion) {
    const key = norm(visibleQuestion);
    const kyMatch = norm(record?.ky?.q) === key;
    const ruMatch = norm(record?.ru?.q) === key;
    if (kyMatch && !ruMatch) return 'ky';
    if (ruMatch && !kyMatch) return 'ru';
    return document.querySelector('#modalContent')?.dataset.azaQuestionLang || lang();
  }

  async function findRecord(content, category, title) {
    const signature = `${category}|${norm(title)}`;
    if (content.dataset.azaQuestionSignature === signature && content.__azaQuestionRecord) return content.__azaQuestionRecord;
    const rows = await loadBank(category);
    const wanted = norm(title);
    let record = rows.find(row => norm(row?.ky?.q) === wanted || norm(row?.ru?.q) === wanted);
    // A typographic quote/punctuation difference can still be resolved by normalized text.
    if (!record) {
      const close = rows.filter(row => {
        const ky = norm(row?.ky?.q), ru = norm(row?.ru?.q);
        return ky && (ky.includes(wanted) || wanted.includes(ky)) || ru && (ru.includes(wanted) || wanted.includes(ru));
      });
      if (close.length === 1) record = close[0];
    }
    if (record) {
      content.dataset.azaQuestionSignature = signature;
      content.__azaQuestionRecord = record;
    }
    return record || null;
  }

  function setHeaderLanguage(content, category, record, target) {
    const eyebrow = $('.eyebrow', content);
    if (!eyebrow) return;
    const text = eyebrow.textContent || '';
    const progress = text.match(/\b\d+\s*\/\s*\d+\s*$/)?.[0]?.replace(/\s/g, '') || '';
    const title = (cats[category] || ['', ''])[target === 'ru' ? 1 : 0].toUpperCase();
    const diff = difficultyText[record.difficulty]?.[target] || '';
    eyebrow.textContent = `${title} • ${diff}${progress ? ` • ${progress}` : ''}`;
  }

  function updateFeedback(content, record, target) {
    const paragraphs = $$('#quizFeedback .result-box p', content);
    if (!paragraphs.length) return;
    const first = paragraphs[0];
    const old = first.textContent || '';
    const score = old.match(/\+\s*(\d+)/)?.[1];
    if (/мурда туура|уже отвечали/i.test(old)) {
      first.textContent = target === 'ru'
        ? 'На этот вопрос уже отвечали правильно — повторные очки не начислены.'
        : 'Бул суроого мурда туура жооп берилген — упай кайра кошулган жок.';
    } else if (/туура эмес|неверно|ошибка/i.test(old)) {
      first.textContent = target === 'ru' ? 'В этот раз неверно.' : 'Бул жолу туура эмес.';
    } else if (/туура!|верно!/i.test(old)) {
      first.textContent = target === 'ru' ? `Верно! +${score || 0} очков` : `Туура! +${score || 0} упай`;
    }
    if (paragraphs[1]) paragraphs[1].textContent = record[target]?.why || '';
    const next = $('#nextQuestion', content);
    if (next) next.textContent = target === 'ru'
      ? (next.textContent.includes('РЕЗУЛЬТАТ') ? 'РЕЗУЛЬТАТ' : 'СЛЕДУЮЩИЙ ВОПРОС →')
      : (next.textContent.includes('ЖЫЙЫНТЫК') ? 'ЖЫЙЫНТЫК' : 'КИЙИНКИ СУРОО →');
  }

  function applyLanguageToQuestion(content, category, record, target) {
    const title = $('#modalTitle', content);
    const options = $('#quizOptions', content);
    if (!title || !options || !record?.[target]) return false;
    const currentLang = languageOfQuestion(record, title.textContent);
    const source = record[currentLang];
    const targetData = record[target];
    const buttons = $$('.quiz-option[data-answer]', options);
    if (!source?.a || !targetData?.a || buttons.length !== 4) return false;

    const indexes = buttons.map(button => source.a.findIndex(answer => norm(answer) === norm(button.textContent)));
    if (indexes.some(index => index < 0) || new Set(indexes).size !== 4) return false;

    title.textContent = targetData.q;
    buttons.forEach((button, i) => { button.textContent = targetData.a[indexes[i]]; });
    setHeaderLanguage(content, category, record, target);
    const pointLine = options.previousElementSibling;
    if (pointLine?.tagName === 'P') {
      const points = pointLine.textContent.match(/\d+/)?.[0] || '10';
      pointLine.textContent = target === 'ru' ? `За правильный ответ — ${points} очков.` : `Туура жооп үчүн ${points} упай.`;
    }
    updateFeedback(content, record, target);
    content.dataset.azaQuestionLang = target;
    localStorage.setItem('aza-question-language', target);
    $$('[data-aza-quiz-language]', content).forEach(button => {
      const active = button.dataset.azaQuizLanguage === target;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    return true;
  }

  function createToolbar(content) {
    let toolbar = $('.aza-quiz-language-toolbar', content);
    if (toolbar) return toolbar;
    toolbar = document.createElement('div');
    toolbar.className = 'aza-quiz-language-toolbar';
    toolbar.setAttribute('role', 'group');
    toolbar.setAttribute('aria-label', 'Question language');
    toolbar.innerHTML = `
      <span>${lang() === 'ru' ? 'ЯЗЫК ВОПРОСА' : 'СУРООНУН ТИЛИ'}</span>
      <button type="button" data-aza-quiz-language="ky" aria-label="Кыргызча" aria-pressed="false">KG</button>
      <button type="button" data-aza-quiz-language="ru" aria-label="Русский" aria-pressed="false">RU</button>`;
    const eyebrow = $('.eyebrow', content);
    if (eyebrow) eyebrow.insertAdjacentElement('beforebegin', toolbar);
    else content.prepend(toolbar);
    return toolbar;
  }

  async function enhanceRegularQuestion() {
    const content = $('#modalContent');
    const options = $('#quizOptions', content || document);
    const title = $('#modalTitle', content || document);
    if (!content || !options || !title || $$('.quiz-option[data-answer]', options).length !== 4) return;
    const eyebrow = $('.eyebrow', content);
    const category = categoryFromEyebrow(eyebrow?.textContent || '');
    if (!category) return;
    createToolbar(content);
    const questionText = title.textContent || '';
    const record = await findRecord(content, category, questionText);
    if (!record || !content.isConnected || !$('#quizOptions', content)) {
      const label = $('.aza-quiz-language-toolbar > span', content);
      if (label) label.textContent = lang() === 'ru' ? 'ПЕРЕВОД НЕДОСТУПЕН' : 'КОТОРМО ТАБЫЛГАН ЖОК';
      return;
    }
    content.__azaQuestionRecord = record;
    const sourceLang = languageOfQuestion(record, title.textContent);
    const stored = localStorage.getItem('aza-question-language');
    const target = stored === 'ky' || stored === 'ru' ? stored : sourceLang;
    const label = $('.aza-quiz-language-toolbar > span', content);
    if (label) label.textContent = target === 'ru' ? 'ЯЗЫК ВОПРОСА' : 'СУРООНУН ТИЛИ';
    if (target !== sourceLang) applyLanguageToQuestion(content, category, record, target);
    else {
      content.dataset.azaQuestionLang = sourceLang;
      $$('[data-aza-quiz-language]', content).forEach(button => {
        const active = button.dataset.azaQuizLanguage === sourceLang;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
      });
    }
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-aza-quiz-language]');
    if (!button) return;
    const content = button.closest('#modalContent');
    if (!content) return;
    event.preventDefault();
    event.stopPropagation();
    const target = button.dataset.azaQuizLanguage;
    const category = categoryFromEyebrow($('.eyebrow', content)?.textContent || '');
    if (!category) return;
    const title = $('#modalTitle', content);
    const current = content.__azaQuestionRecord;
    const work = current ? Promise.resolve(current) : findRecord(content, category, title?.textContent || '');
    void work.then(record => {
      if (!record) {
        const label = $('.aza-quiz-language-toolbar > span', content);
        if (label) label.textContent = target === 'ru' ? 'ПЕРЕВОД НЕДОСТУПЕН' : 'КОТОРМО ТАБЫЛГАН ЖОК';
        return;
      }
      if (!applyLanguageToQuestion(content, category, record, target)) {
        const label = $('.aza-quiz-language-toolbar > span', content);
        if (label) label.textContent = target === 'ru' ? 'TRANSLATION UNAVAILABLE' : 'КОТОРМО БУЛ СУРООДО ЖОК';
      }
    }).catch(error => {
      console.warn('AZA question language switch failed', error);
      const label = $('.aza-quiz-language-toolbar > span', content);
      if (label) label.textContent = target === 'ru' ? 'TRANSLATION ERROR' : 'КОТОРМОДО КАТА';
    });
  }, true);

  function init() {
    ensureCss();
    const root = $('#modalContent');
    if (root) {
      const observer = new MutationObserver(() => {
        clearTimeout(observerTimer);
        observerTimer = window.setTimeout(() => { void enhanceRegularQuestion(); }, 45);
      });
      observer.observe(root, {childList:true, subtree:true});
    }
    // Modal content exists in index.html before DOMContentLoaded.
    void enhanceRegularQuestion();
    const bodyObserver = new MutationObserver(() => {
      const current = $('#modalContent');
      if (current && !current.dataset.azaQuestionLangObserver) {
        current.dataset.azaQuestionLangObserver = '1';
        const observer = new MutationObserver(() => {
          clearTimeout(observerTimer);
          observerTimer = window.setTimeout(() => { void enhanceRegularQuestion(); }, 45);
        });
        observer.observe(current, {childList:true, subtree:true});
      }
      void enhanceRegularQuestion();
    });
    bodyObserver.observe(document.body, {childList:true, subtree:true});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
