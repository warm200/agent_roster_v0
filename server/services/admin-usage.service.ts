import { desc } from 'drizzle-orm'

import {
  adminUsageSnapshot as fallbackSnapshot,
  type AdminSignal,
  type AdminUsageSnapshot,
} from '@/lib/admin-usage-data'
import { resolveEstimatedInternalCostCents } from '@/lib/runtime-cost'

import { createDb } from '../db'
import {
  billingAlerts,
  creditLedger,
  launchAttempts,
  orders,
  runChannelConfigs,
  runUsage,
  runtimeInstances,
  runtimeIntervals,
  userSubscriptions,
  users,
} from '../db/schema'
import { mapPersistedBillingAlerts, syncDerivedBillingAlertsSafely } from './admin-billing-alerts.service'
import {
  DAY_MS,
  STALE_RESERVE_MS,
  average,
  buildAlerts,
  buildAlwaysOnRanks,
  buildBillingAnomalies,
  buildMismatchRows,
  buildPeakConcurrentSeries,
  buildUserRows,
  cloneFallback,
  cloneFallbackForWindow,
  getAdminWindowConfig,
  isWithinRange,
  resolvePostgresConnectionString,
  startOfUtcDay,
  sum,
} from './admin-usage.helpers'
import { buildRuntimeMeaningMetrics } from './admin-usage-runtime-metrics'

function getAdminBlockerTone(reason: string): AdminSignal {
  if (reason === 'telegram_not_ready') {
    return 'critical'
  }

  if (reason === 'credits_exhausted' || reason === 'no_runtime_access') {
    return 'warning'
  }

  return 'info'
}

export async function getAdminUsageSnapshot(input?: {
  end?: string | null
  range?: string | null
  start?: string | null
}): Promise<AdminUsageSnapshot> {
  const connectionString = resolvePostgresConnectionString()
  const windowConfig = getAdminWindowConfig(input)

  if (!connectionString?.startsWith('postgres')) {
    return cloneFallbackForWindow(
      'Live admin queries are disabled because no PostgreSQL DATABASE_URL is available. Showing staged dashboard data.',
      input ?? { range: windowConfig.range },
    )
  }

  try {
    const db = createDb(connectionString)
    const now = new Date()
    const windowStart = windowConfig.rangeStart
    const windowEnd = windowConfig.rangeEnd
    const todayStart = startOfUtcDay(now)
    const previous24hStart = new Date(now.getTime() - 2 * DAY_MS)
    const todayRowsStart = new Date(now.getTime() - DAY_MS)

    const [userRows, orderRows, channelRows, subscriptionRows, ledgerRows, usageRows] = await Promise.all([
      db.select().from(users),
      db.select().from(orders),
      db.select().from(runChannelConfigs),
      db.select().from(userSubscriptions),
      db.select().from(creditLedger).orderBy(desc(creditLedger.createdAt)),
      db.select().from(runUsage).orderBy(desc(runUsage.createdAt)),
    ])
    let runtimeInstanceRows: Array<typeof runtimeInstances.$inferSelect> | null = null
    let runtimeIntervalRows: Array<typeof runtimeIntervals.$inferSelect> | null = null
    let billingAlertRows: Array<typeof billingAlerts.$inferSelect> | null = null
    let launchAttemptRows: Array<typeof launchAttempts.$inferSelect> | null = null

    try {
      launchAttemptRows = await db.select().from(launchAttempts).orderBy(desc(launchAttempts.attemptedAt))
    } catch {
      launchAttemptRows = null
    }

    try {
      runtimeInstanceRows = await db.select().from(runtimeInstances).orderBy(desc(runtimeInstances.createdAt))
    } catch {
      runtimeInstanceRows = null
    }

    try {
      runtimeIntervalRows = await db.select().from(runtimeIntervals).orderBy(desc(runtimeIntervals.startedAt))
    } catch {
      runtimeIntervalRows = null
    }
    await syncDerivedBillingAlertsSafely()

    try {
      billingAlertRows = await db.select().from(billingAlerts).orderBy(desc(billingAlerts.createdAt))
    } catch {
      billingAlertRows = null
    }

    const liveSnapshot = structuredClone(fallbackSnapshot)
    const paidOrdersInWindow = orderRows.filter((row) => row.status === 'paid' && isWithinRange(row.createdAt, windowStart, windowEnd))
    const usageInWindow = usageRows.filter((row) => isWithinRange(row.createdAt, windowStart, windowEnd))
    const attemptsInWindow = (launchAttemptRows ?? []).filter((row) => isWithinRange(row.attemptedAt, windowStart, windowEnd))
    const attemptsToday = (launchAttemptRows ?? []).filter((row) => row.attemptedAt >= todayRowsStart)
    const failedBeforeAcceptToday = launchAttemptRows
      ? attemptsToday.filter((row) => row.result === 'failed_before_accept').length
      : usageRows.filter((row) => row.createdAt >= todayRowsStart && row.statusSnapshot === 'failed' && !row.providerAcceptedAt).length
    const failedBeforeAcceptPrevious24h = launchAttemptRows
      ? launchAttemptRows.filter(
          (row) =>
            row.attemptedAt >= previous24hStart &&
            row.attemptedAt < todayRowsStart &&
            row.result === 'failed_before_accept',
        ).length
      : usageRows.filter((row) => row.createdAt >= previous24hStart && row.createdAt < todayRowsStart && row.statusSnapshot === 'failed' && !row.providerAcceptedAt).length
    const usageToday = usageRows.filter((row) => row.createdAt >= todayRowsStart)
    const providerAcceptedInWindow = launchAttemptRows
      ? attemptsInWindow.filter((row) => row.result === 'provider_accepted').length
      : usageInWindow.filter((row) => row.providerAcceptedAt).length
    const providerAcceptedOrderIds = new Set(
      launchAttemptRows
        ? attemptsInWindow.filter((row) => row.result === 'provider_accepted').map((row) => row.orderId)
        : usageInWindow.filter((row) => row.providerAcceptedAt).map((row) => row.orderId),
    )
    const blockedAttemptsToday = launchAttemptRows
      ? attemptsToday.filter((row) => row.result === 'blocked').length
      : failedBeforeAcceptToday
    const stalePendingReserves = ledgerRows.filter(
      (row) => row.eventType === 'reserve' && row.status === 'pending' && now.getTime() - row.createdAt.getTime() > STALE_RESERVE_MS,
    )
    const mismatchRows = buildMismatchRows(subscriptionRows, ledgerRows)
    const userDrilldownRows = buildUserRows({
      channelRows,
      ledgerRows,
      orderRows,
      subscriptionRows,
      usageRows,
      userRows,
      windowEnd,
      windowStart,
    })
    const alwaysOnRanks = buildAlwaysOnRanks(userDrilldownRows)
    const meaningMetrics = buildRuntimeMeaningMetrics({
      now,
      runtimeInstanceRows: runtimeInstanceRows ?? [],
      runtimeIntervalRows: runtimeIntervalRows ?? [],
      usageRows,
      windowEnd,
      windowStart,
    })

    liveSnapshot.generatedAt = now.toISOString()
    liveSnapshot.environment = 'live-db'
    liveSnapshot.selectedRange = windowConfig.range
    liveSnapshot.customStartDate = windowConfig.customStartDate
    liveSnapshot.customEndDate = windowConfig.customEndDate
    liveSnapshot.windowLabel = windowConfig.label
    liveSnapshot.implementationNote =
      launchAttemptRows
        ? 'Overview, runtime, billing, user drilldown, and launch funnel attribution are live from the current Postgres schema.'
        : 'Overview, runtime, billing, and user drilldown are live from the current Postgres schema. Launch-attempt blocker attribution remains derived until `launch_attempts` exists in the database.'
    const derivedAlerts = buildAlerts({
      failedPrevious24h: failedBeforeAcceptPrevious24h,
      failedToday: failedBeforeAcceptToday,
      mismatchCount: mismatchRows.length,
      stalePendingReserves,
    })
    const persistedBillingAnomalies =
      billingAlertRows && billingAlertRows.length > 0 ? mapPersistedBillingAlerts(billingAlertRows.slice(0, 50)) : null
    const persistedOverviewAlerts =
      persistedBillingAnomalies && persistedBillingAnomalies.length > 0
        ? persistedBillingAnomalies
            .filter((row) => !row.acknowledgedAt)
            .slice(0, 3)
            .map((row) => ({
              detail: row.message,
              id: row.id,
              severity: row.severity,
              title: row.type,
            }))
        : []
    liveSnapshot.alerts =
      persistedOverviewAlerts.length > 0
        ? [...persistedOverviewAlerts, ...derivedAlerts.filter((row) => row.id === 'provider-failure-spike')]
        : derivedAlerts
    liveSnapshot.overviewMetrics = [
      {
        key: 'active-paid-users',
        label: 'Active Paid Users',
        value: subscriptionRows.filter((row) => row.status === 'active' && row.planId !== 'free').length,
        format: 'count',
        delta: `${paidOrdersInWindow.length} paid orders / ${windowConfig.range}`,
        detail: 'Runtime-entitled users with active non-free subscriptions.',
        tone: 'stable',
      },
      {
        key: 'bundle-first-launch-rate',
        label: 'Bundle -> First Launch Rate',
        value: paidOrdersInWindow.length > 0 ? providerAcceptedOrderIds.size / paidOrdersInWindow.length : 0,
        format: 'percent',
        delta: `${providerAcceptedOrderIds.size}/${paidOrdersInWindow.length || 0} bundles`,
        detail: `Paid bundles in ${windowConfig.label.toLowerCase()} that reached provider acceptance.`,
        tone: 'stable',
      },
      {
        key: 'launch-success-rate',
        label: 'Launch Success Rate',
        value:
          (launchAttemptRows ? attemptsInWindow.length : usageInWindow.length) > 0
            ? providerAcceptedInWindow / (launchAttemptRows ? attemptsInWindow.length : usageInWindow.length)
            : 0,
        format: 'percent',
        delta: `${providerAcceptedInWindow}/${launchAttemptRows ? attemptsInWindow.length : usageInWindow.length || 0} attempts`,
        detail: launchAttemptRows
          ? 'Provider accepted divided by observed launch attempts from `launch_attempts`.'
          : 'Provider accepted divided by observed launch attempts from `run_usage`.',
        tone: failedBeforeAcceptToday > failedBeforeAcceptPrevious24h ? 'warning' : 'stable',
      },
      {
        key: 'blocked-launches-today',
        label: 'Blocked Launches Today',
        value: blockedAttemptsToday,
        format: 'count',
        delta: launchAttemptRows ? 'Direct from launch_attempts' : 'Derived from failed launch attempts before provider accept',
        detail: launchAttemptRows
          ? 'Blocked precheck launch attempts recorded today.'
          : 'Current schema fallback until `launch_attempts` lands.',
        tone: blockedAttemptsToday > 0 ? 'warning' : 'stable',
      },
      {
        key: 'credits-committed-today',
        label: 'Credits Committed Today',
        value: Math.abs(sum(ledgerRows.filter((row) => row.createdAt >= todayStart && row.eventType === 'commit').map((row) => row.deltaCredits))),
        format: 'credits',
        delta: `${ledgerRows.filter((row) => row.createdAt >= todayStart && row.eventType === 'commit').length} commit rows`,
        detail: 'Net committed credits from today’s ledger rows.',
        tone: 'stable',
      },
      {
        key: 'estimated-cost-today',
        label: 'Estimated Cost Today',
        value: sum(
          usageToday.map((row) =>
            resolveEstimatedInternalCostCents({
              estimatedInternalCostCents: row.estimatedInternalCostCents,
              workspaceMinutes: row.workspaceMinutes,
            }),
          ),
        ),
        format: 'currency',
        delta: `${usageToday.length} launch attempts`,
        detail: 'Summed from stored `run_usage.estimated_internal_cost_cents`, with workspace-minute fallback at the provider minute rate.',
        tone: 'warning',
      },
    ]
    liveSnapshot.launchFunnel = [
      { step: 'Order created', count: paidOrdersInWindow.length },
      {
        step: 'Telegram token validated',
        count: paidOrdersInWindow.filter((order) => channelRows.find((row) => row.orderId === order.id)?.tokenStatus === 'validated').length,
      },
      {
        step: 'Pairing completed',
        count: paidOrdersInWindow.filter((order) => channelRows.find((row) => row.orderId === order.id)?.recipientBindingStatus === 'paired').length,
      },
      {
        step: 'Launch attempted',
        count: launchAttemptRows ? new Set(attemptsInWindow.map((row) => row.orderId)).size : new Set(usageInWindow.map((row) => row.orderId)).size,
      },
      {
        step: 'Launch admitted',
        count: launchAttemptRows
          ? new Set(
              attemptsInWindow
                .filter((row) => row.result === 'reserved' || row.result === 'provider_accepted' || row.result === 'failed_before_accept')
                .map((row) => row.orderId),
            ).size
          : new Set(usageInWindow.filter((row) => row.statusSnapshot !== 'failed' || row.providerAcceptedAt).map((row) => row.orderId)).size,
      },
      { step: 'Provider accepted', count: providerAcceptedOrderIds.size },
      { step: 'Run completed', count: new Set(usageInWindow.filter((row) => row.completedAt).map((row) => row.orderId)).size },
    ]
    const blockerRows: Array<{ reason: string; count: number; tone: AdminSignal }> = launchAttemptRows
      ? Array.from(
          attemptsInWindow
            .filter((row) => row.result === 'blocked')
            .reduce((map, row) => {
              const reason = row.blockerReason ?? 'unknown'
              map.set(reason, (map.get(reason) ?? 0) + 1)
              return map
            }, new Map<string, number>()),
        )
          .map(([reason, count]) => ({
            reason,
            count,
            tone: getAdminBlockerTone(reason),
          }))
          .sort((left, right) => right.count - left.count)
      : [
          {
            reason: 'telegram_not_ready',
            count: paidOrdersInWindow.filter((order) => {
              const channel = channelRows.find((row) => row.orderId === order.id)
              return !channel || channel.tokenStatus !== 'validated' || channel.recipientBindingStatus !== 'paired'
            }).length,
            tone: 'critical',
          },
          {
            reason: 'credits_exhausted',
            count: subscriptionRows.filter((row) => row.status === 'active' && row.remainingCredits <= 0).length,
            tone: 'warning',
          },
          {
            reason: 'no_runtime_access',
            count: paidOrdersInWindow.filter((order) => !subscriptionRows.some((row) => row.userId === order.userId && row.status === 'active' && row.planId !== 'free')).length,
            tone: 'warning',
          },
          { reason: 'bundle_too_large', count: 0, tone: 'info' },
          { reason: 'concurrent_limit', count: 0, tone: 'info' },
          { reason: 'active_bundle_limit', count: 0, tone: 'info' },
        ]
    const totalBlocked = sum(blockerRows.map((row) => row.count))
    liveSnapshot.blockedLaunches = blockerRows.map((row) => ({
      ...row,
      share: totalBlocked > 0 ? row.count / totalBlocked : 0,
    }))
    liveSnapshot.runtimeUsage = {
      launchesByPlan: (['run', 'warm_standby', 'always_on'] as const).map((planId) => {
        const rows = usageInWindow.filter((row) => row.planId === planId)
        return {
          avgWorkspaceMinutes: Math.round(average(rows.map((row) => row.workspaceMinutes ?? 0).filter(Boolean))),
          launches: rows.length,
          plan: planId === 'warm_standby' ? 'Warm Standby' : planId === 'always_on' ? 'Always On' : 'Run',
        }
      }),
      launchesPerDay: Array.from({ length: windowConfig.bucketCount }, (_, index) => {
        const day =
          windowConfig.bucketMs === DAY_MS
            ? new Date(startOfUtcDay(windowStart).getTime() + index * windowConfig.bucketMs)
            : new Date(Math.floor(windowStart.getTime() / windowConfig.bucketMs) * windowConfig.bucketMs + index * windowConfig.bucketMs)
        const dayEnd = new Date(day.getTime() + windowConfig.bucketMs)

        return {
          completed: usageRows.filter((row) => row.completedAt && row.completedAt >= day && row.completedAt < dayEnd).length,
          day:
            windowConfig.range === '24h'
              ? day.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true, timeZone: 'UTC' })
              : day.toLocaleDateString('en-US', { day: '2-digit', month: 'short', timeZone: 'UTC' }),
          failedBeforeAccept: usageRows.filter((row) => row.createdAt >= day && row.createdAt < dayEnd && row.statusSnapshot === 'failed' && !row.providerAcceptedAt).length,
          providerAccepted: usageRows.filter((row) => row.providerAcceptedAt && row.providerAcceptedAt >= day && row.providerAcceptedAt < dayEnd).length,
          refunded: ledgerRows.filter((row) => row.eventType === 'refund' && row.createdAt >= day && row.createdAt < dayEnd).length,
        }
      }),
      peakConcurrentRuns: buildPeakConcurrentSeries(usageRows, now, windowConfig),
    }
    liveSnapshot.meaningMetrics = meaningMetrics
    liveSnapshot.billingHealth = {
      anomalies:
        persistedBillingAnomalies ??
        buildBillingAnomalies({
          ledgerRows,
          mismatches: mismatchRows,
          stalePendingReserves,
        }).slice(0, 50),
      mismatches: mismatchRows,
      summary: [
        { label: 'Total grants', value: sum(ledgerRows.filter((row) => row.eventType === 'grant').map((row) => row.deltaCredits)), format: 'credits' },
        { label: 'Total reserves', value: Math.abs(sum(ledgerRows.filter((row) => row.eventType === 'reserve').map((row) => row.deltaCredits))), format: 'credits' },
        { label: 'Total commits', value: Math.abs(sum(ledgerRows.filter((row) => row.eventType === 'commit').map((row) => row.deltaCredits))), format: 'credits' },
        { label: 'Total refunds', value: sum(ledgerRows.filter((row) => row.eventType === 'refund').map((row) => row.deltaCredits)), format: 'credits' },
        { label: 'Net credits consumed', value: Math.abs(sum(ledgerRows.filter((row) => row.deltaCredits < 0).map((row) => row.deltaCredits))), format: 'credits' },
        { label: 'Stale pending reserves', value: stalePendingReserves.length, format: 'count' },
        { label: 'Balance mismatch count', value: mismatchRows.length, format: 'count' },
        { label: 'Refunds today', value: ledgerRows.filter((row) => row.eventType === 'refund' && row.createdAt >= todayStart).length, format: 'count' },
      ],
    }
    liveSnapshot.users = userDrilldownRows
    liveSnapshot.alwaysOnShadow = {
      activeUsers: userDrilldownRows.filter((row) => row.currentPlan === 'always_on').length,
      avgActiveBundles: alwaysOnRanks.avgActiveBundles,
      avgConcurrentRuns: alwaysOnRanks.avgConcurrentRuns,
      avgWorkspaceMinutesPerDay: alwaysOnRanks.avgWorkspaceMinutesPerDay,
      topEstimatedCostUsers: alwaysOnRanks.topEstimatedCostUsers,
      topIdleOccupancyUsers: alwaysOnRanks.topIdleOccupancyUsers,
    }

    return liveSnapshot
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error'
    return cloneFallbackForWindow(`Live admin queries failed (${message}). Showing staged dashboard data instead.`, input ?? { range: windowConfig.range })
  }
}
