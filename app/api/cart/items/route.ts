import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

import { HttpError } from '@/server/lib/http'
import { verifySameOrigin } from '@/server/lib/route-security'
import {
  CART_COOKIE_NAME,
  addItemToCart,
  getActiveCart,
} from '@/server/services/cart.service'

export async function POST(request: NextRequest) {
  try {
    const csrfError = verifySameOrigin(request)
    if (csrfError) {
      return csrfError
    }

    const body = await request.json()
    const { agentId } = body as { agentId?: string }

    if (!agentId) {
      return NextResponse.json({ error: 'agentId is required' }, { status: 400 })
    }

    const cookieStore = await cookies()
    const result = await addItemToCart({
      cartId: cookieStore.get(CART_COOKIE_NAME)?.value ?? null,
      agentId,
    })
    const cart = await getActiveCart({ cartId: result.cookieCartId })

    const response = NextResponse.json({
      cart,
      item: result.cartItem,
    })
    response.cookies.set(CART_COOKIE_NAME, result.cookieCartId, { path: '/' })
    return response
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to add cart item.' },
      { status: 500 },
    )
  }
}
