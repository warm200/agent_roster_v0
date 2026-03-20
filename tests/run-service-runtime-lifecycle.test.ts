import assert from 'node:assert/strict'
import { test } from 'node:test'

import { canOpenRunControlUi } from '@/lib/run-control-ui'
import type { Order, Run, RuntimeInstance } from '@/lib/types'
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

const baseOrder: Order = {
  amountCents: 1900,
  bundleRisk: {
    highestRiskDriver: 'Test Agent',
    level: 'low',
    summary: 'Low-risk test bundle.',
  },
  cartId: 'cart-test-1',
  channelConfig: null,
  createdAt: new Date().toISOString(),
  currency: 'USD',
  id: 'order-test-1',
  items: [],
  paidAt: new Date().toISOString(),
  paymentProvider: 'stripe',
  paymentReference: 'pi_test_1',
  status: 'paid',
  updatedAt: new Date().toISOString(),
  userId: 'user-test-1',
}

test('run service deletes ephemeral runtime state after stop', async () => {
  let deleteCalled = false
  let claimCalled = false
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
    getOrderByIdForUser: async () => baseOrder,
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
    getTelegramService: () =>
      ({
        claimWebhookForApp: async () => {
          claimCalled = true
          return { orderId: baseOrder.id, url: 'https://example.com/api/webhooks/telegram?orderId=order-test-1' }
        },
      }) as never,
  })

  const stopped = await service.stopRun('user-test-1', 'run-test-1')

  assert.equal(deleteCalled, true)
  assert.equal(claimCalled, true)
  assert.equal(stopped.status, 'completed')
  assert.equal(runtimeUpdates.some((update) => update.state === 'deleted'), true)

  setRunServiceDepsForTesting(null)
})

test('run service preserves recoverable runtime state after stop', async () => {
  let deleteCalled = false
  let claimCalled = false
  let stoppedNotice: string | null = null
  const runtimeUpdates: Array<Partial<RuntimeInstance>> = []
  const usagePatches: Array<Record<string, unknown>> = []
  const run = {
    ...baseRun,
    startedAt: '2026-03-18T12:00:00.000Z',
  }
  const runtimeRecord = {
    ...baseRuntimeRecord,
    startedAt: '2026-03-18T12:00:00.000Z',
  }

  const service = new RunService(
    {
      async findRunForUser() {
        return run
      },
      async updateRun(_runId: string, nextRun: Partial<Run>) {
        return { ...run, ...nextRun }
      },
      async updateRunUsage(_runId: string, patch: Record<string, unknown>) {
        usagePatches.push(patch)
        return null
      },
      async findRunUsage() {
        return {
          agentCount: 1,
          completedAt: null,
          createdAt: run.createdAt,
          estimatedInternalCostCents: null,
          id: 'usage-1',
          inputTokensEst: null,
          lastMeaningfulActivityAt: run.updatedAt,
          networkEnabled: true,
          orderId: run.orderId,
          outputTokensEst: null,
          planId: 'warm_standby',
          planVersion: 'v1',
          providerAcceptedAt: run.startedAt,
          provisioningStartedAt: run.createdAt,
          runId: run.id,
          runningStartedAt: run.startedAt,
          statusSnapshot: 'running',
          terminationReason: null,
          toolCallsCount: null,
          triggerModeSnapshot: 'auto_wake',
          ttlPolicySnapshot: {
            cleanupGraceMinutes: 5,
            heartbeatMissingMinutes: null,
            idleTimeoutMinutes: 45,
            maxSessionTtlMinutes: 60,
            provisioningTimeoutMinutes: 2,
            triggerMode: 'auto_wake',
            unhealthyProviderTimeoutMinutes: null,
          },
          updatedAt: run.updatedAt,
          userId: run.userId,
          usesRealWorkspace: true,
          usesTools: true,
          workspaceMinutes: null,
          workspaceReleasedAt: null,
        }
      },
    } as never,
    {
      async findRuntimeInstanceByRunId() {
        return {
          ...runtimeRecord,
          persistenceMode: 'recoverable',
          planId: 'warm_standby',
          runtimeMode: 'wakeable_recoverable',
        }
      },
      async updateRuntimeInstance(_runId: string, input: Partial<RuntimeInstance>) {
        runtimeUpdates.push(input)
        return {
          ...runtimeRecord,
          persistenceMode: 'recoverable',
          planId: 'warm_standby',
          runtimeMode: 'wakeable_recoverable',
          ...input,
        }
      },
      async closeRuntimeInterval() {
        return {
          closeReason: 'manual_stop',
          createdAt: '2026-03-18T12:00:00.000Z',
          endedAt: '2026-03-18T12:10:00.000Z',
          id: 'interval-1',
          providerInstanceRef: 'sandbox-1',
          runId: run.id,
          runtimeInstanceId: runtimeRecord.id,
          startedAt: '2026-03-18T12:00:00.000Z',
          updatedAt: '2026-03-18T12:10:00.000Z',
        }
      },
    } as never,
  )

  setRunServiceDepsForTesting({
    getOrderByIdForUser: async () => ({
      ...baseOrder,
      id: run.orderId,
      userId: run.userId,
    }),
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
          ...runtimeRecord,
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
    getTelegramService: () =>
      ({
        claimWebhookForApp: async () => {
          claimCalled = true
          return { orderId: run.orderId, url: 'https://example.com/api/webhooks/telegram?orderId=order-test-1' }
        },
        sendPairedMessage: async ({ text }: { text: string }) => {
          stoppedNotice = text
          return { chatId: '77', orderId: run.orderId }
        },
      }) as never,
  })

  const stopped = await service.stopRun('user-test-1', 'run-test-1')

  assert.equal(deleteCalled, false)
  assert.equal(claimCalled, true)
  assert.equal(
    stoppedNotice,
    'Your sandbox was stopped. Send any message here to wake it up again.',
  )
  assert.equal(stopped.status, 'completed')
  assert.equal(runtimeUpdates.some((update) => update.state === 'deleted'), false)
  assert.equal(usagePatches.some((patch) => patch.workspaceMinutes === 10), true)

  setRunServiceDepsForTesting(null)
})

test('run service terminates stopped recoverable warm runtime state', async () => {
  let deleteCalled = false
  let claimCalled = false
  let sendCalled = false
  const runtimeUpdates: Array<Partial<RuntimeInstance>> = []
  const usagePatches: Array<Record<string, unknown>> = []
  const stoppedAt = '2026-03-18T12:10:00.000Z'
  const completedRun: Run = {
    ...baseRun,
    completedAt: stoppedAt,
    persistenceMode: 'recoverable',
    preservedStateAvailable: true,
    resultSummary: 'Managed runtime is sleeping and can be resumed later.',
    runtimeState: 'stopped',
    status: 'completed',
  }
  const runtimeRecord: RuntimeInstance = {
    ...baseRuntimeRecord,
    archivedAt: null,
    deletedAt: null,
    persistenceMode: 'recoverable',
    planId: 'warm_standby',
    preservedStateAvailable: true,
    recoverableUntilAt: '2026-03-19T12:10:00.000Z',
    runtimeMode: 'wakeable_recoverable',
    state: 'stopped',
    stoppedAt,
    workspaceReleasedAt: null,
  }

  const service = new RunService(
    {
      async findRunForUser() {
        return completedRun
      },
      async updateRun(_runId: string, nextRun: Partial<Run>) {
        return { ...completedRun, ...nextRun }
      },
      async updateRunUsage(_runId: string, patch: Record<string, unknown>) {
        usagePatches.push(patch)
        return null
      },
    } as never,
    {
      async findRuntimeInstanceByRunId() {
        return runtimeRecord
      },
      async updateRuntimeInstance(_runId: string, input: Partial<RuntimeInstance>) {
        runtimeUpdates.push(input)
        return { ...runtimeRecord, ...input }
      },
      async closeRuntimeInterval() {
        return null
      },
    } as never,
  )

  setRunServiceDepsForTesting({
    getOrderByIdForUser: async () => ({
      ...baseOrder,
      id: completedRun.orderId,
      userId: completedRun.userId,
    }),
    getRunProvider: () => ({
      name: 'daytona',
      async createRun() {
        return completedRun
      },
      async deleteRuntimeInstance() {
        deleteCalled = true
      },
      async getLogs() {
        return []
      },
      async getResult() {
        return null
      },
      async getStatus() {
        return completedRun
      },
      async stopRun() {
        return null
      },
    }),
    getTelegramService: () =>
      ({
        claimWebhookForApp: async () => {
          claimCalled = true
          return { orderId: completedRun.orderId, url: 'https://example.com/api/webhooks/telegram?orderId=order-test-1' }
        },
        sendPairedMessage: async () => {
          sendCalled = true
          return { chatId: '77', orderId: completedRun.orderId }
        },
      }) as never,
  })

  const terminated = await service.terminateRun(completedRun.userId, completedRun.id)

  assert.equal(deleteCalled, true)
  assert.equal(claimCalled, true)
  assert.equal(sendCalled, false)
  assert.equal(terminated.status, 'completed')
  assert.equal(terminated.runtimeState, 'deleted')
  assert.equal(terminated.preservedStateAvailable, false)
  assert.equal(runtimeUpdates.some((update) => update.state === 'deleted'), true)
  assert.equal(
    usagePatches.some((patch) => patch.terminationReason === 'deleted_after_stop'),
    true,
  )

  setRunServiceDepsForTesting(null)
})

test('run service honors already stopped recoverable sandboxes when provider stop readback throws', async () => {
  let claimCalled = false
  let stoppedNotice: string | null = null
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
          preservedStateAvailable: true,
        }
      },
      async updateRuntimeInstance(_runId: string, input: Partial<RuntimeInstance>) {
        runtimeUpdates.push(input)
        return {
          ...baseRuntimeRecord,
          persistenceMode: 'recoverable',
          planId: 'warm_standby',
          runtimeMode: 'wakeable_recoverable',
          preservedStateAvailable: true,
          ...input,
        }
      },
      async closeRuntimeInterval() {
        return null
      },
    } as never,
  )

  setRunServiceDepsForTesting({
    getOrderByIdForUser: async () => baseOrder,
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
        throw new Error('Sandbox is not started')
      },
    }),
    getTelegramService: () =>
      ({
        claimWebhookForApp: async () => {
          claimCalled = true
          return { orderId: baseOrder.id, url: 'https://example.com/api/webhooks/telegram?orderId=order-test-1' }
        },
        sendPairedMessage: async ({ text }: { text: string }) => {
          stoppedNotice = text
          return { chatId: '77', orderId: baseOrder.id }
        },
      }) as never,
  })

  const stopped = await service.stopRun('user-test-1', 'run-test-1')

  assert.equal(stopped.status, 'completed')
  assert.equal(claimCalled, true)
  assert.equal(
    stoppedNotice,
    'Your sandbox was stopped. Send any message here to wake it up again.',
  )
  assert.equal(stopped.runtimeState, 'stopped')
  assert.equal(stopped.preservedStateAvailable, true)
  assert.equal(runtimeUpdates.some((update) => update.state === 'stopped'), true)

  setRunServiceDepsForTesting(null)
})

test('run service marks runtime deleted when stop succeeds logically but provider sandbox is already gone', async () => {
  let claimCalled = false
  const runtimeUpdates: Array<Partial<RuntimeInstance>> = []
  const closedIntervals: Array<{ runtimeInstanceId: string; reason: string | null }> = []

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
      async closeRuntimeInterval(runtimeInstanceId: string, _endedAt: string, closeReason: string | null) {
        closedIntervals.push({ runtimeInstanceId, reason: closeReason })
        return null
      },
    } as never,
  )

  setRunServiceDepsForTesting({
    getOrderByIdForUser: async () => baseOrder,
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
        return null
      },
      async stopRun() {
        return null
      },
      async stopRuntimeInstance() {
        return null
      },
    }),
    getTelegramService: () =>
      ({
        claimWebhookForApp: async () => {
          claimCalled = true
          return { orderId: baseOrder.id, url: 'https://example.com/api/webhooks/telegram?orderId=order-test-1' }
        },
      }) as never,
  })

  const stopped = await service.stopRun('user-test-1', 'run-test-1')

  assert.equal(stopped.status, 'completed')
  assert.equal(claimCalled, false)
  assert.equal(runtimeUpdates.some((update) => update.state === 'deleted'), true)
  assert.deepEqual(closedIntervals, [{ runtimeInstanceId: baseRuntimeRecord.id, reason: 'manual_stop' }])

  setRunServiceDepsForTesting(null)
})

test('run service marks runtime deleted when provider stop falls back to a terminal run without runtime state', async () => {
  let claimCalled = false
  const runtimeUpdates: Array<Partial<RuntimeInstance>> = []
  const closedIntervals: Array<{ runtimeInstanceId: string; reason: string | null }> = []

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
      async closeRuntimeInterval(runtimeInstanceId: string, _endedAt: string, closeReason: string | null) {
        closedIntervals.push({ runtimeInstanceId, reason: closeReason })
        return null
      },
    } as never,
  )

  setRunServiceDepsForTesting({
    getOrderByIdForUser: async () => baseOrder,
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
        return null
      },
      async stopRun() {
        return {
          ...baseRun,
          completedAt: new Date().toISOString(),
          resultSummary: 'Managed runtime was stopped after inactivity.',
          status: 'failed',
          updatedAt: new Date().toISOString(),
        }
      },
      async stopRuntimeInstance() {
        return null
      },
    }),
    getTelegramService: () =>
      ({
        claimWebhookForApp: async () => {
          claimCalled = true
          return { orderId: baseOrder.id, url: 'https://example.com/api/webhooks/telegram?orderId=order-test-1' }
        },
      }) as never,
  })

  const stopped = await service.stopRunForReason('user-test-1', 'run-test-1', 'idle_timeout')

  assert.equal(stopped.status, 'failed')
  assert.equal(claimCalled, true)
  assert.equal(runtimeUpdates.some((update) => update.state === 'deleted'), true)
  assert.deepEqual(closedIntervals, [{ runtimeInstanceId: baseRuntimeRecord.id, reason: 'idle_timeout' }])

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
          allowed: false,
          blockers: [
            'Resume or terminate the existing stopped Warm Standby run for this bundle instead of launching a new one.',
          ],
          plan: { id: 'warm_standby' },
          subscription: null,
          usage: {
            activeBundles: 0,
            activeRunIds: [completedRun.id],
            concurrentRuns: 1,
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
    getTelegramService: () =>
      ({
        releaseWebhookToRuntimePolling: async () => {
          calls.push('telegram.releaseWebhookToRuntimePolling')
          return { orderId: completedRun.orderId }
        },
      }) as never,
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
    'telegram.releaseWebhookToRuntimePolling',
    'repository.updateRunUsage',
    'repository.updateRunUsage',
    'repository.updateRun',
  ])

  setRunServiceDepsForTesting(null)
})

test('run service auto-wakes a single stopped warm standby run for an order', async () => {
  const occurredAt = new Date().toISOString()
  const resumedAt = new Date(Date.now() + 60_000).toISOString()
  const calls: string[] = []
  const stoppedRun: Run = {
    ...baseRun,
    completedAt: new Date().toISOString(),
    resultSummary: 'Managed runtime is sleeping and can be resumed later.',
    status: 'completed',
  }

  const service = new RunService(
    {
      async findRunForUser(runId: string) {
        assert.equal(runId, stoppedRun.id)
        return stoppedRun
      },
      async listRunsForOrder(orderId: string) {
        assert.equal(orderId, stoppedRun.orderId)
        return [stoppedRun]
      },
      async updateRun(_runId: string, nextRun: Partial<Run>) {
        calls.push('repository.updateRun')
        return { ...stoppedRun, ...nextRun }
      },
      async updateRunUsage(_runId: string, patch: Record<string, unknown>) {
        calls.push(`repository.updateRunUsage:${String(patch.lastMeaningfulActivityAt ?? patch.statusSnapshot ?? 'patch')}`)
        return null
      },
      async findRunUsage() {
        return {
          agentCount: 1,
          completedAt: stoppedRun.completedAt,
          createdAt: stoppedRun.createdAt,
          estimatedInternalCostCents: null,
          id: 'usage-1',
          inputTokensEst: null,
          lastMeaningfulActivityAt: null,
          networkEnabled: true,
          orderId: stoppedRun.orderId,
          outputTokensEst: null,
          planId: 'warm_standby',
          planVersion: 'v1',
          providerAcceptedAt: stoppedRun.startedAt,
          provisioningStartedAt: stoppedRun.createdAt,
          runId: stoppedRun.id,
          runningStartedAt: stoppedRun.startedAt,
          statusSnapshot: 'completed',
          terminationReason: 'idle_timeout',
          toolCallsCount: null,
          triggerModeSnapshot: 'auto_wake',
          ttlPolicySnapshot: {
            cleanupGraceMinutes: 10,
            heartbeatMissingMinutes: null,
            idleTimeoutMinutes: 45,
            maxSessionTtlMinutes: 360,
            provisioningTimeoutMinutes: 15,
            triggerMode: 'auto_wake',
            unhealthyProviderTimeoutMinutes: null,
          },
          updatedAt: stoppedRun.updatedAt,
          userId: stoppedRun.userId,
          usesRealWorkspace: true,
          usesTools: true,
          workspaceMinutes: null,
          workspaceReleasedAt: stoppedRun.completedAt,
        } as never
      },
    } as never,
    {
      async findRuntimeInstanceByRunId() {
        return {
          ...baseRuntimeRecord,
          runId: stoppedRun.id,
          userId: stoppedRun.userId,
          orderId: stoppedRun.orderId,
          planId: 'warm_standby',
          runtimeMode: 'wakeable_recoverable',
          persistenceMode: 'recoverable',
          state: 'stopped',
          stoppedAt: stoppedRun.completedAt,
          preservedStateAvailable: true,
          workspaceReleasedAt: null,
        }
      },
      async updateRuntimeInstance(_runId: string, input: Partial<RuntimeInstance>) {
        calls.push('runtime.updateRuntimeInstance')
        return {
          ...baseRuntimeRecord,
          runId: stoppedRun.id,
          userId: stoppedRun.userId,
          orderId: stoppedRun.orderId,
          planId: 'warm_standby',
          runtimeMode: 'wakeable_recoverable',
          persistenceMode: 'recoverable',
          preservedStateAvailable: true,
          ...input,
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
        id: stoppedRun.orderId,
        userId: stoppedRun.userId,
        items: [],
      }) as never,
    getOrderProviderApiKeysForUser: async () => ({}),
    getSubscriptionService: () =>
      ({
        commitReservedLaunchCredit: async () => {
          calls.push('subscription.commit')
          return null
        },
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
        refundReservedLaunchCredit: async () => null,
        reserveLaunchCredit: async () => {
          calls.push('subscription.reserve')
          return null
        },
      } as never),
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
          runId: stoppedRun.id,
          userId: stoppedRun.userId,
          orderId: stoppedRun.orderId,
          planId: 'warm_standby',
          runtimeMode: 'wakeable_recoverable',
          persistenceMode: 'recoverable',
          state: 'stopped',
          stoppedAt: stoppedRun.completedAt,
          preservedStateAvailable: true,
        }
      },
      async getStatus() {
        return {
          ...stoppedRun,
          completedAt: null,
          runtimeState: 'running',
          startedAt: resumedAt,
          status: 'running',
          updatedAt: resumedAt,
        }
      },
      async restartRuntimeInstance() {
        calls.push('provider.restartRuntimeInstance')
        return {
          ...baseRuntimeRecord,
          runId: stoppedRun.id,
          userId: stoppedRun.userId,
          orderId: stoppedRun.orderId,
          planId: 'warm_standby',
          runtimeMode: 'wakeable_recoverable',
          persistenceMode: 'recoverable',
          state: 'running',
          startedAt: resumedAt,
          stoppedAt: null,
          preservedStateAvailable: true,
          workspaceReleasedAt: null,
          lastReconciledAt: resumedAt,
        }
      },
      async stopRun() {
        return null
      },
    }),
    getTelegramService: () =>
      ({
        releaseWebhookToRuntimePolling: async () => {
          calls.push('telegram.releaseWebhookToRuntimePolling')
          return { orderId: stoppedRun.orderId }
        },
      }) as never,
  })

  const wake = await service.wakeStoppedRunForOrder(stoppedRun.orderId, occurredAt)

  assert.deepEqual(wake, {
    occurredAt,
    orderId: stoppedRun.orderId,
    outcome: 'resumed',
    runId: stoppedRun.id,
  })
  assert.equal(calls.includes('provider.restartRuntimeInstance'), true)
  assert.equal(calls.includes('subscription.reserve'), true)
  assert.equal(calls.includes('subscription.commit'), true)
  assert.equal(calls.includes('telegram.releaseWebhookToRuntimePolling'), true)

  setRunServiceDepsForTesting(null)
})

test('run service does not auto-wake when an order has multiple stopped warm standby runs', async () => {
  const occurredAt = new Date().toISOString()
  const stoppedRunA: Run = {
    ...baseRun,
    id: 'run-a',
    completedAt: new Date().toISOString(),
    resultSummary: 'Managed runtime is sleeping and can be resumed later.',
    status: 'completed',
  }
  const stoppedRunB: Run = {
    ...baseRun,
    id: 'run-b',
    completedAt: new Date().toISOString(),
    resultSummary: 'Managed runtime is sleeping and can be resumed later.',
    status: 'completed',
  }
  let restartCalled = false

  const service = new RunService(
    {
      async findRunForUser(runId: string) {
        return runId === stoppedRunA.id ? stoppedRunA : stoppedRunB
      },
      async listRunsForOrder() {
        return [stoppedRunA, stoppedRunB]
      },
      async updateRun(runId: string, nextRun: Partial<Run>) {
        const base = runId === stoppedRunA.id ? stoppedRunA : stoppedRunB
        return { ...base, ...nextRun }
      },
    } as never,
    {
      async findRuntimeInstanceByRunId(runId: string) {
        return {
          ...baseRuntimeRecord,
          runId,
          planId: 'warm_standby',
          runtimeMode: 'wakeable_recoverable',
          persistenceMode: 'recoverable',
          state: 'stopped',
          stoppedAt: new Date().toISOString(),
          preservedStateAvailable: true,
          workspaceReleasedAt: null,
        }
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
        return null
      },
      async getStatus() {
        return null
      },
      async restartRuntimeInstance() {
        restartCalled = true
        return null
      },
      async stopRun() {
        return null
      },
    }),
  })

  const wake = await service.wakeStoppedRunForOrder(stoppedRunA.orderId, occurredAt)

  assert.deepEqual(wake, {
    occurredAt,
    orderId: stoppedRunA.orderId,
    outcome: 'ambiguous',
    runId: null,
  })
  assert.equal(restartCalled, false)

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

test('run service keeps persisted stopped runtime state when provider read throws', async () => {
  const persistedRuns: Run[] = []

  const service = new RunService(
    {
      async findRunForUser() {
        return {
          ...baseRun,
          resultSummary: 'Managed runtime is provisioning. Status will update automatically.',
          status: 'completed',
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
        throw new Error('provider read failed')
      },
      async getStatus() {
        throw new Error('provider read failed')
      },
      async stopRun() {
        return null
      },
    }),
  })

  const run = await service.getRun('user-test-1', 'run-test-1')

  assert.equal(run.status, 'completed')
  assert.equal(run.runtimeState, 'stopped')
  assert.equal(run.preservedStateAvailable, true)
  assert.equal(persistedRuns.at(-1)?.runtimeState, 'stopped')

  setRunServiceDepsForTesting(null)
})

test('run service repairs stale running runtime state when provider read reports stopped sandbox access', async () => {
  const persistedRuns: Run[] = []
  const runtimeUpdates: Array<Partial<RuntimeInstance>> = []
  const usagePatches: Array<Record<string, unknown>> = []
  const closedIntervals: Array<{ runtimeInstanceId: string; reason: string | null }> = []

  const service = new RunService(
    {
      async findRunForUser() {
        return {
          ...baseRun,
          resultSummary: 'Managed runtime is ready for bundle order-test-1. Open Control UI to continue.',
          status: 'running',
        }
      },
      async updateRun(_runId: string, nextRun: Partial<Run>) {
        const persisted = { ...baseRun, ...nextRun }
        persistedRuns.push(persisted)
        return persisted
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
          state: 'running',
          preservedStateAvailable: true,
        }
      },
      async updateRuntimeInstance(_runId: string, input: Partial<RuntimeInstance>) {
        runtimeUpdates.push(input)
        return {
          ...baseRuntimeRecord,
          persistenceMode: 'recoverable',
          planId: 'warm_standby',
          runtimeMode: 'wakeable_recoverable',
          preservedStateAvailable: true,
          ...input,
        }
      },
      async closeRuntimeInterval(runtimeInstanceId: string, _endedAt: string, closeReason: string | null) {
        closedIntervals.push({ runtimeInstanceId, reason: closeReason })
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
        throw new Error('Sandbox is not started')
      },
      async getStatus() {
        throw new Error('Sandbox is not started')
      },
      async stopRun() {
        return null
      },
    }),
  })

  const run = await service.getRun('user-test-1', 'run-test-1')

  assert.equal(run.status, 'completed')
  assert.equal(run.runtimeState, 'stopped')
  assert.equal(run.preservedStateAvailable, true)
  assert.equal(runtimeUpdates.at(-1)?.state, 'stopped')
  assert.equal(usagePatches.some((patch) => patch.workspaceReleasedAt != null), true)
  assert.deepEqual(closedIntervals, [{ runtimeInstanceId: baseRuntimeRecord.id, reason: 'manual_stop' }])
  assert.equal(persistedRuns.at(-1)?.runtimeState, 'stopped')

  setRunServiceDepsForTesting(null)
})

test('run service repairs stale running runtime rows when provider state is missing but workspace is already released', async () => {
  const runtimeUpdates: Array<Partial<RuntimeInstance>> = []
  const usagePatches: Array<Record<string, unknown>> = []

  const service = new RunService(
    {
      async findRunForUser() {
        return {
          ...baseRun,
          completedAt: new Date().toISOString(),
          resultSummary: 'Managed runtime was stopped after inactivity.',
          status: 'failed',
        }
      },
      async updateRun(_runId: string, nextRun: Partial<Run>) {
        return { ...baseRun, ...nextRun }
      },
      async updateRunUsage(_runId: string, patch: Record<string, unknown>) {
        usagePatches.push(patch)
        return null
      },
      async findRunUsage() {
        return {
          agentCount: 1,
          completedAt: new Date().toISOString(),
          createdAt: baseRun.createdAt,
          estimatedInternalCostCents: null,
          id: 'usage-1',
          inputTokensEst: null,
          lastMeaningfulActivityAt: baseRun.updatedAt,
          networkEnabled: true,
          orderId: baseRun.orderId,
          outputTokensEst: null,
          planId: 'run',
          planVersion: 'v1',
          providerAcceptedAt: baseRun.startedAt,
          provisioningStartedAt: baseRun.createdAt,
          runId: baseRun.id,
          runningStartedAt: baseRun.startedAt,
          statusSnapshot: 'failed',
          terminationReason: 'idle_timeout',
          toolCallsCount: null,
          triggerModeSnapshot: 'manual',
          ttlPolicySnapshot: {
            cleanupGraceMinutes: 5,
            heartbeatMissingMinutes: null,
            idleTimeoutMinutes: 1,
            maxSessionTtlMinutes: 2,
            provisioningTimeoutMinutes: 2,
            triggerMode: 'manual',
            unhealthyProviderTimeoutMinutes: null,
          },
          updatedAt: baseRun.updatedAt,
          userId: baseRun.userId,
          usesRealWorkspace: true,
          usesTools: true,
          workspaceMinutes: null,
          workspaceReleasedAt: new Date().toISOString(),
        }
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
        return null
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
  assert.equal(run.runtimeState, 'deleted')
  assert.equal(run.resultSummary, 'Managed runtime session ended and state was released.')
  assert.equal(runtimeUpdates.some((update) => update.state === 'deleted'), true)
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

test('run service records provider progress time as meaningful activity on read', async () => {
  const progressedAt = new Date(Date.now() + 60_000).toISOString()
  const originalStartedAt = baseRun.startedAt!
  const usageUpdates: Array<Record<string, unknown>> = []

  const service = new RunService(
    {
      async findRunForUser() {
        return baseRun
      },
      async updateRun(_runId: string, nextRun: Partial<Run>) {
        return { ...baseRun, ...nextRun }
      },
      async updateRunUsage(_runId: string, input: Record<string, unknown>) {
        usageUpdates.push(input)
        return null
      },
      async findRunUsage() {
        return {
          agentCount: 1,
          completedAt: null,
          createdAt: originalStartedAt,
          estimatedInternalCostCents: null,
          id: 'usage-1',
          inputTokensEst: null,
          lastMeaningfulActivityAt: originalStartedAt,
          networkEnabled: true,
          orderId: baseRun.orderId,
          outputTokensEst: null,
          planId: 'run',
          planVersion: 'v1',
          providerAcceptedAt: originalStartedAt,
          provisioningStartedAt: baseRun.createdAt,
          runId: baseRun.id,
          runningStartedAt: originalStartedAt,
          statusSnapshot: 'running',
          terminationReason: null,
          toolCallsCount: null,
          triggerModeSnapshot: 'manual',
          ttlPolicySnapshot: {
            cleanupGraceMinutes: 5,
            heartbeatMissingMinutes: null,
            idleTimeoutMinutes: 1,
            maxSessionTtlMinutes: 5,
            provisioningTimeoutMinutes: 2,
            triggerMode: 'manual',
            unhealthyProviderTimeoutMinutes: null,
          },
          updatedAt: originalStartedAt,
          userId: baseRun.userId,
          usesRealWorkspace: true,
          usesTools: true,
          workspaceMinutes: null,
          workspaceReleasedAt: null,
        }
      },
    } as never,
    {
      async findRuntimeInstanceByRunId() {
        return baseRuntimeRecord
      },
      async updateRuntimeInstance(_runId: string, input: Partial<RuntimeInstance>) {
        return { ...baseRuntimeRecord, ...input }
      },
      async findOpenRuntimeInterval() {
        return { id: 'interval-1' }
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
          providerName: 'daytona',
          runtimeMode: 'temporary_execution',
          lastReconciledAt: progressedAt,
        }
      },
      async getStatus() {
        return {
          ...baseRun,
          status: 'running',
          updatedAt: progressedAt,
        }
      },
      async stopRun() {
        return null
      },
    }),
  })

  const run = await service.getRun(baseRun.userId, baseRun.id)

  assert.equal(run.updatedAt, progressedAt)
  assert.equal(
    usageUpdates.some((update) => update.lastMeaningfulActivityAt === progressedAt),
    true,
  )
  assert.equal(
    usageUpdates.some(
      (update) =>
        update.providerAcceptedAt === originalStartedAt && update.runningStartedAt === originalStartedAt,
    ),
    true,
  )

  setRunServiceDepsForTesting(null)
})

test('run service sends telegram notice when a run becomes control-ui ready', async () => {
  let currentRun: Run = {
    ...baseRun,
    resultSummary: 'Managed runtime is restarting for bundle order-test-1. Status will update automatically.',
    runtimeState: 'running',
    status: 'running',
  }
  const delivered: Array<{ orderId: string; text: string }> = []

  const service = new RunService(
    {
      async findRunForUser() {
        return currentRun
      },
      async updateRun(_runId: string, nextRun: Partial<Run>) {
        currentRun = { ...currentRun, ...nextRun }
        return currentRun
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
          state: 'running',
          preservedStateAvailable: true,
        }
      },
      async updateRuntimeInstance(_runId: string, input: Partial<RuntimeInstance>) {
        return {
          ...baseRuntimeRecord,
          persistenceMode: 'recoverable',
          planId: 'warm_standby',
          runtimeMode: 'wakeable_recoverable',
          state: 'running',
          preservedStateAvailable: true,
          ...input,
        }
      },
      async findOpenRuntimeInterval() {
        return null
      },
      async createRuntimeInterval() {
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
        return {
          artifacts: [],
          summary: 'Managed runtime is ready for bundle order-test-1. Open Control UI to continue.',
        }
      },
      async getRuntimeInstance() {
        return {
          ...baseRuntimeRecord,
          lastReconciledAt: new Date().toISOString(),
          persistenceMode: 'recoverable',
          planId: 'warm_standby',
          preservedStateAvailable: true,
          providerInstanceRef: 'sandbox-1',
          providerName: 'daytona',
          runId: baseRun.id,
          runtimeMode: 'wakeable_recoverable',
          startedAt: baseRun.startedAt,
          state: 'running',
          stoppedAt: null,
          stopReason: null,
          workspaceReleasedAt: null,
          metadataJson: {},
          archivedAt: null,
          deletedAt: null,
          recoverableUntilAt: null,
        }
      },
      async getStatus() {
        return {
          ...baseRun,
          resultSummary: 'Managed runtime is ready for bundle order-test-1. Open Control UI to continue.',
          runtimeState: 'running',
          status: 'running',
        }
      },
      async stopRun() {
        return null
      },
    }),
    getTelegramService: () => ({
      async sendPairedMessage(args: { orderId: string; text: string }) {
        delivered.push(args)
        return { chatId: '77', orderId: args.orderId }
      },
    } as never),
  })

  const run = await service.getRun('user-test-1', 'run-test-1')

  assert.equal(canOpenRunControlUi(run), true)
  assert.deepEqual(delivered, [
    {
      orderId: 'order-test-1',
      text: 'Your sandbox is ready. You can open Control UI now, or send a Telegram message here to start.',
    },
  ])

  setRunServiceDepsForTesting(null)
})
