import type { Order, Run, RunLog, RunResult } from '@/lib/types'

export interface RunProvider {
  readonly name: string
  createRun(order: Order): Promise<Run>
  getStatus(runId: string): Promise<Run | null>
  getLogs(runId: string): Promise<RunLog[]>
  getResult(runId: string): Promise<RunResult | null>
  stopRun(runId: string): Promise<Run | null>
}
