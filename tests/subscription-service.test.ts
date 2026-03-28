import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getSubscriptionPlan } from '@/lib/subscription-plans'
import type { AdminRuntimeGrant, Order, UserSubscription } from '@/lib/types'
import {
  buildLaunchPolicyCheck,
  getStripeSubscriptionCurrentPeriodEnd,
  isCountedActiveRun,
} from '@/server/services/subscription.service'

function buildOrder(agentCount: number, orderId = 'order-test-1'): Order {
  return {
    id: orderId,
    userId: 'user-1',
    cartId: 'cart-1',
    paymentProvider: 'free',
    paymentReference: 'free:cart-1',
    amountCents: 0,
    currency: 'USD',
    status: 'paid',
    items: Array.from({ length: agentCount }, (_, index) => ({
      id: `item-${index + 1}`,
      orderId,
      priceCents: 0,
      createdAt: new Date().toISOString(),
      agent: {
        id: `agent-${index + 1}`,
        slug: `agent-${index + 1}`,
        title: `Agent ${index + 1}`,
        category: 'automation',
        summary: 'summary',
        descriptionMarkdown: 'desc',
        priceCents: 0,
        currency: 'USD',
        status: 'active',
        currentVersion: {
          id: `ver-${index + 1}`,
          agentId: `agent-${index + 1}`,
          version: '1.0.0',
          changelogMarkdown: '',
          previewPromptSnapshot: '',
          runConfigSnapshot: '{}',
          installPackageUrl: '/download.zip',
          installScriptMarkdown: '',
          releaseNotes: '',
          riskProfile: {
            id: `risk-${index + 1}`,
            agentVersionId: `ver-${index + 1}`,
            chatOnly: false,
            readFiles: false,
            writeFiles: false,
            network: true,
            shell: false,
            riskLevel: 'low',
            scanSummary: 'low',
            createdAt: new Date().toISOString(),
          },
          createdAt: new Date().toISOString(),
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      agentVersion: {
        id: `ver-${index + 1}`,
        agentId: `agent-${index + 1}`,
        version: '1.0.0',
        changelogMarkdown: '',
        previewPromptSnapshot: '',
        runConfigSnapshot: '{}',
        installPackageUrl: '/download.zip',
        installScriptMarkdown: '',
        releaseNotes: '',
        riskProfile: {
          id: `risk-${index + 1}`,
          agentVersionId: `ver-${index + 1}`,
          chatOnly: false,
          readFiles: false,
          writeFiles: false,
          network: true,
          shell: false,
          riskLevel: 'low',
          scanSummary: 'low',
          createdAt: new Date().toISOString(),
        },
        createdAt: new Date().toISOString(),
      },
    })),
    channelConfig: null,
    bundleRisk: {
      level: 'low',
      highestRiskDriver: null,
      summary: 'low',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    paidAt: new Date().toISOString(),
  }
}

function buildSubscription(planId: UserSubscription['planId'], remainingCredits = 50): UserSubscription {
  return {
    id: `subscription-${planId}`,
    userId: 'user-1',
    planId,
    planVersion: 'v1',
    status: 'active',
    billingInterval: planId === 'run' ? 'one_time' : planId === 'free' ? 'none' : 'month',
    includedCredits: getSubscriptionPlan(planId).includedCredits,
    remainingCredits,
    priceCents: getSubscriptionPlan(planId).priceCents,
    currency: 'USD',
    stripeCustomerId: null,
    stripePriceId: null,
    stripeSubscriptionId: null,
    stripeCheckoutSessionId: null,
    currentPeriodStart: new Date().toISOString(),
    currentPeriodEnd: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function buildRuntimeGrant(overrides: Partial<AdminRuntimeGrant> = {}): AdminRuntimeGrant {
  return {
    id: 'grant-1',
    userId: 'user-1',
    grantedByUserId: 'admin-1',
    creditsTotal: 3,
    creditsRemaining: 3,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    consumedAt: null,
    revokedAt: null,
    note: 'promo',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

test('counted active runs stop counting once workspace is released', () => {
  assert.equal(
    isCountedActiveRun({ status: 'completed', usesRealWorkspace: true, workspaceReleasedAt: null }),
    true,
  )
  assert.equal(
    isCountedActiveRun({ status: 'completed', usesRealWorkspace: false, workspaceReleasedAt: null }),
    false,
  )
  assert.equal(
    isCountedActiveRun({ status: 'completed', usesRealWorkspace: true, workspaceReleasedAt: new Date().toISOString() }),
    false,
  )
  assert.equal(
    isCountedActiveRun({ status: 'failed', usesRealWorkspace: true, workspaceReleasedAt: null }),
    false,
  )
})

test('getStripeSubscriptionCurrentPeriodEnd returns a date when Stripe includes current_period_end', () => {
  const subscription = {
    current_period_end: 1_774_051_200,
  }

  const periodEnd = getStripeSubscriptionCurrentPeriodEnd(subscription)

  assert.equal(periodEnd?.toISOString(), '2026-03-21T00:00:00.000Z')
})

test('free plan blocks all launches', () => {
  const plan = getSubscriptionPlan('free')
  const policy = buildLaunchPolicyCheck({
    availableCredits: 0,
    effectivePlan: plan,
    order: buildOrder(1),
    plan,
    runRows: [],
    runtimeGrant: null,
    subscription: null,
  })

  assert.equal(policy.allowed, false)
  assert.match(policy.blockers[0] ?? '', /does not include run launches/i)
})

test('run plan blocks bundles above the plan agent limit', () => {
  const plan = getSubscriptionPlan('run')
  const policy = buildLaunchPolicyCheck({
    availableCredits: 30,
    effectivePlan: plan,
    order: buildOrder(4),
    plan,
    runRows: [],
    runtimeGrant: null,
    subscription: buildSubscription('run', 30),
  })

  assert.equal(policy.allowed, false)
  assert.ok(policy.blockers.some((entry) => /at most 3 agents/i.test(entry)))
})

test('launch policy blocks when any live run is still active', () => {
  const plan = getSubscriptionPlan('warm_standby')
  const policy = buildLaunchPolicyCheck({
    availableCredits: 50,
    effectivePlan: plan,
    order: buildOrder(2, 'order-next'),
    plan,
    runRows: [
      { id: 'run-1', orderId: 'order-a', status: 'running', usesRealWorkspace: true, workspaceReleasedAt: null },
      { id: 'run-2', orderId: 'order-b', status: 'running', usesRealWorkspace: true, workspaceReleasedAt: null },
      { id: 'run-3', orderId: 'order-c', status: 'completed', usesRealWorkspace: true, workspaceReleasedAt: null },
    ],
    runtimeGrant: null,
    subscription: buildSubscription('warm_standby', 50),
  })

  assert.equal(policy.allowed, false)
  assert.ok(policy.blockers.some((entry) => /stop your current live run before starting another one/i.test(entry)))
  assert.equal(policy.usage.activeBundles, 3)
  assert.equal(policy.usage.concurrentRuns, 3)
})

test('warm standby allows large bundles without an agent-count blocker', () => {
  const plan = getSubscriptionPlan('warm_standby')
  const policy = buildLaunchPolicyCheck({
    availableCredits: 50,
    effectivePlan: plan,
    order: buildOrder(25, 'order-warm-large'),
    plan,
    runRows: [],
    runtimeGrant: null,
    subscription: buildSubscription('warm_standby', 50),
  })

  assert.equal(
    policy.blockers.some((entry) => /agents per launched bundle|at most/i.test(entry)),
    false,
  )
})

test('always on allows large bundles without an agent-count blocker', () => {
  const plan = getSubscriptionPlan('always_on')
  const policy = buildLaunchPolicyCheck({
    availableCredits: 50,
    effectivePlan: plan,
    order: buildOrder(25, 'order-always-large'),
    plan,
    runRows: [],
    runtimeGrant: null,
    subscription: buildSubscription('always_on', 50),
  })

  assert.equal(
    policy.blockers.some((entry) => /agents per launched bundle|at most/i.test(entry)),
    false,
  )
})

test('warm standby launch policy blocks when the same bundle already has a stopped recoverable run', () => {
  const plan = getSubscriptionPlan('warm_standby')
  const policy = buildLaunchPolicyCheck({
    availableCredits: 10,
    effectivePlan: plan,
    order: buildOrder(2, 'order-warm'),
    plan,
    runRows: [
      {
        id: 'run-stopped-1',
        orderId: 'order-warm',
        persistenceMode: 'recoverable',
        preservedStateAvailable: true,
        runtimeState: 'stopped',
        status: 'completed',
        usesRealWorkspace: true,
        workspaceReleasedAt: null,
      },
    ],
    runtimeGrant: null,
    subscription: buildSubscription('warm_standby', 10),
  })

  assert.equal(policy.allowed, false)
  assert.ok(
    policy.blockers.some((entry) =>
      /resume or terminate the existing stopped warm standby run for this bundle/i.test(entry),
    ),
  )
})

test('free plan becomes launchable when an active admin runtime grant is present', () => {
  const policy = buildLaunchPolicyCheck({
    availableCredits: 3,
    effectivePlan: getSubscriptionPlan('run'),
    order: buildOrder(3),
    plan: getSubscriptionPlan('free'),
    runRows: [],
    runtimeGrant: buildRuntimeGrant(),
    subscription: null,
  })

  assert.equal(policy.allowed, true)
  assert.equal(policy.plan.id, 'free')
  assert.equal(policy.effectivePlan.id, 'run')
  assert.equal(policy.availableCredits, 3)
  assert.equal(policy.runtimeGrant?.id, 'grant-1')
})
