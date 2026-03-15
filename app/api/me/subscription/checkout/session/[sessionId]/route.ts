import { NextRequest, NextResponse } from 'next/server'

import { HttpError } from '@/server/lib/http'
import { getRequestUserId } from '@/server/lib/request-user'
import { getSubscriptionService } from '@/server/services/subscription.service'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await params
    const userId = await getRequestUserId(request)
    const subscription = await getSubscriptionService().reconcileCheckoutSession({
      sessionId,
      userId,
    })

    return NextResponse.json({ subscription })
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ error: 'Unable to reconcile subscription checkout session' }, { status: 500 })
  }
}
