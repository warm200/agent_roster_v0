import { and, desc, eq } from 'drizzle-orm'

import type { Cart, CartItem } from '@/lib/types'

import { createDb, type DbClient } from '../db'
import { agents, agentVersions, cartItems, carts, riskProfiles } from '../db/schema'
import { calculateBundleRiskFromAgents } from '../lib/risk-engine'
import { HttpError } from '../lib/http'
import {
  buildAgentSnapshot,
  buildCartSnapshot,
  buildCartItemSnapshot,
  type CartItemRow,
  type SaleRow,
} from './commerce.utils'

export const CART_COOKIE_NAME = 'agent_roster_cart_id'

type CartContext = {
  cartId?: string | null
  userId?: string | null
}

type ActiveCartResult = {
  cart: Cart
  cookieCartId: string
}

let dbClient: DbClient | null = null

async function findActiveCartById(cartId: string) {
  const db = getDb()
  const [cart] = await db
    .select()
    .from(carts)
    .where(and(eq(carts.id, cartId), eq(carts.status, 'active')))
    .limit(1)

  return cart ?? null
}

async function findActiveCartByUserId(userId: string) {
  const db = getDb()
  const [cart] = await db
    .select()
    .from(carts)
    .where(and(eq(carts.userId, userId), eq(carts.status, 'active')))
    .limit(1)

  return cart ?? null
}

async function createCart(userId: string | null) {
  const db = getDb()
  const [cart] = await db
    .insert(carts)
    .values({
      id: crypto.randomUUID(),
      userId,
      status: 'active',
      bundleRiskLevel: 'low',
      highestRiskDriver: null,
      bundleRiskSummary: 'No agents selected',
      totalCents: 0,
      currency: 'USD',
    })
    .returning()

  return cart
}

async function loadCartRows(cartId: string): Promise<CartItemRow[]> {
  const db = getDb()
  return db
    .select({
      agent: agents,
      cart: carts,
      cartItem: cartItems,
      riskProfile: riskProfiles,
      version: agentVersions,
    })
    .from(cartItems)
    .innerJoin(carts, eq(cartItems.cartId, carts.id))
    .innerJoin(agents, eq(cartItems.agentId, agents.id))
    .innerJoin(agentVersions, eq(cartItems.agentVersionId, agentVersions.id))
    .innerJoin(riskProfiles, eq(riskProfiles.agentVersionId, agentVersions.id))
    .where(eq(cartItems.cartId, cartId))
}

async function loadSaleRowForAgent(agentId: string): Promise<SaleRow | null> {
  const db = getDb()
  const [row] = await db
    .select({
      agent: agents,
      riskProfile: riskProfiles,
      version: agentVersions,
    })
    .from(agents)
    .innerJoin(agentVersions, eq(agentVersions.agentId, agents.id))
    .innerJoin(riskProfiles, eq(riskProfiles.agentVersionId, agentVersions.id))
    .where(and(eq(agents.id, agentId), eq(agents.status, 'active')))
    .orderBy(desc(agentVersions.createdAt))
    .limit(1)

  return row ?? null
}

async function syncCartSummary(cartId: string) {
  const db = getDb()
  const rows = await loadCartRows(cartId)
  const cartAgents = rows.map(buildAgentSnapshot)
  const bundleRisk = calculateBundleRiskFromAgents(cartAgents)
  const totalCents = rows.reduce((total, row) => total + row.agent.priceCents, 0)

  const [updatedCart] = await db
    .update(carts)
    .set({
      bundleRiskLevel: bundleRisk.level,
      highestRiskDriver: bundleRisk.highestRiskDriver,
      bundleRiskSummary: bundleRisk.summary,
      totalCents,
      updatedAt: new Date(),
    })
    .where(eq(carts.id, cartId))
    .returning()

  if (!updatedCart) {
    throw new HttpError(404, 'Cart not found.')
  }

  return {
    cart: updatedCart,
    rows,
  }
}

async function resolveActiveCart(context: CartContext) {
  const cookieCart = context.cartId ? await findActiveCartById(context.cartId) : null

  if (context.userId) {
    const userCart = await findActiveCartByUserId(context.userId)

    if (userCart) {
      return userCart
    }

    if (cookieCart) {
      if (cookieCart.userId && cookieCart.userId !== context.userId) {
        throw new HttpError(403, 'Cart belongs to another user.')
      }

      const db = getDb()
      const [claimedCart] = await db
        .update(carts)
        .set({
          updatedAt: new Date(),
          userId: context.userId,
        })
        .where(eq(carts.id, cookieCart.id))
        .returning()

      if (!claimedCart) {
        throw new HttpError(404, 'Cart not found.')
      }

      return claimedCart
    }

    return createCart(context.userId)
  }

  if (cookieCart) {
    return cookieCart
  }

  return createCart(null)
}

export async function getActiveCart(context: CartContext = {}) {
  const cart = await resolveActiveCart(context)
  const { cart: syncedCart, rows } = await syncCartSummary(cart.id)
  return buildCartSnapshot(syncedCart, rows)
}

export async function getActiveCartWithCookie(context: CartContext = {}) {
  const cart = await getActiveCart(context)
  return {
    cart,
    cookieCartId: cart.id,
  } satisfies ActiveCartResult
}

export async function addItemToCart(input: CartContext & { agentId: string }) {
  const cart = await resolveActiveCart(input)
  const saleRow = await loadSaleRowForAgent(input.agentId)

  if (!saleRow) {
    throw new HttpError(404, 'Agent not found or unavailable.')
  }

  const db = getDb()
  const [existing] = await db
    .select()
    .from(cartItems)
    .where(and(eq(cartItems.cartId, cart.id), eq(cartItems.agentId, input.agentId)))
    .limit(1)

  if (!existing) {
    await db.insert(cartItems).values({
      id: crypto.randomUUID(),
      cartId: cart.id,
      agentId: saleRow.agent.id,
      agentVersionId: saleRow.version.id,
    })
  }

  const { rows } = await syncCartSummary(cart.id)
  const cartItemRow = rows.find((row) => row.agent.id === input.agentId) ?? null

  if (!cartItemRow) {
    throw new HttpError(500, 'Failed to load cart item.')
  }

  return {
    cartItem: buildCartItemSnapshot(cartItemRow),
    cookieCartId: cart.id,
  } satisfies {
    cartItem: CartItem
    cookieCartId: string
  }
}

export async function removeCartItem(input: CartContext & { cartItemId: string }) {
  const cart = await resolveActiveCart(input)
  const db = getDb()
  const [item] = await db
    .select()
    .from(cartItems)
    .where(and(eq(cartItems.id, input.cartItemId), eq(cartItems.cartId, cart.id)))
    .limit(1)

  if (!item) {
    throw new HttpError(404, 'Cart item not found.')
  }

  await db.delete(cartItems).where(eq(cartItems.id, item.id))
  const { cart: syncedCart, rows } = await syncCartSummary(cart.id)
  return buildCartSnapshot(syncedCart, rows)
}

export async function replaceCartItems(input: CartContext & { agentIds: string[] }) {
  const cart = await resolveActiveCart(input)
  const db = getDb()
  const desiredAgentIds = [...new Set(input.agentIds)]
  const currentRows = await loadCartRows(cart.id)

  for (const row of currentRows) {
    if (!desiredAgentIds.includes(row.agent.id)) {
      await db.delete(cartItems).where(eq(cartItems.id, row.cartItem.id))
    }
  }

  const remainingRows = await loadCartRows(cart.id)
  const remainingAgentIds = new Set(remainingRows.map((row) => row.agent.id))

  for (const agentId of desiredAgentIds) {
    if (remainingAgentIds.has(agentId)) {
      continue
    }

    const saleRow = await loadSaleRowForAgent(agentId)

    if (!saleRow) {
      continue
    }

    await db.insert(cartItems).values({
      id: crypto.randomUUID(),
      cartId: cart.id,
      agentId: saleRow.agent.id,
      agentVersionId: saleRow.version.id,
    })
  }

  const { cart: syncedCart, rows } = await syncCartSummary(cart.id)

  return {
    cart: buildCartSnapshot(syncedCart, rows),
    cookieCartId: cart.id,
  } satisfies ActiveCartResult
}

function getDb() {
  dbClient ??= createDb()
  return dbClient
}
