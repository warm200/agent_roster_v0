import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'

import { NextRequest } from 'next/server'

import { GET as getOrder, PATCH as patchOrder } from '@/app/api/me/orders/[orderId]/route'
import { GET as getOrderDownloads } from '@/app/api/me/orders/[orderId]/download/route'
import { GET as listOrders } from '@/app/api/me/orders/route'
import { HttpError } from '@/server/lib/http'
import { setRequestUserIdForTesting } from '@/server/lib/request-user'
import {
  setOrderServiceForTesting,
  type OrderService,
} from '@/server/services/order.service'
import type { AgentSetup } from '@/lib/types'

const order = {
  amountCents: 2900,
  bundleRisk: {
    highestRiskDriver: null,
    level: 'low' as const,
    summary: 'Low risk fixture order.',
  },
  cartId: 'cart-test-1',
  channelConfig: null,
  agentSetup: null,
  createdAt: new Date().toISOString(),
  currency: 'USD',
  id: 'order-test-1',
  items: [],
  paidAt: new Date().toISOString(),
  paymentProvider: 'stripe',
  paymentReference: 'pi_test_1',
  status: 'paid' as const,
  updatedAt: new Date().toISOString(),
  userId: 'user-test-1',
}

afterEach(() => {
  setRequestUserIdForTesting(null)
  setOrderServiceForTesting(null)
})

test('orders list route returns service-backed orders', async () => {
  let receivedUserId = ''

  setRequestUserIdForTesting(() => 'user-test-1')
  setOrderServiceForTesting({
    async createPaidOrderFromCart() {
      return order
    },
    async getOrderByIdForUser() {
      return order
    },
    async getSignedDownloadsForOrder() {
      return { downloads: [], orderId: order.id }
    },
    async listOrdersForUser(userId: string) {
      receivedUserId = userId
      return [order]
    },
    async updateOrderAgentSetupForUser() {
      return order
    },
    async resolveSignedDownload() {
      return '/downloads/agent-test.zip'
    },
  } satisfies OrderService)

  const response = await listOrders(new NextRequest('http://localhost/api/me/orders'))
  const payload = await response.json()

  assert.equal(response.status, 200)
  assert.equal(receivedUserId, 'user-test-1')
  assert.equal(payload.total, 1)
  assert.equal(payload.orders[0].id, 'order-test-1')
})

test('order detail route returns 404 from service http errors', async () => {
  setRequestUserIdForTesting(() => 'user-test-1')
  setOrderServiceForTesting({
    async createPaidOrderFromCart() {
      return order
    },
    async getOrderByIdForUser() {
      throw new HttpError(404, 'Order not found.')
    },
    async getSignedDownloadsForOrder() {
      return { downloads: [], orderId: order.id }
    },
    async listOrdersForUser() {
      return [order]
    },
    async updateOrderAgentSetupForUser() {
      return order
    },
    async resolveSignedDownload() {
      return '/downloads/agent-test.zip'
    },
  } satisfies OrderService)

  const response = await getOrder(new NextRequest('http://localhost/api/me/orders/order-missing'), {
    params: Promise.resolve({ orderId: 'order-missing' }),
  })
  const payload = await response.json()

  assert.equal(response.status, 404)
  assert.equal(payload.error, 'Order not found.')
})

test('order detail patch route forwards agent setup updates', async () => {
  let received:
    | Parameters<NonNullable<OrderService['updateOrderAgentSetupForUser']>>[0]
    | undefined

  setRequestUserIdForTesting(() => 'user-test-1')
  setOrderServiceForTesting({
    async createPaidOrderFromCart() {
      return order
    },
    async getOrderByIdForUser() {
      return order
    },
    async getSignedDownloadsForOrder() {
      return { downloads: [], orderId: order.id }
    },
    async listOrdersForUser() {
      return [order]
    },
    async resolveSignedDownload() {
      return '/downloads/agent-test.zip'
    },
    async updateOrderAgentSetupForUser(input) {
      received = input
      return {
        ...order,
        agentSetup: {
          ...input.agentSetup,
          providerKeyStatus: {
            anthropic: Boolean(input.vendorApiKeys?.anthropic),
            google: Boolean(input.vendorApiKeys?.google),
            openai: Boolean(input.vendorApiKeys?.openai),
            openrouter: Boolean(input.vendorApiKeys?.openrouter),
          },
        },
      }
    },
  } satisfies OrderService)

  const response = await patchOrder(
    new NextRequest('http://localhost/api/me/orders/order-test-1', {
      body: JSON.stringify({
        agentSetup: {
          defaultAgentSlug: 'agent-test-default',
          workspace: '~/.openclaw/workspace',
          timeFormat: '24',
          modelPrimary: 'anthropic/claude-sonnet-4-5',
          modelFallbacks: ['openai/gpt-5-mini'],
          subagentsMaxConcurrent: 2,
        },
        vendorApiKeys: {
          anthropic: 'sk-ant-api03-test',
        },
      }),
      headers: {
        origin: 'http://localhost',
      },
      method: 'PATCH',
    }),
    {
      params: Promise.resolve({ orderId: 'order-test-1' }),
    },
  )
  const payload = await response.json()

  assert.equal(response.status, 200)
  assert.deepEqual(received, {
    orderId: 'order-test-1',
    userId: 'user-test-1',
    agentSetup: {
      defaultAgentSlug: 'agent-test-default',
      workspace: '~/.openclaw/workspace',
      timeFormat: '24',
      modelPrimary: 'anthropic/claude-sonnet-4-5',
      modelFallbacks: ['openai/gpt-5-mini'],
      subagentsMaxConcurrent: 2,
    },
    vendorApiKeys: {
      anthropic: 'sk-ant-api03-test',
    },
  })
  assert.equal(payload.agentSetup.modelPrimary, 'anthropic/claude-sonnet-4-5')
  assert.equal(payload.agentSetup.defaultAgentSlug, 'agent-test-default')
  assert.equal(payload.agentSetup.providerKeyStatus.anthropic, true)
})

test('order detail patch route rejects cross-site requests', async () => {
  setRequestUserIdForTesting(() => 'user-test-1')
  setOrderServiceForTesting({
    async createPaidOrderFromCart() {
      return order
    },
    async getOrderByIdForUser() {
      return order
    },
    async getSignedDownloadsForOrder() {
      return { downloads: [], orderId: order.id }
    },
    async listOrdersForUser() {
      return [order]
    },
    async updateOrderAgentSetupForUser() {
      throw new Error('should not be called')
    },
    async resolveSignedDownload() {
      return '/downloads/agent-test.zip'
    },
  } satisfies OrderService)

  const response = await patchOrder(
    new NextRequest('http://localhost/api/me/orders/order-test-1', {
      body: JSON.stringify({
        agentSetup: {
          defaultAgentSlug: 'agent-test-default',
        } satisfies Partial<AgentSetup>,
      }),
      headers: {
        origin: 'https://evil.example',
      },
      method: 'PATCH',
    }),
    {
      params: Promise.resolve({ orderId: 'order-test-1' }),
    },
  )
  const payload = await response.json()

  assert.equal(response.status, 403)
  assert.equal(payload.error, 'Cross-site request forbidden.')
})

test('order download route forwards baseUrl and userId', async () => {
  let received:
    | {
        baseUrl: string
        orderId: string
        userId: string
      }
    | undefined

  setRequestUserIdForTesting(() => 'user-test-1')
  setOrderServiceForTesting({
    async createPaidOrderFromCart() {
      return order
    },
    async getOrderByIdForUser() {
      return order
    },
    async getSignedDownloadsForOrder(input) {
      received = input
      return {
        downloads: [
          {
            agentId: 'agent-test-1',
            agentSlug: 'agent-test',
            agentTitle: 'Agent Test',
            downloadUrl: 'http://localhost/api/downloads/orders/order-test-1/items/item-test-1',
            expiresAt: new Date().toISOString(),
            orderItemId: 'item-test-1',
          },
        ],
        orderId: input.orderId,
      }
    },
    async listOrdersForUser() {
      return [order]
    },
    async updateOrderAgentSetupForUser() {
      return order
    },
    async resolveSignedDownload() {
      return '/downloads/agent-test.zip'
    },
  } satisfies OrderService)

  const response = await getOrderDownloads(
    new NextRequest('http://localhost/api/me/orders/order-test-1/download'),
    {
      params: Promise.resolve({ orderId: 'order-test-1' }),
    },
  )
  const payload = await response.json()

  assert.equal(response.status, 200)
  assert.deepEqual(received, {
    baseUrl: 'http://localhost',
    orderId: 'order-test-1',
    userId: 'user-test-1',
  })
  assert.equal(payload.downloads[0].orderItemId, 'item-test-1')
})
