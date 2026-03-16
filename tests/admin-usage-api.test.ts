import assert from 'node:assert/strict'
import { test } from 'node:test'

import { NextRequest } from 'next/server'

import { GET as getAdminUsage } from '@/app/api/admin/usage/route'
import { GET as getAdminOverview } from '@/app/api/admin/usage/overview/route'

test('admin usage api returns a no-store snapshot response', async () => {
  const response = await getAdminUsage(new NextRequest('http://localhost/api/admin/usage?range=30d'))
  const payload = await response.json()

  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(payload.selectedRange, '30d')
  assert.ok(Array.isArray(payload.overviewMetrics))
})

test('admin overview api returns the overview slice with selected range metadata', async () => {
  const response = await getAdminOverview(new NextRequest('http://localhost/api/admin/usage/overview?range=24h'))
  const payload = await response.json()

  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(payload.selectedRange, '24h')
  assert.ok(Array.isArray(payload.alerts))
  assert.ok(Array.isArray(payload.overviewMetrics))
})

test('admin usage api accepts custom start and end dates', async () => {
  const response = await getAdminUsage(
    new NextRequest('http://localhost/api/admin/usage?range=custom&start=2026-03-10&end=2026-03-15'),
  )
  const payload = await response.json()

  assert.equal(response.status, 200)
  assert.equal(payload.selectedRange, 'custom')
  assert.equal(payload.customStartDate, '2026-03-10')
  assert.equal(payload.customEndDate, '2026-03-15')
})
