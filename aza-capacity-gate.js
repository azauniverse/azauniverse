/* AZA UNIVERSE — server-authoritative site capacity gate.
 * Configure window.AZA_CAPACITY_GATE_URL before loading this file, e.g.
 * wss://aza-universe-capacity.<your-subdomain>.workers.dev/ws
 */
(() => {
  "use strict";
  if (window.__AZA_CAPACITY_GATE_STARTED__) return;

  const rawUrl = String(window.AZA_CAPACITY_GATE_URL || "").trim();
  if (!rawUrl) {
    console.warn("AZA capacity gate is not configured; site opened without a capacity limit.");
    return;
  }

  let endpoint;
  try {
    endpoint = new URL(rawUrl);
    if (!/^wss?:$/.test(endpoint.protocol)) throw new Error("Use a wss:// WebSocket URL.");
    if (endpoint.pathname !== "/ws") throw new Error("Capacity URL must end in /ws.");
  } catch (error) {
    console.error("AZA capacity gate configuration error:", error);
    return;
  }
  if (!window.WebSocket) return;
  window.__AZA_CAPACITY_GATE_STARTED__ = true;

  const HB_MS = 10 * 60 * 1000;
  const KEY = "aza-capacity-client-id";
  const text = {
    ky: {
      title: "AZA UNIVERSE",
      connect: "Сайтка коопсуз туташып жатабыз…",
      queueTitle: "Кезекке кошулдуң!",
      queueBody: "Азыр сайтта активдүү колдонуучулар көп. Орун бошогондо автоматтык түрдө киргизебиз.",
      position: "Кезекке кошулгандагы орду",
      queueSize: "Кезекте турган колдонуучулар",
      note: "Кезектеги орун өзгөрүшү мүмкүн. Баракчаны ачык калтыр — кезегиң келгенде автоматтык киресиң.",
      reconnect: "Байланыш үзүлдү. Кайра туташып жатабыз…",
      reconnectButton: "Кайра туташууда",
      badge: "АКТИВДҮҮ ОРУНДАР",
      errors: "Серверге туташуу убактылуу мүмкүн болбой жатат. Автоматтык кайра аракет кылабыз."
    },
    ru: {
      title: "AZA UNIVERSE",
      connect: "Безопасно подключаемся к сайту…",
      queueTitle: "Вы в очереди!",
      queueBody: "Сейчас на сайте много активных пользователей. Как только освободится место, вы войдёте автоматически.",
      position: "Место при входе в очередь",
      queueSize: "Пользователей в очереди",
      note: "Позиция может меняться. Оставьте страницу открытой — вход произойдёт автоматически.",
      reconnect: "Соединение прервано. Подключаемся снова…",
      reconnectButton: "Повторное подключение",
      badge: "АКТИВНЫЕ СЛОТЫ",
      errors: "Пока не удаётся подключиться к серверу. Повторяем попытку автоматически."
    }
  };
  const lang = () => (localStorage.getItem("aza-lang") || document.documentElement.lang || "ky").toLowerCase().startsWith("ru") ? "ru" : "ky";
  const getText = () => text[lang()];

  let clientId = "";
  try {
    clientId = sessionStorage.getItem(KEY) || "";
    if (!/^[A-Za-z0-9_-]{20,80}$/.test(clientId)) {
      clientId = (window.crypto && typeof crypto.randomUUID === "function")
        ? crypto.randomUUID()
        : `aza_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem(KEY, clientId);
    }
  } catch {
    clientId = `aza_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
  }

  const overlay = document.createElement("div");
  overlay.className = "aza-capacity-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-live", "polite");

  const card = document.createElement("section");
  card.className = "aza-capacity-card";
  const emblem = document.createElement("div");
  emblem.className = "aza-capacity-emblem";
  const logo = document.createElement("img");
  logo.src = "assets/aza-emblem.svg";
  logo.alt = "AZA UNIVERSE";
  logo.width = 58;
  logo.height = 58;
  emblem.appendChild(logo);

  const eyebrow = document.createElement("div");
  eyebrow.className = "aza-capacity-eyebrow";
  eyebrow.textContent = "AZA • UNIVERSE";
  const heading = document.createElement("h2");
  heading.className = "aza-capacity-heading";
  const body = document.createElement("p");
  body.className = "aza-capacity-body";
  const progress = document.createElement("div");
  progress.className = "aza-capacity-progress";
  const progressLine = document.createElement("span");
  progress.appendChild(progressLine);
  const stats = document.createElement("div");
  stats.className = "aza-capacity-stats";
  const positionBox = document.createElement("div");
  const positionLabel = document.createElement("small");
  const positionValue = document.createElement("strong");
  positionBox.append(positionLabel, positionValue);
  const queueBox = document.createElement("div");
  const queueLabel = document.createElement("small");
  const queueValue = document.createElement("strong");
  queueBox.append(queueLabel, queueValue);
  stats.append(positionBox, queueBox);
  const note = document.createElement("p");
  note.className = "aza-capacity-note";
  const retry = document.createElement("div");
  retry.className = "aza-capacity-retry";
  retry.hidden = true;
  card.append(emblem, eyebrow, heading, body, progress, stats, note, retry);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  document.documentElement.classList.add("aza-capacity-locked");

  let socket = null;
  let heartbeatTimer = 0;
  let retryTimer = 0;
  let retryCount = 0;
  let heartbeatMs = HB_MS;
  let wasQueued = false;
  let firstQueuePosition = 0;
  let connected = false;
  let intentionalClose = false;

  function render(mode, payload = {}) {
    const t = getText();
    eyebrow.textContent = t.title;
    positionLabel.textContent = t.position;
    queueLabel.textContent = t.queueSize;
    positionValue.textContent = firstQueuePosition ? `#${firstQueuePosition}` : "—";
    queueValue.textContent = Number.isFinite(Number(payload.queueSize)) ? String(payload.queueSize) : "—";
    stats.hidden = mode !== "queued";
    retry.hidden = mode !== "reconnecting";
    note.hidden = mode === "connecting" || mode === "reconnecting";
    progress.hidden = mode === "queued";
    positionBox.hidden = !wasQueued;
    queueBox.hidden = !wasQueued;
    card.classList.toggle("is-queued", mode === "queued");

    if (mode === "queued") {
      heading.textContent = t.queueTitle;
      body.textContent = t.queueBody;
      note.textContent = t.note;
      retry.textContent = "";
    } else if (mode === "reconnecting") {
      heading.textContent = t.reconnectButton;
      body.textContent = t.errors;
      note.textContent = t.reconnect;
    } else {
      heading.textContent = t.title;
      body.textContent = t.connect;
      note.textContent = "";
    }
  }

  function unlock() {
    connected = true;
    retryCount = 0;
    clearTimeout(retryTimer);
    clearInterval(heartbeatTimer);
    document.documentElement.classList.remove("aza-capacity-locked");
    overlay.classList.add("is-leaving");
    window.setTimeout(() => overlay.remove(), 180);
    heartbeatTimer = window.setInterval(sendPing, heartbeatMs);
  }

  function sendPing() {
    if (socket && socket.readyState === WebSocket.OPEN) {
      try { socket.send(JSON.stringify({ type: "ping", at: Date.now() })); } catch { /* onclose will retry */ }
    }
  }

  function scheduleReconnect() {
    connected = false;
    clearInterval(heartbeatTimer);
    heartbeatTimer = 0;
    document.documentElement.classList.add("aza-capacity-locked");
    if (!overlay.isConnected) document.body.appendChild(overlay);
    overlay.classList.remove("is-leaving");
    render("reconnecting");
    clearTimeout(retryTimer);
    const base = Math.min(30_000, 1500 * (2 ** Math.min(retryCount, 5)));
    const jitter = Math.floor(Math.random() * 900);
    retryCount += 1;
    retryTimer = window.setTimeout(connect, base + jitter);
  }

  function connect() {
    intentionalClose = false;
    if (!connected) render(retryCount ? "reconnecting" : "connecting");
    const url = new URL(endpoint.toString());
    url.searchParams.set("clientId", clientId);
    try {
      socket = new WebSocket(url.toString());
    } catch {
      scheduleReconnect();
      return;
    }

    socket.addEventListener("open", () => {
      clearTimeout(retryTimer);
      retryCount = 0;
    });

    socket.addEventListener("message", (event) => {
      let payload;
      try { payload = JSON.parse(String(event.data)); } catch { return; }
      if (Number(payload.heartbeatMs) > 0) heartbeatMs = Math.max(60_000, Number(payload.heartbeatMs));
      if (payload.type === "admitted") {
        wasQueued = false;
        unlock();
      } else if (payload.type === "queued") {
        connected = true;
        wasQueued = true;
        firstQueuePosition = Number(payload.queuePosition) || firstQueuePosition || Number(payload.queueSize) || 1;
        render("queued", payload);
        if (!heartbeatTimer) heartbeatTimer = window.setInterval(sendPing, heartbeatMs);
      } else if (payload.type === "pong") {
        if (payload.status === "active") {
          if (!connected) unlock();
        } else if (payload.status === "queued") {
          wasQueued = true;
          render("queued", payload);
        }
      }
    });

    socket.addEventListener("close", () => {
      if (intentionalClose) return;
      clearInterval(heartbeatTimer);
      scheduleReconnect();
    });

    socket.addEventListener("error", () => {
      // A WebSocket error is followed by close in browsers; avoid starting two retries.
      render("reconnecting");
    });
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) sendPing();
  });
  window.addEventListener("online", sendPing);
  window.addEventListener("pagehide", () => {
    intentionalClose = true;
    clearInterval(heartbeatTimer);
    clearTimeout(retryTimer);
    if (socket && socket.readyState < WebSocket.CLOSING) {
      try { socket.close(1000, "Page hidden or navigating"); } catch { /* no-op */ }
    }
  });
  window.addEventListener("pageshow", () => {
    if (!socket || socket.readyState === WebSocket.CLOSED) connect();
  });

  render("connecting");
  connect();
})();
