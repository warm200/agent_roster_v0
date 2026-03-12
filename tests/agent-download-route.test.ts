import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'

import { NextRequest } from 'next/server'

import {
  GET as downloadAgent,
  setAgentDownloadArchiveLoaderForTesting,
} from '@/app/api/agents/[slug]/download/route'
import { buildLocalAgentDownloadGrant } from '@/server/services/order.service'

const originalAuthSecret = process.env.AUTH_SECRET

afterEach(async () => {
  setAgentDownloadArchiveLoaderForTesting(null)

  if (originalAuthSecret === undefined) {
    delete process.env.AUTH_SECRET
  } else {
    process.env.AUTH_SECRET = originalAuthSecret
  }
})

test('agent download route returns a packaged local agent archive', async () => {
  process.env.AUTH_SECRET = 'test-auth-secret'
  setAgentDownloadArchiveLoaderForTesting(async (slug) =>
    slug === 'test-writer'
      ? {
          contents: Buffer.from('fake archive'),
          fileName: 'test-writer.tar.gz',
        }
      : null,
  )

  const grant = buildLocalAgentDownloadGrant({
    baseUrl: 'http://localhost',
    expiresAt: new Date(Date.now() + 60_000),
    slug: 'test-writer',
  })

  const response = await downloadAgent(
    new NextRequest(grant.downloadUrl),
    {
      params: Promise.resolve({ slug: 'test-writer' }),
    },
  )

  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type'), 'application/gzip')
  assert.equal(
    response.headers.get('content-disposition'),
    'attachment; filename="test-writer.tar.gz"',
  )
  assert.ok((await response.arrayBuffer()).byteLength > 0)
})

test('agent download route rejects missing signature params', async () => {
  process.env.AUTH_SECRET = 'test-auth-secret'
  setAgentDownloadArchiveLoaderForTesting(async () => null)

  const response = await downloadAgent(
    new NextRequest('http://localhost/api/agents/test-writer/download'),
    {
      params: Promise.resolve({ slug: 'test-writer' }),
    },
  )
  const payload = await response.json()

  assert.equal(response.status, 400)
  assert.equal(payload.error, 'expiresAt and signature are required')
})

test('agent download route rejects invalid signatures', async () => {
  process.env.AUTH_SECRET = 'test-auth-secret'
  setAgentDownloadArchiveLoaderForTesting(async () => null)

  const response = await downloadAgent(
    new NextRequest(
      'http://localhost/api/agents/test-writer/download?expiresAt=2099-01-01T00:00:00.000Z&signature=bad',
    ),
    {
      params: Promise.resolve({ slug: 'test-writer' }),
    },
  )
  const payload = await response.json()

  assert.equal(response.status, 403)
  assert.equal(payload.error, 'Invalid download signature.')
})

test('agent download route returns 404 for unknown local agents', async () => {
  process.env.AUTH_SECRET = 'test-auth-secret'
  setAgentDownloadArchiveLoaderForTesting(async () => null)

  const grant = buildLocalAgentDownloadGrant({
    baseUrl: 'http://localhost',
    expiresAt: new Date(Date.now() + 60_000),
    slug: 'missing',
  })

  const response = await downloadAgent(
    new NextRequest(grant.downloadUrl),
    {
      params: Promise.resolve({ slug: 'missing' }),
    },
  )
  const payload = await response.json()

  assert.equal(response.status, 404)
  assert.equal(payload.error, 'Agent package not found')
})
