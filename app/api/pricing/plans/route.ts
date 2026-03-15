import { NextResponse } from 'next/server'

import { listSubscriptionPlans } from '@/lib/subscription-plans'

export async function GET() {
  return NextResponse.json(
    {
      plans: listSubscriptionPlans(),
    },
    { status: 200 },
  )
}
