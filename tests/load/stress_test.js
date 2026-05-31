import http from 'k6/http';
import { check, sleep } from 'k6';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

/**
 * Senior k6 Load Test Scenario
 * Amaç: 5.000+ VU altında Backpressure (503) ve DLQ mekanizmasını doğrulamak.
 */

export const options = {
  stages: [
    { duration: '1m', target: 500 },  // Ramp-up: 0'dan 500 VU'ya
    { duration: '3m', target: 1000 }, // Load Test: 1.000 VU sabit yük
    { duration: '2m', target: 5000 }, // Stress Test: Sistemi kırmaya çalış (5.000 VU)
    { duration: '1m', target: 0 },    // Recovery: Yükü sıfırla
  ],
  thresholds: {
    // p(95) yanıt süresi 300ms altında olmalı
    'http_req_duration': ['p(95)<300'],
    // Genel hata oranı %2'nin altında olmalı (Özel kontrol aşağıda)
    'http_req_failed': ['rate<0.02'],
  },
};

const BASE_URL = 'http://localhost:3001/api/v1/sync/batch';

export default function () {
  const requestId = uuidv4();
  
  // Idempotency Testi: %2 ihtimalle sabit bir request_id gönder
  const isDuplicate = Math.random() < 0.02;
  const finalRequestId = isDuplicate ? 'stress-test-duplicate-id' : requestId;

  const payload = JSON.stringify({
    items: [
      {
        table: 'sales',
        action: 'INSERT',
        request_id: finalRequestId,
        payload: {
          id: uuidv4(),
          shop_id: '550e8400-e29b-41d4-a716-446655440000', // Örnek shop_id
          total_amount: Math.floor(Math.random() * 5000) + 100,
          status: 'completed',
          created_at: new Date().toISOString(),
          version: 1
        }
      },
      {
        table: 'stock_movements',
        action: 'INSERT',
        request_id: uuidv4(), // Hareketler için yeni ID
        payload: {
          id: uuidv4(),
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
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(BASE_URL, payload, params);

  // Senior Kontrol Mantığı
  check(res, {
    // 200/202: İşlem kabul edildi
    'is accepted (200/202)': (r) => r.status === 200 || r.status === 202,
    // 503: Backpressure devrede (Sistem kendini koruyor - Başarı!)
    'is backpressure (503)': (r) => r.status === 503,
    // 500: Kritik hata (Panik, DB çökmesi vb. - HATA!)
    'is NOT a critical 500': (r) => r.status !== 500,
  });

  // Gerçekçi bekleme süresi (100ms - 600ms)
  sleep(Math.random() * 0.5 + 0.1);
}
