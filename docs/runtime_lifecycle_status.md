---
summary: Running implementation tracker for managed runtime lifecycle, reconciliation, cleanup, and persistence behavior.
read_when:
  - Continuing runtime lifecycle work and needing a checklist of shipped vs pending pieces.
  - Checking whether cleanup, persistence, or Daytona lifecycle behavior is already implemented.
---

# Runtime Lifecycle Status

## Shipped

### Provider boundary

- provider-facing lifecycle methods exist in `server/providers/run-provider.interface.ts`
- Daytona implements:
  - create runtime instance
  - get runtime instance
  - stop runtime instance
  - restart runtime instance
  - archive runtime instance
  - recover runtime instance
  - delete runtime instance

### Persistence model

- `runtime_instances` table exists
- `runtime_intervals` table exists
- runtime state tracks:
  - provider ref
  - plan code
  - runtime mode
  - persistence mode
  - provider lifecycle state
  - stop reason
  - archived / deleted / released timestamps
  - recoverable-until timestamp

### Billing alignment

- `Run` and `Warm Standby` reserve 1 credit before launch/restart
- reserve commits after provider acceptance
- reserve refunds when provider never accepts
- `Always On` does not use the same hard launch-credit path in MVP

### Pull-based reconciliation

- run detail reads reconcile provider state into DB
- list reads reconcile latest visible state
- manual stop and restart update runtime state + intervals
- stale provider status can be overridden by runtime-instance state
- if provider status is unavailable but runtime state exists, capacity still gets released correctly
- missing `runtime_instances` rows can be backfilled from provider state on read
- stale runtime instances can now be batch-reconciled by the maintenance service
- internal trigger route exists at `POST /api/internal/runtime-maintenance/reconcile`
- maintenance can now enforce:
  - provisioning timeout
  - max session TTL
  - idle timeout when meaningful activity timestamps are present

### Meaningful activity clock

- `run_usage.lastMeaningfulActivityAt` now exists
- launch/restart/reconcile initialize it when runtime becomes active
- internal activity touch route exists at:
  - `POST /api/internal/runs/[runId]/activity`
- page reads do not update the activity clock

### Plan-aware stop behavior

- `Run`
  - ephemeral
  - stopped runtime is deleted on reconcile / stop
- `Warm Standby`
  - recoverable
  - stopped runtime is preserved
  - archived later when stopped long enough and reconciliation runs
- `Always On`
  - no short-session cleanup policy by default
  - treated as live persistence intent

## Partially Shipped

### Auto-archive

- policy exists
- read-time reconciliation can archive stale Warm Standby runtimes
- no dedicated background sweep loop yet

### Recoverable state window

- `recoverableUntilAt` is derived and stored
- UI does not yet surface it as a first-class runtime status

## Not Shipped Yet

### Background cleanup / maintenance loop

- maintenance service exists for batch stale-runtime reconciliation
- no recurring worker/cron is scheduling it yet
- current cleanup depends on user reads plus explicit maintenance triggers

### Idle-time / TTL enforcement loop

- policy exists in docs and config
- maintenance can enforce provisioning timeout and max session TTL when invoked
- idle-time enforcement is still pending because meaningful activity is not yet tracked separately from passive reads

### Webhook-driven reconciliation

- intentionally deferred
- no Daytona webhook ingestion yet

### Audit-log repair flow

- no fallback reconciliation from Daytona audit logs yet

### Volume-backed persistence

- sandbox-state persistence only
- no explicit volume tier or separate volume lifecycle yet

### User-facing lifecycle states

- backend knows `stopped`, `archived`, `deleted`
- primary user-facing run status is still collapsed to:
  - provisioning
  - running
  - completed
  - failed

## Next Recommended Slice

1. add a background runtime maintenance service
2. expose or schedule it through cron/admin/internal job
3. use it to apply archive/delete/release rules without waiting for page reads
4. later add explicit idle/TTL evaluation on top
