import { NextRequest, NextResponse } from 'next/server'

import { getFreeSubscriptionPlan, getSubscriptionPlan } from '@/lib/subscription-plans'
import { getRequestUserId } from '@/server/lib/request-user'
import { getSubscriptionService } from '@/server/services/subscription.service'

export async function GET(request: NextRequest) {
  const userId = await getRequestUserId(request)
  const service = getSubscriptionService()
  await service.syncSubscriptionFromStripe(userId)
  const subscription = await service.getCurrentSubscription(userId)
  const plan = subscription ? getSubscriptionPlan(subscription.planId) : getFreeSubscriptionPlan()
  const runtimeGrant = !plan.runtimeAccess ? await service.getCurrentRuntimeGrant(userId) : null
  const effectivePlan = runtimeGrant ? getSubscriptionPlan('run') : plan
  const availableCredits =
    runtimeGrant?.creditsRemaining ?? subscription?.remainingCredits ?? plan.includedCredits

  return NextResponse.json(
    {
      availableCredits,
      effectivePlan,
      plan,
      runtimeGrant,
      subscription,
    },
    { status: 200 },
  )
}
