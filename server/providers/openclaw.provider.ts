import type { Order, Run, RunLog, RunResult } from '@/lib/types'

import { MockRunProvider } from './mock.provider'
import type { RunProvider } from './run-provider.interface'

export class OpenClawRunProvider implements RunProvider {
  readonly name = 'openclaw'

  private readonly fallback = new MockRunProvider()

  async createRun(order: Order): Promise<Run> {
    return this.fallback.createRun(order)
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
