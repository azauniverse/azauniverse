import ws from 'k6/ws';
import { check } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const WS_URL = (__ENV.WS_URL || 'wss://aza-universe-capacity-loadtest.azataycan2002.workers.dev/ws').replace(/\/+$/, '');
const ORIGIN = __ENV.ORIGIN || 'https://azauniverse.github.io';
const TARGET = Math.max(1, Number.parseInt(__ENV.TARGET_CONNECTIONS || '1000', 10));
const RAMP_SECONDS = Math.max(30, Number.parseInt(__ENV.RAMP_SECONDS || '120', 10));
const HOLD_SECONDS = Math.max(30, Number.parseInt(__ENV.HOLD_SECONDS || '60', 10));
const END_GRACE_SECONDS = 10;

const wsHandshakeOk = new Rate('ws_handshake_ok');
const wsInitialStateOk = new Rate('ws_initial_state_ok');
const wsInitialStateMs = new Trend('ws_initial_state_ms', true);
const wsErrorRate = new Rate('ws_error_rate');
const wsEarlyCloseRate = new Rate('ws_early_close_rate');
const wsErrors = new Counter('ws_unexpected_errors');
const wsEarlyCloses = new Counter('ws_early_closes');
const wsAdmitted = new Counter('ws_admitted');
const wsQueued = new Counter('ws_queued');

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
  thresholds: {
    ws_handshake_ok: ['rate>0.99'],
    ws_initial_state_ok: ['rate>0.99'],
    ws_initial_state_ms: ['p(95)<8000'],
    // Count early closes and socket errors as a percentage of total sessions.
    // A run can be green only if each stays below 0.5%.
    ws_error_rate: ['rate<0.005'],
    ws_early_close_rate: ['rate<0.005'],
    ws_admitted: [`count>=${TARGET}`],
    ws_queued: ['count==0'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'max'],
};

export function setup() {
  return {
    testEndMs: Date.now() + (RAMP_SECONDS + HOLD_SECONDS + END_GRACE_SECONDS) * 1000,
  };
}

// k6 VUs have isolated JavaScript runtimes. Each VU creates exactly one WebSocket
// and remains alive until its planned close; follow-on iterations do not reconnect.
let thisVuStarted = false;

export default function (data) {
  if (thisVuStarted) return;
  thisVuStarted = true;

  const clientId = `aza_stage_${__VU}_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
  let openedAt = 0;
  let gotInitialState = false;
  let initialWasAdmitted = false;
  let hadUnexpectedError = false;
  let endedEarly = false;
  let intentionalTimeout = false;

  const response = ws.connect(`${WS_URL}?clientId=${encodeURIComponent(clientId)}`, {
    headers: {
      Origin: ORIGIN,
      'Cache-Control': 'no-cache',
    },
    tags: { suite: 'ws-staged-diagnostic', target: String(TARGET) },
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
    });

    socket.on('error', (event) => {
      let detail = 'unknown websocket error';
      try {
        if (event && typeof event.error === 'function') detail = String(event.error());
        else if (event && event.error) detail = String(event.error);
      } catch (_) { /* keep generic detail */ }

      if (detail === 'websocket: close sent' || intentionalTimeout) return;

      hadUnexpectedError = true;
      wsErrors.add(1);
      console.error(`WS_DIAGNOSTIC_ERROR vu=${__VU} detail=${detail.slice(0, 240)}`);
    });

    socket.on('close', () => {
      if (Date.now() < data.testEndMs - 3000 && !intentionalTimeout) {
        endedEarly = true;
        wsEarlyCloses.add(1);
        const ageMs = openedAt ? Date.now() - openedAt : -1;
        console.error(`WS_DIAGNOSTIC_EARLY_CLOSE vu=${__VU} ageMs=${ageMs}`);
      }
    });

    socket.setInterval(() => {
      try { socket.send(JSON.stringify({ type: 'ping', at: Date.now() })); }
      catch (_) { /* close/error handlers will count failures */ }
    }, 60000);

    socket.setTimeout(() => {
      intentionalTimeout = true;
      try { socket.close(1000); } catch (_) {}
    }, Math.max(1000, data.testEndMs - Date.now()));
  });

  const handshakeOk = !!response && response.status === 101;
  wsHandshakeOk.add(handshakeOk);
  wsInitialStateOk.add(gotInitialState);
  wsErrorRate.add(hadUnexpectedError);
  wsEarlyCloseRate.add(endedEarly);

  check(response, {
    'WebSocket upgrade returns HTTP 101': () => handshakeOk,
    'Worker sends admitted state': () => gotInitialState && initialWasAdmitted,
  });
}
