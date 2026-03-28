import type { AdminRuntimeGrant, SubscriptionPlan, UserSubscription } from '@/lib/types'

import { getJson, postJson } from './api'

type CurrentSubscriptionResponse = {
  availableCredits: number
  effectivePlan: SubscriptionPlan
  plan: SubscriptionPlan
  runtimeGrant: AdminRuntimeGrant | null
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

export async function createCreditTopUpCheckoutSession(input: {
  email?: string | null
  returnPath: string
  topUpPackId: string
}) {
  return postJson<SubscriptionCheckoutSessionResponse, typeof input>(
    '/api/me/subscription/top-up/checkout/session',
    input,
  )
}

export async function reconcileSubscriptionCheckoutSession(sessionId: string) {
  return postJson<ReconcileSubscriptionResponse>(
    `/api/me/subscription/checkout/session/${encodeURIComponent(sessionId)}`,
  )
}

export async function reconcileCreditTopUpCheckoutSession(sessionId: string) {
  return postJson<ReconcileSubscriptionResponse>(
    `/api/me/subscription/top-up/checkout/session/${encodeURIComponent(sessionId)}`,
  )
}

type BillingPortalResponse = {
  portalUrl: string
}

export async function createBillingPortalSession() {
  return postJson<BillingPortalResponse>('/api/me/subscription/portal')
}
