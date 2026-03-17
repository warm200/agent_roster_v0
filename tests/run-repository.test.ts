import assert from 'node:assert/strict'
import test from 'node:test'

import type { Run, RunUsage } from '@/lib/types'
import { RunRepository, setRunRepositoryDbForTesting } from '@/server/services/run.repository'

const baseRun: Run = {
  id: 'run-test-1',
  userId: 'user-test-1',
  orderId: 'order-test-1',
  channelConfigId: 'channel-test-1',
  status: 'provisioning',
  runtimeState: 'provisioning',
  persistenceMode: null,
  preservedStateAvailable: false,
  recoverableUntilAt: null,
  combinedRiskLevel: 'low',
  usesRealWorkspace: true,
  usesTools: true,
  networkEnabled: true,
  resultSummary: null,
  resultArtifacts: [],
  createdAt: '2026-03-17T01:00:00.000Z',
  startedAt: null,
  updatedAt: '2026-03-17T01:00:00.000Z',
  completedAt: null,
}

const baseUsage: RunUsage = {
  id: 'usage-test-1',
  runId: 'run-test-1',
  userId: 'user-test-1',
  orderId: 'order-test-1',
  planId: 'warm_standby',
  planVersion: 'v1',
  triggerModeSnapshot: 'auto_wake',
  agentCount: 1,
  usesRealWorkspace: true,
  usesTools: true,
  networkEnabled: true,
  provisioningStartedAt: '2026-03-17T01:00:00.000Z',
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
    cleanupGraceMinutes: 10,
    heartbeatMissingMinutes: null,
    idleTimeoutMinutes: 45,
    maxSessionTtlMinutes: 360,
    provisioningTimeoutMinutes: 15,
    triggerMode: 'auto_wake',
    unhealthyProviderTimeoutMinutes: null,
  },
  createdAt: '2026-03-17T01:00:00.000Z',
  updatedAt: '2026-03-17T01:00:00.000Z',
}

function buildLegacyUsageRow() {
  return {
    id: baseUsage.id,
    runId: baseUsage.runId,
    userId: baseUsage.userId,
    orderId: baseUsage.orderId,
    planId: baseUsage.planId,
    planVersion: baseUsage.planVersion,
    triggerModeSnapshot: baseUsage.triggerModeSnapshot,
    agentCount: baseUsage.agentCount,
    usesRealWorkspace: baseUsage.usesRealWorkspace,
    usesTools: baseUsage.usesTools,
    networkEnabled: baseUsage.networkEnabled,
    provisioningStartedAt: new Date(baseUsage.provisioningStartedAt!),
    providerAcceptedAt: null,
    runningStartedAt: null,
    completedAt: null,
    workspaceReleasedAt: null,
    terminationReason: null,
    workspaceMinutes: null,
    toolCallsCount: null,
    inputTokensEst: null,
    outputTokensEst: null,
    estimatedInternalCostCents: null,
    statusSnapshot: baseUsage.statusSnapshot,
    ttlPolicySnapshot: baseUsage.ttlPolicySnapshot,
    createdAt: new Date(baseUsage.createdAt),
    updatedAt: new Date(baseUsage.updatedAt),
  }
}

function missingActivityColumnError() {
  const cause = Object.assign(new Error('column "last_meaningful_activity_at" does not exist'), {
    code: '42703',
  })
  return Object.assign(new Error('Failed query'), {
    cause,
    code: '42703',
  })
}

test.afterEach(() => {
  setRunRepositoryDbForTesting(null)
})

test('run repository falls back to legacy run_usage insert during provisioning create', async () => {
  let transactionCount = 0
  const fakeDb = {
    async transaction(callback: (tx: any) => Promise<unknown>) {
      transactionCount += 1
      let insertCall = 0
      const tx = {
        execute: async () => ({
          rows: [buildLegacyUsageRow()],
        }),
        insert() {
          insertCall += 1
          return {
            values() {
              return {
                async returning() {
                  if (insertCall === 2) {
                    if (transactionCount === 1) {
                      throw missingActivityColumnError()
                    }
                    return [buildLegacyUsageRow()]
                  }
                  return [
                    {
                      ...baseRun,
                      createdAt: new Date(baseRun.createdAt),
                      updatedAt: new Date(baseRun.updatedAt),
                    },
                  ]
                },
              }
            },
          }
        },
      }
      return callback(tx)
    },
  }

  setRunRepositoryDbForTesting(fakeDb as never)

  const created = await new RunRepository().createProvisioningRun(baseRun, baseUsage)

  assert.equal(created.run.id, baseRun.id)
  assert.equal(created.usage.runId, baseUsage.runId)
  assert.equal(created.usage.lastMeaningfulActivityAt, null)
  assert.equal(transactionCount, 2)
})

test('run repository falls back to legacy run_usage select when activity column is missing', async () => {
  const fakeDb = {
    execute: async () => ({
      rows: [buildLegacyUsageRow()],
    }),
    select() {
      return {
        from() {
          return {
            where() {
              return {
                async limit() {
                  throw missingActivityColumnError()
                },
              }
            },
          }
        },
      }
    },
  }

  setRunRepositoryDbForTesting(fakeDb as never)

  const usage = await new RunRepository().findRunUsage(baseUsage.runId)

  assert.equal(usage?.runId, baseUsage.runId)
  assert.equal(usage?.lastMeaningfulActivityAt, null)
})

test('run repository falls back to legacy run_usage update when activity column is missing', async () => {
  const fakeDb = {
    execute: async () => ({
      rows: [
        {
          ...buildLegacyUsageRow(),
          completedAt: new Date('2026-03-17T02:00:00.000Z'),
          statusSnapshot: 'failed',
          terminationReason: 'manual_stop',
          workspaceReleasedAt: new Date('2026-03-17T02:00:00.000Z'),
          updatedAt: new Date('2026-03-17T02:00:00.000Z'),
        },
      ],
    }),
    update() {
      return {
        set() {
          return {
            where() {
              return {
                async returning() {
                  throw missingActivityColumnError()
                },
              }
            },
          }
        },
      }
    },
  }

  setRunRepositoryDbForTesting(fakeDb as never)

  const usage = await new RunRepository().updateRunUsage(baseUsage.runId, {
    completedAt: '2026-03-17T02:00:00.000Z',
    statusSnapshot: 'failed',
    terminationReason: 'manual_stop',
    updatedAt: '2026-03-17T02:00:00.000Z',
    workspaceReleasedAt: '2026-03-17T02:00:00.000Z',
  })

  assert.equal(usage?.terminationReason, 'manual_stop')
  assert.equal(usage?.statusSnapshot, 'failed')
  assert.equal(usage?.lastMeaningfulActivityAt, null)
})
