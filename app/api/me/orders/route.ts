import { NextRequest, NextResponse } from 'next/server'

import { HttpError } from '@/server/lib/http'
import { getRequestUserId } from '@/server/lib/request-user'
import { listOrdersForUser } from '@/server/services/order.service'

export async function GET(request: NextRequest) {
  try {
    const userId = await getRequestUserId(request)
    const orders = await listOrdersForUser(userId)
    return NextResponse.json({
      orders,
      total: orders.length,
    })
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    return NextResponse.json({ error: 'Unable to load orders' }, { status: 500 })
  }
}
