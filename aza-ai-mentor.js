/* AZA UNIVERSE — AZA AI Mentor frontend v1.2 — animated tutor + voice
 * Add to the Pages root and include with:
 * <script src="aza-ai-mentor.js?v=3"></script>
 * Requires the separate Cloudflare Worker in ai-worker/ to be deployed.
 */
(() => {
  'use strict';
  if (window.__AZA_AI_MENTOR_V3__) return;
  window.__AZA_AI_MENTOR_V3__ = true;

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
  let teacherState = 'idle';

  function setTeacherState(nextState) {
    const stage = $('#azaAiTeacher');
    const status = $('#azaAiTeacherStatus');
    const allowed = ['idle', 'speaking', 'listening', 'thinking'];
    teacherState = allowed.includes(nextState) ? nextState : 'idle';
    if (stage) {
      stage.dataset.state = teacherState;
      stage.classList.remove(...allowed.map(state => `is-${state}`));
      stage.classList.add(`is-${teacherState}`);
    }
    if (status) {
      const labels = {
        idle: tx('Даярмын, досум! 👋', 'На связи, дружище! 👋'),
        speaking: tx('Сүйлөп жатам…', 'Говорю…'),
        listening: tx('Угуп жатам…', 'Слушаю…'),
        thinking: tx('Ойлонуп жатам…', 'Думаю…')
      };
      status.textContent = labels[teacherState];
    }
  }

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
    setTeacherState(recognitionActive ? 'listening' : (busy ? 'thinking' : 'idle'));
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
    utterance.onstart = () => {
      if (activeUtterance === utterance) setTeacherState('speaking');
    };
    utterance.onerror = event => {
      activeUtterance = null;
      setTeacherState(recognitionActive ? 'listening' : (busy ? 'thinking' : 'idle'));
      if (event.error !== 'canceled' && event.error !== 'interrupted') {
        appendMessage('assistant', tx('Үн чыкпай калды. Телефондун текстти үн менен окуу жөндөөлөрүн текшер.', 'Не удалось воспроизвести голос. Проверь настройки синтеза речи на телефоне.'), 'notice');
      }
    };
    utterance.onend = () => {
      if (activeUtterance === utterance) activeUtterance = null;
      setTeacherState(recognitionActive ? 'listening' : (busy ? 'thinking' : 'idle'));
    };
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
        setTeacherState('listening');
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
        setTeacherState(busy ? 'thinking' : 'idle');
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

  function ensureTutorStyles() {
    if ($('#azaAiTutorStyles')) return;
    const style = document.createElement('style');
    style.id = 'azaAiTutorStyles';
    style.textContent = `
      #azaAiTeacher{position:relative;flex:0 0 auto;height:164px;overflow:hidden;display:flex;align-items:stretch;justify-content:center;border-bottom:1px solid #1c3c55;background:radial-gradient(ellipse at 50% 100%,#0e3d59 0%,#0a2034 44%,#081625 78%);isolation:isolate}
      #azaAiTeacher:before{content:"";position:absolute;width:210px;height:160px;left:50%;top:5px;transform:translateX(-50%);border:1px solid #4acbff28;border-radius:50%;box-shadow:0 0 0 14px #49bbff08,0 0 0 30px #49bbff05;pointer-events:none}
      #azaAiTeacher:after{content:"✦";position:absolute;right:calc(50% - 111px);top:26px;color:#ffcf72;text-shadow:0 0 15px #ffb74788;font-size:15px;animation:azaTutorSpark 3.2s ease-in-out infinite;pointer-events:none}
      #azaAiTeacher .aza-ai-tutor-figure{position:absolute;width:min(290px,94%);height:172px;left:50%;top:-1px;transform:translateX(-50%);overflow:visible}
      #azaAiTeacher .teacher-head{transform-box:fill-box;transform-origin:50% 92%;animation:azaTutorHeadIdle 6.2s ease-in-out infinite}
      #azaAiTeacher .teacher-arm-left{transform-box:fill-box;transform-origin:86% 30%;animation:azaTutorArmIdle 5.4s ease-in-out infinite}
      #azaAiTeacher .teacher-arm-right{transform-box:fill-box;transform-origin:15% 30%;animation:azaTutorArmIdleRight 6s ease-in-out infinite}
      #azaAiTeacher .teacher-blink{opacity:0;animation:azaTutorBlink 5.6s linear infinite}
      #azaAiTeacher .teacher-mouth-open{opacity:0;transform-box:fill-box;transform-origin:center;transform:scaleY(.12)}
      #azaAiTeacher.is-speaking .teacher-mouth-closed{opacity:0}
      #azaAiTeacher.is-speaking .teacher-mouth-open{opacity:1;animation:azaTutorMouth .42s ease-in-out infinite alternate}
      #azaAiTeacher.is-speaking .teacher-head{animation:azaTutorHeadSpeak 1.9s ease-in-out infinite}
      #azaAiTeacher.is-speaking .teacher-arm-left{animation:azaTutorGestureLeft 1.7s ease-in-out infinite}
      #azaAiTeacher.is-speaking .teacher-arm-right{animation:azaTutorGestureRight 2.1s ease-in-out infinite}
      #azaAiTeacher.is-listening .teacher-head{animation:azaTutorListen 2s ease-in-out infinite}
      #azaAiTeacher.is-listening:before{border-color:#ff777770;box-shadow:0 0 0 14px #ff777715,0 0 30px #ff777725}
      #azaAiTeacher.is-thinking .teacher-orbit{animation:azaTutorOrbit 2.3s linear infinite;transform-origin:160px 90px}
      #azaAiTeacher.is-thinking .teacher-mouth-closed{opacity:.45}
      .aza-ai-teacher-status{position:absolute;z-index:2;bottom:8px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:7px;max-width:90%;padding:5px 10px;border:1px solid #2f5b77;border-radius:999px;background:#071522db;color:#bbd7e9;font-size:10px;font-weight:800;white-space:nowrap;box-shadow:0 3px 12px #0003}
      .aza-ai-teacher-status:before{content:"";width:6px;height:6px;flex:0 0 6px;border-radius:50%;background:#48dcb0;box-shadow:0 0 8px #48dcb0}
      #azaAiTeacher.is-speaking .aza-ai-teacher-status:before{background:#ffbf56;box-shadow:0 0 8px #ffbf56;animation:azaTutorStatusPulse .6s ease-in-out infinite alternate}
      #azaAiTeacher.is-listening .aza-ai-teacher-status:before{background:#ff7f7f;box-shadow:0 0 8px #ff7f7f;animation:azaTutorStatusPulse .75s ease-in-out infinite alternate}
      #azaAiTeacher.is-thinking .aza-ai-teacher-status:before{background:#61cbff;box-shadow:0 0 8px #61cbff;animation:azaTutorStatusPulse .5s ease-in-out infinite alternate}
      @keyframes azaTutorHeadIdle{0%,100%{transform:translateY(0) rotate(0)}38%{transform:translateY(-1.5px) rotate(-1.3deg)}70%{transform:translateY(0) rotate(.8deg)}}
      @keyframes azaTutorHeadSpeak{0%,100%{transform:translateY(0) rotate(0)}30%{transform:translateY(-1px) rotate(-1deg)}67%{transform:translateY(1px) rotate(1deg)}}
      @keyframes azaTutorListen{0%,100%{transform:rotate(0)}45%{transform:rotate(2.3deg)}75%{transform:rotate(1deg)}}
      @keyframes azaTutorArmIdle{0%,100%{transform:rotate(0)}50%{transform:rotate(-2deg)}}
      @keyframes azaTutorArmIdleRight{0%,100%{transform:rotate(0)}45%{transform:rotate(2deg)}}
      @keyframes azaTutorGestureLeft{0%,100%{transform:rotate(-1deg)}45%{transform:rotate(-8deg)}70%{transform:rotate(2deg)}}
      @keyframes azaTutorGestureRight{0%,100%{transform:rotate(0)}35%{transform:rotate(7deg)}68%{transform:rotate(-3deg)}}
      @keyframes azaTutorBlink{0%,93%,96%,100%{opacity:0}94%,95%{opacity:1}}
      @keyframes azaTutorMouth{0%{transform:scaleY(.12)}35%{transform:scaleY(.9)}70%{transform:scaleY(.3)}100%{transform:scaleY(1)}}
      @keyframes azaTutorSpark{0%,100%{opacity:.65;transform:translateY(0) scale(.94)}50%{opacity:1;transform:translateY(-4px) scale(1.12)}}
      @keyframes azaTutorOrbit{to{transform:rotate(360deg)}}
      @keyframes azaTutorStatusPulse{to{opacity:.5;transform:scale(.82)}}
      @media(max-width:480px){#azaAiTeacher{height:145px}#azaAiTeacher .aza-ai-tutor-figure{height:155px;width:min(270px,96%);top:-3px}.aza-ai-teacher-status{bottom:6px;font-size:9px}}
      @media(prefers-reduced-motion:reduce){#azaAiTeacher:after,#azaAiTeacher .teacher-head,#azaAiTeacher .teacher-arm-left,#azaAiTeacher .teacher-arm-right,#azaAiTeacher .teacher-blink,#azaAiTeacher.is-speaking .teacher-mouth-open,#azaAiTeacher .aza-ai-teacher-status:before{animation:none!important}#azaAiTeacher.is-speaking .teacher-mouth-open{transform:scaleY(.48)}}
    `;
    document.head.appendChild(style);
  }

  function createTutorStage(panel) {
    if ($('#azaAiTeacher', panel)) return;
    ensureTutorStyles();
    const stage = document.createElement('section');
    stage.id = 'azaAiTeacher';
    stage.className = 'aza-ai-teacher is-idle';
    stage.dataset.state = 'idle';
    stage.setAttribute('role', 'img');
    stage.setAttribute('aria-label', tx('AZA AI сүйлөгөн мугалим', 'Говорящий AI-наставник AZA'));
    stage.innerHTML = `
      <svg class="aza-ai-tutor-figure" viewBox="0 0 320 190" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <linearGradient id="azaTutorHoodie" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#1c5674"/><stop offset=".55" stop-color="#133047"/><stop offset="1" stop-color="#091827"/></linearGradient>
          <linearGradient id="azaTutorSkin" x1="0" y1="0" x2="0.8" y2="1"><stop stop-color="#f5c6a0"/><stop offset="1" stop-color="#cd8d69"/></linearGradient>
          <linearGradient id="azaTutorHair" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#34465b"/><stop offset=".55" stop-color="#172333"/><stop offset="1" stop-color="#0c1725"/></linearGradient>
          <linearGradient id="azaTutorShirt" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#18334c"/><stop offset="1" stop-color="#081624"/></linearGradient>
        </defs>
        <ellipse cx="160" cy="181" rx="78" ry="7" fill="#01060d" opacity=".45"/>
        <g class="teacher-orbit" fill="none" stroke="#58d7ff" stroke-opacity=".26"><ellipse cx="160" cy="91" rx="102" ry="53" transform="rotate(-12 160 91)"/><ellipse cx="160" cy="91" rx="112" ry="60" stroke-dasharray="2 8"/></g>
        <g class="teacher-arm-left"><path d="M111 115C91 112 80 101 72 84L61 68 48 78 62 111C68 128 82 141 102 143Z" fill="url(#azaTutorHoodie)" stroke="#32708d" stroke-width="1.4"/><path d="M57 76C50 70 46 61 49 54L54 48 57 59 59 45Q63 42 65 49L67 59 71 49Q75 48 76 54L73 68 67 81Z" fill="url(#azaTutorSkin)" stroke="#ac7059" stroke-width="1.2" stroke-linejoin="round"/><path d="M95 119 103 131" stroke="#4a91ad" stroke-width="2" stroke-linecap="round" opacity=".75"/></g>
        <g class="teacher-arm-right"><path d="M209 116C230 115 242 129 248 147L254 163 238 169 225 151 204 140Z" fill="url(#azaTutorHoodie)" stroke="#32708d" stroke-width="1.4"/><path d="M239 163C245 158 251 155 257 160L261 168 254 174 243 173 235 170Z" fill="url(#azaTutorSkin)" stroke="#ac7059" stroke-width="1.2" stroke-linejoin="round"/><path d="M232 143 241 155" stroke="#4a91ad" stroke-width="2" stroke-linecap="round" opacity=".75"/></g>
        <path d="M111 108C95 111 86 121 82 142L74 180H246L238 142C234 121 225 111 209 108L191 100H129Z" fill="url(#azaTutorHoodie)" stroke="#34728e" stroke-width="1.5"/>
        <path d="M129 101 129 126Q160 151 191 126L191 101Z" fill="url(#azaTutorSkin)"/>
        <path d="M122 111 143 128 160 143 177 128 198 111 207 180H113Z" fill="url(#azaTutorShirt)" stroke="#24475f" stroke-width="1.2"/>
        <path d="M149 145 160 156 171 145" fill="none" stroke="#58bfe0" stroke-width="2" stroke-linecap="round" opacity=".72"/>
        <g class="teacher-head">
          <path d="M116 67C112 34 130 15 159 15 192 15 208 38 204 70L196 99C187 116 174 124 160 124 143 124 130 113 122 97Z" fill="url(#azaTutorHair)"/>
          <ellipse cx="116" cy="72" rx="7" ry="11" fill="#d99b75"/><ellipse cx="204" cy="72" rx="7" ry="11" fill="#d99b75"/>
          <path d="M119 58C118 33 135 20 160 20 184 20 201 35 201 60L198 84C193 104 179 116 160 117 140 116 126 103 121 84Z" fill="url(#azaTutorSkin)"/>
          <path d="M117 61C115 36 127 15 153 14 166 7 182 16 190 24 203 28 208 44 202 66L194 52 183 47 173 35 160 43 147 38 135 48 123 69Z" fill="url(#azaTutorHair)"/>
          <path d="M132 70Q142 64 150 69M170 69Q180 64 188 70" fill="none" stroke="#70442f" stroke-width="3" stroke-linecap="round"/>
          <g class="teacher-eyes" fill="#172434"><ellipse cx="142" cy="79" rx="4.4" ry="5.6"/><ellipse cx="178" cy="79" rx="4.4" ry="5.6"/><circle cx="143" cy="77" r="1.4" fill="#fff"/><circle cx="179" cy="77" r="1.4" fill="#fff"/></g>
          <path class="teacher-blink" d="M135 80Q142 85 149 80M171 80Q178 85 185 80" fill="none" stroke="#754831" stroke-width="2.3" stroke-linecap="round"/>
          <path d="M160 79 156 91Q160 95 164 91" fill="none" stroke="#b7795c" stroke-width="1.7" stroke-linecap="round"/>
          <path class="teacher-mouth-closed" d="M150 101Q160 106 170 101" fill="none" stroke="#8e443f" stroke-width="2.3" stroke-linecap="round"/>
          <ellipse class="teacher-mouth-open" cx="160" cy="102" rx="7" ry="5.5" fill="#71333a" stroke="#a3544c" stroke-width="1.2"/>
          <path class="teacher-mouth-open" d="M155 102Q160 105 165 102" fill="none" stroke="#f2b6a2" stroke-width="1.2"/>
          <path d="M145 108Q160 115 175 108" fill="none" stroke="#b86f5a" stroke-width="1.2" opacity=".75"/>
          <path d="M127 90Q130 96 134 97M193 90Q190 96 186 97" fill="none" stroke="#e3a586" stroke-width="1.4" stroke-linecap="round" opacity=".8"/>
        </g>
        <circle cx="92" cy="49" r="2.4" fill="#fbd17c"><animate attributeName="opacity" values=".35;1;.35" dur="3.2s" repeatCount="indefinite"/></circle><circle cx="225" cy="63" r="1.8" fill="#61dcff"><animate attributeName="opacity" values=".3;.9;.3" dur="2.5s" repeatCount="indefinite"/></circle>
      </svg>
      <div class="aza-ai-teacher-status" id="azaAiTeacherStatus" aria-live="polite">${tx('Даярмын, досум! 👋', 'На связи, дружище! 👋')}</div>`;
    const messages = $('#azaAiMessages', panel);
    if (messages) panel.insertBefore(stage, messages);
    setTeacherState(teacherState);
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
    createTutorStage(panel);
    voiceEnabled = (() => { try { return localStorage.getItem('aza-ai-voice-enabled') === '1'; } catch { return false; } })();
    launch.addEventListener('click', () => {
      panel.classList.add('is-open');
      setTeacherState(busy ? 'thinking' : (activeUtterance ? 'speaking' : 'idle'));
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
      setTeacherState('idle');
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
    setTeacherState('thinking');
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
      if (!activeUtterance && !recognitionActive) setTeacherState('idle');
      input?.focus();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render, { once: true });
  else render();
})();
