import { NextRequest, NextResponse } from 'next/server'

import { getRequestUserId } from '@/server/lib/request-user'
import { getSubscriptionService } from '@/server/services/subscription.service'

export async function POST(request: NextRequest) {
  const userId = await getRequestUserId(request)
  const service = getSubscriptionService()
  const { portalUrl } = await service.createBillingPortalSession({
    origin: request.nextUrl.origin,
    returnPath: '/app/account',
    userId,
  })

  return NextResponse.json({ portalUrl }, { status: 200 })
}
