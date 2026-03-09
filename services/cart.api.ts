import type { Cart } from '@/lib/types'

import { deleteJson, postJson, putJson } from './api'

type CartResponse = {
  cart: Cart
}

export async function syncCart(agentIds: string[]) {
  return putJson<Cart, { agentIds: string[] }>('/api/cart', { agentIds })
}

export async function addCartItem(agentId: string) {
  return postJson<CartResponse, { agentId: string }>('/api/cart/items', { agentId })
}

export async function removeCartItem(itemId: string) {
  return deleteJson<CartResponse>(`/api/cart/items/${itemId}`)
}
