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
