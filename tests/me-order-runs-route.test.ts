import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'

import { NextRequest } from 'next/server'

import { POST } from '@/app/api/me/orders/[orderId]/runs/route'
import type { Run } from '@/lib/types'
import { HttpError } from '@/server/lib/http'
import { setRequestUserIdForTesting } from '@/server/lib/request-user'
import { setRunServiceForTesting, type RunService } from '@/server/services/run.service'

function buildRun(): Run {
  const now = new Date().toISOString()

  return {
    id: 'run-test-1',
    userId: 'user-test-1',
    orderId: 'order-test-1',
    channelConfigId: 'channel-test-1',
    status: 'running',
    combinedRiskLevel: 'medium',
    usesRealWorkspace: true,
    usesTools: true,
    networkEnabled: true,
    resultSummary: null,
    resultArtifacts: [],
    createdAt: now,
    startedAt: now,
    updatedAt: now,
    completedAt: null,
  }
}

afterEach(() => {
  setRequestUserIdForTesting(null)
  setRunServiceForTesting(null)
})

test('me order runs route creates a run via run service', async () => {
  let receivedUserId = ''
  let receivedOrderId = ''

  setRequestUserIdForTesting(() => 'user-test-1')
  setRunServiceForTesting({
    async createRun(userId: string, orderId: string) {
      receivedUserId = userId
      receivedOrderId = orderId
      return buildRun()
    },
  } as unknown as RunService)

  const request = new NextRequest('http://localhost/api/me/orders/order-test-1/runs', {
    method: 'POST',
  })

  const response = await POST(request, {
    params: Promise.resolve({ orderId: 'order-test-1' }),
  })
  const payload = await response.json()

  assert.equal(response.status, 201)
  assert.equal(payload.id, 'run-test-1')
  assert.equal(receivedUserId, 'user-test-1')
  assert.equal(receivedOrderId, 'order-test-1')
})

test('me order runs route surfaces launch conflicts', async () => {
  setRequestUserIdForTesting(() => 'user-test-1')
  setRunServiceForTesting({
    async createRun() {
      throw new HttpError(409, 'Telegram pairing must be completed.')
    },
  } as unknown as RunService)

  const request = new NextRequest('http://localhost/api/me/orders/order-test-1/runs', {
    method: 'POST',
  })

  const response = await POST(request, {
    params: Promise.resolve({ orderId: 'order-test-1' }),
  })
  const payload = await response.json()

  assert.equal(response.status, 409)
  assert.equal(payload.error, 'Telegram pairing must be completed.')
})
