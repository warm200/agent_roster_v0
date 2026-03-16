import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'

import { encode } from 'next-auth/jwt'
import { NextRequest } from 'next/server'

import { proxy } from '@/proxy'

const ORIGINAL_ENV = {
  ADMIN_ALLOWED_EMAILS: process.env.ADMIN_ALLOWED_EMAILS,
  AUTH_SECRET: process.env.AUTH_SECRET,
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
}

afterEach(() => {
  process.env.ADMIN_ALLOWED_EMAILS = ORIGINAL_ENV.ADMIN_ALLOWED_EMAILS
  process.env.AUTH_SECRET = ORIGINAL_ENV.AUTH_SECRET
  process.env.GITHUB_CLIENT_ID = ORIGINAL_ENV.GITHUB_CLIENT_ID
  process.env.GITHUB_CLIENT_SECRET = ORIGINAL_ENV.GITHUB_CLIENT_SECRET
  process.env.GOOGLE_CLIENT_ID = ORIGINAL_ENV.GOOGLE_CLIENT_ID
  process.env.GOOGLE_CLIENT_SECRET = ORIGINAL_ENV.GOOGLE_CLIENT_SECRET
})

test('proxy bypasses app routes when auth providers are not configured', async () => {
  delete process.env.GITHUB_CLIENT_ID
  delete process.env.GITHUB_CLIENT_SECRET
  delete process.env.GOOGLE_CLIENT_ID
  delete process.env.GOOGLE_CLIENT_SECRET

  const request = new NextRequest('http://localhost/app')
  const response = await proxy(request)

  assert.equal(response.headers.get('x-middleware-next'), '1')
})

test('proxy blocks admin routes when auth providers are not configured', async () => {
  delete process.env.GITHUB_CLIENT_ID
  delete process.env.GITHUB_CLIENT_SECRET
  delete process.env.GOOGLE_CLIENT_ID
  delete process.env.GOOGLE_CLIENT_SECRET

  const request = new NextRequest('http://localhost/admin/usage')
  const response = await proxy(request)

  assert.equal(response.status, 503)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.deepEqual(await response.json(), { error: 'Admin console requires configured OAuth.' })
})

test('proxy redirects unauthenticated app traffic when auth is configured', async () => {
  process.env.AUTH_SECRET = 'test-secret'
  process.env.GITHUB_CLIENT_ID = 'github-client'
  process.env.GITHUB_CLIENT_SECRET = 'github-secret'

  const request = new NextRequest('http://localhost/app/runs?status=running')
  const response = await proxy(request)

  assert.equal(response.status, 307)
  assert.equal(
    response.headers.get('location'),
    'http://localhost/login?callbackUrl=%2Fapp%2Fruns%3Fstatus%3Drunning',
  )
})

test('proxy redirects unauthenticated admin traffic when auth is configured', async () => {
  process.env.AUTH_SECRET = 'test-secret'
  process.env.GITHUB_CLIENT_ID = 'github-client'
  process.env.GITHUB_CLIENT_SECRET = 'github-secret'

  const request = new NextRequest('http://localhost/admin/usage')
  const response = await proxy(request)

  assert.equal(response.status, 307)
  assert.equal(
    response.headers.get('location'),
    'http://localhost/login?callbackUrl=%2Fadmin%2Fusage',
  )
})

test('proxy blocks authenticated admin traffic outside the allowlist', async () => {
  process.env.AUTH_SECRET = 'test-secret'
  process.env.ADMIN_ALLOWED_EMAILS = 'woody@example.com'
  process.env.GITHUB_CLIENT_ID = 'github-client'
  process.env.GITHUB_CLIENT_SECRET = 'github-secret'

  const token = await encode({
    secret: process.env.AUTH_SECRET,
    token: {
      email: 'other@example.com',
      name: 'Other User',
      sub: 'user-1',
    },
  })

  const request = new NextRequest('http://localhost/admin/usage', {
    headers: {
      cookie: `next-auth.session-token=${token}`,
    },
  })
  const response = await proxy(request)

  assert.equal(response.status, 403)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.deepEqual(await response.json(), { error: 'Forbidden' })
})

test('proxy allows authenticated admin traffic from the allowlist', async () => {
  process.env.AUTH_SECRET = 'test-secret'
  process.env.ADMIN_ALLOWED_EMAILS = 'woody@example.com'
  process.env.GITHUB_CLIENT_ID = 'github-client'
  process.env.GITHUB_CLIENT_SECRET = 'github-secret'

  const token = await encode({
    secret: process.env.AUTH_SECRET,
    token: {
      email: 'woody@example.com',
      name: 'Woody',
      sub: 'user-1',
    },
  })

  const request = new NextRequest('http://localhost/admin/usage', {
    headers: {
      cookie: `next-auth.session-token=${token}`,
    },
  })
  const response = await proxy(request)

  assert.equal(response.headers.get('x-middleware-next'), '1')
})
