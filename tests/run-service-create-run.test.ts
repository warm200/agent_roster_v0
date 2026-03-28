import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'

import type { Order, Run } from '@/lib/types'
import { getTelegramService } from '@/server/services/telegram.service'
import { RunService, setRunServiceDepsForTesting } from '@/server/services/run.service'
import { getSubscriptionPlan } from '@/lib/subscription-plans'

const order: Order = {
  amountCents: 2900,
  bundleRisk: {
    highestRiskDriver: 'Inbox Triage Agent',
    level: 'low',
    summary: 'Low risk test order.',
  },
  cartId: 'cart-test-1',
  channelConfig: {
    id: 'channel-test-1',
    orderId: 'order-test-1',
    channelType: 'telegram',
    botTokenSecretRef: 'secret-ref',
    tokenStatus: 'validated',
    recipientBindingStatus: 'paired',
    recipientExternalId: '77',
    appliesToScope: 'run',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  createdAt: new Date().toISOString(),
  currency: 'USD',
  id: 'order-test-1',
  items: [
    {
      id: 'order-item-1',
      orderId: 'order-test-1',
      priceCents: 2900,
      createdAt: new Date().toISOString(),
      agent: {
        id: 'agent-1',
        slug: 'inbox-triage',
        title: 'Inbox Triage Agent',
        category: 'inbox',
        summary: 'Triage email.',
        descriptionMarkdown: 'desc',
        priceCents: 2900,
        currency: 'USD',
        status: 'active',
        currentVersion: {
          id: 'ver-1',
          agentId: 'agent-1',
          version: '1.0.0',
          changelogMarkdown: '',
          previewPromptSnapshot: '',
          runConfigSnapshot: '',
          installPackageUrl: '/downloads/a.zip',
          installScriptMarkdown: '',
          releaseNotes: '',
          riskProfile: {
            id: 'risk-1',
            agentVersionId: 'ver-1',
            chatOnly: true,
            readFiles: false,
            writeFiles: false,
            network: true,
            shell: false,
            riskLevel: 'low',
            scanSummary: 'low',
            createdAt: new Date().toISOString(),
          },
          createdAt: new Date().toISOString(),
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      agentVersion: {
        id: 'ver-1',
        agentId: 'agent-1',
        version: '1.0.0',
        changelogMarkdown: '',
        previewPromptSnapshot: '',
        runConfigSnapshot: '',
        installPackageUrl: '/downloads/a.zip',
        installScriptMarkdown: '',
        releaseNotes: '',
        riskProfile: {
          id: 'risk-1',
          agentVersionId: 'ver-1',
          chatOnly: true,
          readFiles: false,
          writeFiles: false,
          network: true,
          shell: false,
          riskLevel: 'low',
          scanSummary: 'low',
          createdAt: new Date().toISOString(),
        },
        createdAt: new Date().toISOString(),
      },
    },
  ],
  paidAt: new Date().toISOString(),
  paymentProvider: 'stripe',
  paymentReference: 'pi_test_1',
  status: 'paid',
  updatedAt: new Date().toISOString(),
  userId: 'user-test-1',
}

function buildRun(): Run {
  const now = new Date().toISOString()

  return {
    id: 'run-test-1',
    userId: order.userId,
    orderId: order.id,
    channelConfigId: order.channelConfig!.id,
    status: 'running',
    combinedRiskLevel: 'low',
    usesRealWorkspace: true,
    usesTools: false,
    networkEnabled: true,
    resultSummary: null,
    resultArtifacts: [],
    createdAt: now,
    startedAt: now,
    updatedAt: now,
    completedAt: null,
  }
}

function buildFailedRun(): Run {
  const now = new Date().toISOString()

  return {
    ...buildRun(),
    completedAt: now,
    resultSummary: 'Run stopped by operator request.',
    status: 'failed',
    updatedAt: now,
  }
}

afterEach(() => {
  setRunServiceDepsForTesting(null)
})

test('run service refreshes telegram pairing state before launch checks', async () => {
  const calls: string[] = []
  const createdRun = buildRun()

  const service = new RunService({
    async createRun(run: Run) {
      return run
    },
    async updateRun(_runId: string, input: Partial<Run>) {
      return {
        ...createdRun,
        ...input,
      }
    },
  } as never)

  setRunServiceDepsForTesting({
    getOrderByIdForUser: async () => {
      calls.push('loadOrder')
      return order
    },
    getSubscriptionService: () =>
      ({
        commitReservedLaunchCredit: async () => {
          calls.push('subscription.commitReservedLaunchCredit')
        },
        getLaunchPolicy: async () => {
          calls.push('subscription.getLaunchPolicy')
          return {
            allowed: true,
            availableCredits: 24,
            blockers: [],
            effectivePlan: getSubscriptionPlan('warm_standby'),
            plan: getSubscriptionPlan('warm_standby'),
            runtimeGrant: null,
            subscription: null,
            usage: {
              activeBundles: 0,
              activeRunIds: [],
              concurrentRuns: 0,
            },
          }
        },
        refundReservedLaunchCredit: async () => {
          calls.push('subscription.refundReservedLaunchCredit')
        },
        reserveLaunchCredit: async () => {
          calls.push('subscription.reserveLaunchCredit')
          return null
        },
      } as never),
    getOrderProviderApiKeysForUser: async () => {
      calls.push('loadProviderKeys')
      return {}
    },
    getRunProvider: () => ({
      name: 'test',
      createRun: async (_order, runId) => {
        calls.push('provider.createRun')
        return {
          ...createdRun,
          id: runId ?? createdRun.id,
        }
      },
      getLogs: async () => [],
      getResult: async () => null,
      getStatus: async () => null,
      stopRun: async () => null,
    }),
    getTelegramService: () =>
      ({
        getChannelConfig: async () => {
          calls.push('telegram.getChannelConfig')
          return order.channelConfig!
        },
        releaseWebhookToRuntimePolling: async () => {
          calls.push('telegram.releaseWebhookToRuntimePolling')
          return { orderId: order.id }
        },
      } as unknown as ReturnType<typeof getTelegramService>),
  })

  const run = await service.createRun('user-test-1', 'order-test-1')
  await new Promise((resolve) => setTimeout(resolve, 0))

  assert.match(run.id, /^run-/)
  assert.equal(run.status, 'provisioning')
  assert.equal(run.orderId, 'order-test-1')
  assert.deepEqual(calls, [
    'telegram.getChannelConfig',
    'loadOrder',
    'subscription.getLaunchPolicy',
    'loadProviderKeys',
    'subscription.reserveLaunchCredit',
    'provider.createRun',
    'telegram.releaseWebhookToRuntimePolling',
    'subscription.commitReservedLaunchCredit',
  ])
})

test('run service reconciles existing runs before launch policy checks', async () => {
  const calls: string[] = []
  const createdRun = buildRun()

  const service = new RunService({
    async listRunsForUser() {
      calls.push('repository.listRunsForUser')
      return [
        {
          ...createdRun,
          id: 'run-existing-1',
          status: 'running',
        },
      ]
    },
    async createRun(run: Run) {
      return run
    },
    async updateRun(_runId: string, input: Partial<Run>) {
      return {
        ...createdRun,
        ...input,
      }
    },
  } as never)

  setRunServiceDepsForTesting({
    getOrderByIdForUser: async () => {
      calls.push('loadOrder')
      return order
    },
    getSubscriptionService: () =>
      ({
        commitReservedLaunchCredit: async () => {
          calls.push('subscription.commitReservedLaunchCredit')
        },
        getLaunchPolicy: async () => {
          calls.push('subscription.getLaunchPolicy')
          return {
            allowed: true,
            availableCredits: 24,
            blockers: [],
            effectivePlan: getSubscriptionPlan('warm_standby'),
            plan: getSubscriptionPlan('warm_standby'),
            runtimeGrant: null,
            subscription: null,
            usage: {
              activeBundles: 0,
              activeRunIds: [],
              concurrentRuns: 0,
            },
          }
        },
        refundReservedLaunchCredit: async () => {
          calls.push('subscription.refundReservedLaunchCredit')
        },
        reserveLaunchCredit: async () => {
          calls.push('subscription.reserveLaunchCredit')
          return null
        },
      } as never),
    getOrderProviderApiKeysForUser: async () => {
      calls.push('loadProviderKeys')
      return {}
    },
    getRunProvider: () => ({
      name: 'test',
      createRun: async (_order, runId) => {
        calls.push('provider.createRun')
        return {
          ...createdRun,
          id: runId ?? createdRun.id,
        }
      },
      getLogs: async () => [],
      getResult: async () => null,
      getRuntimeInstance: async (runId: string) => {
        calls.push(`provider.getRuntimeInstance:${runId}`)
        return null
      },
      getStatus: async (runId: string) => {
        calls.push(`provider.getStatus:${runId}`)
        return null
      },
      stopRun: async () => null,
    }),
    getTelegramService: () =>
      ({
        getChannelConfig: async () => {
          calls.push('telegram.getChannelConfig')
          return order.channelConfig!
        },
      } as unknown as ReturnType<typeof getTelegramService>),
  })

  await service.createRun('user-test-1', 'order-test-1')

  assert.deepEqual(calls.slice(0, 6), [
    'telegram.getChannelConfig',
    'loadOrder',
    'repository.listRunsForUser',
    'provider.getRuntimeInstance:run-existing-1',
    'provider.getStatus:run-existing-1',
    'subscription.getLaunchPolicy',
  ])
})

test('run service reserves launch credits against an admin runtime grant when free plan overlay is active', async () => {
  let receivedReserve:
    | {
        orderId: string
        plan: ReturnType<typeof getSubscriptionPlan>
        runId: string
        runtimeGrantId?: string | null
        subscriptionId: string | null
        userId: string
      }
    | undefined

  const service = new RunService({
    async createRun(run: Run) {
      return run
    },
    async updateRun(_runId: string, input: Partial<Run>) {
      return {
        ...buildRun(),
        ...input,
      }
    },
  } as never)

  setRunServiceDepsForTesting({
    getOrderByIdForUser: async () => order,
    getOrderProviderApiKeysForUser: async () => ({}),
    getRunProvider: () => ({
      name: 'test',
      createRun: async (_order, runId) => ({
        ...buildRun(),
        id: runId ?? 'run-fallback',
      }),
      getLogs: async () => [],
      getResult: async () => null,
      getStatus: async () => null,
      stopRun: async () => null,
    }),
    getSubscriptionService: () =>
      ({
        commitReservedLaunchCredit: async () => null,
        getLaunchPolicy: async () => ({
          allowed: true,
          availableCredits: 3,
          blockers: [],
          effectivePlan: getSubscriptionPlan('run'),
          plan: getSubscriptionPlan('free'),
          runtimeGrant: {
            id: 'grant-1',
            userId: order.userId,
            grantedByUserId: 'admin-1',
            creditsTotal: 3,
            creditsRemaining: 3,
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
            consumedAt: null,
            revokedAt: null,
            note: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          subscription: null,
          usage: {
            activeBundles: 0,
            activeRunIds: [],
            concurrentRuns: 0,
          },
        }),
        refundReservedLaunchCredit: async () => null,
        reserveLaunchCredit: async (input: {
          orderId: string
          plan: ReturnType<typeof getSubscriptionPlan>
          runId: string
          runtimeGrantId?: string | null
          subscriptionId: string | null
          userId: string
        }) => {
          receivedReserve = input
          return null
        },
      } as never),
    getTelegramService: () =>
      ({
        getChannelConfig: async () => order.channelConfig!,
        releaseWebhookToRuntimePolling: async () => ({ orderId: order.id }),
      } as never),
  })

  await service.createRun(order.userId, order.id)
  await new Promise((resolve) => setTimeout(resolve, 0))

  assert.equal(receivedReserve?.plan.id, 'run')
  assert.equal(receivedReserve?.subscriptionId, null)
  assert.equal(receivedReserve?.runtimeGrantId, 'grant-1')
})

test('run service blocks launch when subscription policy rejects the order', async () => {
  const calls: string[] = []
  const service = new RunService({
    async createRun() {
      throw new Error('should not create repo run')
    },
  } as never)

  setRunServiceDepsForTesting({
    getOrderByIdForUser: async () => {
      calls.push('loadOrder')
      return {
        ...order,
        items: [...order.items, { ...order.items[0], id: 'order-item-2' }, { ...order.items[0], id: 'order-item-3' }, { ...order.items[0], id: 'order-item-4' }],
      }
    },
    getSubscriptionService: () =>
      ({
        commitReservedLaunchCredit: async () => {
          calls.push('subscription.commitReservedLaunchCredit')
        },
        getLaunchPolicy: async () => {
          calls.push('subscription.getLaunchPolicy')
          return {
            allowed: false,
            availableCredits: 0,
            blockers: ['Run allows at most 3 agents per launched bundle.'],
            effectivePlan: getSubscriptionPlan('run'),
            plan: getSubscriptionPlan('run'),
            runtimeGrant: null,
            subscription: null,
            usage: {
              activeBundles: 0,
              activeRunIds: [],
              concurrentRuns: 0,
            },
          }
        },
        refundReservedLaunchCredit: async () => {
          calls.push('subscription.refundReservedLaunchCredit')
        },
        reserveLaunchCredit: async () => {
          calls.push('subscription.reserveLaunchCredit')
          return null
        },
      } as never),
    getOrderProviderApiKeysForUser: async () => {
      calls.push('loadProviderKeys')
      return {}
    },
    getRunProvider: () => ({
      name: 'test',
      createRun: async () => {
        calls.push('provider.createRun')
        return buildRun()
      },
      getLogs: async () => [],
      getResult: async () => null,
      getStatus: async () => null,
      stopRun: async () => null,
    }),
    getTelegramService: () =>
      ({
        getChannelConfig: async () => {
          calls.push('telegram.getChannelConfig')
          return order.channelConfig!
        },
      } as unknown as ReturnType<typeof getTelegramService>),
  })

  await assert.rejects(
    () => service.createRun('user-test-1', 'order-test-1'),
    /Run allows at most 3 agents per launched bundle\./,
  )
  assert.deepEqual(calls, [
    'telegram.getChannelConfig',
    'loadOrder',
    'subscription.getLaunchPolicy',
  ])
})

test('run service refunds reserved credit when provider never accepts the launch', async () => {
  const calls: string[] = []
  const service = new RunService({
    async createRun(run: Run) {
      calls.push('repository.createRun')
      return run
    },
    async updateRun(_runId: string, input: Partial<Run>) {
      calls.push('repository.updateRun')
      return {
        ...buildRun(),
        ...input,
      }
    },
    async updateRunUsage() {
      calls.push('repository.updateRunUsage')
      return null
    },
  } as never)

  setRunServiceDepsForTesting({
    getOrderByIdForUser: async () => order,
    getSubscriptionService: () =>
      ({
        commitReservedLaunchCredit: async () => {
          calls.push('subscription.commitReservedLaunchCredit')
          return null
        },
        getLaunchPolicy: async () => ({
          allowed: true,
          availableCredits: 15,
          blockers: [],
          effectivePlan: getSubscriptionPlan('run'),
          plan: getSubscriptionPlan('run'),
          runtimeGrant: null,
          subscription: {
            id: 'subscription-1',
            userId: order.userId,
            planId: 'run',
            planVersion: 'v1',
            status: 'active',
            billingInterval: 'one_time',
            includedCredits: 15,
            remainingCredits: 15,
            priceCents: 500,
            currency: 'USD',
            stripeCustomerId: null,
            stripePriceId: null,
            stripeSubscriptionId: null,
            stripeCheckoutSessionId: null,
            currentPeriodStart: null,
            currentPeriodEnd: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          usage: {
            activeBundles: 0,
            activeRunIds: [],
            concurrentRuns: 0,
          },
        }),
        refundReservedLaunchCredit: async () => {
          calls.push('subscription.refundReservedLaunchCredit')
          return null
        },
        reserveLaunchCredit: async () => {
          calls.push('subscription.reserveLaunchCredit')
          return null
        },
      } as never),
    getOrderProviderApiKeysForUser: async () => ({}),
    getRunProvider: () => ({
      name: 'test',
      createRun: async () => {
        calls.push('provider.createRun')
        throw new Error('provider handshake timed out')
      },
      getLogs: async () => [],
      getResult: async () => null,
      getStatus: async () => null,
      stopRun: async () => null,
    }),
    getTelegramService: () =>
      ({
        getChannelConfig: async () => order.channelConfig!,
        releaseWebhookToRuntimePolling: async () => {
          calls.push('telegram.releaseWebhookToRuntimePolling')
          return { orderId: order.id }
        },
      } as unknown as ReturnType<typeof getTelegramService>),
  })

  await service.createRun('user-test-1', 'order-test-1')
  await new Promise((resolve) => setTimeout(resolve, 0))

  assert.deepEqual(calls, [
    'subscription.reserveLaunchCredit',
    'repository.createRun',
    'provider.createRun',
    'subscription.refundReservedLaunchCredit',
    'repository.updateRun',
    'repository.updateRunUsage',
  ])
})

test('run service blocks managed restart when launch policy rejects it', async () => {
  const calls: string[] = []
  const failedRun = buildFailedRun()
  const service = new RunService({
    async findRunForUser() {
      return failedRun
    },
  } as never)

  setRunServiceDepsForTesting({
    getOrderByIdForUser: async () => {
      calls.push('loadOrder')
      return order
    },
    getSubscriptionService: () =>
      ({
        commitReservedLaunchCredit: async () => {
          calls.push('subscription.commitReservedLaunchCredit')
          return null
        },
        getLaunchPolicy: async () => {
          calls.push('subscription.getLaunchPolicy')
          return {
            allowed: false,
            availableCredits: 0,
            blockers: ['Run allows at most 3 agents per launched bundle.'],
            effectivePlan: getSubscriptionPlan('run'),
            plan: getSubscriptionPlan('run'),
            runtimeGrant: null,
            subscription: null,
            usage: {
              activeBundles: 1,
              activeRunIds: [failedRun.id],
              concurrentRuns: 1,
            },
          }
        },
        refundReservedLaunchCredit: async () => {
          calls.push('subscription.refundReservedLaunchCredit')
          return null
        },
        reserveLaunchCredit: async () => {
          calls.push('subscription.reserveLaunchCredit')
          return null
        },
      } as never),
    getOrderProviderApiKeysForUser: async () => {
      calls.push('loadProviderKeys')
      return {}
    },
    getRunProvider: () => ({
      name: 'test',
      createRun: async () => buildRun(),
      getLogs: async () => [],
      getResult: async () => null,
      getStatus: async () => null,
      restartRun: async () => {
        calls.push('provider.restartRun')
        return buildRun()
      },
      stopRun: async () => null,
    }),
    getTelegramService: () =>
      ({
        getChannelConfig: async () => order.channelConfig!,
      } as unknown as ReturnType<typeof getTelegramService>),
  })

  await assert.rejects(
    () => service.retryRun('user-test-1', failedRun.id),
    /Run allows at most 3 agents per launched bundle\./,
  )

  assert.deepEqual(calls, ['loadOrder', 'subscription.getLaunchPolicy'])
})

test('run service refunds reserved credit when managed restart throws', async () => {
  const calls: string[] = []
  const failedRun = buildFailedRun()
  const service = new RunService({
    async findRunForUser() {
      return failedRun
    },
    async updateRun() {
      calls.push('repository.updateRun')
      return failedRun
    },
    async updateRunUsage() {
      calls.push('repository.updateRunUsage')
      return null
    },
  } as never)

  setRunServiceDepsForTesting({
    getOrderByIdForUser: async () => {
      calls.push('loadOrder')
      return order
    },
    getSubscriptionService: () =>
      ({
        commitReservedLaunchCredit: async () => {
          calls.push('subscription.commitReservedLaunchCredit')
          return null
        },
        getLaunchPolicy: async () => {
          calls.push('subscription.getLaunchPolicy')
          return {
            allowed: true,
            availableCredits: 9,
            blockers: [],
            effectivePlan: getSubscriptionPlan('warm_standby'),
            plan: getSubscriptionPlan('warm_standby'),
            runtimeGrant: null,
            subscription: {
              id: 'subscription-1',
              userId: order.userId,
              planId: 'warm_standby',
              planVersion: 'v1',
              status: 'active',
              billingInterval: 'month',
              includedCredits: 10,
              remainingCredits: 9,
              priceCents: 1900,
              currency: 'USD',
              stripeCustomerId: null,
              stripePriceId: null,
              stripeSubscriptionId: null,
              stripeCheckoutSessionId: null,
              currentPeriodStart: null,
              currentPeriodEnd: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            usage: {
              activeBundles: 0,
              activeRunIds: [],
              concurrentRuns: 0,
            },
          }
        },
        refundReservedLaunchCredit: async () => {
          calls.push('subscription.refundReservedLaunchCredit')
          return null
        },
        reserveLaunchCredit: async () => {
          calls.push('subscription.reserveLaunchCredit')
          return null
        },
      } as never),
    getOrderProviderApiKeysForUser: async () => {
      calls.push('loadProviderKeys')
      return {}
    },
    getRunProvider: () => ({
      name: 'test',
      createRun: async () => buildRun(),
      getLogs: async () => [],
      getResult: async () => null,
      getStatus: async () => null,
      restartRun: async () => {
        calls.push('provider.restartRun')
        throw new Error('provider restart exploded')
      },
      stopRun: async () => null,
    }),
    getTelegramService: () =>
      ({
        getChannelConfig: async () => order.channelConfig!,
      } as unknown as ReturnType<typeof getTelegramService>),
  })

  await assert.rejects(
    () => service.retryRun('user-test-1', failedRun.id),
    /provider restart exploded/,
  )

  assert.deepEqual(calls, [
    'loadOrder',
    'subscription.getLaunchPolicy',
    'loadProviderKeys',
    'subscription.reserveLaunchCredit',
    'provider.restartRun',
    'subscription.refundReservedLaunchCredit',
    'repository.updateRun',
  ])
})

test('run service re-syncs stopped runtime state when managed resume throws', async () => {
  const calls: string[] = []
  const failedRun = buildFailedRun()
  const service = new RunService(
    {
      async findRunForUser() {
        return failedRun
      },
      async updateRun(_runId: string, input: Partial<Run>) {
        calls.push('repository.updateRun')
        return {
          ...failedRun,
          ...input,
        }
      },
      async updateRunUsage() {
        calls.push('repository.updateRunUsage')
        return null
      },
    } as never,
    {
      async findRuntimeInstanceByRunId() {
        return {
          id: 'runtime-1',
          runId: failedRun.id,
          userId: failedRun.userId,
          orderId: failedRun.orderId,
          providerName: 'test',
          providerInstanceRef: failedRun.id,
          planId: 'warm_standby',
          runtimeMode: 'wakeable_recoverable',
          persistenceMode: 'recoverable',
          state: 'stopped',
          stopReason: 'idle_timeout',
          preservedStateAvailable: true,
          startedAt: failedRun.startedAt,
          stoppedAt: failedRun.completedAt,
          archivedAt: null,
          deletedAt: null,
          recoverableUntilAt: null,
          workspaceReleasedAt: null,
          lastReconciledAt: failedRun.updatedAt,
          metadataJson: {},
          createdAt: failedRun.createdAt,
          updatedAt: failedRun.updatedAt,
        }
      },
      async updateRuntimeInstance(_runId: string, input: Record<string, unknown>) {
        calls.push('runtime.updateRuntimeInstance')
        return {
          id: 'runtime-1',
          runId: failedRun.id,
          userId: failedRun.userId,
          orderId: failedRun.orderId,
          providerName: 'test',
          providerInstanceRef: failedRun.id,
          planId: 'warm_standby',
          runtimeMode: 'wakeable_recoverable',
          persistenceMode: 'recoverable',
          state: 'stopped',
          stopReason: 'idle_timeout',
          preservedStateAvailable: true,
          startedAt: failedRun.startedAt,
          stoppedAt: failedRun.completedAt,
          archivedAt: null,
          deletedAt: null,
          recoverableUntilAt: null,
          workspaceReleasedAt: null,
          lastReconciledAt: failedRun.updatedAt,
          metadataJson: {},
          createdAt: failedRun.createdAt,
          updatedAt: failedRun.updatedAt,
          ...input,
        } as never
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
    getOrderByIdForUser: async () => {
      calls.push('loadOrder')
      return order
    },
    getSubscriptionService: () =>
      ({
        commitReservedLaunchCredit: async () => null,
        getLaunchPolicy: async () => {
          calls.push('subscription.getLaunchPolicy')
          return {
            allowed: true,
            availableCredits: 24,
            blockers: [],
            effectivePlan: getSubscriptionPlan('warm_standby'),
            plan: getSubscriptionPlan('warm_standby'),
            runtimeGrant: null,
            subscription: null,
            usage: {
              activeBundles: 0,
              activeRunIds: [],
              concurrentRuns: 0,
            },
          }
        },
        refundReservedLaunchCredit: async () => {
          calls.push('subscription.refundReservedLaunchCredit')
          return null
        },
        reserveLaunchCredit: async () => {
          calls.push('subscription.reserveLaunchCredit')
          return null
        },
      } as never),
    getOrderProviderApiKeysForUser: async () => {
      calls.push('loadProviderKeys')
      return {}
    },
    getRunProvider: () => ({
      name: 'test',
      createRun: async () => buildRun(),
      getLogs: async () => [],
      getResult: async () => null,
      getRuntimeInstance: async () => ({
        archivedAt: null,
        deletedAt: null,
        lastReconciledAt: new Date().toISOString(),
        metadataJson: {},
        persistenceMode: 'recoverable',
        planId: 'warm_standby',
        preservedStateAvailable: true,
        providerInstanceRef: failedRun.id,
        providerName: 'test',
        recoverableUntilAt: null,
        runId: failedRun.id,
        runtimeMode: 'wakeable_recoverable',
        startedAt: failedRun.startedAt,
        state: 'stopped',
        stoppedAt: failedRun.completedAt,
        stopReason: 'idle_timeout',
        workspaceReleasedAt: null,
      }),
      getStatus: async () => null,
      restartRun: async () => {
        calls.push('provider.restartRun')
        throw new Error('provider restart exploded')
      },
      stopRun: async () => null,
    }),
    getTelegramService: () =>
      ({
        getChannelConfig: async () => order.channelConfig!,
      } as unknown as ReturnType<typeof getTelegramService>),
  })

  await assert.rejects(
    () => service.retryRun('user-test-1', failedRun.id),
    /provider restart exploded/,
  )

  assert.equal(calls.includes('repository.updateRun'), true)
  assert.equal(calls.includes('telegram.releaseWebhookToRuntimePolling'), false)
})
