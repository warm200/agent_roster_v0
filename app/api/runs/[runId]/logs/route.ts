import { NextRequest, NextResponse } from 'next/server'

import { HttpError } from '@/server/lib/http'
import { getRequestUserId } from '@/server/lib/request-user'
import { getRunService } from '@/server/services/run.service'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  try {
    const { runId } = await params
    const userId = await getRequestUserId(request)

    return NextResponse.json({
      runId,
      logs: await getRunService().getRunLogs(userId, runId),
    })
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    return NextResponse.json({ error: 'Run not found' }, { status: 404 })
  }
}
