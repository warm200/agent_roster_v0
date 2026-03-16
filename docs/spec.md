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

## Source Of Truth

Use these docs by topic:

- [pricing_plan.md](/Users/wallacewang/agent_projects/v0_version/docs/pricing_plan.md)
  - runtime pricing model
  - what plans mean publicly
  - what constraints are actually enforced today
- [credit_consuming_logic.md](/Users/wallacewang/agent_projects/v0_version/docs/credit_consuming_logic.md)
  - reserve / commit / refund rules
  - launch credit vs wake credit logic
  - billing vs telemetry separation
- [TTL and Cleanup Boundary Conditions.md](/Users/wallacewang/agent_projects/v0_version/docs/TTL%20and%20Cleanup%20Boundary%20Conditions.md)
  - Run vs Warm Standby vs Always On lifecycle semantics
  - cleanup boundaries
  - pull-based reconciliation notes
- [runtime_lifecycle_status.md](/Users/wallacewang/agent_projects/v0_version/docs/runtime_lifecycle_status.md)
  - implementation tracker
  - what is shipped vs pending
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

## Runtime Notes

Current runtime provider:

- Daytona, behind the provider interface in `server/providers/run-provider.interface.ts`

Current lifecycle shape:

- `Run` = bounded ephemeral session
- `Warm Standby` = recoverable wakeable state
- `Always On` = persistent live workspace intent

Current reconciliation model:

- pull-based
- run detail, list, stop, restart, and maintenance reads reconcile provider state back into DB
- webhook-driven lifecycle reconciliation is intentionally deferred for now
- internal maintenance trigger: `POST /api/internal/runtime-maintenance/reconcile`
- current maintenance enforcement covers:
  - provisioning timeout
  - max session TTL
