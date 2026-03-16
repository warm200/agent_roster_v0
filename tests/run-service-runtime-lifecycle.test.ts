import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { Run, RuntimeInstance } from '@/lib/types'
import { RunService, setRunServiceDepsForTesting } from '@/server/services/run.service'

const baseRun: Run = {
  id: 'run-test-1',
  userId: 'user-test-1',
  orderId: 'order-test-1',
  channelConfigId: 'channel-test-1',
  status: 'running',
  combinedRiskLevel: 'low',
  usesRealWorkspace: true,
  usesTools: true,
  networkEnabled: true,
  resultSummary: null,
  resultArtifacts: [],
  createdAt: new Date().toISOString(),
  startedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  completedAt: null,
}

const baseRuntimeRecord: RuntimeInstance = {
  id: 'runtime-1',
  runId: 'run-test-1',
  userId: 'user-test-1',
  orderId: 'order-test-1',
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
  lastReconciledAt: new Date().toISOString(),
  metadataJson: {},
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

test('run service deletes ephemeral runtime state after stop', async () => {
  let deleteCalled = false
  const runtimeUpdates: Array<Partial<RuntimeInstance>> = []

  const service = new RunService(
    {
      async findRunForUser() {
        return baseRun
      },
      async updateRun(_runId: string, nextRun: Partial<Run>) {
        return { ...baseRun, ...nextRun }
      },
      async updateRunUsage() {
        return null
      },
    } as never,
    {
      async findRuntimeInstanceByRunId() {
        return baseRuntimeRecord
      },
      async updateRuntimeInstance(_runId: string, input: Partial<RuntimeInstance>) {
        runtimeUpdates.push(input)
        return { ...baseRuntimeRecord, ...input }
      },
      async closeRuntimeInterval() {
        return null
      },
    } as never,
  )

  setRunServiceDepsForTesting({
    getRunProvider: () => ({
      name: 'daytona',
      async createRun() {
        return baseRun
      },
      async getLogs() {
        return []
      },
      async getResult() {
        return null
      },
      async getStatus() {
        return baseRun
      },
      async stopRun() {
        return null
      },
      async stopRuntimeInstance() {
        return {
          ...baseRuntimeRecord,
          lastReconciledAt: new Date().toISOString(),
          state: 'stopped',
          stoppedAt: new Date().toISOString(),
          stopReason: 'manual_stop',
          workspaceReleasedAt: new Date().toISOString(),
        }
      },
      async deleteRuntimeInstance() {
        deleteCalled = true
      },
    }),
  })

  const stopped = await service.stopRun('user-test-1', 'run-test-1')

  assert.equal(deleteCalled, true)
  assert.equal(stopped.status, 'completed')
  assert.equal(runtimeUpdates.some((update) => update.state === 'deleted'), true)

  setRunServiceDepsForTesting(null)
})

test('run service preserves recoverable runtime state after stop', async () => {
  let deleteCalled = false
  const runtimeUpdates: Array<Partial<RuntimeInstance>> = []

  const service = new RunService(
    {
      async findRunForUser() {
        return baseRun
      },
      async updateRun(_runId: string, nextRun: Partial<Run>) {
        return { ...baseRun, ...nextRun }
      },
      async updateRunUsage() {
        return null
      },
    } as never,
    {
      async findRuntimeInstanceByRunId() {
        return {
          ...baseRuntimeRecord,
          persistenceMode: 'recoverable',
          planId: 'warm_standby',
          runtimeMode: 'wakeable_recoverable',
        }
      },
      async updateRuntimeInstance(_runId: string, input: Partial<RuntimeInstance>) {
        runtimeUpdates.push(input)
        return {
          ...baseRuntimeRecord,
          persistenceMode: 'recoverable',
          planId: 'warm_standby',
          runtimeMode: 'wakeable_recoverable',
          ...input,
        }
      },
      async closeRuntimeInterval() {
        return null
      },
    } as never,
  )

  setRunServiceDepsForTesting({
    getRunProvider: () => ({
      name: 'daytona',
      async createRun() {
        return baseRun
      },
      async getLogs() {
        return []
      },
      async getResult() {
        return null
      },
      async getStatus() {
        return baseRun
      },
      async stopRun() {
        return null
      },
      async stopRuntimeInstance() {
        return {
          ...baseRuntimeRecord,
          persistenceMode: 'recoverable',
          planId: 'warm_standby',
          runtimeMode: 'wakeable_recoverable',
          lastReconciledAt: new Date().toISOString(),
          preservedStateAvailable: true,
          state: 'stopped',
          stoppedAt: new Date().toISOString(),
          stopReason: 'manual_stop',
          workspaceReleasedAt: null,
        }
      },
      async deleteRuntimeInstance() {
        deleteCalled = true
      },
    }),
  })

  const stopped = await service.stopRun('user-test-1', 'run-test-1')

  assert.equal(deleteCalled, false)
  assert.equal(stopped.status, 'completed')
  assert.equal(runtimeUpdates.some((update) => update.state === 'deleted'), false)

  setRunServiceDepsForTesting(null)
})

test('run service resumes recoverable stopped runtime state from completed status', async () => {
  const resumedAt = new Date().toISOString()
  const calls: string[] = []
  const completedRun: Run = {
    ...baseRun,
    completedAt: new Date().toISOString(),
    resultSummary: 'Managed runtime is sleeping and can be resumed later.',
    status: 'completed',
  }

  const service = new RunService(
    {
      async findRunForUser() {
        return completedRun
      },
      async updateRun(_runId: string, nextRun: Partial<Run>) {
        calls.push('repository.updateRun')
        return { ...completedRun, ...nextRun }
      },
      async updateRunUsage() {
        calls.push('repository.updateRunUsage')
        return null
      },
    } as never,
    {
      async findRuntimeInstanceByRunId() {
        return {
          ...baseRuntimeRecord,
          persistenceMode: 'recoverable',
          planId: 'warm_standby',
          runtimeMode: 'wakeable_recoverable',
          state: 'stopped',
          stoppedAt: completedRun.completedAt,
          preservedStateAvailable: true,
        }
      },
      async updateRuntimeInstance(_runId: string, _input: Partial<RuntimeInstance>) {
        calls.push('runtime.updateRuntimeInstance')
        return {
          ...baseRuntimeRecord,
          persistenceMode: 'recoverable',
          planId: 'warm_standby',
          runtimeMode: 'wakeable_recoverable',
          state: 'running',
          startedAt: resumedAt,
          stoppedAt: null,
          preservedStateAvailable: true,
          workspaceReleasedAt: null,
        }
      },
      async findOpenRuntimeInterval() {
        return null
      },
      async createRuntimeInterval() {
        calls.push('runtime.createRuntimeInterval')
        return null
      },
    } as never,
  )

  setRunServiceDepsForTesting({
    getOrderByIdForUser: async () =>
      ({
        id: completedRun.orderId,
        userId: completedRun.userId,
        items: [],
      }) as never,
    getOrderProviderApiKeysForUser: async () => ({}),
    getSubscriptionService: () =>
      ({
        getLaunchPolicy: async () => ({
          allowed: true,
          blockers: [],
          plan: { id: 'warm_standby' },
          subscription: null,
          usage: {
            activeBundles: 0,
            activeRunIds: [],
            concurrentRuns: 0,
          },
        }),
        reserveLaunchCredit: async () => {
          calls.push('subscription.reserveLaunchCredit')
          return null
        },
        commitReservedLaunchCredit: async () => {
          calls.push('subscription.commitReservedLaunchCredit')
          return null
        },
      }) as never,
    getRunProvider: () => ({
      name: 'daytona',
      async createRun() {
        return completedRun
      },
      async getLogs() {
        return []
      },
      async getResult() {
        return null
      },
      async getStatus() {
        return {
          ...completedRun,
          completedAt: null,
          startedAt: resumedAt,
          status: 'running',
        }
      },
      async restartRuntimeInstance() {
        calls.push('provider.restartRuntimeInstance')
        return {
          ...baseRuntimeRecord,
          persistenceMode: 'recoverable',
          planId: 'warm_standby',
          preservedStateAvailable: true,
          providerName: 'daytona',
          providerInstanceRef: 'sandbox-1',
          recoverableUntilAt: null,
          runId: completedRun.id,
          runtimeMode: 'wakeable_recoverable',
          startedAt: resumedAt,
          state: 'running',
          stoppedAt: null,
          stopReason: null,
          workspaceReleasedAt: null,
        }
      },
      async stopRun() {
        return null
      },
    }),
  })

  const resumed = await service.retryRun(completedRun.userId, completedRun.id)

  assert.equal(resumed.status, 'running')
  assert.equal(resumed.runtimeState, 'running')
  assert.equal(resumed.preservedStateAvailable, true)
  assert.deepEqual(calls, [
    'subscription.reserveLaunchCredit',
    'provider.restartRuntimeInstance',
    'runtime.updateRuntimeInstance',
    'runtime.createRuntimeInterval',
    'subscription.commitReservedLaunchCredit',
    'repository.updateRunUsage',
    'repository.updateRun',
  ])

  setRunServiceDepsForTesting(null)
})

test('run service archives old recoverable runtime state on read when threshold is exceeded', async () => {
  const previousArchiveMinutes = process.env.WARM_STANDBY_AUTO_ARCHIVE_MINUTES
  process.env.WARM_STANDBY_AUTO_ARCHIVE_MINUTES = '1'

  let archiveCalled = false

  const service = new RunService(
    {
      async findRunForUser() {
        return {
          ...baseRun,
          status: 'completed',
          completedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        }
      },
      async updateRun(_runId: string, nextRun: Partial<Run>) {
        return { ...baseRun, ...nextRun }
      },
      async updateRunUsage() {
        return null
      },
    } as never,
    {
      async findRuntimeInstanceByRunId() {
        return {
          ...baseRuntimeRecord,
          persistenceMode: 'recoverable',
          planId: 'warm_standby',
          runtimeMode: 'wakeable_recoverable',
          state: 'stopped',
          stoppedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        }
      },
      async updateRuntimeInstance(_runId: string, input: Partial<RuntimeInstance>) {
        return {
          ...baseRuntimeRecord,
          persistenceMode: 'recoverable',
          planId: 'warm_standby',
          runtimeMode: 'wakeable_recoverable',
          state: 'archived',
          ...input,
        }
      },
      async findOpenRuntimeInterval() {
        return null
      },
      async closeRuntimeInterval() {
        return null
      },
    } as never,
  )

  setRunServiceDepsForTesting({
    getRunProvider: () => ({
      name: 'daytona',
      async archiveRuntimeInstance() {
        archiveCalled = true
        return {
          ...baseRuntimeRecord,
          persistenceMode: 'recoverable',
          planId: 'warm_standby',
          runtimeMode: 'wakeable_recoverable',
          state: 'archived',
          archivedAt: new Date().toISOString(),
          preservedStateAvailable: true,
          stoppedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
          lastReconciledAt: new Date().toISOString(),
        }
      },
      async createRun() {
        return baseRun
      },
      async getLogs() {
        return []
      },
      async getResult() {
        return null
      },
      async getRuntimeInstance() {
        return {
          ...baseRuntimeRecord,
          persistenceMode: 'recoverable',
          planId: 'warm_standby',
          runtimeMode: 'wakeable_recoverable',
          state: 'stopped',
          preservedStateAvailable: true,
          stoppedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
          lastReconciledAt: new Date().toISOString(),
        }
      },
      async getStatus() {
        return {
          ...baseRun,
          status: 'completed',
          completedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        }
      },
      async stopRun() {
        return null
      },
    }),
  })

  await service.getRun('user-test-1', 'run-test-1')

  assert.equal(archiveCalled, true)

  setRunServiceDepsForTesting(null)
  if (previousArchiveMinutes === undefined) {
    delete process.env.WARM_STANDBY_AUTO_ARCHIVE_MINUTES
  } else {
    process.env.WARM_STANDBY_AUTO_ARCHIVE_MINUTES = previousArchiveMinutes
  }
})

test('run service prefers reconciled runtime state over stale provider status on read', async () => {
  const persistedRuns: Run[] = []

  const service = new RunService(
    {
      async findRunForUser() {
        return {
          ...baseRun,
          resultSummary: 'Managed runtime is provisioning. Status will update automatically.',
          status: 'running',
        }
      },
      async updateRun(_runId: string, nextRun: Partial<Run>) {
        const persisted = { ...baseRun, ...nextRun }
        persistedRuns.push(persisted)
        return persisted
      },
      async updateRunUsage() {
        return null
      },
    } as never,
    {
      async findRuntimeInstanceByRunId() {
        return {
          ...baseRuntimeRecord,
          persistenceMode: 'recoverable',
          planId: 'warm_standby',
          runtimeMode: 'wakeable_recoverable',
          state: 'stopped',
          stoppedAt: new Date().toISOString(),
          preservedStateAvailable: true,
        }
      },
      async updateRuntimeInstance(_runId: string, input: Partial<RuntimeInstance>) {
        return {
          ...baseRuntimeRecord,
          persistenceMode: 'recoverable',
          planId: 'warm_standby',
          runtimeMode: 'wakeable_recoverable',
          state: 'stopped',
          stoppedAt: new Date().toISOString(),
          preservedStateAvailable: true,
          ...input,
        }
      },
      async findOpenRuntimeInterval() {
        return null
      },
      async closeRuntimeInterval() {
        return null
      },
    } as never,
  )

  setRunServiceDepsForTesting({
    getRunProvider: () => ({
      name: 'daytona',
      async createRun() {
        return baseRun
      },
      async getLogs() {
        return []
      },
      async getResult() {
        return null
      },
      async getRuntimeInstance() {
        return {
          ...baseRuntimeRecord,
          persistenceMode: 'recoverable',
          planId: 'warm_standby',
          runtimeMode: 'wakeable_recoverable',
          state: 'stopped',
          stoppedAt: new Date().toISOString(),
          preservedStateAvailable: true,
          lastReconciledAt: new Date().toISOString(),
        }
      },
      async getStatus() {
        return {
          ...baseRun,
          resultSummary: 'Managed runtime is provisioning. Status will update automatically.',
          status: 'running',
        }
      },
      async stopRun() {
        return null
      },
    }),
  })

  const run = await service.getRun('user-test-1', 'run-test-1')

  assert.equal(run.status, 'completed')
  assert.equal(persistedRuns.at(-1)?.status, 'completed')

  setRunServiceDepsForTesting(null)
})

test('run service releases capacity from runtime state when provider status is unavailable', async () => {
  const usagePatches: Array<Record<string, unknown>> = []

  const service = new RunService(
    {
      async findRunForUser() {
        return {
          ...baseRun,
          resultSummary: 'Managed runtime is provisioning. Status will update automatically.',
          status: 'running',
        }
      },
      async updateRun(_runId: string, nextRun: Partial<Run>) {
        return { ...baseRun, ...nextRun }
      },
      async updateRunUsage(_runId: string, patch: Record<string, unknown>) {
        usagePatches.push(patch)
        return null
      },
    } as never,
    {
      async findRuntimeInstanceByRunId() {
        return {
          ...baseRuntimeRecord,
          persistenceMode: 'recoverable',
          planId: 'warm_standby',
          runtimeMode: 'wakeable_recoverable',
          state: 'stopped',
          stoppedAt: new Date().toISOString(),
          preservedStateAvailable: true,
        }
      },
      async updateRuntimeInstance(_runId: string, input: Partial<RuntimeInstance>) {
        return {
          ...baseRuntimeRecord,
          persistenceMode: 'recoverable',
          planId: 'warm_standby',
          runtimeMode: 'wakeable_recoverable',
          state: 'stopped',
          stoppedAt: new Date().toISOString(),
          preservedStateAvailable: true,
          ...input,
        }
      },
      async findOpenRuntimeInterval() {
        return null
      },
      async closeRuntimeInterval() {
        return null
      },
    } as never,
  )

  setRunServiceDepsForTesting({
    getRunProvider: () => ({
      name: 'daytona',
      async createRun() {
        return baseRun
      },
      async getLogs() {
        return []
      },
      async getResult() {
        return null
      },
      async getRuntimeInstance() {
        return {
          ...baseRuntimeRecord,
          persistenceMode: 'recoverable',
          planId: 'warm_standby',
          runtimeMode: 'wakeable_recoverable',
          state: 'stopped',
          stoppedAt: new Date().toISOString(),
          preservedStateAvailable: true,
          lastReconciledAt: new Date().toISOString(),
        }
      },
      async getStatus() {
        return null
      },
      async stopRun() {
        return null
      },
    }),
  })

  const run = await service.getRun('user-test-1', 'run-test-1')

  assert.equal(run.status, 'completed')
  assert.equal(usagePatches.some((patch) => patch.workspaceReleasedAt != null), true)

  setRunServiceDepsForTesting(null)
})

test('run service backfills missing runtime records from provider state on read', async () => {
  const createdRuntimeRecords: RuntimeInstance[] = []

  const service = new RunService(
    {
      async findRunForUser() {
        return baseRun
      },
      async updateRun(_runId: string, nextRun: Partial<Run>) {
        return { ...baseRun, ...nextRun }
      },
      async updateRunUsage() {
        return null
      },
    } as never,
    {
      async findRuntimeInstanceByRunId() {
        return null
      },
      async createRuntimeInstance(input: RuntimeInstance) {
        createdRuntimeRecords.push(input)
        return input
      },
      async findOpenRuntimeInterval() {
        return null
      },
      async createRuntimeInterval() {
        return null
      },
    } as never,
  )

  setRunServiceDepsForTesting({
    getRunProvider: () => ({
      name: 'daytona',
      async createRun() {
        return baseRun
      },
      async getLogs() {
        return []
      },
      async getResult() {
        return null
      },
      async getRuntimeInstance() {
        return {
          ...baseRuntimeRecord,
          lastReconciledAt: new Date().toISOString(),
          planId: 'warm_standby',
          persistenceMode: 'recoverable',
          preservedStateAvailable: true,
          runtimeMode: 'wakeable_recoverable',
          state: 'running',
        }
      },
      async getStatus() {
        return baseRun
      },
      async stopRun() {
        return null
      },
    }),
  })

  await service.getRun('user-test-1', 'run-test-1')

  assert.equal(createdRuntimeRecords.length, 1)
  assert.equal(createdRuntimeRecords[0]?.runId, 'run-test-1')
  assert.equal(createdRuntimeRecords[0]?.planId, 'warm_standby')

  setRunServiceDepsForTesting(null)
})
