import { createHmac } from 'node:crypto'

import { and, eq } from 'drizzle-orm'

import { createDb, type DbClient } from '../db'
import { orders, runChannelConfigs } from '../db/schema'
import { EncryptedSecretStore } from '../lib/encrypted-secret-store'
import { HttpError } from '../lib/http'
import type { RunChannelConfig } from '@/lib/types'

type OrderChannelContext = {
  orderId: string
  userId: string
  orderStatus: typeof orders.$inferSelect.status
  config: typeof runChannelConfigs.$inferSelect
}

type ChannelConfigUpdate = Partial<{
  botTokenSecretRef: string | null
  tokenStatus: typeof runChannelConfigs.$inferInsert.tokenStatus
  recipientBindingStatus: typeof runChannelConfigs.$inferInsert.recipientBindingStatus
  recipientExternalId: string | null
}>

export type TelegramBotProfile = {
  id: number
  username?: string
  firstName?: string
}

export type TelegramPairingResult = {
  config: typeof runChannelConfigs.$inferSelect
  botUsername: string | null
  pairingCommand: string
}

export type TelegramWebhookResult =
  | { outcome: 'ignored'; reason: string }
  | { outcome: 'paired'; config: typeof runChannelConfigs.$inferSelect }
  | { outcome: 'runtime_activity'; chatId: string }

export type TelegramUpdate = {
  update_id?: number
  message?: {
    text?: string
    chat?: {
      id?: number | string
    }
  }
}

export type OpenClawTelegramChannelConfig = {
  enabled: true
  botToken: string
  dmPolicy: 'allowlist'
  allowFrom: string[]
  groupPolicy: 'disabled'
  configWrites: false
}

export interface TelegramRepository {
  ensureOrderChannelForUser(orderId: string, userId: string): Promise<OrderChannelContext | null>
  updateChannelConfig(orderId: string, update: ChannelConfigUpdate): Promise<typeof runChannelConfigs.$inferSelect>
  findPendingPairing(orderId: string): Promise<OrderChannelContext | null>
  findOrderChannel(orderId: string): Promise<OrderChannelContext | null>
}

export interface SecretStore {
  write(value: string): Promise<string>
  read(ref: string): Promise<string>
}

export interface TelegramApiClient {
  getMe(token: string): Promise<TelegramBotProfile>
  deleteWebhook(args: { token: string }): Promise<void>
  setWebhook(args: {
    token: string
    url: string
    secretToken: string
  }): Promise<void>
}

type CreateTelegramServiceOptions = {
  repository?: TelegramRepository
  secretStore?: SecretStore
  apiClient?: TelegramApiClient
  secretSeed?: string
}

let dbClient: DbClient | null = null

function getDb() {
  dbClient ??= createDb()
  return dbClient
}

class DatabaseTelegramRepository implements TelegramRepository {
  async ensureOrderChannelForUser(orderId: string, userId: string): Promise<OrderChannelContext | null> {
    const db = getDb()
    const [existing] = await db
      .select({
        order: orders,
        config: runChannelConfigs,
      })
      .from(orders)
      .leftJoin(runChannelConfigs, eq(runChannelConfigs.orderId, orders.id))
      .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
      .limit(1)

    if (!existing) {
      return null
    }

    if (!existing.config) {
      const [createdConfig] = await db
        .insert(runChannelConfigs)
        .values({
          id: crypto.randomUUID(),
          orderId,
          channelType: 'telegram',
          botTokenSecretRef: null,
          tokenStatus: 'pending',
          recipientBindingStatus: 'pending',
          recipientExternalId: null,
          appliesToScope: 'run',
          updatedAt: new Date(),
        })
        .returning()

      return {
        orderId: existing.order.id,
        userId: existing.order.userId,
        orderStatus: existing.order.status,
        config: createdConfig,
      }
    }

    return {
      orderId: existing.order.id,
      userId: existing.order.userId,
      orderStatus: existing.order.status,
      config: existing.config,
    }
  }

  async updateChannelConfig(orderId: string, update: ChannelConfigUpdate) {
    const db = getDb()
    const [config] = await db
      .update(runChannelConfigs)
      .set({
        ...update,
        updatedAt: new Date(),
      })
      .where(eq(runChannelConfigs.orderId, orderId))
      .returning()

    if (!config) {
      throw new HttpError(404, 'Order channel config not found.')
    }

    return config
  }

  async findPendingPairing(orderId: string) {
    const db = getDb()
    const [row] = await db
      .select({
        order: orders,
        config: runChannelConfigs,
      })
      .from(orders)
      .innerJoin(runChannelConfigs, eq(runChannelConfigs.orderId, orders.id))
      .where(
        and(
          eq(orders.id, orderId),
          eq(runChannelConfigs.recipientBindingStatus, 'pending'),
        ),
      )
      .limit(1)

    if (!row) {
      return null
    }

    return {
      orderId: row.order.id,
      userId: row.order.userId,
      orderStatus: row.order.status,
      config: row.config,
    }
  }

  async findOrderChannel(orderId: string) {
    const db = getDb()
    const [row] = await db
      .select({
        order: orders,
        config: runChannelConfigs,
      })
      .from(orders)
      .innerJoin(runChannelConfigs, eq(runChannelConfigs.orderId, orders.id))
      .where(eq(orders.id, orderId))
      .limit(1)

    if (!row) {
      return null
    }

    return {
      orderId: row.order.id,
      userId: row.order.userId,
      orderStatus: row.order.status,
      config: row.config,
    }
  }
}

function resolveTelegramSecretSeed(secretSeed?: string) {
  const resolved = secretSeed ?? process.env.TELEGRAM_SECRET_SEED ?? process.env.AUTH_SECRET

  if (!resolved) {
    throw new Error('TELEGRAM_SECRET_SEED or AUTH_SECRET is required for Telegram secret handling')
  }

  return resolved
}

class TelegramFetchClient implements TelegramApiClient {
  async getMe(token: string) {
    const payload = await callTelegramApi<TelegramGetMeResult>(token, 'getMe')

    return {
      id: payload.id,
      username: payload.username,
      firstName: payload.first_name,
    }
  }

  async deleteWebhook(args: { token: string }) {
    await callTelegramApi(args.token, 'deleteWebhook', {
      drop_pending_updates: 'false',
    })
  }

  async setWebhook(args: { token: string; url: string; secretToken: string }) {
    await callTelegramApi(args.token, 'setWebhook', {
      url: args.url,
      secret_token: args.secretToken,
    })
  }
}

type TelegramGetMeResult = {
  id: number
  username?: string
  first_name?: string
}

type TelegramResponse<T> = {
  ok: boolean
  description?: string
  result?: T
}

async function callTelegramApi<T = true>(
  token: string,
  method: string,
  body?: Record<string, string>,
) {
  const url = `https://api.telegram.org/bot${token}/${method}`
  const init: RequestInit = body
    ? {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(body),
      }
    : {}
  const response = await fetch(url, init)
  const payload = (await response.json()) as TelegramResponse<T>

  if (!response.ok || !payload.ok || !payload.result) {
    throw new HttpError(400, payload.description ?? 'Telegram API request failed.')
  }

  return payload.result
}

function assertPaidOrder(context: OrderChannelContext) {
  if (context.orderStatus !== 'paid') {
    throw new HttpError(409, 'Telegram setup requires a paid order.')
  }
}

function assertValidatedToken(context: OrderChannelContext) {
  if (context.config.tokenStatus !== 'validated' || !context.config.botTokenSecretRef) {
    throw new HttpError(409, 'Validate the Telegram bot token before starting pairing.')
  }
}

function buildPairingToken(orderId: string, secretSeed: string) {
  return createHmac('sha256', secretSeed).update(`pairing:${orderId}`).digest('hex').slice(0, 24)
}

function extractStartChatId(update: TelegramUpdate, pairingToken: string) {
  const text = update.message?.text?.trim()
  const chatId = update.message?.chat?.id

  if (!text || chatId === undefined) {
    return null
  }

  const normalizedText = text.replace(/^\/start(?:@[A-Za-z0-9_]+)?/, '/start')

  if (normalizedText !== '/start' && normalizedText !== `/start ${pairingToken}`) {
    return null
  }

  return String(chatId)
}

function buildWebhookSecret(orderId: string, secretSeed: string) {
  return createHmac('sha256', secretSeed).update(orderId).digest('hex')
}

function serializeBotUsername(username?: string) {
  if (!username) {
    return null
  }

  return username.startsWith('@') ? username.slice(1) : username
}

function resolveTelegramWebhookEndpoint(origin?: string) {
  const configuredUrl = process.env.TELEGRAM_WEBHOOK_URL

  if (configuredUrl) {
    const url = new URL(configuredUrl)

    if (url.pathname === '/' || url.pathname === '') {
      url.pathname = '/api/webhooks/telegram'
    }

    return url
  }

  return new URL('/api/webhooks/telegram', origin || process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
}

function supportsTelegramWebhook(origin?: string) {
  return resolveTelegramWebhookEndpoint(origin).protocol === 'https:'
}

export function createTelegramService(options: CreateTelegramServiceOptions = {}) {
  const secretSeed = resolveTelegramSecretSeed(options.secretSeed)

  const requiredSecretSeed = secretSeed

  const repository = options.repository ?? new DatabaseTelegramRepository()
  const secretStore =
    options.secretStore ??
    new EncryptedSecretStore(
      secretSeed,
      'Stored Telegram bot credentials can no longer be decrypted. Disconnect and reconnect the bot.',
    )
  const apiClient = options.apiClient ?? new TelegramFetchClient()

  return {
    async getChannelConfig(args: { orderId: string; userId: string }) {
      const context = await repository.ensureOrderChannelForUser(args.orderId, args.userId)

      if (!context) {
        throw new HttpError(404, 'Order not found.')
      }

      return context.config
    },

    async validateToken(args: { orderId: string; userId: string; botToken: string }) {
      const context = await repository.ensureOrderChannelForUser(args.orderId, args.userId)

      if (!context) {
        throw new HttpError(404, 'Order not found.')
      }

      assertPaidOrder(context)

      try {
        const bot = await apiClient.getMe(args.botToken)
        const botTokenSecretRef = await secretStore.write(args.botToken)
        const config = await repository.updateChannelConfig(args.orderId, {
          botTokenSecretRef,
          tokenStatus: 'validated',
        })

        return { bot, config }
      } catch (error) {
        await repository.updateChannelConfig(args.orderId, {
          tokenStatus: 'failed',
        })

        if (error instanceof HttpError) {
          throw error
        }

        throw new HttpError(400, 'Telegram bot token validation failed.')
      }
    },

    async disconnectChannel(args: { orderId: string; userId: string }) {
      const context = await repository.ensureOrderChannelForUser(args.orderId, args.userId)

      if (!context) {
        throw new HttpError(404, 'Order not found.')
      }

      if (context.config.botTokenSecretRef) {
        try {
          const botToken = await secretStore.read(context.config.botTokenSecretRef)
          await apiClient.deleteWebhook({ token: botToken })
        } catch {
          // Best effort only. Users should still be able to unlink a bot even if Telegram cleanup fails.
        }
      }

      return repository.updateChannelConfig(args.orderId, {
        botTokenSecretRef: null,
        tokenStatus: 'pending',
        recipientBindingStatus: 'pending',
        recipientExternalId: null,
      })
    },

    async startPairing(args: { orderId: string; userId: string; origin: string }): Promise<TelegramPairingResult> {
      const context = await repository.ensureOrderChannelForUser(args.orderId, args.userId)

      if (!context) {
        throw new HttpError(404, 'Order not found.')
      }

      assertPaidOrder(context)
      assertValidatedToken(context)

      if (!supportsTelegramWebhook(args.origin)) {
        throw new HttpError(
          409,
          'Telegram pairing requires a public HTTPS webhook URL. Set TELEGRAM_WEBHOOK_URL to your public /api/webhooks/telegram endpoint.',
        )
      }

      const botToken = await secretStore.read(context.config.botTokenSecretRef!)
      const bot = await apiClient.getMe(botToken)
      const webhookSecret = buildWebhookSecret(args.orderId, requiredSecretSeed)
      const pairingToken = buildPairingToken(args.orderId, requiredSecretSeed)
      const webhookUrl = resolveTelegramWebhookEndpoint(args.origin)
      webhookUrl.searchParams.set('orderId', args.orderId)
      const pendingConfig = await repository.updateChannelConfig(args.orderId, {
        recipientBindingStatus: 'pending',
        recipientExternalId: null,
      })

      try {
        await apiClient.setWebhook({
          token: botToken,
          url: webhookUrl.toString(),
          secretToken: webhookSecret,
        })
      } catch (error) {
        await repository.updateChannelConfig(args.orderId, {
          recipientBindingStatus: 'failed',
        })
        throw error
      }
      const botUsername = serializeBotUsername(bot.username)

      return {
        config: pendingConfig,
        botUsername,
        pairingCommand: botUsername
          ? `https://t.me/${botUsername}?start=${pairingToken}`
          : `Open Telegram and send /start ${pairingToken} to your bot.`,
      }
    },

    async handleWebhook(args: {
      orderId: string
      secretToken: string | null
      update: TelegramUpdate
    }): Promise<TelegramWebhookResult> {
      const expectedSecret = buildWebhookSecret(args.orderId, requiredSecretSeed)

      if (args.secretToken !== expectedSecret) {
        throw new HttpError(401, 'Webhook secret mismatch.')
      }

      const context = await repository.findPendingPairing(args.orderId)

      if (!context) {
        const activeContext = await repository.findOrderChannel(args.orderId)
        const chatId = args.update.message?.chat?.id != null ? String(args.update.message.chat.id) : null

        if (
          activeContext &&
          activeContext.config.tokenStatus === 'validated' &&
          activeContext.config.recipientBindingStatus === 'paired' &&
          activeContext.config.recipientExternalId &&
          chatId === activeContext.config.recipientExternalId
        ) {
          return {
            outcome: 'runtime_activity',
            chatId,
          }
        }

        return {
          outcome: 'ignored',
          reason: 'no_pending_pairing',
        }
      }

      const chatId = extractStartChatId(args.update, buildPairingToken(args.orderId, requiredSecretSeed))

      if (!chatId) {
        return {
          outcome: 'ignored',
          reason: 'non_pairing_update',
        }
      }

      const config = await repository.updateChannelConfig(args.orderId, {
        recipientBindingStatus: 'paired',
        recipientExternalId: chatId,
      })

      return {
        outcome: 'paired',
        config,
      }
    },
  }
}

export async function buildOpenClawTelegramChannelConfig(
  config: Pick<
    RunChannelConfig,
    'botTokenSecretRef' | 'recipientBindingStatus' | 'recipientExternalId' | 'tokenStatus'
  > | null,
  options: { secretSeed?: string } = {},
): Promise<OpenClawTelegramChannelConfig | null> {
  if (
    !config ||
    config.tokenStatus !== 'validated' ||
    config.recipientBindingStatus !== 'paired' ||
    !config.botTokenSecretRef ||
    !config.recipientExternalId
  ) {
    return null
  }

  const secretStore = new EncryptedSecretStore(
    resolveTelegramSecretSeed(options.secretSeed),
    'Stored Telegram bot credentials can no longer be decrypted. Disconnect and reconnect the bot.',
  )
  const botToken = await secretStore.read(config.botTokenSecretRef)

  return {
    enabled: true,
    botToken,
    dmPolicy: 'allowlist',
    allowFrom: [`tg:${config.recipientExternalId}`],
    groupPolicy: 'disabled',
    configWrites: false,
  }
}

let telegramServiceSingleton: ReturnType<typeof createTelegramService> | null = null
let telegramServiceOverride: ReturnType<typeof createTelegramService> | null = null

export function getTelegramService() {
  if (telegramServiceOverride) {
    return telegramServiceOverride
  }

  telegramServiceSingleton ??= createTelegramService()
  return telegramServiceSingleton
}

export function setTelegramServiceForTesting(
  service: ReturnType<typeof createTelegramService> | null,
) {
  telegramServiceOverride = service
}
