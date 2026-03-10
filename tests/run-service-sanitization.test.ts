import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'

import type { Run } from '@/lib/types'
import { RunService, setRunServiceDepsForTesting } from '@/server/services/run.service'

const run: Run = {
  id: 'run-test-1',
  userId: 'user-test-1',
  orderId: 'order-test-1',
  channelConfigId: 'channel-test-1',
  status: 'completed',
  combinedRiskLevel: 'low',
  usesRealWorkspace: true,
  usesTools: true,
  networkEnabled: true,
  resultSummary: 'Daytona workspace completed bundle order-test-1.',
  resultArtifacts: [],
  createdAt: new Date().toISOString(),
  startedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  completedAt: new Date().toISOString(),
}

afterEach(() => {
  setRunServiceDepsForTesting(null)
})

test('run service redacts provider names from run status, logs, and results', async () => {
  const service = new RunService({
    async findRunForUser() {
      return run
    },
    async updateRun(_runId: string, nextRun: Run) {
      return nextRun
    },
  } as never)

  setRunServiceDepsForTesting({
    getRunProvider: () => ({
      name: 'daytona',
      async createRun() {
        return run
      },
      async getLogs() {
        return [
          {
            timestamp: new Date().toISOString(),
            level: 'info' as const,
            step: 'submit',
            message: 'Submitted background response resp_123 to OpenAI model gpt-5.',
          },
          {
            timestamp: new Date().toISOString(),
            level: 'info' as const,
            step: 'status',
            message: 'Prepared Inbox Triage Agent inside managed Daytona workspace.',
          },
        ]
      },
      async getResult() {
        return {
          summary: 'Run completed successfully in Daytona.',
          artifacts: [],
        }
      },
      async getStatus() {
        return run
      },
      async stopRun() {
        return null
      },
    }),
  })

  const nextRun = await service.getRun('user-test-1', 'run-test-1')
  const logs = await service.getRunLogs('user-test-1', 'run-test-1')
  const result = await service.getRunResult('user-test-1', 'run-test-1')

  assert.equal(nextRun.resultSummary?.includes('Daytona'), false)
  assert.equal(nextRun.resultSummary, 'Run completed successfully.')
  assert.equal(logs[0]?.message, 'Submitted run request to the managed runtime.')
  assert.equal(logs[1]?.message, 'Prepared Inbox Triage Agent inside managed runtime.')
  assert.equal(result?.summary, 'Run completed successfully.')
})
