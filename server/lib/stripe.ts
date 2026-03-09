import Stripe from 'stripe'

let stripeClient: Stripe | null = null

export function getStripe() {
  const apiKey = process.env.STRIPE_SECRET_KEY

  if (!apiKey) {
    throw new Error('STRIPE_SECRET_KEY is required')
  }

  if (!stripeClient) {
    stripeClient = new Stripe(apiKey)
  }

  return stripeClient
}
