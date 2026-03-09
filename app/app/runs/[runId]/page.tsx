"use client"

import { use, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { 
  ArrowLeft,
  Play, 
  Pause, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle,
  RefreshCw,
  Eye,
  Edit3,
  Trash2,
  Send,
  FileText,
  Calendar,
  Mail,
  ChevronRight,
  Bot
} from "lucide-react"
import { mockRuns, mockAgents } from "@/lib/mock-data"
import { Run, RunStatus, RunStep, StepStatus } from "@/lib/types"

const statusConfig: Record<RunStatus, { icon: React.ReactNode; className: string; label: string }> = {
  queued: {
    icon: <Clock className="h-4 w-4" />,
    className: "bg-muted text-muted-foreground",
    label: "Queued"
  },
  running: {
    icon: <Play className="h-4 w-4" />,
    className: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    label: "Running"
  },
  awaiting_approval: {
    icon: <Pause className="h-4 w-4" />,
    className: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    label: "Awaiting Approval"
  },
  completed: {
    icon: <CheckCircle2 className="h-4 w-4" />,
    className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    label: "Completed"
  },
  failed: {
    icon: <XCircle className="h-4 w-4" />,
    className: "bg-red-500/20 text-red-400 border-red-500/30",
    label: "Failed"
  },
  cancelled: {
    icon: <XCircle className="h-4 w-4" />,
    className: "bg-muted text-muted-foreground",
    label: "Cancelled"
  }
}

const stepStatusConfig: Record<StepStatus, { icon: React.ReactNode; className: string }> = {
  pending: {
    icon: <Clock className="h-4 w-4" />,
    className: "text-muted-foreground bg-muted"
  },
  in_progress: {
    icon: <RefreshCw className="h-4 w-4 animate-spin" />,
    className: "text-blue-400 bg-blue-500/20"
  },
  awaiting_approval: {
    icon: <Pause className="h-4 w-4" />,
    className: "text-amber-400 bg-amber-500/20"
  },
  approved: {
    icon: <CheckCircle2 className="h-4 w-4" />,
    className: "text-emerald-400 bg-emerald-500/20"
  },
  rejected: {
    icon: <XCircle className="h-4 w-4" />,
    className: "text-red-400 bg-red-500/20"
  },
  completed: {
    icon: <CheckCircle2 className="h-4 w-4" />,
    className: "text-emerald-400 bg-emerald-500/20"
  },
  failed: {
    icon: <XCircle className="h-4 w-4" />,
    className: "text-red-400 bg-red-500/20"
  },
  skipped: {
    icon: <ChevronRight className="h-4 w-4" />,
    className: "text-muted-foreground bg-muted"
  }
}

const actionTypeIcons: Record<string, React.ReactNode> = {
  read: <Eye className="h-4 w-4" />,
  draft: <Edit3 className="h-4 w-4" />,
  send: <Send className="h-4 w-4" />,
  delete: <Trash2 className="h-4 w-4" />,
  create: <FileText className="h-4 w-4" />,
  update: <Edit3 className="h-4 w-4" />,
  schedule: <Calendar className="h-4 w-4" />,
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit"
  }).format(date)
}

function formatDuration(seconds?: number): string {
  if (!seconds) return "-"
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}m ${secs}s`
}

function StepCard({ step, isLast }: { step: RunStep; isLast: boolean }) {
  const config = stepStatusConfig[step.status]
  const actionIcon = actionTypeIcons[step.actionType] || <Bot className="h-4 w-4" />
  const needsApproval = step.status === "awaiting_approval"

  return (
    <div className="relative">
      {/* Connection line */}
      {!isLast && (
        <div className="absolute left-5 top-12 bottom-0 w-px bg-border" />
      )}
      
      <div className={`flex gap-4 ${needsApproval ? "animate-pulse" : ""}`}>
        {/* Step indicator */}
        <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${config.className}`}>
          {config.icon}
        </div>

        {/* Step content */}
        <Card className={`flex-1 bg-card border-border ${needsApproval ? "border-amber-500/50" : ""}`}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-muted-foreground">{actionIcon}</span>
                  <span className="font-medium capitalize">{step.actionType}</span>
                  <Badge variant="outline" className="text-xs">
                    {step.targetResource}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  {step.description}
                </p>
                
                {/* Step details */}
                {step.details && (
                  <div className="bg-muted/50 rounded-md p-3 mt-2">
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono">
                      {JSON.stringify(step.details, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Approval actions */}
                {needsApproval && (
                  <div className="flex gap-2 mt-4">
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="outline" className="border-red-500/50 text-red-400 hover:bg-red-500/10">
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Reject this action?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will stop the agent from performing this action. The agent may continue with other steps or terminate the run.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction className="bg-red-600 hover:bg-red-700">
                            Reject Action
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <Button size="sm" variant="ghost">
                      Edit & Approve
                    </Button>
                  </div>
                )}
              </div>

              <div className="text-right text-xs text-muted-foreground shrink-0">
                {step.startedAt && (
                  <div>{formatDateTime(step.startedAt)}</div>
                )}
                {step.durationMs && (
                  <div>{step.durationMs}ms</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function RunDetailPage({ 
  params 
}: { 
  params: Promise<{ runId: string }> 
}) {
  const { runId } = use(params)
  const router = useRouter()
  
  const run = mockRuns.find(r => r.id === runId)
  const agent = run ? mockAgents.find(a => a.id === run.agentId) : null

  if (!run || !agent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Run Not Found</h2>
        <p className="text-muted-foreground mb-4">
          The run you are looking for does not exist.
        </p>
        <Button onClick={() => router.push("/app/runs")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Runs
        </Button>
      </div>
    )
  }

  const statusCfg = statusConfig[run.status]
  const awaitingSteps = run.steps.filter(s => s.status === "awaiting_approval")

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/app/runs")}
              className="gap-1 -ml-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Runs
            </Button>
            <span className="text-muted-foreground">/</span>
            <span className="font-mono text-sm">{run.id.slice(0, 8)}</span>
          </div>
          <h1 className="text-2xl font-semibold">{agent.name}</h1>
          <p className="text-muted-foreground mt-1">
            {run.triggerMessage || "Manual trigger"}
          </p>
        </div>
        <Badge 
          variant="outline" 
          className={`gap-1.5 px-3 py-1.5 text-sm ${statusCfg.className}`}
        >
          {statusCfg.icon}
          {statusCfg.label}
        </Badge>
      </div>

      {/* Approval Banner */}
      {awaitingSteps.length > 0 && (
        <Card className="bg-amber-500/10 border-amber-500/30">
          <CardContent className="flex items-center gap-4 py-4">
            <div className="rounded-full bg-amber-500/20 p-2">
              <Pause className="h-5 w-5 text-amber-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-amber-400">
                Action Requires Your Approval
              </h3>
              <p className="text-sm text-muted-foreground">
                {awaitingSteps.length} step{awaitingSteps.length !== 1 ? "s" : ""} waiting for your review before proceeding.
              </p>
            </div>
            <Button className="bg-amber-600 hover:bg-amber-700">
              Review Actions
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Run Details */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {/* Steps Timeline */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base">Execution Steps</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {run.steps.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No steps recorded yet</p>
                </div>
              ) : (
                run.steps.map((step, idx) => (
                  <StepCard 
                    key={step.id} 
                    step={step} 
                    isLast={idx === run.steps.length - 1}
                  />
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Run Info */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base">Run Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Run ID</div>
                <code className="text-sm font-mono">{run.id}</code>
              </div>
              <Separator />
              <div>
                <div className="text-xs text-muted-foreground mb-1">Agent</div>
                <Link 
                  href={`/agents/${agent.slug}`}
                  className="text-sm hover:underline"
                >
                  {agent.name}
                </Link>
              </div>
              <Separator />
              <div>
                <div className="text-xs text-muted-foreground mb-1">Started</div>
                <div className="text-sm">{formatDateTime(run.startedAt)}</div>
              </div>
              {run.completedAt && (
                <>
                  <Separator />
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Completed</div>
                    <div className="text-sm">{formatDateTime(run.completedAt)}</div>
                  </div>
                </>
              )}
              <Separator />
              <div>
                <div className="text-xs text-muted-foreground mb-1">Duration</div>
                <div className="text-sm">{formatDuration(run.durationSeconds)}</div>
              </div>
              <Separator />
              <div>
                <div className="text-xs text-muted-foreground mb-1">Trigger</div>
                <Badge variant="outline" className="text-xs capitalize">
                  {run.triggerType}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start gap-2">
                <RefreshCw className="h-4 w-4" />
                Re-run Agent
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2 text-red-400 hover:text-red-400 hover:bg-red-500/10">
                <XCircle className="h-4 w-4" />
                Cancel Run
              </Button>
            </CardContent>
          </Card>

          {/* Cost Summary */}
          {run.cost && (
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-base">Cost</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-semibold">
                    ${run.cost.totalUsd.toFixed(4)}
                  </span>
                  <span className="text-muted-foreground">USD</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {run.cost.tokensUsed.toLocaleString()} tokens used
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
