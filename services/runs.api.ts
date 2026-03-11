import type { Agent, Order, Run, RunLog } from '@/lib/types'

import { getJson, patchJson, postJson } from './api'

export interface RunSummary extends Run {
  agents: Agent[]
  artifactsCount: number
  logs: RunLog[]
  logsCount: number
  order: Order | undefined
}

export interface RunDetailResponse extends Run {
  agents: Agent[]
  artifactsCount: number
  logs: RunLog[]
  logsCount: number
  order: Order | undefined
}

export type RunControlUiLinkResponse = {
  expiresAt: string | null
  url: string
}

type ListRunsResponse = {
  runs: RunSummary[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

export async function listRuns(input?: {
  limit?: number
  offset?: number
  orderId?: string
  status?: string
}) {
  const params = new URLSearchParams()

  if (input?.limit !== undefined) {
    params.set('limit', String(input.limit))
  }

  if (input?.offset !== undefined) {
    params.set('offset', String(input.offset))
  }

  if (input?.orderId) {
    params.set('orderId', input.orderId)
  }

  if (input?.status) {
    params.set('status', input.status)
  }

  const query = params.toString()
  return getJson<ListRunsResponse>(`/api/me/runs${query ? `?${query}` : ''}`)
}

export async function getRun(runId: string) {
  return getJson<RunDetailResponse>(`/api/me/runs/${runId}`)
}

export async function updateRun(
  runId: string,
  action: 'cancel' | 'retry',
  options?: {
    timeoutMs?: number
  },
) {
  return patchJson<RunDetailResponse, { action: 'cancel' | 'retry' }>(
    `/api/me/runs/${runId}`,
    { action },
    options?.timeoutMs ? { timeout: options.timeoutMs } : undefined,
  )
}

export async function createRunControlUiLink(runId: string) {
  return postJson<RunControlUiLinkResponse>(`/api/me/runs/${runId}/control-ui-link`)
}
