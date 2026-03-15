import type {
  CreditLedgerUnitType,
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

export function getTtlPolicySnapshot(plan: SubscriptionPlan): TtlPolicySnapshot {
  switch (plan.id) {
    case 'run':
      return {
        cleanupGraceMinutes: 5,
        heartbeatMissingMinutes: null,
        idleTimeoutMinutes: 20,
        maxSessionTtlMinutes: 120,
        provisioningTimeoutMinutes: 15,
        triggerMode: plan.triggerMode,
        unhealthyProviderTimeoutMinutes: null,
      }
    case 'warm_standby':
      return {
        cleanupGraceMinutes: 10,
        heartbeatMissingMinutes: null,
        idleTimeoutMinutes: 45,
        maxSessionTtlMinutes: 360,
        provisioningTimeoutMinutes: 15,
        triggerMode: plan.triggerMode,
        unhealthyProviderTimeoutMinutes: null,
      }
    case 'always_on':
      return {
        cleanupGraceMinutes: null,
        heartbeatMissingMinutes: 15,
        idleTimeoutMinutes: null,
        maxSessionTtlMinutes: null,
        provisioningTimeoutMinutes: 15,
        triggerMode: plan.triggerMode,
        unhealthyProviderTimeoutMinutes: 10,
      }
    default:
      return {
        cleanupGraceMinutes: null,
        heartbeatMissingMinutes: null,
        idleTimeoutMinutes: null,
        maxSessionTtlMinutes: null,
        provisioningTimeoutMinutes: 15,
        triggerMode: plan.triggerMode,
        unhealthyProviderTimeoutMinutes: null,
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
