import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'

import { NextRequest } from 'next/server'

import { GET as getBundle } from '@/app/api/bundles/[orderId]/route'
import { DELETE as disconnectBundleChannel, GET as getBundleChannel } from '@/app/api/bundles/[orderId]/channel/route'
import { POST as startBundlePairing } from '@/app/api/bundles/[orderId]/channel/telegram/pairing/start/route'
import { POST as validateBundleToken } from '@/app/api/bundles/[orderId]/channel/telegram/validate/route'
import { GET as listBundles } from '@/app/api/bundles/route'
import { POST as legacyVerify } from '@/app/api/telegram/verify/route'
import type { Order } from '@/lib/types'
import { setOrderServiceForTesting, type OrderService } from '@/server/services/order.service'
import { setRequestUserIdForTesting } from '@/server/lib/request-user'
import {
  setTelegramServiceForTesting,
  type TelegramBotProfile,
  type TelegramPairingResult,
  type TelegramUpdate,
  type TelegramWebhookResult,
} from '@/server/services/telegram.service'

const order: Order = {
  amountCents: 2900,
  bundleRisk: {
    highestRiskDriver: null,
    level: 'low',
    summary: 'Low risk legacy bundle fixture.',
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

const channelConfig = {
  id: 'channel-test-1',
  orderId: 'order-test-1',
  channelType: 'telegram' as const,
  botTokenSecretRef: 'secret-ref',
  tokenStatus: 'validated' as const,
  recipientBindingStatus: 'pending' as const,
  recipientExternalId: null,
  appliesToScope: 'run' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
}

afterEach(() => {
  setRequestUserIdForTesting(null)
  setOrderServiceForTesting(null)
  setTelegramServiceForTesting(null)
})

test('legacy bundles list/detail routes use order service', async () => {
  let listedUserId = ''
  let detailInput:
    | {
        orderId: string
        userId: string
      }
    | undefined

  setRequestUserIdForTesting(() => 'user-test-1')
  setOrderServiceForTesting({
    async createPaidOrderFromCart() {
      return order
    },
    async getOrderByIdForUser(input) {
      detailInput = input
      return order
    },
    async getSignedDownloadsForOrder() {
      return { downloads: [], orderId: order.id }
    },
    async listOrdersForUser(userId: string) {
      listedUserId = userId
      return [order]
    },
    async resolveSignedDownload() {
      return '/downloads/agent-test.zip'
    },
  } satisfies OrderService)

  const listResponse = await listBundles(new NextRequest('http://localhost/api/bundles'))
  const listPayload = await listResponse.json()

  assert.equal(listResponse.status, 200)
  assert.equal(listedUserId, 'user-test-1')
  assert.equal(listPayload.bundles[0].id, 'order-test-1')

  const detailResponse = await getBundle(
    new NextRequest('http://localhost/api/bundles/order-test-1'),
    { params: Promise.resolve({ orderId: 'order-test-1' }) },
  )
  const detailPayload = await detailResponse.json()

  assert.equal(detailResponse.status, 200)
  assert.deepEqual(detailInput, {
    orderId: 'order-test-1',
    userId: 'user-test-1',
  })
  assert.equal(detailPayload.id, 'order-test-1')
})

test('legacy bundle channel routes use telegram service', async () => {
  let channelInput:
    | {
        orderId: string
        userId: string
      }
    | undefined
  let disconnectInput:
    | {
        orderId: string
        userId: string
      }
    | undefined
  let pairingInput:
    | {
        orderId: string
        origin: string
        userId: string
      }
    | undefined
  let validateInput:
    | {
        botToken: string
        orderId: string
        userId: string
      }
    | undefined

  setRequestUserIdForTesting(() => 'user-test-1')
  setTelegramServiceForTesting({
    async disconnectChannel(input: {
      orderId: string
      userId: string
    }) {
      disconnectInput = input
      return channelConfig
    },
    async getChannelConfig(input: {
      orderId: string
      userId: string
    }) {
      channelInput = input
      return channelConfig
    },
    async handleWebhook(_input: {
      orderId: string
      secretToken: string | null
      update: TelegramUpdate
    }): Promise<TelegramWebhookResult> {
      return { outcome: 'ignored', reason: 'unused' }
    },
    async startPairing(input: {
      orderId: string
      origin: string
      userId: string
    }): Promise<TelegramPairingResult> {
      pairingInput = input
      return {
        botUsername: 'legacy_bot',
        pairingCommand: 'https://t.me/legacy_bot',
        config: channelConfig,
      }
    },
    async validateToken(input: {
      botToken: string
      orderId: string
      userId: string
    }): Promise<{ bot: TelegramBotProfile; config: typeof channelConfig }> {
      validateInput = input
      return {
        bot: {
          firstName: 'Legacy Bot',
          id: 77,
          username: 'legacy_bot',
        },
        config: channelConfig,
      }
    },
  } as never)

  const channelResponse = await getBundleChannel(
    new NextRequest('http://localhost/api/bundles/order-test-1/channel'),
    { params: Promise.resolve({ orderId: 'order-test-1' }) },
  )
  const channelPayload = await channelResponse.json()

  assert.equal(channelResponse.status, 200)
  assert.deepEqual(channelInput, {
    orderId: 'order-test-1',
    userId: 'user-test-1',
  })
  assert.equal(channelPayload.botUsername, 'YourAgentBot')

  const disconnectResponse = await disconnectBundleChannel(
    new NextRequest('http://localhost/api/bundles/order-test-1/channel', {
      method: 'DELETE',
    }),
    { params: Promise.resolve({ orderId: 'order-test-1' }) },
  )
  const disconnectPayload = await disconnectResponse.json()

  assert.equal(disconnectResponse.status, 200)
  assert.deepEqual(disconnectInput, {
    orderId: 'order-test-1',
    userId: 'user-test-1',
  })
  assert.equal(disconnectPayload.channelConfig.id, 'channel-test-1')

  const pairingResponse = await startBundlePairing(
    new NextRequest('http://localhost/api/bundles/order-test-1/channel/telegram/pairing/start', {
      method: 'POST',
    }),
    { params: Promise.resolve({ orderId: 'order-test-1' }) },
  )
  const pairingPayload = await pairingResponse.json()

  assert.equal(pairingResponse.status, 200)
  assert.deepEqual(pairingInput, {
    orderId: 'order-test-1',
    origin: 'http://localhost',
    userId: 'user-test-1',
  })
  assert.equal(pairingPayload.botUsername, 'legacy_bot')

  const validateResponse = await validateBundleToken(
    new NextRequest('http://localhost/api/bundles/order-test-1/channel/telegram/validate', {
      body: JSON.stringify({ botToken: '123:abc' }),
      method: 'POST',
    }),
    { params: Promise.resolve({ orderId: 'order-test-1' }) },
  )
  const validatePayload = await validateResponse.json()

  assert.equal(validateResponse.status, 200)
  assert.deepEqual(validateInput, {
    botToken: '123:abc',
    orderId: 'order-test-1',
    userId: 'user-test-1',
  })
  assert.equal(validatePayload.botUsername, 'legacy_bot')
})

test('legacy telegram verify compatibility route maps old payload keys', async () => {
  let received:
    | {
        botToken: string
        orderId: string
        userId: string
      }
    | undefined

  setRequestUserIdForTesting(() => 'user-test-1')
  setTelegramServiceForTesting({
    async getChannelConfig(input: {
      orderId: string
      userId: string
    }) {
      return channelConfig
    },
    async handleWebhook(_input: {
      orderId: string
      secretToken: string | null
      update: TelegramUpdate
    }): Promise<TelegramWebhookResult> {
      return { outcome: 'ignored', reason: 'unused' }
    },
    async startPairing(input: {
      orderId: string
      origin: string
      userId: string
    }): Promise<TelegramPairingResult> {
      return {
        botUsername: 'legacy_bot',
        pairingCommand: 'https://t.me/legacy_bot',
        config: channelConfig,
      }
    },
    async validateToken(input: {
      botToken: string
      orderId: string
      userId: string
    }): Promise<{ bot: TelegramBotProfile; config: typeof channelConfig }> {
      received = input
      return {
        bot: {
          firstName: 'Legacy Bot',
          id: 88,
          username: 'legacy_bot',
        },
        config: channelConfig,
      }
    },
  } as never)

  const response = await legacyVerify(
    new NextRequest('http://localhost/api/telegram/verify', {
      body: JSON.stringify({
        bundleId: 'order-test-1',
        code: 'legacy-code',
      }),
      method: 'POST',
    }),
  )
  const payload = await response.json()

  assert.equal(response.status, 200)
  assert.deepEqual(received, {
    botToken: 'legacy-code',
    orderId: 'order-test-1',
    userId: 'user-test-1',
  })
  assert.equal(payload.deprecated, true)
  assert.equal(payload.botUsername, 'legacy_bot')
})
