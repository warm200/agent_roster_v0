import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import type {
  AdminDateRange,
  AdminSignal,
  AdminUsageSnapshot,
  AdminUserHealth,
  AdminUserRecord,
  BalanceMismatch,
  BillingAnomaly,
  LedgerEvent,
  RankRow,
  UserRunEvent,
} from '@/lib/admin-usage-data'
import { adminUsageSnapshot as fallbackSnapshot } from '@/lib/admin-usage-data'
import { resolveEstimatedInternalCostCents } from '@/lib/runtime-cost'

import {
  creditLedger,
  orders,
  runChannelConfigs,
  runUsage,
  userSubscriptions,
  users,
} from '../db/schema'

export const DAY_MS = 24 * 60 * 60 * 1000
export const WINDOW_DAYS = 7
export const STALE_RESERVE_MS = 30 * 60 * 1000

export type AdminWindowConfig = {
  bucketCount: number
  bucketMs: number
  customEndDate: string | null
  customStartDate: string | null
  label: string
  range: AdminDateRange
  rangeEnd: Date
  rangeStart: Date
  windowMs: number
}

export function normalizeAdminDateRange(value: string | null | undefined): AdminDateRange {
  if (value === '24h' || value === '30d' || value === 'custom') {
    return value
  }

  return '7d'
}

function formatAdminDateValue(date: Date) {
  return date.toISOString().slice(0, 10)
}

function formatAdminDateLabel(date: Date) {
  return date.toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
    year: 'numeric',
  })
}

function parseAdminDateValue(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null
  }

  const [year, month, day] = value.split('-').map((segment) => Number.parseInt(segment, 10))
  const parsed = new Date(Date.UTC(year, month - 1, day))

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null
  }

  return parsed
}

export type AdminWindowInput = {
  end?: string | null
  range?: string | null
  start?: string | null
}

export function getAdminWindowConfig(
  input: string | AdminWindowInput | null | undefined,
): AdminWindowConfig {
  const rangeInput = typeof input === 'string' ? input : input?.range
  const startInput = typeof input === 'string' ? null : input?.start
  const endInput = typeof input === 'string' ? null : input?.end
  const range = normalizeAdminDateRange(rangeInput)
  const now = new Date()

  if (range === 'custom') {
    const customStart = parseAdminDateValue(startInput)
    const customEnd = parseAdminDateValue(endInput)

    if (customStart && customEnd && customStart.getTime() <= customEnd.getTime()) {
      const rangeStart = customStart
      const rangeEnd = new Date(customEnd.getTime() + DAY_MS)
      const bucketCount = Math.max(1, Math.round((rangeEnd.getTime() - rangeStart.getTime()) / DAY_MS))

      return {
        bucketCount,
        bucketMs: DAY_MS,
        customEndDate: formatAdminDateValue(customEnd),
        customStartDate: formatAdminDateValue(customStart),
        label: `Custom · ${formatAdminDateLabel(customStart)} - ${formatAdminDateLabel(customEnd)}`,
        range,
        rangeEnd,
        rangeStart,
        windowMs: rangeEnd.getTime() - rangeStart.getTime(),
      }
    }
  }

  switch (range) {
    case '24h':
      {
        const rangeEnd = now
        const rangeStart = new Date(now.getTime() - DAY_MS)

        return {
          bucketCount: 24,
          bucketMs: 60 * 60 * 1000,
          customEndDate: null,
          customStartDate: null,
          label: 'Last 24 hours',
          range,
          rangeEnd,
          rangeStart,
          windowMs: DAY_MS,
        }
      }
    case '30d':
      return {
        bucketCount: 30,
        bucketMs: DAY_MS,
        customEndDate: null,
        customStartDate: null,
        label: 'Last 30 days',
        range,
        rangeEnd: now,
        rangeStart: new Date(now.getTime() - 30 * DAY_MS),
        windowMs: 30 * DAY_MS,
      }
    default:
      return {
        bucketCount: 7,
        bucketMs: DAY_MS,
        customEndDate: null,
        customStartDate: null,
        label: 'Last 7 days',
        range: '7d',
        rangeEnd: now,
        rangeStart: new Date(now.getTime() - 7 * DAY_MS),
        windowMs: 7 * DAY_MS,
      }
  }
}

export function resolvePostgresConnectionString() {
  if (process.env.ADMIN_USAGE_FORCE_FALLBACK === '1') {
    return undefined
  }

  if (process.env.DATABASE_URL?.startsWith('postgres')) {
    return process.env.DATABASE_URL
  }

  const envPath = path.join(process.cwd(), '.env')

  if (!existsSync(envPath)) {
    return process.env.DATABASE_URL
  }

  const lines = readFileSync(envPath, 'utf8').split('\n')
  const databaseUrlLine = lines.find((line) => line.startsWith('DATABASE_URL='))

  if (!databaseUrlLine) {
    return process.env.DATABASE_URL
  }

  const value = databaseUrlLine.slice('DATABASE_URL='.length).trim().replace(/^['"]|['"]$/g, '')
  return value.startsWith('postgres') ? value : process.env.DATABASE_URL
}

export function cloneFallback(note: string, range: AdminDateRange = '7d'): AdminUsageSnapshot {
  const snapshot = structuredClone(fallbackSnapshot)
  const config = getAdminWindowConfig(range)
  snapshot.generatedAt = new Date().toISOString()
  snapshot.environment = 'staged-fallback'
  snapshot.implementationNote = note
  snapshot.selectedRange = config.range
  snapshot.customStartDate = config.customStartDate
  snapshot.customEndDate = config.customEndDate
  snapshot.windowLabel = config.label
  return snapshot
}

export function cloneFallbackForWindow(note: string, input: AdminWindowInput): AdminUsageSnapshot {
  const snapshot = structuredClone(fallbackSnapshot)
  const config = getAdminWindowConfig(input)
  snapshot.generatedAt = new Date().toISOString()
  snapshot.environment = 'staged-fallback'
  snapshot.implementationNote = note
  snapshot.selectedRange = config.range
  snapshot.customStartDate = config.customStartDate
  snapshot.customEndDate = config.customEndDate
  snapshot.windowLabel = config.label
  return snapshot
}

export function isWithinWindow(date: Date | null, now: Date, windowMs = WINDOW_DAYS * DAY_MS) {
  if (!date) {
    return false
  }

  return now.getTime() - date.getTime() <= windowMs
}

export function isWithinRange(date: Date | null, rangeStart: Date, rangeEnd: Date) {
  if (!date) {
    return false
  }

  return date >= rangeStart && date < rangeEnd
}

export function toIso(date: Date | null | undefined) {
  return date ? date.toISOString() : null
}

export function formatDayLabel(date: Date) {
  return date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', timeZone: 'UTC' })
}

export function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

export function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0)
}

export function average(values: number[]) {
  return values.length > 0 ? sum(values) / values.length : 0
}

function safeDate(value: Date | null | undefined) {
  return value ? new Date(value) : null
}

function computeResultingBalance(entries: Array<typeof creditLedger.$inferSelect>) {
  let total = 0

  for (const entry of entries) {
    total += entry.deltaCredits
  }

  return total
}

export function buildPeakConcurrentSeries(
  usageRows: Array<typeof runUsage.$inferSelect>,
  now: Date,
  config: AdminWindowConfig,
) {
  const alignedStart =
    config.bucketMs === DAY_MS
      ? startOfUtcDay(config.rangeStart)
      : new Date(Math.floor(config.rangeStart.getTime() / config.bucketMs) * config.bucketMs)

  return Array.from({ length: config.bucketCount }, (_, index) => {
    const date = new Date(alignedStart.getTime() + index * config.bucketMs)

    return {
      alwaysOn: computePeakConcurrentForBucket(usageRows, date, config.bucketMs, 'always_on', now),
      day: formatBucketLabel(date, config),
      run: computePeakConcurrentForBucket(usageRows, date, config.bucketMs, 'run', now),
      warmStandby: computePeakConcurrentForBucket(usageRows, date, config.bucketMs, 'warm_standby', now),
    }
  })
}

function formatBucketLabel(date: Date, config: AdminWindowConfig) {
  if (config.range === '24h') {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      hour12: true,
      timeZone: 'UTC',
    })
  }

  return formatDayLabel(date)
}

function computePeakConcurrentForBucket(
  usageRows: Array<typeof runUsage.$inferSelect>,
  bucketStart: Date,
  bucketMs: number,
  planId: 'run' | 'warm_standby' | 'always_on',
  now: Date,
) {
  const bucketEnd = new Date(bucketStart.getTime() + bucketMs)
  const relevant = usageRows
    .filter((row) => row.planId === planId)
    .map((row) => {
      const startedAt =
        safeDate(row.runningStartedAt) ??
        safeDate(row.providerAcceptedAt) ??
        safeDate(row.provisioningStartedAt) ??
        safeDate(row.createdAt)
      const endedAt =
        safeDate(row.workspaceReleasedAt) ??
        safeDate(row.completedAt) ??
        (row.statusSnapshot === 'running' || row.statusSnapshot === 'provisioning' ? now : null)

      return {
        end: endedAt,
        start: startedAt,
      }
    })
    .filter((row) => row.start && row.end && row.start < bucketEnd && row.end > bucketStart)

  const checkpoints = new Set<number>([bucketStart.getTime(), bucketEnd.getTime()])

  for (const row of relevant) {
    checkpoints.add(Math.max(row.start!.getTime(), bucketStart.getTime()))
    checkpoints.add(Math.min(row.end!.getTime(), bucketEnd.getTime()))
  }

  let peak = 0

  for (const checkpoint of checkpoints) {
    const concurrent = relevant.filter((row) => row.start!.getTime() <= checkpoint && row.end!.getTime() > checkpoint).length
    peak = Math.max(peak, concurrent)
  }

  return peak
}

export function buildAlerts(input: {
  failedPrevious24h: number
  failedToday: number
  mismatchCount: number
  stalePendingReserves: Array<typeof creditLedger.$inferSelect>
}): Array<{ id: string; severity: AdminSignal; title: string; detail: string }> {
  const alerts: Array<{ id: string; severity: AdminSignal; title: string; detail: string }> = []

  if (input.stalePendingReserves.length > 0) {
    const oldest = input.stalePendingReserves.at(-1)
    alerts.push({
      detail: oldest?.runId ? `Oldest stale reserve is tied to \`${oldest.runId}\`.` : 'Pending reserves exceeded the stale threshold.',
      id: 'stale-pending-reserves',
      severity: 'critical',
      title: `${input.stalePendingReserves.length} stale pending reserve${input.stalePendingReserves.length === 1 ? '' : 's'}`,
    })
  }

  if (input.mismatchCount > 0) {
    alerts.push({
      detail: 'Stored remaining credits disagree with a ledger recompute for at least one subscription.',
      id: 'balance-mismatch',
      severity: 'warning',
      title: `${input.mismatchCount} balance mismatch${input.mismatchCount === 1 ? '' : 'es'}`,
    })
  }

  if (input.failedToday > input.failedPrevious24h) {
    alerts.push({
      detail: `Failed-before-accept launches rose from ${input.failedPrevious24h} in the previous 24h to ${input.failedToday} now.`,
      id: 'provider-failure-spike',
      severity: 'info',
      title: 'Provider failure spike detected',
    })
  }

  if (alerts.length === 0) {
    alerts.push({
      detail: 'No stale reserves, mismatch drift, or provider failure spike detected in the current window.',
      id: 'ops-clear',
      severity: 'stable',
      title: 'No active billing alerts',
    })
  }

  return alerts
}

export function buildUserRows(input: {
  channelRows: Array<typeof runChannelConfigs.$inferSelect>
  ledgerRows: Array<typeof creditLedger.$inferSelect>
  orderRows: Array<typeof orders.$inferSelect>
  subscriptionRows: Array<typeof userSubscriptions.$inferSelect>
  usageRows: Array<typeof runUsage.$inferSelect>
  userRows: Array<typeof users.$inferSelect>
  windowEnd: Date
  windowStart: Date
}): AdminUserRecord[] {
  const userMap = new Map(input.userRows.map((user) => [user.id, user]))
  const ordersByUser = new Map<string, Array<typeof orders.$inferSelect>>()
  const usageByUser = new Map<string, Array<typeof runUsage.$inferSelect>>()
  const ledgerByUser = new Map<string, Array<typeof creditLedger.$inferSelect>>()
  const subscriptionByUser = new Map(input.subscriptionRows.map((row) => [row.userId, row]))
  const channelByOrderId = new Map(input.channelRows.map((row) => [row.orderId, row]))
  const now = new Date()

  for (const order of input.orderRows) {
    const rows = ordersByUser.get(order.userId) ?? []
    rows.push(order)
    ordersByUser.set(order.userId, rows)
  }

  for (const usage of input.usageRows) {
    const rows = usageByUser.get(usage.userId) ?? []
    rows.push(usage)
    usageByUser.set(usage.userId, rows)
  }

  for (const ledger of input.ledgerRows) {
    const rows = ledgerByUser.get(ledger.userId) ?? []
    rows.push(ledger)
    ledgerByUser.set(ledger.userId, rows)
  }

  const userIds = new Set<string>([
    ...userMap.keys(),
    ...ordersByUser.keys(),
    ...usageByUser.keys(),
    ...subscriptionByUser.keys(),
  ])

  return Array.from(userIds)
    .map((userId) => {
      const user = userMap.get(userId)
      const subscription = subscriptionByUser.get(userId)
      const paidOrders = (ordersByUser.get(userId) ?? []).filter((order) => order.status === 'paid')
      const userUsage = (usageByUser.get(userId) ?? []).sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      const userLedger = (ledgerByUser.get(userId) ?? []).sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      const periodStart = subscription?.currentPeriodStart ?? new Date(now.getTime() - WINDOW_DAYS * DAY_MS)
      const usageThisPeriod = userUsage.filter((row) => row.createdAt >= input.windowStart && row.createdAt < input.windowEnd)
      const launchesThisPeriod = usageThisPeriod.length
      const failedThisPeriod = usageThisPeriod.filter((row) => row.statusSnapshot === 'failed' && !row.providerAcceptedAt).length
      const pairedBundles = paidOrders.filter((order) => {
        const channel = channelByOrderId.get(order.id)
        return channel?.tokenStatus === 'validated' && channel.recipientBindingStatus === 'paired'
      }).length
      const blockedBundles = Math.max(paidOrders.length - pairedBundles, 0)
      const pairingReady = paidOrders.length > 0 && blockedBundles === 0
      const remainingCredits = subscription?.remainingCredits ?? 0
      const health: AdminUserHealth =
        !pairingReady && paidOrders.length > 0
          ? 'blocked'
          : remainingCredits <= 3 || failedThisPeriod > 0
            ? 'watch'
            : 'stable'
      const latestUsage = userUsage[0]
      const sourcePlan = subscription?.planId ?? latestUsage?.planId ?? 'run'
      const currentPlan: AdminUserRecord['currentPlan'] = sourcePlan === 'free' ? 'run' : sourcePlan

      return {
        avgWorkspaceMinutes: Math.round(average(usageThisPeriod.map((row) => row.workspaceMinutes ?? 0).filter(Boolean))),
        blockedLaunchesThisPeriod: failedThisPeriod,
        bundleReadiness: {
          blockedBundles,
          pairedBundles,
          purchasedBundles: paidOrders.length,
        },
        currentPeriodEnd: subscription?.currentPeriodEnd?.toISOString() ?? now.toISOString(),
        currentPlan,
        email: user?.email ?? `${userId}@unknown.local`,
        estCostThisPeriodCents: sum(
          usageThisPeriod.map((row) =>
            resolveEstimatedInternalCostCents({
              estimatedInternalCostCents: row.estimatedInternalCostCents,
              workspaceMinutes: row.workspaceMinutes,
            }),
          ),
        ),
        health,
        id: userId,
        lastLaunchAt: latestUsage?.createdAt.toISOString() ?? subscription?.updatedAt.toISOString() ?? now.toISOString(),
        latestRunStatus: latestUsage?.statusSnapshot ?? 'none',
        launchesThisPeriod,
        ledgerTimeline: userLedger.slice(0, 20).map<LedgerEvent>((row) => ({
          createdAt: row.createdAt.toISOString(),
          deltaCredits: row.deltaCredits,
          id: row.id,
          reasonCode: row.reasonCode,
          status: row.status,
          type: row.eventType,
        })),
        name: user?.name ?? userId,
        orderIds: paidOrders.map((order) => order.id),
        pairingReady,
        remainingCredits,
        runTimeline: userUsage.slice(0, 20).map<UserRunEvent>((row) => ({
          id: row.runId,
          providerAcceptedAt: toIso(row.providerAcceptedAt),
          status: row.statusSnapshot,
          terminationReason: row.terminationReason,
          workspaceMinutes: row.workspaceMinutes,
        })),
        subscription: {
          currentPeriodEnd: subscription?.currentPeriodEnd?.toISOString() ?? now.toISOString(),
          currentPeriodStart: periodStart.toISOString(),
          includedCredits: subscription?.includedCredits ?? 0,
          planCode: currentPlan,
          planVersion: subscription?.planVersion ?? 'v1',
          remainingCredits,
        },
      }
    })
    .sort((left, right) => new Date(right.lastLaunchAt).getTime() - new Date(left.lastLaunchAt).getTime())
}

export function buildBillingAnomalies(input: {
  mismatches: BalanceMismatch[]
  stalePendingReserves: Array<typeof creditLedger.$inferSelect>
  ledgerRows: Array<typeof creditLedger.$inferSelect>
}): BillingAnomaly[] {
  const anomalies: BillingAnomaly[] = []

  for (const row of input.stalePendingReserves.slice(0, 5)) {
    anomalies.push({
      createdAt: row.createdAt.toISOString(),
      entity: row.runId ?? row.userId,
      id: `stale-${row.id}`,
      message: 'Reserve stayed pending beyond the stale threshold and should be reviewed for reversal.',
      severity: 'critical',
      type: 'reserve pending timeout',
    })
  }

  for (const row of input.mismatches.slice(0, 5)) {
    anomalies.push({
      createdAt: row.lastLedgerEventAt,
      entity: `${row.userId} / ${row.subscriptionId}`,
      id: `mismatch-${row.subscriptionId}`,
      message: 'Stored remaining credits do not match the ledger recompute.',
      severity: 'warning',
      type: 'balance mismatch',
    })
  }

  for (const row of input.ledgerRows.filter((entry) => (entry.resultingBalance ?? 0) < 0).slice(0, 5)) {
    anomalies.push({
      createdAt: row.createdAt.toISOString(),
      entity: row.userId,
      id: `negative-${row.id}`,
      message: 'Ledger row produced a negative resulting balance.',
      severity: 'warning',
      type: 'negative resulting balance',
    })
  }

  if (anomalies.length === 0) {
    anomalies.push({
      createdAt: new Date().toISOString(),
      entity: 'system',
      id: 'no-anomalies',
      message: 'No derived ledger anomalies were found in the current dataset.',
      severity: 'stable',
      type: 'no anomalies',
    })
  }

  return anomalies
}

export function buildMismatchRows(
  subscriptionRows: Array<typeof userSubscriptions.$inferSelect>,
  ledgerRows: Array<typeof creditLedger.$inferSelect>,
): BalanceMismatch[] {
  return subscriptionRows
    .map((subscription) => {
      const rows = ledgerRows
        .filter((row) => row.userId === subscription.userId)
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      const recomputedBalance = computeResultingBalance(rows)
      const lastLedgerEventAt = rows[0]?.createdAt.toISOString() ?? subscription.updatedAt.toISOString()
      const diff = recomputedBalance - subscription.remainingCredits

      return {
        diff,
        lastLedgerEventAt,
        recomputedBalance,
        storedRemainingCredits: subscription.remainingCredits,
        subscriptionId: subscription.id,
        userId: subscription.userId,
      }
    })
    .filter((row) => row.diff !== 0)
}

export function buildAlwaysOnRanks(userRows: AdminUserRecord[]): {
  avgActiveBundles: number
  avgConcurrentRuns: number
  avgWorkspaceMinutesPerDay: number
  topEstimatedCostUsers: RankRow[]
  topIdleOccupancyUsers: RankRow[]
} {
  const alwaysOnUsers = userRows.filter((row) => row.currentPlan === 'always_on')

  if (alwaysOnUsers.length === 0) {
    const placeholder = [{ context: 'No live always-on usage in the current dataset.', user: 'No live usage', value: '0' }]
    return {
      avgActiveBundles: 0,
      avgConcurrentRuns: 0,
      avgWorkspaceMinutesPerDay: 0,
      topEstimatedCostUsers: placeholder,
      topIdleOccupancyUsers: placeholder,
    }
  }

  return {
    avgActiveBundles: average(alwaysOnUsers.map((row) => row.bundleReadiness.purchasedBundles)),
    avgConcurrentRuns: average(alwaysOnUsers.map((row) => row.runTimeline.filter((run) => run.status === 'running').length)),
    avgWorkspaceMinutesPerDay: average(alwaysOnUsers.map((row) => row.avgWorkspaceMinutes)),
    topEstimatedCostUsers: alwaysOnUsers
      .slice()
      .sort((left, right) => right.estCostThisPeriodCents - left.estCostThisPeriodCents)
      .slice(0, 10)
      .map((row) => ({
        context: `${row.bundleReadiness.purchasedBundles} purchased bundles, ${row.runTimeline.filter((run) => run.status === 'running').length} active runs`,
        user: row.name,
        value: `$${(row.estCostThisPeriodCents / 100).toFixed(2)}`,
      })),
    topIdleOccupancyUsers: alwaysOnUsers
      .slice()
      .sort((left, right) => right.avgWorkspaceMinutes - left.avgWorkspaceMinutes)
      .slice(0, 10)
      .map((row) => ({
        context: 'Derived from longer workspace occupancy without dedicated idle telemetry yet.',
        user: row.name,
        value: `${Math.min(Math.round((row.avgWorkspaceMinutes / 240) * 100), 100)}%`,
      })),
  }
}
