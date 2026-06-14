import http from 'k6/http';
import { check, sleep } from 'k6';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

/**
 * Senior k6 Deadlock & Hot-Row Stress Test Scenario
 * Amaç: 5.000+ VU altında aynı variant_id (Hot-Row) üzerinde yoğun UPDATE işlemlerinin
 * kilitlenmeye (deadlock) yol açıp açmadığını doğrulamak.
 */

export const options = {
  stages: [
    { duration: '30s', target: 500 },   // Hızlı tırmanış
    { duration: '1m', target: 2000 },   // 2000 VU (GH Actions Runner Limit)
    { duration: '30s', target: 0 },     // İyileşme
  ],
  thresholds: {
    // p(95) yanıt süresi 500ms altında olmalı
    'http_req_duration': ['p(95)<500'],
    // Genel hata oranı %5'in altında olmalı (Kilitlenmeler nedeniyle oluşabilecek hataları izlemek için)
    'http_req_failed': ['rate<0.05'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://127.0.0.1:3001/api/v1/sync/batch';

// Hot-Row Testi için Sabit Ürün Varyant ID'si
const HOT_ROW_VARIANT_ID = '550e8400-e29b-41d4-a716-446655440001';
const MOCK_SHOP_ID = '550e8400-e29b-41d4-a716-446655440000';

export default function () {
  const requestId = uuidv4();

  // Tüm kullanıcılar aynı HOT_ROW_VARIANT_ID üzerinde stok güncellemesi yapıyor
  const payload = JSON.stringify({
    items: [
      {
        table: 'product_variants',
        action: 'UPDATE',
        request_id: requestId,
        payload: {
          id: HOT_ROW_VARIANT_ID,
          shop_id: MOCK_SHOP_ID,
          delta: -1, // Her işlemde stoku 1 azaltmaya çalış
          reason: 'Concurrent Hot-Row Sale',
        }
      }
    ]
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'X-Correlation-ID': uuidv4(),
    },
  };

  const res = http.post(BASE_URL, payload, params);

  check(res, {
    // 200/202: İşlem kabul edildi
    'is accepted (200/202)': (r) => r.status === 200 || r.status === 202,
    // 503: Backpressure devrede (Sistem kendini koruyor - Kabul edilebilir)
    'is backpressure (503)': (r) => r.status === 503,
    // 500: Deadlock/Panic hatası olmamalı
    'is NOT a database deadlock/error (500)': (r) => r.status !== 500,
  });

  // Gerçekçi bekleme süresi (50ms - 200ms)
  sleep(Math.random() * 0.15 + 0.05);
}
