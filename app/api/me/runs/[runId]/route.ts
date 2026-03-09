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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  try {
    const { runId } = await params
    const userId = await getRequestUserId(request)
    const body = await request.json()
    const { action } = body as { action?: string }

    if (action === 'cancel') {
      const run = await runService.stopRun(userId, runId)
      return NextResponse.json(await buildRunDetail(userId, run))
    }

    if (action === 'retry') {
      const run = await runService.retryRun(userId, runId)
      return NextResponse.json(await buildRunDetail(userId, run))
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}
