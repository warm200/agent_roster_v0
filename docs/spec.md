# spec.md — PRD vs Implementation Gap Analysis

## Legend

- **DONE** = fully implemented in current code
- **PARTIAL** = scaffolded/mocked but missing real logic
- **MISSING** = not implemented at all
- **BROKEN** = code exists but has type errors or data model mismatches

---

## 1. Data Model Alignment (PRD §10)

### Critical Issue: Two Diverging Data Schemas

The codebase has **two separate data models** that don't align:

1. **PRD-aligned types** (`lib/types.ts`) — used by `lib/mock-data.ts`, cart context, catalog page, bundle detail page, checkout page, dashboard
2. **V0-generated API schema** — used by API route handlers (`app/api/**`), runs list page, run detail page

The API routes reference fields that don't exist on the PRD types:
- `agent.name` (should be `agent.title`)
- `agent.shortDescription` (should be `agent.summary`)
- `agent.capabilities` (doesn't exist)
- `agent.pricing.basePrice` (should be `agent.priceCents`)
- `agent.riskLevel` (should be `agent.currentVersion.riskProfile.riskLevel`)
- `agent.featured` (doesn't exist)
- `run.agentId` / `run.bundleId` (PRD Run uses `orderId`)
- legacy run-step approval fields (`run.steps` / `RunStep` / `StepStatus`) still appear in older route/page scaffolds but are not part of the PRD model
- older V0 scaffolds also referenced `run.triggerType` / `run.triggerMessage` / `run.durationSeconds` / `run.cost`, which are not part of the PRD model
- some routes previously imported `mockCategories` / `mockUserBundles`, but those compile-time mismatches have now been removed

**Action required:** Unify data models. Pages that import from mock-data directly work; API routes are broken/disconnected.

| Entity             | PRD Fields                    | types.ts | mock-data.ts | API Routes | Status   |
|--------------------|-------------------------------|----------|--------------|------------|----------|
| User               | §10.1                         | DONE     | —            | —          | PARTIAL  |
| Agent              | §10.2                         | DONE     | DONE         | BROKEN     | PARTIAL  |
| AgentVersion       | §10.3                         | DONE     | DONE         | —          | DONE     |
| RiskProfile        | §10.4                         | DONE     | DONE         | —          | DONE     |
| Cart               | §10.5                         | DONE     | DONE         | —          | DONE     |
| CartItem           | §10.6                         | DONE     | —            | —          | DONE     |
| Order              | §10.7                         | DONE     | DONE         | BROKEN     | PARTIAL  |
| OrderItem          | §10.8                         | DONE     | DONE         | —          | DONE     |
| RunChannelConfig   | §10.9                         | DONE     | DONE         | —          | DONE     |
| Run                | §10.10                        | DONE     | DONE         | BROKEN     | PARTIAL  |

---

## 2. Page Structure (PRD §5)

| Page                          | Route                         | PRD §   | Status   | Notes |
|-------------------------------|-------------------------------|---------|----------|-------|
| Home                          | `/`                           | §5.2    | DONE     | Hero, value prop, CTA present |
| Catalog                       | `/agents`                     | §5.3    | DONE     | API-backed catalog with category/search filters and loading/error states |
| Agent Detail                  | `/agents/:slug`               | §5.4    | DONE     | API-backed detail page with overview/risk/changelog tabs, preview chat, and add-to-cart |
| Cart                          | `/cart`                       | §5.5    | DONE     | Items, risk summary, price total, remove, checkout CTA |
| Checkout                      | `/checkout`                   | §5.6    | DONE     | Order summary, risk, terms, mock payment |
| Dashboard                     | `/app`                        | §5.7    | DONE     | API-backed quick stats plus recent bundles/runs with loading/error states |
| Purchased Bundles List        | `/app/bundles`                | §5.8    | DONE     | API-backed bundles list with loading/error states |
| Purchased Bundle Detail       | `/app/bundles/:orderId`       | §5.8    | DONE     | Agents tab, Telegram wizard, downloads, run history |
| Run History List              | `/app/runs`                   | §5.9    | DONE     | API-backed page using `/api/runs` with loading/error/filter states |
| Run Detail                    | `/app/runs/:runId`            | §5.9    | DONE     | API-backed detail page showing timeline, runtime disclosure, logs, results, artifacts, and combined risk |

---

## 3. User Flow (PRD §6)

| Step | Flow                                    | Status   | Notes |
|------|-----------------------------------------|----------|-------|
| 1    | User enters homepage                    | DONE     | |
| 2    | Browse catalog / agent detail           | DONE     | |
| 3    | Preview Chat to explore agent           | DONE     | Hardcoded responses per category |
| 4    | Add agents to cart                      | DONE     | Client-side cart (no persistence across refresh) |
| 5    | Checkout & payment                      | PARTIAL  | Simulated 2s delay; no Stripe integration |
| 6    | Redirect to purchased bundle detail     | PARTIAL  | Checkout now creates a mock bundle via API and redirects to the returned order ID |
| 7    | Complete Telegram setup                 | PARTIAL  | Bundle page now calls mock Telegram validate/pairing APIs; no real Telegram backend/webhook yet |
| 8    | Launch Run                              | PARTIAL  | Bundle page POSTs to the mock run API and redirects into the created run detail page |
| 9    | View Run status/logs/results            | PARTIAL  | Implemented with mock data; no polling or real backend state yet |
| 10   | Download package/artifacts              | PARTIAL  | Bundle downloads link directly to mock install-package URLs; artifact delivery is still mock-only |

---

## 4. API Endpoints (PRD §14)

### 4.1 Public Endpoints

| Endpoint                          | PRD §14.1 | Status   | Notes |
|-----------------------------------|-----------|----------|-------|
| `GET /api/agents`                 | Yes       | PARTIAL  | Returns PRD-aligned mock catalog data and derived categories |
| `GET /api/agents/:slug`           | Yes       | PARTIAL  | Returns a PRD-aligned mock agent record |
| `POST /api/interviews/preview`    | Yes       | MISSING  | Preview chat is client-side only; no backend |
| `GET /api/cart`                   | Yes       | MISSING  | Cart is client-side React context only |
| `POST /api/cart/items`            | Yes       | MISSING  | Client-side only |
| `DELETE /api/cart/items/:id`      | Yes       | MISSING  | Client-side only |
| `POST /api/checkout/session`      | Yes       | PARTIAL  | Route exists at `/api/checkout` as POST; no Stripe session |

### 4.2 Authenticated Endpoints

| Endpoint                                              | PRD §14.2 | Status   | Notes |
|-------------------------------------------------------|-----------|----------|-------|
| `GET /api/me/orders`                                  | Yes       | PARTIAL  | Exists at `/api/bundles` GET; now returns PRD-aligned mock bundle/order data |
| `GET /api/me/orders/:orderId`                         | Yes       | PARTIAL  | Exists at `/api/bundles/:orderId`; returns PRD-aligned mock bundle/order detail |
| `POST /api/me/orders/:orderId/run-channel/telegram/validate` | Yes | PARTIAL | Exists at `/api/bundles/:orderId/channel/telegram/validate`; accepts mock `botToken` and persists validated channel state |
| `POST /api/me/orders/:orderId/run-channel/telegram/pairing/start` | Yes | PARTIAL | Exists at `/api/bundles/:orderId/channel/telegram/pairing/start`; mock-pairs the channel after token validation |
| `GET /api/me/orders/:orderId/run-channel`             | Yes       | PARTIAL  | Exists at `/api/bundles/:orderId/channel`; returns current mock channel state |
| `POST /api/me/orders/:orderId/runs`                   | Yes       | PARTIAL  | Exists at `/api/runs` POST; accepts `orderId` and enforces mock paid + Telegram-ready state |
| `GET /api/me/orders/:orderId/download`                | Yes       | MISSING  | |
| `GET /api/me/runs`                                    | Yes       | PARTIAL  | Exists at `/api/runs` GET; returns PRD-aligned mock runs enriched with order/agent/log metadata |
| `GET /api/me/runs/:runId`                             | Yes       | PARTIAL  | Exists at `/api/runs/:runId`; returns PRD-aligned mock run detail |
| `GET /api/me/runs/:runId/logs`                        | Yes       | PARTIAL  | Exists at `/api/runs/:runId/logs`; returns mock run logs |
| `GET /api/me/runs/:runId/result`                      | Yes       | PARTIAL  | Exists at `/api/runs/:runId/result`; returns mock result summary + artifacts |

### 4.3 Internal Endpoints

| Endpoint                          | PRD §14.3 | Status   |
|-----------------------------------|-----------|----------|
| Telegram webhook/pairing worker   | Yes       | MISSING  |
| Payment completion webhook        | Yes       | MISSING  |
| Internal scan endpoint (risk)     | Yes       | MISSING  |

---

## 5. Telegram Setup Wizard (PRD §7)

| Requirement                              | Status   | Notes |
|------------------------------------------|----------|-------|
| Step 1: Connect — input bot token        | DONE     | UI built with validation UX |
| Step 1: Backend validates token          | PARTIAL  | Wizard now calls a mock bundle-scoped validation API; validation logic is still format-only |
| Step 2: Pair — show instructions         | DONE     | Instructions to send `/start` |
| Step 2: Backend pairing flow             | PARTIAL  | Wizard now calls a mock bundle-scoped pairing-start API; no real webhook/worker |
| Step 3: Ready — show confirmation        | DONE     | Shows bot username, connected status |
| Run-level shared config messaging        | DONE     | "This configuration applies to all agents in this bundle" |
| No manual Telegram ID input              | DONE     | |
| No per-agent token                       | DONE     | |

---

## 6. Run Product Experience (PRD §8)

| Requirement                                        | Status   | Notes |
|----------------------------------------------------|----------|-------|
| Run launch requires: paid + token + pairing        | PARTIAL  | Bundle page gating now uses the correct paid + Telegram-ready condition, but launch remains mock-only |
| Run lifecycle: provisioning/running/completed/failed | DONE   | Pages/routes now use only PRD-aligned statuses |
| Run Detail: status                                 | DONE     | |
| Run Detail: startedAt/updatedAt/completedAt        | DONE     | Uses ISO-string timestamps from `types.ts` |
| Run Detail: runtime disclosure                     | DONE     | `usesRealWorkspace` / `usesTools` / `networkEnabled` rendered in sidebar |
| Run Detail: logs panel                             | DONE     | |
| Run Detail: results summary                        | DONE     | |
| Run Detail: artifacts download                     | DONE     | |
| No provider names/URLs visible                     | DONE     | |
| No remote desktop/live view/shell                  | DONE     | |

---

## 7. Risk Layer (PRD §9)

| Requirement                                    | Status   | Notes |
|------------------------------------------------|----------|-------|
| Agent version risk profile                     | DONE     | `RiskProfile` with capability flags |
| Risk Badge component                           | DONE     | Color-coded low/medium/high |
| Bundle risk calculation (conservative)         | DONE     | `calculateBundleRisk()` uses max risk |
| Bundle Risk Summary component                  | DONE     | Shows level, driver, summary |
| Risk on catalog cards                          | DONE     | |
| Risk on agent detail                           | DONE     | |
| Risk on cart page                              | DONE     | |
| Risk on checkout                               | DONE     | |
| Risk on bundle detail                          | DONE     | |
| Risk on run detail                             | DONE     | `combinedRiskLevel` rendered in the run detail sidebar |
| Deterministic risk rules engine                | MISSING  | Only static mock data; no actual scanning |

---

## 8. Components (PRD §15.3)

| Component                  | Status   | Notes |
|----------------------------|----------|-------|
| Risk Badge                 | DONE     | 3 sizes, color-coded |
| Bundle Risk Summary        | DONE     | |
| Telegram Setup Wizard      | DONE     | 3-step wizard with progress indicator |
| Run Status Panel           | DONE     | Includes status badge plus run metadata/runtime disclosure in detail view |
| Run Logs Panel             | DONE     | |
| Run Results Panel          | DONE     | |
| Preview Chat               | DONE     | Hardcoded responses per category |

---

## 9. State Management (PRD §15.2)

| State Area                          | Status   | Notes |
|-------------------------------------|----------|-------|
| Cart state                          | DONE     | React Context; no persistence across refresh |
| Purchased bundle detail state       | PARTIAL  | Bundle detail now fetches mock order data from `/api/bundles/:orderId`; Telegram setup still uses local step UI on top of mock API responses |
| Telegram token validate state       | PARTIAL  | Uses mock API-backed validation, but no real secret storage or external Telegram check |
| Pairing state                       | PARTIAL  | Uses mock API-backed pairing start, but no webhook/polling worker |
| Run launch readiness                | PARTIAL  | Bundle page gating is fixed and launch now redirects into a created mock run, but there is no real orchestration backend |
| Run status/logs/results state       | PARTIAL  | Runs pages now fetch from mock APIs; still no polling or real backend state |

---

## 10. Backend Infrastructure (PRD §11-13)

| Capability                                     | Status   | Notes |
|------------------------------------------------|----------|-------|
| Database schema & migrations                   | MISSING  | No DB, no ORM, no migrations |
| Seed data                                      | PARTIAL  | `mock-data.ts` has 5 agents; not a real seed script |
| Authentication / auth provider                 | MISSING  | No login, no session, no JWT |
| Real payment (Stripe checkout session)         | MISSING  | Mock only |
| Real Telegram token validation                 | MISSING  | |
| Real Telegram pairing (webhook/worker)         | MISSING  | |
| Run provider abstraction                       | MISSING  | No `RunProvider` interface |
| OpenClaw integration                           | MISSING  | |
| Download access control (signed URLs)          | MISSING  | |
| Run creation / orchestration                   | MISSING  | |
| Run log collection                             | MISSING  | |
| Run result collection                          | MISSING  | |

---

## 11. Frontend-Backend Integration

| Area                                | Status   | Notes |
|-------------------------------------|----------|-------|
| Pages call API routes               | PARTIAL  | Catalog, dashboard, bundles, bundle detail, runs, and agent detail now fetch through app APIs; cart still reads local mock data |
| API routes match PRD endpoint paths  | NO      | Routes use `/api/bundles`, `/api/runs` instead of `/api/me/orders`, `/api/me/runs` |
| API route schemas match types.ts     | PARTIAL | Agents/runs/bundles routes now align with shared mock types; checkout/telegram remain mock contracts |
| Loading states on data fetch         | PARTIAL | Catalog, agent detail, dashboard, bundles, bundle detail, checkout, and runs now render loading states; cart still sync-renders from local state |
| Error states                         | PARTIAL | Catalog, agent detail, dashboard, bundles, bundle detail, and run detail now have basic fetch error states |
| Empty states                         | PARTIAL | Some pages have empty states (runs list, bundle runs) |

---

## 12. Build & Type Safety

| Issue                                                        | Severity |
|--------------------------------------------------------------|----------|
| No current compile blockers in the PRD-aligned run/catalog surface    | RESOLVED |
| Checkout and Telegram flows still use mock contracts rather than production integrations | MEDIUM |

---

## 13. Priority TODO (ordered by implementation phases from PRD §19)

### Phase 1: Backend Infrastructure
1. [ ] Set up database (Postgres + Prisma/Drizzle)
2. [ ] Create schema matching PRD §10 data models
3. [ ] Write migrations
4. [ ] Create seed script from mock-data
5. [ ] Set up authentication (NextAuth / Clerk / custom JWT)
6. [x] Implement catalog endpoints (`GET /api/agents`, `GET /api/agents/:slug`)
7. [ ] Implement cart endpoints (`GET /api/cart`, `POST /api/cart/items`, `DELETE /api/cart/items/:id`)
8. [ ] Implement checkout/order endpoints (`POST /api/checkout/session`, payment webhook)
9. [ ] Implement download endpoint with signed URLs

### Phase 2: Telegram Setup & Run
10. [x] Implement Telegram bot token validation endpoint
11. [x] Implement Telegram pairing start endpoint
12. [ ] Implement Telegram webhook/worker for pairing completion
13. [ ] Implement channel config query endpoint
14. [ ] Define `RunProvider` interface (provider abstraction)
15. [ ] Implement mock/stub RunProvider
16. [x] Implement run creation endpoint
17. [x] Implement run status/logs/result query endpoints
18. [ ] OpenClaw adapter (if applicable)

### Phase 3: Frontend Integration
19. [ ] **Fix type inconsistencies** — unify `lib/types.ts` with all pages and API routes
20. [ ] **Fix API route schemas** — align with PRD §14 endpoint paths and contracts
21. [ ] Replace direct mock-data imports with API calls (use SWR/React Query or fetch)
22. [ ] Add auth context & protected route wrappers
23. [ ] Wire checkout to real Stripe session
24. [ ] Wire Telegram wizard to real backend endpoints
25. [ ] Wire Run launch to real run creation
26. [x] Build Run Logs Panel component
27. [x] Build Run Results Panel component (artifacts download)
28. [x] Add runtime disclosure to Run Detail (usesRealWorkspace, usesTools, networkEnabled)
29. [x] Add combined risk display to Run Detail
30. [ ] Cart persistence (localStorage or server-side)
31. [ ] Post-checkout redirect to real order ID (not hardcoded `order-demo`)
32. [ ] Add loading/error/empty states to all data-fetching pages

### Phase 4: Trust Layer & Integration
33. [ ] Implement deterministic risk scanning rules engine
34. [ ] Implement bundle risk aggregation in backend
35. [ ] End-to-end integration testing
36. [ ] Verify all PRD §18 acceptance criteria

---

## 14. Summary

**What's done well:**
- Full page structure matching PRD §5
- Complete shopping flow UI (browse → detail → cart → checkout → bundle → run)
- PRD-aligned TypeScript types and mock data for core entities
- Telegram Setup Wizard with 3-step UX
- Risk Badge + Bundle Risk Summary components
- Preview Chat component
- Cart context with bundle risk calculation
- Dark mode + responsive layout

**What's critically missing:**
- No real backend (no DB, no auth, no payment, no Telegram, no run execution)
- API routes are still mock-only and still unused by frontend pages, but the run/catalog surface now matches the shared types
- No provider abstraction
- No risk scanning engine
- Frontend pages import mock data directly; zero API integration
