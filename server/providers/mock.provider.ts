import { mockRunLogs, mockRuns } from '@/lib/mock-data'
import { createMockRun, getOrderById, getRunById } from '@/lib/mock-selectors'
import type { Order, Run, RunLog, RunResult, RunTerminationReason } from '@/lib/types'

import type {
  CreateRuntimeInstanceInput,
  RunProvider,
  RunProviderRuntimeConfig,
  RuntimeProviderInstance,
} from './run-provider.interface'

const mockRuntimeInstances = new Map<string, RuntimeProviderInstance>()

function mapRunStatusToRuntimeState(status: Run['status']): RuntimeProviderInstance['state'] {
  switch (status) {
    case 'completed':
      return 'stopped'
    default:
      return status
  }
}

function buildResult(run: Run): RunResult | null {
  if (!run.resultSummary) {
    return null
  }

  return {
    summary: run.resultSummary,
    artifacts: run.resultArtifacts,
  }
}

export class MockRunProvider implements RunProvider {
  readonly name = 'mock'

  async createRuntimeInstance(input: CreateRuntimeInstanceInput): Promise<RuntimeProviderInstance> {
    const now = new Date().toISOString()
    const instance: RuntimeProviderInstance = {
      archivedAt: null,
      deletedAt: null,
      lastReconciledAt: now,
      metadataJson: {},
      persistenceMode: input.lifecyclePolicy.persistenceMode,
      planId: input.planId,
      preservedStateAvailable: input.lifecyclePolicy.preserveStateOnStop,
      providerInstanceRef: input.runId,
      providerName: this.name,
      recoverableUntilAt: null,
      runId: input.runId,
      runtimeMode: input.lifecyclePolicy.runtimeMode,
      startedAt: null,
      state: 'provisioning',
      stoppedAt: null,
      stopReason: null,
      workspaceReleasedAt: null,
    }
    mockRuntimeInstances.set(input.runId, instance)
    return instance
  }

  async getRuntimeInstance(runId: string): Promise<RuntimeProviderInstance | null> {
    return mockRuntimeInstances.get(runId) ?? null
  }

  async stopRuntimeInstance(
    runId: string,
    reason: RunTerminationReason = 'manual_stop',
    fallbackRun?: Run,
  ): Promise<RuntimeProviderInstance | null> {
    await this.stopRun(runId, fallbackRun)
    const existing = mockRuntimeInstances.get(runId)
    if (!existing) {
      return null
    }
    const stoppedAt = new Date().toISOString()
    const next: RuntimeProviderInstance = {
      ...existing,
      lastReconciledAt: stoppedAt,
      preservedStateAvailable: existing.persistenceMode !== 'ephemeral',
      state: 'stopped',
      stoppedAt,
      stopReason: reason,
      workspaceReleasedAt: existing.persistenceMode === 'ephemeral' ? stoppedAt : null,
    }
    mockRuntimeInstances.set(runId, next)
    return next
  }

  async restartRuntimeInstance(
    runId: string,
    order: Order,
    _lifecyclePolicy: CreateRuntimeInstanceInput['lifecyclePolicy'],
    runtimeConfig?: RunProviderRuntimeConfig,
  ): Promise<RuntimeProviderInstance | null> {
    await this.restartRun(runId, order, undefined, runtimeConfig)
    const existing = mockRuntimeInstances.get(runId)
    if (!existing) {
      return null
    }
    const now = new Date().toISOString()
    const next: RuntimeProviderInstance = {
      ...existing,
      lastReconciledAt: now,
      startedAt: now,
      state: 'running',
      stoppedAt: null,
      stopReason: null,
      workspaceReleasedAt: null,
    }
    mockRuntimeInstances.set(runId, next)
    return next
  }

  async createRun(order: Order, runId?: string, _runtimeConfig?: RunProviderRuntimeConfig) {
    const run = createMockRun(order)

    if (runId) {
      run.id = runId
    }

    mockRuns.unshift(run)
    mockRunLogs[run.id] = [
      {
        timestamp: run.createdAt,
        level: 'info',
        step: 'init',
        message: 'Run requested from purchased bundle. Provisioning managed workspace.',
      },
    ]

    const existing = mockRuntimeInstances.get(run.id)
    if (existing) {
      mockRuntimeInstances.set(run.id, {
        ...existing,
        lastReconciledAt: run.updatedAt,
      startedAt: run.startedAt,
      state: mapRunStatusToRuntimeState(run.status),
    })
    }

    return run
  }

  async getStatus(runId: string) {
    return getRunById(runId) ?? null
  }

  async getLogs(runId: string) {
    return mockRunLogs[runId] ?? []
  }

  async getResult(runId: string) {
    const run = getRunById(runId)
    if (!run) {
      return null
    }

    return buildResult(run)
  }

  async restartRun(
    runId: string,
    _order: Order,
    fallbackRun?: Run,
    _runtimeConfig?: RunProviderRuntimeConfig,
  ) {
    const run = getRunById(runId) ?? fallbackRun ?? null
    if (!run) {
      return null
    }

    const now = new Date().toISOString()
    run.status = 'provisioning'
    run.startedAt = now
    run.completedAt = null
    run.updatedAt = now
    run.resultSummary = 'Managed runtime is restarting. Status will update automatically.'
    mockRunLogs[runId] = [
      ...(mockRunLogs[runId] ?? []),
      {
        timestamp: now,
        level: 'info',
        step: 'restart',
        message: 'Managed runtime restart requested.',
      },
    ]

    return run
  }

  async stopRun(runId: string, fallbackRun?: Run) {
    const run = getRunById(runId) ?? fallbackRun ?? null
    if (!run || run.status === 'completed' || run.status === 'failed') {
      return run ?? null
    }

    const now = new Date().toISOString()
    run.status = 'failed'
    run.updatedAt = now
    run.completedAt = now
    run.resultSummary = run.resultSummary ?? 'Run stopped before completion.'
    mockRunLogs[runId] = [
      ...(mockRunLogs[runId] ?? []),
      {
        timestamp: now,
        level: 'warn',
        step: 'cancel',
        message: 'Run stopped by operator request.',
      },
    ]

    return run
  }
}

export async function createMockProviderRun(orderId: string) {
  const order = getOrderById(orderId)
  if (!order) {
    throw new Error(`Order not found: ${orderId}`)
  }

  return new MockRunProvider().createRun(order)
}
