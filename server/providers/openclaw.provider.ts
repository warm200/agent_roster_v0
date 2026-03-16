import type { Order, Run, RunLog, RunResult } from '@/lib/types'

import { MockRunProvider } from './mock.provider'
import type {
  CreateRuntimeInstanceInput,
  RunProvider,
  RunProviderRuntimeConfig,
  RuntimeProviderInstance,
} from './run-provider.interface'

export class OpenClawRunProvider implements RunProvider {
  readonly name = 'openclaw'

  private readonly fallback = new MockRunProvider()

  async createRuntimeInstance(input: CreateRuntimeInstanceInput): Promise<RuntimeProviderInstance> {
    return this.fallback.createRuntimeInstance(input)
  }

  async getRuntimeInstance(runId: string): Promise<RuntimeProviderInstance | null> {
    return this.fallback.getRuntimeInstance(runId)
  }

  async stopRuntimeInstance(runId: string, reason?: import('@/lib/types').RunTerminationReason, fallbackRun?: Run): Promise<RuntimeProviderInstance | null> {
    return this.fallback.stopRuntimeInstance(runId, reason, fallbackRun)
  }

  async restartRuntimeInstance(
    runId: string,
    order: Order,
    lifecyclePolicy: CreateRuntimeInstanceInput['lifecyclePolicy'],
    runtimeConfig?: RunProviderRuntimeConfig,
  ): Promise<RuntimeProviderInstance | null> {
    return this.fallback.restartRuntimeInstance(runId, order, lifecyclePolicy, runtimeConfig)
  }

  async createRun(order: Order, runId?: string, runtimeConfig?: RunProviderRuntimeConfig): Promise<Run> {
    return this.fallback.createRun(order, runId, runtimeConfig)
  }

  async getStatus(runId: string): Promise<Run | null> {
    return this.fallback.getStatus(runId)
  }

  async getLogs(runId: string): Promise<RunLog[]> {
    return this.fallback.getLogs(runId)
  }

  async getResult(runId: string): Promise<RunResult | null> {
    return this.fallback.getResult(runId)
  }

  async stopRun(runId: string): Promise<Run | null> {
    return this.fallback.stopRun(runId)
  }
}
