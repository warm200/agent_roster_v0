import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

import { isAuthConfigured } from '@/server/lib/auth'
import { HttpError } from '@/server/lib/http'
import { getRequestUserId } from '@/server/lib/request-user'
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
    const userId = isAuthConfigured() ? await getRequestUserId(request) : (body.userId ?? null)

    if (!cartId) {
      return NextResponse.json({ error: 'cartId is required' }, { status: 400 })
    }

    const session = await getCheckoutService().createCheckoutSession({
      cartId,
      origin: request.nextUrl.origin,
      userEmail: body.email ?? null,
      userId,
    })

    return NextResponse.json(session, { status: 201 })
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    return NextResponse.json({ error: 'Unable to create checkout session' }, { status: 500 })
  }
}
