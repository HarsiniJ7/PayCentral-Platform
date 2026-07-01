# PayCentral Corporate Expense Card Platform - PoC

A proof of concept for the PayCentral Corporate Expense Card platform, built for the **Senior Full Stack Developer Assessment - Frontend & UX Focus** track.

Two portals:
- **Administrator** - issue and manage cards, load funds, search transactions, monitor fraud
  alerts, run reports, review the audit log.
- **Cardholder** - view their card, balance, transaction history and notifications.

## Why this is structured the way it is

I chose **Option B (Frontend & UX Focus)**. The brief's own evaluation weighting for this track puts 70% of the score on UI/UX, component architecture, API integration, responsiveness, state management and accessibility - so that's where most of the build time went. The backend isintentionally a lightweight Node/Express + SQLite API rather than a full .NET implementation: the brief lists ".NET 8, APIs, SQL Server" as the *backend* track's primary focus, and "minor backend work where required" as the frontend track's expectation. Building a half-correct .NET backend in
the time available would have been worse engineering judgement than building a small,correct one in a stack better suited to fast iteration alongside the frontend. This tradeoff is explained further in `docs/architecture.md`.

## Tech stack

**Frontend**
- React 18 + TypeScript + Vite
- React Router for client-side routing and role-gated protected routes
- Tailwind CSS for styling
- Recharts for the admin spend chart

**Backend**
- Node.js + Express + TypeScript
- SQLite via `better-sqlite3` (file-based, zero external setup)
- JWT authentication (15-min access tokens) with rotating, hashed refresh tokens (7-day, single-use - see `docs/SECURITY.md`), bcrypt password hashing
- A small rule-based fraud detection engine (see `backend/src/services/fraudEngine.ts`)

## Bonus features implemented

The brief lists 12 optional bonus items. The following were implemented for real (not stubbed):

| Feature | Where | Notes |
|---|---|---|
| Real-time dashboard (Socket.io) | `backend/src/lib/realtime.ts`, `frontend/src/lib/socket.ts` | JWT-authenticated socket handshake; admin dashboard pages auto-refresh on `transaction:new`, `fraud:alert`, `card:status-changed`, `card:issued` instead of polling. Built with Socket.io rather than SignalR since the backend track is .NET/SignalR but this is the frontend track's Node API - same real-time pattern, native to the stack in use. |
| Docker | `backend/Dockerfile`, `frontend/Dockerfile`, root `docker-compose.yml` | Multi-stage builds, non-root runtime user, healthchecks. `docker-compose up` brings up backend + frontend + Redis together. |
| CI/CD | `.github/workflows/ci.yml` | Lint, typecheck, test and build both apps on every push/PR, then proves both Docker images actually build. |
| Redis cache | `backend/src/lib/cache.ts` | Caches the daily-summary report (30s TTL, invalidated on every wallet mutation). Falls back to an in-memory cache automatically if no `REDIS_URL`/Redis is reachable, so the app never hard-depends on it locally. |
| Background processing | `backend/src/jobs/lowBalanceSweep.ts` | `node-cron` job sweeping for low-balance cards every minute, idempotent (won't re-notify within an hour), demonstrating scheduled out-of-request-cycle work. |
| OpenTelemetry | `backend/src/lib/telemetry.ts` | Auto-instrumented tracing exported over OTLP/HTTP; fails silently (no crash, no blocked requests) if no collector is listening. |
| Health checks | `backend/src/lib/health.ts` | `/api/health/live` (process up) and `/api/health/ready` (DB connectivity + cache backend status) - the standard liveness/readiness split. |
| Automated tests | `backend/tests/*.test.ts` (Jest + Supertest), `frontend/src/test/*.test.tsx` (Vitest + Testing Library) | Backend: health, auth, wallet business rules (insufficient funds, idempotency, blocked-card transactions), fraud engine. Frontend: Badge/statusTone, Pagination, dark-mode toggle. |
| Dark mode | `frontend/src/context/ThemeContext.tsx`, Tailwind `darkMode: "class"` | Real toggle (not just a fixed dark theme) - respects OS preference on first visit, persists choice, applied across shared components and the admin overview/fraud screens. |
| Accessibility (WCAG) | Throughout `frontend/src` | Dialog semantics + focus trap + Escape-to-close on `IssueCardModal`, `scope="col"` and captions on data tables, labelled form controls, `aria-label`s on icon-only/pagination buttons, live regions for the real-time status indicator. Not a full WCAG audit - see Future Improvements. |

**Not implemented** (documented here rather than half-built): Azure/AWS deployment configuration andHangfire were judged out of scope for a 48-hour take-home running on a single laptop - they'reinfrastructure/cloud-account-dependent rather than something this codebase can demonstrate meaningfully without an actual cloud subscription. `docs/architecture.md` describes how this woulddeploy to Azure (App Service + Azure SQL + Azure Service Bus) if it were a real next step.



```
paycentral-expense-platform/
  backend/      Express API, SQLite schema + seed data, fraud engine, routes,
                lib/ (logger, telemetry, cache, realtime, health), jobs/ (background worker), tests/
  frontend/     React + TypeScript SPA (admin + cardholder portals), src/test/ (Vitest)
  docs/         Architecture, ER diagram, API reference, security/POPIA notes, AI usage log
  docker-compose.yml   One-command local stack: backend + frontend + Redis
  .github/workflows/   CI pipeline
```

## Setup instructions

Requires Node.js 18+. There are two ways to run this: Docker Compose (one command, includes Redis)or running backend/frontend locally (faster iteration, falls back to an in-memory cache without Redis - both are fully supported).

### Option A - Docker Compose

```bash
docker-compose up --build
```

Brings up Redis, the API (`http://localhost:4000`) and the frontend (`http://localhost:5173`)
together, wired to each other. The API's SQLite file and Redis data persist in named volumes across restarts.

### Option B - Run locally

#### 1. Backend

```bash
cd backend
cp .env.example .env     # adjust JWT_SECRET etc. if you want
npm install
npm run dev               # starts on http://localhost:4000
```

The SQLite database is created and seeded automatically on first run (file: `backend/paycentral.db`, gitignored). Seeded accounts:

| Role | Email | Password |
|---|---|---|
| Administrator | `admin@paycentral.test` | `Admin@12345` |
| Cardholder | `thabo@paycentral.test` | `Card@12345` |
| Cardholder | `sarah@paycentral.test` | `Card@12345` |

(Four more cardholders are seeded with the same password - see the console output on first boot, or the Admin -> Cardholders screen, for the full list. One seeded card is Blocked and one is Suspended so the status-handling UI has something real to show.)

The bonus-feature env vars in `.env.example` (`REDIS_URL`, `OTEL_ENABLED`,
`OTEL_EXPORTER_OTLP_ENDPOINT`, `BACKGROUND_JOBS_ENABLED`, `LOG_LEVEL`) are all optional - the app runs correctly with none of them set, falling back to in-memory caching and skipping telemetry export.

#### 2. Frontend

```bash
cd frontend
cp .env.example .env     # points at the backend URL
npm install
npm run dev               # starts on http://localhost:5173
```

Open `http://localhost:5173`, sign in with one of the accounts above (or use the "Fill admin
login" / "Fill cardholder login" buttons on the login screen), and explore.

### Running the tests

```bash
cd backend && npm test     # Jest + Supertest
cd frontend && npm test    # Vitest + Testing Library
```

## Assumptions

- Email/SMS/Push notifications are mocked (logged to the backend console + stored in the
  `Notifications` table) rather than wired up to a real provider, per the brief.
- Swagger UI is served at `http://localhost:4000/api-docs` once the backend is running (raw spec at `/api/openapi.json`). `docs/api-flow.md` is kept as a human-readable companion with sequence diagrams, since Swagger doesn't show request flow well.
- SQLite stands in for SQL Server. The schema (see `backend/src/db/index.ts`) is written to be a straightforward port to EF Core migrations against SQL Server if needed.
- Card numbers are generated test data (Luhn-valid-looking but not real BIN ranges) and stored in clear text in this PoC for simplicity - see `docs/SECURITY.md` for what that would need to become in production (tokenisation/encryption at rest).
- "International transaction" fraud rule treats any merchant with `country !== 'ZA'` as
  international, which is a reasonable PoC simplification of real card-network country codes.

## Future improvements

- Move fraud rule evaluation fully off the request path into a dedicated queue consumer (the
  current `node-cron` background job demonstrates the pattern for the low-balance sweep, but fraud checks still run inline on the purchase request - see `docs/architecture.md` for the Azure Service Bus + worker design this would graduate to).
- Real notification delivery (SendGrid/Twilio/push provider) behind the same `sendNotification`interface, so swapping the mock for a real provider doesn't touch call sites.
- Refresh token revocation is currently per-token; a "revoke all sessions for this user" admin action (e.g. on password change or suspected compromise) would be a natural next step, along with moving the refresh token itself into an `HttpOnly` cookie instead of `localStorage` to close off the XSS-exfiltration path entirely.
- A full WCAG audit with a screen reader and an automated tool (axe/Lighthouse) - the current pass covers dialog semantics, table semantics, labelled controls and focus management, but hasn't been exhaustively tested against every screen.
- Multi-replica cache invalidation: the Redis cache wrapper's in-memory fallback is per-process, so running more than one API instance behind a load balancer would need Redis to be a hard requirement (not a graceful fallback) to keep cached reports consistent across instances.
- Azure/AWS deployment configuration and a real Postgres/SQL Server target for anything beyond local dev and CI.

## Documentation index

- [`docs/architecture.md`](docs/architecture.md) - component diagram, request-flow sequence diagram, scaling notes
- [`docs/er-diagram.md`](docs/er-diagram.md) - database ER diagram and design notes
- [`docs/api-flow.md`](docs/api-flow.md) - full endpoint reference
- [`docs/SECURITY.md`](docs/SECURITY.md) - security practices, OWASP Top 10 mapping, POPIA considerations
- [`docs/AI-USAGE.md`](docs/AI-USAGE.md) - AI tool usage log: what it helped with, and where I overrode or rewrote it
