"use client"

import { useEffect, useMemo, useState } from 'react'
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
import { Skeleton } from '@/components/ui/skeleton'
import type { Agent, Order, Run, RunLog, RunStatus } from '@/lib/types'
import { formatDateTime } from '@/lib/utils'
import { AlertTriangle, ArrowUpDown, Filter, Play, Search } from 'lucide-react'

type RunFilter = 'all' | RunStatus
type SortKey = 'date' | 'status'

interface RunSummary extends Run {
  agents: Agent[]
  artifactsCount: number
  logs: RunLog[]
  logsCount: number
  order: Order | undefined
}

export default function RunsPage() {
  const [runs, setRuns] = useState<RunSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<RunFilter>('all')
  const [sortBy, setSortBy] = useState<SortKey>('date')

  useEffect(() => {
    let isMounted = true

    async function loadRuns() {
      setIsLoading(true)
      setLoadError(null)

      try {
        const response = await fetch('/api/runs')
        const payload = await response.json()

        if (!response.ok) {
          throw new Error(payload.error || 'Unable to load runs')
        }

        if (isMounted) {
          setRuns(payload.runs)
        }
      } catch (error) {
        if (isMounted) {
          setLoadError(error instanceof Error ? error.message : 'Unable to load runs')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadRuns()

    return () => {
      isMounted = false
    }
  }, [])

  const filteredRuns = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return [...runs]
      .filter((run) => {
        if (statusFilter !== 'all' && run.status !== statusFilter) {
          return false
        }

        if (!query) {
          return true
        }

        const searchable = [run.id, run.orderId, ...run.agents.map((agent) => agent.title)]
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
  }, [runs, searchQuery, sortBy, statusFilter])

  const stats = useMemo(
    () => ({
      completed: runs.filter((run) => run.status === 'completed').length,
      failed: runs.filter((run) => run.status === 'failed').length,
      running: runs.filter((run) => run.status === 'running').length,
      total: runs.length,
    }),
    [runs]
  )

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Run History</h1>
        <p className="mt-2 text-muted-foreground">
          Monitor bundle runs, review logs, and inspect generated artifacts.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Runs" value={stats.total.toString()} />
        <StatCard label="Completed" value={stats.completed.toString()} tone="text-emerald-400" />
        <StatCard label="Running" value={stats.running.toString()} tone="text-amber-400" />
        <StatCard label="Failed" value={stats.failed.toString()} tone="text-red-400" />
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
            {isLoading ? 'Loading runs...' : `${filteredRuns.length} Run${filteredRuns.length === 1 ? '' : 's'}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <RunsListSkeleton />
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-4 rounded-full bg-red-500/10 p-3">
                <AlertTriangle className="h-6 w-6 text-red-400" />
              </div>
              <h2 className="font-medium">Unable to load runs</h2>
              <p className="mt-1 text-sm text-muted-foreground">{loadError}</p>
            </div>
          ) : filteredRuns.length === 0 ? (
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
                const [primaryAgent, ...restAgents] = run.agents

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
                        <div>{run.artifactsCount} artifact{run.artifactsCount === 1 ? '' : 's'}</div>
                        <div>{run.agents.length} agent{run.agents.length === 1 ? '' : 's'} in bundle</div>
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

function RunsListSkeleton() {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1 space-y-3">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-4 w-full" />
          </div>
          <div className="flex items-center gap-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-28" />
            </div>
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}
