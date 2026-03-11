import { mockRunLogs, mockRuns } from '@/lib/mock-data'
import { createMockRun, getOrderById, getRunById } from '@/lib/mock-selectors'
import type { Order, Run, RunLog, RunResult } from '@/lib/types'

import type { RunProvider } from './run-provider.interface'

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

  async createRun(order: Order, runId?: string) {
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

  async restartRun(runId: string, fallbackRun?: Run) {
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
