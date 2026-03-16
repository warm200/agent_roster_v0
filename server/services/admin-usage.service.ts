import { desc } from 'drizzle-orm'

import {
  adminUsageSnapshot as fallbackSnapshot,
  type AdminSignal,
  type AdminUsageSnapshot,
} from '@/lib/admin-usage-data'

import { createDb } from '../db'
import {
  creditLedger,
  orders,
  runChannelConfigs,
  runUsage,
  userSubscriptions,
  users,
} from '../db/schema'
import {
  DAY_MS,
  STALE_RESERVE_MS,
  WINDOW_DAYS,
  average,
  buildAlerts,
  buildAlwaysOnRanks,
  buildBillingAnomalies,
  buildMismatchRows,
  buildPeakConcurrentSeries,
  buildUserRows,
  cloneFallback,
  formatDayLabel,
  isWithinWindow,
  resolvePostgresConnectionString,
  startOfUtcDay,
  sum,
} from './admin-usage.helpers'

export async function getAdminUsageSnapshot(): Promise<AdminUsageSnapshot> {
  const connectionString = resolvePostgresConnectionString()

  if (!connectionString?.startsWith('postgres')) {
    return cloneFallback('Live admin queries are disabled because no PostgreSQL DATABASE_URL is available. Showing staged dashboard data.')
  }

  try {
    const db = createDb(connectionString)
    const now = new Date()
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

    const liveSnapshot = structuredClone(fallbackSnapshot)
    const paidOrdersInWindow = orderRows.filter((row) => row.status === 'paid' && isWithinWindow(row.createdAt, now))
    const usageInWindow = usageRows.filter((row) => isWithinWindow(row.createdAt, now))
    const usageToday = usageRows.filter((row) => row.createdAt >= todayRowsStart)
    const failedToday = usageRows.filter((row) => row.createdAt >= todayRowsStart && row.statusSnapshot === 'failed' && !row.providerAcceptedAt).length
    const failedPrevious24h = usageRows.filter((row) => row.createdAt >= previous24hStart && row.createdAt < todayRowsStart && row.statusSnapshot === 'failed' && !row.providerAcceptedAt).length
    const providerAcceptedInWindow = usageInWindow.filter((row) => row.providerAcceptedAt).length
    const providerAcceptedOrderIds = new Set(usageInWindow.filter((row) => row.providerAcceptedAt).map((row) => row.orderId))
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
    })
    const alwaysOnRanks = buildAlwaysOnRanks(userDrilldownRows)

    liveSnapshot.generatedAt = now.toISOString()
    liveSnapshot.environment = 'live-db'
    liveSnapshot.windowLabel = 'Last 7 days'
    liveSnapshot.implementationNote =
      'Overview, runtime, billing, and user drilldown are live from the current Postgres schema. Launch-attempt blocker attribution remains derived until `launch_attempts` exists.'
    liveSnapshot.alerts = buildAlerts({
      failedPrevious24h,
      failedToday,
      mismatchCount: mismatchRows.length,
      stalePendingReserves,
    })
    liveSnapshot.overviewMetrics = [
      {
        key: 'active-paid-users',
        label: 'Active Paid Users',
        value: subscriptionRows.filter((row) => row.status === 'active' && row.planId !== 'free').length,
        format: 'count',
        delta: `${paidOrdersInWindow.length} paid orders / 7d`,
        detail: 'Runtime-entitled users with active non-free subscriptions.',
        tone: 'stable',
      },
      {
        key: 'bundle-first-launch-rate',
        label: 'Bundle -> First Launch Rate',
        value: paidOrdersInWindow.length > 0 ? providerAcceptedOrderIds.size / paidOrdersInWindow.length : 0,
        format: 'percent',
        delta: `${providerAcceptedOrderIds.size}/${paidOrdersInWindow.length || 0} bundles`,
        detail: 'Paid bundles in the last 7 days that reached provider acceptance.',
        tone: 'stable',
      },
      {
        key: 'launch-success-rate',
        label: 'Launch Success Rate',
        value: usageInWindow.length > 0 ? providerAcceptedInWindow / usageInWindow.length : 0,
        format: 'percent',
        delta: `${providerAcceptedInWindow}/${usageInWindow.length || 0} attempts`,
        detail: 'Provider accepted divided by observed launch attempts from `run_usage`.',
        tone: failedToday > failedPrevious24h ? 'warning' : 'stable',
      },
      {
        key: 'blocked-launches-today',
        label: 'Blocked Launches Today',
        value: failedToday,
        format: 'count',
        delta: 'Derived from failed launch attempts before provider accept',
        detail: 'Current schema fallback until `launch_attempts` lands.',
        tone: failedToday > 0 ? 'warning' : 'stable',
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
        value: sum(usageToday.map((row) => row.estimatedInternalCostCents ?? 0)),
        format: 'currency',
        delta: `${usageToday.length} launch attempts`,
        detail: 'Summed from today’s `run_usage.estimated_internal_cost_cents`.',
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
      { step: 'Launch attempted', count: new Set(usageInWindow.map((row) => row.orderId)).size },
      {
        step: 'Launch admitted',
        count: new Set(usageInWindow.filter((row) => row.statusSnapshot !== 'failed' || row.providerAcceptedAt).map((row) => row.orderId)).size,
      },
      { step: 'Provider accepted', count: new Set(usageInWindow.filter((row) => row.providerAcceptedAt).map((row) => row.orderId)).size },
      { step: 'Run completed', count: new Set(usageInWindow.filter((row) => row.completedAt).map((row) => row.orderId)).size },
    ]
    const blockerRows: Array<{ reason: string; count: number; tone: AdminSignal }> = [
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
      launchesPerDay: Array.from({ length: WINDOW_DAYS }, (_, index) => {
        const day = new Date(startOfUtcDay(now).getTime() - (WINDOW_DAYS - index - 1) * DAY_MS)
        const dayEnd = new Date(day.getTime() + DAY_MS)

        return {
          completed: usageRows.filter((row) => row.completedAt && row.completedAt >= day && row.completedAt < dayEnd).length,
          day: formatDayLabel(day),
          failedBeforeAccept: usageRows.filter((row) => row.createdAt >= day && row.createdAt < dayEnd && row.statusSnapshot === 'failed' && !row.providerAcceptedAt).length,
          providerAccepted: usageRows.filter((row) => row.providerAcceptedAt && row.providerAcceptedAt >= day && row.providerAcceptedAt < dayEnd).length,
          refunded: ledgerRows.filter((row) => row.eventType === 'refund' && row.createdAt >= day && row.createdAt < dayEnd).length,
        }
      }),
      peakConcurrentRuns: buildPeakConcurrentSeries(usageRows, now),
    }
    liveSnapshot.billingHealth = {
      anomalies: buildBillingAnomalies({
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
    return cloneFallback(`Live admin queries failed (${message}). Showing staged dashboard data instead.`)
  }
}
