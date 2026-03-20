import assert from 'node:assert/strict'
import { test } from 'node:test'

import { getSubscriptionPlan } from '@/lib/subscription-plans'
import type { Order, UserSubscription } from '@/lib/types'
import { buildLaunchPolicyCheck, isCountedActiveRun } from '@/server/services/subscription.service'

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

test('free plan blocks all launches', () => {
  const policy = buildLaunchPolicyCheck({
    order: buildOrder(1),
    plan: getSubscriptionPlan('free'),
    runRows: [],
    subscription: null,
  })

  assert.equal(policy.allowed, false)
  assert.match(policy.blockers[0] ?? '', /does not include run launches/i)
})

test('run plan blocks bundles above the plan agent limit', () => {
  const policy = buildLaunchPolicyCheck({
    order: buildOrder(4),
    plan: getSubscriptionPlan('run'),
    runRows: [],
    subscription: buildSubscription('run', 30),
  })

  assert.equal(policy.allowed, false)
  assert.ok(policy.blockers.some((entry) => /at most 3 agents/i.test(entry)))
})

test('launch policy blocks when any live run is still active', () => {
  const policy = buildLaunchPolicyCheck({
    order: buildOrder(2, 'order-next'),
    plan: getSubscriptionPlan('warm_standby'),
    runRows: [
      { id: 'run-1', orderId: 'order-a', status: 'running', usesRealWorkspace: true, workspaceReleasedAt: null },
      { id: 'run-2', orderId: 'order-b', status: 'running', usesRealWorkspace: true, workspaceReleasedAt: null },
      { id: 'run-3', orderId: 'order-c', status: 'completed', usesRealWorkspace: true, workspaceReleasedAt: null },
    ],
    subscription: buildSubscription('warm_standby', 50),
  })

  assert.equal(policy.allowed, false)
  assert.ok(policy.blockers.some((entry) => /stop your current live run before starting another one/i.test(entry)))
  assert.equal(policy.usage.activeBundles, 3)
  assert.equal(policy.usage.concurrentRuns, 3)
})

test('warm standby allows large bundles without an agent-count blocker', () => {
  const policy = buildLaunchPolicyCheck({
    order: buildOrder(25, 'order-warm-large'),
    plan: getSubscriptionPlan('warm_standby'),
    runRows: [],
    subscription: buildSubscription('warm_standby', 50),
  })

  assert.equal(
    policy.blockers.some((entry) => /agents per launched bundle|at most/i.test(entry)),
    false,
  )
})

test('warm standby launch policy blocks when the same bundle already has a stopped recoverable run', () => {
  const policy = buildLaunchPolicyCheck({
    order: buildOrder(2, 'order-warm'),
    plan: getSubscriptionPlan('warm_standby'),
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
    subscription: buildSubscription('warm_standby', 10),
  })

  assert.equal(policy.allowed, false)
  assert.ok(
    policy.blockers.some((entry) =>
      /resume or terminate the existing stopped warm standby run for this bundle/i.test(entry),
    ),
  )
})
