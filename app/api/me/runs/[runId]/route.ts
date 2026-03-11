import { NextRequest, NextResponse } from 'next/server'

import type { Agent, Order, Run, RunLog } from '@/lib/types'
import { HttpError, logServerError, unexpectedErrorMessage } from '@/server/lib/http'
import { getRequestUserId } from '@/server/lib/request-user'
import { getOrderService } from '@/server/services/order.service'
import { getRunService } from '@/server/services/run.service'

interface RunDetailResponse extends Run {
  agents: Agent[]
  artifactsCount: number
  logs: RunLog[]
  logsCount: number
  order: Order | undefined
}

async function buildRunDetail(userId: string, run: Run): Promise<RunDetailResponse> {
  const [order, logs] = await Promise.all([
    getOrderService().getOrderByIdForUser({ orderId: run.orderId, userId }),
    getRunService().getRunLogs(userId, run.id),
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

/** GET run detail: syncs latest status from provider (e.g. Daytona sandbox) on every request, then returns merged run. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  try {
    const { runId } = await params
    const userId = await getRequestUserId(request)
    const run = await getRunService().getRun(userId, runId)
    return NextResponse.json(await buildRunDetail(userId, run))
  } catch (error) {
    if (error instanceof HttpError) {
      logServerError('api/me/runs/[runId]:get:http_error', error, {
        route: 'GET /api/me/runs/[runId]',
      })
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    logServerError('api/me/runs/[runId]:get:unexpected', error, {
      route: 'GET /api/me/runs/[runId]',
    })
    return NextResponse.json(
      { error: unexpectedErrorMessage(error, 'Run not found') },
      { status: 404 },
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  let runId = 'unknown'
  let action: string | undefined
  try {
    ;({ runId } = await params)
    const userId = await getRequestUserId(request)
    const body = (await request.json().catch(() => null)) as { action?: string } | null
    action = body?.action
    if (action === 'cancel') {
      const run = await getRunService().stopRun(userId, runId)
      return NextResponse.json(await buildRunDetail(userId, run))
    }

    if (action === 'retry') {
      const run = await getRunService().retryRun(userId, runId)
      return NextResponse.json(await buildRunDetail(userId, run))
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    if (error instanceof HttpError) {
      logServerError('api/me/runs/[runId]:patch:http_error', error, {
        action,
        route: 'PATCH /api/me/runs/[runId]',
        runId,
      })
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    logServerError('api/me/runs/[runId]:patch:unexpected', error, {
      action,
      route: 'PATCH /api/me/runs/[runId]',
      runId,
    })
    return NextResponse.json(
      { error: unexpectedErrorMessage(error, 'Unable to update run') },
      { status: 500 },
    )
  }
}
