# Mimari ve Topoloji Dokümantasyonu (Architecture & Topology)

Bu doküman, sistemin backend ve frontend katmanlarındaki sınırları, izolasyon mekanizmalarını ve veri akış kurallarını açıklar. Geliştirme süreçlerinde bu kurallara kesinlikle sadık kalınacaktır.

## 1. Katman ve İzolasyon Sınırları (Backend)

Backend mimarisi Go dilinde **Clean Architecture** prensipleri üzerine inşa edilmiştir.

*   **Veri Akışı:** `Handler -> Service -> Repository` şeklindedir.
    *   **Handler:** Gelen HTTP/REST isteklerini karşılar, input doğrulamasını yapar ve servis katmanını çağırır.
    *   **Service:** İş mantığını (business logic) barındırır.
    *   **Repository:** Veritabanı ve Redis ile doğrudan iletişim kuran tek katmandır.
*   **Multi-Tenant İzolasyonu:** `backend/internal/middleware/tenant.go` üzerinden her isteğe kiracı (tenant) bağlamı (context) eklenir. Kiracılar arası veri sızıntısı kesinlikle yasaktır.
*   **Veri Güvenliği (RLS):** Supabase (PostgreSQL) üzerinde Row-Level Security (RLS) politikaları tanımlıdır. Bu politikalar veritabanı seviyesinde her kiracının yalnızca kendi verisine erişmesini zorunlu kılar.
*   **Bağımlılık Enjeksiyonu:** PostgreSQL ve Redis bağlantı havuzları (`postgres.go`, `redis.go`), doğrudan değil bağımlılık enjeksiyonu prensibi ile servis ve repository katmanlarına geçirilir.

## 2. Frontend ve İstemci Mantığı (Frontend & Client-Side Logic)

Frontend mimarisi **React + Vite + TypeScript** ile geliştirilmiş olup Service Pattern kullanılarak modülerleştirilmiştir.

*   **Service Pattern:** `src/services/` altında API istekleri ve veri dönüşümleri kapsüllenmiştir. UI bileşenleri API'yi doğrudan çağırmaz.
*   **Offline-First & İdempotent Senkronizasyon:** `SyncService.ts` üzerinden yürütülen sistemde, ağ bağlantısı olmadığında veriler yerelde (IndexedDB/Local) saklanır. Ağ geri geldiğinde senkronizasyon **idempotent** kurallarla (aynı işlemin birden fazla kez tekrarlanması durumunda bile sonucun değişmemesi) arka uca iletilir (Redis destekli).
*   **Hata Sınırları:** UI çökmelerini önlemek için `ErrorBoundary.tsx` kullanılarak izole edilen hata yakalama sınırları mevcuttur.
*   **Durum Yönetimi (State Management):** Merkezi durum yönetimi için Context API (`AuthContext`, `MasterDataContext`) kullanılmaktadır.
*   **Çoklu Dil (i18n):** Uygulamanın dil tercihleri `src/locales/` altındaki JSON dosyaları aracılığıyla yönetilmekte olup iş mantığından ayrıştırılmıştır.

## 3. Geliştirme ve Agent Sözleşmesi

Bu dokümandaki sınırlar bir referans olup:
*   SOLID prensipleri korunacaktır.
*   "Spagetti" koda izin verilmeyecektir.
*   RLS güvenliği baypas edilemez.
*   İdempotent çalışma yapısı bozulamayacaktır.
