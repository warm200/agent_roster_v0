import type Stripe from 'stripe'

import type { CheckoutSession, Order } from '@/lib/types'

import { getStripe } from '../lib/stripe'
import { HttpError } from '../lib/http'
import { getActiveCart } from './cart.service'
import { createPaidOrderFromCart } from './order.service'

function getCheckoutBaseUrl(origin: string) {
  return (process.env.NEXTAUTH_URL || origin).replace(/\/$/, '')
}

function getStripeCheckoutClient() {
  try {
    return getStripe()
  } catch {
    throw new HttpError(503, 'Stripe is not configured.')
  }
}

function buildStripePaymentReference(session: Stripe.Checkout.Session) {
  return session.payment_intent?.toString() ?? session.id
}

function assertCompletedPaymentSession(session: Stripe.Checkout.Session) {
  if (session.mode !== 'payment') {
    throw new HttpError(400, 'Checkout session is not a payment session.')
  }

  if (session.status !== 'complete' || session.payment_status !== 'paid') {
    throw new HttpError(409, 'Checkout session is not paid yet.')
  }
}

export async function createCheckoutSession(input: {
  cartId: string
  origin: string
  userEmail?: string | null
  userId?: string | null
}): Promise<CheckoutSession> {
  const cart = await getActiveCart({
    cartId: input.cartId,
    userId: input.userId ?? null,
  })

  if (cart.items.length === 0) {
    throw new HttpError(400, 'Cart is empty.')
  }

  const stripe = getStripeCheckoutClient()
  const appUrl = getCheckoutBaseUrl(input.origin)
  const session = await stripe.checkout.sessions.create({
    cancel_url: `${appUrl}/cart`,
    client_reference_id: cart.id,
    customer_email: input.userEmail ?? undefined,
    line_items: cart.items.map((item) => ({
      price_data: {
        currency: item.agent.currency.toLowerCase(),
        product_data: {
          description: item.agent.summary,
          metadata: {
            agentId: item.agent.id,
            agentVersionId: item.agentVersion.id,
          },
          name: item.agent.title,
        },
        unit_amount: item.agent.priceCents,
      },
      quantity: 1,
    })),
    metadata: {
      bundleRiskLevel: cart.bundleRisk.level,
      cartId: cart.id,
      userId: input.userId ?? '',
    },
    mode: 'payment',
    success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
  })

  if (!session.url) {
    throw new HttpError(502, 'Stripe did not return a checkout URL.')
  }

  return {
    sessionId: session.id,
    sessionUrl: session.url,
  }
}

export async function createOrderFromCompletedCheckout(input: {
  amountCents: number
  cartId: string
  currency: string
  paymentProvider?: string
  paymentReference: string | null
  userId: string
}): Promise<Order> {
  return createPaidOrderFromCart({
    cartId: input.cartId,
    payment: {
      amountCents: input.amountCents,
      currency: input.currency.toUpperCase(),
      paymentProvider: input.paymentProvider ?? 'stripe',
      paymentReference: input.paymentReference,
    },
    userId: input.userId,
  })
}

export async function reconcileCheckoutSession(input: {
  sessionId: string
  userId: string
}): Promise<Order> {
  const stripe = getStripeCheckoutClient()
  const session = await stripe.checkout.sessions.retrieve(input.sessionId)

  assertCompletedPaymentSession(session)

  const metadataUserId = session.metadata?.userId?.trim() || null

  if (metadataUserId && metadataUserId !== input.userId) {
    throw new HttpError(403, 'Checkout session belongs to another user.')
  }

  const cartId = session.client_reference_id || session.metadata?.cartId

  if (!cartId) {
    throw new HttpError(400, 'Checkout session missing cart reference.')
  }

  return createOrderFromCompletedCheckout({
    amountCents: session.amount_total ?? 0,
    cartId,
    currency: session.currency ?? 'usd',
    paymentReference: buildStripePaymentReference(session),
    userId: metadataUserId || input.userId,
  })
}

export async function handleStripeCheckoutCompletedSession(input: {
  session: Stripe.Checkout.Session
  userId: string
}) {
  assertCompletedPaymentSession(input.session)

  const cartId = input.session.client_reference_id || input.session.metadata?.cartId

  if (!cartId) {
    throw new HttpError(400, 'Checkout session missing cart reference.')
  }

  return createOrderFromCompletedCheckout({
    amountCents: input.session.amount_total ?? 0,
    cartId,
    currency: input.session.currency ?? 'usd',
    paymentReference: buildStripePaymentReference(input.session),
    userId: input.userId,
  })
}
