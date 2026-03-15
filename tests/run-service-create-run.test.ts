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
        getLaunchPolicy: async () => {
          calls.push('subscription.getLaunchPolicy')
          return {
            allowed: true,
            blockers: [],
            plan: getSubscriptionPlan('warm_standby'),
            subscription: null,
            usage: {
              activeBundles: 0,
              activeRunIds: [],
              concurrentRuns: 0,
            },
          }
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
    'provider.createRun',
  ])
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
        getLaunchPolicy: async () => {
          calls.push('subscription.getLaunchPolicy')
          return {
            allowed: false,
            blockers: ['Run allows at most 3 agents per launched bundle.'],
            plan: getSubscriptionPlan('run'),
            subscription: null,
            usage: {
              activeBundles: 0,
              activeRunIds: [],
              concurrentRuns: 0,
            },
          }
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
