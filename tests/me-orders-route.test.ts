import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'

import { NextRequest } from 'next/server'

import { GET } from '@/app/api/me/orders/route'

const ORIGINAL_ENV = {
  AUTH_SECRET: process.env.AUTH_SECRET,
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
}

afterEach(() => {
  process.env.AUTH_SECRET = ORIGINAL_ENV.AUTH_SECRET
  process.env.GITHUB_CLIENT_ID = ORIGINAL_ENV.GITHUB_CLIENT_ID
  process.env.GITHUB_CLIENT_SECRET = ORIGINAL_ENV.GITHUB_CLIENT_SECRET
  process.env.GOOGLE_CLIENT_ID = ORIGINAL_ENV.GOOGLE_CLIENT_ID
  process.env.GOOGLE_CLIENT_SECRET = ORIGINAL_ENV.GOOGLE_CLIENT_SECRET
})

test('me orders route rejects unauthenticated requests when OAuth is configured', async () => {
  process.env.AUTH_SECRET = 'test-secret'
  process.env.GITHUB_CLIENT_ID = 'github-client'
  process.env.GITHUB_CLIENT_SECRET = 'github-secret'

  const request = new NextRequest('http://localhost/api/me/orders')
  const response = await GET(request)
  const payload = await response.json()

  assert.equal(response.status, 401)
  assert.equal(payload.error, 'Authentication required.')
})
