'use client'

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import type { Agent, BundleRisk, Cart, CartItem } from './types'
import { calculateBundleRisk } from './mock-data'
import { trackFirstCollectionOnce } from '@/lib/analytics'
import { addCartItem, removeCartItem, syncCart as syncCartItems } from '@/services/cart.api'

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

function isCart(value: unknown): value is Cart {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'items' in value &&
      Array.isArray((value as Cart).items)
  )
}

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
    let isMounted = true
    const storedItems = readStoredCartItems()
    setItems(storedItems)
    setHasLoadedStorage(true)

    async function syncCart() {
      try {
        const payload = await syncCartItems(storedItems.map((item) => item.agent.id))

        if (!isCart(payload)) {
          return
        }

        if (isMounted) {
          setItems(payload.items)
        }
      } catch {
        // Keep local cart state if mock API sync fails.
      }
    }

    void syncCart()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!hasLoadedStorage || typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items))
  }, [hasLoadedStorage, items])

  const addItem = useCallback((agent: Agent) => {
    let shouldTrackFirstCollection = false

    setItems((prev) => {
      // Don't add duplicates
      if (prev.some((item) => item.agent.id === agent.id)) {
        return prev
      }

      shouldTrackFirstCollection = prev.length === 0

      const newItem: CartItem = {
        id: `cart-item-${Date.now()}`,
        cartId: 'cart-1',
        agent,
        agentVersion: agent.currentVersion,
        createdAt: new Date().toISOString(),
      }

      return [...prev, newItem]
    })

    if (shouldTrackFirstCollection) {
      trackFirstCollectionOnce(agent)
    }

    void (async () => {
      try {
        const payload = await addCartItem(agent.id)

        if (!isCart(payload.cart)) {
          return
        }

        setItems(payload.cart.items)
      } catch {
        // Keep optimistic local state if mock API sync fails.
      }
    })()
  }, [])

  const removeItem = useCallback((itemId: string) => {
    setItems((prev) => prev.filter((item) => item.id !== itemId))

    void (async () => {
      try {
        const payload = await removeCartItem(itemId)

        if (!isCart(payload.cart)) {
          return
        }

        setItems(payload.cart.items)
      } catch {
        // Keep optimistic local state if mock API sync fails.
      }
    })()
  }, [])

  const clearCart = useCallback(() => {
    setItems([])

    void (async () => {
      try {
        const payload = await syncCartItems([])

        if (!isCart(payload)) {
          return
        }

        setItems(payload.items)
      } catch {
        // Keep optimistic local state if mock API sync fails.
      }
    })()
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
