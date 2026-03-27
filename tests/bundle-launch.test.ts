import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getBundleLaunchState,
  getVisibleLaunchRequirementBlockers,
  hasMonetizationLaunchBlocker,
} from '@/lib/bundle-launch'
import { UNLIMITED_AGENTS_PER_BUNDLE } from '@/lib/subscription-plans'
import type { LaunchPolicyCheck } from '@/lib/types'

function buildLaunchPolicy(overrides: Partial<LaunchPolicyCheck>): LaunchPolicyCheck {
  return {
    allowed: true,
    blockers: [],
    plan: {
      id: 'warm_standby',
      name: 'Warm Standby',
      priceLabel: '$19/mo',
      priceCents: 1900,
      billingInterval: 'month',
      includedCredits: 24,
      activeBundles: 1,
      agentsPerBundle: UNLIMITED_AGENTS_PER_BUNDLE,
      triggerMode: 'auto_wake',
      concurrentRuns: 1,
      alwaysOnBundles: 0,
      runtimeAccess: true,
      planIncludes: [],
      suitFor: 'test',
    },
    subscription: {
      id: 'subscription-1',
      userId: 'user-1',
      planId: 'warm_standby',
      planVersion: 'v1',
      status: 'active',
      billingInterval: 'month',
      includedCredits: 24,
      remainingCredits: 12,
      priceCents: 1900,
      currency: 'USD',
      stripeCustomerId: null,
      stripePriceId: null,
      stripeSubscriptionId: null,
      stripeCheckoutSessionId: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      createdAt: '2026-03-27T00:00:00.000Z',
      updatedAt: '2026-03-27T00:00:00.000Z',
    },
    usage: {
      activeBundles: 0,
      activeRunIds: [],
      concurrentRuns: 0,
    },
    ...overrides,
  }
}

test('bundle launch state keeps monetization-blocked paired users clickable while hiding the pre-block card', () => {
  const launchPolicy = buildLaunchPolicy({
    allowed: false,
    blockers: ['No credits remaining on the current subscription.'],
    subscription: {
      ...buildLaunchPolicy({}).subscription!,
      remainingCredits: 0,
    },
  })

  const state = getBundleLaunchState({
    launchPolicy,
    orderStatus: 'paid',
    hasTelegramSetup: true,
  })

  assert.equal(state.canStartLaunchFlow, true)
  assert.equal(state.canSubmitLaunchRequest, false)
  assert.equal(state.monetizationBlocked, true)
  assert.equal(state.showRequirementsWarning, false)
})

test('bundle launch state still shows the warning card when telegram setup is missing', () => {
  const state = getBundleLaunchState({
    launchPolicy: buildLaunchPolicy({}),
    orderStatus: 'paid',
    hasTelegramSetup: false,
  })

  assert.equal(state.canStartLaunchFlow, false)
  assert.equal(state.showRequirementsWarning, true)
})

test('visible launch blockers are suppressed until telegram pairing is complete', () => {
  const blockers = getVisibleLaunchRequirementBlockers({
    launchPolicy: buildLaunchPolicy({
      allowed: false,
      blockers: [
        'Free does not include run launches.',
        'Free allows at most 0 agents per launched bundle.',
      ],
    }),
    hasTelegramSetup: false,
  })

  assert.deepEqual(blockers, [])
})

test('hasMonetizationLaunchBlocker treats free plan runtime access blocks as monetization blockers', () => {
  const launchPolicy = buildLaunchPolicy({
    allowed: false,
    blockers: ['Free does not include run launches.'],
    plan: {
      ...buildLaunchPolicy({}).plan,
      id: 'free',
      name: 'Free',
      includedCredits: 0,
      runtimeAccess: false,
      triggerMode: 'none',
      agentsPerBundle: 0,
      billingInterval: 'none',
    },
    subscription: null,
  })

  assert.equal(hasMonetizationLaunchBlocker(launchPolicy), true)
})
