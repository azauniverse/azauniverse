import { DurableObject } from "cloudflare:workers";

const WS_OPEN = 1;
const DEFAULT_MAX_ACTIVE = 10_000;
const DEFAULT_HEARTBEAT_MS = 10 * 60 * 1000;
const DEFAULT_STALE_MS = 22 * 60 * 1000;
const DEFAULT_ALARM_MS = 5 * 60 * 1000;
const DEFAULT_ORIGIN = "https://azauniverse.github.io";

function parsePositiveInt(value, fallback, max = 1_000_000_000) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}

function originAllowed(origin, env) {
  const allowed = String(env.ALLOWED_ORIGINS || DEFAULT_ORIGIN)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return !!origin && allowed.includes(origin);
}

function sendJSON(socket, payload) {
  if (!socket || socket.readyState !== WS_OPEN) return false;
  try {
    socket.send(JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/health" && request.method === "GET") {
      return Response.json({ ok: true, service: "aza-universe-capacity-gate" }, {
        headers: { "Cache-Control": "no-store" },
      });
    }

    if (url.pathname !== "/ws") {
      return new Response("Not found", { status: 404 });
    }

    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("WebSocket upgrade required", { status: 426 });
    }

    const origin = request.headers.get("Origin");
    if (!originAllowed(origin, env)) {
      return new Response("Origin not allowed", { status: 403 });
    }

    const id = env.SITE_CAPACITY.idFromName("aza-universe-global-site-capacity-v1");
    return env.SITE_CAPACITY.get(id).fetch(request);
  },
};

export class SiteCapacity extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;

    // SQLite-backed, synchronous sequence counter: one ordered ticket per connection.
    this.ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS capacity_queue_sequence (id INTEGER PRIMARY KEY CHECK (id = 1), value INTEGER NOT NULL)"
    );
    this.ctx.storage.sql.exec(
      "INSERT OR IGNORE INTO capacity_queue_sequence (id, value) VALUES (1, 0)"
    );
  }

  get maxActive() {
    return parsePositiveInt(this.env.MAX_ACTIVE, DEFAULT_MAX_ACTIVE, 30_000);
  }

  get heartbeatMs() {
    return parsePositiveInt(this.env.HEARTBEAT_MS, DEFAULT_HEARTBEAT_MS, 60 * 60 * 1000);
  }

  get staleMs() {
    return parsePositiveInt(this.env.STALE_MS, DEFAULT_STALE_MS, 6 * 60 * 60 * 1000);
  }

  get alarmMs() {
    return parsePositiveInt(this.env.ALARM_EVERY_MS, DEFAULT_ALARM_MS, 60 * 60 * 1000);
  }

  sessions() {
    return this.ctx.getWebSockets()
      .filter((socket) => socket.readyState === WS_OPEN && socket.deserializeAttachment());
  }

  attachment(socket) {
    try { return socket.deserializeAttachment() || {}; }
    catch { return {}; }
  }

  activeSessions() {
    return this.sessions().filter((socket) => this.attachment(socket).status === "active");
  }

  queuedSessions() {
    return this.sessions()
      .filter((socket) => this.attachment(socket).status === "queued")
      .sort((a, b) => {
        const aa = this.attachment(a);
        const bb = this.attachment(b);
        return Number(aa.queueOrder || 0) - Number(bb.queueOrder || 0);
      });
  }

  nextQueueOrder() {
    const row = this.ctx.storage.sql.exec(
      "UPDATE capacity_queue_sequence SET value = value + 1 WHERE id = 1 RETURNING value"
    ).one();
    return Number(row.value);
  }

  async ensureAlarm() {
    const current = await this.ctx.storage.getAlarm();
    if (current === null) {
      await this.ctx.storage.setAlarm(Date.now() + this.alarmMs);
    }
  }

  async fetch(request) {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("WebSocket upgrade required", { status: 426 });
    }

    const origin = request.headers.get("Origin");
    if (!originAllowed(origin, this.env)) {
      return new Response("Origin not allowed", { status: 403 });
    }

    const url = new URL(request.url);
    let clientId = String(url.searchParams.get("clientId") || "");
    if (!/^[A-Za-z0-9_-]{20,80}$/.test(clientId)) {
      clientId = crypto.randomUUID();
    }

    // Keep a reconnecting browser in its previous place instead of taking a second slot.
    const existing = this.sessions().find((socket) => this.attachment(socket).clientId === clientId);
    const previous = existing ? this.attachment(existing) : null;
    if (existing && previous) {
      existing.serializeAttachment({ ...previous, status: "replaced" });
      try { existing.close(4001, "Reconnected from same browser tab"); } catch { /* already closed */ }
    }

    if (!previous || !["active", "queued"].includes(previous.status)) {
      // Serve waiting people first before offering a newly opened slot to a newcomer.
      this.promoteWaiting();
    }

    const activeNow = this.activeSessions().length;
    const canKeepPreviousSeat = previous?.status === "active";
    const hasQueue = this.queuedSessions().length > 0;
    const status = canKeepPreviousSeat
      ? "active"
      : previous?.status === "queued"
        ? "queued"
        : (activeNow < this.maxActive && !hasQueue ? "active" : "queued");

    const queueOrder = previous?.status === "queued"
      ? Number(previous.queueOrder || this.nextQueueOrder())
      : status === "queued" ? this.nextQueueOrder() : 0;

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server, ["session"]);

    const now = Date.now();
    server.serializeAttachment({
      clientId,
      status,
      queueOrder,
      joinedAt: previous?.joinedAt || now,
      lastSeen: now,
    });

    // If a slot became free during reconnect, respect FIFO and promote the earliest
    // queued session. A promoted socket receives its `admitted` message here.
    if (status === "queued" && this.activeSessions().length < this.maxActive) {
      this.promoteWaiting();
    }

    const finalStatus = this.attachment(server).status;
    if (finalStatus === "active") {
      // If the socket was originally queued, promoteWaiting() already sent the notice.
      if (status !== "queued") {
        sendJSON(server, {
          type: "admitted",
          activeCount: this.activeSessions().length,
          maxActive: this.maxActive,
          heartbeatMs: this.heartbeatMs,
        });
      }
    } else {
      const waiting = this.queuedSessions();
      const foundPosition = waiting.findIndex((socket) => socket === server) + 1;
      const queuePosition = foundPosition > 0 ? foundPosition : waiting.length;
      sendJSON(server, {
        type: "queued",
        queuePosition: Math.max(1, queuePosition),
        queueSize: waiting.length,
        activeCount: this.activeSessions().length,
        maxActive: this.maxActive,
        heartbeatMs: this.heartbeatMs,
      });
    }

    await this.ensureAlarm();
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(socket, message) {
    const state = this.attachment(socket);
    if (!state.clientId || !["active", "queued"].includes(state.status)) {
      try { socket.close(4001, "Session replaced or expired"); } catch { /* no-op */ }
      return;
    }

    // Messages are deliberately small. Only client heartbeats are accepted.
    if (typeof message !== "string" || message.length > 256) return;
    let incoming;
    try { incoming = JSON.parse(message); } catch { return; }
    if (incoming?.type !== "ping") return;

    state.lastSeen = Date.now();
    socket.serializeAttachment(state);
    sendJSON(socket, {
      type: "pong",
      status: state.status,
      activeCount: this.activeSessions().length,
      maxActive: this.maxActive,
      queueSize: this.queuedSessions().length,
      heartbeatMs: this.heartbeatMs,
    });
  }

  webSocketClose(socket) {
    const state = this.attachment(socket);
    if (state.status === "active") this.promoteWaiting();
  }

  webSocketError(socket) {
    const state = this.attachment(socket);
    try { socket.close(1011, "Capacity connection error"); } catch { /* no-op */ }
    if (state.status === "active") this.promoteWaiting();
  }

  promoteWaiting() {
    const queue = this.queuedSessions();
    let activeCount = this.activeSessions().length;
    while (activeCount < this.maxActive && queue.length) {
      const socket = queue.shift();
      if (!socket || socket.readyState !== WS_OPEN) continue;
      const state = this.attachment(socket);
      if (state.status !== "queued") continue;
      state.status = "active";
      state.lastSeen = Date.now();
      socket.serializeAttachment(state);
      if (!sendJSON(socket, {
        type: "admitted",
        activeCount: activeCount + 1,
        maxActive: this.maxActive,
        heartbeatMs: this.heartbeatMs,
        promoted: true,
      })) {
        state.status = "expired";
        socket.serializeAttachment(state);
        try { socket.close(1011, "Could not deliver admission"); } catch { /* no-op */ }
        continue;
      }
      activeCount += 1;
    }
  }

  async alarm() {
    const now = Date.now();
    for (const socket of this.sessions()) {
      const state = this.attachment(socket);
      if (!state.lastSeen || now - Number(state.lastSeen) > this.staleMs) {
        const wasActive = state.status === "active";
        state.status = "expired";
        socket.serializeAttachment(state);
        try { socket.close(4008, "Session heartbeat expired"); } catch { /* no-op */ }
        if (wasActive) this.promoteWaiting();
      }
    }

    this.promoteWaiting();
    if (this.sessions().length > 0) {
      await this.ctx.storage.setAlarm(Date.now() + this.alarmMs);
    }
  }
}
