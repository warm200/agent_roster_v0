---
summary: Runtime pricing-plan reference for OpenRoster, including current product flow, enforced constraints, and known gaps.
read_when:
  - Evaluating subscription tiers, credits, runtime access limits, or launch guardrails.
  - Reasoning about whether the current pricing matrix fits the product and user behavior.
---

# pricing_plan.md

## Purpose

This document explains:

1. what the application does today
2. how agent purchase differs from runtime-plan purchase
3. what subscription plans exist
4. which constraints are actually enforced in code today
5. which intended constraints are not implemented yet

This is meant for external reasoning by another AI model, without requiring full codebase inspection.

---

## 1. Product Summary

OpenRoster is a productized platform for:

1. discovering agents in a catalog
2. previewing their persona/behavior through preview chat
3. purchasing one or more agents into a bundle
4. configuring Telegram and runtime settings after purchase
5. launching a run for the purchased bundle
6. viewing run status, logs, results, and artifacts
7. opening a browser-based control UI for sandbox-backed runs
8. downloading purchased agent packages

Important product distinction:

- **agent purchase** and **runtime plan purchase** are different products
- agents are currently priced at **$0**
- runtime access is controlled by a separate **subscription / credit plan**

So the current model is:

- user can collect/purchase agents freely
- user needs a runtime plan to actually launch runs

---

## 2. Purchase Model

### 2.1 Agent Purchase

Agent purchase flow:

1. user adds agents to cart
2. checkout creates an order/bundle
3. purchased bundle appears in the app

Current commercial behavior:

- all agents are currently priced at `$0`
- zero-dollar carts bypass Stripe and create an order directly

What this means:

- users can purchase many agents and many bundles
- plan limits are **not** enforced at purchase time
- plan limits are enforced only when the user clicks **Launch Run**

This is intentional.

### 2.2 Runtime Plan Purchase

Runtime plans are a separate Stripe-backed flow.

Current runtime-plan UX:

1. user visits a purchased bundle
2. if launch is blocked by plan limits, bundle detail shows blockers
3. bundle detail opens an in-place modal with available plans
4. user chooses a paid plan
5. Stripe checkout opens
6. Stripe returns user to the same bundle detail page
7. backend reconciles the checkout session
8. credits and plan entitlements are updated
9. header credit badge refreshes

Runtime plan data is persisted in:

- `user_subscriptions`
- `credit_ledger`
- `subscription_credit_top_ups`

### 2.3 Runtime Credit Top-Ups

Users on `Run` or `Warm Standby` can buy extra credits without changing plan.

Current top-up packs:

- `Quick Refill`: `+10` credits for `$5.99`
- `Builder Pack`: `+25` credits for `$12.99`
- `Power Pack`: `+60` credits for `$24.99`

Current UX:

1. user opens a purchased bundle
2. next to `Launch Run`, user clicks `Top Up Credits`
3. same-page modal shows pack choices and the expiry term
4. Stripe checkout opens
5. Stripe returns user to the same bundle detail page
6. backend reconciles the top-up checkout session
7. credits are added to the current subscription balance

Current term shown in UI:

- `Top-up credits are added to your current balance and expire 90 days after purchase.`

---

## 3. Runtime Plans

Current source of truth: `lib/subscription-plans.ts`

Frontend positioning (current implementation):

- pricing page sells these plans as **runtime operating modes**
- public pricing comparison focuses on the three paid runtime tiers: `Run`, `Warm Standby`, and `Always On`
- `Free` is explained as discovery/browse access in the hero but excluded from the plan card grid
- `Warm Standby` is marked as **Recommended** on the pricing page
- primary decision axis is:
  - when to use the plan
  - what runtime behavior it unlocks
  - whether the next session starts fresh, wakes recoverably, or stays live
  - what workload it is meant for
- credits are supporting information, not the main comparison surface
- credit model is surfaced prominently: **1 credit = 1 successful launch or wake**
- top-up packs are mentioned in the "How pricing works" steps and in the decision FAQ
- plan cards show: best for, runtime behavior, persistence, recovery model, budget, metrics, includes
- the detailed comparison table compares:
  - runtime behavior
  - state after stop
  - recovery model
  - agents per launched bundle
  - trigger mode

### Free

- Price: `$0`
- Included Credits: `0`
- Agents per Bundle: `0`
- Trigger Mode: `none`
- Runtime Access: `false`
- Best for: browsing, previewing, claiming free agents

### Run

- Price: `$5`
- Included Credits: `8`
- Agents per Bundle: `3`
- Trigger Mode: `manual`
- Runtime Access: `true`
- Best for: testing one workflow manually
- Public positioning: bounded manual session where the session ends automatically after 30 minutes
- Persistence framing: ephemeral session
- State after stop: may be fully cleaned up rather than preserved as a warm recoverable environment

### Warm Standby

- Price: `$19/mo`
- Included Credits: `24`
- Agents per Bundle: `Unlimited`
- Trigger Mode: `auto_wake`
- Runtime Access: `true`
- Best for: repeat Telegram-triggered workflows
- Public positioning: wake on message, wake sessions last up to 60 minutes, state is preserved for later resume, no self-hosting
- Persistence framing: recoverable state
- State after stop: should sleep/stop while preserving recoverable state for later wake or recovery
- Current backend behavior:
  - paired Telegram inbound messages can auto-resume a stopped Warm Standby runtime
  - stopped Warm Standby runtimes can also be terminated explicitly to release preserved state and unblock a fresh launch
  - Telegram ownership is state-based:
    - while the runtime is stopped, the app webhook owns the bot so pairing and Warm wake can work
    - after successful launch/resume, the app deletes the webhook so OpenClaw can use Telegram long polling
    - when the runtime stops again, the app reclaims the webhook
  - when a recoverable Warm runtime stops, the app can notify the paired Telegram user that the sandbox stopped and that any new message will wake it again
  - when a launched or resumed runtime later becomes Control-UI-ready, the app can notify the paired Telegram user that the sandbox is ready for use
  - this is conservative, not fuzzy routing:
    - if one live run already exists, backend only records activity
    - if exactly one stopped recoverable Warm run exists for that bundle/order, backend resumes it
    - if multiple stopped recoverable Warm candidates exist, backend does not guess

### Always On

- Price: `$149/mo`
- Included Credits: `100`
- Agents per Bundle: `Unlimited`
- Trigger Mode: `always_active`
- Runtime Access: `true`
- Best for: one core workspace running full time
- Public positioning: persistent workspace / long-running managed setup
- Persistence framing: live persistence
- State after stop: stopping is not the normal model; the workspace is meant to stay live

Important nuance:

- concurrency and occupancy limits may still exist in backend enforcement
- but they are no longer a primary user-facing pricing comparison axis
- Always On may still keep an internal `includedCredits` field, but the landing page should not sell it like a bigger credit pack

---

## 4. What Is Enforced Today

Launch guardrails are evaluated when the user clicks **Launch Run**.

Current enforcement happens in backend service logic, then the bundle UI reflects the result.

### 4.1 Runtime Access

If plan `runtimeAccess = false`, launch is blocked.

Effect:

- `Free` cannot launch runs

### 4.2 Agents Per Bundle

Rule:

- if `order.items.length > plan.agentsPerBundle`, launch is blocked

Effect:

- user may still buy a bundle larger than their plan allows
- but they cannot launch it unless they upgrade

This matches the intended product behavior.

### 4.3 One Live Run At A Time

Rule:

- if the user already has any live unreleased run, launching another run is blocked

Current live-run counting includes:

- `provisioning`
- `running`
- `completed` if `usesRealWorkspace = true` **and** the workspace has not been released yet

Current blocker copy:

- `Stop your current live run before starting another one.`

This is now global per user, regardless of plan tier.

### 4.4 Warm Standby Must Reuse Recoverable State

Rule:

- if a `warm_standby` user already has a stopped or archived recoverable run for the same bundle, launching a brand-new run is blocked

Current blocker copy:

- `Resume or terminate the existing stopped Warm Standby run for this bundle instead of launching a new one.`

Effect:

- Warm Standby is now enforced as a wake/recover product, not a “keep launching fresh history” product
- this prevents users from creating a chain of abandoned recoverable runs for the same bundle
- the intended path is:
  - launch once
  - later sleep/stop
  - later resume/wake or explicitly terminate the preserved runtime if they want a fresh launch

### 4.5 Credits Remaining

Rule:

- if user has a paid plan and `remainingCredits <= 0`, launch is blocked

Current behavior:

- `Run` and `Warm Standby` now reserve `1` credit before provider boot
- if provider accepts the launch, the reserve is committed
- if provider never accepts, the reserve is refunded
- top-up credits are consumed ahead of non-expiring plan balance
- expired top-up credits are swept on read / launch-policy check / reserve flows
- `Always On` does not use the same hard launch-credit deduction path
- runs are not stopped mid-session just because credits later become low

So this is now a real credit-consumption engine for launch/wake entry, but not yet a full runtime metering model.

### 4.6 Telegram Pairing

This is not part of pricing, but it is part of launch eligibility.

Rule:

- Telegram token must be validated
- recipient pairing must be complete
- pairing completion is webhook-based, not Telegram `getUpdates` polling
- local/dev pairing therefore requires a public HTTPS webhook URL

So even a paid user still cannot launch until Telegram setup is ready.

---

## 5. What Is Persisted

### 5.1 Subscription State

Stored in `user_subscriptions`:

- selected plan
- plan version
- billing interval
- included credits
- remaining credits
- Stripe checkout/session/subscription references
- current billing period timestamps

### 5.2 Credit Ledger

Stored in `credit_ledger`:
- grants and resets from plan purchase
- pending reserves before launch
- commits after provider acceptance
- refunds if provider acceptance never happens
- idempotency keys per launch/restart charging attempt

### 5.3 Run Usage

Stored in `run_usage`:

- plan id + plan version snapshot
- trigger mode snapshot
- agent count
- workspace/tools/network flags
- provisioning timestamp
- provider acceptance timestamp
- running timestamp
- stop timestamp
- workspace release timestamp
- termination reason
- total runtime minutes
- TTL policy snapshot used for that run

Currently used for:

- launch time tracking
- stop time tracking
- termination reason tracking
- total runtime minute tracking
- plan-type telemetry for the run

Not fully used yet for:

- per-run consumption
- per-agent overage pricing
- runtime burn accounting

### 5.4 Runtime Lifecycle State

Stored in `runtime_instances`:

- provider sandbox / instance reference
- runtime mode
- persistence mode
- provider lifecycle state
- stop reason
- preserved-state availability
- archived / deleted / released timestamps
- recoverable-until timestamp for recoverable runtimes

Stored in `runtime_intervals`:

- each started/stopped runtime window
- interval close reason
- multiple intervals across restart / recover flows

Current reconciliation model:

- pull-based, not webhook-based
- provider state is reconciled on read and runtime actions
- missing runtime records can be backfilled from provider state
- a dedicated background maintenance sweep is still a separate follow-up slice

---

## 6. Stripe Behavior

### 6.1 Agent Orders

- free agent bundles bypass Stripe
- if bundle total is not zero, Stripe order checkout is used

### 6.2 Runtime Plans

- `Run` currently behaves like a one-time Stripe payment
- `Warm Standby` and `Always On` behave like recurring monthly Stripe subscriptions

On successful checkout:

1. backend validates session ownership and payment state
2. plan is upserted into `user_subscriptions`
3. credits are reset to the plan’s included credits
4. a `credit_ledger` row is written

Current implication:

- purchasing a new plan overwrites the current included/remaining credit state
- there is not yet nuanced upgrade/downgrade proration logic

### 6.3 Stripe Billing Portal

Users with an active Stripe subscription (`Warm Standby` or `Always On`) can manage their subscription through Stripe's hosted Billing Portal.

Current flow:

1. user navigates to `/app/account`
2. user clicks **Manage Subscription**
3. backend creates a Stripe Billing Portal session using the stored `stripeCustomerId`
4. user is redirected to Stripe's hosted portal
5. user can cancel, update payment method, or view invoices
6. after finishing, Stripe redirects back to `/app/account`

API route: `POST /api/me/subscription/portal`

Backend: `SubscriptionService.createBillingPortalSession()`

Requirements:

- Stripe Billing Portal must be configured in the Stripe Dashboard (Settings > Billing > Customer Portal)
- cancellation behavior, proration, and branding are configured in the Stripe Dashboard, not in application code
- webhook handling for `customer.subscription.deleted` is not yet implemented (Stripe portal changes are not yet automatically reflected in `user_subscriptions`)

---

## 7. UI Behavior

### 7.1 Bundle Detail

Bundle detail currently shows:

- launch blockers
- current plan
- current credits
- agents-per-bundle limit
- runtime mode

If blocked by plan:

- user can open an in-place plan modal
- user does not need to leave the bundle page

### 7.2 Account Page

Route: `/app/account`

Account page shows:

- user profile (name, email)
- current plan name and price
- remaining credits
- **Manage Subscription** button (only for users with a Stripe subscription)
- for Free users: guidance to purchase a plan from a bundle page
- for one-time Run users: note that there is no recurring billing to manage

Account is linked from the app sidebar navigation.

### 7.3 Header

Header shows:

- current signed-in user
- current remaining credits

Header refreshes when:

- page regains focus
- subscription purchase reconciliation finishes

---

## 8. Intended Semantics vs Current Implementation

This section matters most for reasoning whether the current plan design is good.

### 8.1 Intended Semantics

The intended business logic appears to be:

1. agent ownership is one layer
2. runtime entitlement is a separate layer
3. plans constrain operational usage
4. credits should represent consumption budget
5. higher tiers should allow:
   - larger bundles
   - more concurrency
   - more active bundles
   - different wake/runtime behavior

### 8.2 What Is Actually Implemented

Implemented now:

1. plan purchase
2. entitlement persistence
3. launch-time gating by:
   - runtime access
   - agents per bundle
   - one live unreleased run at a time
   - Warm Standby resume-instead-of-relaunch when recoverable state already exists for the same bundle
   - zero remaining credits
4. inline upgrade UX on bundle detail
5. reserve -> commit -> refund credit handling for `Run` and `Warm Standby`
6. run-usage telemetry persistence separate from the billing ledger
7. partial trigger-mode behavior:
   - Warm Standby can now auto-wake from paired Telegram inbound traffic
8. account page with profile and subscription overview
9. subscription cancellation via Stripe Billing Portal (for Warm Standby and Always On)

### 8.3 What Is Not Yet Implemented

Not implemented yet:

1. **credit pricing model**
   - there is no formula for how many credits a run costs
   - there is no formula for “one more agent costs X”
2. **full trigger mode behavior**
   - `auto_wake` is now partially real for Warm Standby via paired Telegram inbound wake
   - but trigger behavior is not complete across all channels or all runtime situations
   - `always_active` still does not have a fully distinct operational path
3. **always-on enforcement**
   - `alwaysOnBundles` is defined
   - real always-on lifecycle behavior is not fully implemented
4. **TTL cleanup worker / idle enforcement**
   - TTL policy is now snapshotted per run
   - automatic cleanup scheduling and retry are not fully implemented yet
5. **plan lifecycle sophistication**
   - no proration logic
   - cancellation is delegated to Stripe Billing Portal but webhook handling for `customer.subscription.deleted` is not yet implemented (cancelled subscriptions are not yet automatically downgraded to Free in `user_subscriptions`)
   - no credit carry-over policy

---

## 9. Practical Product Interpretation

If another AI is evaluating whether the pricing model is good, it should understand:

### What the system already supports well

- free browsing and agent acquisition
- strict launch gating by entitlement
- clear bundle-size and live-run constraints
- a separate runtime monetization layer
- upgrade-in-context at the point of friction
- Warm Standby now behaves more like a real wake/recover product instead of just a monthly price label
- account page with subscription overview and Stripe Billing Portal for cancellation
- streamlined pricing page that sells operating modes, highlights Warm Standby as recommended, and surfaces the credit model prominently

### What the system does not yet prove

- whether credits are the right unit of monetization
- whether included credits are priced correctly
- whether `Run` should really be one-time instead of monthly
- whether `Warm Standby` and `Always On` are differentiated enough operationally
- whether the conservative one-live-run policy is too restrictive for real users
- whether users will understand why buying agents is free but using them is gated

---

## 10. Key Questions Another AI Should Evaluate

Another reasoning model should focus on questions like:

1. Is the separation between **free agent ownership** and **paid runtime access** intuitive?
2. Is a one-time `$5` `Run` plan with `8` credits coherent, or should it be a metered pack instead of a plan?
3. Should `completed + managed workspace` count against concurrency and active bundles?
4. Are `Warm Standby` and `Always On` distinct enough now that Warm can sleep and wake from Telegram, or do they still need a bigger operational gap?
5. Should credits reset, roll over, or accumulate?
6. Is `agents per bundle` the best control surface, or should pricing be based on active specialist count at runtime?
7. Is recoverable-state reuse the right enforcement model for Warm Standby, or will users expect multiple recoverable runs per bundle?
8. Does the current model create too much friction for multi-agent bundles?

---

## 11. Bottom Line

Current state:

- the entitlement framework is real
- the launch constraints are real
- the UI and Stripe runtime-plan purchase flow are real
- the pricing page is streamlined for MVP launch
- subscription cancellation is available via Stripe Billing Portal
- the pricing semantics are only partially realized

In other words:

- **plan gating exists**
- **plan cancellation exists** (via Stripe portal, not yet webhook-reconciled)
- **credit economics do not fully exist yet**

Any evaluation of whether the current plan is “best for the world” should treat the current system as:

1. a valid entitlement architecture
2. a usable subscription lifecycle (purchase + cancel via Stripe)
3. an incomplete billing/consumption model
