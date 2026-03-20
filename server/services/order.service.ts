import { createHmac, timingSafeEqual } from 'node:crypto'

import { and, desc, eq } from 'drizzle-orm'

import type { AgentProviderKeyName, AgentSetup } from '@/lib/types'
import { resolveAgentSetupModelDefaults } from '@/lib/agent-setup-defaults'
import { createDb, type DbClient } from '../db'
import { agents, agentVersions, cartItems, carts, orderItems, orders, riskProfiles, runChannelConfigs } from '../db/schema'
import { EncryptedSecretStore } from '../lib/encrypted-secret-store'
import { HttpError } from '../lib/http'
import { buildOrderSnapshot, type OrderItemRow } from './commerce.utils'

const DOWNLOAD_TTL_MS = 1000 * 60 * 15

type OrderRecord = typeof orders.$inferSelect

type PaymentInput = {
  amountCents: number
  currency: string
  paymentProvider: string
  paymentReference: string | null
}

type AgentSetupUpdateInput = Omit<AgentSetup, 'providerKeyStatus'>
type ProviderApiKeysInput = Partial<Record<AgentProviderKeyName, string | undefined>>
type ProviderApiKeySecretRefs = Partial<Record<AgentProviderKeyName, string | null>>

const AGENT_PROVIDER_KEY_NAMES = ['anthropic', 'google', 'openai', 'openrouter'] as const

let dbClient: DbClient | null = null

function getDb() {
  dbClient ??= createDb()
  return dbClient
}

function getSigningSecret() {
  const secret = process.env.DOWNLOAD_URL_SECRET || process.env.AUTH_SECRET

  if (!secret) {
    throw new Error('DOWNLOAD_URL_SECRET or AUTH_SECRET is required')
  }

  return secret
}

function getAgentSetupSecretSeed() {
  const secret = process.env.AGENT_SETUP_SECRET_SEED || process.env.AUTH_SECRET

  if (!secret) {
    throw new Error('AGENT_SETUP_SECRET_SEED or AUTH_SECRET is required')
  }

  return secret
}

function getAgentSetupSecretStore() {
  return new EncryptedSecretStore(
    getAgentSetupSecretSeed(),
    'Stored provider API credentials can no longer be decrypted. Re-enter them in Agent Setup.',
  )
}

function extractProviderApiKeySecretRefs(
  config: Record<string, unknown> | null | undefined,
): ProviderApiKeySecretRefs {
  const candidate = config?.providerApiKeySecretRefs

  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return {}
  }

  const refs: ProviderApiKeySecretRefs = {}

  for (const key of AGENT_PROVIDER_KEY_NAMES) {
    const value = (candidate as Record<string, unknown>)[key]
    refs[key] = typeof value === 'string' && value.trim() ? value : null
  }

  return refs
}

async function materializeProviderApiKeys(secretRefs: ProviderApiKeySecretRefs) {
  const secretStore = getAgentSetupSecretStore()
  const keys: Partial<Record<AgentProviderKeyName, string>> = {}

  for (const provider of AGENT_PROVIDER_KEY_NAMES) {
    const ref = secretRefs[provider]
    if (!ref) {
      continue
    }

    keys[provider] = await secretStore.read(ref)
  }

  return keys
}

async function mergeProviderApiKeySecretRefs(
  existingRefs: ProviderApiKeySecretRefs,
  vendorApiKeys?: ProviderApiKeysInput,
) {
  if (!vendorApiKeys) {
    return existingRefs
  }

  const secretStore = getAgentSetupSecretStore()
  const merged: ProviderApiKeySecretRefs = { ...existingRefs }

  for (const provider of AGENT_PROVIDER_KEY_NAMES) {
    const nextValue = vendorApiKeys[provider]

    if (nextValue === undefined) {
      continue
    }

    merged[provider] = await secretStore.write(nextValue.trim())
  }

  return merged
}

function signDownloadPayload(payload: string) {
  return createHmac('sha256', getSigningSecret()).update(payload).digest('hex')
}

function compareSignatures(expected: string, provided: string) {
  const expectedBuffer = Buffer.from(expected, 'hex')
  const providedBuffer = Buffer.from(provided, 'hex')

  if (expectedBuffer.length !== providedBuffer.length) {
    return false
  }

  return timingSafeEqual(expectedBuffer, providedBuffer)
}

async function loadOrderBase(input: { orderId: string; userId?: string | null }) {
  const db = getDb()
  const filters = [eq(orders.id, input.orderId)]

  if (input.userId) {
    filters.push(eq(orders.userId, input.userId))
  }

  const [row] = await db
    .select({
      order: orders,
      runChannelConfig: runChannelConfigs,
    })
    .from(orders)
    .leftJoin(runChannelConfigs, eq(runChannelConfigs.orderId, orders.id))
    .where(and(...filters))
    .limit(1)

  return row ?? null
}

async function loadOrderItems(orderId: string): Promise<OrderItemRow[]> {
  const db = getDb()
  return db
    .select({
      agent: agents,
      orderItem: orderItems,
      riskProfile: riskProfiles,
      version: agentVersions,
    })
    .from(orderItems)
    .innerJoin(agents, eq(orderItems.agentId, agents.id))
    .innerJoin(agentVersions, eq(orderItems.agentVersionId, agentVersions.id))
    .innerJoin(riskProfiles, eq(riskProfiles.agentVersionId, agentVersions.id))
    .where(eq(orderItems.orderId, orderId))
}

export function assertPaidOrder(order: Pick<OrderRecord, 'status'>) {
  if (order.status !== 'paid') {
    throw new HttpError(403, 'Downloads are only available for paid orders.')
  }
}

export function buildDownloadGrant(input: {
  baseUrl: string
  expiresAt: Date
  orderId: string
  orderItemId: string
}) {
  const payload = `${input.orderId}:${input.orderItemId}:${input.expiresAt.toISOString()}`
  const signature = signDownloadPayload(payload)
  const url = new URL(
    `/api/downloads/orders/${input.orderId}/items/${input.orderItemId}`,
    input.baseUrl,
  )

  url.searchParams.set('expiresAt', input.expiresAt.toISOString())
  url.searchParams.set('signature', signature)

  return {
    downloadUrl: url.toString(),
    expiresAt: input.expiresAt.toISOString(),
  }
}

export function buildLocalAgentDownloadGrant(input: {
  baseUrl: string
  expiresAt: Date
  slug: string
}) {
  const payload = `${input.slug}:${input.expiresAt.toISOString()}`
  const signature = signDownloadPayload(payload)
  const url = new URL(`/api/agents/${input.slug}/download`, input.baseUrl)

  url.searchParams.set('expiresAt', input.expiresAt.toISOString())
  url.searchParams.set('signature', signature)

  return {
    downloadUrl: url.toString(),
    expiresAt: input.expiresAt.toISOString(),
  }
}

export function verifyDownloadGrant(input: {
  expiresAt: string
  orderId: string
  orderItemId: string
  signature: string
}) {
  const expiresAt = new Date(input.expiresAt)

  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    throw new HttpError(410, 'Download link expired.')
  }

  const payload = `${input.orderId}:${input.orderItemId}:${expiresAt.toISOString()}`
  const expectedSignature = signDownloadPayload(payload)

  if (!compareSignatures(expectedSignature, input.signature)) {
    throw new HttpError(403, 'Invalid download signature.')
  }
}

export function verifyLocalAgentDownloadGrant(input: {
  expiresAt: string
  slug: string
  signature: string
}) {
  const expiresAt = new Date(input.expiresAt)

  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    throw new HttpError(410, 'Download link expired.')
  }

  const payload = `${input.slug}:${expiresAt.toISOString()}`
  const expectedSignature = signDownloadPayload(payload)

  if (!compareSignatures(expectedSignature, input.signature)) {
    throw new HttpError(403, 'Invalid download signature.')
  }
}

export async function getOrderByIdForUser(input: { orderId: string; userId: string }) {
  const base = await loadOrderBase(input)

  if (!base) {
    throw new HttpError(404, 'Order not found.')
  }

  const items = await loadOrderItems(base.order.id)
  return buildOrderSnapshot({
    items,
    order: base.order,
    runChannelConfig: base.runChannelConfig,
  })
}

export async function listOrdersForUser(userId: string) {
  const db = getDb()
  const baseRows = await db
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt))

  return Promise.all(
    baseRows.map((row) =>
      getOrderByIdForUser({
        orderId: row.id,
        userId,
      }),
    ),
  )
}

export async function updateOrderAgentSetupForUser(input: {
  orderId: string
  userId: string
  agentSetup: AgentSetupUpdateInput
  vendorApiKeys?: ProviderApiKeysInput
}) {
  const db = getDb()
  const base = await loadOrderBase({
    orderId: input.orderId,
    userId: input.userId,
  })

  if (!base) {
    throw new HttpError(404, 'Order not found.')
  }

  const items = await loadOrderItems(input.orderId)

  if (
    input.agentSetup.defaultAgentSlug &&
    !items.some((item) => item.agent.slug === input.agentSetup.defaultAgentSlug)
  ) {
    throw new HttpError(400, 'Default agent must be one of the purchased agents.')
  }

  const existingSetup =
    base.order.agentSetup && typeof base.order.agentSetup === 'object' && !Array.isArray(base.order.agentSetup)
      ? (base.order.agentSetup as Record<string, unknown>)
      : null
  const providerApiKeySecretRefs = await mergeProviderApiKeySecretRefs(
    extractProviderApiKeySecretRefs(existingSetup),
    input.vendorApiKeys,
  )
  const modelDefaults = resolveAgentSetupModelDefaults(input.agentSetup)
  const storedSetup = {
    ...input.agentSetup,
    modelPrimary: modelDefaults.modelPrimary,
    modelFallbacks: modelDefaults.modelFallbacks,
    providerApiKeySecretRefs,
  } satisfies Record<string, unknown>

  const [updated] = await db
    .update(orders)
    .set({
      agentSetup: storedSetup,
      updatedAt: new Date(),
    })
    .where(and(eq(orders.id, input.orderId), eq(orders.userId, input.userId)))
    .returning({ id: orders.id })

  if (!updated) {
    throw new HttpError(404, 'Order not found.')
  }

  return getOrderByIdForUser({
    orderId: input.orderId,
    userId: input.userId,
  })
}

export async function getOrderProviderApiKeysForUser(input: {
  orderId: string
  userId: string
}) {
  const base = await loadOrderBase(input)

  if (!base) {
    throw new HttpError(404, 'Order not found.')
  }

  const setup =
    base.order.agentSetup && typeof base.order.agentSetup === 'object' && !Array.isArray(base.order.agentSetup)
      ? (base.order.agentSetup as Record<string, unknown>)
      : null

  return materializeProviderApiKeys(extractProviderApiKeySecretRefs(setup))
}

export async function createPaidOrderFromCart(input: {
  cartId: string
  payment: PaymentInput
  userId: string
}) {
  const db = getDb()

  if (input.payment.paymentReference) {
    const [existingOrder] = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.paymentProvider, input.payment.paymentProvider),
          eq(orders.paymentReference, input.payment.paymentReference),
        ),
      )
      .limit(1)

    if (existingOrder) {
      return getOrderByIdForUser({
        orderId: existingOrder.id,
        userId: input.userId,
      })
    }
  }

  const orderId = await db.transaction(async (tx) => {
    const [cart] = await tx
      .select()
      .from(carts)
      .where(and(eq(carts.id, input.cartId), eq(carts.status, 'active')))
      .limit(1)

    if (!cart) {
      throw new HttpError(404, 'Active cart not found.')
    }

    const saleRows = await tx
      .select({
        agent: agents,
        cartItemId: cartItems.id,
        riskProfile: riskProfiles,
        version: agentVersions,
      })
      .from(cartItems)
      .innerJoin(agents, eq(cartItems.agentId, agents.id))
      .innerJoin(agentVersions, eq(cartItems.agentVersionId, agentVersions.id))
      .innerJoin(riskProfiles, eq(riskProfiles.agentVersionId, agentVersions.id))
      .where(eq(cartItems.cartId, cart.id))

    if (saleRows.length === 0) {
      throw new HttpError(400, 'Cannot create an order from an empty cart.')
    }

    const calculatedAmount = saleRows.reduce((sum, row) => sum + row.agent.priceCents, 0)

    if (calculatedAmount !== input.payment.amountCents) {
      throw new HttpError(400, 'Paid amount does not match cart total.')
    }

    const [order] = await tx
      .insert(orders)
      .values({
        id: crypto.randomUUID(),
        amountCents: calculatedAmount,
        bundleRiskLevel: cart.bundleRiskLevel,
        highestRiskDriver: cart.highestRiskDriver,
        bundleRiskSummary: cart.bundleRiskSummary,
        cartId: cart.id,
        currency: input.payment.currency.toUpperCase(),
        paidAt: new Date(),
        paymentProvider: input.payment.paymentProvider,
        paymentReference: input.payment.paymentReference,
        status: 'paid',
        updatedAt: new Date(),
        userId: input.userId,
      })
      .returning()

    await tx.insert(orderItems).values(
      saleRows.map((row) => ({
        id: crypto.randomUUID(),
        agentId: row.agent.id,
        agentVersionId: row.version.id,
        orderId: order.id,
        priceCents: row.agent.priceCents,
      })),
    )

    await tx.insert(runChannelConfigs).values({
      id: crypto.randomUUID(),
      orderId: order.id,
      channelType: 'telegram',
      botTokenSecretRef: null,
      tokenStatus: 'pending',
      recipientBindingStatus: 'pending',
      recipientExternalId: null,
      appliesToScope: 'run',
      updatedAt: new Date(),
    })

    await tx
      .update(carts)
      .set({
        status: 'converted',
        updatedAt: new Date(),
        userId: input.userId,
      })
      .where(eq(carts.id, cart.id))

    return order.id
  })

  return getOrderByIdForUser({
    orderId,
    userId: input.userId,
  })
}

export async function getSignedDownloadsForOrder(input: {
  baseUrl: string
  orderId: string
  userId: string
}) {
  const order = await getOrderByIdForUser({
    orderId: input.orderId,
    userId: input.userId,
  })

  assertPaidOrder(order)

  const expiresAt = new Date(Date.now() + DOWNLOAD_TTL_MS)

  return {
    orderId: order.id,
    downloads: order.items.map((item) => ({
      agentId: item.agent.id,
      agentSlug: item.agent.slug,
      agentTitle: item.agent.title,
      orderItemId: item.id,
      ...buildDownloadGrant({
        baseUrl: input.baseUrl,
        expiresAt,
        orderId: order.id,
        orderItemId: item.id,
      }),
      })),
  }
}

export type OrderService = {
  createPaidOrderFromCart: typeof createPaidOrderFromCart
  getOrderByIdForUser: typeof getOrderByIdForUser
  getOrderProviderApiKeysForUser?: typeof getOrderProviderApiKeysForUser
  getSignedDownloadsForOrder: typeof getSignedDownloadsForOrder
  listOrdersForUser: typeof listOrdersForUser
  resolveSignedDownload: typeof resolveSignedDownload
  updateOrderAgentSetupForUser: typeof updateOrderAgentSetupForUser
}

let orderServiceOverride: OrderService | null = null

export function getOrderService(): OrderService {
  if (orderServiceOverride) {
    return orderServiceOverride
  }

  return {
    createPaidOrderFromCart,
    getOrderByIdForUser,
    getOrderProviderApiKeysForUser,
    getSignedDownloadsForOrder,
    listOrdersForUser,
    resolveSignedDownload,
    updateOrderAgentSetupForUser,
  }
}

export function setOrderServiceForTesting(service: OrderService | null) {
  orderServiceOverride = service
}

export async function resolveSignedDownload(input: {
  orderId: string
  orderItemId: string
}) {
  const base = await loadOrderBase({
    orderId: input.orderId,
  })

  if (!base) {
    throw new HttpError(404, 'Order not found.')
  }

  assertPaidOrder(base.order)

  const items = await loadOrderItems(base.order.id)
  const item = items.find((entry) => entry.orderItem.id === input.orderItemId)

  if (!item) {
    throw new HttpError(404, 'Order item not found.')
  }

  return item.version.installPackageUrl
}
