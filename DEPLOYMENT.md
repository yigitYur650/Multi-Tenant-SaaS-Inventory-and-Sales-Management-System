# Deployment and Environment Architecture Documentation

This document describes the environment variables and steps required to build, test, and deploy the Multi-Tenant SaaS Inventory and Sales Management System to production.

---

## 1. Environment Variables Configuration

### A. Frontend (Vercel / Netlify / Staging)
Create a `.env` or set these keys in your hosting provider's environment variables console:

| Variable Name | Type | Description | Example Value |
| :--- | :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | String | The URL endpoint of the staging/production Supabase project. | `https://your-project.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | JWT | The public anonymous API key for client-side queries. | `eyJhbGciOiJIUzI1NiIsInR5cCI...` |
| `VITE_GO_API_URL` | URL | The URL where the compiled Go BFF server is hosted. | `https://api.yourdomain.com` |
| `VITE_APP_MODE` | Enum | Modes: `production` or `sandbox` (controls offline features). | `production` |

### B. Backend (Railway.app / Render / Docker Container)
Configure these keys in the backend hosting dashboard or container environment:

| Variable Name | Type | Description | Example Value |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | DSN | Staging/Production PostgreSQL connection pool URL string. | `postgresql://postgres:password@db.project.supabase.co:5432/postgres` |
| `REDIS_URL` | DSN | Endpoint of the Redis cache (used for sync idempotency checks). | `redis://default:password@redis-server:6379` |
| `METRICS_TOKEN` | Secret | Access token for authentication-shielded `/metrics` prometheus endpoint. | `super-secret-prometheus-token-123` |
| `PORT` | Integer| Custom port for Go Fiber backend server to listen on. | `3001` |

---

## 2. CI/CD Pipeline Integration (GitHub Actions)

The repository uses a unified GitHub Actions pipeline defined in `.github/workflows/ci.yml`.

To run the offline Playwright E2E tests inside the CI runner, you must configure the following **GitHub Secrets** on your repository settings:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `E2E_USER_EMAIL` (E2E Test User Email)
- `E2E_USER_PASSWORD` (E2E Test User Password)

If these secrets are not configured (e.g. in forks), the pipeline will log a warning and gracefully skip the Playwright E2E job.

---

## 3. Frontend Deployment (Vercel)

Vercel detects the React SPA project automatically.
- **Framework Preset:** Vite
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Routing & Caching Rules:** Handled by [vercel.json](vercel.json) (which rewrites all requests to `index.html` to support client-side React Router routing, and applies aggressive caching on bundle assets in `/assets`).

---

## 4. Backend Deployment (Railway.app)

The Go backend utilizes a multi-stage Docker build to keep images extremely compact:
- **Build Container:** Compiles the Go code into a statically linked executable (`CGO_ENABLED=0`) using `golang:1.22-alpine`.
- **Runtime Container:** Copies only the static binary and TLS CA certs into a minimal `alpine:3.19` environment to reduce the security attack surface and image size (~25MB final size).
- **Railway Config:** [railway.json](backend/railway.json) instructs Railway to construct and deploy the image using the `Dockerfile` with automatic zero-downtime rolling updates.
