'use client'

import { startTransition, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Search,
  Activity,
  DatabaseZap,
  Radar,
  ShieldAlert,
  Users,
} from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { AdminDateRange, AdminUsageSnapshot } from '@/lib/admin-usage-data'
import { formatDateTime } from '@/lib/utils'

import {
  AlwaysOnSection,
  BillingSection,
  FunnelRuntimeSection,
  UsersSection,
} from './usage-sections'
import { UserDrilldownSheet } from './user-drilldown-sheet'
import {
  MetricCard,
  Panel,
  SectionHeading,
  SignalPill,
} from './usage-primitives'

const sectionLinks = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'funnel', label: 'Funnel', icon: Radar },
  { id: 'billing', label: 'Billing', icon: DatabaseZap },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'always-on', label: 'Always On', icon: ShieldAlert },
]

function buildUserSearchText(user: AdminUsageSnapshot['users'][number]) {
  return [
    user.id,
    user.name,
    user.email,
    ...user.orderIds,
    ...user.runTimeline.map((run) => run.id),
  ]
    .join(' ')
    .toLowerCase()
}

export function AdminUsageDashboard({ snapshot }: { snapshot: AdminUsageSnapshot }) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [dateRange, setDateRange] = useState<AdminDateRange>(snapshot.selectedRange)
  const [planFilter, setPlanFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [healthFilter, setHealthFilter] = useState('all')
  const [orderIdFilter, setOrderIdFilter] = useState('')
  const [runIdFilter, setRunIdFilter] = useState('')
  const [search, setSearch] = useState('')
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  useEffect(() => {
    setDateRange(snapshot.selectedRange)
  }, [snapshot.selectedRange])

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase()
    const orderQuery = orderIdFilter.trim().toLowerCase()
    const runQuery = runIdFilter.trim().toLowerCase()

    return snapshot.users.filter((user) => {
      if (planFilter !== 'all' && user.currentPlan !== planFilter) {
        return false
      }

      if (statusFilter !== 'all' && user.latestRunStatus !== statusFilter) {
        return false
      }

      if (healthFilter !== 'all' && user.health !== healthFilter) {
        return false
      }

      if (orderQuery && !user.orderIds.some((orderId) => orderId.toLowerCase().includes(orderQuery))) {
        return false
      }

      if (runQuery && !user.runTimeline.some((run) => run.id.toLowerCase().includes(runQuery))) {
        return false
      }

      if (!query) {
        return true
      }

      return buildUserSearchText(user).includes(query)
    })
  }, [healthFilter, orderIdFilter, planFilter, runIdFilter, search, snapshot.users, statusFilter])

  useEffect(() => {
    if (selectedUserId && !filteredUsers.some((user) => user.id === selectedUserId)) {
      setSelectedUserId(null)
    }
  }, [filteredUsers, selectedUserId])

  const handleRangeChange = (nextRange: string) => {
    const normalizedRange = nextRange as AdminDateRange
    const params = new URLSearchParams(searchParams.toString())

    setDateRange(normalizedRange)

    if (normalizedRange === '7d') {
      params.delete('range')
    } else {
      params.set('range', normalizedRange)
    }

    startTransition(() => {
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    })
  }

  const selectedUser = snapshot.users.find((user) => user.id === selectedUserId) ?? null

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.12),transparent_24%),radial-gradient(circle_at_top_right,rgba(34,197,94,0.08),transparent_18%),#09090b] text-white">
      <div className="mx-auto flex max-w-[1680px] gap-8 px-4 py-5 sm:px-6 xl:px-8">
        <aside className="sticky top-5 hidden h-[calc(100vh-2.5rem)] w-56 shrink-0 xl:flex">
          <Panel className="flex h-full w-full flex-col justify-between p-5">
            <div>
              <p className="text-[11px] tracking-[0.28em] uppercase text-amber-100/70">Internal Admin</p>
              <h1 className="mt-3 text-2xl font-semibold leading-tight">Usage console</h1>
              <p className="mt-3 text-sm leading-6 text-zinc-400">{snapshot.implementationNote}</p>
            </div>
            <nav className="space-y-2">
              {sectionLinks.map((item) => (
                <a
                  key={item.id}
                  className="flex items-center gap-3 rounded-2xl border border-transparent px-3 py-2 text-sm text-zinc-400 transition hover:border-white/8 hover:bg-white/4 hover:text-white"
                  href={`#${item.id}`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </a>
              ))}
            </nav>
          </Panel>
        </aside>

        <main className="min-w-0 flex-1 space-y-8">
          <Panel className="overflow-hidden">
            <div className="border-b border-white/8 bg-[linear-gradient(180deg,rgba(245,158,11,0.08),rgba(255,255,255,0.02))] px-5 py-5 sm:px-6">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <SignalPill tone="warning">Internal only</SignalPill>
                    <SignalPill tone="info">{snapshot.environment}</SignalPill>
                    <SignalPill tone={snapshot.environment === 'live-db' ? 'stable' : 'warning'}>
                      {snapshot.environment === 'live-db' ? 'Live read model' : 'Read model draft'}
                    </SignalPill>
                  </div>
                  <div>
                    <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Ops + billing integrity console</h1>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
                      Designed for launch funnel visibility, credit-ledger correctness, and cost shadow monitoring.
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:w-[72rem] xl:grid-cols-6">
                  <Select value={dateRange} onValueChange={handleRangeChange}>
                    <SelectTrigger className="w-full border-white/10 bg-black/20 text-white">
                      <SelectValue placeholder="Date range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="24h">24 hours</SelectItem>
                      <SelectItem value="7d">7 days</SelectItem>
                      <SelectItem value="30d">30 days</SelectItem>
                      <SelectItem disabled value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={planFilter} onValueChange={setPlanFilter}>
                    <SelectTrigger className="w-full border-white/10 bg-black/20 text-white">
                      <SelectValue placeholder="Plan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All plans</SelectItem>
                      <SelectItem value="run">Run</SelectItem>
                      <SelectItem value="warm_standby">Warm standby</SelectItem>
                      <SelectItem value="always_on">Always on</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full border-white/10 bg-black/20 text-white">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="provisioning">Provisioning</SelectItem>
                      <SelectItem value="running">Running</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="none">No runs</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={healthFilter} onValueChange={setHealthFilter}>
                    <SelectTrigger className="w-full border-white/10 bg-black/20 text-white">
                      <SelectValue placeholder="Health" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All health states</SelectItem>
                      <SelectItem value="stable">Stable</SelectItem>
                      <SelectItem value="watch">Watch</SelectItem>
                      <SelectItem value="blocked">Blocked</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    <Input
                      className="border-white/10 bg-black/20 pl-9 text-white placeholder:text-zinc-500"
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="user / order / run"
                      value={search}
                    />
                  </div>
                  <Input
                    className="border-white/10 bg-black/20 text-white placeholder:text-zinc-500"
                    onChange={(event) => setOrderIdFilter(event.target.value)}
                    placeholder="order_id"
                    value={orderIdFilter}
                  />
                  <Input
                    className="border-white/10 bg-black/20 text-white placeholder:text-zinc-500"
                    onChange={(event) => setRunIdFilter(event.target.value)}
                    placeholder="run_id"
                    value={runIdFilter}
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-zinc-500">
                <span>{snapshot.windowLabel}</span>
                <span>Generated {formatDateTime(snapshot.generatedAt)}</span>
                <span>{filteredUsers.length} users in current filter set</span>
              </div>
            </div>
          </Panel>

          <section className="space-y-4" id="overview">
            <SectionHeading
              eyebrow="Overview"
              title="Global health snapshot"
              description="Alert-first metrics for paid runtime usage, funnel completion, launch health, and cost movement."
            />
            <div className="grid gap-3">
              {snapshot.alerts.map((alert) => (
                <Panel key={alert.id} className="p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="rounded-2xl border border-white/8 bg-black/20 p-2">
                        <AlertTriangle className="h-4 w-4 text-amber-200" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <SignalPill tone={alert.severity}>{alert.severity}</SignalPill>
                          <p className="font-medium text-white">{alert.title}</p>
                        </div>
                        <p className="mt-2 text-sm text-zinc-400">{alert.detail}</p>
                      </div>
                    </div>
                  </div>
                </Panel>
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {snapshot.overviewMetrics.map((metric) => (
                <MetricCard key={metric.key} metric={metric} />
              ))}
            </div>
          </section>

          <FunnelRuntimeSection snapshot={snapshot} />
          <BillingSection snapshot={snapshot} />
          <UsersSection generatedAt={snapshot.generatedAt} onSelectUser={setSelectedUserId} users={filteredUsers} />
          <AlwaysOnSection snapshot={snapshot} />
        </main>
      </div>

      <UserDrilldownSheet onOpenChange={(open) => !open && setSelectedUserId(null)} open={Boolean(selectedUser)} user={selectedUser} />
    </div>
  )
}
