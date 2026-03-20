import { drizzle } from 'drizzle-orm/node-postgres'
import { eq } from 'drizzle-orm'

import { createPool } from './index'
import * as schema from './schema'
import {
  creditLedger,
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

    for (const creditRow of creditRows) {
      await db.delete(creditLedger).where(eq(creditLedger.id, creditRow.id))
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

    console.log(
      'Seeded demo user/subscription data and synced local catalog agents.',
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
