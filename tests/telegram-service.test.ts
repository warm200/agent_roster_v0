import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'

import { createTelegramService, type TelegramRepository } from '@/server/services/telegram.service'

const originalNextAuthUrl = process.env.NEXTAUTH_URL
const originalTelegramWebhookUrl = process.env.TELEGRAM_WEBHOOK_URL

function createRepository() {
  const config = {
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

  const context = {
    orderId: 'order-test-1',
    orderStatus: 'paid' as const,
    userId: 'user-test-1',
    config,
  }

  const repository: TelegramRepository = {
    async ensureOrderChannelForUser(orderId, userId) {
      if (orderId !== context.orderId || userId !== context.userId) {
        return null
      }

      return {
        ...context,
        config: { ...context.config },
      }
    },
    async findPendingPairing(orderId) {
      if (orderId !== context.orderId || context.config.recipientBindingStatus !== 'pending') {
        return null
      }

      return {
        ...context,
        config: { ...context.config },
      }
    },
    async updateChannelConfig(_orderId, update) {
      Object.assign(context.config, update, {
        updatedAt: new Date(),
      })

      return { ...context.config }
    },
  }

  return {
    config,
    context,
    repository,
  }
}

afterEach(() => {
  if (originalNextAuthUrl === undefined) {
    delete process.env.NEXTAUTH_URL
  } else {
    process.env.NEXTAUTH_URL = originalNextAuthUrl
  }

  if (originalTelegramWebhookUrl === undefined) {
    delete process.env.TELEGRAM_WEBHOOK_URL
  } else {
    process.env.TELEGRAM_WEBHOOK_URL = originalTelegramWebhookUrl
  }
})

test('telegram service falls back to polling mode on local http origins', async () => {
  process.env.NEXTAUTH_URL = 'http://localhost:3000'
  delete process.env.TELEGRAM_WEBHOOK_URL

  const { repository, context } = createRepository()
  let deletedWebhook = false
  let setWebhookCalled = false

  const service = createTelegramService({
    apiClient: {
      async deleteWebhook() {
        deletedWebhook = true
      },
      async getMe() {
        return {
          id: 42,
          username: 'ops_bot',
        }
      },
      async getUpdates() {
        return []
      },
      async setWebhook() {
        setWebhookCalled = true
      },
    },
    repository,
    secretSeed: 'test-secret',
    secretStore: {
      async read() {
        return 'telegram-token'
      },
      async write() {
        return 'secret-ref'
      },
    },
  })

  const result = await service.startPairing({
    orderId: context.orderId,
    origin: 'http://localhost:3000',
    userId: context.userId,
  })

  assert.equal(deletedWebhook, true)
  assert.equal(setWebhookCalled, false)
  assert.match(result.pairingCommand, /^https:\/\/t\.me\/ops_bot\?start=/)
})

test('telegram service disconnects the current bot and resets the channel config', async () => {
  process.env.NEXTAUTH_URL = 'http://localhost:3000'
  delete process.env.TELEGRAM_WEBHOOK_URL

  const { repository, context } = createRepository()
  let deletedWebhook = false

  const service = createTelegramService({
    apiClient: {
      async deleteWebhook() {
        deletedWebhook = true
      },
      async getMe() {
        return {
          id: 42,
          username: 'ops_bot',
        }
      },
      async getUpdates() {
        return []
      },
      async setWebhook() {},
    },
    repository,
    secretSeed: 'test-secret',
    secretStore: {
      async read() {
        return 'telegram-token'
      },
      async write() {
        return 'secret-ref'
      },
    },
  })

  const config = await service.disconnectChannel({
    orderId: context.orderId,
    userId: context.userId,
  })

  assert.equal(deletedWebhook, true)
  assert.equal(config.botTokenSecretRef, null)
  assert.equal(config.tokenStatus, 'pending')
  assert.equal(config.recipientBindingStatus, 'pending')
  assert.equal(config.recipientExternalId, null)
})

test('telegram service pairs pending local-dev chats by polling getUpdates', async () => {
  process.env.NEXTAUTH_URL = 'http://localhost:3000'
  delete process.env.TELEGRAM_WEBHOOK_URL

  const { repository, context } = createRepository()
  const service = createTelegramService({
    apiClient: {
      async deleteWebhook() {},
      async getMe() {
        return {
          id: 42,
          username: 'ops_bot',
        }
      },
      async getUpdates() {
        return []
      },
      async setWebhook() {},
    },
    repository,
    secretSeed: 'test-secret',
    secretStore: {
      async read() {
        return 'telegram-token'
      },
      async write() {
        return 'secret-ref'
      },
    },
  })

  const started = await service.startPairing({
    orderId: context.orderId,
    origin: 'http://localhost:3000',
    userId: context.userId,
  })
  const token = started.pairingCommand.split('start=')[1]

  const pollingService = createTelegramService({
    apiClient: {
      async deleteWebhook() {},
      async getMe() {
        return {
          id: 42,
          username: 'ops_bot',
        }
      },
      async getUpdates() {
        return [
          {
            message: {
              chat: { id: 77 },
              text: `/start ${token}`,
            },
          },
        ]
      },
      async setWebhook() {},
    },
    repository,
    secretSeed: 'test-secret',
    secretStore: {
      async read() {
        return 'telegram-token'
      },
      async write() {
        return 'secret-ref'
      },
    },
  })

  const config = await pollingService.getChannelConfig({
    orderId: context.orderId,
    userId: context.userId,
  })

  assert.equal(config.recipientBindingStatus, 'paired')
  assert.equal(config.recipientExternalId, '77')
})
