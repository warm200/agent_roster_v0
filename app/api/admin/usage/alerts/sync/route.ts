import { NextRequest, NextResponse } from 'next/server'

import { requireAdminApiRequest, verifySameOrigin } from '@/server/lib/route-security'
import { syncDerivedBillingAlerts } from '@/server/services/admin-billing-alerts.service'

export async function POST(request: NextRequest) {
  const authError = await requireAdminApiRequest(request)
  if (authError) {
    return authError
  }

  const csrfError = verifySameOrigin(request)
  if (csrfError) {
    return csrfError
  }

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
