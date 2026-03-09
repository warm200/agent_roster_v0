import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto'

import { and, eq } from 'drizzle-orm'

import { createDb, type DbClient } from '../db'
import { orders, runChannelConfigs } from '../db/schema'
import { HttpError } from '../lib/http'

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

export type TelegramUpdate = {
  message?: {
    text?: string
    chat?: {
      id?: number | string
    }
  }
}

export interface TelegramRepository {
  ensureOrderChannelForUser(orderId: string, userId: string): Promise<OrderChannelContext | null>
  updateChannelConfig(orderId: string, update: ChannelConfigUpdate): Promise<typeof runChannelConfigs.$inferSelect>
  findPendingPairing(orderId: string): Promise<OrderChannelContext | null>
}

export interface SecretStore {
  write(value: string): Promise<string>
  read(ref: string): Promise<string>
}

export interface TelegramApiClient {
  getMe(token: string): Promise<TelegramBotProfile>
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
}

class EnvSecretStore implements SecretStore {
  private readonly key: Buffer

  constructor(secretSeed: string) {
    this.key = createHash('sha256').update(secretSeed).digest()
  }

  async write(value: string) {
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', this.key, iv)
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()

    return ['enc', iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join(':')
  }

  async read(ref: string) {
    const [prefix, ivPart, tagPart, dataPart] = ref.split(':')

    if (prefix !== 'enc' || !ivPart || !tagPart || !dataPart) {
      throw new HttpError(500, 'Stored Telegram secret is invalid.')
    }

    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(ivPart, 'base64url'))
    decipher.setAuthTag(Buffer.from(tagPart, 'base64url'))

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataPart, 'base64url')),
      decipher.final(),
    ])

    return decrypted.toString('utf8')
  }
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

function extractStartChatId(update: TelegramUpdate) {
  const text = update.message?.text?.trim()
  const chatId = update.message?.chat?.id

  if (!text || !text.startsWith('/start') || chatId === undefined) {
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

export function createTelegramService(options: CreateTelegramServiceOptions = {}) {
  const secretSeed = options.secretSeed ?? process.env.AUTH_SECRET

  if (!secretSeed) {
    throw new Error('AUTH_SECRET is required for Telegram secret handling')
  }

  const repository = options.repository ?? new DatabaseTelegramRepository()
  const secretStore = options.secretStore ?? new EnvSecretStore(secretSeed)
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

    async startPairing(args: { orderId: string; userId: string; origin: string }): Promise<TelegramPairingResult> {
      const context = await repository.ensureOrderChannelForUser(args.orderId, args.userId)

      if (!context) {
        throw new HttpError(404, 'Order not found.')
      }

      assertPaidOrder(context)
      assertValidatedToken(context)

      const botToken = await secretStore.read(context.config.botTokenSecretRef!)
      const bot = await apiClient.getMe(botToken)
      const webhookSecret = buildWebhookSecret(args.orderId, secretSeed)
      const webhookUrl = new URL(process.env.TELEGRAM_WEBHOOK_URL || '/api/webhooks/telegram', args.origin)
      webhookUrl.searchParams.set('orderId', args.orderId)

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

      const config = await repository.updateChannelConfig(args.orderId, {
        recipientBindingStatus: 'pending',
        recipientExternalId: null,
      })
      const botUsername = serializeBotUsername(bot.username)

      return {
        config,
        botUsername,
        pairingCommand: botUsername
          ? `https://t.me/${botUsername}`
          : 'Open Telegram and send /start to your bot.',
      }
    },

    async handleWebhook(args: {
      orderId: string
      secretToken: string | null
      update: TelegramUpdate
    }): Promise<TelegramWebhookResult> {
      const expectedSecret = buildWebhookSecret(args.orderId, secretSeed)

      if (args.secretToken !== expectedSecret) {
        throw new HttpError(401, 'Webhook secret mismatch.')
      }

      const context = await repository.findPendingPairing(args.orderId)

      if (!context) {
        return {
          outcome: 'ignored',
          reason: 'no_pending_pairing',
        }
      }

      const chatId = extractStartChatId(args.update)

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

export const telegramService = createTelegramService()
