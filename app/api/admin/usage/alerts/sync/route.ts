import { NextResponse } from 'next/server'

import { syncDerivedBillingAlerts } from '@/server/services/admin-billing-alerts.service'

export async function POST() {
  try {
    const result = await syncDerivedBillingAlerts()
    return NextResponse.json(result, {
      headers: {
        'cache-control': 'no-store',
      },
      status: 200,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unable to sync billing alerts.',
      },
      {
        headers: {
          'cache-control': 'no-store',
        },
        status: 503,
      },
    )
  }
}
