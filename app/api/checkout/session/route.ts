import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

import { HttpError } from '@/server/lib/http'
import { CART_COOKIE_NAME } from '@/server/services/cart.service'
import { getCheckoutService } from '@/server/services/checkout.service'

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      cartId?: string
      email?: string
      userId?: string
    }
    const cartId =
      body.cartId ??
      (await cookies()).get(CART_COOKIE_NAME)?.value ??
      null

    if (!cartId) {
      return NextResponse.json({ error: 'cartId is required' }, { status: 400 })
    }

    const session = await getCheckoutService().createCheckoutSession({
      cartId,
      origin: request.nextUrl.origin,
      userEmail: body.email ?? null,
      userId: body.userId ?? null,
    })

    return NextResponse.json(session, { status: 201 })
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    return NextResponse.json({ error: 'Unable to create checkout session' }, { status: 500 })
  }
}
