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

    // Volatile indexes are reconstructed once after an object wakes from hibernation.
    // Counts are maintained incrementally afterward, so ordinary joins and pings do not
    // rescan every WebSocket.
    this.indexReady = false;
    this.socketByClientId = new Map();
    this.trackedStatus = new Map();
    this.queueByOrder = new Map();
    this.activeCount = 0;
    this.queuedCount = 0;
    this.alarmEnsurePromise = null;

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

  attachment(socket) {
    try { return socket.deserializeAttachment() || {}; }
    catch { return {}; }
  }

  ensureIndex() {
    if (this.indexReady) return;
    this.indexReady = true;
    this.socketByClientId.clear();
    this.trackedStatus.clear();
    this.queueByOrder.clear();
    this.activeCount = 0;
    this.queuedCount = 0;

    const queued = [];
    for (const socket of this.ctx.getWebSockets()) {
      if (!socket || socket.readyState !== WS_OPEN) continue;
      const state = this.attachment(socket);
      if (!state.clientId || !["active", "queued"].includes(state.status)) continue;

      this.socketByClientId.set(state.clientId, socket);
      this.trackedStatus.set(socket, state.status);
      if (state.status === "active") {
        this.activeCount += 1;
      } else {
        this.queuedCount += 1;
        queued.push({ order: Number(state.queueOrder || 0), socket });
      }
    }

    queued.sort((a, b) => a.order - b.order);
    for (const item of queued) this.queueByOrder.set(item.order, item.socket);
  }

  nextQueueOrder() {
    const row = this.ctx.storage.sql.exec(
      "UPDATE capacity_queue_sequence SET value = value + 1 WHERE id = 1 RETURNING value"
    ).one();
    return Number(row.value);
  }

  async ensureAlarm() {
    if (this.alarmEnsurePromise) return this.alarmEnsurePromise;

    this.alarmEnsurePromise = (async () => {
      const current = await this.ctx.storage.getAlarm();
      if (current === null) {
        await this.ctx.storage.setAlarm(Date.now() + this.alarmMs);
      }
    })();

    try {
      await this.alarmEnsurePromise;
    } finally {
      this.alarmEnsurePromise = null;
    }
  }

  removeTrackedSocket(socket) {
    const tracked = this.trackedStatus.get(socket);
    const state = this.attachment(socket);

    if (tracked === "active") this.activeCount = Math.max(0, this.activeCount - 1);
    if (tracked === "queued") this.queuedCount = Math.max(0, this.queuedCount - 1);
    this.trackedStatus.delete(socket);

    if (tracked === "queued") {
      const order = Number(state.queueOrder || 0);
      if (this.queueByOrder.get(order) === socket) this.queueByOrder.delete(order);
    }
    if (state.clientId && this.socketByClientId.get(state.clientId) === socket) {
      this.socketByClientId.delete(state.clientId);
    }

    if (tracked) {
      state.status = "expired";
      try { socket.serializeAttachment(state); } catch { /* socket may already be gone */ }
    }
    return { wasActive: tracked === "active", wasQueued: tracked === "queued" };
  }

  queuePositionFor(socket) {
    let position = 0;
    for (const queuedSocket of this.queueByOrder.values()) {
      position += 1;
      if (queuedSocket === socket) return position;
    }
    return Math.max(1, this.queuedCount);
  }

  async fetch(request) {
    this.ensureIndex();

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

    let previous = null;
    const existing = this.socketByClientId.get(clientId);
    if (existing && existing.readyState === WS_OPEN) {
      const oldState = this.attachment(existing);
      if (["active", "queued"].includes(oldState.status)) {
        previous = { ...oldState };
        // Transfer the existing slot/ticket to the reconnecting socket. Do not
        // decrement/re-increment the counts; the replacement is one session.
        existing.serializeAttachment({ ...oldState, status: "replaced" });
        this.trackedStatus.delete(existing);
        try { existing.close(4001, "Reconnected from same browser tab"); } catch { /* already closing */ }
      } else {
        this.socketByClientId.delete(clientId);
      }
    } else if (existing) {
      this.removeTrackedSocket(existing);
    }

    // If there is an unused slot, promote the oldest queued session before admitting
    // a brand-new visitor. The common full-capacity join path remains O(1).
    if (!previous && this.activeCount < this.maxActive && this.queuedCount > 0) {
      this.promoteWaiting();
    }

    const canKeepPreviousSeat = previous?.status === "active";
    const status = canKeepPreviousSeat
      ? "active"
      : previous?.status === "queued"
        ? "queued"
        : (this.activeCount < this.maxActive && this.queuedCount === 0 ? "active" : "queued");

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

    this.socketByClientId.set(clientId, server);
    this.trackedStatus.set(server, status);
    if (!previous) {
      if (status === "active") this.activeCount += 1;
      else this.queuedCount += 1;
    }
    if (status === "queued") this.queueByOrder.set(queueOrder, server);

    // Rare reconnect case: the queue may have a free active slot while preserving
    // the client's old ticket. The queue index chooses the earliest ticket.
    if (status === "queued" && this.activeCount < this.maxActive) this.promoteWaiting();

    const finalState = this.attachment(server);
    // A brand-new queued visitor joins at the tail, so its position is the
    // current queue count. Only a reconnect needs an ordered lookup.
    const queuedPosition = previous?.status === "queued"
      ? this.queuePositionFor(server)
      : this.queuedCount;
    if (finalState.status === "active") {
      if (status !== "queued") {
        sendJSON(server, {
          type: "admitted",
          activeCount: this.activeCount,
          maxActive: this.maxActive,
          heartbeatMs: this.heartbeatMs,
        });
      }
      // If it began queued and was promoted, promoteWaiting() already sent `admitted`.
    } else {
      sendJSON(server, {
        type: "queued",
        queuePosition: queuedPosition,
        queueSize: this.queuedCount,
        activeCount: this.activeCount,
        maxActive: this.maxActive,
        heartbeatMs: this.heartbeatMs,
      });
    }

    await this.ensureAlarm();
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(socket, message) {
    this.ensureIndex();
    const state = this.attachment(socket);
    const tracked = this.trackedStatus.get(socket);
    if (!state.clientId || !["active", "queued"].includes(state.status) || !tracked) {
      try { socket.close(4001, "Session replaced or expired"); } catch { /* no-op */ }
      return;
    }

    if (typeof message !== "string" || message.length > 256) return;
    let incoming;
    try { incoming = JSON.parse(message); } catch { return; }
    if (incoming?.type !== "ping") return;

    state.lastSeen = Date.now();
    socket.serializeAttachment(state);
    sendJSON(socket, {
      type: "pong",
      status: state.status,
      activeCount: this.activeCount,
      maxActive: this.maxActive,
      queueSize: this.queuedCount,
      heartbeatMs: this.heartbeatMs,
    });
  }

  webSocketClose(socket, code, reason, wasClean) {
    this.ensureIndex();
    const state = this.attachment(socket);
    const tracked = this.trackedStatus.get(socket);
    const now = Date.now();
    const joinedAt = Number(state.joinedAt || 0);
    const lastSeen = Number(state.lastSeen || 0);

    // Log abnormal closes and stale-session closes, but skip normal planned close
    // and same-client reconnects to avoid flooding logs during load tests.
    if (!wasClean || ![1000, 4001].includes(Number(code))) {
      console.warn("WS_CLOSE_DIAGNOSTIC", JSON.stringify({
        clientId: String(state.clientId || "").slice(0, 80),
        code: Number(code),
        reason: String(reason || "").slice(0, 160),
        wasClean: Boolean(wasClean),
        status: String(tracked || state.status || "unknown"),
        ageMs: joinedAt > 0 ? Math.max(0, now - joinedAt) : null,
        lastSeenAgeMs: lastSeen > 0 ? Math.max(0, now - lastSeen) : null,
        activeCount: this.activeCount,
        queuedCount: this.queuedCount,
      }));
    }

    const released = this.removeTrackedSocket(socket);
    if (released.wasActive || this.activeCount < this.maxActive) this.promoteWaiting();
  }

  webSocketError(socket, error) {
    this.ensureIndex();
    const state = this.attachment(socket);
    const tracked = this.trackedStatus.get(socket);
    const now = Date.now();
    const joinedAt = Number(state.joinedAt || 0);
    const lastSeen = Number(state.lastSeen || 0);
    const detail = error && typeof error.message === "string"
      ? error.message
      : String(error ?? "unknown websocket error");

    console.error("WS_ERROR_DIAGNOSTIC", JSON.stringify({
      clientId: String(state.clientId || "").slice(0, 80),
      detail: detail.slice(0, 200),
      status: String(tracked || state.status || "unknown"),
      ageMs: joinedAt > 0 ? Math.max(0, now - joinedAt) : null,
      lastSeenAgeMs: lastSeen > 0 ? Math.max(0, now - lastSeen) : null,
      activeCount: this.activeCount,
      queuedCount: this.queuedCount,
    }));

    const released = this.removeTrackedSocket(socket);
    try { socket.close(1011, "Capacity connection error"); } catch { /* no-op */ }
    if (released.wasActive || this.activeCount < this.maxActive) this.promoteWaiting();
  }

  promoteWaiting() {
    this.ensureIndex();
    while (this.activeCount < this.maxActive && this.queueByOrder.size > 0) {
      const first = this.queueByOrder.entries().next().value;
      if (!first) break;
      const [order, socket] = first;
      this.queueByOrder.delete(order);

      if (!socket || socket.readyState !== WS_OPEN) {
        const tracked = socket ? this.trackedStatus.get(socket) : null;
        if (tracked === "queued") {
          this.queuedCount = Math.max(0, this.queuedCount - 1);
          this.trackedStatus.delete(socket);
          const deadState = this.attachment(socket);
          if (deadState.clientId && this.socketByClientId.get(deadState.clientId) === socket) {
            this.socketByClientId.delete(deadState.clientId);
          }
        }
        continue;
      }

      const state = this.attachment(socket);
      if (state.status !== "queued" || this.trackedStatus.get(socket) !== "queued") continue;

      state.status = "active";
      state.lastSeen = Date.now();
      socket.serializeAttachment(state);
      this.queuedCount = Math.max(0, this.queuedCount - 1);
      this.activeCount += 1;
      this.trackedStatus.set(socket, "active");

      if (!sendJSON(socket, {
        type: "admitted",
        activeCount: this.activeCount,
        maxActive: this.maxActive,
        heartbeatMs: this.heartbeatMs,
        promoted: true,
      })) {
        this.activeCount = Math.max(0, this.activeCount - 1);
        this.trackedStatus.delete(socket);
        state.status = "expired";
        socket.serializeAttachment(state);
        if (state.clientId && this.socketByClientId.get(state.clientId) === socket) {
          this.socketByClientId.delete(state.clientId);
        }
        try { socket.close(1011, "Could not deliver admission"); } catch { /* no-op */ }
      }
    }
  }

  async alarm() {
    this.ensureIndex();
    const now = Date.now();
    for (const socket of this.ctx.getWebSockets()) {
      if (!socket || socket.readyState !== WS_OPEN) continue;
      const state = this.attachment(socket);
      if (!state.lastSeen || now - Number(state.lastSeen) > this.staleMs) {
        this.removeTrackedSocket(socket);
        state.status = "expired";
        try { socket.serializeAttachment(state); } catch { /* no-op */ }
        try { socket.close(4008, "Session heartbeat expired"); } catch { /* no-op */ }
      }
    }

    this.promoteWaiting();
    if (this.activeCount + this.queuedCount > 0) {
      await this.ctx.storage.setAlarm(Date.now() + this.alarmMs);
    }
  }
}
