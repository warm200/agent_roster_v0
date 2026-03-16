import type {
  CreditLedgerUnitType,
  PersistenceMode,
  RuntimeMode,
  RunTerminationReason,
  SubscriptionPlan,
  SubscriptionPlanId,
  TriggerMode,
} from '@/lib/types'

export const RUNTIME_PLAN_VERSION = 'v1'

export type TtlPolicySnapshot = {
  cleanupGraceMinutes: number | null
  heartbeatMissingMinutes: number | null
  idleTimeoutMinutes: number | null
  maxSessionTtlMinutes: number | null
  provisioningTimeoutMinutes: number
  triggerMode: TriggerMode
  unhealthyProviderTimeoutMinutes: number | null
}

export type RuntimeLifecyclePolicy = {
  autoArchiveMinutes: number | null
  autoDeleteMinutes: number | null
  autoStopMinutes: number | null
  persistenceMode: PersistenceMode
  preserveStateOnStop: boolean
  runtimeMode: RuntimeMode
}

function readPositiveIntEnv(name: string, fallback: number | null) {
  const raw = process.env[name]
  if (!raw) {
    return fallback
  }
  const value = Number.parseInt(raw, 10)
  if (!Number.isFinite(value) || value < 0) {
    return fallback
  }
  return value
}

export function getTtlPolicySnapshot(plan: SubscriptionPlan): TtlPolicySnapshot {
  switch (plan.id) {
    case 'run':
      return {
        cleanupGraceMinutes: readPositiveIntEnv('RUN_CLEANUP_GRACE_MINUTES', 5),
        heartbeatMissingMinutes: null,
        idleTimeoutMinutes: readPositiveIntEnv('RUN_IDLE_TIMEOUT_MINUTES', 20),
        maxSessionTtlMinutes: readPositiveIntEnv('RUN_MAX_SESSION_TTL_MINUTES', 120),
        provisioningTimeoutMinutes: readPositiveIntEnv('RUNTIME_PROVISIONING_TIMEOUT_MINUTES', 15) ?? 15,
        triggerMode: plan.triggerMode,
        unhealthyProviderTimeoutMinutes: null,
      }
    case 'warm_standby':
      return {
        cleanupGraceMinutes: readPositiveIntEnv('WARM_STANDBY_CLEANUP_GRACE_MINUTES', 10),
        heartbeatMissingMinutes: null,
        idleTimeoutMinutes: readPositiveIntEnv('WARM_STANDBY_IDLE_TIMEOUT_MINUTES', 45),
        maxSessionTtlMinutes: readPositiveIntEnv('WARM_STANDBY_MAX_SESSION_TTL_MINUTES', 360),
        provisioningTimeoutMinutes: readPositiveIntEnv('RUNTIME_PROVISIONING_TIMEOUT_MINUTES', 15) ?? 15,
        triggerMode: plan.triggerMode,
        unhealthyProviderTimeoutMinutes: null,
      }
    case 'always_on':
      return {
        cleanupGraceMinutes: null,
        heartbeatMissingMinutes: readPositiveIntEnv('ALWAYS_ON_HEARTBEAT_MISSING_MINUTES', 15),
        idleTimeoutMinutes: null,
        maxSessionTtlMinutes: null,
        provisioningTimeoutMinutes: readPositiveIntEnv('RUNTIME_PROVISIONING_TIMEOUT_MINUTES', 15) ?? 15,
        triggerMode: plan.triggerMode,
        unhealthyProviderTimeoutMinutes: readPositiveIntEnv('ALWAYS_ON_UNHEALTHY_PROVIDER_TIMEOUT_MINUTES', 10),
      }
    default:
      return {
        cleanupGraceMinutes: null,
        heartbeatMissingMinutes: null,
        idleTimeoutMinutes: null,
        maxSessionTtlMinutes: null,
        provisioningTimeoutMinutes: readPositiveIntEnv('RUNTIME_PROVISIONING_TIMEOUT_MINUTES', 15) ?? 15,
        triggerMode: plan.triggerMode,
        unhealthyProviderTimeoutMinutes: null,
      }
  }
}

export function getRuntimeLifecyclePolicy(plan: SubscriptionPlan): RuntimeLifecyclePolicy {
  switch (plan.id) {
    case 'run':
      return {
        autoArchiveMinutes: readPositiveIntEnv('RUN_AUTO_ARCHIVE_MINUTES', null),
        autoDeleteMinutes: readPositiveIntEnv('RUN_AUTO_DELETE_MINUTES', 0),
        autoStopMinutes: readPositiveIntEnv('RUN_AUTO_STOP_MINUTES', 20),
        persistenceMode: 'ephemeral',
        preserveStateOnStop: false,
        runtimeMode: 'temporary_execution',
      }
    case 'warm_standby':
      return {
        autoArchiveMinutes: readPositiveIntEnv('WARM_STANDBY_AUTO_ARCHIVE_MINUTES', 180),
        autoDeleteMinutes: null,
        autoStopMinutes: readPositiveIntEnv('WARM_STANDBY_AUTO_STOP_MINUTES', 45),
        persistenceMode: 'recoverable',
        preserveStateOnStop: true,
        runtimeMode: 'wakeable_recoverable',
      }
    case 'always_on':
      return {
        autoArchiveMinutes: null,
        autoDeleteMinutes: null,
        autoStopMinutes: readPositiveIntEnv('ALWAYS_ON_SAFETY_AUTO_STOP_MINUTES', null),
        persistenceMode: 'live',
        preserveStateOnStop: true,
        runtimeMode: 'persistent_live_workspace',
      }
    default:
      return {
        autoArchiveMinutes: null,
        autoDeleteMinutes: null,
        autoStopMinutes: null,
        persistenceMode: 'ephemeral',
        preserveStateOnStop: false,
        runtimeMode: 'temporary_execution',
      }
  }
}

export function planConsumesLaunchCredits(planId: SubscriptionPlanId) {
  return planId === 'run' || planId === 'warm_standby'
}

export function getPlanLedgerUnitType(planId: SubscriptionPlanId): CreditLedgerUnitType {
  switch (planId) {
    case 'warm_standby':
      return 'wake_credit'
    case 'always_on':
      return 'always_on_budget'
    default:
      return 'launch_credit'
  }
}

export function getProvisioningFailureReason(_planId: SubscriptionPlanId): RunTerminationReason {
  return 'provider_rejected'
}
