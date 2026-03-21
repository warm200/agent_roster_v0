---
summary: Snapshot of current admin usage metrics collected on 2026-03-21 for later evaluation.
read_when:
  - Reviewing current TTL / cleanup metrics before pricing or policy changes.
  - Comparing later admin dashboard snapshots against the first meaning-metrics rollout.
generated_at: 2026-03-21T14:28:55.311Z
window_label: Last 7 days
environment: live-db
---

# Admin Usage Metrics Snapshot · 2026-03-21

Captured at: `2026-03-21T14:28:55.311Z`

Window: `Last 7 days`

Environment: `live-db`

Implementation note:

> Overview, runtime, billing, and user drilldown are live from the current Postgres schema. Launch-attempt blocker attribution remains derived until `launch_attempts` exists in the database.

## Meaning Metrics

| Metric | Value | Detail | Context |
| --- | ---: | --- | --- |
| Avg workspace minutes / run | 149 min | Average `run_usage.workspace_minutes` for runs with recorded workspace time | 5 tracked runs |
| P50 session minutes | 1 min | Median runtime interval length from `runtime_intervals` | 18 ended sessions |
| P90 session minutes | 20 min | Tail latency for runtime session length | 18 ended sessions |
| Idle stop share | 0.0% | Share of ended sessions closed by `idle_timeout` | 0 idle closes |
| Hard TTL hit share | 55.6% | Share of ended sessions closed by `ttl_expired` | 10 TTL closes |
| Failed run share | 50.0% | Share of `run_usage` rows in the window that ended in `failed` | 6 failed runs |
| Top 5% user resource share | 100.0% | Share of overlapping session minutes consumed by the heaviest users | 1 of 1 active users |

## Meaning Metrics By Plan

| Plan | Active Users | Session Count | Avg Launch / Wake Count | Avg Workspace Min / Run | Estimated Internal Cost |
| --- | ---: | ---: | ---: | ---: | ---: |
| Run | 1 | 1 | 1.00 | 3 | $0.00 |
| Warm Standby | 1 | 17 | 17.00 | 186 | $0.00 |
| Always On | 0 | 0 | 0.00 | 0 | $0.00 |

## Heavy Users

| User | Resource Usage | Context |
| --- | ---: | --- |
| `114269223201980663832` | 738 min | 100% of tracked runtime · $0.00 estimated cost · Warm Standby, Run |

## Overview Metrics

| Metric | Value | Detail | Context |
| --- | ---: | --- | --- |
| Active paid users | 1 | Runtime-entitled users with active non-free subscriptions | 1 paid orders / 7d |
| Bundle -> first launch rate | 100.0% | Paid bundles in last 7 days that reached provider acceptance | 1/1 bundles |
| Launch success rate | 50.0% | Provider accepted divided by observed launch attempts from `run_usage` | 6/12 attempts |
| Blocked launches today | 6 | Current schema fallback until `launch_attempts` lands | Derived from failed launch attempts before provider accept |
| Credits committed today | 0 cr | Net committed credits from today’s ledger rows | 13 commit rows |
| Estimated cost today | $0.00 | Summed from today’s `run_usage.estimated_internal_cost_cents` | 12 launch attempts |

## Runtime Usage By Plan

| Plan | Launches | Avg Workspace Minutes |
| --- | ---: | ---: |
| Run | 8 | 3 |
| Warm Standby | 4 | 186 |
| Always On | 0 | 0 |

## Launches Per Day

| Day | Provider Accepted | Failed Before Accept | Refunded | Completed |
| --- | ---: | ---: | ---: | ---: |
| Mar 14 | 0 | 0 | 0 | 0 |
| Mar 15 | 0 | 0 | 0 | 0 |
| Mar 16 | 0 | 0 | 0 | 0 |
| Mar 17 | 0 | 0 | 0 | 0 |
| Mar 18 | 0 | 0 | 0 | 0 |
| Mar 19 | 0 | 0 | 0 | 0 |
| Mar 20 | 2 | 6 | 10 | 8 |

## Peak Concurrent Runs

| Day | Run | Warm Standby | Always On |
| --- | ---: | ---: | ---: |
| Mar 14 | 0 | 0 | 0 |
| Mar 15 | 0 | 0 | 0 |
| Mar 16 | 0 | 0 | 0 |
| Mar 17 | 0 | 0 | 0 |
| Mar 18 | 0 | 0 | 0 |
| Mar 19 | 0 | 0 | 0 |
| Mar 20 | 1 | 0 | 0 |

## Always-On Shadow

| Metric | Value |
| --- | ---: |
| Active users | 0 |
| Avg active bundles | 0 |
| Avg concurrent runs | 0 |
| Avg workspace minutes / day | 0 |

Top estimated cost users:

| User | Value | Context |
| --- | ---: | --- |
| No live usage | 0 | No live always-on usage in the current dataset. |

Top idle occupancy users:

| User | Value | Context |
| --- | ---: | --- |
| No live usage | 0 | No live always-on usage in the current dataset. |

## Raw Snapshot Excerpt

```json
{
  "generatedAt": "2026-03-21T14:28:55.311Z",
  "environment": "live-db",
  "windowLabel": "Last 7 days",
  "implementationNote": "Overview, runtime, billing, and user drilldown are live from the current Postgres schema. Launch-attempt blocker attribution remains derived until `launch_attempts` exists in the database.",
  "meaningMetrics": {
    "byPlan": [
      {
        "activeUsers": 1,
        "avgLaunchWakeCount": 1,
        "avgWorkspaceMinutesPerRun": 3,
        "estimatedInternalCostCents": 0,
        "plan": "Run",
        "sessionCount": 1
      },
      {
        "activeUsers": 1,
        "avgLaunchWakeCount": 17,
        "avgWorkspaceMinutesPerRun": 186,
        "estimatedInternalCostCents": 0,
        "plan": "Warm Standby",
        "sessionCount": 17
      },
      {
        "activeUsers": 0,
        "avgLaunchWakeCount": 0,
        "avgWorkspaceMinutesPerRun": 0,
        "estimatedInternalCostCents": 0,
        "plan": "Always On",
        "sessionCount": 0
      }
    ],
    "summary": [
      {
        "key": "avg-workspace-minutes-per-run",
        "label": "Avg Workspace Minutes / Run",
        "value": 149,
        "format": "minutes",
        "delta": "5 tracked runs",
        "detail": "Average `run_usage.workspace_minutes` for runs with recorded workspace time.",
        "tone": "warning"
      },
      {
        "key": "p50-session-minutes",
        "label": "P50 Session Minutes",
        "value": 1,
        "format": "minutes",
        "delta": "18 ended sessions",
        "detail": "Median runtime interval length from `runtime_intervals`.",
        "tone": "stable"
      },
      {
        "key": "p90-session-minutes",
        "label": "P90 Session Minutes",
        "value": 20,
        "format": "minutes",
        "delta": "18 ended sessions",
        "detail": "Tail latency for runtime session length.",
        "tone": "stable"
      },
      {
        "key": "idle-stop-share",
        "label": "Idle Stop Share",
        "value": 0,
        "format": "percent",
        "delta": "0 idle closes",
        "detail": "Share of ended sessions closed by `idle_timeout`.",
        "tone": "stable"
      },
      {
        "key": "hard-ttl-hit-share",
        "label": "Hard TTL Hit Share",
        "value": 0.5555555555555556,
        "format": "percent",
        "delta": "10 ttl closes",
        "detail": "Share of ended sessions closed by `ttl_expired`.",
        "tone": "critical"
      },
      {
        "key": "failed-run-share",
        "label": "Failed Run Share",
        "value": 0.5,
        "format": "percent",
        "delta": "6 failed runs",
        "detail": "Share of `run_usage` rows in the window that ended in `failed`.",
        "tone": "critical"
      },
      {
        "key": "top-heavy-user-share",
        "label": "Top 5% User Resource Share",
        "value": 1,
        "format": "percent",
        "delta": "1 of 1 active users",
        "detail": "Share of overlapping session minutes consumed by the heaviest users.",
        "tone": "critical"
      }
    ],
    "topHeavyUsers": [
      {
        "context": "100% of tracked runtime · $0.00 est. cost · Warm Standby, Run",
        "user": "114269223201980663832",
        "value": "738 min"
      }
    ]
  }
}
```
