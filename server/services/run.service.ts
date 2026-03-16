import { riskProfileSchema, runLogSchema, runResultSchema } from '@/lib/schemas'
import { getSubscriptionPlan } from '@/lib/subscription-plans'
import type {
  AgentVersion,
  Order,
  Run,
  RunLog,
  RunResult,
  RunTerminationReason,
  RunUsage,
  RuntimeInstance,
  RuntimeInstanceState,
  SubscriptionPlan,
} from '@/lib/types'

import { HttpError } from '../lib/http'
import { scanAgentVersion as scanAgentVersionRiskProfile } from '../lib/risk-engine'
import { getRunProvider } from '../providers'
import type { RunControlUiLink, RuntimeProviderInstance } from '../providers/run-provider.interface'
import { launchAttempts } from '../db/schema'
import { LaunchAttemptRepository } from './launch-attempt.repository'
import { getOrderByIdForUser, getOrderProviderApiKeysForUser } from './order.service'
import { RunRepository } from './run.repository'
import { RuntimeInstanceRepository } from './runtime-instance.repository'
import { getSubscriptionService } from './subscription.service'
import { getTelegramService } from './telegram.service'
import {
  getProvisioningFailureReason,
  getRuntimeLifecyclePolicy,
  getTtlPolicySnapshot,
  RUNTIME_PLAN_VERSION,
} from './runtime-policy'

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

function buildRunUsage(run: Run, order: Order, plan: SubscriptionPlan): RunUsage {
  return {
    id: crypto.randomUUID(),
    runId: run.id,
    userId: run.userId,
    orderId: order.id,
    planId: plan.id,
    planVersion: RUNTIME_PLAN_VERSION,
    triggerModeSnapshot: plan.triggerMode,
    agentCount: order.items.length,
    usesRealWorkspace: run.usesRealWorkspace,
    usesTools: run.usesTools,
    networkEnabled: run.networkEnabled,
    provisioningStartedAt: run.createdAt,
    providerAcceptedAt: null,
    runningStartedAt: null,
    lastMeaningfulActivityAt: null,
    completedAt: null,
    workspaceReleasedAt: null,
    terminationReason: null,
    workspaceMinutes: null,
    toolCallsCount: null,
    inputTokensEst: null,
    outputTokensEst: null,
    estimatedInternalCostCents: null,
    statusSnapshot: 'provisioning',
    ttlPolicySnapshot: getTtlPolicySnapshot(plan),
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
  }
}

function buildReleasedUsagePatch(run: Run, reason: RunTerminationReason): Partial<RunUsage> {
  const completedAt = run.completedAt ?? nowIso()
  return {
    completedAt,
    statusSnapshot: run.status,
    terminationReason: reason,
    updatedAt: nowIso(),
    workspaceReleasedAt: completedAt,
  }
}

function buildTerminationSummary(reason: RunTerminationReason) {
  switch (reason) {
    case 'ttl_expired':
      return 'Managed runtime reached its maximum session TTL and was stopped.'
    case 'idle_timeout':
      return 'Managed runtime was stopped after inactivity.'
    case 'provisioning_timeout':
      return 'Managed runtime provisioning timed out before the session became active.'
    case 'backend_maintenance':
      return 'Managed runtime was stopped during maintenance.'
    case 'manual_stop':
      return 'Run stopped by operator request.'
    default:
      return 'Managed runtime session ended.'
  }
}

function toLaunchAttemptBlockerReason(message: string) {
  const normalized = message.toLowerCase()

  if (
    normalized.includes('telegram setup is missing') ||
    normalized.includes('telegram bot token must be validated') ||
    normalized.includes('telegram pairing must be completed')
  ) {
    return 'telegram_not_ready'
  }

  if (normalized.includes('does not include run launches')) {
    return 'no_runtime_access'
  }

  if (normalized.includes('at most') && normalized.includes('agent')) {
    return 'bundle_too_large'
  }

  if (normalized.includes('active managed session')) {
    return 'concurrent_limit'
  }

  if (normalized.includes('live managed setup')) {
    return 'active_bundle_limit'
  }

  if (normalized.includes('no credits remaining')) {
    return 'credits_exhausted'
  }

  if (normalized.includes('order must be paid')) {
    return 'order_not_paid'
  }

  if (normalized.includes('order has no agent versions')) {
    return 'empty_bundle'
  }

  return 'unknown'
}

function mapRuntimeStateToRunStatus(
  state: RuntimeInstanceState,
): Run['status'] {
  switch (state) {
    case 'running':
      return 'running'
    case 'failed':
      return 'failed'
    case 'stopped':
    case 'archived':
    case 'deleted':
      return 'completed'
    case 'provisioning':
    default:
      return 'provisioning'
  }
}

function buildRuntimeInstanceRecord(
  order: Order,
  plan: SubscriptionPlan,
  instance: RuntimeProviderInstance,
): RuntimeInstance {
  const now = nowIso()
  return {
    id: crypto.randomUUID(),
    runId: instance.runId,
    userId: order.userId,
    orderId: order.id,
    providerName: instance.providerName,
    providerInstanceRef: instance.providerInstanceRef,
    planId: plan.id,
    runtimeMode: instance.runtimeMode,
    persistenceMode: instance.persistenceMode,
    state: instance.state,
    stopReason: instance.stopReason,
    preservedStateAvailable: instance.preservedStateAvailable,
    startedAt: instance.startedAt,
    stoppedAt: instance.stoppedAt,
    archivedAt: instance.archivedAt,
    deletedAt: instance.deletedAt,
    recoverableUntilAt: instance.recoverableUntilAt,
    workspaceReleasedAt: instance.workspaceReleasedAt,
    lastReconciledAt: instance.lastReconciledAt ?? now,
    metadataJson: instance.metadataJson,
    createdAt: now,
    updatedAt: now,
  }
}

function buildRuntimeInstanceRecordFromRun(
  run: Run,
  instance: RuntimeProviderInstance,
): RuntimeInstance {
  const now = nowIso()
  return {
    id: crypto.randomUUID(),
    runId: instance.runId,
    userId: run.userId,
    orderId: run.orderId,
    providerName: instance.providerName,
    providerInstanceRef: instance.providerInstanceRef,
    planId: instance.planId,
    runtimeMode: instance.runtimeMode,
    persistenceMode: instance.persistenceMode,
    state: instance.state,
    stopReason: instance.stopReason,
    preservedStateAvailable: instance.preservedStateAvailable,
    startedAt: instance.startedAt,
    stoppedAt: instance.stoppedAt,
    archivedAt: instance.archivedAt,
    deletedAt: instance.deletedAt,
    recoverableUntilAt: instance.recoverableUntilAt,
    workspaceReleasedAt: instance.workspaceReleasedAt,
    lastReconciledAt: instance.lastReconciledAt ?? now,
    metadataJson: instance.metadataJson,
    createdAt: now,
    updatedAt: now,
  }
}

function buildRunPatchFromRuntime(
  run: Run,
  instance: Pick<
    RuntimeProviderInstance,
    | 'archivedAt'
    | 'deletedAt'
    | 'lastReconciledAt'
    | 'persistenceMode'
    | 'startedAt'
    | 'state'
    | 'stoppedAt'
  >,
): Partial<Run> {
  const status = mapRuntimeStateToRunStatus(instance.state)
  const defaultSummary =
    instance.state === 'stopped'
      ? instance.persistenceMode === 'recoverable'
        ? 'Managed runtime is sleeping and can be resumed later.'
        : 'Managed runtime session ended.'
      : instance.state === 'archived'
        ? 'Managed runtime is archived and can be recovered later.'
        : instance.state === 'deleted'
          ? 'Managed runtime session ended and state was released.'
          : instance.state === 'failed'
            ? 'Managed runtime is no longer available.'
            : 'Managed runtime is provisioning. Status will update automatically.'

  return {
    completedAt:
      status === 'completed' || status === 'failed'
        ? instance.deletedAt ?? instance.archivedAt ?? instance.stoppedAt ?? run.completedAt ?? nowIso()
        : null,
    resultSummary: run.resultSummary ?? defaultSummary,
    startedAt: instance.startedAt ?? run.startedAt,
    status,
    updatedAt: instance.lastReconciledAt ?? nowIso(),
  }
}

function applyRuntimeStateToRun(
  run: Run,
  instance: Pick<
    RuntimeProviderInstance,
    | 'archivedAt'
    | 'deletedAt'
    | 'lastReconciledAt'
    | 'persistenceMode'
    | 'startedAt'
    | 'state'
    | 'stoppedAt'
  > | null,
): Run {
  if (!instance) {
    return run
  }

  return {
    ...run,
    ...buildRunPatchFromRuntime(run, instance),
  }
}

function shouldArchiveRecoverableRuntime(runtime: RuntimeInstance) {
  if (runtime.persistenceMode !== 'recoverable' || runtime.state !== 'stopped' || !runtime.stoppedAt) {
    return false
  }
  const policy = getRuntimeLifecyclePolicy(getSubscriptionPlan(runtime.planId))
  if (policy.autoArchiveMinutes == null) {
    return false
  }
  const stoppedAtMs = new Date(runtime.stoppedAt).getTime()
  if (Number.isNaN(stoppedAtMs)) {
    return false
  }
  return Date.now() - stoppedAtMs >= policy.autoArchiveMinutes * 60 * 1000
}

export class RunService {
  constructor(
    private readonly repository: RunRepository = new RunRepository(),
    private readonly runtimeRepository: RuntimeInstanceRepository = new RuntimeInstanceRepository(),
    private readonly launchAttemptRepository: LaunchAttemptRepository = new LaunchAttemptRepository(),
  ) {}

  async createRun(userId: string, orderId: string) {
    await runServiceDeps.getTelegramService().getChannelConfig({ orderId, userId })
    const order = await runServiceDeps.getOrderByIdForUser({ orderId, userId })
    const subscriptionService = runServiceDeps.getSubscriptionService()
    const launchPolicy = await subscriptionService.getLaunchPolicy(userId, order)

    if (!launchPolicy.allowed) {
      await this.createLaunchAttemptSafe({
        agentCountSnapshot: order.items.length,
        attemptedAt: new Date(),
        blockerReason: toLaunchAttemptBlockerReason(launchPolicy.blockers[0] ?? 'unknown'),
        id: crypto.randomUUID(),
        metadataJson: {
          blockers: launchPolicy.blockers,
          source: 'launch_policy',
        },
        orderId,
        planCodeSnapshot: launchPolicy.plan.id,
        remainingCreditsSnapshot: launchPolicy.subscription?.remainingCredits ?? null,
        result: 'blocked',
        runId: null,
        userId,
      })
      throw new HttpError(409, launchPolicy.blockers.join(' '))
    }

    const providerApiKeys = runServiceDeps.getOrderProviderApiKeysForUser
      ? await runServiceDeps.getOrderProviderApiKeysForUser({ orderId, userId })
      : {}
    try {
      ensureLaunchable(order)
    } catch (error) {
      if (error instanceof HttpError) {
        await this.createLaunchAttemptSafe({
          agentCountSnapshot: order.items.length,
          attemptedAt: new Date(),
          blockerReason: toLaunchAttemptBlockerReason(error.message),
          id: crypto.randomUUID(),
          metadataJson: {
            error: error.message,
            source: 'ensure_launchable',
          },
          orderId,
          planCodeSnapshot: launchPolicy.plan.id,
          remainingCreditsSnapshot: launchPolicy.subscription?.remainingCredits ?? null,
          result: 'blocked',
          runId: null,
          userId,
        })
      }
      throw error
    }

    const provider = runServiceDeps.getRunProvider()
    const runId = `run-${Date.now()}`
    const launchAttemptId = `launch-attempt-${runId}`
    const pendingRun = buildPendingRun(order, runId, provider.name)
    const lifecyclePolicy = getRuntimeLifecyclePolicy(launchPolicy.plan)
    await subscriptionService.reserveLaunchCredit?.({
      orderId,
      plan: launchPolicy.plan,
      runId,
      subscriptionId: launchPolicy.subscription?.id ?? null,
      userId,
    })
    await this.createLaunchAttemptSafe({
      agentCountSnapshot: order.items.length,
      attemptedAt: new Date(),
      blockerReason: null,
      id: launchAttemptId,
      metadataJson: {
        source: 'create_run',
      },
      orderId,
      planCodeSnapshot: launchPolicy.plan.id,
      remainingCreditsSnapshot: launchPolicy.subscription?.remainingCredits ?? null,
      result: 'reserved',
      runId,
      userId,
    })

    let createdRun: Run

    try {
      if ('createProvisioningRun' in this.repository && typeof this.repository.createProvisioningRun === 'function') {
        const created = await this.repository.createProvisioningRun(
          pendingRun,
          buildRunUsage(pendingRun, order, launchPolicy.plan),
        )
        createdRun = created.run
      } else {
        createdRun = await this.repository.createRun(pendingRun)
      }
    } catch (error) {
      await subscriptionService.refundReservedLaunchCredit?.({
        plan: launchPolicy.plan,
        reasonCode: 'run_row_create_failed',
        runId,
        userId,
      })
      await this.updateLaunchAttemptSafe(launchAttemptId, {
        blockerReason: 'run_row_create_failed',
        metadataJson: {
          message: error instanceof Error ? error.message : 'run row create failed',
          source: 'create_provisioning_run',
        },
        result: 'failed_before_accept',
      })
      throw error
    }

    const providerCreatePromise = provider.createRuntimeInstance
      ? provider
          .createRuntimeInstance({
            lifecyclePolicy,
            order,
            planId: launchPolicy.plan.id,
            runId,
            runtimeConfig: {
              providerApiKeys,
            },
          })
          .then(async (runtimeInstance) => {
            const existingRuntime = await this.findRuntimeRecordSafe(runId)
            if (existingRuntime) {
              await this.updateRuntimeRecordSafe(runId, {
                ...runtimeInstance,
                lastReconciledAt: runtimeInstance.lastReconciledAt ?? nowIso(),
              })
            } else {
              await this.createRuntimeRecordSafe(
                buildRuntimeInstanceRecord(order, launchPolicy.plan, runtimeInstance),
              )
            }
            return provider.getStatus(runId)
          })
      : provider.createRun(order, runId, {
          providerApiKeys,
        })

    void providerCreatePromise
      .then(async (providerRun) => {
        if (!providerRun) {
          return
        }
        await subscriptionService.commitReservedLaunchCredit?.({
          plan: launchPolicy.plan,
          runId,
          userId,
        })
        await this.repository.updateRun(runId, {
          ...providerRun,
          id: runId,
        })
        await this.repository.updateRunUsage?.(runId, {
          lastMeaningfulActivityAt:
            providerRun.startedAt ?? (providerRun.status === 'running' ? nowIso() : null),
          providerAcceptedAt: nowIso(),
          runningStartedAt: providerRun.startedAt ?? (providerRun.status === 'running' ? nowIso() : null),
          statusSnapshot: providerRun.status,
          updatedAt: nowIso(),
          workspaceReleasedAt:
            providerRun.status === 'completed' || providerRun.status === 'failed'
              ? providerRun.completedAt ?? nowIso()
              : null,
        })
        await this.updateLaunchAttemptSafe(launchAttemptId, {
          blockerReason: null,
          metadataJson: {
            providerStatus: providerRun.status,
            source: 'provider_accept',
          },
          result: 'provider_accepted',
        })
      })
      .catch(async (error) => {
        const failedAt = new Date().toISOString()
        const message =
          error instanceof Error && error.message
            ? error.message
            : 'Managed runtime provisioning failed.'

        await subscriptionService.refundReservedLaunchCredit?.({
          plan: launchPolicy.plan,
          reasonCode:
            message.toLowerCase().includes('timeout') ? 'provisioning_timeout' : 'provider_not_accepted',
          runId,
          userId,
        })
        await this.repository.updateRun(runId, {
          completedAt: failedAt,
          resultSummary: message,
          startedAt: createdRun.startedAt,
          status: 'failed',
          updatedAt: failedAt,
        })
        await this.repository.updateRunUsage?.(runId, {
          completedAt: failedAt,
          statusSnapshot: 'failed',
          terminationReason: getProvisioningFailureReason(launchPolicy.plan.id),
          updatedAt: failedAt,
          workspaceReleasedAt: failedAt,
        })
        await this.updateLaunchAttemptSafe(launchAttemptId, {
          blockerReason:
            message.toLowerCase().includes('timeout') ? 'provisioning_timeout' : 'provider_not_accepted',
          metadataJson: {
            message,
            source: 'provider_reject',
          },
          result: 'failed_before_accept',
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
    return this.stopRunForReason(userId, runId, 'manual_stop')
  }

  async stopRunForReason(userId: string, runId: string, reason: RunTerminationReason) {
    const run = await this.requireRun(userId, runId)
    const provider = runServiceDeps.getRunProvider()
    const runtime = provider.stopRuntimeInstance
      ? await provider.stopRuntimeInstance(run.id, reason, run)
      : null

    if (runtime) {
      const existingRuntime = await this.findRuntimeRecordSafe(run.id)
      const updatedRuntime = existingRuntime
        ? await this.updateRuntimeRecordSafe(run.id, {
            ...runtime,
            lastReconciledAt: runtime.lastReconciledAt ?? nowIso(),
          })
        : null

      if (runtime.state === 'stopped' && runtime.persistenceMode === 'ephemeral' && provider.deleteRuntimeInstance) {
        await provider.deleteRuntimeInstance(run.id)
        await this.updateRuntimeRecordSafe(run.id, {
          deletedAt: nowIso(),
          lastReconciledAt: nowIso(),
          preservedStateAvailable: false,
          state: 'deleted',
          workspaceReleasedAt: nowIso(),
        })
      }

      const nextRun = (await this.repository.updateRun(run.id, buildRunPatchFromRuntime(run, runtime))) ?? {
        ...run,
        ...buildRunPatchFromRuntime(run, runtime),
      }
      await this.repository.updateRunUsage?.(run.id, buildReleasedUsagePatch(nextRun, reason))
      if (updatedRuntime?.id) {
        await this.runtimeRepository.closeRuntimeInterval(updatedRuntime.id, nowIso(), reason)
      }
      return nextRun
    }

    const stopped = await provider.stopRun(run.id, run)
    if (!stopped) {
      const stoppedAt = new Date().toISOString()
      const fallbackStatus = reason === 'provider_error' || reason === 'provider_unhealthy' ? 'failed' : 'completed'
      const nextRun =
        (await this.repository.updateRun(run.id, {
          completedAt: stoppedAt,
          resultSummary: buildTerminationSummary(reason),
          status: fallbackStatus,
          updatedAt: stoppedAt,
        })) ?? {
          ...run,
          completedAt: stoppedAt,
          resultSummary: buildTerminationSummary(reason),
          status: fallbackStatus,
          updatedAt: stoppedAt,
        }
      await this.repository.updateRunUsage?.(run.id, buildReleasedUsagePatch(nextRun, reason))
      return nextRun
    }

    const nextRun = (await this.repository.updateRun(run.id, stopped)) ?? stopped
    await this.repository.updateRunUsage?.(run.id, buildReleasedUsagePatch(nextRun, reason))
    return nextRun
  }

  async retryRun(userId: string, runId: string) {
    const run = await this.requireRun(userId, runId)
    const provider = runServiceDeps.getRunProvider()
    const subscriptionService = runServiceDeps.getSubscriptionService()

    if (run.status !== 'failed') {
      throw new HttpError(409, 'Only stopped runs can be restarted.')
    }

    if (run.usesRealWorkspace && (provider.restartRuntimeInstance || provider.restartRun)) {
      const order = await runServiceDeps.getOrderByIdForUser({
        orderId: run.orderId,
        userId,
      })
      const launchPolicy = await subscriptionService.getLaunchPolicy(userId, order)

      if (!launchPolicy.allowed) {
        throw new HttpError(409, launchPolicy.blockers.join(' '))
      }

      const chargeKey = `restart:${run.id}:${run.updatedAt}`
      const providerApiKeys = runServiceDeps.getOrderProviderApiKeysForUser
        ? await runServiceDeps.getOrderProviderApiKeysForUser({
            orderId: run.orderId,
            userId,
          })
        : {}
      await subscriptionService.reserveLaunchCredit?.({
        chargeKey,
        orderId: order.id,
        plan: launchPolicy.plan,
        runId: run.id,
        subscriptionId: launchPolicy.subscription?.id ?? null,
        userId,
      })

      let restarted: Run | null = null

      try {
        if (provider.restartRuntimeInstance) {
          const runtime = await provider.restartRuntimeInstance(
            run.id,
            order,
            getRuntimeLifecyclePolicy(launchPolicy.plan),
            {
              providerApiKeys,
            },
          )

          if (runtime) {
            await this.updateRuntimeRecordSafe(run.id, {
              ...runtime,
              lastReconciledAt: runtime.lastReconciledAt ?? nowIso(),
              state: runtime.state,
              stopReason: null,
            })

            const existingRuntime = await this.findRuntimeRecordSafe(run.id)
            if (existingRuntime && !(await this.findOpenRuntimeIntervalSafe(existingRuntime.id))) {
              await this.createRuntimeIntervalSafe({
                id: crypto.randomUUID(),
                runtimeInstanceId: existingRuntime.id,
                runId: run.id,
                providerInstanceRef: existingRuntime.providerInstanceRef,
                startedAt: runtime.startedAt ?? nowIso(),
                endedAt: null,
                closeReason: null,
                createdAt: nowIso(),
                updatedAt: nowIso(),
              })
            }

            restarted = (await provider.getStatus(run.id)) ?? {
              ...run,
              ...buildRunPatchFromRuntime(run, runtime),
            }
          } else {
            restarted = null
          }
        } else {
          restarted = provider.restartRun
            ? await provider.restartRun(run.id, order, run, {
                providerApiKeys,
              })
            : null
        }
      } catch (error) {
        await subscriptionService.refundReservedLaunchCredit?.({
          chargeKey,
          plan: launchPolicy.plan,
          reasonCode: 'restart_provider_error',
          runId: run.id,
          userId,
        })
        throw error
      }

      if (!restarted) {
        await subscriptionService.refundReservedLaunchCredit?.({
          chargeKey,
          plan: launchPolicy.plan,
          reasonCode: 'restart_provider_rejected',
          runId: run.id,
          userId,
        })
        throw new HttpError(409, 'Managed runtime sandbox could not be restarted.')
      }

      await subscriptionService.commitReservedLaunchCredit?.({
        chargeKey,
        plan: launchPolicy.plan,
        runId: run.id,
        userId,
      })
      await this.repository.updateRunUsage?.(run.id, {
        completedAt: null,
        lastMeaningfulActivityAt: restarted.startedAt ?? nowIso(),
        providerAcceptedAt: nowIso(),
        runningStartedAt: restarted.startedAt ?? nowIso(),
        statusSnapshot: restarted.status,
        terminationReason: null,
        updatedAt: nowIso(),
        workspaceReleasedAt: null,
      })
      await this.updateLaunchAttemptSafe(`launch-attempt-${run.id}`, {
        blockerReason: null,
        metadataJson: {
          providerStatus: restarted.status,
          source: 'restart_provider_accept',
        },
        result: 'provider_accepted',
      })
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

  async recordMeaningfulActivity(runId: string, occurredAt = nowIso()) {
    const usage = await this.repository.findRunUsage?.(runId)
    if (!usage) {
      throw new HttpError(404, 'Run usage not found.')
    }

    await this.repository.updateRunUsage?.(runId, {
      lastMeaningfulActivityAt: occurredAt,
      updatedAt: nowIso(),
    })

    return {
      occurredAt,
      runId,
    }
  }

  async recordMeaningfulActivityForOrder(orderId: string, occurredAt = nowIso()) {
    const runs = 'listRunsForOrder' in this.repository && typeof this.repository.listRunsForOrder === 'function'
      ? await this.repository.listRunsForOrder(orderId)
      : []
    const touchedRunIds: string[] = []

    for (const run of runs) {
      const usage = await this.repository.findRunUsage?.(run.id)
      if (!usage || usage.workspaceReleasedAt) {
        continue
      }

      await this.repository.updateRunUsage?.(run.id, {
        lastMeaningfulActivityAt: occurredAt,
        updatedAt: nowIso(),
      })
      touchedRunIds.push(run.id)
    }

    return {
      occurredAt,
      orderId,
      touchedRunIds,
    }
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
    const provider = runServiceDeps.getRunProvider()
    const runtimeRecord = await this.findRuntimeRecordSafe(run.id)
    let runtimeInstance: RuntimeProviderInstance | null = null

    try {
      if (provider.getRuntimeInstance) {
        runtimeInstance = await provider.getRuntimeInstance(run.id)
      }
      providerRun = await provider.getStatus(run.id)
    } catch (error) {
      if (isStoppedSandboxReadError(error)) {
        const stoppedRun = buildStoppedRun(run)
        if (!persist) {
          return sanitizeRun(stoppedRun)
        }

        const persistedRun = (await this.repository.updateRun(run.id, stoppedRun)) ?? stoppedRun
        await this.repository.updateRunUsage?.(run.id, buildReleasedUsagePatch(persistedRun, 'provider_unhealthy'))
        return sanitizeRun(persistedRun)
      }

      return sanitizeRun(run)
    }

    if (!providerRun) {
      let persistedRuntime = runtimeRecord
      let effectiveRuntime: RuntimeProviderInstance | RuntimeInstance | null = runtimeInstance

      if (runtimeInstance && persist) {
        persistedRuntime = runtimeRecord
          ? await this.updateRuntimeRecordSafe(run.id, {
              ...runtimeInstance,
              lastReconciledAt: runtimeInstance.lastReconciledAt ?? nowIso(),
            })
          : await this.createRuntimeRecordSafe(buildRuntimeInstanceRecordFromRun(run, runtimeInstance))

        if (persistedRuntime) {
          if (shouldArchiveRecoverableRuntime(persistedRuntime) && provider.archiveRuntimeInstance) {
            const archived = await provider.archiveRuntimeInstance(run.id)
            if (archived) {
              persistedRuntime = await this.updateRuntimeRecordSafe(run.id, {
                ...archived,
                archivedAt: archived.archivedAt ?? nowIso(),
                lastReconciledAt: archived.lastReconciledAt ?? nowIso(),
                preservedStateAvailable: true,
                state: 'archived',
              })
              effectiveRuntime = {
                ...archived,
                archivedAt: archived.archivedAt ?? nowIso(),
                lastReconciledAt: archived.lastReconciledAt ?? nowIso(),
                preservedStateAvailable: true,
                state: 'archived',
              }
            }
          }

          if (persistedRuntime && runtimeInstance.state === 'running') {
            const openInterval = await this.findOpenRuntimeIntervalSafe(persistedRuntime.id)
            if (!openInterval) {
              await this.createRuntimeIntervalSafe({
                id: crypto.randomUUID(),
                runtimeInstanceId: persistedRuntime.id,
                runId: run.id,
                providerInstanceRef: persistedRuntime.providerInstanceRef,
                startedAt: runtimeInstance.startedAt ?? nowIso(),
                endedAt: null,
                closeReason: null,
                createdAt: nowIso(),
                updatedAt: nowIso(),
              })
            }
          }

          if (
            persistedRuntime &&
            (runtimeInstance.state === 'stopped' ||
              runtimeInstance.state === 'archived' ||
              runtimeInstance.state === 'deleted' ||
              runtimeInstance.state === 'failed')
          ) {
            await this.closeRuntimeIntervalSafe(
              persistedRuntime.id,
              runtimeInstance.stoppedAt ?? runtimeInstance.archivedAt ?? runtimeInstance.deletedAt ?? nowIso(),
              runtimeInstance.stopReason,
            )
          }

          if (
            persistedRuntime &&
            runtimeInstance.state === 'stopped' &&
            runtimeInstance.persistenceMode === 'ephemeral' &&
            provider.deleteRuntimeInstance
          ) {
            const deletedAt = nowIso()
            await provider.deleteRuntimeInstance(run.id)
            persistedRuntime = await this.updateRuntimeRecordSafe(run.id, {
              deletedAt,
              lastReconciledAt: deletedAt,
              preservedStateAvailable: false,
              state: 'deleted',
              workspaceReleasedAt: deletedAt,
            })
            effectiveRuntime = {
              ...runtimeInstance,
              deletedAt,
              lastReconciledAt: deletedAt,
              preservedStateAvailable: false,
              state: 'deleted',
              workspaceReleasedAt: deletedAt,
            }
          }
        }
      }

      const runtimeOnlyRun = applyRuntimeStateToRun(run, effectiveRuntime)
      if (!persist) {
        return sanitizeRun(runtimeOnlyRun)
      }

      const persistedRun = (await this.repository.updateRun(run.id, runtimeOnlyRun)) ?? runtimeOnlyRun
      if (persistedRuntime?.state === 'running') {
        await this.repository.updateRunUsage?.(run.id, {
          lastMeaningfulActivityAt: persistedRuntime.startedAt ?? nowIso(),
          providerAcceptedAt: persistedRuntime.startedAt ?? nowIso(),
          runningStartedAt: persistedRuntime.startedAt ?? nowIso(),
          statusSnapshot: persistedRun.status,
          updatedAt: nowIso(),
          workspaceReleasedAt: null,
        })
        await this.updateLaunchAttemptSafe(`launch-attempt-${run.id}`, {
          blockerReason: null,
          metadataJson: {
            providerStatus: persistedRun.status,
            source: 'sync_runtime_accept',
          },
          result: 'provider_accepted',
        })
      }
      if (
        persistedRuntime &&
        (persistedRuntime.state === 'stopped' ||
          persistedRuntime.state === 'archived' ||
          persistedRuntime.state === 'deleted' ||
          persistedRuntime.state === 'failed')
      ) {
        await this.repository.updateRunUsage?.(run.id, {
          completedAt:
            persistedRun.completedAt ??
            persistedRuntime.deletedAt ??
            persistedRuntime.archivedAt ??
            persistedRuntime.stoppedAt ??
            nowIso(),
          statusSnapshot: persistedRun.status,
          terminationReason: persistedRuntime.stopReason ?? 'idle_timeout',
          updatedAt: nowIso(),
          workspaceReleasedAt:
            persistedRuntime.workspaceReleasedAt ??
            persistedRuntime.deletedAt ??
            persistedRuntime.archivedAt ??
            persistedRuntime.stoppedAt ??
            nowIso(),
        })
      }
      return sanitizeRun(persistedRun)
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

    let persistedRuntime = runtimeRecord
    let effectiveRuntime: RuntimeProviderInstance | RuntimeInstance | null = runtimeInstance
    if (runtimeInstance && persist) {
      persistedRuntime = runtimeRecord
        ? await this.updateRuntimeRecordSafe(run.id, {
            ...runtimeInstance,
            lastReconciledAt: runtimeInstance.lastReconciledAt ?? nowIso(),
          })
        : await this.createRuntimeRecordSafe(buildRuntimeInstanceRecordFromRun(run, runtimeInstance))

      if (persistedRuntime) {
        if (shouldArchiveRecoverableRuntime(persistedRuntime) && provider.archiveRuntimeInstance) {
          const archived = await provider.archiveRuntimeInstance(run.id)
          if (archived) {
            persistedRuntime = await this.updateRuntimeRecordSafe(run.id, {
              ...archived,
              archivedAt: archived.archivedAt ?? nowIso(),
              lastReconciledAt: archived.lastReconciledAt ?? nowIso(),
              preservedStateAvailable: true,
              state: 'archived',
            })
            effectiveRuntime = {
              ...archived,
              archivedAt: archived.archivedAt ?? nowIso(),
              lastReconciledAt: archived.lastReconciledAt ?? nowIso(),
              preservedStateAvailable: true,
              state: 'archived',
            }
          }
        }

        if (persistedRuntime && runtimeInstance.state === 'running') {
          const openInterval = await this.findOpenRuntimeIntervalSafe(persistedRuntime.id)
          if (!openInterval) {
            await this.createRuntimeIntervalSafe({
              id: crypto.randomUUID(),
              runtimeInstanceId: persistedRuntime.id,
              runId: run.id,
              providerInstanceRef: persistedRuntime.providerInstanceRef,
              startedAt: runtimeInstance.startedAt ?? nowIso(),
              endedAt: null,
              closeReason: null,
              createdAt: nowIso(),
              updatedAt: nowIso(),
            })
          }
        }

        if (
          persistedRuntime &&
          (runtimeInstance.state === 'stopped' ||
            runtimeInstance.state === 'archived' ||
            runtimeInstance.state === 'deleted' ||
            runtimeInstance.state === 'failed')
        ) {
          await this.closeRuntimeIntervalSafe(
            persistedRuntime.id,
            runtimeInstance.stoppedAt ?? runtimeInstance.archivedAt ?? runtimeInstance.deletedAt ?? nowIso(),
            runtimeInstance.stopReason,
          )
        }

        if (
          persistedRuntime &&
          runtimeInstance.state === 'stopped' &&
          runtimeInstance.persistenceMode === 'ephemeral' &&
          provider.deleteRuntimeInstance
        ) {
          const deletedAt = nowIso()
          await provider.deleteRuntimeInstance(run.id)
          persistedRuntime = await this.updateRuntimeRecordSafe(run.id, {
            deletedAt,
            lastReconciledAt: deletedAt,
            preservedStateAvailable: false,
            state: 'deleted',
            workspaceReleasedAt: deletedAt,
          })
          effectiveRuntime = {
            ...runtimeInstance,
            deletedAt,
            lastReconciledAt: deletedAt,
            preservedStateAvailable: false,
            state: 'deleted',
            workspaceReleasedAt: deletedAt,
          }
        }
      }
    }

    const reconciledRun = applyRuntimeStateToRun(nextRun, effectiveRuntime)

    if (!persist) {
      return sanitizeRun(reconciledRun)
    }

    const persistedRun = (await this.repository.updateRun(run.id, reconciledRun)) ?? reconciledRun
    if (persist && persistedRun.status === 'failed') {
      await this.repository.updateRunUsage?.(run.id, buildReleasedUsagePatch(persistedRun, 'provider_unhealthy'))
    }
    if (persistedRuntime?.state === 'running') {
      await this.repository.updateRunUsage?.(run.id, {
        lastMeaningfulActivityAt: persistedRuntime.startedAt ?? nowIso(),
        providerAcceptedAt: persistedRuntime.startedAt ?? nowIso(),
        runningStartedAt: persistedRuntime.startedAt ?? nowIso(),
        statusSnapshot: persistedRun.status,
        updatedAt: nowIso(),
        workspaceReleasedAt: null,
      })
      await this.updateLaunchAttemptSafe(`launch-attempt-${run.id}`, {
        blockerReason: null,
        metadataJson: {
          providerStatus: persistedRun.status,
          source: 'sync_provider_accept',
        },
        result: 'provider_accepted',
      })
    }
    if (
      persistedRuntime &&
      (persistedRuntime.state === 'stopped' ||
        persistedRuntime.state === 'archived' ||
        persistedRuntime.state === 'deleted')
    ) {
      await this.repository.updateRunUsage?.(run.id, {
        completedAt:
          persistedRun.completedAt ??
          persistedRuntime.deletedAt ??
          persistedRuntime.archivedAt ??
          persistedRuntime.stoppedAt ??
          nowIso(),
        statusSnapshot: persistedRun.status,
        terminationReason: persistedRuntime.stopReason ?? 'idle_timeout',
        updatedAt: nowIso(),
        workspaceReleasedAt:
          persistedRuntime.workspaceReleasedAt ??
          persistedRuntime.deletedAt ??
          persistedRuntime.archivedAt ??
          persistedRuntime.stoppedAt ??
          nowIso(),
      })
    }
    return sanitizeRun(persistedRun)
  }

  private async findRuntimeRecordSafe(runId: string) {
    try {
      return await this.runtimeRepository.findRuntimeInstanceByRunId(runId)
    } catch {
      return null
    }
  }

  private async updateRuntimeRecordSafe(runId: string, input: Partial<RuntimeInstance>) {
    try {
      return await this.runtimeRepository.updateRuntimeInstance(runId, input)
    } catch {
      return null
    }
  }

  private async createRuntimeRecordSafe(input: RuntimeInstance) {
    try {
      return await this.runtimeRepository.createRuntimeInstance(input)
    } catch {
      return null
    }
  }

  private async findOpenRuntimeIntervalSafe(runtimeInstanceId: string) {
    try {
      return await this.runtimeRepository.findOpenRuntimeInterval(runtimeInstanceId)
    } catch {
      return null
    }
  }

  private async createRuntimeIntervalSafe(input: Parameters<RuntimeInstanceRepository['createRuntimeInterval']>[0]) {
    try {
      return await this.runtimeRepository.createRuntimeInterval(input)
    } catch {
      return null
    }
  }

  private async closeRuntimeIntervalSafe(
    runtimeInstanceId: string,
    endedAt: string,
    closeReason: RunTerminationReason | null,
  ) {
    try {
      return await this.runtimeRepository.closeRuntimeInterval(runtimeInstanceId, endedAt, closeReason)
    } catch {
      return null
    }
  }

  private async createLaunchAttemptSafe(input: typeof launchAttempts.$inferInsert) {
    try {
      return await this.launchAttemptRepository.createLaunchAttempt(input)
    } catch {
      return null
    }
  }

  private async updateLaunchAttemptSafe(id: string, input: Partial<typeof launchAttempts.$inferInsert>) {
    try {
      return await this.launchAttemptRepository.updateLaunchAttempt(id, input)
    } catch {
      return null
    }
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
