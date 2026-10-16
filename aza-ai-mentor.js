/* AZA UNIVERSE — AZA AI Mentor frontend v1.1 — voice mode
 * Add to the Pages root and include with:
 * <script src="aza-ai-mentor.js?v=2"></script>
 * Requires the separate Cloudflare Worker in ai-worker/ to be deployed.
 */
(() => {
  'use strict';
  if (window.__AZA_AI_MENTOR_V2__) return;
  window.__AZA_AI_MENTOR_V2__ = true;

  const API_URL = String(window.AZA_AI_ENDPOINT || 'https://aza-universe-ai.azataycan2002.workers.dev/api/chat');
  const $ = (selector, root = document) => root.querySelector(selector);
  const language = () => {
    try { return (localStorage.getItem('aza-lang') || document.documentElement.lang || 'ky') === 'ru' ? 'ru' : 'ky'; }
    catch { return document.documentElement.lang === 'ru' ? 'ru' : 'ky'; }
  };
  const tx = (ky, ru) => language() === 'ru' ? ru : ky;
  const history = [];
  let busy = false;
  let voiceEnabled = false;
  let activeUtterance = null;
  let recognition = null;
  let recognitionActive = false;

  function cleanSpeechText(value) {
    return String(value || '')
      .replace(/https?:\/\/\S+/gi, '')
      .replace(/[`*_#>]/g, '')
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function preferredVoice() {
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices() || [];
    const want = language() === 'ru' ? ['ru-RU', 'ru'] : ['ky-KG', 'ky'];
    for (const prefix of want) {
      const match = voices.find(v => String(v.lang || '').toLowerCase() === prefix.toLowerCase())
        || voices.find(v => String(v.lang || '').toLowerCase().startsWith(prefix.toLowerCase() + '-'));
      if (match) return match;
    }
    // For Kyrgyz, do not force a Russian voice: let the device's speech engine
    // choose a fallback for ky-KG if it has one installed.
    if (language() === 'ru') return voices.find(v => String(v.lang || '').toLowerCase().startsWith('ru')) || null;
    return null;
  }

  function stopSpeaking() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    activeUtterance = null;
  }

  function speakText(value, force = false) {
    if (!('speechSynthesis' in window)) {
      appendMessage('assistant', tx('Бул браузер үн чыгарып окууну колдобойт.', 'Этот браузер не поддерживает озвучивание.'), 'notice');
      return;
    }
    const text = cleanSpeechText(value);
    if (!text) return;
    if (!force && !voiceEnabled) return;
    stopSpeaking();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language() === 'ru' ? 'ru-RU' : 'ky-KG';
    utterance.rate = 0.94;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    const voice = preferredVoice();
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang || utterance.lang;
    }
    utterance.onerror = event => {
      activeUtterance = null;
      if (event.error !== 'canceled' && event.error !== 'interrupted') {
        appendMessage('assistant', tx('Үн чыкпай калды. Телефондун текстти үн менен окуу жөндөөлөрүн текшер.', 'Не удалось воспроизвести голос. Проверь настройки синтеза речи на телефоне.'), 'notice');
      }
    };
    utterance.onend = () => { if (activeUtterance === utterance) activeUtterance = null; };
    activeUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  }

  function updateVoiceToggle() {
    const button = $('#azaAiVoiceToggle');
    if (!button) return;
    button.textContent = voiceEnabled ? tx('🔊 ҮН КҮЙҮК', '🔊 ГОЛОС ВКЛ') : tx('🔇 ҮН ӨЧҮК', '🔇 ГОЛОС ВЫКЛ');
    button.setAttribute('aria-pressed', voiceEnabled ? 'true' : 'false');
    button.classList.toggle('is-enabled', voiceEnabled);
  }

  function startDictation() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      appendMessage('assistant', tx('Бул браузер үн менен терүүнү колдобойт. Chrome браузеринде микрофонду текшерип көр, досум.', 'Этот браузер не поддерживает диктовку. Попробуй Chrome и проверь доступ к микрофону.'), 'notice');
      return;
    }
    if (recognitionActive && recognition) {
      recognition.stop();
      return;
    }
    const input = $('#azaAiInput');
    if (!input) return;
    const original = input.value.trim();
    try {
      recognition = new Recognition();
      recognition.lang = language() === 'ru' ? 'ru-RU' : 'ky-KG';
      recognition.interimResults = true;
      recognition.continuous = false;
      recognition.maxAlternatives = 1;
      const mic = $('#azaAiMic');
      const originalPlaceholder = input.placeholder;
      recognition.onstart = () => {
        recognitionActive = true;
        if (mic) { mic.classList.add('is-listening'); mic.textContent = '■'; mic.setAttribute('aria-label', tx('Угууну токтотуу', 'Остановить запись')); }
        input.placeholder = tx('Сүйлө, досум…', 'Говори, дружище…');
      };
      recognition.onresult = event => {
        const parts = [];
        for (let i = 0; i < event.results.length; i++) {
          const phrase = event.results[i]?.[0]?.transcript;
          if (phrase) parts.push(phrase.trim());
        }
        input.value = [original, parts.join(' ')].filter(Boolean).join(' ');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      };
      recognition.onerror = event => {
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          appendMessage('assistant', tx('Микрофонго уруксат берилген жок. Браузердин сайт жөндөөлөрүнөн микрофонго уруксат бер.', 'Нет доступа к микрофону. Разреши микрофон в настройках сайта браузера.'), 'notice');
        } else if (event.error === 'language-not-supported') {
          appendMessage('assistant', tx('Бул түзмөктө кыргызча үн менен терүү колдоого алынбашы мүмкүн. Сайттын тилин орусчага которуп, кайра аракет кыл.', 'Это устройство может не поддерживать диктовку на кыргызском. Переключи язык сайта на русский и попробуй снова.'), 'notice');
        } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
          appendMessage('assistant', tx('Үн менен терүү токтоп калды. Кайра аракет кыл.', 'Диктовка остановилась. Попробуй ещё раз.'), 'notice');
        }
      };
      recognition.onend = () => {
        recognitionActive = false;
        if (mic) { mic.classList.remove('is-listening'); mic.textContent = '🎙'; mic.setAttribute('aria-label', tx('Үн менен суроо берүү', 'Задать вопрос голосом')); }
        input.placeholder = originalPlaceholder;
        input.focus();
      };
      recognition.start();
    } catch (_) {
      recognitionActive = false;
      appendMessage('assistant', tx('Микрофонду иштетүү мүмкүн болгон жок. Браузердин уруксаттарын текшер.', 'Не удалось запустить микрофон. Проверь разрешения браузера.'), 'notice');
    }
  }

  function ensureStyles() {
    if ($('#azaAiMentorStyles')) return;
    const style = document.createElement('style');
    style.id = 'azaAiMentorStyles';
    style.textContent = `
      #azaAiLaunch{position:fixed;right:16px;bottom:calc(88px + env(safe-area-inset-bottom));z-index:90;display:flex;align-items:center;gap:9px;padding:11px 15px;border:1px solid #4a9bc0;border-radius:999px;background:linear-gradient(135deg,#10304a,#152046);color:#f4fbff;font:800 13px/1.2 system-ui,-apple-system,sans-serif;box-shadow:0 6px 22px #0005;cursor:pointer;touch-action:manipulation}
      #azaAiLaunch .aza-ai-mark{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#ffb347,#ff6c2e);color:#081522;font-size:15px}
      #azaAiPanel{position:fixed;z-index:250;right:14px;bottom:calc(144px + env(safe-area-inset-bottom));width:min(390px,calc(100vw - 28px));height:min(590px,calc(100dvh - 180px));min-height:350px;display:none;flex-direction:column;overflow:hidden;border:1px solid #2b6685;border-radius:20px;background:#071321;color:#edf7ff;box-shadow:0 20px 70px #0009;font-family:system-ui,-apple-system,sans-serif}
      #azaAiPanel.is-open{display:flex}
      #azaAiHeader{display:flex;align-items:center;gap:8px;padding:13px 12px;border-bottom:1px solid #1d4059;background:linear-gradient(120deg,#0e2941,#151b37)}
      #azaAiAvatar{display:grid;place-items:center;flex:0 0 38px;height:38px;border-radius:14px;background:linear-gradient(135deg,#ffc24c,#ff7130);color:#091321;font-size:19px;font-weight:900}
      #azaAiHeaderText{flex:1;min-width:0}#azaAiHeaderText strong{display:block;font-size:14px}#azaAiHeaderText small{display:block;margin-top:3px;color:#96b3cb;font-size:11px}
      #azaAiClose{flex:0 0 34px;width:34px;height:34px;border:1px solid #294a62;border-radius:10px;background:#0a1b2b;color:#eaf6ff;font-size:22px;cursor:pointer}
      #azaAiVoiceToggle{flex:0 0 auto;min-height:34px;padding:0 8px;border:1px solid #345b78;border-radius:10px;background:#0a1b2b;color:#c5deef;font:800 10px/1 system-ui,-apple-system,sans-serif;white-space:nowrap;cursor:pointer}
      #azaAiVoiceToggle.is-enabled{border-color:#3fbf9a;background:#0c302b;color:#adffe0}
      .aza-ai-msg-text{white-space:pre-wrap;overflow-wrap:anywhere}
      .aza-ai-speak{display:inline-flex;align-items:center;gap:5px;margin-top:7px;padding:5px 8px;border:1px solid #2e5874;border-radius:8px;background:#081827;color:#b9eaff;font:700 10px/1.2 system-ui,-apple-system,sans-serif;cursor:pointer;touch-action:manipulation}
      #azaAiMic{flex:0 0 42px;height:44px;border:1px solid #35637e;border-radius:13px;background:#0b2132;color:#b8ecff;font-size:18px;font-weight:800;cursor:pointer;touch-action:manipulation}
      #azaAiMic.is-listening{border-color:#ff7777;background:#401c25;color:#fff}
      #azaAiInput,#azaAiMic,#azaAiSend{touch-action:manipulation}
      #azaAiMessages{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:10px;padding:14px;overscroll-behavior:contain}
      .aza-ai-msg{max-width:91%;padding:10px 12px;border:1px solid #284963;border-radius:14px;background:#0d2032;color:#e9f4ff;font-size:13px;line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere}
      .aza-ai-msg.user{align-self:flex-end;border-color:#4c5ca0;background:#182746}.aza-ai-msg.assistant{align-self:flex-start}.aza-ai-msg.notice{align-self:center;max-width:100%;border:0;background:transparent;color:#93acc2;font-size:11px;text-align:center}
      #azaAiForm{display:flex;align-items:flex-end;gap:8px;padding:11px;border-top:1px solid #1d4059;background:#081725}
      #azaAiInput{flex:1;min-width:0;max-height:110px;resize:none;border:1px solid #2b506b;border-radius:13px;padding:11px;background:#050f1b;color:#f2f8ff;font:13px/1.4 system-ui,-apple-system,sans-serif;outline:none}
      #azaAiInput:focus{border-color:#6acdf2}#azaAiSend{flex:0 0 44px;height:44px;border:0;border-radius:13px;background:linear-gradient(135deg,#ffb446,#ff6928);color:#101927;font-size:19px;font-weight:900;cursor:pointer}#azaAiSend:disabled{opacity:.5;cursor:wait}
      @media(max-width:480px){#azaAiLaunch{right:10px;bottom:calc(80px + env(safe-area-inset-bottom));padding:9px 12px;font-size:12px}#azaAiPanel{right:8px;bottom:calc(135px + env(safe-area-inset-bottom));width:calc(100vw - 16px);height:min(70dvh,590px);min-height:330px;border-radius:17px}#azaAiMessages{padding:11px}#azaAiHeader{gap:6px;padding:10px 9px}#azaAiAvatar{flex-basis:34px;height:34px}#azaAiHeaderText strong{font-size:13px}#azaAiHeaderText small{font-size:10px}#azaAiVoiceToggle{padding:0 6px;font-size:9px}#azaAiClose{flex-basis:31px;width:31px;height:34px}#azaAiMic{flex-basis:40px}}
      @media(prefers-reduced-motion:reduce){#azaAiLaunch{scroll-behavior:auto}}
    `;
    document.head.appendChild(style);
  }

  function appendMessage(role, text, className = '') {
    const item = document.createElement('div');
    item.className = `aza-ai-msg ${role} ${className}`.trim();
    const body = document.createElement('div');
    body.className = 'aza-ai-msg-text';
    body.textContent = text;
    item.appendChild(body);
    if (role === 'assistant' && className !== 'notice') {
      const audio = document.createElement('button');
      audio.type = 'button';
      audio.className = 'aza-ai-speak';
      audio.textContent = tx('🔊 Угуу', '🔊 Слушать');
      audio.setAttribute('aria-label', tx('Жоопту үн менен угуу', 'Прослушать ответ'));
      audio.addEventListener('click', () => speakText(text, true));
      item.appendChild(audio);
      if (voiceEnabled) queueMicrotask(() => speakText(text));
    }
    $('#azaAiMessages')?.appendChild(item);
    const box = $('#azaAiMessages');
    if (box) box.scrollTop = box.scrollHeight;
    return item;
  }

  function render() {
    if ($('#azaAiLaunch')) return;
    ensureStyles();
    const launch = document.createElement('button');
    launch.type = 'button';
    launch.id = 'azaAiLaunch';
    launch.innerHTML = '<span class="aza-ai-mark" aria-hidden="true">✦</span><span>AZA AI</span>';
    launch.setAttribute('aria-label', tx('AZA AI досуң менен сүйлөшүү', 'Открыть чат с AZA AI'));

    const panel = document.createElement('section');
    panel.id = 'azaAiPanel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'false');
    panel.setAttribute('aria-label', 'AZA AI Mentor');
    panel.innerHTML = `
      <header id="azaAiHeader"><div id="azaAiAvatar">A</div><div id="azaAiHeaderText"><strong>AZA AI</strong><small>${tx('Досуң • тамаша • жардам', 'Твой AI-друг • юмор • помощь')}</small></div><button id="azaAiVoiceToggle" type="button" aria-pressed="false">🔇 ҮН ӨЧҮК</button><button id="azaAiClose" type="button" aria-label="${tx('Жабуу', 'Закрыть')}">×</button></header>
      <div id="azaAiMessages" aria-live="polite"></div>
      <form id="azaAiForm"><textarea id="azaAiInput" rows="1" maxlength="1200" placeholder="${tx('Досум, эмне сурайсың?', 'Дружище, что спросим?')}" aria-label="${tx('Билдирүү', 'Сообщение')}"></textarea><button id="azaAiMic" type="button" aria-label="${tx('Үн менен суроо берүү', 'Задать вопрос голосом')}" title="${tx('Үн менен суроо берүү', 'Задать вопрос голосом')}">🎙</button><button id="azaAiSend" type="submit" aria-label="${tx('Жөнөтүү', 'Отправить')}">➤</button></form>`;
    document.body.append(launch, panel);
    voiceEnabled = (() => { try { return localStorage.getItem('aza-ai-voice-enabled') === '1'; } catch { return false; } })();
    launch.addEventListener('click', () => {
      panel.classList.add('is-open');
      launch.setAttribute('aria-expanded', 'true');
      $('#azaAiInput')?.focus();
      if (!$('#azaAiMessages').children.length) {
        appendMessage('assistant', tx('Эй, досум! 😎🤝 Мен AZA AI. Сурооңду бер, чогуу чечебиз!', 'Эй, дружище! 😎🤝 Я AZA AI. Задавай вопрос — разберёмся вместе!'));
      }
    });
    $('#azaAiClose').addEventListener('click', () => {
      panel.classList.remove('is-open');
      launch.setAttribute('aria-expanded', 'false');
      stopSpeaking();
      if (recognitionActive && recognition) recognition.stop();
    });
    $('#azaAiVoiceToggle').addEventListener('click', () => {
      voiceEnabled = !voiceEnabled;
      try { localStorage.setItem('aza-ai-voice-enabled', voiceEnabled ? '1' : '0'); } catch {}
      updateVoiceToggle();
      if (voiceEnabled) speakText(tx('Үн режими күйдү, досум. Эми жоопторду үн менен окуйм.', 'Голосовой режим включён. Теперь буду озвучивать ответы.'), true);
      else stopSpeaking();
    });
    $('#azaAiMic').addEventListener('click', startDictation);
    $('#azaAiForm').addEventListener('submit', submitMessage);
    updateVoiceToggle();
    $('#azaAiInput').addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        $('#azaAiForm')?.requestSubmit();
      }
    });
  }

  async function submitMessage(event) {
    event.preventDefault();
    if (busy) return;
    const input = $('#azaAiInput');
    const send = $('#azaAiSend');
    const text = String(input?.value || '').trim();
    if (!text) return;
    if (text.length > 1200) {
      appendMessage('assistant', tx('Билдирүүңдү кыскараак кылып жибер, досум.', 'Сократи сообщение, дружище.'));
      return;
    }

    appendMessage('user', text);
    history.push({ role: 'user', content: text });
    while (history.length > 10) history.shift();
    input.value = '';
    busy = true;
    if (send) send.disabled = true;
    const typing = appendMessage('assistant', tx('AZA AI ойлонуп жатат…', 'AZA AI думает…'), 'notice');

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 429) throw new Error(tx('Билдирүүлөр тез-тез кетти. Бир мүнөттөн кийин кайра көр, досум.', 'Слишком много сообщений. Попробуй снова через минуту.'));
        if (response.status === 503) throw new Error(payload.message || tx('AI азыр убактылуу жеткиликсиз. Кийин кайра аракет кыл, досум.', 'AI временно недоступен. Попробуй позже.'));
        throw new Error(payload.message || tx('AI серверине туташуу азырынча даяр эмес. Орнотуу бүтө элек болушу мүмкүн.', 'Подключение к AI-серверу ещё не готово. Возможно, настройка не завершена.'));
      }
      if (!payload.answer) throw new Error(tx('Жооп бош келди. Кайра сурап көр.', 'Пришёл пустой ответ. Попробуй ещё раз.'));
      history.push({ role: 'assistant', content: payload.answer });
      while (history.length > 10) history.shift();
      typing.remove();
      appendMessage('assistant', payload.answer);
    } catch (error) {
      typing.remove();
      appendMessage('assistant', `${tx('Азыр туташуу болбой калды, досум 😅 ', 'Сейчас не удалось подключиться 😅 ')}${String(error?.message || '').slice(0, 240)}`);
      history.pop();
    } finally {
      busy = false;
      if (send) send.disabled = false;
      input?.focus();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render, { once: true });
  else render();
})();
