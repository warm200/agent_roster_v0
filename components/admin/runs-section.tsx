'use client'

import { Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { AdminRunsPage } from '@/lib/admin-runs-data'
import { formatDateTime } from '@/lib/utils'

import { Panel, SectionHeading, SignalPill, formatMetricValue, formatMinutes } from './usage-primitives'

const statusTone = {
  completed: 'stable',
  failed: 'critical',
  provisioning: 'info',
  running: 'warning',
} as const

const runtimeTone = {
  archived: 'info',
  deleted: 'critical',
  failed: 'critical',
  provisioning: 'info',
  running: 'warning',
  stopped: 'stable',
} as const

export function RunsSection({
  onNextPage,
  onPrevPage,
  onSearch,
  onSearchChange,
  onSelectRun,
  runsPage,
  searchValue,
}: {
  onNextPage: () => void
  onPrevPage: () => void
  onSearch: () => void
  onSearchChange: (value: string) => void
  onSelectRun: (runId: string) => void
  runsPage: AdminRunsPage
  searchValue: string
}) {
  return (
    <section className="space-y-4" id="runs">
      <SectionHeading
        eyebrow="Runs"
        title="Paginated run status board"
        description="Latest runs first. Search by run id, order id, user id, user name, email, or provider instance ref, then open a row for full lifecycle detail."
      />

      <Panel className="overflow-hidden">
        <div className="border-b border-white/8 px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-sm text-zinc-400">{runsPage.implementationNote}</p>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-zinc-500">
                <span>{runsPage.totalRuns} total runs</span>
                <span>Page {runsPage.page} / {runsPage.totalPages}</span>
                <span>{runsPage.pageSize} rows max per page</span>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative min-w-[20rem]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <Input
                  className="border-white/10 bg-black/20 pl-9 text-white placeholder:text-zinc-500"
                  onChange={(event) => onSearchChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      onSearch()
                    }
                  }}
                  placeholder="run_id / order_id / user / provider ref"
                  value={searchValue}
                />
              </div>
              <Button className="border-white/10 bg-black/20 text-white hover:bg-white/10" onClick={onSearch} variant="outline">
                Search
              </Button>
            </div>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="border-white/8 hover:bg-transparent">
              <TableHead className="px-5 text-zinc-500 sm:px-6">run</TableHead>
              <TableHead className="text-zinc-500">status</TableHead>
              <TableHead className="text-zinc-500">plan</TableHead>
              <TableHead className="text-zinc-500">user</TableHead>
              <TableHead className="text-zinc-500">order</TableHead>
              <TableHead className="text-zinc-500">last activity</TableHead>
              <TableHead className="text-zinc-500">termination</TableHead>
              <TableHead className="text-zinc-500">workspace</TableHead>
              <TableHead className="pr-5 text-zinc-500 sm:pr-6">cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runsPage.rows.map((run) => (
              <TableRow
                key={run.id}
                className="cursor-pointer border-white/8 hover:bg-white/4"
                onClick={() => onSelectRun(run.id)}
              >
                <TableCell className="px-5 sm:px-6">
                  <div>
                    <p className="font-medium text-white">{run.id}</p>
                    <p className="mt-1 text-xs text-zinc-500">{formatDateTime(run.createdAt)}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    <SignalPill tone={statusTone[run.status]}>{run.status}</SignalPill>
                    {run.runtimeState ? <SignalPill tone={runtimeTone[run.runtimeState]}>{run.runtimeState}</SignalPill> : null}
                  </div>
                </TableCell>
                <TableCell className="text-zinc-300">{run.planId.replaceAll('_', ' ')}</TableCell>
                <TableCell>
                  <div>
                    <p className="text-white">{run.userName}</p>
                    <p className="mt-1 text-xs text-zinc-500">{run.userEmail}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <p className="text-white">{run.orderId}</p>
                    <p className="mt-1 text-xs text-zinc-500">{run.orderStatus}</p>
                  </div>
                </TableCell>
                <TableCell className="text-zinc-300">
                  {run.lastMeaningfulActivityAt ? formatDateTime(run.lastMeaningfulActivityAt) : 'n/a'}
                </TableCell>
                <TableCell className="text-zinc-300">{run.terminationReason ?? run.runtimeStopReason ?? 'active'}</TableCell>
                <TableCell className="text-zinc-300">
                  {run.workspaceMinutes != null ? formatMinutes(run.workspaceMinutes) : 'n/a'}
                </TableCell>
                <TableCell className="pr-5 text-zinc-300 sm:pr-6">
                  {formatMetricValue(run.estimatedInternalCostCents ?? 0, 'currency')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="flex flex-col gap-3 border-t border-white/8 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-sm text-zinc-500">
            Showing {(runsPage.page - 1) * runsPage.pageSize + (runsPage.rows.length > 0 ? 1 : 0)}
            {' '}-
            {' '}
            {(runsPage.page - 1) * runsPage.pageSize + runsPage.rows.length}
            {' '}of {runsPage.totalRuns}
          </p>
          <div className="flex gap-2">
            <Button disabled={runsPage.page <= 1} onClick={onPrevPage} variant="outline">
              Previous
            </Button>
            <Button disabled={runsPage.page >= runsPage.totalPages} onClick={onNextPage} variant="outline">
              Next
            </Button>
          </div>
        </div>
      </Panel>
    </section>
  )
}
