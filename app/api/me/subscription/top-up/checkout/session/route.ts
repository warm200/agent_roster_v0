import { NextRequest, NextResponse } from 'next/server'

import { HttpError } from '@/server/lib/http'
import { getRequestUserId } from '@/server/lib/request-user'
import { verifySameOrigin } from '@/server/lib/route-security'
import { getSubscriptionService } from '@/server/services/subscription.service'

export async function POST(request: NextRequest) {
  try {
    const csrfError = verifySameOrigin(request)
    if (csrfError) {
      return csrfError
    }

    const body = (await request.json().catch(() => ({}))) as {
      email?: string
      returnPath?: string
      topUpPackId?: string
    }
    const userId = await getRequestUserId(request)
    const session = await getSubscriptionService().createTopUpCheckoutSession({
      origin: request.nextUrl.origin,
      returnPath: body.returnPath ?? '/app',
      topUpPackId: body.topUpPackId ?? '',
      userEmail: body.email ?? null,
      userId,
    })

    return NextResponse.json(session, { status: 201 })
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ error: 'Unable to create top-up checkout session' }, { status: 500 })
  }
}
