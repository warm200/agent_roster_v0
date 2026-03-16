export type AdminDateRange = '24h' | '7d' | '30d'
export type AdminMetricFormat = 'count' | 'percent' | 'credits' | 'currency'
export type AdminSignal = 'stable' | 'info' | 'warning' | 'critical'
export type AdminUserHealth = 'stable' | 'watch' | 'blocked'

export type OverviewMetric = {
  key: string
  label: string
  value: number
  format: AdminMetricFormat
  delta: string
  detail: string
  tone: AdminSignal
}

export type LaunchFunnelStep = {
  step: string
  count: number
}

export type BlockerBucket = {
  reason: string
  count: number
  share: number
  tone: AdminSignal
}

export type LaunchDailyPoint = {
  day: string
  providerAccepted: number
  failedBeforeAccept: number
  refunded: number
  completed: number
}

export type PlanMixPoint = {
  plan: string
  launches: number
  avgWorkspaceMinutes: number
}

export type PeakConcurrentPoint = {
  day: string
  run: number
  warmStandby: number
  alwaysOn: number
}

export type BillingHealthStat = {
  label: string
  value: number
  format: AdminMetricFormat
}

export type BillingAnomaly = {
  id: string
  severity: AdminSignal
  type: string
  entity: string
  createdAt: string
  message: string
}

export type BalanceMismatch = {
  userId: string
  subscriptionId: string
  storedRemainingCredits: number
  recomputedBalance: number
  diff: number
  lastLedgerEventAt: string
}

export type LedgerEvent = {
  id: string
  type: 'grant' | 'reset' | 'reserve' | 'commit' | 'refund' | 'adjust' | 'expire' | 'shadow_usage_estimate'
  status: 'pending' | 'committed' | 'reversed'
  deltaCredits: number
  reasonCode: string
  createdAt: string
}

export type UserRunEvent = {
  id: string
  status: 'provisioning' | 'running' | 'completed' | 'failed'
  providerAcceptedAt: string | null
  workspaceMinutes: number | null
  terminationReason: string | null
}

export type AdminUserRecord = {
  id: string
  name: string
  email: string
  orderIds: string[]
  currentPlan: 'run' | 'warm_standby' | 'always_on'
  health: AdminUserHealth
  remainingCredits: number
  currentPeriodEnd: string
  launchesThisPeriod: number
  blockedLaunchesThisPeriod: number
  avgWorkspaceMinutes: number
  estCostThisPeriodCents: number
  pairingReady: boolean
  lastLaunchAt: string
  subscription: {
    planCode: string
    planVersion: string
    includedCredits: number
    remainingCredits: number
    currentPeriodStart: string
    currentPeriodEnd: string
  }
  ledgerTimeline: LedgerEvent[]
  runTimeline: UserRunEvent[]
  bundleReadiness: {
    purchasedBundles: number
    pairedBundles: number
    blockedBundles: number
  }
}

export type RankRow = {
  user: string
  value: string
  context: string
}

export type AdminUsageSnapshot = {
  generatedAt: string
  environment: string
  selectedRange: AdminDateRange
  windowLabel: string
  implementationNote: string
  alerts: Array<{
    id: string
    severity: AdminSignal
    title: string
    detail: string
  }>
  overviewMetrics: OverviewMetric[]
  launchFunnel: LaunchFunnelStep[]
  blockedLaunches: BlockerBucket[]
  runtimeUsage: {
    launchesPerDay: LaunchDailyPoint[]
    launchesByPlan: PlanMixPoint[]
    peakConcurrentRuns: PeakConcurrentPoint[]
  }
  billingHealth: {
    summary: BillingHealthStat[]
    anomalies: BillingAnomaly[]
    mismatches: BalanceMismatch[]
  }
  users: AdminUserRecord[]
  alwaysOnShadow: {
    activeUsers: number
    avgWorkspaceMinutesPerDay: number
    avgActiveBundles: number
    avgConcurrentRuns: number
    topEstimatedCostUsers: RankRow[]
    topIdleOccupancyUsers: RankRow[]
  }
}

export const adminUsageSnapshot: AdminUsageSnapshot = {
  generatedAt: '2026-03-15T14:52:00-04:00',
  environment: 'internal-preview',
  selectedRange: '7d',
  windowLabel: 'Last 7 days',
  implementationNote:
    'Overview, billing, and user drilldown are implemented as a UI-first console. Launch-attempt and billing-alert rows are staged sample data until those tables land.',
  alerts: [
    {
      id: 'alert-stale-reserves',
      severity: 'critical',
      title: '3 stale pending reserves',
      detail: 'Oldest reserve is 82 minutes old and still tied to `run-4412`.',
    },
    {
      id: 'alert-balance-mismatch',
      severity: 'warning',
      title: '2 balance mismatches',
      detail: 'Stored subscription balances drift by 1-2 credits from ledger recompute.',
    },
    {
      id: 'alert-provider-spike',
      severity: 'info',
      title: 'Provider failures up 18%',
      detail: 'Mostly concentrated in warm standby launches after Telegram token validation.',
    },
  ],
  overviewMetrics: [
    {
      key: 'active-paid-users',
      label: 'Active Paid Users',
      value: 128,
      format: 'count',
      delta: '+9 WoW',
      detail: 'Runtime-entitled users with non-free active subscriptions.',
      tone: 'stable',
    },
    {
      key: 'bundle-first-launch-rate',
      label: 'Bundle -> First Launch Rate',
      value: 0.71,
      format: 'percent',
      delta: '+4.2 pts',
      detail: 'Paid bundles that reached at least one accepted launch.',
      tone: 'stable',
    },
    {
      key: 'launch-success-rate',
      label: 'Launch Success Rate',
      value: 0.82,
      format: 'percent',
      delta: '-1.3 pts',
      detail: 'Provider accepted divided by total launch attempts.',
      tone: 'warning',
    },
    {
      key: 'blocked-launches-today',
      label: 'Blocked Launches Today',
      value: 14,
      format: 'count',
      delta: '+5 vs yesterday',
      detail: 'Precheck or policy-gated launches in the last 24 hours.',
      tone: 'critical',
    },
    {
      key: 'credits-committed-today',
      label: 'Credits Committed Today',
      value: 96,
      format: 'credits',
      delta: '82 commits',
      detail: 'Net launch-credit consumption after refunds.',
      tone: 'stable',
    },
    {
      key: 'estimated-cost-today',
      label: 'Estimated Cost Today',
      value: 48270,
      format: 'currency',
      delta: '+12%',
      detail: 'Summed from `run_usage.estimated_internal_cost_cents`.',
      tone: 'warning',
    },
  ],
  launchFunnel: [
    { step: 'Order created', count: 186 },
    { step: 'Telegram token validated', count: 162 },
    { step: 'Pairing completed', count: 149 },
    { step: 'Launch attempted', count: 132 },
    { step: 'Launch admitted', count: 118 },
    { step: 'Provider accepted', count: 108 },
    { step: 'Run completed', count: 97 },
  ],
  blockedLaunches: [
    { reason: 'telegram_not_ready', count: 28, share: 0.29, tone: 'critical' },
    { reason: 'credits_exhausted', count: 23, share: 0.24, tone: 'warning' },
    { reason: 'no_runtime_access', count: 18, share: 0.19, tone: 'warning' },
    { reason: 'bundle_too_large', count: 12, share: 0.13, tone: 'info' },
    { reason: 'concurrent_limit', count: 9, share: 0.09, tone: 'info' },
    { reason: 'active_bundle_limit', count: 7, share: 0.07, tone: 'info' },
  ],
  runtimeUsage: {
    launchesPerDay: [
      { day: 'Mar 09', providerAccepted: 17, failedBeforeAccept: 4, refunded: 2, completed: 13 },
      { day: 'Mar 10', providerAccepted: 14, failedBeforeAccept: 3, refunded: 1, completed: 11 },
      { day: 'Mar 11', providerAccepted: 20, failedBeforeAccept: 5, refunded: 2, completed: 16 },
      { day: 'Mar 12', providerAccepted: 18, failedBeforeAccept: 6, refunded: 2, completed: 14 },
      { day: 'Mar 13', providerAccepted: 13, failedBeforeAccept: 4, refunded: 1, completed: 10 },
      { day: 'Mar 14', providerAccepted: 16, failedBeforeAccept: 3, refunded: 2, completed: 12 },
      { day: 'Mar 15', providerAccepted: 10, failedBeforeAccept: 2, refunded: 1, completed: 8 },
    ],
    launchesByPlan: [
      { plan: 'Run', launches: 64, avgWorkspaceMinutes: 28 },
      { plan: 'Warm Standby', launches: 31, avgWorkspaceMinutes: 53 },
      { plan: 'Always On', launches: 13, avgWorkspaceMinutes: 214 },
    ],
    peakConcurrentRuns: [
      { day: 'Mar 09', run: 6, warmStandby: 4, alwaysOn: 2 },
      { day: 'Mar 10', run: 5, warmStandby: 5, alwaysOn: 2 },
      { day: 'Mar 11', run: 7, warmStandby: 5, alwaysOn: 3 },
      { day: 'Mar 12', run: 6, warmStandby: 6, alwaysOn: 3 },
      { day: 'Mar 13', run: 4, warmStandby: 5, alwaysOn: 4 },
      { day: 'Mar 14', run: 5, warmStandby: 6, alwaysOn: 4 },
      { day: 'Mar 15', run: 4, warmStandby: 4, alwaysOn: 5 },
    ],
  },
  billingHealth: {
    summary: [
      { label: 'Total grants', value: 432, format: 'credits' },
      { label: 'Total reserves', value: 118, format: 'credits' },
      { label: 'Total commits', value: 104, format: 'credits' },
      { label: 'Total refunds', value: 14, format: 'credits' },
      { label: 'Net credits consumed', value: 90, format: 'credits' },
      { label: 'Stale pending reserves', value: 3, format: 'count' },
      { label: 'Balance mismatch count', value: 2, format: 'count' },
      { label: 'Refunds today', value: 6, format: 'count' },
    ],
    anomalies: [
      {
        id: 'anom-001',
        severity: 'critical',
        type: 'reserve pending timeout',
        entity: 'run-4412',
        createdAt: '2026-03-15T13:27:00-04:00',
        message: 'Reserve stayed pending beyond timeout window and was not auto-reversed.',
      },
      {
        id: 'anom-002',
        severity: 'warning',
        type: 'negative resulting balance',
        entity: 'user-2 / subscription-2',
        createdAt: '2026-03-15T09:42:00-04:00',
        message: 'Manual adjustment was committed after remaining credits already hit zero.',
      },
      {
        id: 'anom-003',
        severity: 'warning',
        type: 'duplicate idempotency',
        entity: 'ledger:run-4391',
        createdAt: '2026-03-14T22:11:00-04:00',
        message: 'Retry path reused reserve idempotency key during provider timeout recovery.',
      },
      {
        id: 'anom-004',
        severity: 'info',
        type: 'refund without reserve',
        entity: 'run-4380',
        createdAt: '2026-03-14T18:05:00-04:00',
        message: 'Refund proposal created from ops note but no matching reserve row found.',
      },
    ],
    mismatches: [
      {
        userId: 'user-2',
        subscriptionId: 'subscription-2',
        storedRemainingCredits: 11,
        recomputedBalance: 9,
        diff: -2,
        lastLedgerEventAt: '2026-03-15T09:42:00-04:00',
      },
      {
        userId: 'user-7',
        subscriptionId: 'subscription-7',
        storedRemainingCredits: 4,
        recomputedBalance: 5,
        diff: 1,
        lastLedgerEventAt: '2026-03-14T16:33:00-04:00',
      },
    ],
  },
  users: adminUserRecords,
  alwaysOnShadow: {
    activeUsers: 12,
    avgWorkspaceMinutesPerDay: 216,
    avgActiveBundles: 3.6,
    avgConcurrentRuns: 4.8,
    topEstimatedCostUsers: [
      { user: 'Ava Morgan', value: '$183.20', context: '5 active bundles, 2 live runs' },
      { user: 'Jon Reyes', value: '$154.80', context: 'Workspace kept warm across 4 channels' },
      { user: 'Priya Shah', value: '$147.10', context: 'Long-running analytics bundle' },
    ],
    topIdleOccupancyUsers: [
      { user: 'Jon Reyes', value: '61%', context: 'High idle occupancy over the last 7 days' },
      { user: 'Ava Morgan', value: '54%', context: 'Always-on slots reserved between task bursts' },
      { user: 'Rina Fox', value: '48%', context: 'Potential candidate for warm standby downgrade' },
    ],
  },
}
import { adminUserRecords } from './admin-user-records'
