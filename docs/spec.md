---
summary: Product spec map for AgentRoster, including where runtime, pricing, credits, and preview behavior are documented.
read_when:
  - Starting work in this repo and deciding which product/runtime doc to read first.
  - Changing preview chat, pricing, runtime lifecycle, bundles, or checkout behavior.
---

# AgentRoster Spec Map

## Product Summary

AgentRoster is a managed-agent marketplace and runtime product.

Core user flow:

1. browse agents in the catalog
2. preview agent behavior for free
3. collect or buy agents into a bundle
4. configure Telegram and runtime setup
5. launch the bundle into a managed runtime
6. monitor run state, logs, results, and artifacts
7. reopen a recoverable runtime or keep a live workspace, depending on plan

Important product distinction:

- agents are free to collect
- managed runtime is the paid product
- runtime plans differ by behavior and persistence, not just credits
- catalog pages should render real synced/DB-backed agents only; mock catalog fallback is not part of the product

## Source Of Truth

Use these docs by topic:

- [pricing_plan.md](/Users/wallacewang/agent_projects/v0_version/docs/pricing_plan.md)
  - runtime pricing model
  - what plans mean publicly
  - what constraints are actually enforced today
  - runtime credit top-up packs and 90-day expiry terms
- [credit_consuming_logic.md](/Users/wallacewang/agent_projects/v0_version/docs/credit_consuming_logic.md)
  - reserve / commit / refund rules
  - launch credit vs wake credit logic
  - billing vs telemetry separation
  - how expiring top-up credits are added and consumed
- [TTL and Cleanup Boundary Conditions.md](/Users/wallacewang/agent_projects/v0_version/docs/TTL%20and%20Cleanup%20Boundary%20Conditions.md)
  - Run vs Warm Standby vs Always On lifecycle semantics
  - cleanup boundaries
  - pull-based reconciliation notes
- [runtime_lifecycle_status.md](/Users/wallacewang/agent_projects/v0_version/docs/runtime_lifecycle_status.md)
  - implementation tracker
  - what is shipped vs pending
- [backend_runtime_lifecycle.md](/Users/wallacewang/agent_projects/v0_version/docs/backend_runtime_lifecycle.md)
  - backend plan-aware lifecycle behavior
  - Run vs Warm Standby vs Always On implementation details
- [runtime_maintenance_ops.md](/Users/wallacewang/agent_projects/v0_version/docs/runtime_maintenance_ops.md)
  - worker / cron / hosted scheduling guidance
  - how to trigger maintenance in production
- [prd.md](/Users/wallacewang/agent_projects/v0_version/docs/prd.md)
  - broader phase requirements and product scope

## Preview Chat Contract

`POST /api/interviews/preview`

Request JSON:

```json
{
  "agentId": "agent-1",
  "message": "How do you prioritize emails?"
}
```

Response JSON:

```json
{
  "content": "I prioritize based on several factors..."
}
```

Preview notes:

- preview is free
- preview does not use a real managed workspace
- preview does not consume runtime credits
- preview is separate from paid run lifecycle
- preview should stay scoped to understanding the selected agent itself
- preview should refuse unrelated general-assistant requests, prompt-injection attempts, and hidden-prompt leakage requests

## Runtime Notes

Current runtime provider:

- Daytona, behind the provider interface in `server/providers/run-provider.interface.ts`

Current lifecycle shape:

- `Run` = bounded ephemeral session
- `Warm Standby` = recoverable wakeable state
- `Always On` = persistent live workspace intent
- recoverable Warm Standby runs can now be resumed from stopped / archived state without creating a new run id
- run/bundle/dashboard badges now render lifecycle-aware labels like `Stopped`, `Archived`, and `Released` instead of only raw `completed`
- launch checks now reconcile existing managed runs first, so stale manually deleted sandboxes do not continue blocking new launches
- failed resume attempts now re-sync runtime state before returning the error so the UI falls back to the stopped/recoverable view
- paired Telegram messages can now auto-wake exactly one stopped Warm Standby run for that order
- stopped Warm Standby runs can now be terminated explicitly to release preserved state and allow a fresh launch for the same bundle
- Telegram auto-wake is conservative by design:
  - if a live run already exists, we only record activity
  - if multiple stopped recoverable Warm runs exist, we do not auto-pick one
- backend runtime telemetry now records:
  - launch time
  - stop time
  - termination reason
  - total runtime minutes
  - plan type

Current reconciliation model:

- pull-based
- run detail, list, stop, restart, and maintenance reads reconcile provider state back into DB
- webhook-driven lifecycle reconciliation is intentionally deferred for now
- internal maintenance trigger: `POST /api/internal/runtime-maintenance/reconcile`
- cron-compatible maintenance trigger: `GET /api/internal/runtime-maintenance/reconcile`
- CLI maintenance trigger:
  - `pnpm runtime:maintenance`
  - `pnpm runtime:maintenance:watch`
  - `pnpm runtime:maintenance:trigger`
- maintenance workers must resolve the same real provider as the app server, e.g. `RUN_PROVIDER=daytona`
- auth can use either:
  - `INTERNAL_API_TOKEN`
  - `CRON_SECRET`
- current maintenance enforcement covers:
  - provisioning timeout
  - max session TTL
  - idle timeout when meaningful activity timestamps are recorded
  - TTL/idle checks are not blocked just because run detail polling keeps reconciliation fresh
- launch policy now allows only one live unreleased run per user at a time, regardless of plan tier
- internal activity trigger:
  - `POST /api/internal/runs/[runId]/activity`
- first live activity producer:
  - paired Telegram inbound messages on an order
- provider-synced runtime progress can also advance the activity clock during reconciliation
- run list/detail now surface secondary lifecycle labels such as:
  - Sleeping
  - Archived
  - Released
- backend is tolerant of pre-`0006` dev databases missing `run_usage.last_meaningful_activity_at`, though migration is still recommended
