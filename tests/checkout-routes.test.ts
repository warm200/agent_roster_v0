import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'

import { NextRequest } from 'next/server'

import { POST as createSession } from '@/app/api/checkout/session/route'
import { POST as reconcileSession } from '@/app/api/checkout/session/[sessionId]/route'
import { POST as stripeWebhook } from '@/app/api/webhooks/stripe/route'
import { HttpError } from '@/server/lib/http'
import { setRequestUserIdForTesting } from '@/server/lib/request-user'
import {
  setCheckoutServiceForTesting,
  type CheckoutService,
} from '@/server/services/checkout.service'

const order = {
  id: 'order-test-1',
}

afterEach(() => {
  delete process.env.GITHUB_CLIENT_ID
  delete process.env.GITHUB_CLIENT_SECRET
  delete process.env.AUTH_SECRET
  setRequestUserIdForTesting(null)
  setCheckoutServiceForTesting(null)
})

test('checkout session route forwards cart payload to checkout service', async () => {
  let received:
    | {
        cartId: string
        origin: string
        userEmail?: string | null
        userId?: string | null
      }
    | undefined

  setCheckoutServiceForTesting({
    async createCheckoutSession(input) {
      received = input

      return {
        sessionId: 'cs_test_123',
        sessionUrl: 'https://checkout.stripe.com/c/session/test',
      }
    },
    async handleStripeWebhookEvent() {
      return { received: true, type: 'checkout.session.completed' as const }
    },
    async reconcileCheckoutSession() {
      return order as never
    },
  } satisfies CheckoutService)

  const request = new NextRequest('http://localhost/api/checkout/session', {
    body: JSON.stringify({
      cartId: 'cart-test-1',
      email: 'buyer@example.com',
      userId: 'user-test-1',
    }),
    method: 'POST',
  })

  const response = await createSession(request)
  const payload = await response.json()

  assert.equal(response.status, 201)
  assert.deepEqual(received, {
    cartId: 'cart-test-1',
    origin: 'http://localhost',
    userEmail: 'buyer@example.com',
    userId: 'user-test-1',
  })
  assert.equal(payload.sessionId, 'cs_test_123')
})

test('checkout session route returns local success redirect for free carts', async () => {
  setCheckoutServiceForTesting({
    async createCheckoutSession() {
      return {
        sessionId: 'order-free-1',
        sessionUrl: 'http://localhost/checkout/success?orderId=order-free-1',
      }
    },
    async handleStripeWebhookEvent() {
      return { received: true, type: 'checkout.session.completed' as const }
    },
    async reconcileCheckoutSession() {
      return order as never
    },
  } satisfies CheckoutService)

  const response = await createSession(
    new NextRequest('http://localhost/api/checkout/session', {
      body: JSON.stringify({
        cartId: 'cart-free-1',
        userId: 'user-free-1',
      }),
      method: 'POST',
    }),
  )
  const payload = await response.json()

  assert.equal(response.status, 201)
  assert.equal(payload.sessionId, 'order-free-1')
  assert.equal(payload.sessionUrl, 'http://localhost/checkout/success?orderId=order-free-1')
})

test('checkout session route requires auth when oauth is configured', async () => {
  process.env.GITHUB_CLIENT_ID = 'github-client'
  process.env.GITHUB_CLIENT_SECRET = 'github-secret'
  process.env.AUTH_SECRET = 'auth-secret'

  setCheckoutServiceForTesting({
    async createCheckoutSession() {
      throw new Error('should not be called')
    },
    async handleStripeWebhookEvent() {
      return { received: true, type: 'checkout.session.completed' as const }
    },
    async reconcileCheckoutSession() {
      return order as never
    },
  } satisfies CheckoutService)

  const response = await createSession(
    new NextRequest('http://localhost/api/checkout/session', {
      body: JSON.stringify({
        cartId: 'cart-test-1',
      }),
      method: 'POST',
    }),
  )
  const payload = await response.json()

  assert.equal(response.status, 401)
  assert.equal(payload.error, 'Authentication required.')
})

test('checkout session route uses authenticated user when oauth is configured', async () => {
  process.env.GITHUB_CLIENT_ID = 'github-client'
  process.env.GITHUB_CLIENT_SECRET = 'github-secret'
  process.env.AUTH_SECRET = 'auth-secret'

  let received:
    | {
        cartId: string
        origin: string
        userEmail?: string | null
        userId?: string | null
      }
    | undefined

  setRequestUserIdForTesting(() => 'user-auth-1')
  setCheckoutServiceForTesting({
    async createCheckoutSession(input) {
      received = input

      return {
        sessionId: 'cs_test_auth_123',
        sessionUrl: 'https://checkout.stripe.com/c/session/test-auth',
      }
    },
    async handleStripeWebhookEvent() {
      return { received: true, type: 'checkout.session.completed' as const }
    },
    async reconcileCheckoutSession() {
      return order as never
    },
  } satisfies CheckoutService)

  const response = await createSession(
    new NextRequest('http://localhost/api/checkout/session', {
      body: JSON.stringify({
        cartId: 'cart-test-1',
        userId: 'forged-user',
      }),
      method: 'POST',
    }),
  )
  const payload = await response.json()

  assert.equal(response.status, 201)
  assert.deepEqual(received, {
    cartId: 'cart-test-1',
    origin: 'http://localhost',
    userEmail: null,
    userId: 'user-auth-1',
  })
  assert.equal(payload.sessionId, 'cs_test_auth_123')
})

test('checkout session reconcile route forwards authenticated user to service', async () => {
  let received:
    | {
        sessionId: string
        userId: string
      }
    | undefined

  setRequestUserIdForTesting(() => 'user-test-1')
  setCheckoutServiceForTesting({
    async createCheckoutSession() {
      return {
        sessionId: 'unused',
        sessionUrl: 'https://example.com',
      }
    },
    async handleStripeWebhookEvent() {
      return { received: true, type: 'checkout.session.completed' as const }
    },
    async reconcileCheckoutSession(input) {
      received = input
      return order as never
    },
  } satisfies CheckoutService)

  const request = new NextRequest('http://localhost/api/checkout/session/cs_test_123', {
    method: 'POST',
  })

  const response = await reconcileSession(request, {
    params: Promise.resolve({ sessionId: 'cs_test_123' }),
  })
  const payload = await response.json()

  assert.equal(response.status, 200)
  assert.deepEqual(received, {
    sessionId: 'cs_test_123',
    userId: 'user-test-1',
  })
  assert.equal(payload.id, 'order-test-1')
})

test('stripe webhook route forwards payload and preserves checkout errors', async () => {
  let received:
    | {
        payload: string
        signature: string
      }
    | undefined

  setCheckoutServiceForTesting({
    async createCheckoutSession() {
      return {
        sessionId: 'unused',
        sessionUrl: 'https://example.com',
      }
    },
    async handleStripeWebhookEvent(input) {
      received = input
      return {
        received: true,
        type: 'checkout.session.completed',
      }
    },
    async reconcileCheckoutSession() {
      return order as never
    },
  } satisfies CheckoutService)

  const request = new NextRequest('http://localhost/api/webhooks/stripe', {
    body: JSON.stringify({ id: 'evt_test_1' }),
    headers: {
      'stripe-signature': 'sig_test_123',
    },
    method: 'POST',
  })

  const response = await stripeWebhook(request)
  const payload = await response.json()

  assert.equal(response.status, 200)
  assert.deepEqual(received, {
    payload: JSON.stringify({ id: 'evt_test_1' }),
    signature: 'sig_test_123',
  })
  assert.equal(payload.type, 'checkout.session.completed')

  setCheckoutServiceForTesting({
    async createCheckoutSession() {
      return {
        sessionId: 'unused',
        sessionUrl: 'https://example.com',
      }
    },
    async handleStripeWebhookEvent() {
      throw new HttpError(400, 'Signature verification failed.')
    },
    async reconcileCheckoutSession() {
      return order as never
    },
  } satisfies CheckoutService)

  const failedResponse = await stripeWebhook(
    new NextRequest('http://localhost/api/webhooks/stripe', {
      body: '{}',
      headers: {
        'stripe-signature': 'sig_bad',
      },
      method: 'POST',
    }),
  )
  const failedPayload = await failedResponse.json()

  assert.equal(failedResponse.status, 400)
  assert.equal(failedPayload.error, 'Signature verification failed.')
})

test('stripe webhook route dispatches customer.subscription.deleted to subscription service', async () => {
  let received:
    | {
        payload: string
        signature: string
      }
    | undefined

  setCheckoutServiceForTesting({
    async createCheckoutSession() {
      return {
        sessionId: 'unused',
        sessionUrl: 'https://example.com',
      }
    },
    async handleStripeWebhookEvent(input) {
      received = input
      return {
        received: true,
        type: 'customer.subscription.deleted',
      }
    },
    async reconcileCheckoutSession() {
      return order as never
    },
  } satisfies CheckoutService)

  const request = new NextRequest('http://localhost/api/webhooks/stripe', {
    body: JSON.stringify({ id: 'evt_sub_deleted_1' }),
    headers: {
      'stripe-signature': 'sig_test_sub_del',
    },
    method: 'POST',
  })

  const response = await stripeWebhook(request)
  const payload = await response.json()

  assert.equal(response.status, 200)
  assert.deepEqual(received, {
    payload: JSON.stringify({ id: 'evt_sub_deleted_1' }),
    signature: 'sig_test_sub_del',
  })
  assert.equal(payload.type, 'customer.subscription.deleted')
})
