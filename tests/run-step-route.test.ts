import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'

import { NextRequest } from 'next/server'

import { PATCH } from '@/app/api/runs/[runId]/steps/[stepId]/route'
import type { Run } from '@/lib/types'
import { setRequestUserIdForTesting } from '@/server/lib/request-user'
import { setRunServiceForTesting, type RunService } from '@/server/services/run.service'

function buildRun(): Run {
  const now = new Date().toISOString()

  return {
    id: 'run-test-legacy',
    userId: 'user-test-legacy',
    orderId: 'order-test-legacy',
    channelConfigId: 'channel-test-legacy',
    status: 'completed',
    combinedRiskLevel: 'low',
    usesRealWorkspace: false,
    usesTools: false,
    networkEnabled: false,
    resultSummary: 'Legacy compatibility test run.',
    resultArtifacts: [],
    createdAt: now,
    startedAt: now,
    updatedAt: now,
    completedAt: now,
  }
}

afterEach(() => {
  setRequestUserIdForTesting(null)
  setRunServiceForTesting(null)
})

test('legacy run step route returns deprecated response with run context', async () => {
  setRequestUserIdForTesting(() => 'user-test-legacy')
  setRunServiceForTesting({
    async getRun() {
      return buildRun()
    },
  } as unknown as RunService)

  const request = new NextRequest('http://localhost/api/runs/run-test-legacy/steps/approve', {
    method: 'PATCH',
  })

  const response = await PATCH(request, {
    params: Promise.resolve({ runId: 'run-test-legacy', stepId: 'approve' }),
  })
  const payload = await response.json()

  assert.equal(response.status, 409)
  assert.equal(payload.deprecated, true)
  assert.equal(payload.runId, 'run-test-legacy')
  assert.equal(payload.stepId, 'approve')
  assert.match(payload.error, /Manual step approvals are not supported/)
})
