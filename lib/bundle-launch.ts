import type { LaunchPolicyCheck } from '@/lib/types'

export function hasMonetizationLaunchBlocker(launchPolicy: LaunchPolicyCheck | null) {
  if (!launchPolicy) {
    return false
  }

  if (!launchPolicy.plan.runtimeAccess) {
    return true
  }

  return Boolean(
    launchPolicy.subscription &&
      launchPolicy.plan.includedCredits > 0 &&
      launchPolicy.subscription.remainingCredits <= 0,
  )
}

export function getVisibleLaunchRequirementBlockers(input: {
  launchPolicy: LaunchPolicyCheck | null
  hasTelegramSetup: boolean
}) {
  if (!input.hasTelegramSetup) {
    return []
  }

  return input.launchPolicy?.blockers ?? []
}

export function getBundleLaunchState(input: {
  launchPolicy: LaunchPolicyCheck | null
  orderStatus: string
  hasTelegramSetup: boolean
}) {
  const canStartLaunchFlow = input.orderStatus === 'paid' && input.hasTelegramSetup
  const canSubmitLaunchRequest = canStartLaunchFlow && (input.launchPolicy?.allowed ?? true)
  const monetizationBlocked = hasMonetizationLaunchBlocker(input.launchPolicy)
  const showRequirementsWarning =
    input.orderStatus === 'paid' &&
    (!input.hasTelegramSetup ||
      Boolean(input.launchPolicy && input.launchPolicy.blockers.length > 0 && !monetizationBlocked))

  return {
    canStartLaunchFlow,
    canSubmitLaunchRequest,
    monetizationBlocked,
    showRequirementsWarning,
  }
}
