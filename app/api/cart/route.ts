import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { HttpError } from '@/server/lib/http'
import {
  CART_COOKIE_NAME,
  getActiveCartWithCookie,
  replaceCartItems,
} from '@/server/services/cart.service'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const result = await getActiveCartWithCookie({
      cartId: cookieStore.get(CART_COOKIE_NAME)?.value ?? null,
    })
    const response = NextResponse.json(result.cart)
    response.cookies.set(CART_COOKIE_NAME, result.cookieCartId, { path: '/' })
    return response
  } catch (error) {
    return handleCartError(error)
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { agentIds } = body as { agentIds?: string[] }

    if (!Array.isArray(agentIds)) {
      return NextResponse.json({ error: 'agentIds must be an array' }, { status: 400 })
    }

    const cookieStore = await cookies()
    const result = await replaceCartItems({
      cartId: cookieStore.get(CART_COOKIE_NAME)?.value ?? null,
      agentIds,
    })
    const response = NextResponse.json(result.cart)
    response.cookies.set(CART_COOKIE_NAME, result.cookieCartId, { path: '/' })
    return response
  } catch (error) {
    return handleCartError(error)
  }
}

function handleCartError(error: unknown) {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }

  return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
}
