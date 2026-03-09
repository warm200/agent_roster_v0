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

  async createRun(order: Order) {
    const run = createMockRun(order)

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

  async stopRun(runId: string) {
    const run = getRunById(runId)
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
