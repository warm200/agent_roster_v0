import { NextResponse } from 'next/server'
import { getRunById, getRunLogs } from '@/lib/mock-selectors'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params
  const run = getRunById(runId)

  if (!run) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 })
  }

  return NextResponse.json({
    runId,
    logs: getRunLogs(runId),
  })
}
