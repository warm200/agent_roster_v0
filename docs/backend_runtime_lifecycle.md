---
summary: Backend runtime lifecycle design and current implementation status for Run, Warm Standby, and Always On.
read_when:
  - Reviewing how managed runtime lifecycle differs by plan on the backend.
  - Reasoning about Daytona sandbox stop, resume, archive, delete, and billing behavior.
---

# Backend Runtime Lifecycle

## Purpose

This document explains what the backend currently implements for managed runtime lifecycle control across plans.

It covers:

- lifecycle state modeling
- billing/lifecycle interaction
- Daytona provider behavior
- reconciliation and maintenance
- what is implemented vs still deferred

## Core Model

The backend no longer treats a run as only a single flat status row.

It now uses three related layers:

1. `runs`
   - user-facing session row
   - still exposed primarily as:
     - `provisioning`
     - `running`
     - `completed`
     - `failed`

2. `runtime_instances`
   - provider lifecycle row
   - tracks the Daytona sandbox/runtime lifecycle itself
   - includes:
     - provider ref
     - plan id
     - runtime mode
     - persistence mode
     - runtime state
     - stop reason
     - archived/deleted/released timestamps
     - recoverable-until timestamp

3. `runtime_intervals`
   - one row per active runtime window
   - used to track actual started/stopped intervals separately from billing ledger events

Related usage/billing state still lives in `run_usage`.

## Provider Boundary

Runtime lifecycle is routed through the provider interface in:

- [run-provider.interface.ts](/Users/wallacewang/agent_projects/v0_version/server/providers/run-provider.interface.ts)

The lifecycle-facing methods now include:

- `createRuntimeInstance(...)`
- `getRuntimeInstance(...)`
- `stopRuntimeInstance(...)`
- `restartRuntimeInstance(...)`
- `archiveRuntimeInstance(...)`
- `recoverRuntimeInstance(...)`
- `deleteRuntimeInstance(...)`

This keeps Daytona-specific behavior behind the provider boundary so another runtime provider can later implement the same contract.

## Current Provider

Current runtime provider:

- Daytona

Implementation:

- [daytona.provider.ts](/Users/wallacewang/agent_projects/v0_version/server/providers/daytona.provider.ts)

The Daytona adapter currently supports:

- plan-aware sandbox creation settings
- runtime state reads
- stop
- restart
- archive
- recover
- delete
- control UI links

## Plan Semantics

The plan-aware lifecycle policy is defined in:

- [runtime-policy.ts](/Users/wallacewang/agent_projects/v0_version/server/services/runtime-policy.ts)

### Run

Intent:

- bounded temporary execution

Lifecycle policy:

- `persistenceMode = ephemeral`
- `runtimeMode = temporary_execution`
- short auto-stop window
- no recoverable warm state

Backend behavior:

- launch creates a fresh sandbox
- when the runtime stops, backend treats it as ephemeral
- stopped runtime is explicitly deleted on reconcile / stop
- only product-level outputs remain in DB:
  - logs
  - result summary
  - artifacts
  - usage metadata

Meaning:

- the next execution is a new launch from scratch

### Warm Standby

Intent:

- wake-on-demand runtime with recoverable state

Lifecycle policy:

- `persistenceMode = recoverable`
- `runtimeMode = wakeable_recoverable`
- longer auto-stop window
- no immediate delete on stop
- optional archive later

Backend behavior:

- launch creates a sandbox
- stop preserves stopped state
- if stopped long enough, reconcile may archive it
- `recoverableUntilAt` is derived from archive threshold
- stopped or archived recoverable runtimes can resume later on the same run id

Meaning:

- this is not a full-time live workspace
- but it also does not restart from zero every time

### Always On

Intent:

- persistent live workspace

Lifecycle policy:

- `persistenceMode = live`
- `runtimeMode = persistent_live_workspace`
- no short product idle timeout
- no short product TTL
- only safety-oriented timeout fields exist

Backend behavior:

- no normal stop/delete cycle like `Run`
- no sleep-and-recover path as the main product behavior
- stop is treated as exceptional or operational rather than the default lifecycle

Meaning:

- this is the “stay live” tier, not the “sleep and recover” tier

## Launch Flow

Launch orchestration lives in:

- [run.service.ts](/Users/wallacewang/agent_projects/v0_version/server/services/run.service.ts)

Current launch flow:

1. load order and launch policy
2. enforce plan guardrails
3. reserve launch/wake credit when applicable
4. create `runs` row in `provisioning`
5. create `run_usage` row with plan-specific TTL snapshot
6. create Daytona runtime instance using the plan lifecycle policy
7. persist `runtime_instances`
8. commit reserved credit after provider acceptance
9. open runtime interval once runtime becomes active

## Billing Interaction

Credit behavior is connected to lifecycle, but kept separate from runtime interval telemetry.

Current rules:

### Run and Warm Standby

- reserve `1` credit before launch/restart
- commit after provider acceptance
- refund if provider never successfully accepts/starts

### Always On

- does not use the same per-launch hard credit path in MVP

This logic lives primarily in:

- [subscription.service.ts](/Users/wallacewang/agent_projects/v0_version/server/services/subscription.service.ts)
- [run.service.ts](/Users/wallacewang/agent_projects/v0_version/server/services/run.service.ts)

## Reconciliation Model

Lifecycle is currently pull-based.

That means backend state gets refreshed when the system touches a run, rather than relying on Daytona webhooks.

Current reconciliation sources:

- run detail reads
- runs list reads
- manual stop
- restart
- maintenance batches
- paired Telegram inbound messages for already-paired orders

Current behavior:

- re-read provider runtime state
- merge it into `runtime_instances`
- map back into the visible `run`
- open/close `runtime_intervals`
- release capacity when workspace is no longer live

Important implemented properties:

- stale provider status can be overridden by persisted runtime-instance state
- missing runtime rows can be backfilled from provider state on read
- if provider status becomes unavailable but runtime state exists, capacity can still be released correctly
- if provider reads fail with an already-stopped sandbox path, refresh/read now repairs stale `runtime_instances.state = running` rows into stopped or released lifecycle state
- explicit stop requests are idempotent against already stopped Daytona sandboxes and should reconcile back to stopped state instead of bubbling `Sandbox is not started`
- archived Daytona sandboxes now restart with the correct `start()` path, and backend waits for toolbox readiness before replaying restart bootstrap
- paired Telegram inbound traffic can now auto-resume exactly one stopped Warm Standby runtime for the order
- stopped Warm Standby runtimes can also be terminated explicitly, which deletes preserved state and clears launch-policy reuse blockers for that bundle
- Control UI exposure is now readiness-gated:
  - OpenClaw must flip the run into the ready summary before the button/link is offered
  - this avoids exposing Control UI while bootstrap is still in progress
- when a run transitions from not-ready to Control-UI-ready, backend can send a paired Telegram notice that the sandbox is ready
- auto-wake is intentionally conservative:
  - if a live run already exists, backend only records meaningful activity
  - if multiple stopped recoverable Warm candidates exist for the order, backend does not guess which one to wake

## Stop Behavior

Central stop path:

- `stopRunForReason(...)` in [run.service.ts](/Users/wallacewang/agent_projects/v0_version/server/services/run.service.ts)

Explicit reasons supported include:

- `manual_stop`
- `idle_timeout`
- `ttl_expired`
- `provisioning_timeout`
- `backend_maintenance`
- `provider_unhealthy`

### Run stop result

- runtime becomes stopped
- backend deletes sandbox
- runtime state becomes effectively released/deleted
- workspace no longer counts toward capacity

### Warm Standby stop result

- runtime becomes stopped
- state is preserved
- later reconcile may archive it
- runtime can later resume/recover

### Always On stop result

- no special short-session stop policy by default
- stop is not the intended everyday lifecycle

## Restart / Resume Behavior

Restart/resume lives in:

- [run.service.ts](/Users/wallacewang/agent_projects/v0_version/server/services/run.service.ts)

Implemented behavior:

- failed runs can restart
- recoverable runtimes can resume even when the user-facing run status is already `completed`
- if runtime state is:
  - `stopped`
  - or `archived`
  - and persistence mode is `recoverable`
  then the same run id can resume

This is what makes Warm Standby operationally different from Run.

## Archive Behavior

Archive is partially implemented.

Current behavior:

- recoverable stopped runtimes may be archived once stopped longer than the configured threshold
- archive is applied during reconciliation if the provider supports it

Meaning:

- archive policy exists
- archive action exists
- but it still depends on reads or maintenance execution, not webhooks

## Timeout and Inactivity Enforcement

TTL policy is snapshotted into `run_usage.ttlPolicySnapshot`.

Current enforcement path:

- [runtime-maintenance.service.ts](/Users/wallacewang/agent_projects/v0_version/server/services/runtime-maintenance.service.ts)

Maintenance can enforce:

- provisioning timeout
- max session TTL
- idle timeout
- timeout enforcement is evaluated on active runtimes directly; it does not wait for a runtime to become stale for reconciliation

Current default intent:

### Run

- short idle timeout
- bounded max session TTL

### Warm Standby

- longer idle timeout
- bounded max session TTL per wake

### Always On

- no normal product idle timeout
- no normal product TTL
- only safety-oriented timeout fields

## Meaningful Activity Clock

The backend now tracks:

- `run_usage.lastMeaningfulActivityAt`
- `run_usage.lastOpenClawSessionActivityAt`

This is used for idle-time enforcement.

Current producers:

- paired Telegram inbound messages for active runs on an order
- explicit internal activity route:
  - `POST /api/internal/runs/[runId]/activity`
- OpenClaw session probes during maintenance
  - sourced from `~/.openclaw/agents/*/sessions/sessions.json`
  - uses the max session `updatedAt`

Non-producers by design:

- dashboard polling
- viewing logs
- viewing results
- provider-synced runtime progress timestamps during reconciliation
- launch/restart/provider-accept transitions

This keeps idle timeout tied to actual runtime work rather than passive UI traffic.

## Maintenance Execution

Maintenance execution options:

- local one-shot:
  - `pnpm runtime:maintenance`
- local loop:
  - `pnpm runtime:maintenance:watch`
- hosted trigger:
  - `pnpm runtime:maintenance:trigger`

Internal routes:

- `POST /api/internal/runtime-maintenance/reconcile`
- `GET /api/internal/runtime-maintenance/reconcile`

Auth:

- `INTERNAL_API_TOKEN`
- or `CRON_SECRET`

Scheduler/ops runbook:

- [runtime_maintenance_ops.md](/Users/wallacewang/agent_projects/v0_version/docs/runtime_maintenance_ops.md)

## User-Facing Status Exposure

The public run model is still somewhat collapsed.

Primary user-facing run statuses remain:

- `provisioning`
- `running`
- `completed`
- `failed`

But backend/runtime state now also supports secondary lifecycle cues such as:

- sleeping
- archived
- released

These are already surfaced in run list/detail UI, even though the main public run status enum has not been fully expanded.

## Implemented vs Deferred

### Implemented

- provider-neutral lifecycle interface
- Daytona lifecycle adapter
- `runtime_instances`
- `runtime_intervals`
- plan-aware Run / Warm Standby / Always On lifecycle policy
- pull-based reconciliation
- manual stop/restart tied to runtime state
- recoverable Warm Standby resume
- maintenance-enforced provisioning timeout
- maintenance-enforced max session TTL
- maintenance-enforced idle timeout
- activity clock
- Telegram activity producer
- provider-progress activity producer
- hosted/local maintenance execution paths

### Deferred

- Daytona webhooks
- Daytona audit-log reconciliation
- volume-backed persistence tier
- fully expanded public lifecycle enum in API
- broader activity producers from every runtime/tool step
- separate Always On health/recycle orchestration loop

## Practical Summary

Today the backend behavior is:

- `Run`
  - launch credit buys a bounded ephemeral session
  - after stop, sandbox state is not kept as recoverable warm state

- `Warm Standby`
  - wake credit buys a wakeable session with recoverable state
  - after stop, runtime can sleep, later resume, and later archive

- `Always On`
  - persistent live workspace intent
  - not treated like a bounded temporary session

That is the current backend lifecycle model.
