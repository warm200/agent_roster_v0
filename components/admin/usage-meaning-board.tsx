'use client'

import type { AdminUsageSnapshot } from '@/lib/admin-usage-data'

import {
  MetricCard,
  Panel,
} from './usage-primitives'

export function UsageMeaningBoard({ snapshot }: { snapshot: AdminUsageSnapshot }) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {snapshot.meaningMetrics.summary.map((metric) => (
          <MetricCard key={metric.key} metric={metric} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel className="overflow-hidden">
          <div className="border-b border-white/8 px-5 py-4">
            <p className="text-[11px] tracking-[0.2em] uppercase text-zinc-500">Meaning metrics by plan</p>
            <h3 className="mt-2 text-lg font-semibold text-white">Launch / wake pressure, runtime minutes, and plan cost</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 text-left">
                  <th className="px-5 py-3 font-medium text-zinc-500">plan</th>
                  <th className="px-5 py-3 font-medium text-zinc-500">avg launches / wakes / user</th>
                  <th className="px-5 py-3 font-medium text-zinc-500">avg workspace min / run</th>
                  <th className="px-5 py-3 font-medium text-zinc-500">est internal cost</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.meaningMetrics.byPlan.map((row) => (
                  <tr key={row.plan} className="border-b border-white/8 last:border-b-0">
                    <td className="px-5 py-4">
                      <p className="font-medium text-white">{row.plan}</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {row.sessionCount} sessions across {row.activeUsers} active users
                      </p>
                    </td>
                    <td className="px-5 py-4 text-white">{row.avgLaunchWakeCount.toFixed(2)}x</td>
                    <td className="px-5 py-4 text-white">{row.avgWorkspaceMinutesPerRun.toLocaleString('en-US')} min</td>
                    <td className="px-5 py-4 text-white">
                      ${(row.estimatedInternalCostCents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel className="p-5">
          <div className="mb-6">
            <p className="text-[11px] tracking-[0.2em] uppercase text-zinc-500">Top 5% heavy users</p>
            <h3 className="mt-2 text-lg font-semibold text-white">Who is actually eating runtime</h3>
          </div>
          <div className="space-y-3">
            {snapshot.meaningMetrics.topHeavyUsers.map((row) => (
              <div key={`${row.user}-${row.value}`} className="rounded-2xl border border-white/8 bg-black/15 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-white">{row.user}</p>
                    <p className="mt-1 text-sm text-zinc-400">{row.context}</p>
                  </div>
                  <p className="text-lg font-semibold text-amber-100">{row.value}</p>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  )
}
