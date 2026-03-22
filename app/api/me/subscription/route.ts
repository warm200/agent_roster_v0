import { NextRequest, NextResponse } from 'next/server'

import { getFreeSubscriptionPlan, getSubscriptionPlan } from '@/lib/subscription-plans'
import { getRequestUserId } from '@/server/lib/request-user'
import { getSubscriptionService } from '@/server/services/subscription.service'

export async function GET(request: NextRequest) {
  const userId = await getRequestUserId(request)
  const service = getSubscriptionService()
  await service.syncSubscriptionFromStripe(userId)
  const subscription = await service.getCurrentSubscription(userId)

  return NextResponse.json(
    {
      plan: subscription ? getSubscriptionPlan(subscription.planId) : getFreeSubscriptionPlan(),
      subscription,
    },
    { status: 200 },
  )
}
