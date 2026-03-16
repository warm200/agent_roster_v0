'use client'

import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type { AdminUserRecord } from '@/lib/admin-usage-data'
import { formatDateTime } from '@/lib/utils'

import { MiniStat, Panel, SignalPill, formatMetricValue, formatMinutes } from './usage-primitives'

const healthTone = {
  stable: 'stable',
  watch: 'warning',
  blocked: 'critical',
} as const

const statusTone = {
  provisioning: 'info',
  running: 'warning',
  completed: 'stable',
  failed: 'critical',
} as const

export function UserDrilldownSheet({
  open,
  onOpenChange,
  user,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: AdminUserRecord | null
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-full overflow-hidden border-white/10 bg-[#09090b] p-0 text-white sm:max-w-[36rem]"
        side="right"
      >
        {user ? (
          <>
            <SheetHeader className="border-b border-white/8 bg-[linear-gradient(180deg,rgba(245,158,11,0.08),rgba(9,9,11,0.98))] px-6 py-6 text-left">
              <div className="flex items-start justify-between gap-3 pr-8">
                <div>
                  <p className="text-[11px] tracking-[0.24em] uppercase text-amber-100/70">User Drilldown</p>
                  <SheetTitle className="mt-2 text-2xl">{user.name}</SheetTitle>
                  <SheetDescription className="mt-1 text-sm text-zinc-400">{user.email}</SheetDescription>
                </div>
                <SignalPill tone={healthTone[user.health]}>{user.health}</SignalPill>
              </div>
            </SheetHeader>

            <div className="h-full overflow-y-auto px-6 pb-8">
              <div className="grid gap-3 py-5 sm:grid-cols-3">
                <MiniStat label="Plan" value={user.currentPlan.replaceAll('_', ' ')} />
                <MiniStat label="Remaining" value={formatMetricValue(user.remainingCredits, 'credits')} />
                <MiniStat label="Last Launch" value={formatDateTime(user.lastLaunchAt)} />
              </div>

              <div className="space-y-5">
                <Panel className="p-5">
                  <div className="mb-4">
                    <p className="text-[11px] tracking-[0.2em] uppercase text-zinc-500">Subscription</p>
                    <h3 className="mt-2 text-lg font-semibold text-white">Current entitlement snapshot</h3>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <KeyValue label="plan_code" value={user.subscription.planCode} />
                    <KeyValue label="plan_version" value={user.subscription.planVersion} />
                    <KeyValue label="included_credits" value={formatMetricValue(user.subscription.includedCredits, 'credits')} />
                    <KeyValue label="remaining_credits" value={formatMetricValue(user.subscription.remainingCredits, 'credits')} />
                    <KeyValue label="period_start" value={formatDateTime(user.subscription.currentPeriodStart)} />
                    <KeyValue label="period_end" value={formatDateTime(user.subscription.currentPeriodEnd)} />
                  </div>
                </Panel>

                <Panel className="p-5">
                  <div className="mb-4">
                    <p className="text-[11px] tracking-[0.2em] uppercase text-zinc-500">Ledger Timeline</p>
                    <h3 className="mt-2 text-lg font-semibold text-white">Recent credit movements</h3>
                  </div>
                  <div className="space-y-3">
                    {user.ledgerTimeline.map((event) => (
                      <div key={event.id} className="rounded-2xl border border-white/8 bg-black/15 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-white">
                              {event.type} · {event.reasonCode}
                            </p>
                            <p className="mt-1 text-xs text-zinc-500">{formatDateTime(event.createdAt)}</p>
                          </div>
                          <SignalPill tone={event.status === 'reversed' ? 'critical' : event.status === 'pending' ? 'warning' : 'stable'}>
                            {event.status}
                          </SignalPill>
                        </div>
                        <p className="mt-3 text-xl font-semibold text-white">
                          {event.deltaCredits > 0 ? '+' : ''}
                          {formatMetricValue(event.deltaCredits, 'credits')}
                        </p>
                      </div>
                    ))}
                  </div>
                </Panel>

                <Panel className="p-5">
                  <div className="mb-4">
                    <p className="text-[11px] tracking-[0.2em] uppercase text-zinc-500">Run Timeline</p>
                    <h3 className="mt-2 text-lg font-semibold text-white">Recent launch outcomes</h3>
                  </div>
                  <div className="space-y-3">
                    {user.runTimeline.map((run) => (
                      <div key={run.id} className="rounded-2xl border border-white/8 bg-black/15 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-white">{run.id}</p>
                            <p className="mt-1 text-xs text-zinc-500">
                              {run.providerAcceptedAt ? formatDateTime(run.providerAcceptedAt) : 'Provider never accepted'}
                            </p>
                          </div>
                          <SignalPill tone={statusTone[run.status]}>{run.status}</SignalPill>
                        </div>
                        <Separator className="my-4 bg-white/8" />
                        <div className="grid gap-3 sm:grid-cols-2">
                          <KeyValue label="workspace_minutes" value={run.workspaceMinutes ? formatMinutes(run.workspaceMinutes) : 'n/a'} />
                          <KeyValue label="termination_reason" value={run.terminationReason ?? 'active'} />
                        </div>
                      </div>
                    ))}
                  </div>
                </Panel>

                <Panel className="p-5">
                  <div className="mb-4">
                    <p className="text-[11px] tracking-[0.2em] uppercase text-zinc-500">Bundle Readiness</p>
                    <h3 className="mt-2 text-lg font-semibold text-white">Operational launch prep</h3>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <MiniStat label="Purchased" value={user.bundleReadiness.purchasedBundles.toString()} />
                    <MiniStat label="Paired" value={user.bundleReadiness.pairedBundles.toString()} />
                    <MiniStat label="Blocked" value={user.bundleReadiness.blockedBundles.toString()} />
                  </div>
                </Panel>
              </div>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] tracking-[0.2em] uppercase text-zinc-500">{label}</p>
      <p className="mt-2 text-sm text-zinc-200">{value}</p>
    </div>
  )
}
