/* AZA UNIVERSE Online Battle v1.0
 * Vanilla JS + the existing Supabase project configuration.
 * SQL migration is required before multiplayer actions will work.
 */
(() => {
  "use strict";
  if (window.__AZA_ONLINE_BATTLE_V1__) return;
  window.__AZA_ONLINE_BATTLE_V1__ = true;

  const cfg = window.AZA_SUPABASE_CONFIG || {};
  const API = String(cfg.projectUrl || "").replace(/\/$/, "");
  const KEY = String(cfg.publishableKey || "");
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
  const lang = () => (localStorage.getItem("aza-lang") || document.documentElement.lang || "ky") === "ru" ? "ru" : "ky";
  const isValidConfig = () => /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(API) && KEY.length > 20;
  const modeInfo = {
    "1v1": { ky: "1 vs 1", ru: "1 vs 1", seats: 2, icon: "⚔️" },
    "2v2": { ky: "2 vs 2", ru: "2 vs 2", seats: 4, icon: "🔥" },
    "4v4": { ky: "4 vs 4", ru: "4 vs 4", seats: 8, icon: "👑" }
  };
  const tx = (ky, ru) => lang() === "ru" ? ru : ky;
  const state = {
    mode: "1v1", roomId: sessionStorage.getItem("aza-battle-room-id") || "",
    snapshot: null, searchDeadline: 0, searching: false, interval: 0, pollBusy: false,
    localQuestionStart: 0, busy: false
  };

  function readSession() {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !/^sb-.+-auth-token$/.test(key)) continue;
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const session = parsed?.currentSession || parsed?.session || parsed;
        if (session?.access_token && session?.user?.id) {
          return { access_token: session.access_token, user: session.user };
        }
      }
    } catch (error) {
      console.warn("AZA Online Battle: session read failed", error);
    }
    return null;
  }

  async function rpc(name, body = {}) {
    if (!isValidConfig()) throw new Error(tx("Supabase жөндөөлөрү табылган жок.", "Не найдена конфигурация Supabase."));
    const session = readSession();
    if (!session) throw new Error(tx("Онлайн беттеш үчүн аккаунтуңа кир.", "Войди в аккаунт, чтобы играть онлайн."));
    const response = await fetch(`${API}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(body),
      cache: "no-store"
    });
    const raw = await response.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
    if (!response.ok) {
      const detail = data?.message || data?.details || data?.hint || data?.error || `HTTP ${response.status}`;
      if (response.status === 401 || response.status === 403) {
        throw new Error(tx("Сеанс бүткөн болушу мүмкүн. Аккаунтуңа кайра кирип көр.", "Сеанс мог истечь. Войди в аккаунт заново."));
      }
      if (String(detail).includes("aza_battle")) {
        throw new Error(tx("Онлайн беттештин SQL-файлын Supabase'ге киргизүү керек.", "Сначала выполни SQL-файл онлайн-баттла в Supabase."));
      }
      throw new Error(detail);
    }
    return data;
  }

  function ensureStyle() {
    if ($('link[data-aza-online-battle-css]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "online-battle.css?v=1";
    link.dataset.azaOnlineBattleCss = "true";
    document.head.appendChild(link);
  }

  function ensureUI() {
    ensureStyle();
    const cardCopy = $(".feature-games .feature-card-copy");
    if (cardCopy && !$("#azaBattleLaunch", cardCopy)) {
      const button = document.createElement("button");
      button.type = "button";
      button.id = "azaBattleLaunch";
      button.className = "aza-battle-launch";
      button.innerHTML = `<span class="aza-battle-launch-icon">🌐</span><span><strong>${esc(tx("ОНЛАЙН БЕТТЕШ", "ОНЛАЙН-БАТТЛ"))}</strong><small>${esc(tx("Достор менен же рандомдуу оюнчуга каршы", "С друзьями или случайным соперником"))}</small></span><b aria-hidden="true">↗</b>`;
      button.addEventListener("click", openBattle);
      const arrow = $(".card-arrow", cardCopy);
      if (arrow) arrow.insertAdjacentElement("afterend", button);
      else cardCopy.appendChild(button);
    }
    if (!$("#azaBattleOverlay")) {
      const overlay = document.createElement("div");
      overlay.id = "azaBattleOverlay";
      overlay.className = "aza-battle-overlay";
      overlay.hidden = true;
      overlay.innerHTML = `<div class="aza-battle-backdrop" data-battle-close></div><section class="aza-battle-modal" role="dialog" aria-modal="true" aria-labelledby="azaBattleTitle"><button class="aza-battle-close" type="button" data-battle-close aria-label="Close">×</button><div id="azaBattleContent"></div></section>`;
      document.body.appendChild(overlay);
      overlay.addEventListener("click", handleModalClick);
    }
  }

  function openBattle() {
    ensureUI();
    const overlay = $("#azaBattleOverlay");
    overlay.hidden = false;
    document.body.classList.add("aza-battle-open");
    if (state.roomId) {
      state.searching = !!state.searching;
      pollRoom();
      startPolling();
    } else renderHome();
  }

  function hideBattle() {
    if (state.roomId) {
      const ok = window.confirm(tx("Беттештен чыгып, бөлмөнү жабасыңбы?", "Выйти из матча и закрыть комнату?"));
      if (!ok) return;
      void leaveRoom(true);
    }
    stopPolling();
    const overlay = $("#azaBattleOverlay");
    if (overlay) overlay.hidden = true;
    document.body.classList.remove("aza-battle-open");
  }

  function handleModalClick(event) {
    const close = event.target.closest("[data-battle-close]");
    if (close) { hideBattle(); return; }
    const modeButton = event.target.closest("[data-battle-mode]");
    if (modeButton) {
      state.mode = modeButton.dataset.battleMode;
      renderHome();
      return;
    }
    const actionButton = event.target.closest("[data-battle-action]");
    if (actionButton) {
      const action = actionButton.dataset.battleAction;
      if (action === "random") void startRandomSearch();
      else if (action === "create") void createRoom();
      else if (action === "join") void joinRoom();
      else if (action === "ready") void setReady();
      else if (action === "leave") void leaveRoom(false);
      else if (action === "copy") void copyRoomCode();
      else if (action === "share") void shareRoom();
      else if (action === "back") { void leaveRoom(true); renderHome(); }
      else if (action === "login") {
        hideOverlayOnly();
        $("[data-open='profile']")?.click();
      }
      return;
    }
    const answer = event.target.closest("[data-battle-answer]");
    if (answer) { void submitAnswer(Number(answer.dataset.battleAnswer)); return; }
    const codeField = event.target.closest("#azaBattleCode");
    if (codeField) codeField.value = codeField.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  }

  function hideOverlayOnly() {
    const overlay = $("#azaBattleOverlay");
    if (overlay) overlay.hidden = true;
    document.body.classList.remove("aza-battle-open");
  }

  function modeButtons() {
    return `<div class="aza-battle-mode-grid">${Object.entries(modeInfo).map(([key, info]) => `<button type="button" class="aza-battle-mode ${state.mode === key ? "selected" : ""}" data-battle-mode="${key}"><span>${info.icon}</span><strong>${info[lang()]}</strong><small>${info.seats} ${tx("оюнчу", "игрока")}</small></button>`).join("")}</div>`;
  }

  function renderHome(message = "") {
    const content = $("#azaBattleContent");
    if (!content) return;
    state.snapshot = null;
    content.innerHTML = `
      <span class="aza-battle-eyebrow">AZA UNIVERSE · ONLINE</span>
      <h2 id="azaBattleTitle">${esc(tx("Онлайн беттеш", "Онлайн-баттл"))}</h2>
      <p class="aza-battle-muted">${esc(tx("Режимди танда. Ар бир суроого 60 секунд берилет.", "Выбери режим. На каждый вопрос даётся 60 секунд."))}</p>
      ${message ? `<div class="aza-battle-message">${esc(message)}</div>` : ""}
      ${modeButtons()}
      <div class="aza-battle-action-list">
        <button class="aza-battle-action primary" type="button" data-battle-action="random"><span>🌐</span><span><strong>${esc(tx("Рандомдуу онлайн беттеш", "Случайный онлайн-баттл"))}</strong><small>${esc(tx("Поиск башталат — сендей оюнчуларды табат", "Начнётся поиск соперников в выбранном режиме"))}</small></span><b>→</b></button>
        <button class="aza-battle-action" type="button" data-battle-action="create"><span>🏠</span><span><strong>${esc(tx("Лобби түзүү", "Создать лобби"))}</strong><small>${esc(tx("Досторуңа бөлмө кодун жөнөт", "Отправь друзьям код комнаты"))}</small></span><b>→</b></button>
      </div>
      <div class="aza-battle-divider"><span>${esc(tx("же код аркылуу кошул", "или присоединись по коду"))}</span></div>
      <div class="aza-battle-join-row"><input id="azaBattleCode" class="aza-battle-code-input" type="text" maxlength="6" inputmode="text" autocomplete="off" placeholder="${esc(tx("6 белгиден турган код", "Код из 6 символов"))}" aria-label="${esc(tx("Бөлмө коду", "Код комнаты"))}"><button class="aza-battle-action primary compact" type="button" data-battle-action="join">${esc(tx("Кошулуу", "Войти"))}</button></div>
      <p class="aza-battle-footnote">${esc(tx("Беттештин онлайн режими үчүн аккаунтка кирип, сервердин SQL орнотуусу жасалган болушу керек.", "Для онлайн-режима нужно войти в аккаунт и один раз настроить SQL в Supabase."))}</p>`;
  }

  async function startRandomSearch() {
    if (state.busy) return;
    state.busy = true;
    renderSearching(true);
    try {
      const result = await rpc("aza_battle_random_match", { p_mode: state.mode });
      state.roomId = result?.room_id || result?.id || "";
      if (!state.roomId) throw new Error(tx("Бөлмө түзүлгөн жок. Кайра аракет кыл.", "Комната не создалась. Попробуй ещё раз."));
      sessionStorage.setItem("aza-battle-room-id", state.roomId);
      state.searching = true;
      state.searchDeadline = Date.now() + 60000;
      state.busy = false;
      startPolling();
      await pollRoom();
    } catch (error) {
      state.busy = false;
      renderHome(error.message || tx("Издөө иштеген жок.", "Поиск не сработал."));
    }
  }

  function renderSearching(loading = false) {
    const content = $("#azaBattleContent");
    if (!content) return;
    content.innerHTML = `<span class="aza-battle-eyebrow">AZA MATCHMAKING</span><h2 id="azaBattleTitle">${esc(tx("Оюнчулар изделүүдө…", "Поиск игроков…"))}</h2><div class="aza-battle-search-orbit"><span>🌐</span><i></i><b></b></div><p class="aza-battle-muted">${esc(tx(`${modeInfo[state.mode].ky} режими · 60 секундга чейин күт.`, `${modeInfo[state.mode].ru} · поиск до 60 секунд.`))}</p><div class="aza-battle-progress"><i></i></div><p class="aza-battle-footnote">${esc(loading ? tx("Серверге туташууда…", "Подключаемся к серверу…") : tx("Сен издөө кезегиндесиң. Дагы оюнчу басса, бөлмөгө кошулат.", "Ты в очереди. Когда другие игроки нажмут поиск, они присоединятся."))}</p><button class="aza-battle-action" type="button" data-battle-action="leave">${esc(tx("Издөөнү токтотуу", "Остановить поиск"))}</button>`;
  }

  async function createRoom() {
    if (state.busy) return;
    state.busy = true;
    renderLoading(tx("Лобби түзүлүүдө…", "Создаём лобби…"));
    try {
      const result = await rpc("aza_battle_create_room", { p_mode: state.mode });
      state.roomId = result?.room_id || result?.id || "";
      if (!state.roomId) throw new Error(tx("Лобби түзүлгөн жок.", "Не удалось создать лобби."));
      sessionStorage.setItem("aza-battle-room-id", state.roomId);
      state.searching = false;
      state.busy = false;
      startPolling();
      await pollRoom();
    } catch (error) {
      state.busy = false;
      renderHome(error.message || tx("Лобби түзүү ишке ашкан жок.", "Не удалось создать лобби."));
    }
  }

  async function joinRoom() {
    if (state.busy) return;
    const input = $("#azaBattleCode");
    const code = String(input?.value || "").trim().toUpperCase();
    if (code.length !== 6) { renderHome(tx("Бөлмөнүн 6 белгиден турган кодун жаз.", "Введи 6-значный код комнаты.")); return; }
    state.busy = true;
    renderLoading(tx("Бөлмөгө кошулууда…", "Подключаемся к комнате…"));
    try {
      const result = await rpc("aza_battle_join_room", { p_code: code });
      state.roomId = result?.room_id || result?.id || "";
      if (!state.roomId) throw new Error(tx("Мындай коддогу бош бөлмө табылган жок.", "Свободная комната с таким кодом не найдена."));
      sessionStorage.setItem("aza-battle-room-id", state.roomId);
      state.searching = false;
      state.busy = false;
      startPolling();
      await pollRoom();
    } catch (error) {
      state.busy = false;
      renderHome(error.message || tx("Кошулуу иштеген жок.", "Не удалось подключиться."));
    }
  }

  function renderLoading(title) {
    const content = $("#azaBattleContent");
    if (content) content.innerHTML = `<span class="aza-battle-eyebrow">AZA UNIVERSE</span><h2 id="azaBattleTitle">${esc(title)}</h2><div class="aza-battle-progress"><i></i></div>`;
  }

  function startPolling() {
    stopPolling();
    state.interval = window.setInterval(() => { void pollRoom(); }, 1400);
  }
  function stopPolling() {
    if (state.interval) window.clearInterval(state.interval);
    state.interval = 0;
  }

  async function pollRoom() {
    if (!state.roomId || state.busy || state.pollBusy) return;
    state.pollBusy = true;
    try {
      const snap = await rpc("aza_battle_snapshot", { p_room_id: state.roomId, p_lang: lang() });
      if (!snap || !snap.room) throw new Error(tx("Бөлмө табылган жок. Издөөнү кайра башта.", "Комната не найдена. Запусти поиск заново."));
      state.snapshot = snap;
      if (snap.room.status !== "waiting") state.searching = false;
      if (state.searching && snap.room.status === "waiting" && Date.now() >= state.searchDeadline) {
        await leaveRoom(false, tx("60 секунд ичинде жетиштүү оюнчу табылган жок. Кайра аракет кыл.", "За 60 секунд не набралось игроков. Попробуй ещё раз."));
        return;
      }
      renderSnapshot(snap);
      if (snap.room.status === "finished" || snap.room.status === "cancelled") {
        stopPolling();
        state.searching = false;
      }
    } catch (error) {
      stopPolling();
      renderHome(error.message || tx("Беттешке туташуу үзүлдү.", "Соединение с баттлом прервано."));
      state.roomId = "";
      sessionStorage.removeItem("aza-battle-room-id");
    } finally {
      state.pollBusy = false;
    }
  }

  function renderPlayers(snap) {
    const me = readSession()?.user?.id;
    const players = snap.players || [];
    return `<div class="aza-battle-players">${players.map(player => {
      const own = player.user_id === me;
      return `<div class="aza-battle-player ${own ? "own" : ""}"><span class="aza-battle-player-avatar">${esc((player.username || "A").slice(0,1).toUpperCase())}</span><span class="aza-battle-player-info"><strong>${esc(player.username || "AZA Player")}${own ? ` <small>${esc(tx("(сен)", "(ты)"))}</small>` : ""}</strong><small>${esc(tx("Команда", "Команда"))} ${player.team_no} · ${player.is_ready ? esc(tx("ДАЯР", "ГОТОВ")) : esc(tx("Күтүүдө", "Ожидает"))}</small></span><b>${Number(player.score || 0)} ${esc(tx("уп.", "оч."))}</b></div>`;
    }).join("")}${players.length < snap.room.max_players ? `<div class="aza-battle-player empty"><span class="aza-battle-player-avatar">＋</span><span class="aza-battle-player-info"><strong>${esc(tx("Оюнчу күтүлүүдө", "Ожидание игрока"))}</strong><small>${players.length}/${snap.room.max_players}</small></span></div>` : ""}</div>`;
  }

  function renderSnapshot(snap) {
    const content = $("#azaBattleContent");
    if (!content) return;
    const room = snap.room;
    const mode = modeInfo[room.mode] || modeInfo["1v1"];
    const players = snap.players || [];
    const count = players.length;
    const heading = `${mode.icon} ${mode[lang()]}`;
    let body = "";
    if (room.status === "waiting") {
      const isRandom = !!room.is_random;
      const allReady = count === room.max_players && players.every(p => p.is_ready);
      body = `<div class="aza-battle-room-heading"><span class="aza-battle-code-label">${esc(tx("БӨЛМӨ КОДУ", "КОД КОМНАТЫ"))}</span><strong>${esc(room.code)}</strong><button type="button" class="aza-battle-small-btn" data-battle-action="copy">${esc(tx("Көчүрүү", "Копировать"))}</button><button type="button" class="aza-battle-small-btn" data-battle-action="share">${esc(tx("Бөлүшүү", "Поделиться"))}</button></div>
      ${isRandom ? `<div class="aza-battle-message waiting">🌐 ${esc(tx("Рандомдуу издөө жүрүп жатат…", "Идёт поиск игроков…"))}</div>` : `<p class="aza-battle-muted">${esc(tx("Бул кодду досторуңа жибер. Баары кошулгандан кийин ар бир оюнчу даяр болсун.", "Отправь код друзьям. Когда все подключатся, каждый должен нажать «Готов»."))}</p>`}
      ${renderPlayers(snap)}<div class="aza-battle-team-scores">${esc(tx("Командалар", "Команды"))}: <span>🔵 ${esc(tx("1-команда", "Команда 1"))}</span><span>🔴 ${esc(tx("2-команда", "Команда 2"))}</span></div>
      <p class="aza-battle-footnote">${count}/${room.max_players} ${esc(tx("оюнчу кошулду", "игроков подключено"))}</p>
      ${!isRandom ? `<button type="button" class="aza-battle-action primary" data-battle-action="ready"><span>✅</span><span><strong>${esc(players.find(p => p.user_id === readSession()?.user?.id)?.is_ready ? tx("ДАЯРСЫЗ", "ВЫ ГОТОВЫ") : tx("ДАЯР", "ГОТОВ"))}</strong><small>${esc(tx("Бардык оюнчулар даяр болгондо 3 секунддук старт башталат", "Когда все будут готовы, старт через 3 секунды"))}</small></span><b>→</b></button>` : ""}
      <button type="button" class="aza-battle-action quiet" data-battle-action="leave">${esc(tx("Бөлмөдөн чыгуу", "Выйти из комнаты"))}</button>`;
    } else if (room.status === "starting") {
      const seconds = Math.max(0, Math.ceil((Date.parse(room.starts_at) - Date.now()) / 1000));
      body = `<div class="aza-battle-countdown"><span>⚡</span><strong>${seconds || "GO!"}</strong><small>${esc(tx("БЕТТЕШ БАШТАЛАТ", "БАТТЛ НАЧИНАЕТСЯ"))}</small></div>${renderPlayers(snap)}<p class="aza-battle-muted center">${esc(tx("Даяр бол! Ар бир суроого 60 секунд берилет.", "Приготовься! На каждый вопрос 60 секунд."))}</p>`;
    } else if (room.status === "playing") {
      body = renderQuestion(snap);
    } else if (room.status === "finished") {
      body = renderResults(snap);
    } else {
      body = `<div class="aza-battle-message">${esc(tx("Бул беттеш жабылган.", "Этот матч закрыт."))}</div><button type="button" class="aza-battle-action primary" data-battle-action="back">${esc(tx("Башкы бетке кайтуу", "Вернуться"))}</button>`;
    }
    content.innerHTML = `<span class="aza-battle-eyebrow">AZA UNIVERSE · ${esc(tx("ОНЛАЙН БЕТТЕШ", "ОНЛАЙН-БАТТЛ"))}</span><h2 id="azaBattleTitle">${esc(heading)}</h2>${body}`;
  }

  function renderQuestion(snap) {
    const q = snap.question;
    if (!q) return `<div class="aza-battle-message">${esc(tx("Суроо жүктөлүүдө…", "Загружается вопрос…"))}</div>${renderPlayers(snap)}`;
    const answered = !!q.answered;
    const reveal = !!q.reveal;
    const me = readSession()?.user?.id;
    const players = snap.players || [];
    const team1 = players.filter(p => Number(p.team_no) === 1).reduce((sum,p)=>sum+Number(p.score||0),0);
    const team2 = players.filter(p => Number(p.team_no) === 2).reduce((sum,p)=>sum+Number(p.score||0),0);
    const currentStart = Date.parse(q.started_at || snap.room.question_started_at || snap.room.starts_at || "") || Date.now();
    const left = Math.max(0, Number(q.seconds_left ?? Math.ceil((currentStart + 60000 - Date.now()) / 1000)));
    return `<div class="aza-battle-livebar"><span>${esc(tx("СУРОО", "ВОПРОС"))} <b>${q.number}/10</b></span><span class="aza-battle-timer ${left <= 5 ? "urgent" : ""}">⏱️ ${left}${esc(tx(" с", " с"))}</span></div>
      <div class="aza-battle-team-scores"><span>🔵 ${esc(tx("Команда 1", "Команда 1"))}: <b>${team1}</b></span><span>🔴 ${esc(tx("Команда 2", "Команда 2"))}: <b>${team2}</b></span></div>
      <div class="aza-battle-question"><span class="aza-battle-category">${esc(q.category || tx("Жалпы билим", "Общие знания"))}</span><h3>${esc(q.text)}</h3></div>
      <div class="aza-battle-options">${(q.options || []).map((option,index)=>{
        const classes = ["aza-battle-option"];
        if (reveal && index === Number(q.correct_index)) classes.push("correct");
        if (reveal && answered && index === Number(q.my_choice) && index !== Number(q.correct_index)) classes.push("wrong");
        if (answered || reveal) classes.push("disabled");
        return `<button type="button" class="${classes.join(" ")}" data-battle-answer="${index}" ${answered || reveal ? "disabled" : ""}><span>${String.fromCharCode(65+index)}</span><strong>${esc(option)}</strong>${reveal && index===Number(q.correct_index)?"<b>✓</b>":""}</button>`;
      }).join("")}</div>
      ${answered && !reveal ? `<div class="aza-battle-message waiting">✅ ${esc(tx("Жообуң кабыл алынды. Калган оюнчуларды күтөбүз…", "Ответ принят. Ждём остальных игроков…"))}</div>` : ""}
      ${reveal ? `<div class="aza-battle-explanation"><strong>${esc(tx("Туура жооп", "Правильный ответ"))}: ${esc(q.options?.[Number(q.correct_index)] || "")}</strong><p>${esc(q.explanation || "")}</p><small>${esc(tx("Кийинки суроо 3 секунддан кийин", "Следующий вопрос через 3 секунды"))}</small></div>` : ""}
      <div class="aza-battle-live-foot">${renderPlayers(snap)}</div>`;
  }

  function renderResults(snap) {
    const result = snap.result || {};
    const team1 = Number(result.team1_score || 0);
    const team2 = Number(result.team2_score || 0);
    const winner = Number(result.winner_team || 0);
    const players = snap.players || [];
    const me = readSession()?.user?.id;
    const mine = players.find(p => p.user_id === me);
    const won = !!winner && Number(mine?.team_no) === winner;
    const draw = !winner;
    return `<div class="aza-battle-result-hero"><span>${draw ? "🤝" : won ? "🏆" : "🎮"}</span><h3>${esc(draw ? tx("ТЕҢ ЖЫЙЫНТЫК!", "НИЧЬЯ!") : won ? tx("ЖЕҢИШ!", "ПОБЕДА!") : tx("БЕТТЕШ АЯКТАДЫ", "МАТЧ ЗАВЕРШЁН"))}</h3><p>${esc(tx("10 суроо бүткөндөн кийинки жыйынтык", "Итог после 10 вопросов"))}</p></div>
      <div class="aza-battle-final-scores"><div class="${winner===1?"winner":""}"><span>🔵</span><small>${esc(tx("Команда 1", "Команда 1"))}</small><strong>${team1}</strong></div><b>VS</b><div class="${winner===2?"winner":""}"><span>🔴</span><small>${esc(tx("Команда 2", "Команда 2"))}</small><strong>${team2}</strong></div></div>
      <div class="aza-battle-result-points">${esc(tx("Сенин онлайн-баттл рейтингиң", "Твой рейтинг онлайн-баттлов"))}<strong>+${Number(mine?.rating_awarded || result.rating_bonus || (draw ? 10 : won ? 20 : 5))}</strong><small>${esc(tx("Рейтингке берилген упайлар", "Очки рейтинга за матч"))}</small></div>
      ${renderPlayers(snap)}
      <button type="button" class="aza-battle-action primary" data-battle-action="back"><span>🎮</span><span><strong>${esc(tx("Дагы беттеш", "Новый матч"))}</strong><small>${esc(tx("Башка режим танда же кайра изде", "Выбери режим или найди новый матч"))}</small></span><b>→</b></button>`;
  }

  async function setReady() {
    if (!state.roomId || state.busy) return;
    state.busy = true;
    try {
      const me = readSession()?.user?.id;
      const player = state.snapshot?.players?.find(p => p.user_id === me);
      await rpc("aza_battle_set_ready", { p_room_id: state.roomId, p_ready: !player?.is_ready });
      state.busy = false;
      await pollRoom();
    } catch (error) {
      showInlineError(error.message);
    } finally { state.busy = false; }
  }

  async function submitAnswer(choice) {
    const q = state.snapshot?.question;
    if (!state.roomId || !q || q.answered || q.reveal || state.busy) return;
    state.busy = true;
    try {
      const started = Date.parse(q.started_at || state.snapshot.room.question_started_at || "") || Date.now();
      await rpc("aza_battle_submit_answer", {
        p_room_id: state.roomId,
        p_question_no: Number(q.number),
        p_choice_index: choice,
        p_response_ms: Math.max(0, Math.min(60000, Date.now() - started))
      });
      state.busy = false;
      await pollRoom();
    } catch (error) {
      showInlineError(error.message || tx("Жооп кабыл алынган жок.", "Ответ не принят."));
    } finally { state.busy = false; }
  }

  async function leaveRoom(silent = false, returnMessage = "") {
    const roomId = state.roomId;
    stopPolling();
    state.roomId = "";
    state.snapshot = null;
    state.searching = false;
    sessionStorage.removeItem("aza-battle-room-id");
    if (roomId) {
      try { await rpc("aza_battle_leave_room", { p_room_id: roomId }); }
      catch (error) { console.warn("AZA battle leave failed", error); }
    }
    if (!silent) renderHome(returnMessage);
  }

  async function copyRoomCode() {
    const code = state.snapshot?.room?.code || "";
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      showInlineError(tx("Код көчүрүлдү ✅", "Код скопирован ✅"), true);
    } catch {
      window.prompt(tx("Бөлмө кодуң", "Код комнаты"), code);
    }
  }

  async function shareRoom() {
    const code = state.snapshot?.room?.code || "";
    if (!code) return;
    const link = `${location.origin}${location.pathname}?battle=${encodeURIComponent(code)}`;
    const text = tx(`AZA UNIVERSE беттешине кошул! Бөлмө коду: ${code}`, `Присоединяйся к баттлу AZA UNIVERSE! Код: ${code}`);
    try {
      if (navigator.share) await navigator.share({ title: "AZA UNIVERSE", text, url: link });
      else if (navigator.clipboard) { await navigator.clipboard.writeText(`${text}\n${link}`); showInlineError(tx("Чакыруу көчүрүлдү ✅", "Приглашение скопировано ✅"), true); }
      else window.prompt(text, link);
    } catch (error) {
      if (error?.name !== "AbortError") window.prompt(text, link);
    }
  }

  function showInlineError(message, success = false) {
    const content = $("#azaBattleContent");
    if (!content) return;
    let box = $(".aza-battle-flash", content);
    if (!box) {
      box = document.createElement("div");
      box.className = "aza-battle-flash";
      content.prepend(box);
    }
    box.classList.toggle("success", success);
    box.textContent = String(message || "");
  }

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !$("#azaBattleOverlay")?.hidden) hideBattle();
  });

  function init() {
    ensureUI();
    const params = new URLSearchParams(location.search);
    const code = params.get("battle");
    if (code && /^[A-Z0-9]{6}$/i.test(code) && !state.roomId) {
      const card = $("#azaBattleLaunch");
      if (card) {
        const oldClick = card.onclick;
        card.onclick = oldClick;
        card.addEventListener("click", () => {
          const input = $("#azaBattleCode");
          if (input) input.value = code.toUpperCase();
        }, { once: true });
      }
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
