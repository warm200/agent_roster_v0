import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

import { HttpError } from '@/server/lib/http'
import { getRequestUserId } from '@/server/lib/request-user'
import { CART_COOKIE_NAME, replaceCartItems } from '@/server/services/cart.service'
import { getOrderService } from '@/server/services/order.service'

export async function GET(request: NextRequest) {
  try {
    const userId = await getRequestUserId(request)
    const bundles = await getOrderService().listOrdersForUser(userId)

    return NextResponse.json({
      bundles: bundles.map((order) => ({
        ...order,
        agents: order.items.map((item) => item.agent),
      })),
      total: bundles.length,
    })
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    return NextResponse.json({ error: 'Unable to load bundles' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { agentIds } = body

    if (!agentIds || !Array.isArray(agentIds) || agentIds.length === 0) {
      return NextResponse.json({ error: 'At least one agent is required' }, { status: 400 })
    }

    const userId = await getRequestUserId(request)
    const cookieStore = await cookies()
    const { cart, cookieCartId } = await replaceCartItems({
      cartId: cookieStore.get(CART_COOKIE_NAME)?.value ?? null,
      userId,
      agentIds,
    })

    const order = await getOrderService().createPaidOrderFromCart({
      cartId: cart.id,
      payment: {
        amountCents: cart.totalCents,
        currency: cart.currency,
        paymentProvider: 'stripe',
        paymentReference: `mock_${Date.now()}`,
      },
      userId,
    })

    const response = NextResponse.json(order, { status: 201 })
    response.cookies.set(CART_COOKIE_NAME, cookieCartId, { path: '/' })
    return response
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}
