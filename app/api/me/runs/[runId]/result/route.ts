import { NextRequest, NextResponse } from 'next/server'

import { HttpError } from '@/server/lib/http'
import { getRequestUserId } from '@/server/lib/request-user'
import { RunService } from '@/server/services/run.service'

const runService = new RunService()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  try {
    const { runId } = await params
    const userId = await getRequestUserId(request)
    const result = await runService.getRunResult(userId, runId)

    return NextResponse.json({
      runId,
      summary: result?.summary ?? null,
      artifacts: result?.artifacts ?? [],
    })
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    return NextResponse.json({ error: 'Run not found' }, { status: 404 })
  }
}
