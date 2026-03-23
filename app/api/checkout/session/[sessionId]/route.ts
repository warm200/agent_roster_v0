import { NextRequest, NextResponse } from 'next/server'

import { HttpError } from '@/server/lib/http'
import { getRequestUserId } from '@/server/lib/request-user'
import { verifySameOrigin } from '@/server/lib/route-security'
import { getCheckoutService } from '@/server/services/checkout.service'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const csrfError = verifySameOrigin(request)
    if (csrfError) {
      return csrfError
    }

    const { sessionId } = await params
    const userId = await getRequestUserId(request)
    const order = await getCheckoutService().reconcileCheckoutSession({
      sessionId,
      userId,
    })

    return NextResponse.json(order)
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    return NextResponse.json({ error: 'Unable to reconcile checkout session' }, { status: 500 })
  }
}
