import type { CheckoutSession, Order } from '@/lib/types'

import { postJson } from './api'

export async function createCheckoutSession() {
  return postJson<CheckoutSession>('/api/checkout/session')
}

export async function reconcileCheckoutSession(sessionId: string) {
  return postJson<Order>(`/api/checkout/session/${sessionId}`)
}
