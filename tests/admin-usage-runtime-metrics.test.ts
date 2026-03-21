import assert from 'node:assert/strict'
import { test } from 'node:test'

import { buildRuntimeMeaningMetrics } from '@/server/services/admin-usage-runtime-metrics'

test('buildRuntimeMeaningMetrics derives warm wakes, session percentiles, and heavy-user share from existing runtime tables', () => {
  const metrics = buildRuntimeMeaningMetrics({
    now: new Date('2026-03-15T00:00:00.000Z'),
    runtimeInstanceRows: [
      {
        id: 'runtime-1',
        planId: 'warm_standby',
        runId: 'run-1',
        stopReason: 'ttl_expired',
        userId: 'user-1',
      } as never,
      {
        id: 'runtime-2',
        planId: 'run',
        runId: 'run-2',
        stopReason: 'manual_stop',
        userId: 'user-1',
      } as never,
      {
        id: 'runtime-3',
        planId: 'run',
        runId: 'run-3',
        stopReason: 'completed',
        userId: 'user-2',
      } as never,
    ],
    runtimeIntervalRows: [
      {
        closeReason: 'idle_timeout',
        endedAt: new Date('2026-03-02T01:00:00.000Z'),
        runId: 'run-1',
        runtimeInstanceId: 'runtime-1',
        startedAt: new Date('2026-03-02T00:00:00.000Z'),
      } as never,
      {
        closeReason: 'ttl_expired',
        endedAt: new Date('2026-03-05T02:00:00.000Z'),
        runId: 'run-1',
        runtimeInstanceId: 'runtime-1',
        startedAt: new Date('2026-03-05T00:00:00.000Z'),
      } as never,
      {
        closeReason: 'manual_stop',
        endedAt: new Date('2026-03-03T00:30:00.000Z'),
        runId: 'run-2',
        runtimeInstanceId: 'runtime-2',
        startedAt: new Date('2026-03-03T00:00:00.000Z'),
      } as never,
      {
        closeReason: 'completed',
        endedAt: new Date('2026-03-04T00:20:00.000Z'),
        runId: 'run-3',
        runtimeInstanceId: 'runtime-3',
        startedAt: new Date('2026-03-04T00:00:00.000Z'),
      } as never,
    ],
    usageRows: [
      {
        completedAt: new Date('2026-03-05T02:00:00.000Z'),
        createdAt: new Date('2026-03-02T00:00:00.000Z'),
        estimatedInternalCostCents: 500,
        planId: 'warm_standby',
        runId: 'run-1',
        statusSnapshot: 'completed',
        updatedAt: new Date('2026-03-05T02:00:00.000Z'),
        userId: 'user-1',
        workspaceMinutes: 90,
      } as never,
      {
        completedAt: new Date('2026-03-03T00:30:00.000Z'),
        createdAt: new Date('2026-03-03T00:00:00.000Z'),
        estimatedInternalCostCents: 200,
        planId: 'run',
        runId: 'run-2',
        statusSnapshot: 'failed',
        updatedAt: new Date('2026-03-03T00:30:00.000Z'),
        userId: 'user-1',
        workspaceMinutes: 30,
      } as never,
      {
        completedAt: new Date('2026-03-04T00:20:00.000Z'),
        createdAt: new Date('2026-03-04T00:00:00.000Z'),
        estimatedInternalCostCents: 100,
        planId: 'run',
        runId: 'run-3',
        statusSnapshot: 'completed',
        updatedAt: new Date('2026-03-04T00:20:00.000Z'),
        userId: 'user-2',
        workspaceMinutes: 20,
      } as never,
    ],
    windowEnd: new Date('2026-03-15T00:00:00.000Z'),
    windowStart: new Date('2026-03-01T00:00:00.000Z'),
  })

  const warmStandby = metrics.byPlan.find((row) => row.plan === 'Warm Standby')
  const run = metrics.byPlan.find((row) => row.plan === 'Run')
  const p50 = metrics.summary.find((row) => row.key === 'p50-session-minutes')
  const p90 = metrics.summary.find((row) => row.key === 'p90-session-minutes')
  const failedRunShare = metrics.summary.find((row) => row.key === 'failed-run-share')
  const topHeavyUserShare = metrics.summary.find((row) => row.key === 'top-heavy-user-share')

  assert.equal(warmStandby?.sessionCount, 2)
  assert.equal(warmStandby?.activeUsers, 1)
  assert.equal(warmStandby?.launchUsers, 1)
  assert.equal(warmStandby?.avgLaunchWakeCount, 2)
  assert.equal(warmStandby?.avgWorkspaceMinutesPerRun, 90)
  assert.equal(warmStandby?.p50SessionMinutes, 90)
  assert.equal(warmStandby?.p90SessionMinutes, 114)
  assert.equal(warmStandby?.idleStopShare, 0.5)
  assert.equal(warmStandby?.hardTtlHitShare, 0.5)
  assert.equal(warmStandby?.failedRunShare, 0)
  assert.equal(run?.avgLaunchWakeCount, 1)
  assert.equal(run?.launchUsers, 2)
  assert.equal(run?.estimatedInternalCostCents, 1383)
  assert.equal(run?.p50SessionMinutes, 25)
  assert.equal(run?.p90SessionMinutes, 29)
  assert.equal(run?.idleStopShare, 0)
  assert.equal(run?.hardTtlHitShare, 0)
  assert.equal(run?.failedRunShare, 0.5)
  assert.equal(p50?.value, 45)
  assert.equal(p90?.value, 102)
  assert.equal(failedRunShare?.value, 1 / 3)
  assert.equal(topHeavyUserShare?.value, 210 / 230)
  assert.equal(metrics.topHeavyUsers[0]?.user, 'user-1')
  assert.match(metrics.topHeavyUsers[0]?.context ?? '', /91% of tracked runtime/)
})

test('buildRuntimeMeaningMetrics keeps runs without runtime intervals, separates launch users from active users, and uses terminal window cohorts', () => {
  const metrics = buildRuntimeMeaningMetrics({
    now: new Date('2026-03-15T00:00:00.000Z'),
    runtimeInstanceRows: [
      {
        id: 'runtime-warm-carry',
        planId: 'warm_standby',
        runId: 'warm-carry',
        stopReason: 'completed',
        userId: 'user-carry',
      } as never,
      {
        id: 'runtime-run-failed',
        planId: 'run',
        runId: 'run-failed-late',
        stopReason: 'provider_unhealthy',
        userId: 'user-failed',
      } as never,
      {
        id: 'runtime-free',
        planId: 'free',
        runId: 'free-run',
        stopReason: 'completed',
        userId: 'user-free',
      } as never,
    ],
    runtimeIntervalRows: [
      {
        closeReason: 'completed',
        endedAt: new Date('2026-03-03T01:00:00.000Z'),
        runId: 'warm-carry',
        runtimeInstanceId: 'runtime-warm-carry',
        startedAt: new Date('2026-02-28T23:00:00.000Z'),
      } as never,
    ],
    usageRows: [
      {
        completedAt: new Date('2026-03-06T00:00:00.000Z'),
        createdAt: new Date('2026-02-26T00:00:00.000Z'),
        estimatedInternalCostCents: 700,
        planId: 'run',
        runId: 'run-failed-late',
        runningStartedAt: new Date('2026-03-05T00:00:00.000Z'),
        statusSnapshot: 'failed',
        updatedAt: new Date('2026-03-06T00:00:00.000Z'),
        userId: 'user-failed',
        workspaceMinutes: 40,
      } as never,
      {
        completedAt: new Date('2026-03-07T00:00:00.000Z'),
        createdAt: new Date('2026-03-07T00:00:00.000Z'),
        estimatedInternalCostCents: 300,
        planId: 'free',
        runId: 'free-run',
        runningStartedAt: new Date('2026-03-07T00:00:00.000Z'),
        statusSnapshot: 'completed',
        updatedAt: new Date('2026-03-07T00:00:00.000Z'),
        userId: 'user-free',
        workspaceMinutes: 25,
      } as never,
      {
        completedAt: new Date('2026-02-27T00:00:00.000Z'),
        createdAt: new Date('2026-02-27T00:00:00.000Z'),
        estimatedInternalCostCents: 100,
        planId: 'warm_standby',
        runId: 'warm-carry',
        runningStartedAt: new Date('2026-02-28T23:00:00.000Z'),
        statusSnapshot: 'completed',
        updatedAt: new Date('2026-03-03T01:00:00.000Z'),
        userId: 'user-carry',
        workspaceMinutes: 120,
      } as never,
    ],
    windowEnd: new Date('2026-03-15T00:00:00.000Z'),
    windowStart: new Date('2026-03-01T00:00:00.000Z'),
  })

  const run = metrics.byPlan.find((row) => row.plan === 'Run')
  const warmStandby = metrics.byPlan.find((row) => row.plan === 'Warm Standby')
  const failedRunShare = metrics.summary.find((row) => row.key === 'failed-run-share')
  const avgWorkspace = metrics.summary.find((row) => row.key === 'avg-workspace-minutes-per-run')

  assert.equal(warmStandby?.activeUsers, 1)
  assert.equal(warmStandby?.launchUsers, 0)
  assert.equal(warmStandby?.sessionCount, 0)
  assert.equal(warmStandby?.avgLaunchWakeCount, 0)
  assert.equal(run?.activeUsers, 1)
  assert.equal(run?.launchUsers, 2)
  assert.equal(run?.sessionCount, 2)
  assert.equal(run?.avgLaunchWakeCount, 1)
  assert.equal(run?.failedRunShare, 0.5)
  assert.equal(run?.estimatedInternalCostCents, 1797)
  assert.equal(run?.avgWorkspaceMinutesPerRun, 33)
  assert.equal(failedRunShare?.value, 0.5)
  assert.equal(avgWorkspace?.value, 33)
})

test('buildRuntimeMeaningMetrics derives plan cost from workspace minutes when stored cost is zero', () => {
  const metrics = buildRuntimeMeaningMetrics({
    now: new Date('2026-03-15T00:00:00.000Z'),
    runtimeInstanceRows: [],
    runtimeIntervalRows: [],
    usageRows: [
      {
        completedAt: new Date('2026-03-05T00:30:00.000Z'),
        createdAt: new Date('2026-03-05T00:00:00.000Z'),
        estimatedInternalCostCents: 0,
        planId: 'run',
        runId: 'run-cost-fallback',
        runningStartedAt: new Date('2026-03-05T00:00:00.000Z'),
        statusSnapshot: 'completed',
        updatedAt: new Date('2026-03-05T00:30:00.000Z'),
        userId: 'user-1',
        workspaceMinutes: 20,
      } as never,
    ],
    windowEnd: new Date('2026-03-15T00:00:00.000Z'),
    windowStart: new Date('2026-03-01T00:00:00.000Z'),
  })

  const run = metrics.byPlan.find((row) => row.plan === 'Run')

  assert.equal(run?.estimatedInternalCostCents, 553)
  assert.match(metrics.topHeavyUsers[0]?.context ?? '', /\$5\.53 est\. cost/)
})
