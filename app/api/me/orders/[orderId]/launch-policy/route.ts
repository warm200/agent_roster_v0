import { NextRequest, NextResponse } from 'next/server'

import { HttpError } from '@/server/lib/http'
import { getRequestUserId } from '@/server/lib/request-user'
import { getOrderService } from '@/server/services/order.service'
import { getSubscriptionService } from '@/server/services/subscription.service'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const { orderId } = await params
    const userId = await getRequestUserId(request)
    const order = await getOrderService().getOrderByIdForUser({ orderId, userId })
    const policy = await getSubscriptionService().getLaunchPolicy(userId, order)

    return NextResponse.json(policy, { status: 200 })
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    return NextResponse.json({ error: 'Unable to load launch policy' }, { status: 500 })
  }
}
