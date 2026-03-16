import assert from 'node:assert/strict'
import { test } from 'node:test'

import { runRemoteRuntimeMaintenance } from '@/server/services/runtime-maintenance.client'

const originalFetch = global.fetch
const originalBaseUrl = process.env.RUNTIME_MAINTENANCE_BASE_URL
const originalToken = process.env.INTERNAL_API_TOKEN
const originalTimeout = process.env.RUNTIME_MAINTENANCE_HTTP_TIMEOUT_SECONDS

test.afterEach(() => {
  global.fetch = originalFetch
  if (originalBaseUrl === undefined) {
    delete process.env.RUNTIME_MAINTENANCE_BASE_URL
  } else {
    process.env.RUNTIME_MAINTENANCE_BASE_URL = originalBaseUrl
  }
  if (originalToken === undefined) {
    delete process.env.INTERNAL_API_TOKEN
  } else {
    process.env.INTERNAL_API_TOKEN = originalToken
  }
  if (originalTimeout === undefined) {
    delete process.env.RUNTIME_MAINTENANCE_HTTP_TIMEOUT_SECONDS
  } else {
    process.env.RUNTIME_MAINTENANCE_HTTP_TIMEOUT_SECONDS = originalTimeout
  }
})

test('remote runtime maintenance posts to the internal route with auth', async () => {
  process.env.RUNTIME_MAINTENANCE_BASE_URL = 'https://example.test/'
  process.env.INTERNAL_API_TOKEN = 'secret-token'

  let requestUrl = ''
  let requestInit: RequestInit | undefined

  global.fetch = (async (input, init) => {
    requestUrl = String(input)
    requestInit = init
    return new Response(JSON.stringify({ result: { reconciled: 3 } }), {
      status: 200,
      headers: {
        'content-type': 'application/json',
      },
    })
  }) as typeof fetch

  const result = await runRemoteRuntimeMaintenance({
    limit: 10,
    staleMinutes: 7,
  })

  assert.equal(requestUrl, 'https://example.test/api/internal/runtime-maintenance/reconcile')
  assert.equal(requestInit?.method, 'POST')
  assert.equal((requestInit?.headers as Record<string, string>).authorization, 'Bearer secret-token')
  assert.deepEqual(JSON.parse(String(requestInit?.body)), {
    limit: 10,
    staleMinutes: 7,
  })
  assert.deepEqual(result, { reconciled: 3 })
})

test('remote runtime maintenance surfaces route errors', async () => {
  process.env.RUNTIME_MAINTENANCE_BASE_URL = 'https://example.test'
  process.env.INTERNAL_API_TOKEN = 'secret-token'

  global.fetch = (async () =>
    new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: {
        'content-type': 'application/json',
      },
    })) as typeof fetch

  await assert.rejects(
    () => runRemoteRuntimeMaintenance(),
    /Unauthorized/,
  )
})
