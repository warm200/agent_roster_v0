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
      async findRuntimeInstanceByRunId(runId: string) {
        return runId === 'run-1'
          ? baseRuntime
          : {
              ...baseRuntime,
              id: 'runtime-2',
              runId: 'run-2',
              state: 'stopped',
              persistenceMode: 'recoverable',
              planId: 'warm_standby',
              runtimeMode: 'wakeable_recoverable',
              stoppedAt: new Date().toISOString(),
              preservedStateAvailable: true,
            }
      },
    },
    {
      async findRunUsage() {
        return null
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
      async findRuntimeInstanceByRunId(runId: string) {
        return runId === 'run-1'
          ? baseRuntime
          : {
              ...baseRuntime,
              id: 'runtime-2',
              runId: 'run-2',
            }
      },
    },
    {
      async findRunUsage() {
        return null
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

test('runtime maintenance stops provisioning runs that exceed provisioning timeout', async () => {
  const stopped: Array<{ runId: string; reason: string }> = []

  const service = new RuntimeMaintenanceService(
    {
      async listRuntimeInstancesNeedingReconcile() {
        return [
          {
            ...baseRuntime,
            state: 'provisioning',
            startedAt: null,
          },
        ]
      },
      async findRuntimeInstanceByRunId() {
        return {
          ...baseRuntime,
          state: 'provisioning',
          startedAt: null,
        }
      },
    },
    {
      async findRunUsage() {
        return {
          id: 'usage-1',
          runId: 'run-1',
          userId: 'user-1',
          orderId: 'order-1',
          planId: 'run',
          planVersion: 'v1',
          triggerModeSnapshot: 'manual',
          agentCount: 1,
          usesRealWorkspace: true,
          usesTools: true,
          networkEnabled: true,
          provisioningStartedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
          providerAcceptedAt: null,
          runningStartedAt: null,
          lastMeaningfulActivityAt: null,
          completedAt: null,
          workspaceReleasedAt: null,
          terminationReason: null,
          workspaceMinutes: null,
          toolCallsCount: null,
          inputTokensEst: null,
          outputTokensEst: null,
          estimatedInternalCostCents: null,
          statusSnapshot: 'provisioning',
          ttlPolicySnapshot: {
            cleanupGraceMinutes: 5,
            heartbeatMissingMinutes: null,
            idleTimeoutMinutes: 20,
            maxSessionTtlMinutes: 120,
            provisioningTimeoutMinutes: 15,
            triggerMode: 'manual',
            unhealthyProviderTimeoutMinutes: null,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      },
    },
    {
      async getRun(_userId: string, runId: string) {
        return { id: runId }
      },
      async stopRunForReason(userId: string, runId: string, reason: string) {
        stopped.push({ reason, runId: `${userId}:${runId}` })
        return {} as never
      },
    } as never,
  )

  const result = await service.reconcileStaleRuntimes({ limit: 10, staleMinutes: 5 })

  assert.equal(result.reconciled, 1)
  assert.deepEqual(stopped, [{ reason: 'provisioning_timeout', runId: 'user-1:run-1' }])
})

test('runtime maintenance stops running runs that exceed max session ttl', async () => {
  const stopped: Array<{ runId: string; reason: string }> = []

  const service = new RuntimeMaintenanceService(
    {
      async listRuntimeInstancesNeedingReconcile() {
        return [
          {
            ...baseRuntime,
            state: 'running',
          },
        ]
      },
      async findRuntimeInstanceByRunId() {
        return {
          ...baseRuntime,
          state: 'running',
        }
      },
    },
    {
      async findRunUsage() {
        return {
          id: 'usage-1',
          runId: 'run-1',
          userId: 'user-1',
          orderId: 'order-1',
          planId: 'warm_standby',
          planVersion: 'v1',
          triggerModeSnapshot: 'auto_wake',
          agentCount: 1,
          usesRealWorkspace: true,
          usesTools: true,
          networkEnabled: true,
          provisioningStartedAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
          providerAcceptedAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
          runningStartedAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
          lastMeaningfulActivityAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
          completedAt: null,
          workspaceReleasedAt: null,
          terminationReason: null,
          workspaceMinutes: null,
          toolCallsCount: null,
          inputTokensEst: null,
          outputTokensEst: null,
          estimatedInternalCostCents: null,
          statusSnapshot: 'running',
          ttlPolicySnapshot: {
            cleanupGraceMinutes: 10,
            heartbeatMissingMinutes: null,
            idleTimeoutMinutes: 45,
            maxSessionTtlMinutes: 360,
            provisioningTimeoutMinutes: 15,
            triggerMode: 'auto_wake',
            unhealthyProviderTimeoutMinutes: null,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      },
    },
    {
      async getRun(_userId: string, runId: string) {
        return { id: runId }
      },
      async stopRunForReason(userId: string, runId: string, reason: string) {
        stopped.push({ reason, runId: `${userId}:${runId}` })
        return {} as never
      },
    } as never,
  )

  const result = await service.reconcileStaleRuntimes({ limit: 10, staleMinutes: 5 })

  assert.equal(result.reconciled, 1)
  assert.deepEqual(stopped, [{ reason: 'ttl_expired', runId: 'user-1:run-1' }])
})

test('runtime maintenance stops running runs that exceed idle timeout based on meaningful activity', async () => {
  const stopped: Array<{ runId: string; reason: string }> = []

  const service = new RuntimeMaintenanceService(
    {
      async listRuntimeInstancesNeedingReconcile() {
        return [
          {
            ...baseRuntime,
            state: 'running',
          },
        ]
      },
      async findRuntimeInstanceByRunId() {
        return {
          ...baseRuntime,
          state: 'running',
        }
      },
    },
    {
      async findRunUsage() {
        return {
          id: 'usage-1',
          runId: 'run-1',
          userId: 'user-1',
          orderId: 'order-1',
          planId: 'warm_standby',
          planVersion: 'v1',
          triggerModeSnapshot: 'auto_wake',
          agentCount: 1,
          usesRealWorkspace: true,
          usesTools: true,
          networkEnabled: true,
          provisioningStartedAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
          providerAcceptedAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
          runningStartedAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
          lastMeaningfulActivityAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
          completedAt: null,
          workspaceReleasedAt: null,
          terminationReason: null,
          workspaceMinutes: null,
          toolCallsCount: null,
          inputTokensEst: null,
          outputTokensEst: null,
          estimatedInternalCostCents: null,
          statusSnapshot: 'running',
          ttlPolicySnapshot: {
            cleanupGraceMinutes: 10,
            heartbeatMissingMinutes: null,
            idleTimeoutMinutes: 45,
            maxSessionTtlMinutes: 360,
            provisioningTimeoutMinutes: 15,
            triggerMode: 'auto_wake',
            unhealthyProviderTimeoutMinutes: null,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      },
    },
    {
      async getRun(_userId: string, runId: string) {
        return { id: runId }
      },
      async stopRunForReason(userId: string, runId: string, reason: string) {
        stopped.push({ reason, runId: `${userId}:${runId}` })
        return {} as never
      },
    } as never,
  )

  const result = await service.reconcileStaleRuntimes({ limit: 10, staleMinutes: 5 })

  assert.equal(result.reconciled, 1)
  assert.deepEqual(stopped, [{ reason: 'idle_timeout', runId: 'user-1:run-1' }])
})
