import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { Order } from '@/lib/types'
import { OpenAIRunProvider } from '@/server/providers/openai.provider'

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
            network: false,
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
          network: false,
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

test('openai run provider supports create, poll, result, and cancel flow', async () => {
  const calls: Array<{ method: string; url: string }> = []
  let currentStatus = 'in_progress'

  const provider = new OpenAIRunProvider({
    apiKey: 'sk-test',
    fetchImpl: async (input, init) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      calls.push({ method, url })

      if (url.endsWith('/responses') && method === 'POST') {
        return new Response(
          JSON.stringify({
            id: 'resp_123',
            status: 'queued',
          }),
          { status: 200 },
        )
      }

      if (url.endsWith('/responses/resp_123') && method === 'GET') {
        return new Response(
          JSON.stringify({
            id: 'resp_123',
            output_text:
              currentStatus === 'completed'
                ? 'Finished triaging inbox and prepared follow-up summary.'
                : undefined,
            status: currentStatus,
          }),
          { status: 200 },
        )
      }

      if (url.endsWith('/responses/resp_123/cancel') && method === 'POST') {
        currentStatus = 'cancelled'
        return new Response(
          JSON.stringify({
            id: 'resp_123',
            status: 'cancelled',
          }),
          { status: 200 },
        )
      }

      throw new Error(`Unexpected request: ${method} ${url}`)
    },
    model: 'gpt-5',
  })

  const created = await provider.createRun(order)
  assert.equal(created.status, 'provisioning')

  currentStatus = 'completed'

  const status = await provider.getStatus(created.id)
  assert.ok(status)
  assert.equal(status.status, 'completed')
  assert.match(status.resultSummary ?? '', /Finished triaging inbox/)

  const logs = await provider.getLogs(created.id)
  assert.ok(logs.length >= 2)

  const result = await provider.getResult(created.id)
  assert.ok(result)
  assert.match(result.summary, /Finished triaging inbox/)
  assert.equal(result.artifacts[0]?.type, 'text/plain')

  const cancelled = await provider.stopRun(created.id)
  assert.ok(cancelled)
  assert.equal(cancelled.status, 'failed')

  assert.deepEqual(
    calls.map((call) => `${call.method} ${call.url.replace('https://api.openai.com/v1', '')}`),
    [
      'POST /responses',
      'GET /responses/resp_123',
      'GET /responses/resp_123',
      'GET /responses/resp_123',
      'POST /responses/resp_123/cancel',
    ],
  )
})
