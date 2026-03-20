"use client"

import { use, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { RiskBadge } from '@/components/risk-badge'
import { RunStatusBadge } from '@/components/run-status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { useRunStatus } from '@/hooks/use-run-status'
import { calculateBundleRiskFromAgents } from '@/lib/bundle-risk'
import { canOpenRunControlUi } from '@/lib/run-control-ui'
import { getRunStatusDisplay } from '@/lib/run-status-display'
import { formatDateTime } from '@/lib/utils'
import { createRunControlUiLink, updateRun } from '@/services/runs.api'
import { toast } from 'sonner'
import { AlertTriangle, ArrowLeft, ExternalLink, Package, RefreshCw, XCircle } from 'lucide-react'

interface RunDetailPageProps {
  params: Promise<{ runId: string }>
}

function canResumeRun(run: NonNullable<ReturnType<typeof useRunStatus>['run']>) {
  return Boolean(
    run.preservedStateAvailable &&
      (run.runtimeState === 'stopped' || run.runtimeState === 'archived'),
  )
}

function canStopRun(run: NonNullable<ReturnType<typeof useRunStatus>['run']>) {
  if (!run.usesRealWorkspace || run.status === 'failed') {
    return false
  }
  if (!run.runtimeState) {
    return run.status === 'provisioning' || run.status === 'running'
  }
  return run.runtimeState === 'provisioning' || run.runtimeState === 'running'
}

function canTerminateRun(run: NonNullable<ReturnType<typeof useRunStatus>['run']>) {
  return Boolean(
    run.preservedStateAvailable &&
      run.persistenceMode === 'recoverable' &&
      run.runtimeState === 'stopped',
  )
}

export default function RunDetailPage({ params }: RunDetailPageProps) {
  const { runId } = use(params)
  const router = useRouter()
  const { run, setRun, refetch, isLoading, loadError } = useRunStatus(runId)
  const [isCancelling, setIsCancelling] = useState(false)
  const [isOpeningControlUi, setIsOpeningControlUi] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)
  const [isTerminating, setIsTerminating] = useState(false)

  if (isLoading) {
    return <RunDetailSkeleton />
  }

  if (!run || !run.order) {
    return (
      <div className="space-y-6 p-6 lg:p-8">
        <Link
          href="/app/runs"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Runs
        </Link>
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="flex items-start gap-3 p-6">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
            <div>
              <p className="font-medium text-red-400">Run not found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {loadError ?? 'This run could not be loaded from the mock API.'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isActive = run.status === 'provisioning' || run.status === 'running'
  const canResume = canResumeRun(run)
  const canTerminate = canTerminateRun(run)
  const canOpenControlUi = canOpenRunControlUi(run)
  const canStop = canStopRun(run)
  const timeline = buildTimeline(run)
  const liveBundleRisk = calculateBundleRiskFromAgents(run.agents)

  const handleStop = async () => {
    if (!run || isCancelling) {
      return
    }

    if (!window.confirm('Stop this managed runtime and shut down its sandbox?')) {
      return
    }

    setIsCancelling(true)

    try {
      const payload = await updateRun(run.id, 'cancel', { timeoutMs: 60_000 })
      setRun(payload)
      toast.success('Run stopped')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Network error while cancelling run'
      if (message.toLowerCase().includes('sandbox is not started')) {
        await refetch()
      }
      toast.error(message)
    } finally {
      setIsCancelling(false)
    }
  }

  const handleRefresh = async () => {
    if (isRefreshing) return
    setIsRefreshing(true)
    try {
      const payload = await refetch()
      setRun(payload)
      toast.success(`Status updated: ${getRunStatusDisplay(payload.status, payload.runtimeState).label}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to refresh status')
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleRetry = async () => {
    if (!run || isRetrying) {
      return
    }

    setIsRetrying(true)

    try {
      const payload = await updateRun(run.id, 'retry', { timeoutMs: 60_000 })
      setRun(payload)
      if (payload.id !== run.id) {
        toast.success('Restart started. Redirecting to new run...')
        router.push(`/app/runs/${payload.id}`)
      } else {
        toast.success(canResume ? 'Runtime resume requested' : 'Sandbox restart requested')
      }
    } catch (error) {
      await refetch()
      toast.error(error instanceof Error ? error.message : 'Network error while restarting run')
    } finally {
      setIsRetrying(false)
    }
  }

  const handleTerminate = async () => {
    if (!run || isTerminating) {
      return
    }

    if (!window.confirm('Terminate this stopped Warm Standby runtime and release its preserved state?')) {
      return
    }

    setIsTerminating(true)

    try {
      const payload = await updateRun(run.id, 'terminate', { timeoutMs: 60_000 })
      setRun(payload)
      toast.success('Stopped runtime terminated')
    } catch (error) {
      await refetch()
      toast.error(error instanceof Error ? error.message : 'Unable to terminate run')
    } finally {
      setIsTerminating(false)
    }
  }

  const handleOpenControlUi = async () => {
    if (!run || isOpeningControlUi) {
      return
    }

    const popup = window.open('about:blank', '_blank')

    if (!popup) {
      toast.error('Allow pop-ups to open the Control UI in a new tab.')
      return
    }

    popup.opener = null

    popup.document.title = 'Opening Control UI...'
    popup.document.body.innerHTML =
      '<p style="font-family: system-ui; padding: 24px;">Opening Control UI...</p>'

    setIsOpeningControlUi(true)

    try {
      const link = await createRunControlUiLink(run.id)
      popup.location.replace(link.url)
    } catch (error) {
      popup.close()
      toast.error(error instanceof Error ? error.message : 'Unable to open Control UI')
    } finally {
      setIsOpeningControlUi(false)
    }
  }

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link
            href="/app/runs"
            className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Runs
          </Link>
          <div className="mb-2">
            <h1 className="text-3xl font-bold text-foreground">Run {run.id}</h1>
          </div>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Runtime status</span>
            <RunStatusBadge status={run.status} runtimeState={run.runtimeState} />
          </div>
          <p className="text-muted-foreground">
            Bundle {run.order.id} · {run.agents.length} agent{run.agents.length === 1 ? '' : 's'} · created {formatDateTime(run.createdAt)}
          </p>
          {run.recoverableUntilAt ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Recoverable until {formatDateTime(run.recoverableUntilAt)}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Pull latest status from sandbox"
          >
            {isRefreshing ? (
              <Spinner className="mr-2 h-4 w-4" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh status
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/app/bundles/${run.order.id}`}>
              <Package className="mr-2 h-4 w-4" />
              View Bundle
            </Link>
          </Button>
          {run.usesRealWorkspace && (
            <Button
              variant="outline"
              onClick={handleOpenControlUi}
              disabled={!canOpenControlUi || isOpeningControlUi}
            >
              {isOpeningControlUi ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Opening...
                </>
              ) : (
                <>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open Control UI
                </>
              )}
            </Button>
          )}
          {(run.status === 'failed' || canResume) && (
            <Button variant="outline" onClick={handleRetry} disabled={isRetrying}>
              {isRetrying ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  {canResume ? 'Resuming...' : 'Restarting...'}
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {canResume ? (run.runtimeState === 'archived' ? 'Recover Run' : 'Resume Run') : 'Restart Run'}
                </>
              )}
            </Button>
          )}
          {canTerminate && (
            <Button variant="destructive" onClick={handleTerminate} disabled={isTerminating}>
              {isTerminating ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Terminating...
                </>
              ) : (
                <>
                  <XCircle className="mr-2 h-4 w-4" />
                  Terminate Run
                </>
              )}
            </Button>
          )}
          {canStop && (
            <Button variant="destructive" onClick={handleStop} disabled={isCancelling}>
              {isCancelling ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Stopping...
                </>
              ) : (
                <>
                  <XCircle className="mr-2 h-4 w-4" />
                  Stop Run
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {isActive && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div>
              <p className="font-medium text-amber-400">Run is still in progress</p>
              <p className="mt-1 text-sm text-muted-foreground">
                This workspace is managed for you. Status will continue updating until the run completes.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Execution Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {timeline.map((entry, index) => (
                <TimelineRow
                  key={entry.label}
                  label={entry.label}
                  value={entry.value}
                  tone={entry.tone}
                  isLast={index === timeline.length - 1}
                />
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Run Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <InfoRow label="Run ID" value={run.id} monospace />
              <Separator />
              <InfoRow label="Bundle ID" value={run.order.id} monospace />
              <Separator />
              <div>
                <div className="mb-2 text-xs text-muted-foreground">Agents in bundle</div>
                <div className="flex flex-wrap gap-2">
                  {run.agents.map((agent) => (
                    <Badge key={agent.id} variant="secondary">
                      {agent.title}
                    </Badge>
                  ))}
                </div>
              </div>
              <Separator />
              <div>
                <div className="mb-2 text-xs text-muted-foreground">Combined risk</div>
                <RiskBadge level={liveBundleRisk.level} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function InfoRow({
  label,
  monospace,
  value,
}: {
  label: string
  monospace?: boolean
  value: string
}) {
  return (
    <div>
      <div className="mb-1 text-xs text-muted-foreground">{label}</div>
      <div className={monospace ? 'font-mono text-sm' : 'text-sm'}>{value}</div>
    </div>
  )
}

function TimelineRow({
  isLast,
  label,
  tone,
  value,
}: {
  isLast?: boolean
  label: string
  tone: 'active' | 'complete' | 'pending' | 'failed'
  value: string
}) {
  const toneClassName = {
    active: {
      dot: 'bg-amber-400 shadow-[0_0_0_4px_rgba(251,191,36,0.18)]',
      line: 'bg-amber-400/30',
      label: 'text-amber-300',
      value: 'text-foreground',
    },
    complete: {
      dot: 'bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.16)]',
      line: 'bg-emerald-400/25',
      label: 'text-foreground',
      value: 'text-foreground',
    },
    pending: {
      dot: 'bg-muted-foreground/40',
      line: 'bg-border',
      label: 'text-muted-foreground',
      value: 'text-muted-foreground',
    },
    failed: {
      dot: 'bg-red-400 shadow-[0_0_0_4px_rgba(248,113,113,0.18)]',
      line: 'bg-red-400/25',
      label: 'text-red-300',
      value: 'text-foreground',
    },
  }[tone]

  return (
    <div className="relative flex gap-4">
      <div className="flex flex-col items-center">
        <div className={`mt-1 h-2.5 w-2.5 rounded-full ${toneClassName.dot}`} />
        {!isLast && <div className={`mt-2 h-full w-px ${toneClassName.line}`} />}
      </div>
      <div className="pb-4">
        <div className={`text-sm font-medium ${toneClassName.label}`}>{label}</div>
        <div className={`text-sm ${toneClassName.value}`}>{value}</div>
      </div>
    </div>
  )
}

function buildTimeline(run: NonNullable<ReturnType<typeof useRunStatus>['run']>) {
  const terminalStatusLabel = getRunStatusDisplay(run.status, run.runtimeState).label
  const startedTone: 'active' | 'complete' | 'pending' | 'failed' = run.startedAt
    ? 'complete'
    : run.status === 'failed'
      ? 'failed'
      : run.status === 'completed'
        ? 'pending'
        : 'active'
  const updatedTone: 'active' | 'complete' | 'pending' | 'failed' =
    run.status === 'failed' ? 'failed' : run.status === 'completed' ? 'complete' : 'active'
  const completedTone: 'active' | 'complete' | 'pending' | 'failed' = run.completedAt
    ? run.status === 'failed'
      ? 'failed'
      : 'complete'
    : run.status === 'failed'
      ? 'failed'
      : 'pending'

  return [
    {
      label: 'Created',
      tone: 'complete' as const,
      value: formatDateTime(run.createdAt),
    },
    {
      label: 'Started',
      tone: startedTone,
      value: run.startedAt ? formatDateTime(run.startedAt) : 'Queued for managed runtime start',
    },
    {
      label: 'Last Updated',
      tone: updatedTone,
      value: formatDateTime(run.updatedAt),
    },
    {
      label: terminalStatusLabel,
      tone: completedTone,
      value: run.completedAt
        ? formatDateTime(run.completedAt)
        : run.status === 'failed'
          ? 'Run exited before completion'
          : 'Still running',
    },
  ]
}

function RunDetailSkeleton() {
  return (
    <div className="space-y-6 p-6 lg:p-8">
      <Skeleton className="h-5 w-28" />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <Skeleton className="h-20 w-full" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_360px]">
        <div className="space-y-6">
          <Skeleton className="h-56 w-full" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    </div>
  )
}
