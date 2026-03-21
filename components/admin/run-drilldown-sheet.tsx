'use client'

import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type { AdminRunRecord } from '@/lib/admin-runs-data'
import { formatDateTime } from '@/lib/utils'

import { Panel, SignalPill, formatMetricValue, formatMinutes } from './usage-primitives'

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

export function RunDrilldownSheet({
  onOpenChange,
  open,
  run,
}: {
  onOpenChange: (open: boolean) => void
  open: boolean
  run: AdminRunRecord | null
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-full overflow-hidden border-white/10 bg-[#09090b] p-0 text-white sm:max-w-[42rem]"
        side="right"
      >
        {run ? (
          <>
            <SheetHeader className="border-b border-white/8 bg-[linear-gradient(180deg,rgba(34,197,94,0.08),rgba(9,9,11,0.98))] px-6 py-6 text-left">
              <div className="flex items-start justify-between gap-3 pr-8">
                <div>
                  <p className="text-[11px] tracking-[0.24em] uppercase text-emerald-100/70">Run Drilldown</p>
                  <SheetTitle className="mt-2 text-2xl">{run.id}</SheetTitle>
                  <SheetDescription className="mt-1 text-sm text-zinc-400">
                    {run.userName} · {run.orderId}
                  </SheetDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <SignalPill tone={statusTone[run.status]}>{run.status}</SignalPill>
                  {run.runtimeState ? <SignalPill tone={runtimeTone[run.runtimeState]}>{run.runtimeState}</SignalPill> : null}
                </div>
              </div>
            </SheetHeader>

            <div className="h-full overflow-y-auto px-6 pb-8">
              <div className="grid gap-3 py-5 sm:grid-cols-4">
                <SummaryStat label="Plan" value={run.planId.replaceAll('_', ' ')} />
                <SummaryStat label="Workspace" value={run.workspaceMinutes != null ? formatMinutes(run.workspaceMinutes) : 'n/a'} />
                <SummaryStat label="Cost" value={formatMetricValue(run.estimatedInternalCostCents ?? 0, 'currency')} />
                <SummaryStat label="Intervals" value={run.intervalCount.toString()} />
              </div>

              <div className="space-y-5">
                <Panel className="p-5">
                  <BlockTitle eyebrow="Identity" title="Run, user, order, and provider refs" />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <KeyValue label="run_id" value={run.id} />
                    <KeyValue label="order_id" value={run.orderId} />
                    <KeyValue label="user_id" value={run.userId} />
                    <KeyValue label="user_email" value={run.userEmail} />
                    <KeyValue label="channel_config_id" value={run.channelConfigId} />
                    <KeyValue label="provider_instance_ref" value={run.providerInstanceRef ?? 'n/a'} />
                    <KeyValue label="provider_name" value={run.providerName ?? 'n/a'} />
                    <KeyValue label="order_status" value={run.orderStatus} />
                  </div>
                </Panel>

                <Panel className="p-5">
                  <BlockTitle eyebrow="Lifecycle" title="Product status + runtime status" />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <KeyValue label="status" value={run.status} />
                    <KeyValue label="runtime_state" value={run.runtimeState ?? 'n/a'} />
                    <KeyValue label="plan_id" value={run.planId} />
                    <KeyValue label="plan_version" value={run.planVersion ?? 'n/a'} />
                    <KeyValue label="trigger_mode" value={run.triggerModeSnapshot ?? 'n/a'} />
                    <KeyValue label="billing_interval" value={run.billingInterval ?? 'n/a'} />
                    <KeyValue label="runtime_mode" value={run.runtimeMode ?? 'n/a'} />
                    <KeyValue label="persistence_mode" value={run.persistenceMode ?? 'n/a'} />
                    <KeyValue label="preserved_state_available" value={run.preservedStateAvailable ? 'true' : 'false'} />
                    <KeyValue label="recoverable_until" value={formatDateTimeOrFallback(run.recoverableUntilAt)} />
                    <KeyValue label="termination_reason" value={run.terminationReason ?? 'active'} />
                    <KeyValue label="runtime_stop_reason" value={run.runtimeStopReason ?? 'n/a'} />
                  </div>
                </Panel>

                <Panel className="p-5">
                  <BlockTitle eyebrow="Activity" title="Timing, activity clocks, and intervals" />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <KeyValue label="created_at" value={formatDateTimeOrFallback(run.createdAt)} />
                    <KeyValue label="updated_at" value={formatDateTimeOrFallback(run.updatedAt)} />
                    <KeyValue label="paid_at" value={formatDateTimeOrFallback(run.paidAt)} />
                    <KeyValue label="started_at" value={formatDateTimeOrFallback(run.startedAt)} />
                    <KeyValue label="provider_accepted_at" value={formatDateTimeOrFallback(run.providerAcceptedAt)} />
                    <KeyValue label="running_started_at" value={formatDateTimeOrFallback(run.runningStartedAt)} />
                    <KeyValue label="completed_at" value={formatDateTimeOrFallback(run.completedAt)} />
                    <KeyValue label="workspace_released_at" value={formatDateTimeOrFallback(run.workspaceReleasedAt)} />
                    <KeyValue label="last_meaningful_activity_at" value={formatDateTimeOrFallback(run.lastMeaningfulActivityAt)} />
                    <KeyValue label="last_openclaw_session_activity_at" value={formatDateTimeOrFallback(run.lastOpenClawSessionActivityAt)} />
                    <KeyValue label="last_openclaw_session_probe_at" value={formatDateTimeOrFallback(run.lastOpenClawSessionProbeAt)} />
                    <KeyValue label="openclaw_session_count" value={run.openClawSessionCount != null ? String(run.openClawSessionCount) : 'n/a'} />
                    <KeyValue label="active_interval_started_at" value={formatDateTimeOrFallback(run.activeIntervalStartedAt)} />
                    <KeyValue label="latest_interval_started_at" value={formatDateTimeOrFallback(run.latestIntervalStartedAt)} />
                    <KeyValue label="latest_interval_ended_at" value={formatDateTimeOrFallback(run.latestIntervalEndedAt)} />
                    <KeyValue label="latest_interval_close_reason" value={run.latestIntervalCloseReason ?? 'n/a'} />
                  </div>
                </Panel>

                <Panel className="p-5">
                  <BlockTitle eyebrow="Runtime Payload" title="Operational context" />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <KeyValue label="agent_count" value={run.agentCount != null ? String(run.agentCount) : 'n/a'} />
                    <KeyValue label="uses_real_workspace" value={run.usesRealWorkspace ? 'true' : 'false'} />
                    <KeyValue label="uses_tools" value={run.usesTools ? 'true' : 'false'} />
                    <KeyValue label="network_enabled" value={run.networkEnabled ? 'true' : 'false'} />
                    <KeyValue label="workspace_minutes" value={run.workspaceMinutes != null ? formatMinutes(run.workspaceMinutes) : 'n/a'} />
                    <KeyValue label="tool_calls_count" value={run.toolCallsCount != null ? String(run.toolCallsCount) : 'n/a'} />
                    <KeyValue label="input_tokens_est" value={run.inputTokensEst != null ? run.inputTokensEst.toLocaleString('en-US') : 'n/a'} />
                    <KeyValue label="output_tokens_est" value={run.outputTokensEst != null ? run.outputTokensEst.toLocaleString('en-US') : 'n/a'} />
                    <KeyValue label="estimated_internal_cost" value={formatMetricValue(run.estimatedInternalCostCents ?? 0, 'currency')} />
                    <KeyValue label="result_summary" value={run.resultSummary ?? 'n/a'} />
                  </div>
                </Panel>

                <Panel className="p-5">
                  <BlockTitle eyebrow="Channel + TTL" title="Telegram readiness and policy snapshot" />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <KeyValue label="token_status" value={run.tokenStatus} />
                    <KeyValue label="pairing_status" value={run.pairingStatus} />
                    <KeyValue label="recipient_external_id" value={run.recipientExternalId ?? 'n/a'} />
                    <KeyValue label="max_session_ttl_minutes" value={nullableNumber(run.maxSessionTtlMinutes)} />
                    <KeyValue label="idle_timeout_minutes" value={nullableNumber(run.idleTimeoutMinutes)} />
                    <KeyValue label="cleanup_grace_minutes" value={nullableNumber(run.cleanupGraceMinutes)} />
                    <KeyValue label="provisioning_timeout_minutes" value={nullableNumber(run.provisioningTimeoutMinutes)} />
                    <KeyValue label="openclaw_idle_timeout_minutes" value={nullableNumber(run.openClawIdleTimeoutMinutes)} />
                    <KeyValue label="heartbeat_missing_minutes" value={nullableNumber(run.heartbeatMissingMinutes)} />
                    <KeyValue label="unhealthy_provider_timeout_minutes" value={nullableNumber(run.unhealthyProviderTimeoutMinutes)} />
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

function BlockTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-4">
      <p className="text-[11px] tracking-[0.2em] uppercase text-zinc-500">{eyebrow}</p>
      <h3 className="mt-2 text-lg font-semibold text-white">{title}</h3>
    </div>
  )
}

function formatDateTimeOrFallback(value: string | null) {
  return value ? formatDateTime(value) : 'n/a'
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] tracking-[0.2em] uppercase text-zinc-500">{label}</p>
      <p className="mt-2 text-sm text-zinc-200">{value}</p>
    </div>
  )
}

function nullableNumber(value: number | null) {
  return value != null ? String(value) : 'n/a'
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/15 p-4">
      <p className="text-[11px] tracking-[0.2em] uppercase text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      <Separator className="mt-3 bg-transparent" />
    </div>
  )
}
