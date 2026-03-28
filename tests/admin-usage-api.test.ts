import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'

import { encode } from 'next-auth/jwt'
import { NextRequest } from 'next/server'

import { GET as getAdminBlockers } from '@/app/api/admin/usage/blockers/route'
import { GET as getAdminUsage } from '@/app/api/admin/usage/route'
import { GET as getAdminOverview } from '@/app/api/admin/usage/overview/route'
import { POST as postAdminRuntimeGrant } from '@/app/api/admin/usage/users/[userId]/grants/route'
import { GET as getAdminUser } from '@/app/api/admin/usage/users/[userId]/route'
import { GET as getAdminUsers } from '@/app/api/admin/usage/users/route'
import { setSubscriptionServiceForTesting } from '@/server/services/subscription.service'

process.env.ADMIN_USAGE_FORCE_FALLBACK = '1'

const ORIGINAL_ENV = {
  ADMIN_ALLOWED_EMAILS: process.env.ADMIN_ALLOWED_EMAILS,
  AUTH_SECRET: process.env.AUTH_SECRET,
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
}

afterEach(() => {
  process.env.ADMIN_ALLOWED_EMAILS = ORIGINAL_ENV.ADMIN_ALLOWED_EMAILS
  process.env.AUTH_SECRET = ORIGINAL_ENV.AUTH_SECRET
  process.env.GITHUB_CLIENT_ID = ORIGINAL_ENV.GITHUB_CLIENT_ID
  process.env.GITHUB_CLIENT_SECRET = ORIGINAL_ENV.GITHUB_CLIENT_SECRET
  setSubscriptionServiceForTesting(null)
})

async function createAdminRequest(url: string) {
  process.env.AUTH_SECRET = 'admin-secret'
  process.env.GITHUB_CLIENT_ID = 'github-client'
  process.env.GITHUB_CLIENT_SECRET = 'github-secret'
  process.env.ADMIN_ALLOWED_EMAILS = 'woody@example.com'

  const token = await encode({
    secret: process.env.AUTH_SECRET,
    token: {
      email: 'woody@example.com',
      name: 'Woody',
      sub: 'user-1',
    },
  })

  return new NextRequest(url, {
    headers: {
      cookie: `next-auth.session-token=${token}`,
    },
  })
}

test('admin usage api returns a no-store snapshot response', async () => {
  const response = await getAdminUsage(await createAdminRequest('http://localhost/api/admin/usage?range=30d'))
  const payload = await response.json()

  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(payload.selectedRange, '30d')
  assert.ok(Array.isArray(payload.overviewMetrics))
  assert.ok(Array.isArray(payload.meaningMetrics.summary))
  assert.ok(Array.isArray(payload.meaningMetrics.byPlan))
})

test('admin overview api returns the overview slice with selected range metadata', async () => {
  const response = await getAdminOverview(await createAdminRequest('http://localhost/api/admin/usage/overview?range=24h'))
  const payload = await response.json()

  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(payload.selectedRange, '24h')
  assert.ok(Array.isArray(payload.alerts))
  assert.ok(Array.isArray(payload.overviewMetrics))
})

test('admin usage api accepts custom start and end dates', async () => {
  const response = await getAdminUsage(
    await createAdminRequest('http://localhost/api/admin/usage?range=custom&start=2026-03-10&end=2026-03-15'),
  )
  const payload = await response.json()

  assert.equal(response.status, 200)
  assert.equal(payload.selectedRange, 'custom')
  assert.equal(payload.customStartDate, '2026-03-10')
  assert.equal(payload.customEndDate, '2026-03-15')
})

test('admin users api applies server-side drilldown filters', async () => {
  const response = await getAdminUsers(
    await createAdminRequest(
      'http://localhost/api/admin/usage/users?plan=run&status=completed&health=stable&order_id=order-1042&run_id=run-4415&q=mina',
    ),
  )
  const payload = await response.json()

  assert.equal(response.status, 200)
  assert.equal(payload.users.length, 1)
  assert.equal(payload.users[0]?.id, 'user-3')
})

test('admin user detail api returns a single user row with range metadata', async () => {
  const response = await getAdminUser(
    await createAdminRequest('http://localhost/api/admin/usage/users/user-1?range=30d'),
    {
      params: Promise.resolve({ userId: 'user-1' }),
    },
  )
  const payload = await response.json()

  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(payload.selectedRange, '30d')
  assert.equal(payload.user.id, 'user-1')
})

test('admin user detail api returns 404 for an unknown user', async () => {
  const response = await getAdminUser(
    await createAdminRequest('http://localhost/api/admin/usage/users/missing-user'),
    {
      params: Promise.resolve({ userId: 'missing-user' }),
    },
  )
  const payload = await response.json()

  assert.equal(response.status, 404)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(payload.error, 'Admin user not found.')
})

test('admin grant route forwards runtime credit grants to the subscription service', async () => {
  let received:
    | {
        credits: number
        expiresAt: string
        grantedByUserId?: string | null
        note?: string | null
        userId: string
      }
    | undefined

  setSubscriptionServiceForTesting({
    async createBillingPortalSession() {
      throw new Error('not implemented')
    },
    async commitReservedLaunchCredit() {
      return null
    },
    async createCheckoutSession() {
      throw new Error('not implemented')
    },
    async createTopUpCheckoutSession() {
      throw new Error('not implemented')
    },
    async getCurrentSubscription() {
      return null
    },
    async getCurrentRuntimeGrant() {
      return null
    },
    async getLaunchPolicy() {
      throw new Error('not implemented')
    },
    async grantAdminRuntimeCredits(input) {
      received = input
      return {
        id: 'grant-1',
        userId: input.userId,
        grantedByUserId: input.grantedByUserId ?? null,
        creditsTotal: input.credits,
        creditsRemaining: input.credits,
        expiresAt: input.expiresAt,
        consumedAt: null,
        revokedAt: null,
        note: input.note ?? null,
        createdAt: '2026-03-27T00:00:00.000Z',
        updatedAt: '2026-03-27T00:00:00.000Z',
      }
    },
    async handleStripeCheckoutCompletedSession() {
      throw new Error('not implemented')
    },
    async handleStripeSubscriptionDeleted() {
      throw new Error('not implemented')
    },
    listPlans() {
      return []
    },
    listTopUpPacks() {
      return []
    },
    async reconcileCheckoutSession() {
      throw new Error('not implemented')
    },
    async refundReservedLaunchCredit() {
      return null
    },
    async reserveLaunchCredit() {
      return null
    },
    async syncSubscriptionFromStripe() {},
  })

  const response = await postAdminRuntimeGrant(
    new NextRequest('http://localhost/api/admin/usage/users/user-1/grants', {
      body: JSON.stringify({
        credits: 3,
        expiresAt: '2026-04-03T00:00:00.000Z',
        note: 'trial',
      }),
      headers: {
        cookie: (await createAdminRequest('http://localhost')).headers.get('cookie') ?? '',
        origin: 'http://localhost',
      },
      method: 'POST',
    }),
    {
      params: Promise.resolve({ userId: 'user-1' }),
    },
  )
  const payload = await response.json()

  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(received?.credits, 3)
  assert.equal(received?.userId, 'user-1')
  assert.equal(payload.grant.id, 'grant-1')
})

test('admin blockers api returns the blocker slice', async () => {
  const response = await getAdminBlockers(await createAdminRequest('http://localhost/api/admin/usage/blockers?range=24h'))
  const payload = await response.json()

  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(payload.selectedRange, '24h')
  assert.ok(Array.isArray(payload.blockedLaunches))
})

test('admin usage api returns not found without an allowlisted session', async () => {
  process.env.AUTH_SECRET = 'admin-secret'
  process.env.GITHUB_CLIENT_ID = 'github-client'
  process.env.GITHUB_CLIENT_SECRET = 'github-secret'
  process.env.ADMIN_ALLOWED_EMAILS = 'woody@example.com'

  const response = await getAdminUsage(new NextRequest('http://localhost/api/admin/usage?range=30d'))
  const payload = await response.json()

  assert.equal(response.status, 404)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(payload.error, 'Not found.')
})
