import { NextRequest, NextResponse } from 'next/server'

import type { Agent, Order, Run, RunLog } from '@/lib/types'
import { HttpError } from '@/server/lib/http'
import { getRequestUserId } from '@/server/lib/request-user'
import { getOrderByIdForUser } from '@/server/services/order.service'
import { RunService } from '@/server/services/run.service'

interface RunSummary extends Run {
  agents: Agent[]
  artifactsCount: number
  logs: RunLog[]
  logsCount: number
  order: Order | undefined
}

const runService = new RunService()

async function buildRunSummary(userId: string, run: Run): Promise<RunSummary> {
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

export async function GET(request: NextRequest) {
  try {
    const userId = await getRequestUserId(request)
    const runs = await runService.listRuns(userId)

    return NextResponse.json({
      runs: await Promise.all(runs.map((run) => buildRunSummary(userId, run))),
      total: runs.length,
    })
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    return NextResponse.json({ error: 'Unable to load runs' }, { status: 500 })
  }
}
