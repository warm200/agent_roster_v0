import type { Agent, Order, Run, RunLog } from '@/lib/types'

import { getJson, patchJson } from './api'

export interface RunDetailResponse extends Run {
  agents: Agent[]
  artifactsCount: number
  logs: RunLog[]
  logsCount: number
  order: Order | undefined
}

export async function getRun(runId: string) {
  return getJson<RunDetailResponse>(`/api/me/runs/${runId}`)
}

export async function updateRun(
  runId: string,
  action: 'cancel' | 'retry',
) {
  return patchJson<RunDetailResponse, { action: 'cancel' | 'retry' }>(
    `/api/me/runs/${runId}`,
    { action },
  )
}
