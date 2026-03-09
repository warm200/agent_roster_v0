import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'

import { NextRequest } from 'next/server'

import { GET as getLegacyRunDetail, PATCH as patchLegacyRun } from '@/app/api/runs/[runId]/route'
import { GET as getLegacyRunLogs } from '@/app/api/runs/[runId]/logs/route'
import { GET as getLegacyRunResult } from '@/app/api/runs/[runId]/result/route'
import { GET as listLegacyRuns, POST as createLegacyRun } from '@/app/api/runs/route'
import type { AgentVersion, Order, Run, RunLog, RunResult } from '@/lib/types'
import { setOrderServiceForTesting, type OrderService } from '@/server/services/order.service'
import { setRequestUserIdForTesting } from '@/server/lib/request-user'
import { setRunServiceForTesting, type RunService } from '@/server/services/run.service'

const fixtureOrder: Order = {
  amountCents: 2900,
  bundleRisk: {
    highestRiskDriver: null,
    level: 'low',
    summary: 'Low risk legacy run fixture.',
  },
  cartId: 'cart-test-1',
  channelConfig: null,
  createdAt: new Date().toISOString(),
  currency: 'USD',
  id: 'order-test-1',
  items: [
    {
      agent: {
        category: 'automation',
        createdAt: new Date().toISOString(),
        currency: 'USD',
        currentVersion: {
          agentId: 'agent-test-1',
          changelogMarkdown: '',
          createdAt: new Date().toISOString(),
          id: 'version-test-1',
          installPackageUrl: 'https://example.com/install.zip',
          installScriptMarkdown: '',
          previewPromptSnapshot: 'preview',
          releaseNotes: '',
          riskProfile: {
            agentVersionId: 'version-test-1',
            chatOnly: false,
            createdAt: new Date().toISOString(),
            id: 'risk-test-1',
            network: true,
            readFiles: true,
            riskLevel: 'medium',
            scanSummary: 'Fixture medium risk',
            shell: false,
            writeFiles: false,
          },
          runConfigSnapshot: '{}',
          version: '1.0.0',
        },
        descriptionMarkdown: 'Fixture agent',
        id: 'agent-test-1',
        priceCents: 2900,
        slug: 'fixture-agent',
        status: 'active',
        summary: 'Fixture agent summary',
        title: 'Fixture Agent',
        updatedAt: new Date().toISOString(),
      },
      agentVersion: {
        agentId: 'agent-test-1',
        changelogMarkdown: '',
        createdAt: new Date().toISOString(),
        id: 'version-test-1',
        installPackageUrl: 'https://example.com/install.zip',
        installScriptMarkdown: '',
        previewPromptSnapshot: 'preview',
        releaseNotes: '',
        riskProfile: {
          agentVersionId: 'version-test-1',
          chatOnly: false,
          createdAt: new Date().toISOString(),
          id: 'risk-test-1',
          network: true,
          readFiles: true,
          riskLevel: 'medium',
          scanSummary: 'Fixture medium risk',
          shell: false,
          writeFiles: false,
        },
        runConfigSnapshot: '{}',
        version: '1.0.0',
      },
      createdAt: new Date().toISOString(),
      id: 'order-item-test-1',
      orderId: 'order-test-1',
      priceCents: 2900,
    },
  ],
  paidAt: new Date().toISOString(),
  paymentProvider: 'stripe',
  paymentReference: 'pi_test_1',
  status: 'paid',
  updatedAt: new Date().toISOString(),
  userId: 'user-test-1',
}

const fixtureRun: Run = {
  channelConfigId: 'channel-test-1',
  combinedRiskLevel: 'medium',
  completedAt: null,
  createdAt: new Date().toISOString(),
  id: 'run-test-1',
  networkEnabled: true,
  orderId: 'order-test-1',
  resultArtifacts: [],
  resultSummary: null,
  startedAt: new Date().toISOString(),
  status: 'running',
  updatedAt: new Date().toISOString(),
  userId: 'user-test-1',
  usesRealWorkspace: true,
  usesTools: true,
}

const fixtureLogs: RunLog[] = [
  {
    level: 'info',
    message: 'Legacy route booted workspace.',
    step: 'init',
    timestamp: new Date().toISOString(),
  },
]

const fixtureResult: RunResult = {
  artifacts: [
    {
      downloadUrl: 'https://example.com/legacy-report.txt',
      id: 'artifact-test-1',
      name: 'legacy-report.txt',
      size: 1024,
      type: 'text/plain',
    },
  ],
  summary: 'Legacy run completed with one report artifact.',
}

afterEach(() => {
  setRequestUserIdForTesting(null)
  setRunServiceForTesting(null)
  setOrderServiceForTesting(null)
})

function installServiceStubs() {
  setRequestUserIdForTesting(() => 'user-test-1')
  setOrderServiceForTesting({
    async createPaidOrderFromCart() {
      return fixtureOrder
    },
    async getOrderByIdForUser() {
      return fixtureOrder
    },
    async getSignedDownloadsForOrder() {
      return { downloads: [], orderId: fixtureOrder.id }
    },
    async listOrdersForUser() {
      return [fixtureOrder]
    },
  } satisfies OrderService)
}

function buildRunService(overrides: Partial<RunService> = {}) {
  return {
    async createRun() {
      return fixtureRun
    },
    async getRun() {
      return fixtureRun
    },
    async getRunLogs() {
      return fixtureLogs
    },
    async getRunResult() {
      return fixtureResult
    },
    async listRuns() {
      return [fixtureRun]
    },
    async retryRun() {
      return { ...fixtureRun, id: 'run-test-retry', status: 'provisioning' as const }
    },
    scanAgentVersion(version: AgentVersion) {
      return version.riskProfile
    },
    async stopRun() {
      return { ...fixtureRun, status: 'failed' as const, resultSummary: 'Cancelled' }
    },
    ...overrides,
  } as unknown as RunService
}

test('legacy runs list and create routes use run service', async () => {
  installServiceStubs()

  let created:
    | {
        orderId: string
        userId: string
      }
    | undefined

  setRunServiceForTesting(buildRunService({
    async createRun(userId: string, orderId: string) {
      created = { orderId, userId }
      return fixtureRun
    },
    async listRuns() {
      return [fixtureRun, { ...fixtureRun, id: 'run-test-2', status: 'completed' as const }]
    },
  }))

  const listResponse = await listLegacyRuns(
    new NextRequest('http://localhost/api/runs?status=running&orderId=order-test-1'),
  )
  const listPayload = await listResponse.json()

  assert.equal(listResponse.status, 200)
  assert.equal(listPayload.total, 1)
  assert.equal(listPayload.runs[0].id, 'run-test-1')

  const createResponse = await createLegacyRun(
    new NextRequest('http://localhost/api/runs', {
      body: JSON.stringify({ orderId: 'order-test-1' }),
      method: 'POST',
    }),
  )
  const createPayload = await createResponse.json()

  assert.equal(createResponse.status, 201)
  assert.deepEqual(created, {
    orderId: 'order-test-1',
    userId: 'user-test-1',
  })
  assert.equal(createPayload.logsCount, 1)
})

test('legacy run detail/logs/result routes use shared service getters', async () => {
  installServiceStubs()
  setRunServiceForTesting(buildRunService())

  const detailResponse = await getLegacyRunDetail(
    new NextRequest('http://localhost/api/runs/run-test-1'),
    { params: Promise.resolve({ runId: 'run-test-1' }) },
  )
  const detailPayload = await detailResponse.json()

  assert.equal(detailResponse.status, 200)
  assert.equal(detailPayload.order.id, 'order-test-1')
  assert.equal(detailPayload.agents[0].title, 'Fixture Agent')

  const logsResponse = await getLegacyRunLogs(
    new NextRequest('http://localhost/api/runs/run-test-1/logs'),
    { params: Promise.resolve({ runId: 'run-test-1' }) },
  )
  const logsPayload = await logsResponse.json()

  assert.equal(logsResponse.status, 200)
  assert.equal(logsPayload.logs[0].message, 'Legacy route booted workspace.')

  const resultResponse = await getLegacyRunResult(
    new NextRequest('http://localhost/api/runs/run-test-1/result'),
    { params: Promise.resolve({ runId: 'run-test-1' }) },
  )
  const resultPayload = await resultResponse.json()

  assert.equal(resultResponse.status, 200)
  assert.equal(resultPayload.summary, fixtureResult.summary)
})

test('legacy run patch route supports cancel and retry actions', async () => {
  installServiceStubs()

  let cancelled = false
  let retried = false

  setRunServiceForTesting(buildRunService({
    async retryRun() {
      retried = true
      return { ...fixtureRun, id: 'run-test-retry', status: 'provisioning' as const }
    },
    async stopRun() {
      cancelled = true
      return { ...fixtureRun, status: 'failed' as const, resultSummary: 'Cancelled' }
    },
  }))

  const cancelResponse = await patchLegacyRun(
    new NextRequest('http://localhost/api/runs/run-test-1', {
      body: JSON.stringify({ action: 'cancel' }),
      method: 'PATCH',
    }),
    { params: Promise.resolve({ runId: 'run-test-1' }) },
  )
  const cancelPayload = await cancelResponse.json()

  assert.equal(cancelResponse.status, 200)
  assert.equal(cancelled, true)
  assert.equal(cancelPayload.status, 'failed')

  const retryResponse = await patchLegacyRun(
    new NextRequest('http://localhost/api/runs/run-test-1', {
      body: JSON.stringify({ action: 'retry' }),
      method: 'PATCH',
    }),
    { params: Promise.resolve({ runId: 'run-test-1' }) },
  )
  const retryPayload = await retryResponse.json()

  assert.equal(retryResponse.status, 200)
  assert.equal(retried, true)
  assert.equal(retryPayload.id, 'run-test-retry')
})
