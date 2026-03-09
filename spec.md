# spec.md — Combined Implementation Spec

Merges: current v0_version UI + agent_roster backend architecture.
Strategy: single Next.js 16 full-stack app. Port backend services into this project.

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
│       ├── auth.ts                # NextAuth v5 config
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
| **Auth** | NextAuth v5 (Auth.js) | Old spec | Google/GitHub OAuth; JWT sessions |
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
| Catalog | `app/agents/page.tsx` | Replace mock import → API fetch |
| Agent Detail | `app/agents/[slug]/page.tsx` | Replace mock import → API fetch |
| Cart | `app/cart/page.tsx` | Already uses CartContext; wire context to API |
| Checkout | `app/checkout/page.tsx` | Replace simulated payment → real Stripe redirect |
| Dashboard | `app/app/page.tsx` | Replace mock import → API fetch |
| Bundles List | `app/app/bundles/page.tsx` | Replace mock import → API fetch |
| Bundle Detail | `app/app/bundles/[orderId]/page.tsx` | Replace mock import → API fetch; wire Telegram wizard |
| Runs List | `app/app/runs/page.tsx` | Fix type refs; replace mock → API fetch |
| Run Detail | `app/app/runs/[runId]/page.tsx` | Fix broken types; add logs/results panels; API fetch |

### Components — ALL KEPT

| Component | Status | Changes Needed |
|-----------|--------|----------------|
| `header.tsx` | Keep | Add auth-aware state (login/logout) |
| `agent-card.tsx` | Keep | None |
| `risk-badge.tsx` | Keep | None |
| `bundle-risk-summary.tsx` | Keep | None |
| `preview-chat.tsx` | Keep | Wire to `POST /api/interviews/preview` |
| `telegram-setup-wizard.tsx` | Keep | Wire to real Telegram API endpoints |
| `theme-provider.tsx` | Keep | None |
| `ui/*` (50+ shadcn) | Keep | None |

### State & Types

| File | Status | Changes |
|------|--------|---------|
| `lib/types.ts` | Keep | Add `RunStep`, `StepStatus` if needed; align with Drizzle schema output |
| `lib/mock-data.ts` | Keep | Becomes fallback/dev-only; pages stop importing directly |
| `lib/cart-context.tsx` | Keep | Add API sync (POST/DELETE cart items to backend) |
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

## 5. What to REWRITE (broken API routes)

Current API routes are broken (wrong field names, missing exports). Replace entirely with routes backed by real services.

### Public Endpoints

| Endpoint | Current Status | Action |
|----------|---------------|--------|
| `GET /api/agents` | Broken (wrong fields) | Rewrite → `catalogService.listAgents()` |
| `GET /api/agents/[slug]` | Partial | Rewrite → `catalogService.getAgentBySlug()` |
| `POST /api/interviews/preview` | Missing | New → `catalogService.previewInterview()` |
| `GET /api/cart` | Missing (client-only) | New → `cartService.getActiveCart()` |
| `POST /api/cart/items` | Missing | New → `cartService.addItemToCart()` |
| `DELETE /api/cart/items/[cartItemId]` | Missing | New → `cartService.removeCartItem()` |
| `POST /api/checkout/session` | Broken (no Stripe) | Rewrite → `checkoutService.createCheckoutSession()` |

### Authenticated Endpoints

| Endpoint | Current Status | Action |
|----------|---------------|--------|
| `GET /api/me/orders` | Wrong path (`/api/bundles`) | New at correct path → `orderService.listOrders()` |
| `GET /api/me/orders/[orderId]` | Missing | New → `orderService.getOrderById()` |
| `POST /api/me/orders/[orderId]/run-channel/telegram/validate` | Wrong contract | New → `telegramService.validateToken()` |
| `POST /api/me/orders/[orderId]/run-channel/telegram/pairing/start` | Missing | New → `telegramService.startPairing()` |
| `GET /api/me/orders/[orderId]/run-channel` | Missing | New → `telegramService.getChannelConfig()` |
| `POST /api/me/orders/[orderId]/runs` | Wrong path/schema | New → `runService.createRun()` |
| `GET /api/me/orders/[orderId]/download` | Missing | New → `orderService.getSignedDownloads()` |
| `GET /api/me/runs` | Wrong schema | Rewrite → `runService.listRuns()` |
| `GET /api/me/runs/[runId]` | Wrong schema | Rewrite → `runService.getRun()` |
| `GET /api/me/runs/[runId]/logs` | Missing | New → `runService.getRunLogs()` |
| `GET /api/me/runs/[runId]/result` | Missing | New → `runService.getRunResult()` |

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
| `server/lib/auth.ts` | NextAuth v5 config (Google + GitHub OAuth, JWT sessions) |
| `lib/auth-context.tsx` | React AuthContext (user, login, logout) |
| `app/api/auth/[...nextauth]/route.ts` | NextAuth route handler |
| `app/login/page.tsx` | Login page (simple OAuth buttons) |
| `middleware.ts` | Protect `/app/*` routes → redirect to login |

### 6.2 Frontend API Service Layer

New `services/` directory with Axios-based API clients. Each page replaces direct mock-data import with a service call.

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

### 6.3 Missing UI Components

| Component | Purpose | Location |
|-----------|---------|----------|
| `RunLogsPanel` | Timestamped log entries (level, step, message) | `components/run-logs-panel.tsx` |
| `RunResultsPanel` | Summary + artifacts download list | `components/run-results-panel.tsx` |
| `RuntimeDisclosure` | Shows usesRealWorkspace/usesTools/networkEnabled | inline in Run Detail |

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

The current `lib/types.ts` is 95% aligned with the PRD. Needed fixes:

| Issue | Action |
|-------|--------|
| Run Detail page imports `RunStep`, `StepStatus` — not in types.ts | Either add these types or remove step-based UI (PRD doesn't specify steps, only logs) |
| Run Detail uses `agent.name` | Change to `agent.title` (match types.ts) |
| Run Detail uses `run.agentId`, `run.bundleId` | Change to `run.orderId` (match PRD) |
| Run Detail uses `Date` objects | Standardize on ISO strings (match types.ts) |
| Run Detail uses `run.triggerType`, `run.cost` | Remove (not in PRD); or keep as UI-only extras |

**Recommendation:** The step-by-step execution UI in Run Detail is good UX even though PRD only specifies logs. Keep the UI but derive steps from log entries rather than a separate `RunStep` model. The logs endpoint returns `{ timestamp, level, step, message }` — group by `step` to render the timeline.

---

## 8. Page Migration Checklist

For each page, the migration is: `import from mock-data` → `fetch from API via services/`.

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

| Page | Data Source (current) | Data Source (target) | Server/Client |
|------|----------------------|---------------------|---------------|
| Home | Static | Static (no API needed) | Server |
| Catalog | `mockAgents` directly | `GET /api/agents` | Client (has filters) |
| Agent Detail | `getAgentBySlug()` from mock | `GET /api/agents/:slug` | Server (static data) |
| Cart | CartContext (client-only) | CartContext + `GET/POST/DELETE /api/cart` | Client |
| Checkout | CartContext | CartContext + `POST /api/checkout/session` → Stripe redirect | Client |
| Dashboard | `mockOrders`, `mockRuns` | `GET /api/me/orders` + `GET /api/me/runs` | Client |
| Bundles List | `mockOrders` | `GET /api/me/orders` | Client |
| Bundle Detail | `mockOrders`, `mockRuns` | `GET /api/me/orders/:id` + channel status | Client |
| Runs List | `mockRuns` | `GET /api/me/runs` | Client |
| Run Detail | `mockRuns`, `mockAgents` | `GET /api/me/runs/:id` + logs + result | Client (polling) |

---

## 9. Implementation Phases

### Phase 0: Foundation (~15 files)

Port infrastructure into current project. No UI changes.

1. [ ] Add `docker-compose.yml` (PostgreSQL 16)
2. [ ] Add `drizzle.config.ts`
3. [ ] Port `server/db/schema.ts` from agent_roster (adapt imports)
4. [ ] Port `server/db/index.ts` (Drizzle client init)
5. [ ] Port `server/db/seed.ts` + merge 5 current agents as seed data
6. [ ] Add `.env.example` with all vars
7. [ ] Port `lib/schemas.ts` (Zod validation from shared/)
8. [ ] Port `lib/constants.ts` (enums from shared/)
9. [ ] Install deps: `drizzle-orm`, `drizzle-kit`, `pg`, `@auth/core`, `@auth/drizzle-adapter`, `stripe`, `axios`
10. [ ] Add `server/lib/auth.ts` (NextAuth v5 config)
11. [ ] Add `server/lib/stripe.ts` (Stripe client init)
12. [ ] Add `app/api/auth/[...nextauth]/route.ts`
13. [ ] Verify: `docker compose up -d && npm run db:migrate && npm run db:seed` works
14. [ ] Add `services/api.ts` (Axios shared instance)

### Phase 1: Port Backend Services (~7 files, ~2000 LOC)

Port all services from agent_roster. Adapt imports. Test with curl/httpie.

1. [ ] Port `server/services/catalog.service.ts`
2. [ ] Port `server/services/cart.service.ts`
3. [ ] Port `server/services/checkout.service.ts`
4. [ ] Port `server/services/order.service.ts`
5. [ ] Port `server/services/telegram.service.ts`
6. [ ] Port `server/services/run.service.ts` + `run.repository.ts`
7. [ ] Port `server/services/commerce.utils.ts`
8. [ ] Port `server/providers/` (interface + mock + openclaw stub)
9. [ ] Port `server/lib/risk-engine.ts`

### Phase 2: Rewrite API Routes (~20 route files)

Delete broken routes. Write new ones backed by services.

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
21. [ ] Delete old broken routes (`/api/bundles`, `/api/telegram/verify`, `/api/runs/[runId]/steps/`)

### Phase 3: Frontend API Integration (~10 files)

Wire pages to real API. Keep all existing UI.

1. [ ] Create `services/*.api.ts` files (7 service clients)
2. [ ] Add `lib/auth-context.tsx` + `AuthProvider` in `providers.tsx`
3. [ ] Add `middleware.ts` for `/app/*` route protection
4. [ ] Wire CartContext to API (`addItem` → `POST /api/cart/items`, etc.)
5. [ ] Wire Catalog page to `GET /api/agents`
6. [ ] Wire Agent Detail to `GET /api/agents/:slug`
7. [ ] Wire Preview Chat to `POST /api/interviews/preview`
8. [ ] Wire Checkout to `POST /api/checkout/session` → Stripe redirect
9. [ ] Wire Dashboard to `GET /api/me/orders` + `GET /api/me/runs`
10. [ ] Wire Bundle Detail to `GET /api/me/orders/:id` + channel endpoints
11. [ ] Wire Telegram wizard to real validate/pairing endpoints
12. [ ] Wire Run launch to `POST /api/me/orders/:id/runs` → redirect to run detail
13. [ ] Wire Run Detail to `GET /api/me/runs/:id` + logs + result
14. [ ] Wire Downloads to `GET /api/me/orders/:id/download` (signed URLs)
15. [ ] Add polling hooks: `usePairingStatus`, `useRunStatus`
16. [ ] Fix Run Detail types (`RunStep` → derive from logs; `agent.name` → `agent.title`)

### Phase 4: Missing UI + Polish

1. [ ] Add `RunLogsPanel` component (timestamped log entries)
2. [ ] Add `RunResultsPanel` component (summary + artifacts download)
3. [ ] Add runtime disclosure to Run Detail (usesRealWorkspace, usesTools, networkEnabled)
4. [ ] Add combined risk display to Run Detail
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
| `app/api/telegram/verify/route.ts` | Wrong contract; replaced by `/api/me/orders/:id/run-channel/telegram/validate` |
| `app/api/runs/[runId]/steps/[stepId]/route.ts` | Steps not in PRD; logs-based approach instead |

Old API routes under `app/api/agents/`, `app/api/checkout/`, `app/api/runs/` will be rewritten in-place, not deleted.

---

## 12. Key Design Decisions

### Cart: Server-synced with anonymous fallback

Current cart is client-only (React Context, lost on refresh). The old backend has anonymous cart support via cookies that gets claimed on login. Keep CartContext for instant UI updates, but sync mutations to the server:

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

Current preview chat has category-based hardcoded responses. The old backend calls OpenAI with the agent's `preview_prompt_snapshot`. Port that — the UI stays the same, just wire to `POST /api/interviews/preview`.

### Download: Signed URLs (not toast stubs)

Current download buttons show a toast. The old backend generates HMAC-signed, time-limited (15 min) URLs per agent package. Wire the download buttons to `GET /api/me/orders/:id/download` → open signed URLs.

---

## 13. Acceptance Criteria (PRD §18)

All items from PRD §18, mapped to implementation:

| Criterion | Phase | How |
|-----------|-------|-----|
| User can browse, select, purchase agents | Phase 2-3 | Catalog API + Cart API + Stripe checkout |
| User enters bundle detail post-purchase | Phase 3 | Stripe success_url redirect |
| User completes Telegram setup | Phase 2-3 | Real token validate + pairing endpoints |
| User launches Run | Phase 2-3 | `POST /api/me/orders/:id/runs` + mock provider |
| Order + entitlement persistence | Phase 0-1 | PostgreSQL + Drizzle |
| Download access-controlled | Phase 2-3 | Signed URLs, paid-only check |
| Run create/query/logs/results endpoints | Phase 2 | All 5 run endpoints |
| Telegram pairing via backend webhook | Phase 2 | `POST /api/webhooks/telegram` |
| All pages accessible | Phase 3 | Already done (UI exists) |
| Preview vs Run boundary clear | Current | Already done |
| Risk visible at all levels | Phase 4 | Add to Run Detail; rest already done |
| Telegram wizard functional | Phase 3 | Wire to real endpoints |
| Run status/logs/results displayed | Phase 4 | RunLogsPanel + RunResultsPanel |
| Every agent version has risk | Phase 1 | Risk engine + seed data |
| Cart/order/run show bundle risk | Phase 3-4 | Already done in UI; wire to real data |
| Run is post-purchase only | Phase 3 | Auth middleware + order check |
| Run experience in-product | Current | Already done |
| Provider stays backend-internal | Phase 2 | API responses exclude `provider_*` fields |
