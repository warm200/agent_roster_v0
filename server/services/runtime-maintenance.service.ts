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
      'listRuntimeInstancesNeedingReconcile'
    > = new RuntimeInstanceRepository(),
    private readonly runService: Pick<RunService, 'getRun'> = getRunService(),
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
