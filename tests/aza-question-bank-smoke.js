import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = (__ENV.BASE_URL || 'https://azauniverse.github.io/azauniverse')
  .replace(/\/+$/, '');

// Low-concurrency test of the largest currently tracked category JSON.
// Run separately from static-smoke; max 2 VUs and read-only GETs only.
export const options = {
  scenarios: {
    gentle_question_bank_load: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '5s', target: 1 },
        { duration: '10s', target: 2 },
        { duration: '5s', target: 0 },
      ],
      gracefulRampDown: '3s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<5000'],
    checks: ['rate>0.98'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'max'],
};

export default function () {
  const response = http.get(`${BASE_URL}/question-bank/driving.json`, {
    tags: { asset: 'driving-question-bank', suite: 'question-bank-smoke' },
    timeout: '20s',
  });

  check(response, {
    'driving question bank: HTTP 200': (r) => r.status === 200,
    'driving question bank: JSON content type': (r) => /application\/json/i.test(r.headers['Content-Type'] || ''),
    'driving question bank: has expected category and questions': (r) => {
      try {
        const data = JSON.parse(r.body);
        return data.category === 'driving' && Array.isArray(data.questions) && data.questions.length > 0;
      } catch (_) {
        return false;
      }
    },
  });

  // Large category file: pause between reads to keep this a smoke test, not a stress test.
  sleep(2);
}
