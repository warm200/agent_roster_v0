import { NextRequest, NextResponse } from 'next/server'

import { updateOrderAgentSetupRequestSchema } from '@/lib/schemas'
import { HttpError } from '@/server/lib/http'
import { getRequestUserId } from '@/server/lib/request-user'
import { getOrderService } from '@/server/services/order.service'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const { orderId } = await params
    const userId = await getRequestUserId(request)
    const order = await getOrderService().getOrderByIdForUser({ orderId, userId })
    return NextResponse.json(order)
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const { orderId } = await params
    const userId = await getRequestUserId(request)
    const payload = updateOrderAgentSetupRequestSchema.parse(await request.json())
    const order = await getOrderService().updateOrderAgentSetupForUser({
      orderId,
      userId,
      agentSetup: payload.agentSetup,
    })
    return NextResponse.json(order)
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    return NextResponse.json({ error: 'Unable to update order setup' }, { status: 500 })
  }
}
