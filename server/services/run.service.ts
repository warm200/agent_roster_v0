import { riskProfileSchema, runLogSchema, runResultSchema } from '@/lib/schemas'
import type { AgentVersion, Order, Run, RunLog, RunResult } from '@/lib/types'

import { HttpError } from '../lib/http'
import { getTelegramService } from './telegram.service'
import { scanAgentVersion as scanAgentVersionRiskProfile } from '../lib/risk-engine'
import { getRunProvider } from '../providers'
import type { RunControlUiLink } from '../providers/run-provider.interface'
import { RunRepository } from './run.repository'
import { getOrderByIdForUser } from './order.service'

function sanitizeRunText(value: string | null) {
  if (!value) {
    return value
  }

  return value
    .replaceAll(/Managed run completed for bundle/gi, 'Managed run completed for bundle')
    .replaceAll(/Daytona workspace completed bundle/gi, 'Managed run completed for bundle')
    .replaceAll(/Submitted background response [\w-]+ to OpenAI model [^.]+\./gi, 'Submitted run request to the managed runtime.')
    .replaceAll(/OpenAI response is currently ([^.]+)\./gi, 'Run status is currently $1.')
    .replaceAll(/OpenAI returned a final summary for this run\./gi, 'A final summary is ready for this run.')
    .replaceAll(/managed Daytona workspace/gi, 'managed runtime')
    .replaceAll(/Daytona workspace/gi, 'managed runtime')
    .replaceAll(/ in Daytona\./gi, '.')
    .replaceAll(/\bDaytona\b/gi, 'managed runtime')
    .replaceAll(/\bOpenAI\b/gi, 'managed runtime')
    .replaceAll(/\bOpenClaw\b/gi, 'managed runtime')
}

function sanitizeRun(run: Run): Run {
  return {
    ...run,
    resultSummary: sanitizeRunText(run.resultSummary),
  }
}

function sanitizeRunLogs(logs: RunLog[]): RunLog[] {
  return logs.map((log) => ({
    ...log,
    message: sanitizeRunText(log.message) ?? log.message,
  }))
}

function sanitizeRunResult(result: RunResult): RunResult {
  return {
    ...result,
    summary: sanitizeRunText(result.summary) ?? result.summary,
  }
}

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
    await runServiceDeps.getTelegramService().getChannelConfig({ orderId, userId })
    const order = await runServiceDeps.getOrderByIdForUser({ orderId, userId })
    ensureLaunchable(order)

    const provider = runServiceDeps.getRunProvider()
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
    const logs = await runServiceDeps.getRunProvider().getLogs(run.id)
    return sanitizeRunLogs(runLogSchema.array().parse(logs))
  }

  async getRunResult(userId: string, runId: string): Promise<RunResult | null> {
    const run = await this.requireRun(userId, runId)
    const result = await runServiceDeps.getRunProvider().getResult(run.id)
    return result ? sanitizeRunResult(runResultSchema.parse(result)) : null
  }

  async getRunControlUiLink(userId: string, runId: string): Promise<RunControlUiLink> {
    const run = await this.getRun(userId, runId)

    if (run.status === 'provisioning') {
      throw new HttpError(409, 'Control UI is still starting. Try again in a few moments.')
    }

    if (run.status === 'failed') {
      throw new HttpError(409, 'Control UI is unavailable because this run is no longer active.')
    }

    const provider = runServiceDeps.getRunProvider()

    if (!provider.getControlUiLink) {
      throw new HttpError(409, 'Control UI is not available for this run.')
    }

    const link = await provider.getControlUiLink(run.id)

    if (!link) {
      throw new HttpError(404, 'Control UI link could not be created for this run.')
    }

    return link
  }

  async stopRun(userId: string, runId: string) {
    const run = await this.requireRun(userId, runId)
    const stopped = await runServiceDeps.getRunProvider().stopRun(run.id)

    if (!stopped) {
      return run
    }

    return (await this.repository.updateRun(run.id, stopped)) ?? stopped
  }

  async retryRun(userId: string, runId: string) {
    const run = await this.requireRun(userId, runId)
    return this.createRun(userId, run.orderId)
  }

  scanAgentVersion(version: AgentVersion) {
    return riskProfileSchema.parse(scanAgentVersionRiskProfile(version))
  }

  private async requireRun(userId: string, runId: string) {
    const run = await this.repository.findRunForUser(runId, userId)

    if (!run) {
      throw new HttpError(404, 'Run not found.')
    }

    return run
  }

  private async syncRun(run: Run, persist: boolean) {
    const providerRun = await runServiceDeps.getRunProvider().getStatus(run.id)

    if (!providerRun) {
      return sanitizeRun(run)
    }

    const result = await runServiceDeps.getRunProvider().getResult(run.id)
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
      return sanitizeRun(nextRun)
    }

    const persistedRun = (await this.repository.updateRun(run.id, nextRun)) ?? nextRun
    return sanitizeRun(persistedRun)
  }
}

let runServiceOverride: RunService | null = null
const defaultRunServiceDeps = {
  getOrderByIdForUser,
  getRunProvider,
  getTelegramService,
}
let runServiceDeps = defaultRunServiceDeps

export function getRunService() {
  return runServiceOverride ?? new RunService()
}

export function setRunServiceForTesting(service: RunService | null) {
  runServiceOverride = service
}

export function setRunServiceDepsForTesting(
  overrides: Partial<typeof defaultRunServiceDeps> | null,
) {
  runServiceDeps = overrides ? { ...defaultRunServiceDeps, ...overrides } : defaultRunServiceDeps
}
