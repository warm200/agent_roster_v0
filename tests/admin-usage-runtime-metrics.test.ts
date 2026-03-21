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
        createdAt: new Date('2026-03-02T00:00:00.000Z'),
        estimatedInternalCostCents: 500,
        planId: 'warm_standby',
        runId: 'run-1',
        statusSnapshot: 'completed',
        userId: 'user-1',
        workspaceMinutes: 90,
      } as never,
      {
        createdAt: new Date('2026-03-03T00:00:00.000Z'),
        estimatedInternalCostCents: 200,
        planId: 'run',
        runId: 'run-2',
        statusSnapshot: 'failed',
        userId: 'user-1',
        workspaceMinutes: 30,
      } as never,
      {
        createdAt: new Date('2026-03-04T00:00:00.000Z'),
        estimatedInternalCostCents: 100,
        planId: 'run',
        runId: 'run-3',
        statusSnapshot: 'completed',
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
  assert.equal(warmStandby?.avgLaunchWakeCount, 2)
  assert.equal(warmStandby?.avgWorkspaceMinutesPerRun, 90)
  assert.equal(run?.avgLaunchWakeCount, 1)
  assert.equal(run?.estimatedInternalCostCents, 300)
  assert.equal(p50?.value, 45)
  assert.equal(p90?.value, 102)
  assert.equal(failedRunShare?.value, 1 / 3)
  assert.equal(topHeavyUserShare?.value, 210 / 230)
  assert.equal(metrics.topHeavyUsers[0]?.user, 'user-1')
  assert.match(metrics.topHeavyUsers[0]?.context ?? '', /91% of tracked runtime/)
})
