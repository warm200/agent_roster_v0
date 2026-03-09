'use client'

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import type { Agent, CartItem, BundleRisk } from './types'
import { calculateBundleRisk } from './mock-data'

const CART_STORAGE_KEY = 'agent-roster-cart:v1'

interface CartContextType {
  items: CartItem[]
  bundleRisk: BundleRisk
  totalCents: number
  addItem: (agent: Agent) => void
  removeItem: (itemId: string) => void
  clearCart: () => void
  isInCart: (agentId: string) => boolean
}

const CartContext = createContext<CartContextType | undefined>(undefined)

function readStoredCartItems(): CartItem[] {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY)

    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw)

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter(
      (item): item is CartItem =>
        Boolean(
          item &&
            typeof item === 'object' &&
            typeof item.id === 'string' &&
            item.agent &&
            typeof item.agent.id === 'string' &&
            item.agentVersion &&
            typeof item.agentVersion.id === 'string'
        )
    )
  } catch {
    return []
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [hasLoadedStorage, setHasLoadedStorage] = useState(false)

  useEffect(() => {
    setItems(readStoredCartItems())
    setHasLoadedStorage(true)
  }, [])

  useEffect(() => {
    if (!hasLoadedStorage || typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items))
  }, [hasLoadedStorage, items])

  const addItem = useCallback((agent: Agent) => {
    setItems((prev) => {
      // Don't add duplicates
      if (prev.some((item) => item.agent.id === agent.id)) {
        return prev
      }

      const newItem: CartItem = {
        id: `cart-item-${Date.now()}`,
        cartId: 'cart-1',
        agent,
        agentVersion: agent.currentVersion,
        createdAt: new Date().toISOString(),
      }

      return [...prev, newItem]
    })
  }, [])

  const removeItem = useCallback((itemId: string) => {
    setItems((prev) => prev.filter((item) => item.id !== itemId))
  }, [])

  const clearCart = useCallback(() => {
    setItems([])
  }, [])

  const isInCart = useCallback(
    (agentId: string) => {
      return items.some((item) => item.agent.id === agentId)
    },
    [items]
  )

  const agents = items.map((item) => item.agent)
  const bundleRisk = calculateBundleRisk(agents)
  const totalCents = items.reduce((sum, item) => sum + item.agent.priceCents, 0)

  return (
    <CartContext.Provider
      value={{
        items,
        bundleRisk,
        totalCents,
        addItem,
        removeItem,
        clearCart,
        isInCart,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return context
}
