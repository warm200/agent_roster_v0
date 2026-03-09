import { NextRequest, NextResponse } from 'next/server'

import { HttpError } from '@/server/lib/http'
import { handleStripeWebhookEvent } from '@/server/services/checkout.service'

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
      return NextResponse.json({ error: 'stripe-signature header is required' }, { status: 400 })
    }

    const payload = await request.text()
    const result = await handleStripeWebhookEvent({
      payload,
      signature,
    })

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ error: 'Unable to process Stripe webhook' }, { status: 500 })
  }
}
