# Proje: Stok Takip Otomasyonu v2.0 - Görev Listesi

## 🏗️ 1. Mimari ve Veri Güvenliği (Resilience)
- [x] **Client-Side Persistence:** Dexie.js entegrasyonu ile "Offline-First" yapısının kurulması. [x]
- [x] **Conflict Resolution:** Versiyon tabanlı (Sequence IDs) veri senkronizasyonu; Optimistic Locking ve "Hybrid Logical Clocks" yaklaşımı. [x]
- [x] **Idempotency Strategy:** Her işlem için benzersiz bir `request_id` (UUID) kullanılarak mükerrer kayıtların önlenmesi. [x]
- [ ] **Service Pattern Enforcement:** UI'dan izole, test edilebilir ve tip güvenliği yüksek servis katmanı.
- [ ] **Circuit Breaker:** API darboğazlarında uygulamanın "fail-fast" yapması.

## 🔐 2. Güvenlik ve Veritabanı Hardening
- [ ] **Advanced RLS:** Supabase üzerinde organizasyon bazlı (Multi-tenant) erişim kontrolü.
- [ ] **Optimistic Locking:** Stok tablolarında `version` sütunu ile Race Condition kontrolü.
- [ ] **Audit Logging:** Tüm kritik hareketlerin immutable (değiştirilemez) loglanması.
- [ ] **Secret Management:** `.env` disiplini; hardcoded hiçbir anahtarın kalmaması.

## ⚡ 3. Performans ve Ölçeklenebilirlik
- [ ] **Query Optimization:** Ağır sorgular için Indexing ve `EXPLAIN ANALYZE` analizi.
- [x] **Go Middleware:** Yoğun yazma işlemlerini veritabanına gitmeden önce Go tarafında "Batching" (Toplu İşleme) ile yönetmek. [x]
- [x] **Backend Pivot (Go Migration):** /backend dizini oluşturuldu ve Fiber iskeleti kuruldu. [x]
- [x] **Go Batch API:** /api/v1/sync/batch endpoint'i ve toplu yazma mantığı (pgx.CopyFrom). [x]
- [x] **DLQ Implementation:** Hatalı paketler için failed_syncs tablosu ve Retry Worker. [x]
- [x] **Observability:** Prometheus metrik desteği ve Security Middleware. [x]
- [ ] **Database Connection:** Supabase Postgres DSN yapılandırması ve bağlantı havuzu (connection pool) optimizasyonu.

## 🌐 4. Standartlar ve i18n
- [x] **Full i18n:** Tüm metinlerin `locales/*.json` dosyalarına taşınması.
  - [x] **Layout ve Navigasyon:** (Layout, LanguageSwitcher, PageTransition)
  - [x] **Envanter ve Kategori Yönetimi:** (Inventory, ProductForm, CategoryManager)
  - [x] **Satış ve Sepet İşlemleri:** (Sales, Cart, Checkout)
  - [x] **Auth ve Dashboard:** (Login, Register, Dashboard, PasswordUpdateModal)
  - [x] **Raporlar ve Hata Katmanı:** (Reports, ErrorBoundary, pdfService)
- [ ] **UI Standartı:** `shadcn/ui` dışına çıkılmadan modüler bileşen üretimi.

## 🧪 5. Test ve Gözlemlenebilirlik
- [ ] **TDD:** Kritik logicler için Unit/Integration testleri (Vitest).
  - [x] i18n Integrity Test [x]
  - [x] Sync Worker Implementation [x]
- [x] **Automated Pipeline:** GitHub Actions CI entegrasyonu. [x]
- [x] **Load Testing:** k6 ile 50K kullanıcı (simüle) ve 600K işlem testi tamamlandı. [x]
- [ ] **Centralized Logging:** Sentry veya benzeri bir araçla hata takibi.
