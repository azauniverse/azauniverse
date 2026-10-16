import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const WS_URL = (__ENV.WS_URL || 'wss://aza-universe-capacity-loadtest.azataycan2002.workers.dev/ws').replace(/\/+$/, '');
const ORIGIN = __ENV.ORIGIN || 'https://azauniverse.github.io';
const TARGET = Math.max(1, Number.parseInt(__ENV.TARGET_CONNECTIONS || '3000', 10));
const RAMP_SECONDS = Math.max(30, Number.parseInt(__ENV.RAMP_SECONDS || '240', 10));
const HOLD_SECONDS = Math.max(30, Number.parseInt(__ENV.HOLD_SECONDS || '120', 10));
const END_GRACE_SECONDS = 10;
const AGGREGATE_ERRORS = __ENV.AGGREGATE_ERRORS === 'true';

const wsHandshakeOk = new Rate('ws_handshake_ok');
const wsInitialStateOk = new Rate('ws_initial_state_ok');
const wsInitialStateMs = new Trend('ws_initial_state_ms', true);
const wsHandshakeMs = new Trend('ws_handshake_ms', true);
const wsHandshakeStatus = new Counter('ws_handshake_status');
const wsErrorRate = new Rate('ws_error_rate');
const wsEarlyCloseRate = new Rate('ws_early_close_rate');
const wsErrors = new Counter('ws_unexpected_errors');
const wsEarlyCloses = new Counter('ws_early_closes');
const wsAdmitted = new Counter('ws_admitted');
const wsQueued = new Counter('ws_queued');
const wsPongs = new Counter('ws_pongs');
const wsPongLatency = new Trend('ws_pong_latency_ms', true);

const thresholds = {
  ws_handshake_ok: ['rate>0.99'],
  ws_initial_state_ok: ['rate>0.99'],
  ws_initial_state_ms: ['p(95)<8000'],
  ws_admitted: [`count>=${TARGET}`],
  ws_queued: ['count==0'],
};

if (!AGGREGATE_ERRORS) {
  thresholds.ws_error_rate = ['rate<0.005'];
  thresholds.ws_early_close_rate = ['rate<0.005'];
}

export const options = {
  scenarios: {
    websocket_diagnostic: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: `${RAMP_SECONDS}s`, target: TARGET },
        { duration: `${HOLD_SECONDS}s`, target: TARGET },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds,
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'max'],
};

export function setup() {
  return {
    testEndMs: Date.now() + (RAMP_SECONDS + HOLD_SECONDS + END_GRACE_SECONDS) * 1000,
  };
}

// Each VU makes one socket attempt. If it ends unexpectedly, park the VU rather
// than repeatedly making new connections and distorting the load profile.
let thisVuStarted = false;

export default function (data) {
  if (thisVuStarted) {
    sleep(30);
    return;
  }
  thisVuStarted = true;

  const clientId = `aza_stage_${__VU}_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
  let openedAt = 0;
  let gotInitialState = false;
  let initialWasAdmitted = false;
  let hadUnexpectedError = false;
  let endedEarly = false;
  let intentionalTimeout = false;
  let lastPingAt = 0;

  const response = ws.connect(`${WS_URL}?clientId=${encodeURIComponent(clientId)}`, {
    headers: {
      Origin: ORIGIN,
      'Cache-Control': 'no-cache',
    },
    tags: { suite: 'ws-staged-diagnostic-detailed-v1', target: String(TARGET) },
    timeout: '30s',
  }, (socket) => {
    socket.on('open', () => {
      openedAt = Date.now();
    });

    socket.on('message', (message) => {
      let payload;
      try { payload = JSON.parse(String(message)); } catch (_) { return; }

      if (!gotInitialState && (payload.type === 'admitted' || payload.type === 'queued')) {
        gotInitialState = true;
        initialWasAdmitted = payload.type === 'admitted';
        wsInitialStateMs.add(openedAt ? Date.now() - openedAt : 0);
        if (initialWasAdmitted) wsAdmitted.add(1);
        else wsQueued.add(1);
      }

      if (payload.type === 'pong') {
        wsPongs.add(1);
        if (lastPingAt > 0) {
          wsPongLatency.add(Date.now() - lastPingAt);
          lastPingAt = 0;
        }
      }
    });

    socket.on('error', (event) => {
      let detail = 'unknown websocket error';
      try {
        if (event && typeof event.error === 'function') detail = String(event.error());
        else if (event && event.error) detail = String(event.error);
      } catch (_) { /* retain safe generic detail */ }

      if (detail === 'websocket: close sent' || intentionalTimeout) return;

      hadUnexpectedError = true;
      wsErrors.add(1);
      const ageMs = openedAt ? Date.now() - openedAt : -1;
      console.error(`WS_DIAGNOSTIC_ERROR vu=${__VU} clientId=${clientId} ageMs=${ageMs} detail=${detail.slice(0, 240)}`);
    });

    socket.on('close', () => {
      if (Date.now() < data.testEndMs - 3000 && !intentionalTimeout) {
        endedEarly = true;
        wsEarlyCloses.add(1);
        const ageMs = openedAt ? Date.now() - openedAt : -1;
        console.error(`WS_DIAGNOSTIC_EARLY_CLOSE vu=${__VU} clientId=${clientId} ageMs=${ageMs}`);
      }
    });

    socket.setInterval(() => {
      try {
        lastPingAt = Date.now();
        socket.send(JSON.stringify({ type: 'ping', at: lastPingAt }));
      } catch (_) {
        // Error and close handlers record the connection failure.
      }
    }, 30000);

    socket.setTimeout(() => {
      intentionalTimeout = true;
      try { socket.close(1000); } catch (_) { /* already closing */ }
    }, Math.max(1000, data.testEndMs - Date.now()));
  });

  const handshakeOk = !!response && response.status === 101;
  const statusCode = response && typeof response.status === 'number' ? response.status : 0;
  const responseError = response && response.error ? String(response.error) : 'none';
  const errorCode = response && response.error_code !== undefined ? String(response.error_code) : 'none';
  const durationMs = response && response.timings && typeof response.timings.duration === 'number'
    ? Math.round(response.timings.duration)
    : -1;
  const responseBody = response && response.body
    ? String(response.body).replace(/\s+/g, ' ').slice(0, 160)
    : '';

  wsHandshakeStatus.add(1, { status: String(statusCode) });
  if (durationMs >= 0) wsHandshakeMs.add(durationMs);
  if (!handshakeOk) {
    console.error(`WS_DIAGNOSTIC_HANDSHAKE_FAILED vu=${__VU} clientId=${clientId} status=${statusCode} errorCode=${errorCode} error=${responseError.slice(0, 160)} durationMs=${durationMs} body=${responseBody}`);
  }

  wsHandshakeOk.add(handshakeOk);
  wsInitialStateOk.add(gotInitialState);
  wsErrorRate.add(hadUnexpectedError);
  wsEarlyCloseRate.add(endedEarly);

  check(response, {
    'WebSocket upgrade returns HTTP 101': () => handshakeOk,
    'Worker sends admitted state': () => gotInitialState && initialWasAdmitted,
  });
}
