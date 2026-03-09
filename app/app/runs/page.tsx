"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  Play, 
  Pause, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Search,
  Filter,
  ArrowUpDown,
  ExternalLink,
  AlertTriangle
} from "lucide-react"
import { mockRuns, mockAgents } from "@/lib/mock-data"
import { Run, RunStatus } from "@/lib/types"

const statusConfig: Record<RunStatus, { icon: React.ReactNode; className: string; label: string }> = {
  queued: {
    icon: <Clock className="h-3.5 w-3.5" />,
    className: "bg-muted text-muted-foreground",
    label: "Queued"
  },
  running: {
    icon: <Play className="h-3.5 w-3.5" />,
    className: "bg-blue-500/20 text-blue-400",
    label: "Running"
  },
  awaiting_approval: {
    icon: <Pause className="h-3.5 w-3.5" />,
    className: "bg-amber-500/20 text-amber-400",
    label: "Awaiting Approval"
  },
  completed: {
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    className: "bg-emerald-500/20 text-emerald-400",
    label: "Completed"
  },
  failed: {
    icon: <XCircle className="h-3.5 w-3.5" />,
    className: "bg-red-500/20 text-red-400",
    label: "Failed"
  },
  cancelled: {
    icon: <XCircle className="h-3.5 w-3.5" />,
    className: "bg-muted text-muted-foreground",
    label: "Cancelled"
  }
}

function RunStatusBadge({ status }: { status: RunStatus }) {
  const config = statusConfig[status]
  return (
    <Badge variant="secondary" className={`gap-1 ${config.className}`}>
      {config.icon}
      {config.label}
    </Badge>
  )
}

function formatDuration(seconds?: number): string {
  if (!seconds) return "-"
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}m ${secs}s`
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date)
}

export default function RunsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<"date" | "status">("date")

  const filteredRuns = useMemo(() => {
    let runs = [...mockRuns]

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      runs = runs.filter(run => {
        const agent = mockAgents.find(a => a.id === run.agentId)
        return (
          run.id.toLowerCase().includes(query) ||
          agent?.name.toLowerCase().includes(query)
        )
      })
    }

    // Filter by status
    if (statusFilter !== "all") {
      runs = runs.filter(run => run.status === statusFilter)
    }

    // Sort
    runs.sort((a, b) => {
      if (sortBy === "date") {
        return b.startedAt.getTime() - a.startedAt.getTime()
      }
      return a.status.localeCompare(b.status)
    })

    return runs
  }, [searchQuery, statusFilter, sortBy])

  const runsByStatus = useMemo(() => {
    return mockRuns.reduce((acc, run) => {
      acc[run.status] = (acc[run.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  }, [])

  const awaitingApprovalCount = runsByStatus.awaiting_approval || 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Agent Runs</h1>
          <p className="text-muted-foreground mt-1">
            Monitor and manage your agent execution history
          </p>
        </div>
        {awaitingApprovalCount > 0 && (
          <Button variant="outline" className="gap-2 border-amber-500/50 text-amber-400 hover:bg-amber-500/10">
            <AlertTriangle className="h-4 w-4" />
            {awaitingApprovalCount} Awaiting Approval
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{mockRuns.length}</div>
            <p className="text-sm text-muted-foreground">Total Runs</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-emerald-400">
              {runsByStatus.completed || 0}
            </div>
            <p className="text-sm text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-blue-400">
              {runsByStatus.running || 0}
            </div>
            <p className="text-sm text-muted-foreground">Running</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-red-400">
              {runsByStatus.failed || 0}
            </div>
            <p className="text-sm text-muted-foreground">Failed</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search runs by ID or agent name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-card"
          />
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px] bg-card">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="awaiting_approval">Awaiting Approval</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="queued">Queued</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as "date" | "status")}>
            <SelectTrigger className="w-[140px] bg-card">
              <ArrowUpDown className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">By Date</SelectItem>
              <SelectItem value="status">By Status</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Runs List */}
      <Card className="bg-card border-border">
        <CardHeader className="border-b border-border">
          <CardTitle className="text-base font-medium">
            {filteredRuns.length} Run{filteredRuns.length !== 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredRuns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-3 mb-4">
                <Play className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="font-medium mb-1">No runs found</h3>
              <p className="text-sm text-muted-foreground">
                {searchQuery || statusFilter !== "all" 
                  ? "Try adjusting your filters"
                  : "Your agent runs will appear here"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredRuns.map((run) => {
                const agent = mockAgents.find(a => a.id === run.agentId)
                return (
                  <Link
                    key={run.id}
                    href={`/app/runs/${run.id}`}
                    className="flex items-center gap-4 p-4 hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-sm text-muted-foreground">
                          {run.id.slice(0, 8)}
                        </span>
                        <RunStatusBadge status={run.status} />
                      </div>
                      <div className="font-medium truncate">
                        {agent?.name || "Unknown Agent"}
                      </div>
                      {run.triggerMessage && (
                        <p className="text-sm text-muted-foreground truncate mt-0.5">
                          {run.triggerMessage}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm text-muted-foreground">
                        {formatDate(run.startedAt)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatDuration(run.durationSeconds)}
                      </div>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
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
