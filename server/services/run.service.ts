import { riskProfileSchema, runLogSchema, runResultSchema } from '@/lib/schemas'
import type { AgentVersion, Order, Run, RunLog, RunResult } from '@/lib/types'

import { HttpError } from '../lib/http'
import { scanAgentVersion as scanAgentVersionRiskProfile } from '../lib/risk-engine'
import { getRunProvider } from '../providers'
import type { RunControlUiLink } from '../providers/run-provider.interface'
import { getOrderByIdForUser, getOrderProviderApiKeysForUser } from './order.service'
import { RunRepository } from './run.repository'
import { getSubscriptionService } from './subscription.service'
import { getTelegramService } from './telegram.service'

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

function isStoppedSandboxReadError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  return (
    message.includes('sandbox is not started') ||
    message.includes('toolbox unavailable after sandbox stop') ||
    message.includes('sandbox is stopped') ||
    message.includes('sandbox is stopping')
  )
}

function buildStoppedRun(run: Run): Run {
  const stoppedAt = nowIso()
  return {
    ...run,
    completedAt: run.completedAt ?? stoppedAt,
    resultSummary:
      run.status === 'failed' && run.resultSummary
        ? run.resultSummary
        : 'Managed runtime is no longer available.',
    status: 'failed',
    updatedAt: stoppedAt,
  }
}

function nowIso() {
  return new Date().toISOString()
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

function buildPendingRun(order: Order, runId: string, providerName: string): Run {
  const createdAt = new Date().toISOString()
  const usesTools = order.items.some((item) => {
    const risk = item.agentVersion.riskProfile
    return risk.readFiles || risk.writeFiles || risk.shell
  })

  return {
    id: runId,
    userId: order.userId,
    orderId: order.id,
    channelConfigId: order.channelConfig?.id ?? 'channel-pending',
    status: 'provisioning',
    combinedRiskLevel: order.bundleRisk.level,
    usesRealWorkspace: providerName !== 'openai',
    usesTools,
    networkEnabled: order.items.some((item) => item.agentVersion.riskProfile.network),
    resultSummary: 'Managed runtime is provisioning. Status will update automatically.',
    resultArtifacts: [],
    createdAt,
    startedAt: null,
    updatedAt: createdAt,
    completedAt: null,
  }
}

export class RunService {
  constructor(
    private readonly repository: RunRepository = new RunRepository(),
  ) {}

  async createRun(userId: string, orderId: string) {
    await runServiceDeps.getTelegramService().getChannelConfig({ orderId, userId })
    const order = await runServiceDeps.getOrderByIdForUser({ orderId, userId })
    const launchPolicy = await runServiceDeps.getSubscriptionService().getLaunchPolicy(userId, order)

    if (!launchPolicy.allowed) {
      throw new HttpError(409, launchPolicy.blockers.join(' '))
    }

    const providerApiKeys = runServiceDeps.getOrderProviderApiKeysForUser
      ? await runServiceDeps.getOrderProviderApiKeysForUser({ orderId, userId })
      : {}
    ensureLaunchable(order)

    const provider = runServiceDeps.getRunProvider()
    const runId = `run-${Date.now()}`
    const pendingRun = buildPendingRun(order, runId, provider.name)
    const createdRun = await this.repository.createRun(pendingRun)

    void provider
      .createRun(order, runId, {
        providerApiKeys,
      })
      .then(async (providerRun) => {
        await this.repository.updateRun(runId, {
          ...providerRun,
          id: runId,
        })
      })
      .catch(async (error) => {
        const failedAt = new Date().toISOString()
        const message =
          error instanceof Error && error.message
            ? error.message
            : 'Managed runtime provisioning failed.'

        await this.repository.updateRun(runId, {
          completedAt: failedAt,
          resultSummary: message,
          startedAt: createdRun.startedAt,
          status: 'failed',
          updatedAt: failedAt,
        })
      })

    return createdRun
  }

  async listRuns(userId: string) {
    const runs = await this.repository.listRunsForUser(userId)
    return Promise.all(runs.map((run) => this.syncRun(run, false)))
  }

  /** Load run and sync latest status from provider (e.g. Daytona); persists merged run to repo. */
  async getRun(userId: string, runId: string) {
    const run = await this.requireRun(userId, runId)
    return this.syncRun(run, true)
  }

  async getRunLogs(userId: string, runId: string): Promise<RunLog[]> {
    const run = await this.requireRun(userId, runId)
    try {
      const logs = await runServiceDeps.getRunProvider().getLogs(run.id)
      return sanitizeRunLogs(runLogSchema.array().parse(logs))
    } catch {
      return []
    }
  }

  async getRunResult(userId: string, runId: string): Promise<RunResult | null> {
    const run = await this.requireRun(userId, runId)
    try {
      const result = await runServiceDeps.getRunProvider().getResult(run.id)
      return result ? sanitizeRunResult(runResultSchema.parse(result)) : null
    } catch {
      return run.resultSummary || run.resultArtifacts.length > 0
        ? sanitizeRunResult({
            artifacts: run.resultArtifacts,
            summary: run.resultSummary ?? 'Run result unavailable.',
          })
        : null
    }
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
    const stopped = await runServiceDeps.getRunProvider().stopRun(run.id, run)
    if (!stopped) {
      const stoppedAt = new Date().toISOString()
      return (
        (await this.repository.updateRun(run.id, {
          completedAt: stoppedAt,
          resultSummary: 'Run stopped by operator request.',
          status: 'failed',
          updatedAt: stoppedAt,
        })) ?? {
          ...run,
          completedAt: stoppedAt,
          resultSummary: 'Run stopped by operator request.',
          status: 'failed',
          updatedAt: stoppedAt,
        }
      )
    }

    return (await this.repository.updateRun(run.id, stopped)) ?? stopped
  }

  async retryRun(userId: string, runId: string) {
    const run = await this.requireRun(userId, runId)
    const provider = runServiceDeps.getRunProvider()

    if (run.status !== 'failed') {
      throw new HttpError(409, 'Only stopped runs can be restarted.')
    }

    if (run.usesRealWorkspace && provider.restartRun) {
      const order = await runServiceDeps.getOrderByIdForUser({
        orderId: run.orderId,
        userId,
      })
      const providerApiKeys = runServiceDeps.getOrderProviderApiKeysForUser
        ? await runServiceDeps.getOrderProviderApiKeysForUser({
            orderId: run.orderId,
            userId,
          })
        : {}
      const restarted = await provider.restartRun(run.id, order, run, {
        providerApiKeys,
      })

      if (!restarted) {
        throw new HttpError(409, 'Managed runtime sandbox could not be restarted.')
      }

      return (await this.repository.updateRun(run.id, restarted)) ?? restarted
    }

    if (run.usesRealWorkspace) {
      throw new HttpError(409, 'Managed runtime restart is unavailable for this provider.')
    }

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

  /** Pull latest status/result from provider (e.g. Daytona sandbox), merge with run, optionally persist. */
  private async syncRun(run: Run, persist: boolean) {
    let providerRun: Run | null = null

    try {
      providerRun = await runServiceDeps.getRunProvider().getStatus(run.id)
    } catch (error) {
      if (isStoppedSandboxReadError(error)) {
        const stoppedRun = buildStoppedRun(run)
        if (!persist) {
          return sanitizeRun(stoppedRun)
        }

        const persistedRun = (await this.repository.updateRun(run.id, stoppedRun)) ?? stoppedRun
        return sanitizeRun(persistedRun)
      }

      return sanitizeRun(run)
    }

    if (!providerRun) {
      return sanitizeRun(run)
    }

    let result: RunResult | null = null

    try {
      const providerResult = await runServiceDeps.getRunProvider().getResult(run.id)
      result = providerResult ? runResultSchema.parse(providerResult) : null
    } catch {
      result = null
    }

    const nextRun: Run = {
      ...run,
      status: providerRun.status,
      combinedRiskLevel: providerRun.combinedRiskLevel,
      usesRealWorkspace: providerRun.usesRealWorkspace,
      usesTools: providerRun.usesTools,
      networkEnabled: providerRun.networkEnabled,
      resultSummary: result?.summary ?? providerRun.resultSummary ?? run.resultSummary,
      resultArtifacts: result?.artifacts ?? providerRun.resultArtifacts ?? run.resultArtifacts,
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
  getOrderProviderApiKeysForUser,
  getRunProvider,
  getSubscriptionService,
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
