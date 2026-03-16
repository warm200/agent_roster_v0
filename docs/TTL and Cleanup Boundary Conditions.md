---
summary: TTL and cleanup boundary conditions for managed runtime plans, including provisioning timeout and capacity release semantics.
read_when:
  - Implementing plan-aware TTL, cleanup, or occupancy release behavior.
  - Reasoning about how Run, Warm Standby, and Always On should differ operationally.
---

TTL and Cleanup Boundary Conditions

Purpose:
  TTL exists to prevent temporary runtime plans from becoming unbounded persistent workspaces.
  TTL rules must preserve clear behavioral separation between Run, Warm Standby, and Always On.

Applies To:
  - post-purchase managed runs only
  - does not apply to Preview Chat
  - Preview Chat never uses a real workspace, tools, files, or network

Plan Semantics:
  Run:
    intent: short-lived manual session
    pricing_intent: one launch credit buys one bounded session
  WarmStandby:
    intent: wake on demand, not permanently occupied
    pricing_intent: recurring plan for repeated wake events, but not a full-time persistent workspace
  AlwaysOn:
    intent: persistent long-running workspace
    pricing_intent: subscription-based persistent occupancy, not launch-based temporary usage

Definitions:
  ttl:
    meaning: maximum total lifetime of a managed session after successful provider acceptance
  idle_timeout:
    meaning: maximum allowed inactivity window before cleanup starts
  cleanup:
    meaning: provider stop + workspace release + capacity release + final status persistence
  meaningful_activity:
    includes:
      - inbound Telegram trigger/message received for this run
      - agent begins or completes a tool/action step
      - agent emits a user-visible response, result, or artifact
      - orchestrator heartbeat explicitly marked as active execution
    excludes:
      - dashboard polling
      - user viewing logs or results page
      - passive provider heartbeat without active execution
      - static completed state
      - browser open with no runtime work happening

Recommended Defaults:
  Run:
    max_session_ttl_minutes: 120
    idle_timeout_minutes: 20
    cleanup_grace_minutes: 5
    rule: when TTL expires or idle timeout is reached, cleanup must begin automatically
    relaunch_behavior: after cleanup starts, any new work requires a new launch and consumes a new launch credit

  WarmStandby:
    max_session_ttl_minutes_per_wake: 360
    idle_timeout_minutes: 45
    cleanup_grace_minutes: 10
    rule: each wake creates a bounded active session; no indefinite persistent occupancy is allowed
    wake_behavior_during_grace:
      if_new_trigger_arrives_before_cleanup_finishes: cancel_cleanup_and_continue_same_session
      if_cleanup_already_completed: create_or_require_a_new_wake_session

  AlwaysOn:
    product_ttl: none
    idle_timeout: none
    safety_guards_only:
      heartbeat_missing_minutes: 15
      unhealthy_provider_timeout_minutes: 10
    rule: Always On is exempt from short-session TTL, but zombie or unhealthy workspaces must still be recycled or restarted by backend policy
    note: optional maintenance recycle windows may exist, but they are not product TTL

Provisioning Boundary:
  provisioning_timeout_minutes: 15
  rule: if provider acceptance does not occur within provisioning timeout, mark run as failed and perform cleanup
  billing_interpretation:
    - no successful provider acceptance means no successful session start
    - reserve may be refunded according to billing policy

Status Mapping:
  user_visible_statuses:
    - provisioning
    - running
    - completed
    - failed
  internal_termination_reasons:
    - ttl_expired
    - idle_timeout
    - provisioning_timeout
    - manual_stop
    - provider_unhealthy
  mapping_rule:
    - graceful TTL or idle cleanup should end as completed with a termination reason
    - abnormal cleanup failure should end as failed with a termination reason

Capacity Release Rule:
  cleanup_completion_effect:
    - workspace must be released
    - run must stop counting toward concurrent run limits
    - run must stop counting toward active bundle limits
    - completed runs with released workspace must not continue to consume runtime occupancy

Current MVP Backend Notes:
  reconciliation_model:
    - lifecycle is pull-based for now
    - when run detail, run list, stop, or restart touches a run, backend re-reads provider runtime state and reconciles local DB
    - a maintenance service can also batch-reconcile stale runtime instances without webhooks
    - a recurring maintenance loop can be run with `pnpm runtime:maintenance:watch`
    - webhook-driven lifecycle reconciliation is intentionally deferred
  timeout_enforcement:
    - provisioning timeout can now be enforced by the maintenance service
    - max session TTL can now be enforced by the maintenance service
    - idle timeout can now be enforced when `lastMeaningfulActivityAt` is available
    - passive reads still do not count as meaningful activity
  activity_clock:
    - `run_usage.lastMeaningfulActivityAt` stores the last meaningful activity timestamp
    - an internal route can advance it without relying on UI polling
    - paired Telegram inbound messages can now advance it for active runs on the order
  runtime_instance_states:
    - provisioning
    - running
    - stopped
    - archived
    - deleted
    - failed
  plan_specific_stop_behavior:
    Run:
      - stopped runtime is treated as ephemeral
      - backend deletes the sandbox on reconciliation/stop after outputs are persisted
    WarmStandby:
      - stopped runtime is preserved as recoverable state
      - backend may archive it later once the configured stopped duration is exceeded
      - `recoverableUntilAt` is derived from the archive policy window
      - a later trigger can resume the same run/sandbox lifecycle instead of forcing a brand-new launch
    AlwaysOn:
      - no short-session cleanup path by default
      - stop is exceptional and reconciled as operational state, not the normal product flow
  interval_accounting:
    - runtime start/stop windows are stored separately from credit ledger entries
    - a stopped or archived runtime closes the open runtime interval
    - a recovered/restarted runtime opens a new interval

Do Not Do:
  - do not let Run remain alive indefinitely after one launch credit
  - do not let passive UI polling reset idle timeout
  - do not let Always On silently inherit Run TTL
  - do not treat static completed state as active usage forever after cleanup
  - do not hide termination reason from backend logs/audit metadata

Edge Cases:
  - if a run is actively executing a tool when idle timeout threshold is reached, defer cleanup until the active step finishes or hard TTL is reached
  - if cleanup is initiated and provider stop fails, mark run failed and schedule forced cleanup retry
  - if user manually stops a run, cleanup happens immediately and capacity is released
  - if network/webhook delay causes a late inbound trigger after cleanup completed:
      Run: require a new launch
      WarmStandby: create or require a new wake session
  - TTL policy must be plan-aware and versioned; it must not be hardcoded as a single global timeout for all plans
