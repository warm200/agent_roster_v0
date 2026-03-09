import { mockOrders, mockRunLogs, mockRuns } from '@/lib/mock-data'
import type { Agent, Order, Run, RunLog } from '@/lib/types'

export function getOrderById(orderId: string): Order | undefined {
  return mockOrders.find((order) => order.id === orderId)
}

export function getRunById(runId: string): Run | undefined {
  return mockRuns.find((run) => run.id === runId)
}

export function getRunLogs(runId: string): RunLog[] {
  return mockRunLogs[runId] ?? []
}

export function getRunAgents(run: Run): Agent[] {
  return getOrderById(run.orderId)?.items.map((item) => item.agent) ?? []
}

export function getPrimaryRunAgent(run: Run): Agent | undefined {
  return getRunAgents(run)[0]
}

export function getRunSummary(run: Run) {
  const order = getOrderById(run.orderId)
  const agents = order?.items.map((item) => item.agent) ?? []
  const logs = getRunLogs(run.id)

  return {
    ...run,
    order,
    agents,
    logs,
    logsCount: logs.length,
    artifactsCount: run.resultArtifacts.length,
  }
}

export function createMockRun(order: Order): Run {
  const now = new Date().toISOString()

  return {
    id: `run-${Date.now()}`,
    userId: order.userId,
    orderId: order.id,
    channelConfigId: order.channelConfig?.id ?? 'channel-pending',
    status: 'provisioning',
    combinedRiskLevel: order.bundleRisk.level,
    usesRealWorkspace: true,
    usesTools: true,
    networkEnabled: true,
    resultSummary: null,
    resultArtifacts: [],
    createdAt: now,
    startedAt: null,
    updatedAt: now,
    completedAt: null,
  }
}
