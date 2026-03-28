import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'

import { mockAgents, mockOrders, mockRuns } from '@/lib/mock-data'

import { createPool } from './index'
import * as schema from './schema'
import {
  agentVersions,
  agents,
  carts,
  creditLedger,
  orderItems,
  orders,
  riskProfiles,
  runChannelConfigs,
  runs,
  runUsage,
  userSubscriptions,
  users,
} from './schema'
import { syncLocalAgentsToDb } from '../services/local-agent-files'

async function seed() {
  const pool = createPool()
  const db = drizzle(pool, { schema })

  try {
    const demoUsers = [
      {
        id: 'user-1',
        email: 'user-1@demo.local',
        name: 'Demo User',
        authProvider: 'demo',
      },
    ]
    const now = new Date()
    const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    const subscriptionRows = [
      {
        id: 'subscription-demo-1',
        userId: 'user-1',
        planId: 'warm_standby' as const,
        planVersion: 'v1',
        status: 'active' as const,
        billingInterval: 'month' as const,
        includedCredits: 50,
        remainingCredits: 50,
        priceCents: 1900,
        currency: 'USD',
        stripeCustomerId: null,
        stripePriceId: null,
        stripeSubscriptionId: null,
        stripeCheckoutSessionId: null,
        currentPeriodStart: now,
        currentPeriodEnd: nextMonth,
        createdAt: now,
        updatedAt: now,
      },
    ]
    const creditRows = [
      {
        id: 'credit-demo-1',
        userId: 'user-1',
        subscriptionId: 'subscription-demo-1',
        orderId: null,
        runId: null,
        eventType: 'grant' as const,
        unitType: 'wake_credit' as const,
        deltaCredits: 50,
        resultingBalance: 50,
        status: 'committed' as const,
        reasonCode: 'subscription_seed',
        idempotencyKey: 'seed:subscription-demo-1',
        metadataJson: {
          planId: 'warm_standby',
          planVersion: 'v1',
        },
        createdAt: now,
      },
    ]
    const browserSmokeAgents = mockAgents.slice(0, 2)
    const browserSmokeOrder = mockOrders[0]
    const browserSmokeRun = mockRuns.find((run) => run.id === 'run-1')

    if (!browserSmokeRun || !browserSmokeOrder.channelConfig) {
      throw new Error('Missing browser smoke fixtures in lib/mock-data.ts')
    }

    const browserSmokeAgentRows = browserSmokeAgents.map((agent) => ({
      id: agent.id,
      slug: agent.slug,
      title: agent.title,
      category: agent.category,
      summary: agent.summary,
      descriptionMarkdown: agent.descriptionMarkdown,
      priceCents: agent.priceCents,
      currency: agent.currency,
      status: agent.status,
      createdAt: new Date(agent.createdAt),
      updatedAt: new Date(agent.updatedAt),
    }))
    const browserSmokeVersionRows = browserSmokeAgents.map((agent) => ({
      id: agent.currentVersion.id,
      agentId: agent.currentVersion.agentId,
      version: agent.currentVersion.version,
      changelogMarkdown: agent.currentVersion.changelogMarkdown,
      previewPromptSnapshot: agent.currentVersion.previewPromptSnapshot,
      runConfigSnapshot: agent.currentVersion.runConfigSnapshot,
      installPackageUrl: agent.currentVersion.installPackageUrl,
      installScriptMarkdown: agent.currentVersion.installScriptMarkdown,
      releaseNotes: agent.currentVersion.releaseNotes,
      createdAt: new Date(agent.currentVersion.createdAt),
    }))
    const browserSmokeRiskRows = browserSmokeAgents.map((agent) => ({
      id: agent.currentVersion.riskProfile.id,
      agentVersionId: agent.currentVersion.riskProfile.agentVersionId,
      chatOnly: agent.currentVersion.riskProfile.chatOnly,
      readFiles: agent.currentVersion.riskProfile.readFiles,
      writeFiles: agent.currentVersion.riskProfile.writeFiles,
      network: agent.currentVersion.riskProfile.network,
      shell: agent.currentVersion.riskProfile.shell,
      riskLevel: agent.currentVersion.riskProfile.riskLevel,
      scanSummary: agent.currentVersion.riskProfile.scanSummary,
      createdAt: new Date(agent.currentVersion.riskProfile.createdAt),
    }))
    const browserSmokeCartRow = {
      id: browserSmokeOrder.cartId,
      userId: browserSmokeOrder.userId,
      status: 'converted' as const,
      bundleRiskLevel: browserSmokeOrder.bundleRisk.level,
      highestRiskDriver: browserSmokeOrder.bundleRisk.highestRiskDriver,
      bundleRiskSummary: browserSmokeOrder.bundleRisk.summary,
      totalCents: browserSmokeOrder.amountCents,
      currency: browserSmokeOrder.currency,
      createdAt: new Date(browserSmokeOrder.createdAt),
      updatedAt: new Date(browserSmokeOrder.updatedAt),
    }
    const browserSmokeOrderRow = {
      id: browserSmokeOrder.id,
      userId: browserSmokeOrder.userId,
      cartId: browserSmokeOrder.cartId,
      paymentProvider: browserSmokeOrder.paymentProvider,
      paymentReference: browserSmokeOrder.paymentReference,
      amountCents: browserSmokeOrder.amountCents,
      currency: browserSmokeOrder.currency,
      status: browserSmokeOrder.status,
      agentSetup: null,
      bundleRiskLevel: browserSmokeOrder.bundleRisk.level,
      highestRiskDriver: browserSmokeOrder.bundleRisk.highestRiskDriver,
      bundleRiskSummary: browserSmokeOrder.bundleRisk.summary,
      createdAt: new Date(browserSmokeOrder.createdAt),
      updatedAt: new Date(browserSmokeOrder.updatedAt),
      paidAt: browserSmokeOrder.paidAt ? new Date(browserSmokeOrder.paidAt) : null,
    }
    const browserSmokeOrderItemRows = browserSmokeOrder.items.map((item) => ({
      id: item.id,
      orderId: item.orderId,
      agentId: item.agent.id,
      agentVersionId: item.agentVersion.id,
      priceCents: item.priceCents,
      createdAt: new Date(item.createdAt),
    }))
    const browserSmokeChannelConfigRow = {
      id: browserSmokeOrder.channelConfig.id,
      orderId: browserSmokeOrder.channelConfig.orderId,
      channelType: browserSmokeOrder.channelConfig.channelType,
      botTokenSecretRef: browserSmokeOrder.channelConfig.botTokenSecretRef,
      tokenStatus: browserSmokeOrder.channelConfig.tokenStatus,
      recipientBindingStatus: browserSmokeOrder.channelConfig.recipientBindingStatus,
      recipientExternalId: browserSmokeOrder.channelConfig.recipientExternalId,
      appliesToScope: browserSmokeOrder.channelConfig.appliesToScope,
      createdAt: new Date(browserSmokeOrder.channelConfig.createdAt),
      updatedAt: new Date(browserSmokeOrder.channelConfig.updatedAt),
    }
    const browserSmokeRunRow = {
      id: browserSmokeRun.id,
      userId: browserSmokeRun.userId,
      orderId: browserSmokeRun.orderId,
      channelConfigId: browserSmokeRun.channelConfigId,
      status: browserSmokeRun.status,
      combinedRiskLevel: browserSmokeRun.combinedRiskLevel,
      usesRealWorkspace: browserSmokeRun.usesRealWorkspace,
      usesTools: browserSmokeRun.usesTools,
      networkEnabled: browserSmokeRun.networkEnabled,
      resultSummary: browserSmokeRun.resultSummary,
      resultArtifacts: browserSmokeRun.resultArtifacts as unknown as Array<Record<string, unknown>>,
      createdAt: new Date(browserSmokeRun.createdAt),
      startedAt: browserSmokeRun.startedAt ? new Date(browserSmokeRun.startedAt) : null,
      updatedAt: new Date(browserSmokeRun.updatedAt),
      completedAt: browserSmokeRun.completedAt ? new Date(browserSmokeRun.completedAt) : null,
    }
    const browserSmokeRunUsageRow = {
      id: 'run-usage-1',
      runId: browserSmokeRun.id,
      userId: browserSmokeRun.userId,
      orderId: browserSmokeRun.orderId,
      planId: 'warm_standby' as const,
      planVersion: 'v1',
      triggerModeSnapshot: 'manual',
      agentCount: browserSmokeOrder.items.length,
      usesRealWorkspace: browserSmokeRun.usesRealWorkspace,
      usesTools: browserSmokeRun.usesTools,
      networkEnabled: browserSmokeRun.networkEnabled,
      provisioningStartedAt: browserSmokeRun.startedAt ? new Date(browserSmokeRun.startedAt) : null,
      providerAcceptedAt: browserSmokeRun.startedAt ? new Date(browserSmokeRun.startedAt) : null,
      runningStartedAt: browserSmokeRun.startedAt ? new Date(browserSmokeRun.startedAt) : null,
      lastMeaningfulActivityAt: browserSmokeRun.completedAt ? new Date(browserSmokeRun.completedAt) : null,
      lastOpenClawSessionActivityAt: null,
      lastOpenClawSessionProbeAt: null,
      openClawSessionCount: null,
      completedAt: browserSmokeRun.completedAt ? new Date(browserSmokeRun.completedAt) : null,
      workspaceReleasedAt: browserSmokeRun.completedAt ? new Date(browserSmokeRun.completedAt) : null,
      terminationReason: null,
      workspaceMinutes:
        browserSmokeRun.startedAt && browserSmokeRun.completedAt
          ? Math.max(
              1,
              Math.round(
                (new Date(browserSmokeRun.completedAt).getTime() -
                  new Date(browserSmokeRun.startedAt).getTime()) /
                  (60 * 1000),
              ),
            )
          : null,
      toolCallsCount: 12,
      inputTokensEst: 6400,
      outputTokensEst: 1800,
      estimatedInternalCostCents: 41,
      statusSnapshot: 'completed' as const,
      ttlPolicySnapshot: {
        cleanupGraceMinutes: 10,
        heartbeatMissingMinutes: null,
        idleTimeoutMinutes: 45,
        maxSessionTtlMinutes: 360,
        openClawIdleTimeoutMinutes: 45,
        provisioningTimeoutMinutes: 15,
        triggerMode: 'manual',
        unhealthyProviderTimeoutMinutes: null,
      },
      createdAt: new Date(browserSmokeRun.createdAt),
      updatedAt: new Date(browserSmokeRun.updatedAt),
    }

    for (const creditRow of creditRows) {
      await db.delete(creditLedger).where(eq(creditLedger.id, creditRow.id))
    }

    await db.delete(runUsage).where(eq(runUsage.runId, browserSmokeRunRow.id))
    await db.delete(runs).where(eq(runs.id, browserSmokeRunRow.id))
    await db
      .delete(runChannelConfigs)
      .where(eq(runChannelConfigs.id, browserSmokeChannelConfigRow.id))

    for (const item of browserSmokeOrderItemRows) {
      await db.delete(orderItems).where(eq(orderItems.id, item.id))
    }

    await db.delete(orders).where(eq(orders.id, browserSmokeOrderRow.id))
    await db.delete(carts).where(eq(carts.id, browserSmokeCartRow.id))

    for (const riskProfile of browserSmokeRiskRows) {
      await db.delete(riskProfiles).where(eq(riskProfiles.id, riskProfile.id))
    }

    for (const version of browserSmokeVersionRows) {
      await db.delete(agentVersions).where(eq(agentVersions.id, version.id))
    }

    for (const agent of browserSmokeAgentRows) {
      await db.delete(agents).where(eq(agents.id, agent.id))
    }

    for (const subscriptionRow of subscriptionRows) {
      await db.delete(userSubscriptions).where(eq(userSubscriptions.id, subscriptionRow.id))
    }

    for (const demoUser of demoUsers) {
      await db.delete(users).where(eq(users.id, demoUser.id))
    }

    await db.insert(users).values(demoUsers)
    await db.insert(userSubscriptions).values(subscriptionRows)
    await db.insert(creditLedger).values(creditRows)
    await syncLocalAgentsToDb(undefined, db)
    await db.insert(agents).values(browserSmokeAgentRows)
    await db.insert(agentVersions).values(browserSmokeVersionRows)
    await db.insert(riskProfiles).values(browserSmokeRiskRows)
    await db.insert(carts).values(browserSmokeCartRow)
    await db.insert(orders).values(browserSmokeOrderRow)
    await db.insert(orderItems).values(browserSmokeOrderItemRows)
    await db.insert(runChannelConfigs).values(browserSmokeChannelConfigRow)
    await db.insert(runs).values(browserSmokeRunRow)
    await db.insert(runUsage).values(browserSmokeRunUsageRow)

    console.log(
      'Seeded demo user/subscription data, browser smoke fixtures, and synced local catalog agents.',
    )
  } finally {
    await pool.end()
  }
}

seed().catch((error) => {
  console.error('Database seed failed')
  console.error(error)
  process.exit(1)
})
