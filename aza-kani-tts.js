/* AZA UNIVERSE — KaniTTS Syimyk Kyrgyz male voice bridge v1.0
 * Add this script immediately AFTER aza-ai-mentor.js in index.html.
 * Uses the public shared Hugging Face Gradio Space; on failures, falls back to device TTS.
 */
(() => {
  'use strict';
  if (window.__AZA_KANI_TTS_V1__) return;
  window.__AZA_KANI_TTS_V1__ = true;

  const SPACE = 'https://nineninesix-kanitts-kyrgyz.hf.space';
  const synth = window.speechSynthesis;
  if (!synth || typeof synth.speak !== 'function' || typeof synth.cancel !== 'function') return;

  const nativeSpeak = synth.speak.bind(synth);
  const nativeCancel = synth.cancel.bind(synth);
  let activeAudio = null;
  let requestId = 0;

  function cleanAudio() {
    if (!activeAudio) return;
    try {
      activeAudio.pause();
      activeAudio.removeAttribute('src');
      activeAudio.load();
    } catch (_) {}
    activeAudio = null;
  }

  async function generateAudio(text) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 100000);
    try {
      const startResponse = await fetch(`${SPACE}/gradio_api/call/generate_speech_gpu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: [text, 'KaniTTS Multispeaker', 'Syimyk', 0.6, 0.95, 1.1, 800]
        }),
        signal: controller.signal
      });
      if (!startResponse.ok) throw new Error(`KaniTTS start failed: ${startResponse.status}`);
      const started = await startResponse.json().catch(() => ({}));
      if (!started.event_id) throw new Error(started.error || 'No event id from KaniTTS');

      const finishResponse = await fetch(
        `${SPACE}/gradio_api/call/generate_speech_gpu/${encodeURIComponent(started.event_id)}`,
        { signal: controller.signal }
      );
      if (!finishResponse.ok) throw new Error(`KaniTTS generation failed: ${finishResponse.status}`);
      const stream = await finishResponse.text();
      let result = null;
      let apiError = '';
      for (const line of stream.split(/\r?\n/)) {
        if (!line.startsWith('data:')) continue;
        try {
          const item = JSON.parse(line.slice(5).trim());
          if (item.error) apiError = String(item.error);
          if (Array.isArray(item.data) && item.data.length) result = item;
        } catch (_) {}
      }
      if (!result && apiError) throw new Error(apiError);
      const file = result && result.data && result.data[0];
      if (file && typeof file === 'object' && file.url) return new URL(file.url, SPACE).href;
      if (typeof file === 'string' && file) return new URL(file, SPACE).href;
      if (file && typeof file === 'object' && file.path) {
        return `${SPACE}/gradio_api/file=${encodeURIComponent(file.path)}`;
      }
      throw new Error('KaniTTS did not return audio');
    } finally {
      window.clearTimeout(timeout);
    }
  }

  const patchedCancel = function () {
    requestId += 1;
    cleanAudio();
    return nativeCancel();
  };

  const patchedSpeak = function (utterance) {
    const lang = String(utterance && utterance.lang || '').toLowerCase();
    const text = String(utterance && utterance.text || '').trim();
    // Only route Kyrgyz speech to Syimyk. Preserve native speech for Russian and other languages.
    if (!text || !(lang === 'ky' || lang.startsWith('ky-'))) {
      return nativeSpeak(utterance);
    }

    requestId += 1;
    const thisRequest = requestId;
    cleanAudio();
    nativeCancel();

    const fallback = () => {
      if (thisRequest !== requestId) return;
      cleanAudio();
      try { nativeSpeak(utterance); } catch (_) {}
    };
    const callHandler = (name, event) => {
      try {
        if (typeof utterance[name] === 'function') utterance[name](event || { utterance, charIndex: 0, elapsedTime: 0, name: '' });
      } catch (_) {}
    };

    generateAudio(text).then(url => {
      if (thisRequest !== requestId) return;
      const audio = new Audio(url);
      audio.preload = 'auto';
      activeAudio = audio;
      audio.onplay = () => {
        if (thisRequest === requestId) callHandler('onstart');
      };
      audio.onended = () => {
        if (thisRequest !== requestId) return;
        activeAudio = null;
        callHandler('onend');
      };
      audio.onerror = () => {
        if (thisRequest === requestId) fallback();
      };
      audio.play().catch(fallback);
    }).catch(fallback);
  };

  try {
    synth.cancel = patchedCancel;
    synth.speak = patchedSpeak;
  } catch (_) {
    return;
  }
  if (synth.cancel !== patchedCancel || synth.speak !== patchedSpeak) return;

  window.addEventListener('pagehide', () => {
    requestId += 1;
    cleanAudio();
    try { nativeCancel(); } catch (_) {}
  });
})();
