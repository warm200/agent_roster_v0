import type {
  AgentProviderKeyName,
  Order,
  PersistenceMode,
  Run,
  RunLog,
  RunResult,
  RuntimeInstanceState,
  RuntimeMode,
  RunTerminationReason,
  SubscriptionPlanId,
} from '@/lib/types'

import type { RuntimeLifecyclePolicy } from '../services/runtime-policy'

export type RunControlUiLink = {
  expiresAt: string | null
  url: string
}

export type RunProviderRuntimeConfig = {
  providerApiKeys?: Partial<Record<AgentProviderKeyName, string>>
}

export type RuntimeProviderInstance = {
  archivedAt: string | null
  deletedAt: string | null
  lastReconciledAt: string | null
  metadataJson: Record<string, unknown>
  persistenceMode: PersistenceMode
  planId: SubscriptionPlanId
  preservedStateAvailable: boolean
  providerInstanceRef: string
  providerName: string
  recoverableUntilAt: string | null
  runId: string
  runtimeMode: RuntimeMode
  startedAt: string | null
  state: RuntimeInstanceState
  stoppedAt: string | null
  stopReason: RunTerminationReason | null
  workspaceReleasedAt: string | null
}

export type RuntimeActivitySnapshot = {
  lastOpenClawSessionActivityAt: string | null
  lastOpenClawSessionProbeAt: string
  openClawSessionCount: number
}

export type CreateRuntimeInstanceInput = {
  lifecyclePolicy: RuntimeLifecyclePolicy
  order: Order
  planId: SubscriptionPlanId
  runId: string
  runtimeConfig?: RunProviderRuntimeConfig
}

export interface RunProvider {
  readonly name: string
  createRuntimeInstance?(input: CreateRuntimeInstanceInput): Promise<RuntimeProviderInstance>
  getRuntimeActivitySnapshot?(runId: string): Promise<RuntimeActivitySnapshot | null>
  getRuntimeInstance?(runId: string): Promise<RuntimeProviderInstance | null>
  archiveRuntimeInstance?(runId: string): Promise<RuntimeProviderInstance | null>
  recoverRuntimeInstance?(runId: string): Promise<RuntimeProviderInstance | null>
  stopRuntimeInstance?(
    runId: string,
    reason?: RunTerminationReason,
    fallbackRun?: Run,
  ): Promise<RuntimeProviderInstance | null>
  deleteRuntimeInstance?(runId: string): Promise<void>
  restartRuntimeInstance?(
    runId: string,
    order: Order,
    lifecyclePolicy: RuntimeLifecyclePolicy,
    runtimeConfig?: RunProviderRuntimeConfig,
  ): Promise<RuntimeProviderInstance | null>
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
