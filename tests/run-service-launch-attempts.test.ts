import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'

import { getSubscriptionPlan } from '@/lib/subscription-plans'
import type { Order, Run } from '@/lib/types'
import { HttpError } from '@/server/lib/http'
import { launchAttempts } from '@/server/db/schema'
import { RunService, setRunServiceDepsForTesting } from '@/server/services/run.service'

type LaunchAttemptInsert = typeof launchAttempts.$inferInsert

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

function buildProviderRun(runId: string): Run {
  const now = new Date().toISOString()

  return {
    id: runId,
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

test('run service records a blocked launch attempt when launch policy rejects the order', async () => {
  const createdAttempts: Array<Record<string, unknown>> = []

  const service = new RunService(
    {
      async createRun() {
        throw new Error('should not create repo run')
      },
    } as never,
    {} as never,
    {
      async createLaunchAttempt(input: LaunchAttemptInsert) {
        createdAttempts.push(input)
        return input as never
      },
      async updateLaunchAttempt() {
        throw new Error('should not update launch attempt')
      },
    } as never,
  )

  setRunServiceDepsForTesting({
    getOrderByIdForUser: async () => order,
    getOrderProviderApiKeysForUser: async () => ({}),
    getRunProvider: () => ({
      name: 'test',
      createRun: async () => {
        throw new Error('should not call provider')
      },
      getLogs: async () => [],
      getResult: async () => null,
      getStatus: async () => null,
      stopRun: async () => null,
    }),
    getSubscriptionService: () =>
      ({
        getLaunchPolicy: async () => ({
          allowed: false,
          blockers: ['No credits remaining on the current subscription.'],
          plan: getSubscriptionPlan('run'),
          subscription: {
            id: 'sub-1',
            userId: order.userId,
            planId: 'run',
            planVersion: 'v1',
            status: 'active',
            billingInterval: 'month',
            includedCredits: 10,
            remainingCredits: 0,
            priceCents: 2900,
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
      } as never),
    getTelegramService: () =>
      ({
        getChannelConfig: async () => order.channelConfig!,
      } as never),
  })

  await assert.rejects(() => service.createRun(order.userId, order.id), HttpError)

  assert.equal(createdAttempts.length, 1)
  assert.equal(createdAttempts[0]?.result, 'blocked')
  assert.equal(createdAttempts[0]?.blockerReason, 'credits_exhausted')
})

test('run service upgrades a reserved launch attempt to provider_accepted on successful launch', async () => {
  const createdAttempts: Array<Record<string, unknown>> = []
  const updatedAttempts: Array<Record<string, unknown>> = []

  const service = new RunService(
    {
      async createRun(run: Run) {
        return run
      },
      async updateRun(_runId: string, input: Partial<Run>) {
        return { ...buildProviderRun('run-1'), ...input }
      },
      async updateRunUsage() {
        return null
      },
    } as never,
    {} as never,
    {
      async createLaunchAttempt(input: LaunchAttemptInsert) {
        createdAttempts.push(input)
        return input as never
      },
      async updateLaunchAttempt(_id: string, input: Partial<LaunchAttemptInsert>) {
        updatedAttempts.push(input as Record<string, unknown>)
        return input as never
      },
    } as never,
  )

  setRunServiceDepsForTesting({
    getOrderByIdForUser: async () => order,
    getOrderProviderApiKeysForUser: async () => ({}),
    getRunProvider: () => ({
      name: 'test',
      createRun: async (_order, runId) => buildProviderRun(runId ?? 'run-fallback'),
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
          blockers: [],
          plan: getSubscriptionPlan('warm_standby'),
          subscription: null,
          usage: {
            activeBundles: 0,
            activeRunIds: [],
            concurrentRuns: 0,
          },
        }),
        reserveLaunchCredit: async () => null,
      } as never),
    getTelegramService: () =>
      ({
        getChannelConfig: async () => order.channelConfig!,
      } as never),
  })

  await service.createRun(order.userId, order.id)
  await new Promise((resolve) => setTimeout(resolve, 0))

  assert.equal(createdAttempts.length, 1)
  assert.equal(createdAttempts[0]?.result, 'reserved')
  assert.equal(updatedAttempts.length, 1)
  assert.equal(updatedAttempts[0]?.result, 'provider_accepted')
})

test('run service marks a reserved launch attempt as failed_before_accept when provider launch fails', async () => {
  const createdAttempts: Array<Record<string, unknown>> = []
  const updatedAttempts: Array<Record<string, unknown>> = []

  const service = new RunService(
    {
      async createRun(run: Run) {
        return run
      },
      async updateRun(_runId: string, input: Partial<Run>) {
        return { ...buildProviderRun('run-1'), ...input }
      },
      async updateRunUsage() {
        return null
      },
    } as never,
    {} as never,
    {
      async createLaunchAttempt(input: LaunchAttemptInsert) {
        createdAttempts.push(input)
        return input as never
      },
      async updateLaunchAttempt(_id: string, input: Partial<LaunchAttemptInsert>) {
        updatedAttempts.push(input as Record<string, unknown>)
        return input as never
      },
    } as never,
  )

  setRunServiceDepsForTesting({
    getOrderByIdForUser: async () => order,
    getOrderProviderApiKeysForUser: async () => ({}),
    getRunProvider: () => ({
      name: 'test',
      createRun: async () => {
        throw new Error('provider rejected')
      },
      getLogs: async () => [],
      getResult: async () => null,
      getStatus: async () => null,
      stopRun: async () => null,
    }),
    getSubscriptionService: () =>
      ({
        getLaunchPolicy: async () => ({
          allowed: true,
          blockers: [],
          plan: getSubscriptionPlan('run'),
          subscription: null,
          usage: {
            activeBundles: 0,
            activeRunIds: [],
            concurrentRuns: 0,
          },
        }),
        refundReservedLaunchCredit: async () => null,
        reserveLaunchCredit: async () => null,
      } as never),
    getTelegramService: () =>
      ({
        getChannelConfig: async () => order.channelConfig!,
      } as never),
  })

  await service.createRun(order.userId, order.id)
  await new Promise((resolve) => setTimeout(resolve, 0))

  assert.equal(createdAttempts.length, 1)
  assert.equal(createdAttempts[0]?.result, 'reserved')
  assert.equal(updatedAttempts.length, 1)
  assert.equal(updatedAttempts[0]?.result, 'failed_before_accept')
  assert.equal(updatedAttempts[0]?.blockerReason, 'provider_not_accepted')
})
