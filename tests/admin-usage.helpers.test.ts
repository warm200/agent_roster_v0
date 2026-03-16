import assert from 'node:assert/strict'
import { test } from 'node:test'

import { adminUserRecords } from '@/lib/admin-user-records'
import {
  cloneFallback,
  cloneFallbackForWindow,
  getAdminWindowConfig,
  normalizeAdminDateRange,
} from '@/server/services/admin-usage.helpers'

test('normalizeAdminDateRange defaults unsupported values to 7d', () => {
  assert.equal(normalizeAdminDateRange(undefined), '7d')
  assert.equal(normalizeAdminDateRange(null), '7d')
  assert.equal(normalizeAdminDateRange('custom'), 'custom')
  assert.equal(normalizeAdminDateRange('bogus'), '7d')
})

test('getAdminWindowConfig returns expected built-in windows', () => {
  const config24h = getAdminWindowConfig('24h')
  assert.equal(config24h.bucketCount, 24)
  assert.equal(config24h.bucketMs, 60 * 60 * 1000)
  assert.equal(config24h.customStartDate, null)
  assert.equal(config24h.customEndDate, null)
  assert.equal(config24h.label, 'Last 24 hours')
  assert.equal(config24h.range, '24h')
  assert.equal(config24h.windowMs, 24 * 60 * 60 * 1000)

  const config30d = getAdminWindowConfig('30d')
  assert.equal(config30d.bucketCount, 30)
  assert.equal(config30d.bucketMs, 24 * 60 * 60 * 1000)
  assert.equal(config30d.customStartDate, null)
  assert.equal(config30d.customEndDate, null)
  assert.equal(config30d.label, 'Last 30 days')
  assert.equal(config30d.range, '30d')
  assert.equal(config30d.windowMs, 30 * 24 * 60 * 60 * 1000)

  const config7d = getAdminWindowConfig('7d')
  assert.equal(config7d.bucketCount, 7)
  assert.equal(config7d.bucketMs, 24 * 60 * 60 * 1000)
  assert.equal(config7d.customStartDate, null)
  assert.equal(config7d.customEndDate, null)
  assert.equal(config7d.label, 'Last 7 days')
  assert.equal(config7d.range, '7d')
  assert.equal(config7d.windowMs, 7 * 24 * 60 * 60 * 1000)
})

test('cloneFallback preserves the selected admin range label', () => {
  const snapshot = cloneFallback('fallback note', '30d')

  assert.equal(snapshot.selectedRange, '30d')
  assert.equal(snapshot.windowLabel, 'Last 30 days')
  assert.equal(snapshot.implementationNote, 'fallback note')
})

test('getAdminWindowConfig supports explicit custom date ranges', () => {
  const config = getAdminWindowConfig({
    end: '2026-03-15',
    range: 'custom',
    start: '2026-03-10',
  })

  assert.equal(config.range, 'custom')
  assert.equal(config.customStartDate, '2026-03-10')
  assert.equal(config.customEndDate, '2026-03-15')
  assert.equal(config.bucketCount, 6)
  assert.equal(config.bucketMs, 24 * 60 * 60 * 1000)
  assert.equal(config.label, 'Custom · Mar 10, 2026 - Mar 15, 2026')
})

test('cloneFallbackForWindow preserves custom range metadata', () => {
  const snapshot = cloneFallbackForWindow('custom fallback', {
    end: '2026-03-15',
    range: 'custom',
    start: '2026-03-10',
  })

  assert.equal(snapshot.selectedRange, 'custom')
  assert.equal(snapshot.customStartDate, '2026-03-10')
  assert.equal(snapshot.customEndDate, '2026-03-15')
  assert.equal(snapshot.windowLabel, 'Custom · Mar 10, 2026 - Mar 15, 2026')
  assert.equal(snapshot.implementationNote, 'custom fallback')
})

test('staged admin user records include order ids for dashboard search', () => {
  assert.ok(adminUserRecords.every((user) => user.orderIds.length > 0))
  assert.ok(adminUserRecords.every((user) => user.latestRunStatus))
})
