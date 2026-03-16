import assert from 'node:assert/strict'
import { test } from 'node:test'

import { adminUserRecords } from '@/lib/admin-user-records'
import {
  cloneFallback,
  getAdminWindowConfig,
  normalizeAdminDateRange,
} from '@/server/services/admin-usage.helpers'

test('normalizeAdminDateRange defaults unsupported values to 7d', () => {
  assert.equal(normalizeAdminDateRange(undefined), '7d')
  assert.equal(normalizeAdminDateRange(null), '7d')
  assert.equal(normalizeAdminDateRange('custom'), '7d')
  assert.equal(normalizeAdminDateRange('bogus'), '7d')
})

test('getAdminWindowConfig returns expected built-in windows', () => {
  assert.deepEqual(getAdminWindowConfig('24h'), {
    bucketCount: 24,
    bucketMs: 60 * 60 * 1000,
    label: 'Last 24 hours',
    range: '24h',
    windowMs: 24 * 60 * 60 * 1000,
  })

  assert.deepEqual(getAdminWindowConfig('30d'), {
    bucketCount: 30,
    bucketMs: 24 * 60 * 60 * 1000,
    label: 'Last 30 days',
    range: '30d',
    windowMs: 30 * 24 * 60 * 60 * 1000,
  })

  assert.deepEqual(getAdminWindowConfig('7d'), {
    bucketCount: 7,
    bucketMs: 24 * 60 * 60 * 1000,
    label: 'Last 7 days',
    range: '7d',
    windowMs: 7 * 24 * 60 * 60 * 1000,
  })
})

test('cloneFallback preserves the selected admin range label', () => {
  const snapshot = cloneFallback('fallback note', '30d')

  assert.equal(snapshot.selectedRange, '30d')
  assert.equal(snapshot.windowLabel, 'Last 30 days')
  assert.equal(snapshot.implementationNote, 'fallback note')
})

test('staged admin user records include order ids for dashboard search', () => {
  assert.ok(adminUserRecords.every((user) => user.orderIds.length > 0))
  assert.ok(adminUserRecords.every((user) => user.latestRunStatus))
})
