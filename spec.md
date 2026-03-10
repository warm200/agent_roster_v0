# spec.md — Combined Implementation Spec

Merges: current v0_version UI + agent_roster backend architecture.
Strategy: single Next.js 16 full-stack app. Port backend services into this project.

## Current Progress Snapshot

Implemented in the current mock app:
- Catalog, agent detail, dashboard, bundles list/detail, runs list/detail now fetch through app API routes
- Bundle detail can launch mock runs and redirect into run detail
- Run detail now shows runtime disclosure, combined risk, logs, results, artifacts, retry, and cancel
- Cart now persists in `localStorage` and syncs against mock cart endpoints
- Checkout creates a mock purchased bundle and redirects to the returned order ID
- Telegram setup wizard now uses final validate/pairing APIs and polls channel status until pairing completes
- Drizzle/Postgres foundation files now exist: `drizzle.config.ts`, `.env.example`, `server/db/schema.ts`, `server/db/index.ts`, `server/db/seed.ts`
- Initial Drizzle migration generated under `drizzle/`
- Database seed now includes the demo user plus seeded paid order, Telegram channel config, and demo runs from the mock flow
- Shared enums/constants and Zod schemas now exist in `lib/constants.ts` and `lib/schemas.ts`
- Shared Axios client entrypoint now exists in `services/api.ts`
- Catalog client helpers now exist in `services/catalog.api.ts`
- Preview chat client now exists in `services/preview.api.ts`
- Cart client helpers now exist in `services/cart.api.ts`
- Checkout client helpers now exist in `services/checkout.api.ts`
- Order client helpers now exist in `services/orders.api.ts`
- Telegram client helpers now exist in `services/telegram.api.ts`
- Run client helpers now exist in `services/runs.api.ts`
- Stripe SDK and shared server bootstrap now exist in `server/lib/stripe.ts`
- Auth deps, env placeholders, bootstrap config, and auth route now exist for `next-auth`
- Auth client context now exists in `lib/auth-context.tsx` and is mounted in `app/providers.tsx`
- Login page now exists at `app/login/page.tsx`
- `proxy.ts` now protects `/app/*` when OAuth providers are configured
- Final `/api/me/*` routes now require a NextAuth JWT when OAuth providers are configured, while demo/header fallback stays available for local mock mode
- Local PostgreSQL Docker Compose file now exists in `docker-compose.yml`
- Fresh local Postgres verification now passes: migrate + seed succeed against a clean database
- Run providers now exist under `server/providers/` with mock, OpenAI Responses background mode, and an openclaw stub
- Initial backend risk-engine utility now exists in `server/lib/risk-engine.ts`
- Backend commerce snapshot/mapping utilities now exist in `server/services/commerce.utils.ts`
- Backend catalog service now exists in `server/services/catalog.service.ts` with DB + mock fallback logic
- Backend cart service now exists in `server/services/cart.service.ts` with DB-backed cart summary recalculation
- Backend order service now exists in `server/services/order.service.ts` with paid-order creation and signed-download helpers
- Backend checkout service now exists in `server/services/checkout.service.ts` with Stripe session creation and paid-session reconciliation helpers
- Backend Telegram service now exists in `server/services/telegram.service.ts` with token validation, encrypted secret storage, pairing, and webhook handling
- Backend run repository/service now exist in `server/services/run.repository.ts` and `server/services/run.service.ts` with provider-backed run sync against the current DB shape
- `GET /api/agents` and `GET /api/agents/[slug]` now route through `server/services/catalog.service.ts`
- `POST /api/interviews/preview` now routes through `server/services/catalog.service.ts`
- `/api/cart`, `/api/cart/items`, and `/api/cart/items/[id]` now route through `server/services/cart.service.ts` using the cart cookie
- `POST /api/checkout/session` now routes through `server/services/checkout.service.ts`
- Checkout now creates Stripe checkout sessions, requires auth when OAuth providers are configured, and the success page reconciles `session_id` values back into orders
- `POST /api/webhooks/telegram` now routes through `server/services/telegram.service.ts`
- `POST /api/webhooks/stripe` now routes through `server/services/checkout.service.ts`
- Telegram channel config now supports explicit disconnect/reset so users can unlink a bot and connect a different one
- `POST /api/internal/scan` now routes through `runService.scanAgentVersion()` for deterministic risk rescans
- Legacy `/api/bundles*` and `/api/runs*` routes now route through backend services with a request-user fallback
- Final `/api/me/orders*` routes now exist for orders, Telegram run-channel setup, run creation, and signed-download grants
- `GET /api/downloads/orders/:orderId/items/:orderItemId` now exists to validate signed grants and redirect to install package URLs
- Final `/api/me/runs*` routes now exist for run list, detail, logs, and result
- Legacy `/api/telegram/verify` is now a compatibility wrapper onto `telegram.service.ts`, and `/api/runs/[runId]/steps/[stepId]` is an explicit deprecated compatibility endpoint
- Authenticated dashboard, bundles, runs, Telegram setup, run launch, and signed downloads now use the final `/api/me/*` API surface
- `usePairingStatus(orderId)` now exists and polls `/api/me/orders/:id/run-channel` until pairing reaches a terminal state
- `useRunStatus(runId)` now exists and polls `/api/me/runs/:id` until active runs reach a terminal state
- Cart sync, checkout, and Telegram setup flows now call shared frontend API clients instead of raw `fetch`
- Telegram pairing now falls back to local polling mode on non-HTTPS local dev origins instead of requiring Telegram webhook registration
- Telegram setup UI now exposes a disconnect/reset action to swap bots without editing database state manually
- Catalog, dashboard, bundles, bundle detail, and runs pages now call shared frontend API clients instead of raw `fetch`
- Route-level error boundaries now exist for the public shell and the authenticated app shell
- Route-level loading skeletons now exist for catalog, agent detail, dashboard, bundles, bundle detail, runs, and run detail
- `npm test` now runs smoke regression coverage for the preview route and auth proxy
- Browser smoke coverage now exists for catalog-to-cart, protected-app redirect, signed-in dashboard access, authenticated bundle/run page-access flows, and protected app navigation flows
- Browser smoke coverage now exists for checkout-success handoff and its post-purchase CTA paths
- Browser smoke coverage now exists for seeded bundle detail access and real run launch into run detail
- Browser smoke coverage now exists for seeded run detail content
- Browser smoke coverage now exists for seeded Telegram-ready bundle listing
- Browser smoke coverage now exists for seeded signed download grants
- `scripts/db-setup.sh` now exists to start local Postgres, run migrations, and seed the database
- Route smoke coverage now exists for run launch creation and the deprecated manual-step compatibility endpoint
- Route smoke coverage now exists for Telegram validate, pairing-start, and webhook route behavior
- Route smoke coverage now exists for checkout session creation, checkout-session reconciliation, and Stripe webhook handling
- Route smoke coverage now exists for orders list/detail/download route behavior
- Route smoke coverage now exists for signed download grant resolution
- Route smoke coverage now exists for run list/detail/logs/result routes plus retry/cancel actions
- Route smoke coverage now exists for legacy bundle wrappers and the deprecated Telegram verify compatibility route
- Route smoke coverage now exists for legacy run wrappers, including list/create/detail/logs/result and retry/cancel actions
- Route smoke coverage now exists for public agent list/detail routes and preview chat behavior
- Provider unit coverage now exists for the OpenAI run adapter create/poll/result/cancel flow

Still not implemented:
- Production auth provider setup, production Stripe/Telegram operations, durable provider state persistence, and a full workspace-capable run backend
- Deeper paid checkout, Telegram pairing, and run-launch browser coverage, plus hardened production contracts

---

## 1. Architecture Decision

### Why NOT monorepo

The old spec designed a monorepo (`backend/` Next.js API + `frontend/` Vite SPA + `packages/shared/`). The current project is already a Next.js 16 full-stack app with working pages and API routes under one roof. Splitting now would mean rewriting all page routing, layouts, and provider wrappers for zero benefit.

### Target Structure

```
v0_version/                        # Next.js 16 full-stack
├── app/
│   ├── api/                       # API route handlers (rewritten to use real services)
│   ├── agents/                    # Public catalog pages         ← KEEP
│   ├── app/                       # Authenticated dashboard      ← KEEP
│   ├── cart/                      # Shopping cart page            ← KEEP
│   ├── checkout/                  # Checkout page                 ← KEEP
│   ├── layout.tsx                 # Root layout                   ← KEEP
│   ├── page.tsx                   # Home page                     ← KEEP
│   └── providers.tsx              # React context providers       ← KEEP (add AuthProvider)
│
├── components/                    # All UI components              ← KEEP AS-IS
├── hooks/                         # Custom hooks                   ← KEEP + add polling hooks
├── lib/
│   ├── types.ts                   # Domain types                   ← KEEP (add missing types)
│   ├── schemas.ts                 # Zod validation schemas         ← NEW (port from shared/)
│   ├── constants.ts               # Enums, risk levels             ← NEW (port from shared/)
│   ├── mock-data.ts               # Mock data                      ← KEEP (fallback/dev mode)
│   ├── cart-context.tsx           # Cart context                   ← KEEP (wire to API)
│   ├── auth-context.tsx           # Auth context                   ← NEW
│   └── utils.ts                   # Utilities                      ← KEEP
│
├── services/                      # API client layer (frontend→API) ← NEW
│   ├── api.ts                     # Axios shared instance
│   ├── catalog.api.ts             # Agent list/detail
│   ├── cart.api.ts                # Cart CRUD
│   ├── checkout.api.ts            # Stripe session
│   ├── orders.api.ts              # Orders list/detail
│   ├── telegram.api.ts            # Token validate, pairing
│   ├── runs.api.ts                # Run CRUD/logs/results
│   └── preview.api.ts             # Preview chat
│
├── server/                        # Backend business logic          ← NEW (port from agent_roster)
│   ├── db/
│   │   ├── index.ts               # Drizzle client init
│   │   ├── schema.ts              # Full Drizzle schema (10 tables)
│   │   ├── migrate.ts             # Migration runner
│   │   └── seed.ts                # Seed data (5 agents)
│   ├── services/
│   │   ├── catalog.service.ts     # Agent listing, detail, preview chat
│   │   ├── cart.service.ts        # Cart CRUD, anonymous→auth claim
│   │   ├── checkout.service.ts    # Stripe session + webhook handler
│   │   ├── order.service.ts       # Order lifecycle, signed downloads
│   │   ├── telegram.service.ts    # Token validation, pairing, webhook
│   │   ├── run.service.ts         # Run orchestration, risk aggregation
│   │   ├── run.repository.ts      # Run DB abstraction
│   │   └── commerce.utils.ts      # DTO builders, risk combiner
│   ├── providers/
│   │   ├── run-provider.interface.ts  # Provider contract
│   │   ├── mock.provider.ts       # Dev/demo provider
│   │   ├── openai.provider.ts     # Real OpenAI Responses provider
│   │   ├── openclaw.provider.ts   # Stub for future
│   │   └── index.ts               # Provider registry
│   └── lib/
│       ├── auth.ts                # Auth.js / next-auth config
│       ├── risk-engine.ts         # Deterministic rule scanner
│       └── stripe.ts              # Stripe client init
│
├── docker-compose.yml             # PostgreSQL 16                   ← NEW
├── drizzle.config.ts              # Drizzle config                  ← NEW
└── .env.example                   # Environment template            ← NEW
```

---

## 2. Tech Stack (Final)

| Layer | Choice | Source | Notes |
|-------|--------|--------|-------|
| **Framework** | Next.js 16 (App Router) | Current | Full-stack: pages + API routes |
| **UI** | React 19 + TailwindCSS v4 | Current | Dark mode, shadcn/ui components |
| **ORM** | Drizzle ORM | Old spec | PostgreSQL dialect |
| **DB** | PostgreSQL 16 | Old spec | Docker Compose for local dev |
| **Validation** | Zod | Old spec | Request/response schemas in `lib/schemas.ts` |
| **Auth** | Auth.js / next-auth | Old spec | Google/GitHub OAuth; JWT sessions |
| **Payment** | Stripe Checkout | Old spec | Session-based; webhook for completion |
| **HTTP client** | Axios | Old spec | Shared instance in `services/api.ts` |
| **State** | React Context | Current | CartContext (wire to API), AuthContext (new) |
| **Toast** | Sonner | Current | Keep existing toast integration |
| **Components** | Radix + shadcn/ui | Current | 50+ base components already built |

---

## 3. What to KEEP (current v0_version)

### Pages — ALL KEPT

| Page | File | Notes |
|------|------|-------|
| Home | `app/page.tsx` | No changes needed |
| Catalog | `app/agents/page.tsx` | Done: API-backed catalog with loading/error states |
| Agent Detail | `app/agents/[slug]/page.tsx` | Done: API-backed detail page |
| Cart | `app/cart/page.tsx` | Done: CartContext persists locally and syncs with mock cart APIs |
| Checkout | `app/checkout/page.tsx` | Partial: creates a Stripe checkout session via API, enforces auth when OAuth is enabled, and success reconciles the returned `session_id` into an order |
| Dashboard | `app/app/page.tsx` | Done: API-backed stats and recent activity |
| Bundles List | `app/app/bundles/page.tsx` | Done: API-backed bundles list |
| Bundle Detail | `app/app/bundles/[orderId]/page.tsx` | Partial: API-backed bundle detail, Telegram setup with local polling fallback and bot reset support, downloads, and mock run launch |
| Runs List | `app/app/runs/page.tsx` | Done: API-backed runs list with filters/loading/error states |
| Run Detail | `app/app/runs/[runId]/page.tsx` | Done: API-backed detail with logs/results/artifacts/runtime disclosure/risk/retry/cancel |

### Components — ALL KEPT

| Component | Status | Changes Needed |
|-----------|--------|----------------|
| `header.tsx` | Keep | Done: auth-aware sign-in/sign-out state now renders from `AuthContext` |
| `agent-card.tsx` | Keep | None |
| `risk-badge.tsx` | Keep | None |
| `bundle-risk-summary.tsx` | Keep | None |
| `preview-chat.tsx` | Keep | Done: wired to the service-backed preview endpoint |
| `telegram-setup-wizard.tsx` | Keep | Done: wired to final Telegram endpoints and polls channel status until pairing completes |
| `theme-provider.tsx` | Keep | None |
| `ui/*` (50+ shadcn) | Keep | None |

### State & Types

| File | Status | Changes |
|------|--------|---------|
| `lib/types.ts` | Keep | Run/order shape is now aligned with the mock routes; future work is DB/service alignment, not restoring `RunStep` |
| `lib/mock-data.ts` | Keep | Now mostly fallback/mock API backing data; most pages no longer import it directly |
| `lib/cart-context.tsx` | Keep | Done for mock flow: local persistence plus mock cart API sync/reconciliation |
| `lib/utils.ts` | Keep | None |

---

## 4. What to PORT (from agent_roster backend)

### Database Schema

Port `agent_roster/backend/db/schema.ts` → `v0_version/server/db/schema.ts`

All 10 tables (exact match to PRD §10):
- `users`, `accounts`, `sessions`, `verificationTokens` (auth)
- `agents`, `agentVersions`, `riskProfiles` (catalog)
- `carts`, `cartItems` (cart)
- `orders`, `orderItems` (commerce)
- `runChannelConfigs` (telegram)
- `runs` (execution)

**Adaptation:** Change imports from monorepo paths (`@agent-roster/shared`) to local paths (`@/lib/types`).

### Seed Data

Port `agent_roster/backend/db/seed.ts` + `seed-data.ts` → `v0_version/server/db/`

Merge the 3 old seed agents with the 5 current mock agents (keep the current 5 as the seed set — they have richer descriptions and match the current UI).

### Services (6 files)

| Old File | Port To | LOC | Adaptations |
|----------|---------|-----|-------------|
| `cart.service.ts` | `server/services/cart.service.ts` | ~222 | Change imports; use Next.js cookies() |
| `checkout.service.ts` | `server/services/checkout.service.ts` | ~212 | Change imports; keep Stripe logic |
| `order.service.ts` | `server/services/order.service.ts` | ~356 | Change imports; keep signed URL logic |
| `catalog.service.ts` | `server/services/catalog.service.ts` | ~360 | Change imports; keep preview chat logic |
| `run.service.ts` | `server/services/run.service.ts` | ~306 | Change imports; keep risk aggregation |
| `run.repository.ts` | `server/services/run.repository.ts` | ~255 | Change imports |
| `commerce.utils.ts` | `server/services/commerce.utils.ts` | ~187 | Change imports; DTO shape must match current `lib/types.ts` |

### Providers (3 files)

Port as-is → `server/providers/`. Change imports only.

| File | Purpose |
|------|---------|
| `run-provider.interface.ts` | `RunProvider` interface (createRun, getStatus, getLogs, getResult, stopRun) |
| `mock.provider.ts` | Time-based simulation: provisioning→running→completed with synthetic logs |
| `openclaw.provider.ts` | Stub delegating to mock; ready for real integration |

### Shared Schemas

Port `agent_roster/packages/shared/src/schemas/catalog.ts` → `v0_version/lib/schemas.ts`

Port `agent_roster/packages/shared/src/constants/enums.ts` → `v0_version/lib/constants.ts`

---

## 5. API Route Progress

The initial API routes were broken. Most read/write mock routes have now been rewritten to PRD-aligned shapes, but they are still mock-only and still use simplified path contracts.

### Public Endpoints

| Endpoint | Current Status | Action |
|----------|---------------|--------|
| `GET /api/agents` | Service-backed | Uses `catalog.service.ts` with DB-first + mock fallback |
| `GET /api/agents/[slug]` | Service-backed | Uses `catalog.service.ts` with DB-first + mock fallback |
| `POST /api/interviews/preview` | Implemented | Uses `catalog.service.ts` and preview request schema |
| `GET /api/cart` | Service-backed | Uses `cart.service.ts` and cart cookie state |
| `POST /api/cart/items` | Service-backed | Uses `cart.service.ts` and cart cookie state |
| `DELETE /api/cart/items/[cartItemId]` | Service-backed | Uses `cart.service.ts` and cart cookie state |
| `POST /api/checkout/session` | Service-backed | Uses `checkout.service.ts` to create a Stripe checkout session |

### Authenticated Endpoints

| Endpoint | Current Status | Action |
|----------|---------------|--------|
| `GET /api/me/orders` | Implemented | Uses `order.service.ts` |
| `GET /api/me/orders/[orderId]` | Implemented | Uses `order.service.ts` |
| `POST /api/me/orders/[orderId]/run-channel/telegram/validate` | Implemented | Uses `telegram.service.ts` |
| `POST /api/me/orders/[orderId]/run-channel/telegram/pairing/start` | Implemented | Uses `telegram.service.ts` |
| `GET /api/me/orders/[orderId]/run-channel` | Implemented | Uses `telegram.service.ts` |
| `DELETE /api/me/orders/[orderId]/run-channel` | Implemented | Uses `telegram.service.ts` to unlink/reset the Telegram bot |
| `POST /api/me/orders/[orderId]/runs` | Implemented | Uses `run.service.ts` |
| `GET /api/me/orders/[orderId]/download` | Implemented | Uses `order.service.ts` for signed download grants |
| `GET /api/me/runs` | Implemented | Uses `run.service.ts` |
| `GET /api/me/runs/[runId]` | Implemented | Uses `run.service.ts` |
| `GET /api/me/runs/[runId]/logs` | Implemented | Uses `run.service.ts` |
| `GET /api/me/runs/[runId]/result` | Implemented | Uses `run.service.ts` |

### Webhook / Internal Endpoints

| Endpoint | Action |
|----------|--------|
| `POST /api/webhooks/stripe` | Implemented | Routes Stripe events into `checkout.service.ts` |
| `POST /api/webhooks/telegram` | Implemented | Routes Telegram webhook payloads into `telegram.service.ts` |
| `POST /api/internal/scan` | Implemented | Routes deterministic risk rescans into `runService.scanAgentVersion()` |

---

## 6. What to ADD (new code)

### 6.1 Auth Layer

| File | Purpose |
|------|---------|
| `server/lib/auth.ts` | Auth.js / next-auth config (Google + GitHub OAuth, JWT sessions) |
| `lib/auth-context.tsx` | React AuthContext (user, login, logout) |
| `app/api/auth/[...nextauth]/route.ts` | NextAuth route handler |
| `app/login/page.tsx` | Login page (simple OAuth buttons) |
| `proxy.ts` | Protect `/app/*` routes → redirect to login |

### 6.2 Frontend API Service Layer

Implemented. `services/api.ts` now exists as the shared Axios entrypoint, and the per-domain client modules are in place.

```
services/
├── api.ts              # Axios instance (baseURL, interceptors, error handling)
├── catalog.api.ts      # getAgents(filters), getAgentBySlug(slug)
├── cart.api.ts          # getCart(), addToCart(agentId), removeFromCart(itemId)
├── checkout.api.ts      # createCheckoutSession(cartId)
├── orders.api.ts        # getOrders(), getOrder(id), getDownloads(id)
├── telegram.api.ts      # validateToken(orderId, token), startPairing(orderId), getChannelStatus(orderId)
├── runs.api.ts          # getRuns(), getRun(id), getRunLogs(id), getRunResult(id), createRun(orderId)
└── preview.api.ts       # sendPreviewMessage(slug, messages)
```

### 6.3 UI Components Added

| Component | Purpose | Location |
|-----------|---------|----------|
| `RunLogsPanel` | Timestamped log entries (level, step, message) | `components/run-logs-panel.tsx` |
| `RunResultsPanel` | Summary + artifacts download list | `components/run-results-panel.tsx` |
| `RuntimeDisclosure` | Shows usesRealWorkspace/usesTools/networkEnabled | inline in Run Detail |

These are implemented already. The polling hooks are now in place for both Telegram pairing and active run status.

### 6.4 Polling Hooks

| Hook | Purpose |
|------|---------|
| `usePairingStatus(orderId)` | Implemented: polls `GET /api/me/orders/:id/run-channel` until terminal pairing state |
| `useRunStatus(runId)` | Implemented: polls `GET /api/me/runs/:id` until active runs reach a terminal state |

### 6.5 Infrastructure

| File | Purpose |
|------|---------|
| `docker-compose.yml` | PostgreSQL 16 container |
| `drizzle.config.ts` | Drizzle ORM config |
| `.env.example` | All env vars documented |
| `scripts/db-setup.sh` | `docker compose up -d && npm run db:migrate && npm run db:seed` |

---

## 7. Type Alignment Plan

Most of the original run-surface type drift is now fixed. Remaining work is mainly backend/schema alignment rather than page-level field mismatches.

| Issue | Status |
|-------|--------|
| Remove `RunStep` / `StepStatus` dependence from run pages | Done |
| Change run UI from `agent.name` to `agent.title` | Done |
| Change run UI from `run.agentId` / `run.bundleId` to `run.orderId` | Done |
| Standardize run dates on ISO strings | Done |
| Remove non-PRD run extras from active run UI | Done in current mock run surface |

**Recommendation:** The step-by-step execution UI in Run Detail is good UX even though PRD only specifies logs. Keep the UI but derive steps from log entries rather than a separate `RunStep` model. The logs endpoint returns `{ timestamp, level, step, message }` — group by `step` to render the timeline.

---

## 8. Page Integration Snapshot

Most page migrations are now done at the app-route level. The remaining gap is service-layer normalization and real backend contracts, not raw mock-data imports.

### Pattern

```tsx
// BEFORE (current)
import { mockAgents } from '@/lib/mock-data'
const agents = mockAgents

// AFTER
import { getAgents } from '@/services/catalog.api'
const { data: agents } = useSWR('/api/agents', getAgents)
```

Or use React Server Components where appropriate (catalog pages are good candidates).

| Page | Current Data Source | Remaining Gap | Server/Client |
|------|---------------------|---------------|---------------|
| Home | Static | Static (no API needed) | Server |
| Catalog | `GET /api/agents` | Service layer / real backend | Client (has filters) |
| Agent Detail | `GET /api/agents/:slug` | Service layer / real backend | Server + client UI |
| Cart | CartContext + `/api/cart*` mock routes | Durable server cart / auth claim | Client |
| Checkout | CartContext + `POST /api/checkout/session` | Production Stripe config | Client |
| Dashboard | `GET /api/bundles` + `GET /api/runs` | PRD path normalization / auth | Client |
| Bundles List | `GET /api/bundles` | PRD path normalization / auth | Client |
| Bundle Detail | `GET /api/bundles/:id` + channel routes | Signed downloads / real Telegram backend | Client |
| Runs List | `GET /api/runs` | PRD path normalization / polling | Client |
| Run Detail | `GET /api/runs/:id` + logs + result | Real orchestration / polling | Client |

---

## 9. Implementation Phases

### Phase 0: Foundation (~15 files)

Port infrastructure into current project. The local DB config/schema/bootstrap stack is now in place and verified against a clean Postgres database.

1. [x] Add `docker-compose.yml` (PostgreSQL 16)
2. [x] Add `drizzle.config.ts`
3. [x] Port `server/db/schema.ts` from agent_roster (adapt imports)
4. [x] Port `server/db/index.ts` (Drizzle client init)
5. [x] Port `server/db/seed.ts` + merge 5 current agents as seed data
6. [x] Add `.env.example` with all vars
7. [x] Port `lib/schemas.ts` (Zod validation from shared/)
8. [x] Port `lib/constants.ts` (enums from shared/)
9. [x] Install DB deps: `drizzle-orm`, `drizzle-kit`, `pg`, `tsx`
10. [x] Install remaining backend deps: `@auth/core`, `@auth/drizzle-adapter`
11. [x] Generate initial Drizzle migration under `drizzle/`
12. [x] Add `server/lib/auth.ts` (Auth.js / next-auth config)
13. [x] Add `server/lib/stripe.ts` (Stripe client init)
14. [x] Add `app/api/auth/[...nextauth]/route.ts`
15. [x] Verify: `docker compose up -d && npm run db:migrate && npm run db:seed` works
16. [x] Add `services/api.ts` (Axios shared instance)

### Phase 1: Port Backend Services (~7 files, ~2000 LOC)

Port all services from agent_roster. Adapt imports. Test with curl/httpie.

1. [x] Port `server/services/catalog.service.ts`
2. [x] Port `server/services/cart.service.ts`
3. [x] Port `server/services/checkout.service.ts`
4. [x] Port `server/services/order.service.ts`
5. [x] Port `server/services/telegram.service.ts`
6. [x] Port `server/services/run.service.ts` + `run.repository.ts`
7. [x] Port `server/services/commerce.utils.ts`
8. [x] Port `server/providers/` (interface + mock + openclaw stub)
9. [x] Port `server/lib/risk-engine.ts`

### Phase 2: Rewrite API Routes (~20 route files)

Normalize current mock routes into final service-backed PRD routes. Several functional equivalents already exist on `/api/agents`, `/api/bundles`, `/api/cart`, and `/api/runs`.

1. [x] `GET /api/agents` → catalogService
2. [x] `GET /api/agents/[slug]` → catalogService
3. [x] `POST /api/interviews/preview` → catalogService
4. [x] `GET /api/cart` → cartService
5. [x] `POST /api/cart/items` → cartService
6. [x] `DELETE /api/cart/items/[cartItemId]` → cartService
7. [x] `POST /api/checkout/session` → checkoutService
8. [x] `POST /api/webhooks/stripe` → checkoutService
9. [x] `GET /api/me/orders` → orderService
10. [x] `GET /api/me/orders/[orderId]` → orderService
11. [x] `POST /api/me/orders/[orderId]/run-channel/telegram/validate` → telegramService
12. [x] `POST /api/me/orders/[orderId]/run-channel/telegram/pairing/start` → telegramService
13. [x] `GET /api/me/orders/[orderId]/run-channel` → telegramService
14. [x] `POST /api/me/orders/[orderId]/runs` → runService
15. [x] `GET /api/me/orders/[orderId]/download` → orderService
16. [x] `GET /api/me/runs` → runService
17. [x] `GET /api/me/runs/[runId]` → runService
18. [x] `GET /api/me/runs/[runId]/logs` → runService
19. [x] `GET /api/me/runs/[runId]/result` → runService
20. [x] `POST /api/webhooks/telegram` → telegramService
21. [x] Normalize or remove legacy/alternate routes (`/api/bundles`, `/api/telegram/verify`, `/api/runs/[runId]/steps/`)
22. [x] `POST /api/internal/scan` → `runService.scanAgentVersion()`

### Phase 3: Frontend API Integration (~10 files)

Wire pages to real API. Keep all existing UI.

1. [x] Create `services/*.api.ts` files (all planned client modules now exist: `catalog.api.ts`, `cart.api.ts`, `checkout.api.ts`, `orders.api.ts`, `preview.api.ts`, `runs.api.ts`, and `telegram.api.ts`)
2. [x] Add `lib/auth-context.tsx` + `AuthProvider` in `providers.tsx`
3. [x] Add `proxy.ts` for `/app/*` route protection
4. [x] Wire CartContext to API (`addItem` → `POST /api/cart/items`, etc.) for the mock flow
5. [x] Wire Catalog page to `GET /api/agents`
6. [x] Wire Agent Detail to `GET /api/agents/:slug`
7. [x] Wire Preview Chat to `POST /api/interviews/preview`
8. [x] Wire Checkout to `POST /api/checkout/session` → Stripe redirect
9. [x] Wire Dashboard to final `/api/me/orders` + `/api/me/runs`
10. [x] Wire Bundle Detail to final `/api/me/orders/*` endpoints
11. [x] Wire Telegram wizard to real validate/pairing endpoints
12. [x] Wire Run launch to final `/api/me/orders/:id/runs` → redirect to run detail
13. [x] Wire Run Detail to final `/api/me/runs/*` endpoints with polling
14. [x] Wire Downloads to `GET /api/me/orders/:id/download` (signed URLs)
15. [x] Add polling hooks: `usePairingStatus`, `useRunStatus`
16. [x] Fix Run Detail types (`RunStep` → derive from logs; `agent.name` → `agent.title`)

### Phase 4: Missing UI + Polish

1. [x] Add `RunLogsPanel` component (timestamped log entries)
2. [x] Add `RunResultsPanel` component (summary + artifacts download)
3. [x] Add runtime disclosure to Run Detail (usesRealWorkspace, usesTools, networkEnabled)
4. [x] Add combined risk display to Run Detail
5. [x] Add login page (`app/login/page.tsx`)
6. [x] Add auth-aware header (show user name, login/logout)
7. [x] Add loading skeletons to all data-fetching pages
8. [x] Add error boundaries
9. [x] End-to-end flow test
10. [x] Gate pass: lint + typecheck + build green

---

## 10. Environment Variables

```bash
# Database
DATABASE_URL=postgres://agent_roster:agent_roster@localhost:5432/agent_roster

# Auth
AUTH_SECRET=<random-32-bytes>
AUTH_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Downloads
DOWNLOAD_URL_SECRET=<random-32-bytes>

# Run Provider
RUN_PROVIDER=mock  # mock | openai | openclaw
OPENAI_RUN_MODEL=gpt-5

# Preview Chat
OPENAI_API_KEY=     # For preview chat LLM calls
OPENAI_PREVIEW_MODEL=gpt-4o

# Telegram
# Production: set an HTTPS webhook URL
# Local dev: can be left unset; Telegram pairing falls back to polling getUpdates
TELEGRAM_WEBHOOK_URL=https://your-domain/api/webhooks/telegram

# Internal
INTERNAL_API_TOKEN=<random-token>
```

---

## 11. Files to Delete

| File | Reason |
|------|--------|
| `app/api/bundles/route.ts` | Wrong path; replaced by `/api/me/orders` |
| `app/api/telegram/verify/route.ts` | Legacy compatibility wrapper; optional cleanup once bundle-scoped contract fully replaces it |
| `app/api/runs/[runId]/steps/[stepId]/route.ts` | Steps not in PRD; logs-based approach instead |

Old API routes under `app/api/agents/`, `app/api/checkout/`, `app/api/runs/` will be rewritten in-place, not deleted.

---

## 12. Key Design Decisions

### Cart: Server-synced with anonymous fallback

Current cart now persists locally and syncs to mock cart endpoints. The remaining backend goal is anonymous/auth-claimed durable carts via cookies or auth identity:

```
addItem(agent) → optimistic UI update → POST /api/cart/items
removeItem(id) → optimistic UI update → DELETE /api/cart/items/:id
page load → GET /api/cart → hydrate CartContext
```

### Checkout: Stripe redirect (not simulated)

Current checkout simulates a 2s delay. Replace with real Stripe Checkout:

```
Pay button → POST /api/checkout/session → redirect to sessionUrl (Stripe hosted)
Stripe webhook → POST /api/webhooks/stripe → create Order + OrderItems
Stripe success_url → /app/bundles/:orderId
```

### Run Detail: Logs-derived timeline (not RunStep model)

Current Run Detail has a `RunStep`-based timeline UI that's good UX. But the PRD and backend only model logs as `{ timestamp, level, step, message }`. Solution: keep the timeline UI but derive "steps" by grouping log entries by the `step` field. No `RunStep` DB table needed.

### Preview Chat: Backend LLM call (not hardcoded)

Current preview chat is still category-based hardcoded UI. The remaining backend goal is an API-backed preview using the agent's prompt snapshot.

### Download: Signed URLs (not mock URLs)

Current bundle download buttons now open mock install-package URLs from bundle data. The remaining backend goal is signed, time-limited artifact/download URLs.

---

## 13. Acceptance Criteria (PRD §18)

All items from PRD §18, mapped to implementation:

| Criterion | Phase | How |
|-----------|-------|-----|
| User can browse, select, purchase agents | Current + future Phase 2-3 | Done in mock flow; real completion needs Stripe checkout |
| User enters bundle detail post-purchase | Current + future Phase 3 | Done in mock flow via API-created order redirect; real completion needs Stripe success flow |
| User completes Telegram setup | Current + future Phase 2-3 | Done in mock flow; real completion needs backend validation + pairing worker |
| User launches Run | Current + future Phase 2-3 | Done in mock flow via `POST /api/runs`; real completion needs provider backend |
| Order + entitlement persistence | Phase 0-1 | PostgreSQL + Drizzle |
| Download access-controlled | Phase 2-3 | Signed URLs, paid-only check |
| Run create/query/logs/results endpoints | Current + future Phase 2 | Done on current mock `/api/runs*` routes; PRD path normalization still pending |
| Telegram pairing via backend webhook | Phase 2 | `POST /api/webhooks/telegram` |
| All pages accessible | Phase 3 | Already done (UI exists) |
| Preview vs Run boundary clear | Current | Already done |
| Risk visible at all levels | Current | Done in the mock UI, including run detail |
| Telegram wizard functional | Current + Phase 3 | Functional in mock flow; real endpoints still pending |
| Run status/logs/results displayed | Current | RunLogsPanel + RunResultsPanel shipped |
| Every agent version has risk | Phase 1 | Risk engine + seed data |
| Cart/order/run show bundle risk | Phase 3-4 | Already done in UI; wire to real data |
| Run is post-purchase only | Phase 3 | Auth proxy + order check |
| Run experience in-product | Current | Already done |
| Provider stays backend-internal | Phase 2 | API responses exclude `provider_*` fields |
