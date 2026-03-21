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
- if provider state is missing after a stop/release, stale `runtime_instances` rows are now healed out of `running`
- missing `runtime_instances` rows can be backfilled from provider state on read
- stale runtime instances can now be batch-reconciled by the maintenance service
- timeout enforcement no longer depends on a runtime becoming stale for reconciliation
- maintenance now self-heals stale `runtime_instances` rows when usage is already released
- run UI badges now follow lifecycle state, so Warm stopped runtimes render as `Stopped` and offer resume instead of looking merely `Completed`
- launch and bundle launch-policy reads now reconcile existing managed runs first, so manually deleted Daytona sandboxes do not keep blocking new runs as “live”
- failed resume/restart attempts now re-sync persisted runtime state before surfacing the error, so run pages fall back to `Stopped`/resume instead of stale live controls
- externally stopped Daytona sandboxes now self-heal stale `running` runtime rows on refresh/read when provider access reports a stopped sandbox path
- explicit stop requests are now idempotent against already stopped Daytona sandboxes instead of surfacing `Sandbox is not started` back to the UI
- archived Daytona sandboxes now restart via `start()` instead of `recover()`, which fixes archived Warm resume/wake
- paired Telegram inbound messages can now auto-resume exactly one stopped Warm Standby runtime for the order
- stopped Warm Standby runtimes can now be terminated explicitly, which deletes preserved state and clears the fresh-launch blocker for that bundle
- Telegram bot ownership now hands off by runtime state:
  - pairing / stopped Warm state => app webhook owns the bot
  - live launched / resumed runtime => app deletes the webhook so OpenClaw can use Telegram long polling
  - stop / terminate reclaims the app webhook for later pairing or Warm wake
- Control UI is now gated on actual OpenClaw readiness rather than raw `runtimeState = running`
  - UI button stays disabled until the existing OpenClaw process probe flips the ready summary
  - Control UI link creation uses the same readiness gate on the server
- runs can now send one paired Telegram notice when they transition from not-ready to Control-UI-ready
  - message tells the user the sandbox is ready and the bot can receive messages again
- paired Telegram auto-wake now sends an immediate waiting notice while a stopped Warm sandbox is resuming
  - message tells the user OpenClaw is waking and that the agent will reply after it is back
- auto-wake is intentionally conservative:
  - if the order already has a live run, it only records activity
  - if the order has multiple stopped recoverable Warm candidates, it does not guess
- if a paired Telegram wake is blocked because the subscription has no runtime credits left, the webhook now sends a paired "credits exhausted" notice instead of surfacing only a generic webhook failure
- internal trigger route exists at `POST /api/internal/runtime-maintenance/reconcile`
- cron-compatible GET trigger exists at `GET /api/internal/runtime-maintenance/reconcile`
- CLI/cron entrypoint exists:
  - `pnpm runtime:maintenance`
  - `pnpm runtime:maintenance:watch`
  - `pnpm runtime:maintenance:trigger`
- maintenance CLI now fails fast if it resolves the mock provider unexpectedly
- maintenance can now enforce:
  - provisioning timeout
  - max session TTL
  - idle timeout when meaningful activity timestamps are present
  - even while active page reads keep provider state freshly reconciled

### Meaningful activity clock

- `run_usage.lastMeaningfulActivityAt` now exists
- `run_usage.lastOpenClawSessionActivityAt`, `lastOpenClawSessionProbeAt`, and `openClawSessionCount` now exist
- repository access is backward-compatible with pre-`0006` dev databases that do not have the column yet
- internal activity touch route exists at:
  - `POST /api/internal/runs/[runId]/activity`
- page reads do not update the activity clock
- first real producer is wired:
  - inbound Telegram messages for already-paired orders touch active unreleased runs on that order
- maintenance now probes OpenClaw session stores directly and uses the max session `updatedAt` as the real sandbox idle clock
- provider-side progress timestamps no longer advance meaningful activity

### Plan-aware stop behavior

- `Run`
  - ephemeral
  - stopped runtime is deleted on reconcile / stop
- `Warm Standby`
  - recoverable
  - stopped runtime is preserved
  - archived later when stopped long enough and reconciliation runs
  - completed stopped / archived runtimes can be resumed on the same run id
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
- run list/detail now surface sleeping / archived / released labels
- recoverable-until is now shown on run detail

## Not Shipped Yet

### Background cleanup / maintenance loop

- maintenance service exists for batch stale-runtime reconciliation
- opt-in recurring loop exists through:
  - `pnpm runtime:maintenance:watch`
- remote scheduler trigger exists through:
  - `pnpm runtime:maintenance:trigger`
- external scheduling/hosting is still required
- current cleanup no longer depends only on user reads if the loop or CLI is running
- ops runbook exists in:
  - `docs/runtime_maintenance_ops.md`

### Idle-time / TTL enforcement loop

- maintenance can enforce:
  - provisioning timeout
  - max session TTL
  - idle timeout
- meaningful activity is now tracked separately from passive reads
- coverage is still partial because only some producers currently touch the activity clock

### Webhook-driven reconciliation

- intentionally deferred
- no Daytona webhook ingestion yet

### Audit-log repair flow

- no fallback reconciliation from Daytona audit logs yet

### Volume-backed persistence

- sandbox-state persistence only
- no explicit volume tier or separate volume lifecycle yet

### User-facing lifecycle states

- list/detail now show secondary lifecycle labels for:
  - sleeping
  - archived
  - released
- primary run status is still collapsed to:
  - provisioning
  - running
  - completed
  - failed
- there is still no full dedicated lifecycle enum in the public API

## Next Recommended Slice

1. add more meaningful-activity producers beyond Telegram
2. wire recurring maintenance into real hosting/ops
3. expose richer runtime lifecycle states in user-facing UI
4. later add audit-log repair or webhook reconciliation if pull-based drift becomes a problem
