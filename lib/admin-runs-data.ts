import type {
  BillingInterval,
  PersistenceMode,
  RunStatus,
  RuntimeInstanceState,
  RuntimeMode,
  SubscriptionPlanId,
  TriggerMode,
} from './types'

export type AdminRunRecord = {
  id: string
  userId: string
  userName: string
  userEmail: string
  orderId: string
  orderStatus: 'pending' | 'paid' | 'failed' | 'refunded' | 'unknown'
  paidAt: string | null
  channelConfigId: string
  planId: SubscriptionPlanId
  planVersion: string | null
  billingInterval: BillingInterval | null
  status: RunStatus
  runtimeState: RuntimeInstanceState | null
  runtimeMode: RuntimeMode | null
  persistenceMode: PersistenceMode | null
  preservedStateAvailable: boolean
  recoverableUntilAt: string | null
  runtimeStopReason: string | null
  providerName: string | null
  providerInstanceRef: string | null
  triggerModeSnapshot: TriggerMode | null
  tokenStatus: 'pending' | 'validated' | 'failed' | 'unknown'
  pairingStatus: 'pending' | 'paired' | 'failed' | 'unknown'
  recipientExternalId: string | null
  agentCount: number | null
  usesRealWorkspace: boolean
  usesTools: boolean
  networkEnabled: boolean
  createdAt: string
  startedAt: string | null
  providerAcceptedAt: string | null
  runningStartedAt: string | null
  lastMeaningfulActivityAt: string | null
  lastOpenClawSessionActivityAt: string | null
  lastOpenClawSessionProbeAt: string | null
  openClawSessionCount: number | null
  completedAt: string | null
  workspaceReleasedAt: string | null
  updatedAt: string
  runtimeUpdatedAt: string | null
  terminationReason: string | null
  workspaceMinutes: number | null
  toolCallsCount: number | null
  inputTokensEst: number | null
  outputTokensEst: number | null
  estimatedInternalCostCents: number | null
  latestIntervalStartedAt: string | null
  latestIntervalEndedAt: string | null
  latestIntervalCloseReason: string | null
  activeIntervalStartedAt: string | null
  intervalCount: number
  maxSessionTtlMinutes: number | null
  idleTimeoutMinutes: number | null
  cleanupGraceMinutes: number | null
  provisioningTimeoutMinutes: number | null
  openClawIdleTimeoutMinutes: number | null
  heartbeatMissingMinutes: number | null
  unhealthyProviderTimeoutMinutes: number | null
  resultSummary: string | null
}

export type AdminRunsPage = {
  implementationNote: string
  page: number
  pageSize: number
  query: string
  rows: AdminRunRecord[]
  totalPages: number
  totalRuns: number
}

export const adminRunsPage: AdminRunsPage = {
  implementationNote:
    'Runs tab sample data mirrors the paginated admin read model until a live PostgreSQL dataset is available.',
  page: 1,
  pageSize: 20,
  query: '',
  totalPages: 1,
  totalRuns: 4,
  rows: [
    {
      activeIntervalStartedAt: '2026-03-21T13:52:00-04:00',
      agentCount: 3,
      billingInterval: 'month',
      channelConfigId: 'channel-4418',
      cleanupGraceMinutes: 10,
      completedAt: null,
      createdAt: '2026-03-21T13:50:00-04:00',
      estimatedInternalCostCents: 0,
      heartbeatMissingMinutes: null,
      id: 'run-4418',
      idleTimeoutMinutes: 45,
      inputTokensEst: 18400,
      intervalCount: 4,
      lastMeaningfulActivityAt: '2026-03-21T14:12:00-04:00',
      lastOpenClawSessionActivityAt: '2026-03-21T14:11:32-04:00',
      lastOpenClawSessionProbeAt: '2026-03-21T14:12:00-04:00',
      latestIntervalCloseReason: null,
      latestIntervalEndedAt: null,
      latestIntervalStartedAt: '2026-03-21T13:52:00-04:00',
      maxSessionTtlMinutes: 360,
      networkEnabled: true,
      openClawIdleTimeoutMinutes: 20,
      openClawSessionCount: 1,
      orderId: 'order-1188',
      orderStatus: 'paid',
      outputTokensEst: 6200,
      paidAt: '2026-03-21T13:45:00-04:00',
      pairingStatus: 'paired',
      persistenceMode: 'recoverable',
      planId: 'warm_standby',
      planVersion: 'v1',
      preservedStateAvailable: true,
      providerAcceptedAt: '2026-03-21T13:51:00-04:00',
      providerInstanceRef: 'run-4418',
      providerName: 'daytona',
      provisioningTimeoutMinutes: 15,
      recipientExternalId: '77',
      recoverableUntilAt: '2026-03-28T13:52:00-04:00',
      resultSummary: 'OpenClaw ready. Telegram long polling active.',
      runningStartedAt: '2026-03-21T13:52:00-04:00',
      runtimeMode: 'wakeable_recoverable',
      runtimeState: 'running',
      runtimeStopReason: null,
      runtimeUpdatedAt: '2026-03-21T14:12:00-04:00',
      startedAt: '2026-03-21T13:52:00-04:00',
      status: 'running',
      terminationReason: null,
      tokenStatus: 'validated',
      toolCallsCount: 48,
      triggerModeSnapshot: 'auto_wake',
      unhealthyProviderTimeoutMinutes: null,
      updatedAt: '2026-03-21T14:12:00-04:00',
      userEmail: 'ava@ops.internal',
      userId: 'user-1',
      userName: 'Ava Morgan',
      usesRealWorkspace: true,
      usesTools: true,
      workspaceMinutes: 98,
      workspaceReleasedAt: null,
    },
    {
      activeIntervalStartedAt: null,
      agentCount: 2,
      billingInterval: 'none',
      channelConfigId: 'channel-4415',
      cleanupGraceMinutes: 5,
      completedAt: '2026-03-21T11:28:00-04:00',
      createdAt: '2026-03-21T11:03:00-04:00',
      estimatedInternalCostCents: 2140,
      heartbeatMissingMinutes: null,
      id: 'run-4415',
      idleTimeoutMinutes: 20,
      inputTokensEst: 8400,
      intervalCount: 1,
      lastMeaningfulActivityAt: '2026-03-21T11:24:00-04:00',
      lastOpenClawSessionActivityAt: '2026-03-21T11:23:42-04:00',
      lastOpenClawSessionProbeAt: '2026-03-21T11:24:00-04:00',
      latestIntervalCloseReason: 'completed',
      latestIntervalEndedAt: '2026-03-21T11:28:00-04:00',
      latestIntervalStartedAt: '2026-03-21T11:04:00-04:00',
      maxSessionTtlMinutes: 120,
      networkEnabled: true,
      openClawIdleTimeoutMinutes: 10,
      openClawSessionCount: 0,
      orderId: 'order-1042',
      orderStatus: 'paid',
      outputTokensEst: 3100,
      paidAt: '2026-03-21T10:58:00-04:00',
      pairingStatus: 'paired',
      persistenceMode: 'ephemeral',
      planId: 'run',
      planVersion: 'v1',
      preservedStateAvailable: false,
      providerAcceptedAt: '2026-03-21T11:04:00-04:00',
      providerInstanceRef: 'run-4415',
      providerName: 'daytona',
      provisioningTimeoutMinutes: 15,
      recipientExternalId: '44',
      recoverableUntilAt: null,
      resultSummary: 'Agent completed triage and saved result artifacts.',
      runningStartedAt: '2026-03-21T11:04:00-04:00',
      runtimeMode: 'temporary_execution',
      runtimeState: 'deleted',
      runtimeStopReason: 'deleted_after_stop',
      runtimeUpdatedAt: '2026-03-21T11:29:00-04:00',
      startedAt: '2026-03-21T11:04:00-04:00',
      status: 'completed',
      terminationReason: 'completed',
      tokenStatus: 'validated',
      toolCallsCount: 19,
      triggerModeSnapshot: 'manual',
      unhealthyProviderTimeoutMinutes: null,
      updatedAt: '2026-03-21T11:29:00-04:00',
      userEmail: 'mina@ops.internal',
      userId: 'user-3',
      userName: 'Mina Patel',
      usesRealWorkspace: true,
      usesTools: true,
      workspaceMinutes: 21,
      workspaceReleasedAt: '2026-03-21T11:28:00-04:00',
    },
    {
      activeIntervalStartedAt: null,
      agentCount: 4,
      billingInterval: 'month',
      channelConfigId: 'channel-4412',
      cleanupGraceMinutes: 10,
      completedAt: '2026-03-21T09:42:00-04:00',
      createdAt: '2026-03-21T09:40:00-04:00',
      estimatedInternalCostCents: 0,
      heartbeatMissingMinutes: null,
      id: 'run-4412',
      idleTimeoutMinutes: 45,
      inputTokensEst: null,
      intervalCount: 0,
      lastMeaningfulActivityAt: null,
      lastOpenClawSessionActivityAt: null,
      lastOpenClawSessionProbeAt: null,
      latestIntervalCloseReason: null,
      latestIntervalEndedAt: null,
      latestIntervalStartedAt: null,
      maxSessionTtlMinutes: 360,
      networkEnabled: true,
      openClawIdleTimeoutMinutes: 20,
      openClawSessionCount: null,
      orderId: 'order-1071',
      orderStatus: 'paid',
      outputTokensEst: null,
      paidAt: '2026-03-21T09:35:00-04:00',
      pairingStatus: 'pending',
      persistenceMode: 'recoverable',
      planId: 'warm_standby',
      planVersion: 'v1',
      preservedStateAvailable: false,
      providerAcceptedAt: null,
      providerInstanceRef: null,
      providerName: 'daytona',
      provisioningTimeoutMinutes: 15,
      recipientExternalId: null,
      recoverableUntilAt: null,
      resultSummary: 'Provider never accepted launch.',
      runningStartedAt: null,
      runtimeMode: 'wakeable_recoverable',
      runtimeState: 'failed',
      runtimeStopReason: 'provider_rejected',
      runtimeUpdatedAt: '2026-03-21T09:42:00-04:00',
      startedAt: null,
      status: 'failed',
      terminationReason: 'telegram_not_ready',
      tokenStatus: 'failed',
      toolCallsCount: null,
      triggerModeSnapshot: 'auto_wake',
      unhealthyProviderTimeoutMinutes: null,
      updatedAt: '2026-03-21T09:42:00-04:00',
      userEmail: 'noah@ops.internal',
      userId: 'user-2',
      userName: 'Noah Kim',
      usesRealWorkspace: true,
      usesTools: true,
      workspaceMinutes: null,
      workspaceReleasedAt: null,
    },
    {
      activeIntervalStartedAt: null,
      agentCount: 5,
      billingInterval: 'month',
      channelConfigId: 'channel-4398',
      cleanupGraceMinutes: null,
      completedAt: '2026-03-20T14:08:00-04:00',
      createdAt: '2026-03-20T09:21:00-04:00',
      estimatedInternalCostCents: 18320,
      heartbeatMissingMinutes: 15,
      id: 'run-4398',
      idleTimeoutMinutes: null,
      inputTokensEst: 84200,
      intervalCount: 1,
      lastMeaningfulActivityAt: '2026-03-20T13:52:00-04:00',
      lastOpenClawSessionActivityAt: '2026-03-20T13:50:00-04:00',
      lastOpenClawSessionProbeAt: '2026-03-20T13:52:00-04:00',
      latestIntervalCloseReason: 'manual_stop',
      latestIntervalEndedAt: '2026-03-20T14:08:00-04:00',
      latestIntervalStartedAt: '2026-03-20T09:22:00-04:00',
      maxSessionTtlMinutes: null,
      networkEnabled: true,
      openClawIdleTimeoutMinutes: null,
      openClawSessionCount: 0,
      orderId: 'order-1092',
      orderStatus: 'paid',
      outputTokensEst: 24800,
      paidAt: '2026-03-20T09:10:00-04:00',
      pairingStatus: 'paired',
      persistenceMode: 'live',
      planId: 'always_on',
      planVersion: 'v1',
      preservedStateAvailable: true,
      providerAcceptedAt: '2026-03-20T09:22:00-04:00',
      providerInstanceRef: 'run-4398',
      providerName: 'daytona',
      provisioningTimeoutMinutes: 15,
      recipientExternalId: '91',
      recoverableUntilAt: null,
      resultSummary: 'Always-on workspace stopped manually after analytics batch.',
      runningStartedAt: '2026-03-20T09:22:00-04:00',
      runtimeMode: 'persistent_live_workspace',
      runtimeState: 'stopped',
      runtimeStopReason: 'manual_stop',
      runtimeUpdatedAt: '2026-03-20T14:08:00-04:00',
      startedAt: '2026-03-20T09:22:00-04:00',
      status: 'completed',
      terminationReason: 'manual_stop',
      tokenStatus: 'validated',
      toolCallsCount: 176,
      triggerModeSnapshot: 'always_active',
      unhealthyProviderTimeoutMinutes: 10,
      updatedAt: '2026-03-20T14:08:00-04:00',
      userEmail: 'ava@ops.internal',
      userId: 'user-1',
      userName: 'Ava Morgan',
      usesRealWorkspace: true,
      usesTools: true,
      workspaceMinutes: 286,
      workspaceReleasedAt: null,
    },
  ],
}
