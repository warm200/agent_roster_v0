import { createHmac, timingSafeEqual } from 'node:crypto'

import { and, desc, eq } from 'drizzle-orm'

import { createDb, type DbClient } from '../db'
import { agents, agentVersions, cartItems, carts, orderItems, orders, riskProfiles, runChannelConfigs } from '../db/schema'
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
