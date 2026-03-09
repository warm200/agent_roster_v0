"use client"

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { RunStatusBadge } from '@/components/run-status-badge'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getRunAgents } from '@/lib/mock-selectors'
import { mockRuns } from '@/lib/mock-data'
import type { RunStatus } from '@/lib/types'
import { formatDateTime } from '@/lib/utils'
import { ArrowUpDown, Filter, Play, Search } from 'lucide-react'

type RunFilter = 'all' | RunStatus
type SortKey = 'date' | 'status'

function getStatusCount(status: RunStatus) {
  return mockRuns.filter((run) => run.status === status).length
}

export default function RunsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<RunFilter>('all')
  const [sortBy, setSortBy] = useState<SortKey>('date')

  const filteredRuns = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return [...mockRuns]
      .filter((run) => {
        if (statusFilter !== 'all' && run.status !== statusFilter) {
          return false
        }

        if (!query) {
          return true
        }

        const searchable = [run.id, run.orderId, ...getRunAgents(run).map((agent) => agent.title)]
          .join(' ')
          .toLowerCase()

        return searchable.includes(query)
      })
      .sort((left, right) => {
        if (sortBy === 'status') {
          return left.status.localeCompare(right.status)
        }

        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      })
  }, [searchQuery, sortBy, statusFilter])

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Run History</h1>
        <p className="mt-2 text-muted-foreground">
          Monitor bundle runs, review logs, and inspect generated artifacts.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Runs" value={mockRuns.length.toString()} />
        <StatCard label="Completed" value={getStatusCount('completed').toString()} tone="text-emerald-400" />
        <StatCard label="Running" value={getStatusCount('running').toString()} tone="text-amber-400" />
        <StatCard label="Failed" value={getStatusCount('failed').toString()} tone="text-red-400" />
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-10"
            placeholder="Search by run ID, bundle ID, or agent title"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as RunFilter)}>
            <SelectTrigger className="w-[170px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="provisioning">Provisioning</SelectItem>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortKey)}>
            <SelectTrigger className="w-[150px]">
              <ArrowUpDown className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Newest First</SelectItem>
              <SelectItem value="status">By Status</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader className="border-b border-border">
          <CardTitle className="text-base">
            {filteredRuns.length} Run{filteredRuns.length === 1 ? '' : 's'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredRuns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-4 rounded-full bg-secondary p-3">
                <Play className="h-6 w-6 text-muted-foreground" />
              </div>
              <h2 className="font-medium">No runs found</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Adjust your filters or launch a new run from a purchased bundle.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredRuns.map((run) => {
                const agents = getRunAgents(run)
                const [primaryAgent, ...restAgents] = agents

                return (
                  <Link
                    key={run.id}
                    href={`/app/runs/${run.id}`}
                    className="flex flex-col gap-4 p-4 transition-colors hover:bg-secondary/40 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="font-medium">
                          {primaryAgent?.title ?? 'Bundle run'}
                        </span>
                        {restAgents.length > 0 && (
                          <Badge variant="secondary">
                            +{restAgents.length} more
                          </Badge>
                        )}
                        <span className="font-mono text-xs text-muted-foreground">{run.id}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Bundle {run.orderId} • Created {formatDateTime(run.createdAt)}
                      </p>
                      <p className="mt-2 text-sm text-foreground">
                        {run.resultSummary ?? 'Run in progress. Logs and results will update when steps complete.'}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 lg:shrink-0">
                      <div className="text-right text-sm text-muted-foreground">
                        <div>{run.resultArtifacts.length} artifact{run.resultArtifacts.length === 1 ? '' : 's'}</div>
                        <div>{agents.length} agent{agents.length === 1 ? '' : 's'} in bundle</div>
                      </div>
                      <RunStatusBadge status={run.status} />
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({
  label,
  tone,
  value,
}: {
  label: string
  tone?: string
  value: string
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className={`text-2xl font-bold ${tone ?? ''}`}>{value}</div>
        <p className="text-sm text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  )
}
