import { NextResponse } from 'next/server'

import { BillingAlertRepository } from '@/server/services/billing-alert.repository'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ alertId: string }> },
) {
  const { alertId } = await params

  try {
    const updated = await new BillingAlertRepository().acknowledgeBillingAlert(alertId)

    if (!updated) {
      return NextResponse.json(
        { error: 'Billing alert not found.' },
        {
          headers: {
            'cache-control': 'no-store',
          },
          status: 404,
        },
      )
    }

    return NextResponse.json(
      { acknowledgedAt: updated.acknowledgedAt?.toISOString() ?? null, id: updated.id },
      {
        headers: {
          'cache-control': 'no-store',
        },
        status: 200,
      },
    )
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unable to acknowledge billing alert.',
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
