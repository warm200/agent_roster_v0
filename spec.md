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
- Telegram setup wizard now uses bundle-scoped mock validate/pairing APIs
- Drizzle/Postgres foundation files now exist: `drizzle.config.ts`, `.env.example`, `server/db/schema.ts`, `server/db/index.ts`, `server/db/seed.ts`
- Initial Drizzle migration generated under `drizzle/`
- Shared enums/constants and Zod schemas now exist in `lib/constants.ts` and `lib/schemas.ts`
- Shared Axios client entrypoint now exists in `services/api.ts`
- Stripe SDK and shared server bootstrap now exist in `server/lib/stripe.ts`
- Auth deps, env placeholders, bootstrap config, and auth route now exist for `next-auth`
- Local PostgreSQL Docker Compose file now exists in `docker-compose.yml`
- Fresh local Postgres verification now passes: migrate + seed succeed against a clean database
- Run provider scaffolding now exists under `server/providers/` with mock and openclaw stubs
- Initial backend risk-engine utility now exists in `server/lib/risk-engine.ts`
- Backend commerce snapshot/mapping utilities now exist in `server/services/commerce.utils.ts`
- Backend catalog service now exists in `server/services/catalog.service.ts` with DB + mock fallback logic
- Backend cart service now exists in `server/services/cart.service.ts` with DB-backed cart summary recalculation

Still not implemented:
- Real auth flows, Stripe checkout/webhooks, Telegram webhook/pairing worker, signed downloads, provider abstraction, real run backend
- PRD endpoint path normalization (`/api/me/orders`, `/api/me/runs`) and production service contracts

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
| Checkout | `app/checkout/page.tsx` | Partial: still mock checkout, but now creates a mock bundle via API and redirects to returned `orderId` |
| Dashboard | `app/app/page.tsx` | Done: API-backed stats and recent activity |
| Bundles List | `app/app/bundles/page.tsx` | Done: API-backed bundles list |
| Bundle Detail | `app/app/bundles/[orderId]/page.tsx` | Partial: API-backed bundle detail, Telegram setup, downloads, and mock run launch |
| Runs List | `app/app/runs/page.tsx` | Done: API-backed runs list with filters/loading/error states |
| Run Detail | `app/app/runs/[runId]/page.tsx` | Done: API-backed detail with logs/results/artifacts/runtime disclosure/risk/retry/cancel |

### Components — ALL KEPT

| Component | Status | Changes Needed |
|-----------|--------|----------------|
| `header.tsx` | Keep | Add auth-aware state (login/logout) |
| `agent-card.tsx` | Keep | None |
| `risk-badge.tsx` | Keep | None |
| `bundle-risk-summary.tsx` | Keep | None |
| `preview-chat.tsx` | Keep | Still client-side mock; backend preview endpoint remains missing |
| `telegram-setup-wizard.tsx` | Keep | Done for mock flow; wired to bundle-scoped validate/pairing APIs |
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
| `GET /api/agents` | Rewritten | Currently returns PRD-aligned mock catalog data |
| `GET /api/agents/[slug]` | Rewritten | Currently returns PRD-aligned mock agent detail |
| `POST /api/interviews/preview` | Missing | New → `catalogService.previewInterview()` |
| `GET /api/cart` | Implemented (mock) | Returns mock cart state |
| `POST /api/cart/items` | Implemented (mock) | Adds cart item by `agentId` |
| `DELETE /api/cart/items/[cartItemId]` | Implemented (mock) | Removes cart item |
| `POST /api/checkout/session` | Not matched exactly | Current equivalent is `POST /api/checkout` with mock bundle creation; no Stripe session |

### Authenticated Endpoints

| Endpoint | Current Status | Action |
|----------|---------------|--------|
| `GET /api/me/orders` | Implemented on alternate path | Current equivalent is `GET /api/bundles` |
| `GET /api/me/orders/[orderId]` | Implemented on alternate path | Current equivalent is `GET /api/bundles/[orderId]` |
| `POST /api/me/orders/[orderId]/run-channel/telegram/validate` | Implemented on alternate path | Current equivalent is `POST /api/bundles/[orderId]/channel/telegram/validate` |
| `POST /api/me/orders/[orderId]/run-channel/telegram/pairing/start` | Implemented on alternate path | Current equivalent is `POST /api/bundles/[orderId]/channel/telegram/pairing/start` |
| `GET /api/me/orders/[orderId]/run-channel` | Implemented on alternate path | Current equivalent is `GET /api/bundles/[orderId]/channel` |
| `POST /api/me/orders/[orderId]/runs` | Implemented on alternate path | Current equivalent is `POST /api/runs` with `orderId` payload |
| `GET /api/me/orders/[orderId]/download` | Missing | New → `orderService.getSignedDownloads()` |
| `GET /api/me/runs` | Implemented on alternate path | Current equivalent is `GET /api/runs` |
| `GET /api/me/runs/[runId]` | Implemented on alternate path | Current equivalent is `GET /api/runs/[runId]` |
| `GET /api/me/runs/[runId]/logs` | Implemented on alternate path | Current equivalent is `GET /api/runs/[runId]/logs` |
| `GET /api/me/runs/[runId]/result` | Implemented on alternate path | Current equivalent is `GET /api/runs/[runId]/result` |

### Webhook / Internal Endpoints

| Endpoint | Action |
|----------|--------|
| `POST /api/webhooks/stripe` | New → `checkoutService.handleStripeEvent()` |
| `POST /api/webhooks/telegram` | New → `telegramService.handleWebhook()` |
| `POST /api/internal/scan` | New → `runService.scanAgentVersion()` |

---

## 6. What to ADD (new code)

### 6.1 Auth Layer

| File | Purpose |
|------|---------|
| `server/lib/auth.ts` | Auth.js / next-auth config (Google + GitHub OAuth, JWT sessions) |
| `lib/auth-context.tsx` | React AuthContext (user, login, logout) |
| `app/api/auth/[...nextauth]/route.ts` | NextAuth route handler |
| `app/login/page.tsx` | Login page (simple OAuth buttons) |
| `middleware.ts` | Protect `/app/*` routes → redirect to login |

### 6.2 Frontend API Service Layer

Partially added. `services/api.ts` now exists as the shared Axios entrypoint, but per-domain client modules are still future work.

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

These are implemented already. Still missing: polling hooks for live backend state rather than static/mock fetches.

### 6.4 Polling Hooks

| Hook | Purpose |
|------|---------|
| `usePairingStatus(orderId)` | Poll `GET /api/me/orders/:id/run-channel` until `paired` |
| `useRunStatus(runId)` | Poll `GET /api/me/runs/:id` until terminal state |

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
| Checkout | CartContext + `POST /api/checkout` | Real Stripe redirect/session | Client |
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
3. [ ] Port `server/services/checkout.service.ts`
4. [ ] Port `server/services/order.service.ts`
5. [ ] Port `server/services/telegram.service.ts`
6. [ ] Port `server/services/run.service.ts` + `run.repository.ts`
7. [x] Port `server/services/commerce.utils.ts`
8. [x] Port `server/providers/` (interface + mock + openclaw stub)
9. [x] Port `server/lib/risk-engine.ts`

### Phase 2: Rewrite API Routes (~20 route files)

Normalize current mock routes into final service-backed PRD routes. Several functional equivalents already exist on `/api/agents`, `/api/bundles`, `/api/cart`, and `/api/runs`.

1. [ ] `GET /api/agents` → catalogService
2. [ ] `GET /api/agents/[slug]` → catalogService
3. [ ] `POST /api/interviews/preview` → catalogService
4. [ ] `GET /api/cart` → cartService
5. [ ] `POST /api/cart/items` → cartService
6. [ ] `DELETE /api/cart/items/[cartItemId]` → cartService
7. [ ] `POST /api/checkout/session` → checkoutService
8. [ ] `POST /api/webhooks/stripe` → checkoutService
9. [ ] `GET /api/me/orders` → orderService
10. [ ] `GET /api/me/orders/[orderId]` → orderService
11. [ ] `POST /api/me/orders/[orderId]/run-channel/telegram/validate` → telegramService
12. [ ] `POST /api/me/orders/[orderId]/run-channel/telegram/pairing/start` → telegramService
13. [ ] `GET /api/me/orders/[orderId]/run-channel` → telegramService
14. [ ] `POST /api/me/orders/[orderId]/runs` → runService
15. [ ] `GET /api/me/orders/[orderId]/download` → orderService
16. [ ] `GET /api/me/runs` → runService
17. [ ] `GET /api/me/runs/[runId]` → runService
18. [ ] `GET /api/me/runs/[runId]/logs` → runService
19. [ ] `GET /api/me/runs/[runId]/result` → runService
20. [ ] `POST /api/webhooks/telegram` → telegramService
21. [ ] Normalize or remove legacy/alternate routes (`/api/bundles`, `/api/telegram/verify`, `/api/runs/[runId]/steps/`)

### Phase 3: Frontend API Integration (~10 files)

Wire pages to real API. Keep all existing UI.

1. [ ] Create `services/*.api.ts` files (7 service clients)
2. [ ] Add `lib/auth-context.tsx` + `AuthProvider` in `providers.tsx`
3. [ ] Add `middleware.ts` for `/app/*` route protection
4. [x] Wire CartContext to API (`addItem` → `POST /api/cart/items`, etc.) for the mock flow
5. [x] Wire Catalog page to `GET /api/agents`
6. [x] Wire Agent Detail to `GET /api/agents/:slug`
7. [ ] Wire Preview Chat to `POST /api/interviews/preview`
8. [ ] Wire Checkout to `POST /api/checkout/session` → Stripe redirect
9. [x] Wire Dashboard to current mock orders/runs endpoints
10. [x] Wire Bundle Detail to current mock bundle/channel endpoints
11. [ ] Wire Telegram wizard to real validate/pairing endpoints
12. [x] Wire Run launch to current mock run creation endpoint → redirect to run detail
13. [x] Wire Run Detail to current mock run detail/logs/result endpoints
14. [ ] Wire Downloads to `GET /api/me/orders/:id/download` (signed URLs)
15. [ ] Add polling hooks: `usePairingStatus`, `useRunStatus`
16. [x] Fix Run Detail types (`RunStep` → derive from logs; `agent.name` → `agent.title`)

### Phase 4: Missing UI + Polish

1. [x] Add `RunLogsPanel` component (timestamped log entries)
2. [x] Add `RunResultsPanel` component (summary + artifacts download)
3. [x] Add runtime disclosure to Run Detail (usesRealWorkspace, usesTools, networkEnabled)
4. [x] Add combined risk display to Run Detail
5. [ ] Add login page (`app/login/page.tsx`)
6. [ ] Add auth-aware header (show user name, login/logout)
7. [ ] Add loading skeletons to all data-fetching pages
8. [ ] Add error boundaries
9. [ ] End-to-end flow test
10. [ ] Gate pass: lint + typecheck + build green

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
RUN_PROVIDER=mock  # mock | openclaw

# Preview Chat
OPENAI_API_KEY=     # For preview chat LLM calls
OPENAI_PREVIEW_MODEL=gpt-4o

# Telegram
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
| Run is post-purchase only | Phase 3 | Auth middleware + order check |
| Run experience in-product | Current | Already done |
| Provider stays backend-internal | Phase 2 | API responses exclude `provider_*` fields |
