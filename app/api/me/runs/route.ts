import { NextRequest, NextResponse } from 'next/server'

import type { Agent, Order, Run, RunLog } from '@/lib/types'
import { HttpError } from '@/server/lib/http'
import { getRequestUserId } from '@/server/lib/request-user'
import { getOrderService } from '@/server/services/order.service'
import { getRunService } from '@/server/services/run.service'

interface RunSummary extends Run {
  agents: Agent[]
  artifactsCount: number
  logs: RunLog[]
  logsCount: number
  order: Order | undefined
}

async function buildRunSummary(userId: string, run: Run): Promise<RunSummary> {
  const [orderResult, logsResult] = await Promise.allSettled([
    getOrderService().getOrderByIdForUser({ orderId: run.orderId, userId }),
    getRunService().getRunLogs(userId, run.id),
  ])

  const order = orderResult.status === 'fulfilled' ? orderResult.value : undefined
  const logs = logsResult.status === 'fulfilled' ? logsResult.value : []

  return {
    ...run,
    agents: order?.items.map((item) => item.agent) ?? [],
    artifactsCount: run.resultArtifacts.length,
    logs,
    logsCount: logs.length,
    order,
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getRequestUserId(request)
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const orderId = searchParams.get('orderId')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    let runs = await getRunService().listRuns(userId)

    if (status && status !== 'all') {
      runs = runs.filter((run) => run.status === status)
    }

    if (orderId) {
      runs = runs.filter((run) => run.orderId === orderId)
    }

    const total = runs.length
    runs = runs.slice(offset, offset + limit)

    return NextResponse.json({
      runs: await Promise.all(runs.map((run) => buildRunSummary(userId, run))),
      total,
      limit,
      offset,
      hasMore: offset + runs.length < total,
    })
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    return NextResponse.json({ error: 'Unable to load runs' }, { status: 500 })
  }
}
