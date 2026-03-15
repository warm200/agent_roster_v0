import { drizzle } from 'drizzle-orm/node-postgres'
import { eq } from 'drizzle-orm'

import { mockAgents, mockOrders, mockRuns } from '@/lib/mock-data'

import { createPool } from './index'
import * as schema from './schema'
import {
  agents,
  agentVersions,
  carts,
  creditLedger,
  orderItems,
  orders,
  riskProfiles,
  runChannelConfigs,
  runs,
  userSubscriptions,
  users,
} from './schema'

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
        deltaCredits: 50,
        balanceAfter: 50,
        reason: 'subscription_seed',
        metadata: {
          planId: 'warm_standby',
        },
        createdAt: now,
      },
    ]

    const agentRows = mockAgents.map((agent) => ({
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

    const versionRows = mockAgents.map((agent) => ({
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

    const riskRows = mockAgents.map((agent) => ({
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

    const cartRows = mockOrders.map((order) => ({
      id: order.cartId,
      userId: order.userId,
      status: 'converted' as const,
      bundleRiskLevel: order.bundleRisk.level,
      highestRiskDriver: order.bundleRisk.highestRiskDriver,
      bundleRiskSummary: order.bundleRisk.summary,
      totalCents: order.amountCents,
      currency: order.currency,
      createdAt: new Date(order.createdAt),
      updatedAt: new Date(order.updatedAt),
    }))

    const orderRows = mockOrders.map((order) => ({
      id: order.id,
      userId: order.userId,
      cartId: order.cartId,
      paymentProvider: order.paymentProvider,
      paymentReference: order.paymentReference,
      amountCents: order.amountCents,
      currency: order.currency,
      status: order.status,
      bundleRiskLevel: order.bundleRisk.level,
      highestRiskDriver: order.bundleRisk.highestRiskDriver,
      bundleRiskSummary: order.bundleRisk.summary,
      createdAt: new Date(order.createdAt),
      updatedAt: new Date(order.updatedAt),
      paidAt: order.paidAt ? new Date(order.paidAt) : null,
    }))

    const orderItemRows = mockOrders.flatMap((order) =>
      order.items.map((item) => ({
        id: item.id,
        orderId: order.id,
        agentId: item.agent.id,
        agentVersionId: item.agentVersion.id,
        priceCents: item.priceCents,
        createdAt: new Date(item.createdAt),
      })),
    )

    const channelConfigRows = mockOrders
      .filter((order) => order.channelConfig)
      .map((order) => ({
        id: order.channelConfig!.id,
        orderId: order.id,
        channelType: order.channelConfig!.channelType,
        botTokenSecretRef: order.channelConfig!.botTokenSecretRef,
        tokenStatus: order.channelConfig!.tokenStatus,
        recipientBindingStatus: order.channelConfig!.recipientBindingStatus,
        recipientExternalId: order.channelConfig!.recipientExternalId,
        appliesToScope: order.channelConfig!.appliesToScope,
        createdAt: new Date(order.channelConfig!.createdAt),
        updatedAt: new Date(order.channelConfig!.updatedAt),
      }))

    const runRows = mockRuns.map((run) => ({
      id: run.id,
      userId: run.userId,
      orderId: run.orderId,
      channelConfigId: run.channelConfigId,
      status: run.status,
      combinedRiskLevel: run.combinedRiskLevel,
      usesRealWorkspace: run.usesRealWorkspace,
      usesTools: run.usesTools,
      networkEnabled: run.networkEnabled,
      resultSummary: run.resultSummary,
      resultArtifacts: run.resultArtifacts.map((artifact) => ({ ...artifact })) as Array<
        Record<string, unknown>
      >,
      createdAt: new Date(run.createdAt),
      startedAt: run.startedAt ? new Date(run.startedAt) : null,
      updatedAt: new Date(run.updatedAt),
      completedAt: run.completedAt ? new Date(run.completedAt) : null,
    }))

    for (const runRow of runRows) {
      await db.delete(runs).where(eq(runs.id, runRow.id))
    }

    for (const channelConfigRow of channelConfigRows) {
      await db.delete(runChannelConfigs).where(eq(runChannelConfigs.id, channelConfigRow.id))
    }

    for (const orderItemRow of orderItemRows) {
      await db.delete(orderItems).where(eq(orderItems.id, orderItemRow.id))
    }

    for (const orderRow of orderRows) {
      await db.delete(orders).where(eq(orders.id, orderRow.id))
    }

    for (const creditRow of creditRows) {
      await db.delete(creditLedger).where(eq(creditLedger.id, creditRow.id))
    }

    for (const subscriptionRow of subscriptionRows) {
      await db.delete(userSubscriptions).where(eq(userSubscriptions.id, subscriptionRow.id))
    }

    for (const cartRow of cartRows) {
      await db.delete(carts).where(eq(carts.id, cartRow.id))
    }

    for (const riskRow of riskRows) {
      await db.delete(riskProfiles).where(eq(riskProfiles.id, riskRow.id))
    }

    for (const versionRow of versionRows) {
      await db.delete(agentVersions).where(eq(agentVersions.id, versionRow.id))
    }

    for (const agentRow of agentRows) {
      await db.delete(agents).where(eq(agents.id, agentRow.id))
    }

    for (const demoUser of demoUsers) {
      await db.delete(users).where(eq(users.id, demoUser.id))
    }

    await db.insert(users).values(demoUsers)
    await db.insert(userSubscriptions).values(subscriptionRows)
    await db.insert(creditLedger).values(creditRows)
    await db.insert(agents).values(agentRows)
    await db.insert(agentVersions).values(versionRows)
    await db.insert(riskProfiles).values(riskRows)
    await db.insert(carts).values(cartRows)
    await db.insert(orders).values(orderRows)
    await db.insert(orderItems).values(orderItemRows)
    await db.insert(runChannelConfigs).values(channelConfigRows)
    await db.insert(runs).values(runRows)

    console.log(
      `Seeded ${agentRows.length} agents, ${orderRows.length} orders, and ${runRows.length} runs`,
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
