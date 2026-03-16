import type { RunTerminationReason, RuntimeInstance, RunUsage } from '@/lib/types'

import { RunRepository } from './run.repository'
import { getRunService, type RunService } from './run.service'
import { RuntimeInstanceRepository } from './runtime-instance.repository'

function readPositiveIntEnv(name: string, fallback: number) {
  const raw = process.env[name]
  if (!raw) {
    return fallback
  }
  const value = Number.parseInt(raw, 10)
  if (!Number.isFinite(value) || value <= 0) {
    return fallback
  }
  return value
}

function hasElapsed(since: string | null, minutes: number | null) {
  if (!since || minutes == null) {
    return false
  }
  const sinceMs = new Date(since).getTime()
  if (Number.isNaN(sinceMs)) {
    return false
  }
  return Date.now() - sinceMs >= minutes * 60 * 1000
}

function determineMaintenanceStopReason(
  runtime: RuntimeInstance,
  usage: RunUsage | null,
): RunTerminationReason | null {
  if (!usage) {
    return null
  }

  if (
    runtime.state === 'provisioning' &&
    hasElapsed(usage.provisioningStartedAt, usage.ttlPolicySnapshot.provisioningTimeoutMinutes)
  ) {
    return 'provisioning_timeout'
  }

  if (
    runtime.state === 'running' &&
    hasElapsed(usage.runningStartedAt, usage.ttlPolicySnapshot.maxSessionTtlMinutes)
  ) {
    return 'ttl_expired'
  }

  return null
}

export type RuntimeMaintenanceResult = {
  errored: number
  reconciled: number
  skipped: number
  touchedRunIds: string[]
}

export class RuntimeMaintenanceService {
  constructor(
    private readonly runtimeRepository: Pick<
      RuntimeInstanceRepository,
      'findRuntimeInstanceByRunId' | 'listRuntimeInstancesNeedingReconcile'
    > = new RuntimeInstanceRepository(),
    private readonly runRepository: Pick<RunRepository, 'findRunUsage'> = new RunRepository(),
    private readonly runService: Pick<RunService, 'getRun' | 'stopRunForReason'> = getRunService(),
  ) {}

  async reconcileStaleRuntimes(input?: {
    limit?: number
    staleMinutes?: number
  }): Promise<RuntimeMaintenanceResult> {
    const limit = input?.limit ?? readPositiveIntEnv('RUNTIME_MAINTENANCE_BATCH_SIZE', 25)
    const staleMinutes = input?.staleMinutes ?? readPositiveIntEnv('RUNTIME_MAINTENANCE_STALE_MINUTES', 5)
    const cutoff = new Date(Date.now() - staleMinutes * 60 * 1000).toISOString()
    const runtimes = await this.runtimeRepository.listRuntimeInstancesNeedingReconcile({
      lastReconciledBefore: cutoff,
      limit,
      states: ['archived', 'provisioning', 'running', 'stopped'],
    })

    const touchedRunIds: string[] = []
    let reconciled = 0
    let errored = 0

    for (const runtime of runtimes) {
      try {
        const run = await this.runService.getRun(runtime.userId, runtime.runId)
        touchedRunIds.push(run.id)
        reconciled += 1
        const latestRuntime = (await this.runtimeRepository.findRuntimeInstanceByRunId(runtime.runId)) ?? runtime
        const usage = await this.runRepository.findRunUsage(runtime.runId)
        const stopReason = determineMaintenanceStopReason(latestRuntime, usage)
        if (stopReason) {
          await this.runService.stopRunForReason(runtime.userId, runtime.runId, stopReason)
        }
      } catch {
        errored += 1
      }
    }

    return {
      errored,
      reconciled,
      skipped: 0,
      touchedRunIds,
    }
  }
}

let runtimeMaintenanceServiceOverride: RuntimeMaintenanceService | null = null

export function getRuntimeMaintenanceService() {
  return runtimeMaintenanceServiceOverride ?? new RuntimeMaintenanceService()
}

export function setRuntimeMaintenanceServiceForTesting(service: RuntimeMaintenanceService | null) {
  runtimeMaintenanceServiceOverride = service
}
