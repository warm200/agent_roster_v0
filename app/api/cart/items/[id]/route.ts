import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

import { HttpError } from '@/server/lib/http'
import { verifySameOrigin } from '@/server/lib/route-security'
import {
  CART_COOKIE_NAME,
  removeCartItem,
} from '@/server/services/cart.service'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const csrfError = verifySameOrigin(request)
    if (csrfError) {
      return csrfError
    }

    const { id } = await params
    const cookieStore = await cookies()
    const cart = await removeCartItem({
      cartId: cookieStore.get(CART_COOKIE_NAME)?.value ?? null,
      cartItemId: id,
    })
    const response = NextResponse.json({
      cart,
      removedItemId: id,
    })
    response.cookies.set(CART_COOKIE_NAME, cart.id, { path: '/' })
    return response
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to remove cart item.' },
      { status: 500 },
    )
  }
}
