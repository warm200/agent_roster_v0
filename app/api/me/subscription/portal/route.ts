import { NextRequest, NextResponse } from 'next/server'

import { getRequestUserId } from '@/server/lib/request-user'
import { verifySameOrigin } from '@/server/lib/route-security'
import { getSubscriptionService } from '@/server/services/subscription.service'

export async function POST(request: NextRequest) {
  const csrfError = verifySameOrigin(request)
  if (csrfError) {
    return csrfError
  }

  const userId = await getRequestUserId(request)
  const service = getSubscriptionService()
  const { portalUrl } = await service.createBillingPortalSession({
    origin: request.nextUrl.origin,
    returnPath: '/app/account',
    userId,
  })

  return NextResponse.json({ portalUrl }, { status: 200 })
}
