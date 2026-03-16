---
summary: Runtime pricing-plan reference for AgentRoster, including current product flow, enforced constraints, and known gaps.
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

AgentRoster is a productized platform for:

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

---

## 3. Runtime Plans

Current source of truth: `lib/subscription-plans.ts`

Frontend positioning:

- pricing page should sell these plans as **runtime operating modes**
- primary decision axis is:
  - when to use the plan
  - what runtime behavior it unlocks
  - what happens to state when it stops
  - whether the next session starts fresh, wakes recoverably, or stays live
  - what workload it is meant for
- credits are supporting information, not the main comparison surface
- the detailed comparison section should compare:
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
- Included Credits: `15`
- Agents per Bundle: `3`
- Trigger Mode: `manual`
- Runtime Access: `true`
- Best for: testing one workflow manually
- Public positioning: bounded manual session with auto-stop after inactivity
- Persistence framing: ephemeral session
- State after stop: may be fully cleaned up rather than preserved as a warm recoverable environment

### Warm Standby

- Price: `$19/mo`
- Included Credits: `10`
- Agents per Bundle: `5`
- Trigger Mode: `auto_wake`
- Runtime Access: `true`
- Best for: repeat Telegram-triggered workflows
- Public positioning: wake on message, auto-sleeps when idle, no self-hosting
- Persistence framing: recoverable state
- State after stop: should sleep/stop while preserving recoverable state for later wake or recovery

### Always On

- Price: `$149/mo`
- Included Credits: `100`
- Agents per Bundle: `8`
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

### 4.3 Concurrent Runs

Rule:

- if user already has too many active runs, launch is blocked

Current active-run counting includes:

- `provisioning`
- `running`
- `completed` if `usesRealWorkspace = true` **and** the workspace has not been released yet

This matters because sandbox-backed runs can remain capacity-occupying after bootstrap, but they stop counting once cleanup or manual stop releases the workspace.

### 4.4 Active Bundles

Rule:

- distinct `orderId`s across active runs are counted as active bundles
- if active bundle count reaches the plan limit, launching another bundle is blocked

### 4.5 Credits Remaining

Rule:

- if user has a paid plan and `remainingCredits <= 0`, launch is blocked

Current behavior:

- `Run` and `Warm Standby` now reserve `1` credit before provider boot
- if provider accepts the launch, the reserve is committed
- if provider never accepts, the reserve is refunded
- `Always On` does not use the same hard launch-credit deduction path
- runs are not stopped mid-session just because credits later become low

So this is now a real credit-consumption engine for launch/wake entry, but not yet a full runtime metering model.

### 4.6 Telegram Pairing

This is not part of pricing, but it is part of launch eligibility.

Rule:

- Telegram token must be validated
- recipient pairing must be complete

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
- running/completed timestamps
- workspace release timestamp
- termination reason
- TTL policy snapshot used for that run
- credit delta
- resulting balance
- reason
- metadata

Currently used for:

- initial purchase / plan update bookkeeping

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

### 7.2 Header

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
   - concurrent runs
   - active bundles
   - zero remaining credits
4. inline upgrade UX on bundle detail
5. reserve -> commit -> refund credit handling for `Run` and `Warm Standby`
6. run-usage telemetry persistence separate from the billing ledger

### 8.3 What Is Not Yet Implemented

Not implemented yet:

1. **credit pricing model**
   - there is no formula for how many credits a run costs
   - there is no formula for “one more agent costs X”
2. **trigger mode behavior**
   - `manual`, `auto_wake`, `always_active` exist as plan metadata
   - they do not yet drive runtime orchestration behavior
3. **always-on enforcement**
   - `alwaysOnBundles` is defined
   - real always-on lifecycle behavior is not fully implemented
4. **TTL cleanup worker / idle enforcement**
   - TTL policy is now snapshotted per run
   - automatic cleanup scheduling and retry are not fully implemented yet
5. **plan lifecycle sophistication**
   - no proration logic
   - no downgrade/cancel management flow
   - no credit carry-over policy

---

## 9. Practical Product Interpretation

If another AI is evaluating whether the pricing model is good, it should understand:

### What the system already supports well

- free browsing and agent acquisition
- strict launch gating by entitlement
- clear bundle-size and concurrency constraints
- a separate runtime monetization layer
- upgrade-in-context at the point of friction

### What the system does not yet prove

- whether credits are the right unit of monetization
- whether included credits are priced correctly
- whether `Run` should really be one-time instead of monthly
- whether `Warm Standby` and `Always On` are differentiated enough operationally
- whether active-bundle counting should include completed managed workspaces
- whether users will understand why buying agents is free but using them is gated

---

## 10. Key Questions Another AI Should Evaluate

Another reasoning model should focus on questions like:

1. Is the separation between **free agent ownership** and **paid runtime access** intuitive?
2. Is a one-time `$5` `Run` plan with `15` credits coherent, or should it be a metered pack instead of a plan?
3. Should `completed + managed workspace` count against concurrency and active bundles?
4. Are `Warm Standby` and `Always On` distinct enough without stronger runtime behavior differences?
5. Should credits reset, roll over, or accumulate?
6. Is `agents per bundle` the best control surface, or should pricing be based on active specialist count at runtime?
7. Is `active bundles` the right abstraction, or should the product charge for warm/always-on workspace occupancy directly?
8. Does the current model create too much friction for multi-agent bundles?

---

## 11. Bottom Line

Current state:

- the entitlement framework is real
- the launch constraints are real
- the UI and Stripe runtime-plan purchase flow are real
- the pricing semantics are only partially realized

In other words:

- **plan gating exists**
- **credit economics do not fully exist yet**

Any evaluation of whether the current plan is “best for the world” should treat the current system as:

1. a valid entitlement architecture
2. an incomplete billing/consumption model
