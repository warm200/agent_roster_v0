import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'

import { NextRequest } from 'next/server'

import { GET as resolveDownload } from '@/app/api/downloads/orders/[orderId]/items/[orderItemId]/route'
import {
  buildDownloadGrant,
  setOrderServiceForTesting,
  type OrderService,
} from '@/server/services/order.service'

const originalAuthSecret = process.env.AUTH_SECRET

const stubOrderService = {
  async createPaidOrderFromCart() {
    throw new Error('not implemented')
  },
  async getOrderByIdForUser() {
    throw new Error('not implemented')
  },
  async getSignedDownloadsForOrder() {
    throw new Error('not implemented')
  },
  async listOrdersForUser() {
    throw new Error('not implemented')
  },
  async resolveSignedDownload() {
    return '/downloads/agent-test.zip'
  },
} satisfies OrderService

beforeEach(() => {
  process.env.AUTH_SECRET = 'test-auth-secret'
})

afterEach(() => {
  if (originalAuthSecret === undefined) {
    delete process.env.AUTH_SECRET
  } else {
    process.env.AUTH_SECRET = originalAuthSecret
  }

  setOrderServiceForTesting(null)
})

test('download route validates grant and redirects to the install package', async () => {
  let received:
    | {
        orderId: string
        orderItemId: string
      }
    | undefined

  setOrderServiceForTesting({
    ...stubOrderService,
    async resolveSignedDownload(input) {
      received = input
      return '/downloads/agent-test.zip'
    },
  })

  const grant = buildDownloadGrant({
    baseUrl: 'http://localhost',
    expiresAt: new Date(Date.now() + 60_000),
    orderId: 'order-test-1',
    orderItemId: 'item-test-1',
  })

  const response = await resolveDownload(new NextRequest(grant.downloadUrl), {
    params: Promise.resolve({
      orderId: 'order-test-1',
      orderItemId: 'item-test-1',
    }),
  })

  assert.equal(response.status, 307)
  assert.equal(response.headers.get('location'), 'http://localhost/downloads/agent-test.zip')
  assert.deepEqual(received, {
    orderId: 'order-test-1',
    orderItemId: 'item-test-1',
  })
})

test('download route rejects missing signature params', async () => {
  setOrderServiceForTesting(stubOrderService)

  const response = await resolveDownload(
    new NextRequest('http://localhost/api/downloads/orders/order-test-1/items/item-test-1'),
    {
      params: Promise.resolve({
        orderId: 'order-test-1',
        orderItemId: 'item-test-1',
      }),
    },
  )
  const payload = await response.json()

  assert.equal(response.status, 400)
  assert.equal(payload.error, 'expiresAt and signature are required')
})

test('download route rejects invalid signatures', async () => {
  setOrderServiceForTesting(stubOrderService)

  const response = await resolveDownload(
    new NextRequest(
      'http://localhost/api/downloads/orders/order-test-1/items/item-test-1?expiresAt=2099-01-01T00:00:00.000Z&signature=bad',
    ),
    {
      params: Promise.resolve({
        orderId: 'order-test-1',
        orderItemId: 'item-test-1',
      }),
    },
  )
  const payload = await response.json()

  assert.equal(response.status, 403)
  assert.equal(payload.error, 'Invalid download signature.')
})
