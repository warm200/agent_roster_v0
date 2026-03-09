import { runLogSchema, runResultSchema } from '@/lib/schemas'
import type { Order, Run, RunLog, RunResult } from '@/lib/types'

import { HttpError } from '../lib/http'
import { getRunProvider } from '../providers'
import { RunRepository } from './run.repository'
import { getOrderByIdForUser } from './order.service'

function ensureLaunchable(order: Order) {
  const failures: string[] = []

  if (order.status !== 'paid') {
    failures.push('Order must be paid before launch.')
  }

  if (!order.channelConfig) {
    failures.push('Telegram setup is missing.')
  } else {
    if (order.channelConfig.tokenStatus !== 'validated') {
      failures.push('Telegram bot token must be validated.')
    }

    if (order.channelConfig.recipientBindingStatus !== 'paired') {
      failures.push('Telegram pairing must be completed.')
    }
  }

  if (order.items.length === 0) {
    failures.push('Order has no agent versions to run.')
  }

  if (failures.length > 0) {
    throw new HttpError(409, failures.join(' '))
  }
}

export class RunService {
  constructor(
    private readonly repository: RunRepository = new RunRepository(),
  ) {}

  async createRun(userId: string, orderId: string) {
    const order = await getOrderByIdForUser({ orderId, userId })
    ensureLaunchable(order)

    const provider = getRunProvider()
    const run = await provider.createRun(order)

    return this.repository.createRun(run)
  }

  async listRuns(userId: string) {
    const runs = await this.repository.listRunsForUser(userId)
    return Promise.all(runs.map((run) => this.syncRun(run, false)))
  }

  async getRun(userId: string, runId: string) {
    const run = await this.requireRun(userId, runId)
    return this.syncRun(run, true)
  }

  async getRunLogs(userId: string, runId: string): Promise<RunLog[]> {
    const run = await this.requireRun(userId, runId)
    const logs = await getRunProvider().getLogs(run.id)
    return runLogSchema.array().parse(logs)
  }

  async getRunResult(userId: string, runId: string): Promise<RunResult | null> {
    const run = await this.requireRun(userId, runId)
    const result = await getRunProvider().getResult(run.id)
    return result ? runResultSchema.parse(result) : null
  }

  async stopRun(userId: string, runId: string) {
    const run = await this.requireRun(userId, runId)
    const stopped = await getRunProvider().stopRun(run.id)

    if (!stopped) {
      return run
    }

    return (await this.repository.updateRun(run.id, stopped)) ?? stopped
  }

  async retryRun(userId: string, runId: string) {
    const run = await this.requireRun(userId, runId)
    return this.createRun(userId, run.orderId)
  }

  private async requireRun(userId: string, runId: string) {
    const run = await this.repository.findRunForUser(runId, userId)

    if (!run) {
      throw new HttpError(404, 'Run not found.')
    }

    return run
  }

  private async syncRun(run: Run, persist: boolean) {
    const providerRun = await getRunProvider().getStatus(run.id)

    if (!providerRun) {
      return run
    }

    const result = await getRunProvider().getResult(run.id)
    const nextRun: Run = {
      ...run,
      status: providerRun.status,
      combinedRiskLevel: providerRun.combinedRiskLevel,
      usesRealWorkspace: providerRun.usesRealWorkspace,
      usesTools: providerRun.usesTools,
      networkEnabled: providerRun.networkEnabled,
      resultSummary: result?.summary ?? providerRun.resultSummary,
      resultArtifacts: result?.artifacts ?? providerRun.resultArtifacts,
      startedAt: providerRun.startedAt,
      updatedAt: providerRun.updatedAt,
      completedAt: providerRun.completedAt,
    }

    if (!persist) {
      return nextRun
    }

    return (await this.repository.updateRun(run.id, nextRun)) ?? nextRun
  }
}

export const runService = new RunService()
