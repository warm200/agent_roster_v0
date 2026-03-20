import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { afterEach, test } from 'node:test'

import { HttpError } from '@/server/lib/http'
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
    async findOrderChannel(orderId) {
      if (orderId !== context.orderId) {
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

test('telegram service requires a public https webhook url for pairing', async () => {
  process.env.NEXTAUTH_URL = 'http://localhost:3000'
  delete process.env.TELEGRAM_WEBHOOK_URL

  const { repository, context } = createRepository()
  let setWebhookCalled = false

  const service = createTelegramService({
    apiClient: {
      async deleteWebhook() {},
      async getMe() {
        return {
          id: 42,
          username: 'ops_bot',
        }
      },
      async sendMessage() {},
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

  await assert.rejects(
    service.startPairing({
      orderId: context.orderId,
      origin: 'http://localhost:3000',
      userId: context.userId,
    }),
    (error: unknown) => {
      assert.ok(error instanceof HttpError)
      assert.equal(
        error.message,
        'Telegram pairing requires a public HTTPS webhook URL. Set TELEGRAM_WEBHOOK_URL to your public /api/webhooks/telegram endpoint.',
      )
      return true
    },
  )

  assert.equal(setWebhookCalled, false)
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
      async sendMessage() {},
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

test('telegram service surfaces unreadable stored bot credentials clearly when pairing starts', async () => {
  process.env.NEXTAUTH_URL = 'http://localhost:3000'
  process.env.TELEGRAM_WEBHOOK_URL = 'https://example.com/api/webhooks/telegram'

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
      async sendMessage() {},
      async setWebhook() {},
    },
    repository,
    secretSeed: 'test-secret',
    secretStore: {
      async read() {
        throw new HttpError(
          409,
          'Stored Telegram bot credentials can no longer be decrypted. Disconnect and reconnect the bot.',
        )
      },
      async write() {
        return 'secret-ref'
      },
    },
  })

  await assert.rejects(
    service.startPairing({
      orderId: context.orderId,
      origin: 'http://localhost:3000',
      userId: context.userId,
    }),
    (error: unknown) => {
      assert.ok(error instanceof HttpError)
      assert.equal(
        error.message,
        'Stored Telegram bot credentials can no longer be decrypted. Disconnect and reconnect the bot.',
      )
      return true
    },
  )
})

test('telegram service marks paired recipient messages as runtime activity', async () => {
  process.env.NEXTAUTH_URL = 'https://example.com'
  process.env.TELEGRAM_WEBHOOK_URL = 'https://example.com/api/webhooks/telegram'

  const { repository, context } = createRepository()
  Object.assign(context.config, {
    recipientBindingStatus: 'paired' as const,
    recipientExternalId: '77',
  })

  const service = createTelegramService({
    apiClient: {
      async deleteWebhook() {},
      async getMe() {
        return {
          id: 42,
          username: 'ops_bot',
        }
      },
      async sendMessage() {},
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

  const result = await service.handleWebhook({
    orderId: context.orderId,
    secretToken: createHmac('sha256', 'test-secret').update(context.orderId).digest('hex'),
    update: {
      message: {
        chat: { id: 77 },
        text: 'hello',
      },
    },
  })

  assert.deepEqual(result, {
    chatId: '77',
    outcome: 'runtime_activity',
  })
})

test('telegram service pairs pending chats from webhook start messages', async () => {
  process.env.NEXTAUTH_URL = 'https://example.com'
  process.env.TELEGRAM_WEBHOOK_URL = 'https://example.com/api/webhooks/telegram'

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
      async sendMessage() {},
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
    origin: 'https://example.com',
    userId: context.userId,
  })
  const token = started.pairingCommand.split('start=')[1]

  const result = await service.handleWebhook({
    orderId: context.orderId,
    secretToken: createHmac('sha256', 'test-secret').update(context.orderId).digest('hex'),
    update: {
      message: {
        chat: { id: 77 },
        text: `/start ${token}`,
      },
    },
  })

  assert.deepEqual(result, {
    config: {
      ...context.config,
      recipientBindingStatus: 'paired',
      recipientExternalId: '77',
    },
    outcome: 'paired',
  })
})

test('telegram service appends the telegram webhook route when only a base url is configured', async () => {
  process.env.NEXTAUTH_URL = 'https://example.com'
  process.env.TELEGRAM_WEBHOOK_URL = 'https://example.com'

  const { repository, context } = createRepository()
  let registeredWebhookUrl: string | null = null

  const service = createTelegramService({
    apiClient: {
      async deleteWebhook() {},
      async getMe() {
        return {
          id: 42,
          username: 'ops_bot',
        }
      },
      async sendMessage() {},
      async setWebhook(args) {
        registeredWebhookUrl = args.url
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

  await service.startPairing({
    orderId: context.orderId,
    origin: 'https://example.com',
    userId: context.userId,
  })

  assert.equal(
    registeredWebhookUrl,
    `https://example.com/api/webhooks/telegram?orderId=${context.orderId}`,
  )
})

test('telegram service can reclaim the app webhook for a paired order', async () => {
  process.env.NEXTAUTH_URL = 'https://example.com'
  process.env.TELEGRAM_WEBHOOK_URL = 'https://example.com/api/webhooks/telegram'

  const { repository, context } = createRepository()
  let registeredWebhookUrl: string | null = null
  let registeredSecret: string | null = null

  Object.assign(context.config, {
    recipientBindingStatus: 'paired' as const,
    recipientExternalId: '77',
  })

  const service = createTelegramService({
    apiClient: {
      async deleteWebhook() {},
      async getMe() {
        return { id: 42, username: 'ops_bot' }
      },
      async sendMessage() {},
      async setWebhook(args) {
        registeredWebhookUrl = args.url
        registeredSecret = args.secretToken
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

  const result = await service.claimWebhookForApp({
    orderId: context.orderId,
  })

  assert.equal(result.url, `https://example.com/api/webhooks/telegram?orderId=${context.orderId}`)
  assert.equal(registeredWebhookUrl, result.url)
  assert.equal(registeredSecret, createHmac('sha256', 'test-secret').update(context.orderId).digest('hex'))
})

test('telegram service can release the app webhook back to runtime polling', async () => {
  const { repository, context } = createRepository()
  let deletedWebhookToken: string | null = null

  Object.assign(context.config, {
    recipientBindingStatus: 'paired' as const,
    recipientExternalId: '77',
  })

  const service = createTelegramService({
    apiClient: {
      async deleteWebhook(args) {
        deletedWebhookToken = args.token
      },
      async getMe() {
        return { id: 42, username: 'ops_bot' }
      },
      async sendMessage() {},
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

  const result = await service.releaseWebhookToRuntimePolling({
    orderId: context.orderId,
  })

  assert.equal(result.orderId, context.orderId)
  assert.equal(deletedWebhookToken, 'telegram-token')
})

test('telegram service can send a paired message to the bound recipient', async () => {
  const { repository, context } = createRepository()
  let delivered: { chatId: string; text: string; token: string } | null = null

  Object.assign(context.config, {
    recipientBindingStatus: 'paired' as const,
    recipientExternalId: '77',
  })

  const service = createTelegramService({
    apiClient: {
      async deleteWebhook() {},
      async getMe() {
        return { id: 42, username: 'ops_bot' }
      },
      async sendMessage(args) {
        delivered = {
          chatId: args.chatId,
          text: args.text,
          token: args.token,
        }
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

  const result = await service.sendPairedMessage({
    orderId: context.orderId,
    text: 'Your sandbox stopped due to inactivity. Send any message here to wake it up.',
  })

  assert.deepEqual(result, {
    chatId: '77',
    orderId: context.orderId,
  })
  assert.deepEqual(delivered, {
    chatId: '77',
    text: 'Your sandbox stopped due to inactivity. Send any message here to wake it up.',
    token: 'telegram-token',
  })
})

test('telegram service marks pairing pending before webhook registration completes', async () => {
  process.env.NEXTAUTH_URL = 'https://example.com'
  process.env.TELEGRAM_WEBHOOK_URL = 'https://example.com/api/webhooks/telegram'

  const { repository, context } = createRepository()
  let service: ReturnType<typeof createTelegramService>

  service = createTelegramService({
    apiClient: {
      async deleteWebhook() {},
      async getMe() {
        return {
          id: 42,
          username: 'ops_bot',
        }
      },
      async sendMessage() {},
      async setWebhook() {
        const result = await service.handleWebhook({
          orderId: context.orderId,
          secretToken: createHmac('sha256', 'test-secret').update(context.orderId).digest('hex'),
          update: {
            message: {
              chat: { id: 77 },
              text: '/start',
            },
          },
        })

        assert.deepEqual(result, {
          config: {
            ...context.config,
            recipientBindingStatus: 'paired',
            recipientExternalId: '77',
          },
          outcome: 'paired',
        })
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

  const started = await service.startPairing({
    orderId: context.orderId,
    origin: 'https://example.com',
    userId: context.userId,
  })

  assert.equal(started.config.recipientBindingStatus, 'pending')
  assert.equal(context.config.recipientBindingStatus, 'paired')
  assert.equal(context.config.recipientExternalId, '77')
})
