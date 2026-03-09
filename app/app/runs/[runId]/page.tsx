import Link from 'next/link'
import { notFound } from 'next/navigation'
import { RiskBadge } from '@/components/risk-badge'
import { RunLogsPanel } from '@/components/run-logs-panel'
import { RunResultsPanel } from '@/components/run-results-panel'
import { RunStatusBadge } from '@/components/run-status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { getOrderById, getRunAgents, getRunById, getRunLogs } from '@/lib/mock-selectors'
import { formatDateTime } from '@/lib/utils'
import { AlertTriangle, ArrowLeft, CheckCircle2, Globe, Package, Wrench, XCircle } from 'lucide-react'

interface RunDetailPageProps {
  params: Promise<{ runId: string }>
}

export default async function RunDetailPage({ params }: RunDetailPageProps) {
  const { runId } = await params
  const run = getRunById(runId)

  if (!run) {
    notFound()
  }

  const order = getOrderById(run.orderId)

  if (!order) {
    notFound()
  }

  const agents = getRunAgents(run)
  const logs = getRunLogs(run.id)
  const isActive = run.status === 'provisioning' || run.status === 'running'

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
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold text-foreground">Run {run.id}</h1>
            <RunStatusBadge status={run.status} />
          </div>
          <p className="text-muted-foreground">
            Bundle {order.id} · {agents.length} agent{agents.length === 1 ? '' : 's'} · created {formatDateTime(run.createdAt)}
          </p>
        </div>

        <Button variant="outline" asChild>
          <Link href={`/app/bundles/${order.id}`}>
            <Package className="mr-2 h-4 w-4" />
            View Bundle
          </Link>
        </Button>
      </div>

      {isActive && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div>
              <p className="font-medium text-amber-400">Run is still in progress</p>
              <p className="mt-1 text-sm text-muted-foreground">
                This workspace is managed for you. Logs and results will continue updating until the run completes.
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
              <TimelineRow label="Created" value={formatDateTime(run.createdAt)} />
              <TimelineRow
                label="Started"
                value={run.startedAt ? formatDateTime(run.startedAt) : 'Waiting for workspace start'}
              />
              <TimelineRow label="Last Updated" value={formatDateTime(run.updatedAt)} />
              <TimelineRow
                label="Completed"
                value={run.completedAt ? formatDateTime(run.completedAt) : 'Still running'}
                isLast
              />
            </CardContent>
          </Card>

          <RunLogsPanel logs={logs} />
          <RunResultsPanel summary={run.resultSummary} artifacts={run.resultArtifacts} />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Run Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <InfoRow label="Run ID" value={run.id} monospace />
              <Separator />
              <InfoRow label="Bundle ID" value={order.id} monospace />
              <Separator />
              <div>
                <div className="mb-2 text-xs text-muted-foreground">Agents in bundle</div>
                <div className="flex flex-wrap gap-2">
                  {agents.map((agent) => (
                    <Badge key={agent.id} variant="secondary">
                      {agent.title}
                    </Badge>
                  ))}
                </div>
              </div>
              <Separator />
              <div>
                <div className="mb-2 text-xs text-muted-foreground">Combined risk</div>
                <RiskBadge level={run.combinedRiskLevel} />
              </div>
              <Separator />
              <div>
                <div className="mb-2 text-xs text-muted-foreground">Runtime disclosure</div>
                <div className="space-y-3">
                  <CapabilityRow
                    active={run.usesRealWorkspace}
                    icon={<Package className="h-4 w-4" />}
                    label="Uses managed workspace"
                  />
                  <CapabilityRow
                    active={run.usesTools}
                    icon={<Wrench className="h-4 w-4" />}
                    label="Uses tools during execution"
                  />
                  <CapabilityRow
                    active={run.networkEnabled}
                    icon={<Globe className="h-4 w-4" />}
                    label="Network access enabled"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Outcome</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <InfoRow label="Logs captured" value={logs.length.toString()} />
              <Separator />
              <InfoRow label="Artifacts" value={run.resultArtifacts.length.toString()} />
              <Separator />
              <InfoRow label="Channel config" value={run.channelConfigId} monospace />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function CapabilityRow({
  active,
  icon,
  label,
}: {
  active: boolean
  icon: React.ReactNode
  label: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/40 p-3">
      <div className="flex items-center gap-3">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-sm">{label}</span>
      </div>
      <span className={active ? 'text-emerald-400' : 'text-muted-foreground'}>
        {active ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
      </span>
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
  value,
}: {
  isLast?: boolean
  label: string
  value: string
}) {
  return (
    <div className="relative flex gap-4">
      <div className="flex flex-col items-center">
        <div className="mt-1 h-2.5 w-2.5 rounded-full bg-foreground/70" />
        {!isLast && <div className="mt-2 h-full w-px bg-border" />}
      </div>
      <div className="pb-4">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-sm text-muted-foreground">{value}</div>
      </div>
    </div>
  )
}
