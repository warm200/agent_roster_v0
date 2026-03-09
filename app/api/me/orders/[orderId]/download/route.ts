import { NextRequest, NextResponse } from 'next/server'

import { HttpError } from '@/server/lib/http'
import { getRequestUserId } from '@/server/lib/request-user'
import { getSignedDownloadsForOrder } from '@/server/services/order.service'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const { orderId } = await params
    const userId = await getRequestUserId(request)
    const downloads = await getSignedDownloadsForOrder({
      baseUrl: request.nextUrl.origin,
      orderId,
      userId,
    })

    return NextResponse.json(downloads)
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    return NextResponse.json({ error: 'Unable to prepare downloads' }, { status: 500 })
  }
}
