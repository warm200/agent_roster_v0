import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildBillingAlertSeeds,
  mapPersistedBillingAlerts,
  syncDerivedBillingAlertsSafely,
} from '@/server/services/admin-billing-alerts.service'

test('buildBillingAlertSeeds turns derived anomalies into persisted billing alert rows', () => {
  const seeds = buildBillingAlertSeeds([
    {
      createdAt: '2026-03-15T12:00:00.000Z',
      entity: 'sub-1',
      id: 'mismatch-sub-1',
      message: 'Stored remaining credits do not match the ledger recompute.',
      severity: 'warning',
      type: 'balance mismatch',
    },
  ])

  assert.equal(seeds.length, 1)
  assert.equal(seeds[0]?.id, 'billing:mismatch-sub-1')
  assert.equal(seeds[0]?.alertType, 'balance_mismatch')
  assert.equal(seeds[0]?.severity, 'warning')
})

test('mapPersistedBillingAlerts exposes ack timestamps for dashboard rows', () => {
  const rows = mapPersistedBillingAlerts([
    {
      acknowledgedAt: new Date('2026-03-15T13:00:00.000Z'),
      alertType: 'stale_reserve',
      createdAt: new Date('2026-03-15T12:00:00.000Z'),
      entityId: 'run-1',
      entityType: 'run',
      id: 'billing:stale-1',
      message: 'Reserve stayed pending beyond the stale threshold and should be reviewed for reversal.',
      metadataJson: {},
      severity: 'critical',
    },
  ])

  assert.equal(rows.length, 1)
  assert.equal(rows[0]?.acknowledgedAt, '2026-03-15T13:00:00.000Z')
  assert.equal(rows[0]?.type, 'stale reserve')
})

test('syncDerivedBillingAlertsSafely does not throw without a postgres database url', async () => {
  const originalDatabaseUrl = process.env.DATABASE_URL

  process.env.DATABASE_URL = 'mysql://example.test/not-postgres'

  try {
    const synced = await syncDerivedBillingAlertsSafely()
    assert.equal(synced, false)
  } finally {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl
    }
  }
})
