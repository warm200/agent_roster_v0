import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'

import { NextRequest } from 'next/server'

import { GET as getRunDetail, PATCH as patchRun } from '@/app/api/me/runs/[runId]/route'
import { GET as getRunLogs } from '@/app/api/me/runs/[runId]/logs/route'
import { GET as getRunResult } from '@/app/api/me/runs/[runId]/result/route'
import { GET as listRuns } from '@/app/api/me/runs/route'
import type { AgentVersion, Order, Run, RunLog, RunResult } from '@/lib/types'
import { setOrderServiceForTesting, type OrderService } from '@/server/services/order.service'
import { setRequestUserIdForTesting } from '@/server/lib/request-user'
import { setRunServiceForTesting, type RunService } from '@/server/services/run.service'

const fixtureOrder: Order = {
  amountCents: 2900,
  bundleRisk: {
    highestRiskDriver: null,
    level: 'low',
    summary: 'Low risk fixture order.',
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
    message: 'Booting managed workspace.',
    step: 'init',
    timestamp: new Date().toISOString(),
  },
]

const fixtureResult: RunResult = {
  artifacts: [
    {
      downloadUrl: 'https://example.com/report.txt',
      id: 'artifact-test-1',
      name: 'report.txt',
      size: 1024,
      type: 'text/plain',
    },
  ],
  summary: 'Run completed with one report artifact.',
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
    async resolveSignedDownload() {
      return '/downloads/agent-test.zip'
    },
  } satisfies OrderService)
}

test('runs list route returns filtered summaries', async () => {
  installServiceStubs()

  setRunServiceForTesting({
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
      return [fixtureRun, { ...fixtureRun, id: 'run-test-2', orderId: 'order-test-2', status: 'completed' }]
    },
    async retryRun() {
      return fixtureRun
    },
    scanAgentVersion(version: AgentVersion) {
      return version.riskProfile
    },
    async stopRun() {
      return { ...fixtureRun, status: 'failed' as const }
    },
    async createRun() {
      return fixtureRun
    },
  } as unknown as RunService)

  const response = await listRuns(
    new NextRequest('http://localhost/api/me/runs?status=running&orderId=order-test-1&limit=1'),
  )
  const payload = await response.json()

  assert.equal(response.status, 200)
  assert.equal(payload.total, 1)
  assert.equal(payload.hasMore, false)
  assert.equal(payload.runs[0].id, 'run-test-1')
  assert.equal(payload.runs[0].logsCount, 1)
})

test('run detail route returns enriched detail and supports retry/cancel', async () => {
  installServiceStubs()

  let cancelled = false
  let retried = false

  setRunServiceForTesting({
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
      retried = true
      return { ...fixtureRun, id: 'run-test-retry', status: 'provisioning' }
    },
    scanAgentVersion(version: AgentVersion) {
      return version.riskProfile
    },
    async stopRun() {
      cancelled = true
      return { ...fixtureRun, status: 'failed' as const, resultSummary: 'Cancelled' }
    },
    async createRun() {
      return fixtureRun
    },
  } as unknown as RunService)

  const detailResponse = await getRunDetail(
    new NextRequest('http://localhost/api/me/runs/run-test-1'),
    { params: Promise.resolve({ runId: 'run-test-1' }) },
  )
  const detailPayload = await detailResponse.json()

  assert.equal(detailResponse.status, 200)
  assert.equal(detailPayload.order.id, 'order-test-1')
  assert.equal(detailPayload.logsCount, 1)
  assert.equal(detailPayload.agents[0].title, 'Fixture Agent')

  const cancelResponse = await patchRun(
    new NextRequest('http://localhost/api/me/runs/run-test-1', {
      body: JSON.stringify({ action: 'cancel' }),
      method: 'PATCH',
    }),
    { params: Promise.resolve({ runId: 'run-test-1' }) },
  )
  const cancelPayload = await cancelResponse.json()

  assert.equal(cancelResponse.status, 200)
  assert.equal(cancelled, true)
  assert.equal(cancelPayload.status, 'failed')

  const retryResponse = await patchRun(
    new NextRequest('http://localhost/api/me/runs/run-test-1', {
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

test('run logs and result routes return service-backed payloads', async () => {
  installServiceStubs()

  setRunServiceForTesting({
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
      return fixtureRun
    },
    scanAgentVersion(version: AgentVersion) {
      return version.riskProfile
    },
    async stopRun() {
      return fixtureRun
    },
    async createRun() {
      return fixtureRun
    },
  } as unknown as RunService)

  const logsResponse = await getRunLogs(
    new NextRequest('http://localhost/api/me/runs/run-test-1/logs'),
    { params: Promise.resolve({ runId: 'run-test-1' }) },
  )
  const logsPayload = await logsResponse.json()

  assert.equal(logsResponse.status, 200)
  assert.equal(logsPayload.logs[0].message, 'Booting managed workspace.')

  const resultResponse = await getRunResult(
    new NextRequest('http://localhost/api/me/runs/run-test-1/result'),
    { params: Promise.resolve({ runId: 'run-test-1' }) },
  )
  const resultPayload = await resultResponse.json()

  assert.equal(resultResponse.status, 200)
  assert.equal(resultPayload.summary, fixtureResult.summary)
  assert.equal(resultPayload.artifacts[0].name, 'report.txt')
})
