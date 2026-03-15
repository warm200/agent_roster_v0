import type { SubscriptionPlan, UserSubscription } from '@/lib/types'

import { getJson, postJson } from './api'

type CurrentSubscriptionResponse = {
  plan: SubscriptionPlan
  subscription: UserSubscription | null
}

type PricingPlansResponse = {
  plans: SubscriptionPlan[]
}

type SubscriptionCheckoutSessionResponse = {
  sessionId: string
  sessionUrl: string
}

type ReconcileSubscriptionResponse = {
  subscription: UserSubscription
}

export async function getCurrentSubscription() {
  return getJson<CurrentSubscriptionResponse>('/api/me/subscription')
}

export async function listPricingPlans() {
  return getJson<PricingPlansResponse>('/api/pricing/plans')
}

export async function createSubscriptionCheckoutSession(input: {
  email?: string | null
  planId: string
  returnPath: string
}) {
  return postJson<SubscriptionCheckoutSessionResponse, typeof input>(
    '/api/me/subscription/checkout/session',
    input,
  )
}

export async function reconcileSubscriptionCheckoutSession(sessionId: string) {
  return postJson<ReconcileSubscriptionResponse>(
    `/api/me/subscription/checkout/session/${encodeURIComponent(sessionId)}`,
  )
}
