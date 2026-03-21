import type {
  AdminSignal,
  OverviewMetric,
  RankRow,
  RuntimeMeaningPlanRow,
} from '@/lib/admin-usage-data'

import {
  runUsage,
  runtimeInstances,
  runtimeIntervals,
} from '../db/schema'

type UsageRow = typeof runUsage.$inferSelect
type RuntimeInstanceRow = typeof runtimeInstances.$inferSelect
type RuntimeIntervalRow = typeof runtimeIntervals.$inferSelect
type NormalizedPlanId = 'run' | 'warm_standby' | 'always_on'
type SessionRecord = {
  runId: string
  userId: string
  planId: NormalizedPlanId
  startedAt: Date
  endedAt: Date | null
  closeReason: string | null
}

function average(values: number[]) {
  return values.length > 0 ? sum(values) / values.length : 0
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function getPlanLabel(planId: SessionRecord['planId']) {
  switch (planId) {
    case 'warm_standby':
      return 'Warm Standby'
    case 'always_on':
      return 'Always On'
    default:
      return 'Run'
  }
}

function getToneForShare(value: number, warningThreshold: number, criticalThreshold: number): AdminSignal {
  if (value >= criticalThreshold) {
    return 'critical'
  }

  if (value >= warningThreshold) {
    return 'warning'
  }

  return 'stable'
}

function getToneForMinutes(value: number, warningThreshold: number): AdminSignal {
  return value >= warningThreshold ? 'warning' : 'stable'
}

function getTopHeavyUserTone(value: number): AdminSignal {
  if (value >= 0.5) {
    return 'critical'
  }

  if (value >= 0.35) {
    return 'warning'
  }

  return 'info'
}

function percentile(values: number[], ratio: number) {
  if (values.length === 0) {
    return 0
  }

  const sorted = values.slice().sort((left, right) => left - right)
  const index = (sorted.length - 1) * clamp(ratio, 0, 1)
  const lowerIndex = Math.floor(index)
  const upperIndex = Math.ceil(index)
  const lower = sorted[lowerIndex] ?? 0
  const upper = sorted[upperIndex] ?? lower

  if (lowerIndex === upperIndex) {
    return lower
  }

  return lower + (upper - lower) * (index - lowerIndex)
}

function roundMetric(value: number, digits = 1) {
  return Number(value.toFixed(digits))
}

function sessionMinutes(startedAt: Date, endedAt: Date) {
  return Math.max((endedAt.getTime() - startedAt.getTime()) / (60 * 1000), 0)
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0)
}

function normalizePlanId(planId: UsageRow['planId'] | RuntimeInstanceRow['planId'] | SessionRecord['planId']): NormalizedPlanId {
  return planId === 'free' ? 'run' : planId
}

function getTerminalAt(row: UsageRow) {
  if (row.workspaceReleasedAt) {
    return row.workspaceReleasedAt
  }

  if (row.completedAt) {
    return row.completedAt
  }

  if (row.statusSnapshot === 'completed' || row.statusSnapshot === 'failed') {
    return row.updatedAt
  }

  return null
}

function toSessionRecordFromUsage(row: UsageRow): SessionRecord | null {
  const startedAt =
    row.runningStartedAt ??
    row.providerAcceptedAt ??
    row.provisioningStartedAt ??
    row.createdAt

  if (!startedAt) {
    return null
  }

  return {
    closeReason: row.terminationReason ?? null,
    endedAt: row.workspaceReleasedAt ?? row.completedAt ?? null,
    planId: normalizePlanId(row.planId),
    runId: row.runId,
    startedAt,
    userId: row.userId,
  }
}

function buildSessionRecords(input: {
  usageRows: UsageRow[]
  runtimeInstanceRows: RuntimeInstanceRow[]
  runtimeIntervalRows: RuntimeIntervalRow[]
}): SessionRecord[] {
  const usageByRunId = new Map(input.usageRows.map((row) => [row.runId, row]))
  const runtimeById = new Map(input.runtimeInstanceRows.map((row) => [row.id, row]))
  const runtimeByRunId = new Map(input.runtimeInstanceRows.map((row) => [row.runId, row]))

  const intervalSessions = input.runtimeIntervalRows
    .map((row) => {
      const runtime = runtimeById.get(row.runtimeInstanceId) ?? runtimeByRunId.get(row.runId)
      const usage = usageByRunId.get(row.runId)
      const planId = runtime?.planId ?? usage?.planId
      const userId = runtime?.userId ?? usage?.userId

      if (!planId || !userId) {
        return null
      }

      return {
        closeReason: row.closeReason ?? runtime?.stopReason ?? usage?.terminationReason ?? null,
        endedAt: row.endedAt ?? null,
        planId: normalizePlanId(planId),
        runId: row.runId,
        startedAt: row.startedAt,
        userId,
      } satisfies SessionRecord
    })
    .filter((row): row is SessionRecord => Boolean(row))

  const intervalRunIds = new Set(intervalSessions.map((row) => row.runId))
  const usageFallbackSessions = input.usageRows
    .filter((row) => !intervalRunIds.has(row.runId))
    .map((row) => toSessionRecordFromUsage(row))
    .filter((row): row is SessionRecord => Boolean(row))

  return [...intervalSessions, ...usageFallbackSessions]
}

function overlapsWindow(startedAt: Date, endedAt: Date | null, windowStart: Date, windowEnd: Date, now: Date) {
  const effectiveEnd = endedAt ?? now
  return startedAt < windowEnd && effectiveEnd > windowStart
}

export function buildRuntimeMeaningMetrics(input: {
  usageRows: UsageRow[]
  runtimeInstanceRows: RuntimeInstanceRow[]
  runtimeIntervalRows: RuntimeIntervalRow[]
  windowStart: Date
  windowEnd: Date
  now: Date
}): {
  byPlan: RuntimeMeaningPlanRow[]
  summary: OverviewMetric[]
  topHeavyUsers: RankRow[]
} {
  const terminalUsageInWindow = input.usageRows.filter((row) => {
    const terminalAt = getTerminalAt(row)
    return Boolean(terminalAt && terminalAt >= input.windowStart && terminalAt < input.windowEnd)
  })
  const sessionRecords = buildSessionRecords(input)
  const sessionsStartedInWindow = sessionRecords.filter(
    (row) => row.startedAt >= input.windowStart && row.startedAt < input.windowEnd,
  )
  const sessionsEndedInWindow = sessionRecords.filter(
    (row) => row.endedAt && row.endedAt >= input.windowStart && row.endedAt < input.windowEnd,
  )
  const endedSessionDurations = sessionsEndedInWindow
    .map((row) => sessionMinutes(row.startedAt, row.endedAt!))
    .filter((row) => row > 0)
  const usageWithWorkspaceMinutes = terminalUsageInWindow
    .map((row) => row.workspaceMinutes ?? null)
    .filter((row): row is number => row != null && row > 0)

  const activeUserMinutes = new Map<string, { costCents: number; minutes: number; plans: Set<string> }>()
  const activeUsersByPlan = new Map<'run' | 'warm_standby' | 'always_on', Set<string>>([
    ['run', new Set()],
    ['warm_standby', new Set()],
    ['always_on', new Set()],
  ])
  const launchUsersByPlan = new Map<'run' | 'warm_standby' | 'always_on', Set<string>>([
    ['run', new Set()],
    ['warm_standby', new Set()],
    ['always_on', new Set()],
  ])

  for (const row of sessionsStartedInWindow) {
    launchUsersByPlan.get(row.planId)?.add(row.userId)
  }

  for (const row of sessionRecords) {
    if (!overlapsWindow(row.startedAt, row.endedAt, input.windowStart, input.windowEnd, input.now)) {
      continue
    }

    const overlapStart = new Date(Math.max(row.startedAt.getTime(), input.windowStart.getTime()))
    const overlapEnd = new Date(Math.min((row.endedAt ?? input.now).getTime(), input.windowEnd.getTime()))
    const minutes = sessionMinutes(overlapStart, overlapEnd)

    if (minutes <= 0) {
      continue
    }

    activeUsersByPlan.get(row.planId)?.add(row.userId)

    const current = activeUserMinutes.get(row.userId) ?? {
      costCents: 0,
      minutes: 0,
      plans: new Set<string>(),
    }
    current.minutes += minutes
    current.plans.add(getPlanLabel(row.planId))
    activeUserMinutes.set(row.userId, current)
  }

  for (const row of terminalUsageInWindow) {
    const current = activeUserMinutes.get(row.userId) ?? {
      costCents: 0,
      minutes: 0,
      plans: new Set<string>(),
    }
    current.costCents += row.estimatedInternalCostCents ?? 0
    current.plans.add(getPlanLabel(normalizePlanId(row.planId)))
    activeUserMinutes.set(row.userId, current)
  }

  const heavyUsers = Array.from(activeUserMinutes.entries())
    .map(([userId, value]) => ({
      ...value,
      userId,
    }))
    .filter((row) => row.minutes > 0)
    .sort((left, right) => right.minutes - left.minutes)

  const topHeavyUserCount = heavyUsers.length > 0 ? Math.max(1, Math.ceil(heavyUsers.length * 0.05)) : 0
  const topHeavyUsers = heavyUsers.slice(0, topHeavyUserCount)
  const totalTrackedMinutes = sum(heavyUsers.map((row) => row.minutes))
  const topHeavyUserShare =
    totalTrackedMinutes > 0 ? sum(topHeavyUsers.map((row) => row.minutes)) / totalTrackedMinutes : 0

  const byPlan: RuntimeMeaningPlanRow[] = (['run', 'warm_standby', 'always_on'] as const).map((planId) => {
    const planSessions = sessionsStartedInWindow.filter((row) => row.planId === planId)
    const endedPlanSessions = sessionsEndedInWindow.filter((row) => row.planId === planId)
    const endedPlanSessionDurations = endedPlanSessions
      .map((row) => sessionMinutes(row.startedAt, row.endedAt!))
      .filter((row) => row > 0)
    const planUsage = terminalUsageInWindow.filter((row) => normalizePlanId(row.planId) === planId)
    const activeUsers = activeUsersByPlan.get(planId)?.size ?? 0
    const launchUsers = launchUsersByPlan.get(planId)?.size ?? 0
    const planFailedRunShare =
      planUsage.length > 0 ? planUsage.filter((row) => row.statusSnapshot === 'failed').length / planUsage.length : 0
    const planIdleStopShare =
      endedPlanSessions.length > 0
        ? endedPlanSessions.filter((row) => row.closeReason === 'idle_timeout').length / endedPlanSessions.length
        : 0
    const planHardTtlHitShare =
      endedPlanSessions.length > 0
        ? endedPlanSessions.filter((row) => row.closeReason === 'ttl_expired').length / endedPlanSessions.length
        : 0

    return {
      activeUsers,
      avgLaunchWakeCount: launchUsers > 0 ? roundMetric(planSessions.length / launchUsers, 2) : 0,
      avgWorkspaceMinutesPerRun: Math.round(
        average(planUsage.map((row) => row.workspaceMinutes ?? 0).filter((row) => row > 0)),
      ),
      failedRunShare: planFailedRunShare,
      hardTtlHitShare: planHardTtlHitShare,
      idleStopShare: planIdleStopShare,
      launchUsers,
      estimatedInternalCostCents: sum(planUsage.map((row) => row.estimatedInternalCostCents ?? 0)),
      p50SessionMinutes: Math.round(percentile(endedPlanSessionDurations, 0.5)),
      p90SessionMinutes: Math.round(percentile(endedPlanSessionDurations, 0.9)),
      plan: getPlanLabel(planId),
      sessionCount: planSessions.length,
    }
  })

  const idleStopShare =
    sessionsEndedInWindow.length > 0
      ? sessionsEndedInWindow.filter((row) => row.closeReason === 'idle_timeout').length / sessionsEndedInWindow.length
      : 0
  const hardTtlHitShare =
    sessionsEndedInWindow.length > 0
      ? sessionsEndedInWindow.filter((row) => row.closeReason === 'ttl_expired').length / sessionsEndedInWindow.length
      : 0
  const failedRunShare =
    terminalUsageInWindow.length > 0
      ? terminalUsageInWindow.filter((row) => row.statusSnapshot === 'failed').length / terminalUsageInWindow.length
      : 0

  const summary: OverviewMetric[] = [
    {
      key: 'avg-workspace-minutes-per-run',
      label: 'Avg Workspace Minutes / Run',
      value: Math.round(average(usageWithWorkspaceMinutes)),
      format: 'minutes',
      delta: `${usageWithWorkspaceMinutes.length} finished tracked runs`,
      detail: 'Average `run_usage.workspace_minutes` for finished runs with recorded positive workspace time.',
      tone: getToneForMinutes(average(usageWithWorkspaceMinutes), 120),
    },
    {
      key: 'p50-session-minutes',
      label: 'P50 Session Minutes',
      value: Math.round(percentile(endedSessionDurations, 0.5)),
      format: 'minutes',
      delta: `${sessionsEndedInWindow.length} ended sessions`,
      detail: 'Median runtime interval length from `runtime_intervals`.',
      tone: 'stable',
    },
    {
      key: 'p90-session-minutes',
      label: 'P90 Session Minutes',
      value: Math.round(percentile(endedSessionDurations, 0.9)),
      format: 'minutes',
      delta: `${sessionsEndedInWindow.length} ended sessions`,
      detail: 'Tail latency for runtime session length.',
      tone: getToneForMinutes(percentile(endedSessionDurations, 0.9), 180),
    },
    {
      key: 'idle-stop-share',
      label: 'Idle Stop Share',
      value: idleStopShare,
      format: 'percent',
      delta: `${sessionsEndedInWindow.filter((row) => row.closeReason === 'idle_timeout').length} idle closes`,
      detail: 'Share of ended sessions closed by `idle_timeout`.',
      tone: getToneForShare(idleStopShare, 0.25, 0.4),
    },
    {
      key: 'hard-ttl-hit-share',
      label: 'Hard TTL Hit Share',
      value: hardTtlHitShare,
      format: 'percent',
      delta: `${sessionsEndedInWindow.filter((row) => row.closeReason === 'ttl_expired').length} ttl closes`,
      detail: 'Share of ended sessions closed by `ttl_expired`.',
      tone: getToneForShare(hardTtlHitShare, 0.05, 0.12),
    },
    {
      key: 'failed-run-share',
      label: 'Failed Run Share',
      value: failedRunShare,
      format: 'percent',
      delta: `${terminalUsageInWindow.filter((row) => row.statusSnapshot === 'failed').length} failed runs`,
      detail: 'Share of finished `run_usage` rows in the window that ended in `failed`.',
      tone: getToneForShare(failedRunShare, 0.08, 0.18),
    },
    {
      key: 'top-heavy-user-share',
      label: 'Top 5% User Resource Share',
      value: topHeavyUserShare,
      format: 'percent',
      delta: `${topHeavyUserCount} of ${heavyUsers.length} active users`,
      detail: 'Share of overlapping session minutes consumed by the heaviest users.',
      tone: getTopHeavyUserTone(topHeavyUserShare),
    },
  ]

  return {
    byPlan,
    summary,
    topHeavyUsers:
      topHeavyUsers.length > 0
        ? topHeavyUsers.map((row) => ({
            context: `${Math.round((row.minutes / totalTrackedMinutes) * 100)}% of tracked runtime · $${(row.costCents / 100).toFixed(2)} est. cost · ${Array.from(row.plans).join(', ')}`,
            user: row.userId,
            value: `${Math.round(row.minutes).toLocaleString('en-US')} min`,
          }))
        : [{ context: 'No overlapping runtime sessions in the current window.', user: 'No heavy users', value: '0 min' }],
  }
}
