import type { AgentProviderKeyName, Order, Run, RunLog, RunResult } from '@/lib/types'

export type RunControlUiLink = {
  expiresAt: string | null
  url: string
}

export type RunProviderRuntimeConfig = {
  providerApiKeys?: Partial<Record<AgentProviderKeyName, string>>
}

export interface RunProvider {
  readonly name: string
  createRun(order: Order, runId?: string, runtimeConfig?: RunProviderRuntimeConfig): Promise<Run>
  getStatus(runId: string): Promise<Run | null>
  getLogs(runId: string): Promise<RunLog[]>
  getResult(runId: string): Promise<RunResult | null>
  getControlUiLink?(runId: string, expiresInSeconds?: number): Promise<RunControlUiLink | null>
  restartRun?(
    runId: string,
    order: Order,
    fallbackRun?: Run,
    runtimeConfig?: RunProviderRuntimeConfig,
  ): Promise<Run | null>
  stopRun(runId: string, fallbackRun?: Run): Promise<Run | null>
}
