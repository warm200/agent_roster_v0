import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'

import { NextRequest } from 'next/server'

import { POST as createSubscriptionCheckoutSession } from '@/app/api/me/subscription/checkout/session/route'
import { POST as reconcileSubscriptionCheckoutSession } from '@/app/api/me/subscription/checkout/session/[sessionId]/route'
import { POST as createTopUpCheckoutSession } from '@/app/api/me/subscription/top-up/checkout/session/route'
import { POST as reconcileTopUpCheckoutSession } from '@/app/api/me/subscription/top-up/checkout/session/[sessionId]/route'
import { GET as getLaunchPolicy } from '@/app/api/me/orders/[orderId]/launch-policy/route'
import { GET as getCurrentSubscription } from '@/app/api/me/subscription/route'
import { GET as getPricingPlans } from '@/app/api/pricing/plans/route'
import { getFreeSubscriptionPlan, getSubscriptionPlan } from '@/lib/subscription-plans'
import { HttpError } from '@/server/lib/http'
import { setRequestUserIdForTesting } from '@/server/lib/request-user'
import { setOrderServiceForTesting, type OrderService } from '@/server/services/order.service'
import { setRunServiceForTesting } from '@/server/services/run.service'
import {
  setSubscriptionServiceForTesting,
  type SubscriptionServiceLike,
} from '@/server/services/subscription.service'

const order = {
  id: 'order-test-1',
  userId: 'user-1',
  cartId: 'cart-1',
  paymentProvider: 'free',
  paymentReference: 'free:cart-1',
  amountCents: 0,
  currency: 'USD',
  status: 'paid',
  items: [],
  channelConfig: null,
  bundleRisk: {
    level: 'low',
    highestRiskDriver: null,
    summary: 'low',
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  paidAt: new Date().toISOString(),
}

const stubOrderService = {
  async createPaidOrderFromCart() {
    throw new Error('not implemented')
  },
  async getOrderByIdForUser() {
    return order as never
  },
  async getOrderProviderApiKeysForUser() {
    return {}
  },
  async getSignedDownloadsForOrder() {
    throw new Error('not implemented')
  },
  async listOrdersForUser() {
    return []
  },
  async resolveSignedDownload() {
    throw new Error('not implemented')
  },
  async updateOrderAgentSetupForUser() {
    throw new Error('not implemented')
  },
} satisfies OrderService

function createSubscriptionServiceStub(
  overrides: Partial<SubscriptionServiceLike> = {},
): SubscriptionServiceLike {
  return {
    async createBillingPortalSession() {
      throw new Error('not implemented')
    },
    async commitReservedLaunchCredit() {
      return null
    },
    async createCheckoutSession() {
      throw new Error('not implemented')
    },
    async createTopUpCheckoutSession() {
      throw new Error('not implemented')
    },
    async refundReservedLaunchCredit() {
      return null
    },
    async reserveLaunchCredit() {
      return null
    },
    async getCurrentSubscription() {
      return null
    },
    async getLaunchPolicy() {
      throw new Error('not implemented')
    },
    async handleStripeCheckoutCompletedSession() {
      throw new Error('not implemented')
    },
    async handleStripeSubscriptionDeleted() {
      throw new Error('not implemented')
    },
    listPlans: () => [getFreeSubscriptionPlan(), getSubscriptionPlan('run')],
    listTopUpPacks: () => [],
    async reconcileCheckoutSession() {
      throw new Error('not implemented')
    },
    async syncSubscriptionFromStripe() {},
    ...overrides,
  }
}

afterEach(() => {
  setRequestUserIdForTesting(null)
  setOrderServiceForTesting(null)
  setRunServiceForTesting(null)
  setSubscriptionServiceForTesting(null)
})

test('pricing plans route returns the shared subscription plan catalog', async () => {
  const response = await getPricingPlans()
  const payload = await response.json()

  assert.equal(response.status, 200)
  assert.equal(payload.plans.length, 4)
  assert.equal(payload.plans[0].id, 'free')
  assert.equal(payload.plans[2].id, 'warm_standby')
})

test('me subscription route returns free plan when user has no active subscription row', async () => {
  setRequestUserIdForTesting(() => 'user-1')
  setSubscriptionServiceForTesting(createSubscriptionServiceStub({
    async getCurrentSubscription() {
      return null
    },
  }))

  const response = await getCurrentSubscription(new NextRequest('http://localhost/api/me/subscription'))
  const payload = await response.json()

  assert.equal(response.status, 200)
  assert.equal(payload.plan.id, 'free')
  assert.equal(payload.subscription, null)
})

test('launch policy route returns plan blockers for the selected order', async () => {
  const calls: string[] = []
  setRequestUserIdForTesting(() => 'user-1')
  setOrderServiceForTesting(stubOrderService)
  setRunServiceForTesting({
    async reconcileRunsForUser(userId: string) {
      calls.push(`run.reconcile:${userId}`)
      return []
    },
  } as never)
  setSubscriptionServiceForTesting(createSubscriptionServiceStub({
    async getLaunchPolicy() {
      return {
        allowed: false,
        blockers: ['Run allows at most 3 agents per launched bundle.'],
        plan: getSubscriptionPlan('run'),
        subscription: null,
        usage: {
          activeBundles: 0,
          activeRunIds: [],
          concurrentRuns: 0,
        },
      }
    },
  }))

  const response = await getLaunchPolicy(
    new NextRequest('http://localhost/api/me/orders/order-test-1/launch-policy'),
    {
      params: Promise.resolve({ orderId: 'order-test-1' }),
    },
  )
  const payload = await response.json()

  assert.equal(response.status, 200)
  assert.equal(payload.allowed, false)
  assert.match(payload.blockers[0] ?? '', /at most 3 agents/i)
  assert.equal(payload.plan.id, 'run')
  assert.deepEqual(calls, ['run.reconcile:user-1'])
})

test('subscription checkout session route forwards plan payload to service', async () => {
  let received:
    | {
        origin: string
        planId: string
        returnPath: string
        userEmail?: string | null
        userId: string
      }
    | undefined

  setRequestUserIdForTesting(() => 'user-1')
  setSubscriptionServiceForTesting(createSubscriptionServiceStub({
    async createCheckoutSession(input) {
      received = input
      return {
        sessionId: 'cs_sub_plan_1',
        sessionUrl: 'https://checkout.stripe.com/c/session/subscription-plan-1',
      }
    },
  }))

  const response = await createSubscriptionCheckoutSession(
    new NextRequest('http://localhost/api/me/subscription/checkout/session', {
      body: JSON.stringify({
        email: 'buyer@example.com',
        planId: 'warm_standby',
        returnPath: '/app/bundles/order-1',
      }),
      method: 'POST',
    }),
  )
  const payload = await response.json()

  assert.equal(response.status, 201)
  assert.deepEqual(received, {
    origin: 'http://localhost',
    planId: 'warm_standby',
    returnPath: '/app/bundles/order-1',
    userEmail: 'buyer@example.com',
    userId: 'user-1',
  })
  assert.equal(payload.sessionId, 'cs_sub_plan_1')
})

test('subscription checkout reconcile route returns the updated subscription', async () => {
  let received:
    | {
        sessionId: string
        userId: string
      }
    | undefined

  setRequestUserIdForTesting(() => 'user-1')
  setSubscriptionServiceForTesting(createSubscriptionServiceStub({
    async reconcileCheckoutSession(input) {
      received = input

      return {
        id: 'subscription-1',
        userId: 'user-1',
        planId: 'run',
        planVersion: 'v1',
        status: 'active',
        billingInterval: 'one_time',
        includedCredits: 15,
        remainingCredits: 15,
        priceCents: 500,
        currency: 'USD',
        stripeCustomerId: 'cus_123',
        stripePriceId: null,
        stripeSubscriptionId: null,
        stripeCheckoutSessionId: 'cs_sub_123',
        currentPeriodStart: null,
        currentPeriodEnd: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    },
  }))

  const response = await reconcileSubscriptionCheckoutSession(
    new NextRequest('http://localhost/api/me/subscription/checkout/session/cs_sub_123', {
      method: 'POST',
    }),
    {
      params: Promise.resolve({ sessionId: 'cs_sub_123' }),
    },
  )
  const payload = await response.json()

  assert.equal(response.status, 200)
  assert.deepEqual(received, {
    sessionId: 'cs_sub_123',
    userId: 'user-1',
  })
  assert.equal(payload.subscription.planId, 'run')
  assert.equal(payload.subscription.remainingCredits, 15)
})

test('subscription checkout session route preserves service errors', async () => {
  setRequestUserIdForTesting(() => 'user-1')
  setSubscriptionServiceForTesting(createSubscriptionServiceStub({
    async createCheckoutSession() {
      throw new HttpError(400, 'Free does not require checkout.')
    },
    listPlans: () => [getFreeSubscriptionPlan()],
  }))

  const response = await createSubscriptionCheckoutSession(
    new NextRequest('http://localhost/api/me/subscription/checkout/session', {
      body: JSON.stringify({
        planId: 'free',
        returnPath: '/app/bundles/order-1',
      }),
      method: 'POST',
    }),
  )
  const payload = await response.json()

  assert.equal(response.status, 400)
  assert.equal(payload.error, 'Free does not require checkout.')
})

test('top-up checkout session route forwards pack payload to service', async () => {
  let received:
    | {
        origin: string
        returnPath: string
        topUpPackId: string
        userEmail?: string | null
        userId: string
      }
    | undefined

  setRequestUserIdForTesting(() => 'user-1')
  setSubscriptionServiceForTesting(createSubscriptionServiceStub({
    async createTopUpCheckoutSession(input) {
      received = input
      return {
        sessionId: 'cs_topup_1',
        sessionUrl: 'https://checkout.stripe.com/c/session/top-up-1',
      }
    },
  }))

  const response = await createTopUpCheckoutSession(
    new NextRequest('http://localhost/api/me/subscription/top-up/checkout/session', {
      body: JSON.stringify({
        email: 'buyer@example.com',
        returnPath: '/app/bundles/order-1',
        topUpPackId: 'builder_pack',
      }),
      method: 'POST',
    }),
  )
  const payload = await response.json()

  assert.equal(response.status, 201)
  assert.deepEqual(received, {
    origin: 'http://localhost',
    returnPath: '/app/bundles/order-1',
    topUpPackId: 'builder_pack',
    userEmail: 'buyer@example.com',
    userId: 'user-1',
  })
  assert.equal(payload.sessionId, 'cs_topup_1')
})

test('top-up checkout reconcile route returns the updated subscription', async () => {
  let received:
    | {
        sessionId: string
        userId: string
      }
    | undefined

  setRequestUserIdForTesting(() => 'user-1')
  setSubscriptionServiceForTesting(createSubscriptionServiceStub({
    async reconcileCheckoutSession(input) {
      received = input
      return {
        id: 'subscription-1',
        userId: 'user-1',
        planId: 'warm_standby',
        planVersion: 'v1',
        status: 'active',
        billingInterval: 'month',
        includedCredits: 10,
        remainingCredits: 34,
        priceCents: 1900,
        currency: 'USD',
        stripeCustomerId: 'cus_123',
        stripePriceId: null,
        stripeSubscriptionId: 'sub_123',
        stripeCheckoutSessionId: 'cs_topup_123',
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    },
  }))

  const response = await reconcileTopUpCheckoutSession(
    new NextRequest('http://localhost/api/me/subscription/top-up/checkout/session/cs_topup_123', {
      method: 'POST',
    }),
    {
      params: Promise.resolve({ sessionId: 'cs_topup_123' }),
    },
  )
  const payload = await response.json()

  assert.equal(response.status, 200)
  assert.deepEqual(received, {
    sessionId: 'cs_topup_123',
    userId: 'user-1',
  })
  assert.equal(payload.subscription.remainingCredits, 34)
})
