import http from 'k6/http';
import { check, sleep } from 'k6';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

/**
 * CI Smoke Test
 * Hafif bir test: 2 VU, 10 saniye. GitHub Actions'ta sunucunun ayağa kalktığını doğrular.
 */

export const options = {
  vus: 2,
  duration: '10s',
  thresholds: {
    'http_req_duration': ['p(95)<500'],
    'http_req_failed': ['rate<0.10'], // CI ortamında %10'a kadar hata toleransı
  },
};

const BASE_URL = 'http://127.0.0.1:3001/api/v1/sync/batch';

export default function () {
  const payload = JSON.stringify({
    items: [
      {
        table: 'sales',
        action: 'INSERT',
        request_id: uuidv4(),
        payload: {
          id: uuidv4(),
          shop_id: '550e8400-e29b-41d4-a716-446655440000',
          total_amount: Math.floor(Math.random() * 5000) + 100,
          discount_amount: 0,
          status: 'completed',
          created_at: new Date().toISOString(),
          version: 1
        }
      },
      {
        table: 'stock_movements',
        action: 'INSERT',
        request_id: uuidv4(),
        payload: {
          id: uuidv4(),
          shop_id: '550e8400-e29b-41d4-a716-446655440000',
          variant_id: uuidv4(),
          quantity: Math.floor(Math.random() * 10) + 1,
          type: 'OUT',
          reason: 'Sale',
          created_at: new Date().toISOString(),
          version: 1
        }
      }
    ]
  });

  const params = {
    headers: { 'Content-Type': 'application/json' },
  };

  const res = http.post(BASE_URL, payload, params);

  check(res, {
    'status is 200 or 202': (r) => r.status === 200 || r.status === 202,
  });

  sleep(0.1);
}
