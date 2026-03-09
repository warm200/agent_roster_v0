import { NextRequest, NextResponse } from 'next/server'

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

    return NextResponse.json({
      ...order,
      agents: order.items.map((item) => item.agent),
    })
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    return NextResponse.json({ error: 'Bundle not found' }, { status: 404 })
  }
}
