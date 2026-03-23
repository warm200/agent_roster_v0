import { NextRequest, NextResponse } from 'next/server'

import { authorizeAdminRequest, getAdminSnapshotFromRequest } from '../../_lib'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const authError = await authorizeAdminRequest(request)
  if (authError) {
    return authError
  }

  const { userId } = await params
  const snapshot = await getAdminSnapshotFromRequest(request)
  const user = snapshot.users.find((row) => row.id === userId)

  if (!user) {
    return NextResponse.json(
      { error: 'Admin user not found.' },
      {
        headers: {
          'cache-control': 'no-store',
        },
        status: 404,
      },
    )
  }

  return NextResponse.json(
    {
      customEndDate: snapshot.customEndDate,
      customStartDate: snapshot.customStartDate,
      generatedAt: snapshot.generatedAt,
      selectedRange: snapshot.selectedRange,
      user,
      windowLabel: snapshot.windowLabel,
    },
    {
      headers: {
        'cache-control': 'no-store',
      },
      status: 200,
    },
  )
}
