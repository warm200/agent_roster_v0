import assert from 'node:assert/strict'
import test from 'node:test'

import { NextRequest } from 'next/server'

import { POST } from '@/app/api/internal/runs/[runId]/activity/route'
import { RunService, setRunServiceForTesting } from '@/server/services/run.service'

const originalToken = process.env.INTERNAL_API_TOKEN

test.afterEach(() => {
  setRunServiceForTesting(null)
  if (originalToken === undefined) {
    delete process.env.INTERNAL_API_TOKEN
  } else {
    process.env.INTERNAL_API_TOKEN = originalToken
  }
})

test('run activity route requires internal auth', async () => {
  process.env.INTERNAL_API_TOKEN = 'internal-test-token'

  const response = await POST(
    new NextRequest('http://localhost/api/internal/runs/run-1/activity', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: {
        'content-type': 'application/json',
      },
    }),
    {
      params: Promise.resolve({ runId: 'run-1' }),
    },
  )

  assert.equal(response.status, 401)
})

test('run activity route forwards meaningful activity to run service', async () => {
  process.env.INTERNAL_API_TOKEN = 'internal-test-token'

  setRunServiceForTesting({
    async recordMeaningfulActivity(runId: string, occurredAt?: string) {
      assert.equal(runId, 'run-1')
      assert.equal(occurredAt, '2026-03-15T12:00:00.000Z')
      return {
        occurredAt,
        runId,
      }
    },
  } as RunService)

  const response = await POST(
    new NextRequest('http://localhost/api/internal/runs/run-1/activity', {
      method: 'POST',
      body: JSON.stringify({
        occurredAt: '2026-03-15T12:00:00.000Z',
      }),
      headers: {
        authorization: 'Bearer internal-test-token',
        'content-type': 'application/json',
      },
    }),
    {
      params: Promise.resolve({ runId: 'run-1' }),
    },
  )

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    result: {
      occurredAt: '2026-03-15T12:00:00.000Z',
      runId: 'run-1',
    },
  })
})

test('run activity route rejects invalid payloads', async () => {
  process.env.INTERNAL_API_TOKEN = 'internal-test-token'

  const response = await POST(
    new NextRequest('http://localhost/api/internal/runs/run-1/activity', {
      method: 'POST',
      body: JSON.stringify({
        occurredAt: 'not-a-date',
      }),
      headers: {
        authorization: 'Bearer internal-test-token',
        'content-type': 'application/json',
      },
    }),
    {
      params: Promise.resolve({ runId: 'run-1' }),
    },
  )

  assert.equal(response.status, 400)
})
