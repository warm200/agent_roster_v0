'use client'

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from 'recharts'

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { AdminUsageSnapshot, AdminUserRecord } from '@/lib/admin-usage-data'
import { formatDate, formatDateTime } from '@/lib/utils'

import {
  MiniStat,
  Panel,
  SectionHeading,
  SignalPill,
  formatMetricValue,
  formatMinutes,
} from './usage-primitives'

const blockerConfig = {
  count: { color: 'var(--chart-4)', label: 'Blocked launches' },
}

const launchConfig = {
  providerAccepted: { color: 'var(--chart-2)', label: 'Provider accepted' },
  failedBeforeAccept: { color: 'var(--chart-4)', label: 'Failed before accept' },
  refunded: { color: 'var(--chart-3)', label: 'Refunded' },
  completed: { color: 'var(--chart-1)', label: 'Completed' },
}

const planConfig = {
  launches: { color: 'var(--chart-2)', label: 'Launches' },
}

const peakConfig = {
  run: { color: 'var(--chart-2)', label: 'Run' },
  warmStandby: { color: 'var(--chart-3)', label: 'Warm standby' },
  alwaysOn: { color: 'var(--chart-4)', label: 'Always on' },
}

const healthTone = {
  stable: 'stable',
  watch: 'warning',
  blocked: 'critical',
} as const

export function FunnelRuntimeSection({ snapshot }: { snapshot: AdminUsageSnapshot }) {
  const funnelBase = snapshot.launchFunnel[0]?.count ?? 1

  return (
    <section className="space-y-4" id="funnel">
      <SectionHeading
        eyebrow="Funnel + Runtime"
        title="Where launches break and how usage shifts by plan"
        description="Tracks the operational gap between payment, Telegram readiness, provider acceptance, and completion."
      />
      <div className="grid gap-4 2xl:grid-cols-[1.15fr_0.85fr]">
        <Panel className="p-5">
          <div className="mb-6">
            <p className="text-[11px] tracking-[0.2em] uppercase text-zinc-500">Launch funnel</p>
            <h3 className="mt-2 text-lg font-semibold text-white">Step-down by completion stage</h3>
          </div>
          <div className="space-y-4">
            {snapshot.launchFunnel.map((step, index) => {
              const nextStep = snapshot.launchFunnel[index + 1]
              const completion = step.count / funnelBase
              const stepConversion = nextStep ? Math.round((nextStep.count / step.count) * 100) : 100

              return (
                <div key={step.step} className="grid gap-2">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-zinc-300">{step.step}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-zinc-500">{Math.round(completion * 100)}% of entry</span>
                      <span className="font-medium text-white">{step.count}</span>
                    </div>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/6">
                    <div className="h-full rounded-full bg-[linear-gradient(90deg,rgba(245,158,11,0.9),rgba(34,197,94,0.8))]" style={{ width: `${completion * 100}%` }} />
                  </div>
                  {nextStep ? <p className="text-xs text-zinc-500">{stepConversion}% reach the next stage</p> : null}
                </div>
              )
            })}
          </div>
        </Panel>

        <Panel className="p-5">
          <div className="mb-6">
            <p className="text-[11px] tracking-[0.2em] uppercase text-zinc-500">Blocked launches</p>
            <h3 className="mt-2 text-lg font-semibold text-white">Top blocker reasons</h3>
          </div>
          <ChartContainer className="h-[320px] w-full" config={blockerConfig}>
            <BarChart accessibilityLayer data={snapshot.blockedLaunches} layout="vertical" margin={{ left: 10, right: 10 }}>
              <CartesianGrid horizontal={false} stroke="rgba(255,255,255,0.08)" />
              <YAxis axisLine={false} dataKey="reason" tick={{ fill: '#a1a1aa', fontSize: 12 }} tickLine={false} type="category" width={116} />
              <XAxis axisLine={false} tick={{ fill: '#71717a', fontSize: 12 }} tickLine={false} type="number" />
              <ChartTooltip content={<ChartTooltipContent indicator="line" />} cursor={false} />
              <Bar dataKey="count" fill="var(--color-count)" radius={8} />
            </BarChart>
          </ChartContainer>
        </Panel>
      </div>

      <div className="grid gap-4 2xl:grid-cols-[1.2fr_0.8fr_0.8fr]">
        <Panel className="p-5">
          <div className="mb-6">
            <p className="text-[11px] tracking-[0.2em] uppercase text-zinc-500">Launches per day</p>
            <h3 className="mt-2 text-lg font-semibold text-white">Accepted, failed, refunded, completed</h3>
          </div>
          <ChartContainer className="h-[300px] w-full" config={launchConfig}>
            <AreaChart accessibilityLayer data={snapshot.runtimeUsage.launchesPerDay}>
              <defs>
                <linearGradient id="accepted" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-providerAccepted)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="var(--color-providerAccepted)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis axisLine={false} dataKey="day" tick={{ fill: '#a1a1aa', fontSize: 12 }} tickLine={false} />
              <YAxis axisLine={false} tick={{ fill: '#71717a', fontSize: 12 }} tickLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} cursor={false} />
              <Area dataKey="providerAccepted" fill="url(#accepted)" stroke="var(--color-providerAccepted)" strokeWidth={2} type="monotone" />
              <Line dataKey="completed" dot={false} stroke="var(--color-completed)" strokeWidth={2} type="monotone" />
              <Line dataKey="failedBeforeAccept" dot={false} stroke="var(--color-failedBeforeAccept)" strokeWidth={2} type="monotone" />
            </AreaChart>
          </ChartContainer>
        </Panel>

        <Panel className="p-5">
          <div className="mb-6">
            <p className="text-[11px] tracking-[0.2em] uppercase text-zinc-500">Launches by plan</p>
            <h3 className="mt-2 text-lg font-semibold text-white">Mix across entitlement types</h3>
          </div>
          <ChartContainer className="h-[300px] w-full" config={planConfig}>
            <BarChart accessibilityLayer data={snapshot.runtimeUsage.launchesByPlan}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis axisLine={false} dataKey="plan" tick={{ fill: '#a1a1aa', fontSize: 12 }} tickLine={false} />
              <YAxis axisLine={false} tick={{ fill: '#71717a', fontSize: 12 }} tickLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} cursor={false} />
              <Bar dataKey="launches" fill="var(--color-launches)" radius={8} />
            </BarChart>
          </ChartContainer>
        </Panel>

        <Panel className="p-5">
          <div className="mb-6">
            <p className="text-[11px] tracking-[0.2em] uppercase text-zinc-500">Avg workspace minutes</p>
            <h3 className="mt-2 text-lg font-semibold text-white">Shadow pricing signal</h3>
          </div>
          <div className="space-y-4">
            {snapshot.runtimeUsage.launchesByPlan.map((plan) => (
              <div key={plan.plan}>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-zinc-300">{plan.plan}</span>
                  <span className="text-white">{formatMinutes(plan.avgWorkspaceMinutes)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/6">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,rgba(251,191,36,0.85),rgba(244,63,94,0.75))]"
                    style={{ width: `${Math.min(plan.avgWorkspaceMinutes / 2.4, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel className="p-5">
        <div className="mb-6">
          <p className="text-[11px] tracking-[0.2em] uppercase text-zinc-500">Peak concurrent runs</p>
          <h3 className="mt-2 text-lg font-semibold text-white">Concurrency pressure by plan</h3>
        </div>
        <ChartContainer className="h-[280px] w-full" config={peakConfig}>
          <LineChart accessibilityLayer data={snapshot.runtimeUsage.peakConcurrentRuns}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis axisLine={false} dataKey="day" tick={{ fill: '#a1a1aa', fontSize: 12 }} tickLine={false} />
            <YAxis axisLine={false} tick={{ fill: '#71717a', fontSize: 12 }} tickLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} cursor={false} />
            <Line dataKey="run" dot={false} stroke="var(--color-run)" strokeWidth={2} type="monotone" />
            <Line dataKey="warmStandby" dot={false} stroke="var(--color-warmStandby)" strokeWidth={2} type="monotone" />
            <Line dataKey="alwaysOn" dot={false} stroke="var(--color-alwaysOn)" strokeWidth={2} type="monotone" />
          </LineChart>
        </ChartContainer>
      </Panel>
    </section>
  )
}

export function BillingSection({ snapshot }: { snapshot: AdminUsageSnapshot }) {
  return (
    <section className="space-y-4" id="billing">
      <SectionHeading
        eyebrow="Billing Integrity"
        title="Ledger health before cost reporting"
        description="Reserves, commits, refunds, anomalies, and balance drift need to be trustworthy before pricing changes or support action."
      />
      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel className="p-5">
          <div className="mb-6">
            <p className="text-[11px] tracking-[0.2em] uppercase text-zinc-500">Ledger health summary</p>
            <h3 className="mt-2 text-lg font-semibold text-white">Fast scan</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {snapshot.billingHealth.summary.map((item) => (
              <MiniStat key={item.label} label={item.label} value={formatMetricValue(item.value, item.format)} />
            ))}
          </div>
        </Panel>

        <Panel className="p-5">
          <div className="mb-6">
            <p className="text-[11px] tracking-[0.2em] uppercase text-zinc-500">Recent anomalies</p>
            <h3 className="mt-2 text-lg font-semibold text-white">Latest 50 rows, most recent first</h3>
          </div>
          <div className="space-y-3">
            {snapshot.billingHealth.anomalies.map((anomaly) => (
              <div key={anomaly.id} className="rounded-2xl border border-white/8 bg-black/15 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <SignalPill tone={anomaly.severity}>{anomaly.severity}</SignalPill>
                      <p className="font-medium text-white">{anomaly.type}</p>
                    </div>
                    <p className="mt-2 text-sm text-zinc-400">{anomaly.message}</p>
                  </div>
                  <div className="text-right text-xs text-zinc-500">
                    <p>{anomaly.entity}</p>
                    <p className="mt-1">{formatDateTime(anomaly.createdAt)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel className="p-5">
        <div className="mb-6">
          <p className="text-[11px] tracking-[0.2em] uppercase text-zinc-500">Balance mismatch table</p>
          <h3 className="mt-2 text-lg font-semibold text-white">Stored subscription credits vs ledger recompute</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-white/8 hover:bg-transparent">
              <TableHead className="text-zinc-500">user_id</TableHead>
              <TableHead className="text-zinc-500">subscription_id</TableHead>
              <TableHead className="text-zinc-500">stored</TableHead>
              <TableHead className="text-zinc-500">recomputed</TableHead>
              <TableHead className="text-zinc-500">diff</TableHead>
              <TableHead className="text-zinc-500">last event</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {snapshot.billingHealth.mismatches.map((row) => (
              <TableRow key={row.subscriptionId} className="border-white/8 hover:bg-white/4">
                <TableCell>{row.userId}</TableCell>
                <TableCell>{row.subscriptionId}</TableCell>
                <TableCell>{formatMetricValue(row.storedRemainingCredits, 'credits')}</TableCell>
                <TableCell>{formatMetricValue(row.recomputedBalance, 'credits')}</TableCell>
                <TableCell className={row.diff < 0 ? 'text-red-300' : 'text-amber-200'}>
                  {row.diff > 0 ? '+' : ''}
                  {row.diff}
                </TableCell>
                <TableCell className="text-zinc-500">{formatDateTime(row.lastLedgerEventAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </section>
  )
}

export function UsersSection({
  generatedAt,
  users,
  onSelectUser,
}: {
  generatedAt: string
  users: AdminUserRecord[]
  onSelectUser: (userId: string) => void
}) {
  return (
    <section className="space-y-4" id="users">
      <SectionHeading
        eyebrow="User Drilldown"
        title="Searchable user table with one-click inspection"
        description="This is the operational bridge from high-level metrics down to subscription state, ledger events, recent runs, and bundle readiness."
      />
      <Panel className="overflow-hidden">
        <div className="border-b border-white/8 px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-400">
            <span>{users.length} visible users</span>
            <span>{formatDate(generatedAt)} snapshot date</span>
            <span>Click any row to open the right-side drilldown</span>
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-white/8 hover:bg-transparent">
              <TableHead className="px-5 text-zinc-500 sm:px-6">user</TableHead>
              <TableHead className="text-zinc-500">plan</TableHead>
              <TableHead className="text-zinc-500">remaining</TableHead>
              <TableHead className="text-zinc-500">period end</TableHead>
              <TableHead className="text-zinc-500">launches</TableHead>
              <TableHead className="text-zinc-500">blocked</TableHead>
              <TableHead className="text-zinc-500">avg minutes</TableHead>
              <TableHead className="text-zinc-500">est cost</TableHead>
              <TableHead className="text-zinc-500">pairing</TableHead>
              <TableHead className="pr-5 text-zinc-500 sm:pr-6">last launch</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow
                key={user.id}
                className="cursor-pointer border-white/8 hover:bg-white/4"
                onClick={() => onSelectUser(user.id)}
              >
                <TableCell className="px-5 sm:px-6">
                  <div>
                    <p className="font-medium text-white">{user.name}</p>
                    <p className="mt-1 text-xs text-zinc-500">{user.email}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <SignalPill tone={healthTone[user.health]} className="tracking-[0.16em]">
                    {user.currentPlan.replaceAll('_', ' ')}
                  </SignalPill>
                </TableCell>
                <TableCell>{formatMetricValue(user.remainingCredits, 'credits')}</TableCell>
                <TableCell className="text-zinc-400">{formatDate(user.currentPeriodEnd)}</TableCell>
                <TableCell>{user.launchesThisPeriod}</TableCell>
                <TableCell className={user.blockedLaunchesThisPeriod > 0 ? 'text-amber-200' : 'text-zinc-300'}>
                  {user.blockedLaunchesThisPeriod}
                </TableCell>
                <TableCell>{formatMinutes(user.avgWorkspaceMinutes)}</TableCell>
                <TableCell>{formatMetricValue(user.estCostThisPeriodCents, 'currency')}</TableCell>
                <TableCell>{user.pairingReady ? 'ready' : 'blocked'}</TableCell>
                <TableCell className="pr-5 text-zinc-500 sm:pr-6">{formatDateTime(user.lastLaunchAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </section>
  )
}

export function AlwaysOnSection({ snapshot }: { snapshot: AdminUsageSnapshot }) {
  return (
    <section className="space-y-4" id="always-on">
      <SectionHeading
        eyebrow="Always On Shadow Monitor"
        title="High-cost users isolated from Run and Warm Standby traffic"
        description="Always-on should be judged on sustained value versus cost, not mixed into bursty launch cohorts."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MiniStat label="Always-on active users" value={snapshot.alwaysOnShadow.activeUsers.toString()} />
        <MiniStat label="Avg workspace min/day" value={formatMinutes(snapshot.alwaysOnShadow.avgWorkspaceMinutesPerDay)} />
        <MiniStat label="Avg active bundles" value={snapshot.alwaysOnShadow.avgActiveBundles.toFixed(1)} />
        <MiniStat label="Avg concurrent runs" value={snapshot.alwaysOnShadow.avgConcurrentRuns.toFixed(1)} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel className="p-5">
          <div className="mb-6">
            <p className="text-[11px] tracking-[0.2em] uppercase text-zinc-500">Top estimated cost users</p>
            <h3 className="mt-2 text-lg font-semibold text-white">Who is expensive right now</h3>
          </div>
          <div className="space-y-3">
            {snapshot.alwaysOnShadow.topEstimatedCostUsers.map((row) => (
              <RankRow key={row.user} row={row} />
            ))}
          </div>
        </Panel>
        <Panel className="p-5">
          <div className="mb-6">
            <p className="text-[11px] tracking-[0.2em] uppercase text-zinc-500">Top idle occupancy users</p>
            <h3 className="mt-2 text-lg font-semibold text-white">Who may need plan pressure</h3>
          </div>
          <div className="space-y-3">
            {snapshot.alwaysOnShadow.topIdleOccupancyUsers.map((row) => (
              <RankRow key={row.user} row={row} />
            ))}
          </div>
        </Panel>
      </div>
    </section>
  )
}

function RankRow({ row }: { row: { user: string; value: string; context: string } }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/15 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-white">{row.user}</p>
          <p className="mt-1 text-sm text-zinc-400">{row.context}</p>
        </div>
        <p className="text-lg font-semibold text-amber-100">{row.value}</p>
      </div>
    </div>
  )
}
