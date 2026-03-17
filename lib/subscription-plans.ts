import type { SubscriptionPlan, SubscriptionPlanId } from './types'

export const SUBSCRIPTION_PLANS = [
  {
    id: 'free',
    name: 'Free',
    priceLabel: '$0',
    priceCents: 0,
    billingInterval: 'none',
    includedCredits: 0,
    activeBundles: 0,
    agentsPerBundle: 0,
    triggerMode: 'none',
    concurrentRuns: 0,
    alwaysOnBundles: 0,
    runtimeAccess: false,
    planIncludes: ['Free agents purchase', 'Free persona preview chat'],
    suitFor: 'Browse, preview, claim agents',
  },
  {
    id: 'run',
    name: 'Run',
    priceLabel: '$5',
    priceCents: 500,
    billingInterval: 'one_time',
    includedCredits: 15,
    activeBundles: 1,
    agentsPerBundle: 3,
    triggerMode: 'manual',
    concurrentRuns: 1,
    alwaysOnBundles: 0,
    runtimeAccess: true,
    planIncludes: ['Usage budget included', 'Manual bounded session', 'Auto-stop after inactivity'],
    suitFor: 'Test one workflow manually',
  },
  {
    id: 'warm_standby',
    name: 'Warm Standby',
    priceLabel: '$19/mo',
    priceCents: 1900,
    billingInterval: 'month',
    includedCredits: 10,
    activeBundles: 3,
    agentsPerBundle: 5,
    triggerMode: 'auto_wake',
    concurrentRuns: 3,
    alwaysOnBundles: 0,
    runtimeAccess: true,
    planIncludes: ['Fair-use runtime budget included', 'Wake on message', 'Auto-sleeps when idle'],
    suitFor: 'Repeat Telegram-triggered workflows',
  },
  {
    id: 'always_on',
    name: 'Always On',
    priceLabel: '$149/mo',
    priceCents: 14900,
    billingInterval: 'month',
    includedCredits: 100,
    activeBundles: 3,
    agentsPerBundle: 8,
    triggerMode: 'always_active',
    concurrentRuns: 10,
    alwaysOnBundles: 10,
    runtimeAccess: true,
    planIncludes: ['Persistent managed runtime', 'Long-running workspace support', 'Persistent workspace'],
    suitFor: 'One core workspace running full time',
  },
] as const satisfies readonly SubscriptionPlan[]

export function listSubscriptionPlans() {
  return [...SUBSCRIPTION_PLANS]
}

export function getSubscriptionPlan(planId: SubscriptionPlanId) {
  const plan = SUBSCRIPTION_PLANS.find((candidate) => candidate.id === planId)

  if (!plan) {
    throw new Error(`Unknown subscription plan: ${planId}`)
  }

  return plan
}

export function getFreeSubscriptionPlan() {
  return getSubscriptionPlan('free')
}
