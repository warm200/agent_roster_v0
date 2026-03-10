import type { Order, Run, RunLog, RunResult } from '@/lib/types'

export type RunControlUiLink = {
  expiresAt: string | null
  url: string
}

export interface RunProvider {
  readonly name: string
  createRun(order: Order): Promise<Run>
  getStatus(runId: string): Promise<Run | null>
  getLogs(runId: string): Promise<RunLog[]>
  getResult(runId: string): Promise<RunResult | null>
  getControlUiLink?(runId: string, expiresInSeconds?: number): Promise<RunControlUiLink | null>
  stopRun(runId: string): Promise<Run | null>
}
