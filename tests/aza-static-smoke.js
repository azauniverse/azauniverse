import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = (__ENV.BASE_URL || 'https://azauniverse.github.io/azauniverse')
  .replace(/\/+$/, '');

// Gentle, read-only static asset test. It does NOT submit chat messages,
// change points, authenticate users, or write to Supabase.
export const options = {
  scenarios: {
    gentle_static_load: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '10s', target: 1 },
        { duration: '15s', target: 3 },
        { duration: '15s', target: 5 },
        { duration: '10s', target: 0 },
      ],
      gracefulRampDown: '5s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<2500'],
    checks: ['rate>0.98'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'max'],
};

const assets = [
  { name: 'homepage', path: '/' },
  { name: 'main-css', path: '/styles.css' },
  { name: 'premium-css', path: '/home-premium-v2.css' },
  { name: 'app-js', path: '/app.js' },
  { name: 'performance-guard', path: '/aza-performance.js?v=1' },
  { name: 'founder-js', path: '/founder-showcase.js?v=2' },
  { name: 'social-js', path: '/social-hub.js?v=2' },
  { name: 'question-manifest', path: '/question-bank/manifest.json' },
];

export default function () {
  const requests = assets.map((asset) => ({
    method: 'GET',
    url: `${BASE_URL}${asset.path}`,
    params: {
      tags: { asset: asset.name, suite: 'static-smoke' },
      timeout: '15s',
    },
  }));

  const responses = http.batch(requests);
  responses.forEach((response, i) => {
    check(response, {
      [`${assets[i].name}: HTTP 200`]: (r) => r.status === 200,
    });
  });

  // Think time makes the request pattern less aggressive.
  sleep(1);
}
