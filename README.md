# Distributed Multi-Tenant SaaS Inventory and Sales Management System

This project demo link; https://multi-tenant-saa-s-inventory-and-sa.vercel.app/

A high-throughput, enterprise-grade, offline-first B2B SaaS platform core designed to ensure zero data loss under massive transaction loads. Built using modern system architecture patterns (Clean Architecture, SOLID, and Service Pattern) with a Backend-for-Frontend (BFF) topology to fully eliminate API and database connection bottlenecks.

## 🏗️ System Architecture & High-Level Design

Direct client-to-database architectures frequently suffer from connection exhaustion and scale bottlenecks when processing rapid, high-frequency transactions. This platform safeguards the data store using a high-performance **Go-based API Gateway (BFF)** coupled with an intelligent client-side persistence engine.

[ Frontend: React / Vite ]
│ (Internet Drops) ──> [ Local Storage: Dexie.js (sync_queue) ]
▼
[ BFF Layer: Go / Fiber ]
│ ──> [ Idempotency Verification: Redis (request_id) ]
▼
[ Bulk Insert Layer: pgx.CopyFrom ] ──> [ PostgreSQL / Supabase Pool ]
│ (On Database Lock/Timeout)
▼
[ Dead Letter Queue: failed_syncs Table ] ──> [ Async Retry Workers ]


### Key Architectural Layers:
1. **Frontend (React/TypeScript):** Implements an **Offline-First** capability[cite: 2]. When connectivity is interrupted, sales mutations are intercepted and staged inside a local IndexedDB queue (`sync_queue`) via **Dexie.js**[cite: 2].
2. **BFF Layer (Go & Fiber):** Acts as a high-throughput transaction boundary, accepting bulk sync frames directly from clients rather than single atomic REST mutations[cite: 2].
3. **Idempotency Engine (Redis):** Every mutation frame carries a unique deterministic `request_id`[cite: 2]. Network retries or duplicate client clicks are intercepted inside Redis cache windows to absolutely prevent duplicate writes or double ledger allocations[cite: 2].
4. **Database Operations (PostgreSQL & pgxpool):** Bypasses transactional loop overhead by leveraging Go’s low-level protocol driver (`pgx.CopyFrom`) to execute high-speed binary bulk insertions[cite: 2]. This processes thousands of records inside a single I/O sweep, running seamlessly even under tight connection limitations (e.g., a 25-connection pool constraint)[cite: 2].
5. **Fault Tolerance & Dead Letter Queue (DLQ):** If target database shards hit transient locks or network timeouts, the payload drops into a `failed_syncs` system table[cite: 2]. Automated async background workers pick up entries from this table and execute isolated retry sweeps until resolution[cite: 2].

## 🛠️ Tech Stack

* **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui, Dexie.js (Client-side IndexedDB persistence)[cite: 2].
* **Backend:** Go 1.25, Fiber (High-performance web framework), pgx/v5 (PostgreSQL binary-protocol driver), go-redis[cite: 2].
* **Database & Cache:** PostgreSQL (Supabase / Local Instance), Redis (Distributed caching & Idempotency manager)[cite: 2].
* **Testing & CI/CD:** Vitest (Component/Unit isolation), Playwright (E2E network-interception simulation), k6 (Distributed Load & Stress validation), GitHub Actions pipelines[cite: 2].

## 📊 Performance & Validation Benchmarks

System resilience has been thoroughly tested and validated across strict end-to-end (E2E), stress, and pipeline integration tests[cite: 2]:

### 1. High-Throughput Load Testing (k6)
* **Simulation Profile:** 5,000 Concurrent Virtual Users (VUs) sustaining continuous bulk sync events[cite: 2].
* **Throughput Volumetrics:** ~600,000 bulk synchronization requests systematically processed[cite: 2].
* **Success Metric:** **100% Success Rate** (Zero dropouts, zero 503 backpressure failures, zero packet degradation)[cite: 2].
* **Latency Envelope:** `p(95) < 200ms`[cite: 2].
* **Architectural Insight:** By leveraging Go’s multiplexed asynchronous channels and memory footprint structures, a standard 25-connection database pool safely absorbed and serialized massive transactional volume without connection exhaustion[cite: 2].

### 2. Network-Partition Resilience Testing (Playwright E2E)
* **Simulation Profile:** Artificial drop of network interface mid-transaction followed by connection re-establishment[cite: 2].
* **Result:** `1 PASSED`[cite: 2]. The client automatically intercepted failed transport signals, committed mutation frames directly to Dexie.js under a `PENDING` flag, and seamlessly drained the queue to the Go API gateway the moment the transport layers re-connected[cite: 2].

### 3. Automated Quality Gates (CI/CD Pipeline)
* **Unit Testing:** 23/23 Vitest assertions executing under strict clean isolation environments[cite: 2].
* **GitHub Actions:** Automates schema migration syntax validation, multi-stage compilation validation, and live Redis integration smoke tests on every trunk mutation[cite: 2].

## 💻 Configuration & Deployment

### 1. Prerequisites
* **Node.js** (v20 or higher)[cite: 2]
* **Go Compiler** (v1.25 or higher)[cite: 2]
* **Redis Server** (Local instance or standardized Docker container running on port `6379`)[cite: 2]
* **PostgreSQL Engine** (Supabase cloud infrastructure or local instances with replication support)[cite: 2]

### 2. Environment Variables Setup

Create a `.env` file in the respective module folders prior to boot cycles[cite: 2].

#### `/backend/.env` Configuration:
```env
# Direct DSN string bypassing intermediate connection poolers/bouncers
DATABASE_URL=postgresql://postgres:YOUR_SECURE_PASSWORD@db.YOUR_PROJECT_ID.supabase.co:5432/postgres

# Distributed Idempotency Redis Target URL
REDIS_URL=redis://localhost:6379

# Cryptographic token protecting infrastructure telemetry scopes
METRICS_TOKEN=your_highly_secure_telemetry_token_string
Root/Frontend .env Configuration:
Kod snippet'i
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_public_key
VITE_GO_API_URL=http://localhost:3001
3. Bootstrapping Services
Stage A: Launching Go API Layer
Bash
cd backend
go mod tidy
go run cmd/server/main.go
# Gateway layer initializes and begins pooling on port :3001
Stage B: Launching Front-End Client Workspace
Bash
npm install
npm run dev
# Application layer boots up on Vite default development port (typically :5173)
📈 Enterprise Observability & System Metrics
The Go backend layer exposes structural Prometheus telemetry streams to closely monitor ingestion pipeline performance and track resource allocation bottlenecks[cite: 2].

To pull live funnel distribution matrices and active connection telemetry, issue an authorized handshake call[cite: 2]:

Bash
curl -H "X-Metrics-Token: your_highly_secure_telemetry_token_string" http://localhost:3001/metrics
Core Diagnostic Vectors to Monitor:
erp_db_connections_active: Live connection footprint against the main PostgreSQL instance block[cite: 2].

erp_dlq_failed_syncs_total: Cumulative failure index capturing events routed to the Dead Letter Queue layer for triage[cite: 2].
