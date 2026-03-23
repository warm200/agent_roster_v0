---
summary: Snapshot of current admin usage metrics collected on 2026-03-21 for later evaluation.
read_when:
  - Reviewing current TTL / cleanup metrics before pricing or policy changes.
  - Comparing later admin dashboard snapshots against the first meaning-metrics rollout.
generated_at: 2026-03-22T01:20:28.906Z
window_label: Last 7 days
environment: live-db
note: Overwrites the earlier 2026-03-21 dump after the runtime cost unit fix.
---

# Admin Usage Metrics Snapshot · 2026-03-21

Captured at: `2026-03-22T01:20:28.906Z`

Window: `Last 7 days`

Environment: `live-db`

Correction note:

> This file replaces the earlier same-day dump because estimated internal cost was previously inflated by a provider cost unit bug. This snapshot reflects the corrected cents-per-minute math.

Implementation note:

> Overview, runtime, billing, and user drilldown are live from the current Postgres schema. Launch-attempt blocker attribution remains derived until `launch_attempts` exists in the database.

## Meaning Metrics

| Metric | Value | Detail | Context |
| --- | ---: | --- | --- |
| Avg workspace minutes / run | 126 min | Average `run_usage.workspace_minutes` for finished runs with recorded positive workspace time | 6 finished tracked runs |
| P50 session minutes | 0 min | Median runtime interval length from `runtime_intervals` | 30 ended sessions |
| P90 session minutes | 8 min | Tail latency for runtime session length | 30 ended sessions |
| Idle stop share | 10.0% | Share of ended sessions closed by `idle_timeout` | 3 idle closes |
| Hard TTL hit share | 33.3% | Share of ended sessions closed by `ttl_expired` | 10 ttl closes |
| Failed run share | 46.7% | Share of finished `run_usage` rows in the window that ended in `failed` | 7 failed runs |
| Top 5% user resource share | 100.0% | Share of overlapping session minutes consumed by the heaviest users | 1 of 3 active users |

## Meaning Metrics By Plan

| Plan | Active Users | Session Count | Avg Launch / Wake Count | Avg Workspace Min / Run | Estimated Internal Cost |
| --- | ---: | ---: | ---: | ---: | ---: |
| Run | 1 | 8 | 8.00 | 3 | $0.01 |
| Warm Standby | 3 | 22 | 7.33 | 151 | $4.55 |
| Always On | 0 | 0 | 0.00 | 0 | $0.00 |

## Heavy Users

| User | Resource Usage | Context |
| --- | ---: | --- |
| `114269223201980663832` | 746 min | 100% of tracked runtime · $4.56 est. cost · Warm Standby, Run |

## Overview Metrics

| Metric | Value | Detail | Context |
| --- | ---: | --- | --- |
| Active paid users | 3 | Runtime-entitled users with active non-free subscriptions | 3 paid orders / 7d |
| Bundle -> first launch rate | 66.7% | Paid bundles in last 7 days that reached provider acceptance | 2/3 bundles |
| Launch success rate | 53.3% | Provider accepted divided by observed launch attempts from `run_usage` | 8/15 attempts |
| Blocked launches today | 1 | Current schema fallback until `launch_attempts` lands | Derived from failed launch attempts before provider accept |
| Credits committed today | 0 cr | Net committed credits from today’s ledger rows | 0 commit rows |
| Estimated cost today | $4.47 | Summed from stored `run_usage.estimated_internal_cost_cents`, with workspace-minute fallback at the provider cents-per-minute rate | 4 launch attempts |

## Runtime Usage By Plan

| Plan | Launches | Avg Workspace Minutes |
| --- | ---: | ---: |
| Run | 8 | 3 |
| Warm Standby | 7 | 151 |
| Always On | 0 | 0 |

## Launches Per Day

| Day | Provider Accepted | Failed Before Accept | Refunded | Completed |
| --- | ---: | ---: | ---: | ---: |
| Mar 15 | 0 | 0 | 0 | 0 |
| Mar 16 | 0 | 0 | 0 | 0 |
| Mar 17 | 0 | 0 | 0 | 0 |
| Mar 18 | 0 | 0 | 0 | 0 |
| Mar 19 | 0 | 0 | 0 | 0 |
| Mar 20 | 2 | 6 | 10 | 8 |
| Mar 21 | 6 | 1 | 4 | 7 |

## Peak Concurrent Runs

| Day | Run | Warm Standby | Always On |
| --- | ---: | ---: | ---: |
| Mar 15 | 0 | 0 | 0 |
| Mar 16 | 0 | 0 | 0 |
| Mar 17 | 0 | 0 | 0 |
| Mar 18 | 0 | 0 | 0 |
| Mar 19 | 0 | 0 | 0 |
| Mar 20 | 1 | 0 | 0 |
| Mar 21 | 0 | 2 | 0 |

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
  "generatedAt": "2026-03-22T01:20:28.906Z",
  "environment": "live-db",
  "windowLabel": "Last 7 days",
  "overviewMetrics": [
    {
      "key": "estimated-cost-today",
      "label": "Estimated Cost Today",
      "value": 447,
      "format": "currency",
      "delta": "4 launch attempts"
    }
  ],
  "meaningMetrics": {
    "byPlan": [
      {
        "activeUsers": 1,
        "avgLaunchWakeCount": 8,
        "avgWorkspaceMinutesPerRun": 3,
        "estimatedInternalCostCents": 1,
        "plan": "Run",
        "sessionCount": 8
      },
      {
        "activeUsers": 3,
        "avgLaunchWakeCount": 7.33,
        "avgWorkspaceMinutesPerRun": 151,
        "estimatedInternalCostCents": 455,
        "plan": "Warm Standby",
        "sessionCount": 22
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
        "value": 126,
        "format": "minutes",
        "delta": "6 finished tracked runs"
      },
      {
        "key": "p50-session-minutes",
        "label": "P50 Session Minutes",
        "value": 0,
        "format": "minutes",
        "delta": "30 ended sessions"
      },
      {
        "key": "p90-session-minutes",
        "label": "P90 Session Minutes",
        "value": 8,
        "format": "minutes",
        "delta": "30 ended sessions"
      },
      {
        "key": "idle-stop-share",
        "label": "Idle Stop Share",
        "value": 0.1,
        "format": "percent",
        "delta": "3 idle closes"
      },
      {
        "key": "hard-ttl-hit-share",
        "label": "Hard TTL Hit Share",
        "value": 0.3333333333333333,
        "format": "percent",
        "delta": "10 ttl closes"
      },
      {
        "key": "failed-run-share",
        "label": "Failed Run Share",
        "value": 0.4666666666666667,
        "format": "percent",
        "delta": "7 failed runs"
      },
      {
        "key": "top-heavy-user-share",
        "label": "Top 5% User Resource Share",
        "value": 0.9995159455726255,
        "format": "percent",
        "delta": "1 of 3 active users"
      }
    ],
    "topHeavyUsers": [
      {
        "context": "100% of tracked runtime · $4.56 est. cost · Warm Standby, Run",
        "user": "114269223201980663832",
        "value": "746 min"
      }
    ]
  }
}
```
