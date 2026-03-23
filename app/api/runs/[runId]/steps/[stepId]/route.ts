import { NextRequest, NextResponse } from 'next/server'

import { HttpError } from '@/server/lib/http'
import { getRequestUserId } from '@/server/lib/request-user'
import { verifySameOrigin } from '@/server/lib/route-security'
import { getRunService } from '@/server/services/run.service'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string; stepId: string }> },
) {
  try {
    const csrfError = verifySameOrigin(request)
    if (csrfError) {
      return csrfError
    }

    const { runId, stepId } = await params
    const userId = await getRequestUserId(request)
    const run = await getRunService().getRun(userId, runId)

    return NextResponse.json(
      {
        deprecated: true,
        error: `Manual step approvals are not supported for run ${run.id}. Current run details are surfaced through logs and artifacts instead.`,
        runId,
        stepId,
      },
      { status: 409 }
    )
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}
