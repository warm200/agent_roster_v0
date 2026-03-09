import { NextRequest, NextResponse } from 'next/server'

import type { Agent, Order, Run, RunLog } from '@/lib/types'
import { HttpError } from '@/server/lib/http'
import { getRequestUserId } from '@/server/lib/request-user'
import { getOrderByIdForUser } from '@/server/services/order.service'
import { RunService } from '@/server/services/run.service'

interface RunDetailResponse extends Run {
  agents: Agent[]
  artifactsCount: number
  logs: RunLog[]
  logsCount: number
  order: Order | undefined
}

const runService = new RunService()

async function buildRunDetail(userId: string, run: Run): Promise<RunDetailResponse> {
  const [order, logs] = await Promise.all([
    getOrderByIdForUser({ orderId: run.orderId, userId }),
    runService.getRunLogs(userId, run.id),
  ])

  return {
    ...run,
    agents: order.items.map((item) => item.agent),
    artifactsCount: run.resultArtifacts.length,
    logs,
    logsCount: logs.length,
    order,
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  try {
    const { runId } = await params
    const userId = await getRequestUserId(request)
    const run = await runService.getRun(userId, runId)
    return NextResponse.json(await buildRunDetail(userId, run))
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    return NextResponse.json({ error: 'Run not found' }, { status: 404 })
  }
}
