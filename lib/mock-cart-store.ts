import { calculateBundleRisk, mockAgents } from '@/lib/mock-data'
import type { Agent, Cart, CartItem } from '@/lib/types'

const now = () => new Date().toISOString()

const cartState: Cart = {
  id: 'cart-1',
  userId: null,
  status: 'active',
  items: [],
  bundleRisk: { level: 'low', highestRiskDriver: null, summary: 'No agents selected' },
  totalCents: 0,
  currency: 'USD',
  createdAt: now(),
  updatedAt: now(),
}

function rebuildCart() {
  const agents = cartState.items.map((item) => item.agent)
  cartState.bundleRisk = calculateBundleRisk(agents)
  cartState.totalCents = cartState.items.reduce((sum, item) => sum + item.agent.priceCents, 0)
  cartState.updatedAt = now()
}

export function getMockCart(): Cart {
  return structuredClone(cartState)
}

export function addMockCartItem(agentId: string): CartItem | null {
  const existing = cartState.items.find((item) => item.agent.id === agentId)
  if (existing) {
    return existing
  }

  const agent = mockAgents.find((item) => item.id === agentId)
  if (!agent) {
    return null
  }

  const item: CartItem = {
    id: `cart-item-${Date.now()}`,
    cartId: cartState.id,
    agent,
    agentVersion: agent.currentVersion,
    createdAt: now(),
  }

  cartState.items.push(item)
  rebuildCart()

  return item
}

export function removeMockCartItem(itemId: string): boolean {
  const nextItems = cartState.items.filter((item) => item.id !== itemId)

  if (nextItems.length === cartState.items.length) {
    return false
  }

  cartState.items = nextItems
  rebuildCart()
  return true
}

export function replaceMockCartItems(agents: Agent[]) {
  cartState.items = agents.map((agent, index) => ({
    id: `cart-item-sync-${index}-${agent.id}`,
    cartId: cartState.id,
    agent,
    agentVersion: agent.currentVersion,
    createdAt: now(),
  }))
  rebuildCart()
}

export function clearMockCart() {
  cartState.items = []
  rebuildCart()
}
