import http from 'k6/http'
import { check, sleep } from 'k6'

/**
 * k6 Load Test: Dashboard-Endpunkte
 *
 * Profil:
 *   - Hochfahren auf 20 Benutzer ueber 1 Minute
 *   - 3 Minuten halten
 *   - Spike auf 50 Benutzer fuer 1 Minute
 *   - 2 Minuten halten
 *   - Herunterfahren auf 0 ueber 1 Minute
 *
 * Schwellenwerte:
 *   - p(95) < 2000ms
 *   - Fehlerrate < 1%
 */

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'

export const options = {
  stages: [
    { duration: '1m', target: 20 },
    { duration: '3m', target: 20 },
    { duration: '1m', target: 50 },
    { duration: '2m', target: 50 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.01'],
  },
}

export default function () {
  const dashboardRes = http.get(`${BASE_URL}/dashboard`, {
    headers: { Accept: 'text/html' },
  })
  check(dashboardRes, {
    'dashboard status 200 oder redirect': (r) =>
      r.status === 200 || r.status === 302,
    'dashboard antwortzeit < 2s': (r) => r.timings.duration < 2000,
  })

  const apiRes = http.get(`${BASE_URL}/api/health`, {
    headers: { Accept: 'application/json' },
  })
  check(apiRes, {
    'health status 200': (r) => r.status === 200,
    'health antwortzeit < 500ms': (r) => r.timings.duration < 500,
  })

  sleep(Math.random() * 2 + 1)
}
