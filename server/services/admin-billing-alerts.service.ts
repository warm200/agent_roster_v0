import type { AdminSignal, BalanceMismatch, BillingAnomaly } from '@/lib/admin-usage-data'

import { createDb } from '../db'
import { billingAlerts, creditLedger, userSubscriptions } from '../db/schema'
import {
  buildBillingAnomalies,
  buildMismatchRows,
  resolvePostgresConnectionString,
  STALE_RESERVE_MS,
} from './admin-usage.helpers'
import { BillingAlertRepository } from './billing-alert.repository'

type BillingAlertSeed = typeof billingAlerts.$inferInsert

function toPersistedSeverity(severity: AdminSignal): 'info' | 'warning' | 'critical' {
  if (severity === 'critical' || severity === 'warning' || severity === 'info') {
    return severity
  }

  return 'info'
}

function toAlertType(anomaly: BillingAnomaly): BillingAlertSeed['alertType'] {
  if (anomaly.id.startsWith('stale-')) {
    return 'stale_reserve'
  }

  if (anomaly.id.startsWith('mismatch-')) {
    return 'balance_mismatch'
  }

  if (anomaly.id.startsWith('negative-')) {
    return 'negative_balance'
  }

  return 'refund_chain_error'
}

function toEntityType(anomaly: BillingAnomaly): string {
  if (anomaly.id.startsWith('stale-')) {
    return 'run_or_user'
  }

  if (anomaly.id.startsWith('mismatch-')) {
    return 'subscription'
  }

  if (anomaly.id.startsWith('negative-')) {
    return 'user'
  }

  return 'system'
}

export function buildBillingAlertSeeds(anomalies: BillingAnomaly[]): BillingAlertSeed[] {
  return anomalies
    .filter((anomaly) => anomaly.id !== 'no-anomalies')
    .map((anomaly) => ({
      acknowledgedAt: null,
      alertType: toAlertType(anomaly),
      createdAt: new Date(anomaly.createdAt),
      entityId: anomaly.entity,
      entityType: toEntityType(anomaly),
      id: `billing:${anomaly.id}`,
      message: anomaly.message,
      metadataJson: {
        derivedType: anomaly.type,
        entity: anomaly.entity,
      },
      severity: toPersistedSeverity(anomaly.severity),
    }))
}

export function mapPersistedBillingAlerts(
  rows: Array<typeof billingAlerts.$inferSelect>,
): BillingAnomaly[] {
  if (rows.length === 0) {
    return []
  }

  return rows.map((row) => ({
    acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    entity: row.entityId ?? row.entityType,
    id: row.id,
    message: row.message,
    severity: row.severity,
    type: row.alertType.replaceAll('_', ' '),
  }))
}

export async function syncDerivedBillingAlerts() {
  const connectionString = resolvePostgresConnectionString()

  if (!connectionString?.startsWith('postgres')) {
    throw new Error('No PostgreSQL DATABASE_URL is available for billing alert sync.')
  }

  const db = createDb(connectionString)
  const now = Date.now()
  const [subscriptionRows, ledgerRows] = await Promise.all([
    db.select().from(userSubscriptions),
    db.select().from(creditLedger),
  ])
  const mismatches: BalanceMismatch[] = buildMismatchRows(subscriptionRows, ledgerRows)
  const stalePendingReserves = ledgerRows.filter(
    (row) => row.eventType === 'reserve' && row.status === 'pending' && now - row.createdAt.getTime() > STALE_RESERVE_MS,
  )
  const anomalies = buildBillingAnomalies({
    ledgerRows,
    mismatches,
    stalePendingReserves,
  })
  const seeds = buildBillingAlertSeeds(anomalies)
  const repository = new BillingAlertRepository()

  await repository.syncBillingAlerts(seeds)

  return {
    synced: seeds.length,
  }
}
