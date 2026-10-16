import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const BASE_URL = (__ENV.BASE_URL || 'https://azauniverse.github.io/azauniverse').replace(/\/+$/, '');
const WS_URL = (__ENV.WS_URL || 'wss://aza-universe-capacity-loadtest.azataycan2002.workers.dev/ws').replace(/\/+$/, '');
const ORIGIN = __ENV.ORIGIN || 'https://azauniverse.github.io';
const TARGET = Math.max(1, Number.parseInt(__ENV.TARGET_CONNECTIONS || '100', 10));
const RAMP_SECONDS = Math.max(10, Number.parseInt(__ENV.RAMP_SECONDS || '30', 10));
const HOLD_SECONDS = Math.max(10, Number.parseInt(__ENV.HOLD_SECONDS || '30', 10));
const RAMP_DOWN_SECONDS = 30;

const admittedConnections = new Counter('ws_admitted');
const queuedConnections = new Counter('ws_queued');
const wsErrors = new Counter('ws_errors');
const assetFailures = new Counter('static_asset_failures');
const admissionRate = new Rate('ws_admission_rate');
const queueRate = new Rate('ws_queue_rate');
const earlyCloseRate = new Rate('ws_early_close_rate');
const assetsOkRate = new Rate('static_assets_ok');
const initialStateLatency = new Trend('ws_initial_state_ms', true);

export const options = {
  scenarios: {
    capacity_ramp: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: `${RAMP_SECONDS}s`, target: TARGET },
        { duration: `${HOLD_SECONDS}s`, target: TARGET },
        { duration: `${RAMP_DOWN_SECONDS}s`, target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    checks: ['rate>0.99'],
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<5000'],
    static_assets_ok: ['rate>0.99'],
    ws_admitted: [`count>=${TARGET}`],
    ws_admission_rate: ['rate>0.99'],
    ws_queue_rate: ['rate<0.001'],
    ws_early_close_rate: ['rate<0.001'],
    ws_initial_state_ms: ['p(95)<8000'],
    ws_errors: ['count==0'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'max'],
};

export function setup() {
  // A single shared close time ensures early connections remain open while
  // later VUs arrive, so the target number is genuinely concurrent.
  const testEndMs = Date.now() + (RAMP_SECONDS + HOLD_SECONDS + 10) * 1000;
  return { testEndMs };
}

// A VU opens one connection only. This prevents ramp-down from creating new
// connections after the intended target run has ended.
let connectionStartedForThisVU = false;

export default function (data) {
  if (connectionStartedForThisVU) {
    sleep(1);
    return;
  }
  connectionStartedForThisVU = true;

  const assets = [
    { name: 'homepage', path: '/' },
    { name: 'styles', path: '/styles.css' },
    { name: 'app-js', path: '/app.js' },
    { name: 'capacity-loader', path: '/aza-capacity-gate-loader.js?v=1' },
    { name: 'capacity-js', path: '/aza-capacity-gate.js?v=1' },
    { name: 'capacity-css', path: '/aza-capacity-gate.css?v=1' },
    { name: 'question-manifest', path: '/question-bank/manifest.json' },
  ];

  const responses = http.batch(assets.map((asset) => ({
    method: 'GET',
    url: `${BASE_URL}${asset.path}`,
    params: {
      timeout: '20s',
      tags: { suite: 'capacity-load-test', asset: asset.name },
    },
  })));

  let allAssetsOk = responses.length === assets.length;
  responses.forEach((response, index) => {
    const isOk = response && response.status === 200;
    if (!isOk) {
      assetFailures.add(1, { asset: assets[index].name });
      allAssetsOk = false;
    }
    check(response, {
      [`${assets[index].name}: HTTP 200`]: (r) => !!r && r.status === 200,
    });
  });
  assetsOkRate.add(allAssetsOk);

  const clientId = `aza_load_${__VU}_${__ITER}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  let openedAt = 0;
  let initialState = '';
  let gotInitialState = false;
  let sawEarlyClose = false;

  const response = ws.connect(`${WS_URL}?clientId=${encodeURIComponent(clientId)}`, {
    headers: {
      Origin: ORIGIN,
      'Cache-Control': 'no-cache',
    },
    tags: { suite: 'capacity-load-test', target: String(TARGET) },
    timeout: '30s',
  }, (socket) => {
    socket.on('open', () => {
      openedAt = Date.now();
    });

    socket.on('message', (message) => {
      let payload;
      try { payload = JSON.parse(String(message)); } catch (_) { return; }

      if ((payload.type === 'admitted' || payload.type === 'queued') && !gotInitialState) {
        gotInitialState = true;
        initialState = payload.type;
        initialStateLatency.add(openedAt ? Date.now() - openedAt : 0);
        if (initialState === 'admitted') admittedConnections.add(1);
        else queuedConnections.add(1);
      }
      // Match the Worker app-level heartbeat protocol while sockets are held open.
      if (payload.type === 'pong' && payload.status === 'queued') {
        initialState = 'queued';
      }
    });

    socket.on('error', () => {
      wsErrors.add(1);
    });

    socket.on('close', () => {
      sawEarlyClose = Date.now() < data.testEndMs - 3000;
      earlyCloseRate.add(sawEarlyClose);
    });

    socket.setInterval(() => {
      try {
        socket.send(JSON.stringify({ type: 'ping', at: Date.now() }));
      } catch (_) {
        // The close/error handlers capture connection failures.
      }
    }, 60000);

    socket.setTimeout(() => {
      try { socket.close(); } catch (_) {}
    }, Math.max(1000, data.testEndMs - Date.now()));
  });

  const handshakeOk = !!response && response.status === 101;
  const admittedOk = gotInitialState && initialState === 'admitted';
  admissionRate.add(admittedOk);

  check(response, {
    'WebSocket upgrade returns HTTP 101': () => handshakeOk,
    'Worker grants an active slot': () => admittedOk,
  });
}
