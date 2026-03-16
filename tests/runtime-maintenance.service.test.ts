import assert from 'node:assert/strict'
import test from 'node:test'

import type { RuntimeInstance } from '@/lib/types'
import { RuntimeMaintenanceService } from '@/server/services/runtime-maintenance.service'

const baseRuntime: RuntimeInstance = {
  id: 'runtime-1',
  runId: 'run-1',
  userId: 'user-1',
  orderId: 'order-1',
  providerName: 'daytona',
  providerInstanceRef: 'sandbox-1',
  planId: 'run',
  runtimeMode: 'temporary_execution',
  persistenceMode: 'ephemeral',
  state: 'running',
  stopReason: null,
  preservedStateAvailable: false,
  startedAt: new Date().toISOString(),
  stoppedAt: null,
  archivedAt: null,
  deletedAt: null,
  recoverableUntilAt: null,
  workspaceReleasedAt: null,
  lastReconciledAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  metadataJson: {},
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

test('runtime maintenance reconciles stale runtime instances in batch', async () => {
  const requested: Array<{ lastReconciledBefore: string; limit: number; states: RuntimeInstance['state'][] }> = []
  const touched: string[] = []

  const service = new RuntimeMaintenanceService(
    {
      async listRuntimeInstancesNeedingReconcile(input) {
        requested.push(input)
        return [
          baseRuntime,
          {
            ...baseRuntime,
            id: 'runtime-2',
            runId: 'run-2',
            state: 'stopped',
            persistenceMode: 'recoverable',
            planId: 'warm_standby',
            runtimeMode: 'wakeable_recoverable',
            stoppedAt: new Date().toISOString(),
            preservedStateAvailable: true,
          },
        ]
      },
    },
    {
      async getRun(userId: string, runId: string) {
        touched.push(`${userId}:${runId}`)
        return {
          id: runId,
        }
      },
    } as never,
  )

  const result = await service.reconcileStaleRuntimes({ limit: 10, staleMinutes: 5 })

  assert.equal(requested.length, 1)
  assert.deepEqual(requested[0]?.states, ['archived', 'provisioning', 'running', 'stopped'])
  assert.equal(requested[0]?.limit, 10)
  assert.equal(result.reconciled, 2)
  assert.equal(result.errored, 0)
  assert.deepEqual(result.touchedRunIds, ['run-1', 'run-2'])
  assert.deepEqual(touched, ['user-1:run-1', 'user-1:run-2'])
})

test('runtime maintenance counts reconcile errors and keeps going', async () => {
  const service = new RuntimeMaintenanceService(
    {
      async listRuntimeInstancesNeedingReconcile() {
        return [
          baseRuntime,
          {
            ...baseRuntime,
            id: 'runtime-2',
            runId: 'run-2',
          },
        ]
      },
    },
    {
      async getRun(_userId: string, runId: string) {
        if (runId === 'run-2') {
          throw new Error('reconcile failed')
        }
        return {
          id: runId,
        }
      },
    } as never,
  )

  const result = await service.reconcileStaleRuntimes({ limit: 10, staleMinutes: 5 })

  assert.equal(result.reconciled, 1)
  assert.equal(result.errored, 1)
  assert.deepEqual(result.touchedRunIds, ['run-1'])
})
