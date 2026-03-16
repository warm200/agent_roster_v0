import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'

import { NextRequest } from 'next/server'

import { DELETE as disconnectChannel } from '@/app/api/me/orders/[orderId]/run-channel/route'
import { POST as startPairing } from '@/app/api/me/orders/[orderId]/run-channel/telegram/pairing/start/route'
import { POST as validateToken } from '@/app/api/me/orders/[orderId]/run-channel/telegram/validate/route'
import { POST as telegramWebhook } from '@/app/api/webhooks/telegram/route'
import { HttpError } from '@/server/lib/http'
import { setRequestUserIdForTesting } from '@/server/lib/request-user'
import { RunService, setRunServiceForTesting } from '@/server/services/run.service'
import {
  setTelegramServiceForTesting,
  type TelegramBotProfile,
  type TelegramPairingResult,
  type TelegramUpdate,
  type TelegramWebhookResult,
} from '@/server/services/telegram.service'

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
  setRunServiceForTesting(null)
  setTelegramServiceForTesting(null)
})

test('telegram validate route forwards bot token to service', async () => {
  let received:
    | { botToken: string; orderId: string; userId: string }
    | undefined

  setRequestUserIdForTesting(() => 'user-test-1')
  setTelegramServiceForTesting({
    async validateToken(input: {
      botToken: string
      orderId: string
      userId: string
    }): Promise<{ bot: TelegramBotProfile; config: typeof channelConfig }> {
      received = input

      return {
        bot: {
          firstName: 'Ops Bot',
          id: 42,
          username: 'ops_bot',
        },
        config: channelConfig,
      }
    },
  } as never)

  const request = new NextRequest('http://localhost/api/me/orders/order-test-1/run-channel/telegram/validate', {
    body: JSON.stringify({ botToken: '123:abc' }),
    method: 'POST',
  })

  const response = await validateToken(request, {
    params: Promise.resolve({ orderId: 'order-test-1' }),
  })
  const payload = await response.json()

  assert.equal(response.status, 200)
  assert.deepEqual(received, {
    botToken: '123:abc',
    orderId: 'order-test-1',
    userId: 'user-test-1',
  })
  assert.equal(payload.bot.username, 'ops_bot')
  assert.equal(payload.channelConfig.orderId, 'order-test-1')
})

test('telegram channel disconnect route forwards order and user to service', async () => {
  let received:
    | { orderId: string; userId: string }
    | undefined

  setRequestUserIdForTesting(() => 'user-test-1')
  setTelegramServiceForTesting({
    async disconnectChannel(input: {
      orderId: string
      userId: string
    }) {
      received = input
      return channelConfig
    },
  } as never)

  const response = await disconnectChannel(
    new NextRequest('http://localhost/api/me/orders/order-test-1/run-channel', {
      method: 'DELETE',
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
  })
  assert.equal(payload.channelConfig.id, 'channel-test-1')
})

test('telegram pairing start route returns service payload', async () => {
  let received:
    | { orderId: string; origin: string; userId: string }
    | undefined

  setRequestUserIdForTesting(() => 'user-test-1')
  setTelegramServiceForTesting({
    async startPairing(input: {
      orderId: string
      origin: string
      userId: string
    }): Promise<TelegramPairingResult> {
      received = input

      return {
        botUsername: 'ops_bot',
        pairingCommand: 'https://t.me/ops_bot',
        config: channelConfig,
      }
    },
  } as never)

  const request = new NextRequest('http://localhost/api/me/orders/order-test-1/run-channel/telegram/pairing/start', {
    method: 'POST',
  })

  const response = await startPairing(request, {
    params: Promise.resolve({ orderId: 'order-test-1' }),
  })
  const payload = await response.json()

  assert.equal(response.status, 200)
  assert.deepEqual(received, {
    orderId: 'order-test-1',
    origin: 'http://localhost',
    userId: 'user-test-1',
  })
  assert.equal(payload.pairingCommand, 'https://t.me/ops_bot')
  assert.equal(payload.channelConfig.id, 'channel-test-1')
})

test('telegram webhook route surfaces paired outcome and secret mismatch', async () => {
  let received:
    | { orderId: string; secretToken: string | null; update: TelegramUpdate }
    | undefined

  setTelegramServiceForTesting({
    async handleWebhook(input: {
      orderId: string
      secretToken: string | null
      update: TelegramUpdate
    }): Promise<TelegramWebhookResult> {
      received = input

      return {
        config: channelConfig,
        outcome: 'paired',
      }
    },
  } as never)

  const request = new NextRequest('http://localhost/api/webhooks/telegram?orderId=order-test-1', {
    body: JSON.stringify({
      message: {
        chat: { id: 77 },
        text: '/start',
      },
    }),
    headers: {
      'x-telegram-bot-api-secret-token': 'secret-token',
    },
    method: 'POST',
  })

  const response = await telegramWebhook(request)
  const payload = await response.json()

  assert.equal(response.status, 200)
  assert.deepEqual(received, {
    orderId: 'order-test-1',
    secretToken: 'secret-token',
    update: {
      message: {
        chat: { id: 77 },
        text: '/start',
      },
    },
  })
  assert.equal(payload.outcome, 'paired')

  setTelegramServiceForTesting({
    async handleWebhook() {
      throw new HttpError(401, 'Webhook secret mismatch.')
    },
  } as never)

  const forbiddenResponse = await telegramWebhook(
    new NextRequest('http://localhost/api/webhooks/telegram?orderId=order-test-1', {
      body: JSON.stringify({}),
      method: 'POST',
    }),
  )
  const forbiddenPayload = await forbiddenResponse.json()

  assert.equal(forbiddenResponse.status, 401)
  assert.equal(forbiddenPayload.error, 'Webhook secret mismatch.')
})

test('telegram webhook route records runtime activity for paired inbound messages', async () => {
  let recorded:
    | { occurredAt?: string; orderId: string }
    | undefined

  setTelegramServiceForTesting({
    async handleWebhook(): Promise<TelegramWebhookResult> {
      return {
        chatId: '77',
        outcome: 'runtime_activity',
      }
    },
  } as never)

  setRunServiceForTesting({
    async recordMeaningfulActivityForOrder(orderId: string, occurredAt?: string) {
      recorded = { occurredAt, orderId }
      return {
        occurredAt: occurredAt ?? 'now',
        orderId,
        touchedRunIds: ['run-1'],
      }
    },
  } as RunService)

  const response = await telegramWebhook(
    new NextRequest('http://localhost/api/webhooks/telegram?orderId=order-test-1', {
      body: JSON.stringify({
        message: {
          chat: { id: 77 },
          text: 'hello',
        },
      }),
      headers: {
        'x-telegram-bot-api-secret-token': 'secret-token',
      },
      method: 'POST',
    }),
  )
  const payload = await response.json()

  assert.equal(response.status, 200)
  assert.deepEqual(recorded, {
    occurredAt: undefined,
    orderId: 'order-test-1',
  })
  assert.equal(payload.outcome, 'runtime_activity')
})
