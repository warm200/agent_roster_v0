import assert from 'node:assert/strict'
import test from 'node:test'

import { NextRequest } from 'next/server'

import { POST } from '@/app/api/internal/runtime-maintenance/reconcile/route'
import {
  RuntimeMaintenanceService,
  setRuntimeMaintenanceServiceForTesting,
} from '@/server/services/runtime-maintenance.service'

const originalToken = process.env.INTERNAL_API_TOKEN

test.afterEach(() => {
  setRuntimeMaintenanceServiceForTesting(null)
  if (originalToken === undefined) {
    delete process.env.INTERNAL_API_TOKEN
  } else {
    process.env.INTERNAL_API_TOKEN = originalToken
  }
})

test('runtime maintenance route requires internal auth', async () => {
  process.env.INTERNAL_API_TOKEN = 'internal-test-token'

  const response = await POST(
    new NextRequest('http://localhost/api/internal/runtime-maintenance/reconcile', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: {
        'content-type': 'application/json',
      },
    }),
  )

  assert.equal(response.status, 401)
})

test('runtime maintenance route forwards the request to the service', async () => {
  process.env.INTERNAL_API_TOKEN = 'internal-test-token'

  setRuntimeMaintenanceServiceForTesting({
    async reconcileStaleRuntimes(input) {
      assert.deepEqual(input, {
        limit: 12,
        staleMinutes: 7,
      })
      return {
        errored: 0,
        reconciled: 2,
        skipped: 0,
        touchedRunIds: ['run-1', 'run-2'],
      }
    },
  } as RuntimeMaintenanceService)

  const response = await POST(
    new NextRequest('http://localhost/api/internal/runtime-maintenance/reconcile', {
      method: 'POST',
      body: JSON.stringify({
        limit: 12,
        staleMinutes: 7,
      }),
      headers: {
        authorization: 'Bearer internal-test-token',
        'content-type': 'application/json',
      },
    }),
  )

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    result: {
      errored: 0,
      reconciled: 2,
      skipped: 0,
      touchedRunIds: ['run-1', 'run-2'],
    },
  })
})

test('runtime maintenance route rejects invalid payloads', async () => {
  process.env.INTERNAL_API_TOKEN = 'internal-test-token'

  const response = await POST(
    new NextRequest('http://localhost/api/internal/runtime-maintenance/reconcile', {
      method: 'POST',
      body: JSON.stringify({
        limit: 0,
      }),
      headers: {
        authorization: 'Bearer internal-test-token',
        'content-type': 'application/json',
      },
    }),
  )

  assert.equal(response.status, 400)
})
