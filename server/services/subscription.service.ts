import type Stripe from 'stripe'
import { and, asc, eq, gt, lte, sql } from 'drizzle-orm'

import { getCreditTopUpExpiresAt, getCreditTopUpPack, listCreditTopUpPacks } from '@/lib/credit-topups'
import {
  launchPolicyCheckSchema,
  subscriptionPlanSchema,
  userSubscriptionSchema,
} from '@/lib/schemas'
import {
  formatAgentsPerBundleLabel,
  getFreeSubscriptionPlan,
  getSubscriptionPlan,
  isUnlimitedAgentsPerBundle,
  listSubscriptionPlans,
} from '@/lib/subscription-plans'
import type {
  CreditTopUpPack,
  Order,
  LaunchPolicyCheck,
  SubscriptionPlan,
  UserSubscription,
} from '@/lib/types'

import { createDb, type DbClient } from '../db'
import {
  creditLedger,
  runUsage,
  runs,
  runtimeInstances,
  subscriptionCreditTopUps,
  userSubscriptions,
} from '../db/schema'
import { HttpError } from '../lib/http'
import { getStripe } from '../lib/stripe'
import { getPlanLedgerUnitType, planConsumesLaunchCredits, RUNTIME_PLAN_VERSION } from './runtime-policy'

type SubscriptionCheckoutSession = {
  sessionId: string
  sessionUrl: string
}

type TopUpAllocation = {
  credits: number
  topUpId: string
}

type MutationDb = Pick<DbClient, 'execute' | 'insert' | 'select' | 'update'>

function getCheckoutBaseUrl(origin: string) {
  return (process.env.NEXTAUTH_URL || origin).replace(/\/$/, '')
}

function normalizeReturnPath(path: string | null | undefined) {
  if (!path || !path.trim()) {
    return '/app'
  }

  if (path.startsWith('http://') || path.startsWith('https://')) {
    throw new HttpError(400, 'Return path must be relative.')
  }

  return path.startsWith('/') ? path : `/${path}`
}

function getStripeCheckoutClient() {
  try {
    return getStripe()
  } catch {
    throw new HttpError(503, 'Stripe is not configured.')
  }
}

function buildSessionPriceDescription(plan: SubscriptionPlan) {
  const agentsPerBundleLabel = formatAgentsPerBundleLabel(plan.agentsPerBundle).toLowerCase()

  if (plan.id === 'always_on') {
    return `Persistent workspace, managed runtime, ${agentsPerBundleLabel} agents per launched bundle.`
  }

  if (plan.billingInterval === 'month') {
    return `${plan.includedCredits} monthly credits, ${plan.triggerMode === 'auto_wake' ? 'wake on Telegram' : 'manual only'}, ${agentsPerBundleLabel} agents per launched bundle.`
  }

  return `${plan.includedCredits} credits, manual only, ${agentsPerBundleLabel} agents per launched bundle.`
}

function buildTopUpPriceDescription(pack: CreditTopUpPack) {
  return `${pack.credits} runtime credits added to the current balance. Credits expire ${pack.expiresInDays} days after purchase.`
}

function requireSubscriptionPlan(planId: string) {
  try {
    return getSubscriptionPlan(planId as SubscriptionPlan['id'])
  } catch {
    throw new HttpError(400, `Unknown subscription plan: ${planId}`)
  }
}

function requireCreditTopUpPack(packId: string) {
  try {
    return getCreditTopUpPack(packId as CreditTopUpPack['id'])
  } catch {
    throw new HttpError(400, `Unknown credit top-up pack: ${packId}`)
  }
}

function assertCompletedRuntimePlanSession(session: Stripe.Checkout.Session) {
  if (session.status !== 'complete') {
    throw new HttpError(409, 'Checkout session is not complete yet.')
  }

  if (session.mode === 'payment' && session.payment_status !== 'paid') {
    throw new HttpError(409, 'Checkout session is not paid yet.')
  }

  if (session.mode === 'subscription' && !['paid', 'no_payment_required'].includes(session.payment_status)) {
    throw new HttpError(409, 'Subscription checkout has not been paid yet.')
  }
}

function assertCompletedTopUpSession(session: Stripe.Checkout.Session) {
  if (session.status !== 'complete' || session.mode !== 'payment' || session.payment_status !== 'paid') {
    throw new HttpError(409, 'Top-up checkout session is not paid yet.')
  }
}

async function getStripePeriodBounds(stripe: Stripe, session: Stripe.Checkout.Session) {
  if (!session.subscription) {
    return {
      currentPeriodStart: null,
      currentPeriodEnd: null,
      stripeSubscriptionId: null,
    }
  }

  const subscription =
    typeof session.subscription === 'string'
      ? await stripe.subscriptions.retrieve(session.subscription)
      : session.subscription

  return {
    currentPeriodStart:
      'current_period_start' in subscription && typeof subscription.current_period_start === 'number'
        ? new Date(subscription.current_period_start * 1000)
        : null,
    currentPeriodEnd:
      'current_period_end' in subscription && typeof subscription.current_period_end === 'number'
        ? new Date(subscription.current_period_end * 1000)
        : null,
    stripeSubscriptionId: subscription.id,
  }
}

export function getStripeSubscriptionCurrentPeriodEnd(subscription: unknown) {
  if (!subscription || typeof subscription !== 'object' || !('current_period_end' in subscription)) {
    return null
  }

  const periodEnd = (subscription as { current_period_end?: unknown }).current_period_end
  return typeof periodEnd === 'number' ? new Date(periodEnd * 1000) : null
}

export function isCountedActiveRun(run: {
  status: string
  usesRealWorkspace: boolean
  workspaceReleasedAt: string | null
}) {
  return (
    ((run.status === 'provisioning' || run.status === 'running') && !run.workspaceReleasedAt) ||
    (run.usesRealWorkspace && run.status === 'completed' && !run.workspaceReleasedAt)
  )
}

export function buildLaunchPolicyCheck(input: {
  order: Order
  plan: SubscriptionPlan
  runRows: Array<{
    id: string
    orderId: string
    persistenceMode?: 'ephemeral' | 'recoverable' | 'live' | null
    preservedStateAvailable?: boolean | null
    runtimeState?: 'provisioning' | 'running' | 'stopped' | 'archived' | 'deleted' | 'failed' | null
    status: string
    usesRealWorkspace: boolean
    workspaceReleasedAt: string | null
  }>
  subscription: UserSubscription | null
}) {
  const activeRuns = input.runRows.filter(isCountedActiveRun)
  const activeBundleIds = new Set(activeRuns.map((run) => run.orderId))
  const recoverableStoppedRun = input.runRows.find(
    (run) =>
      run.orderId === input.order.id &&
      run.persistenceMode === 'recoverable' &&
      run.preservedStateAvailable === true &&
      (run.runtimeState === 'stopped' || run.runtimeState === 'archived'),
  )
  const blockers: string[] = []

  if (!input.plan.runtimeAccess) {
    blockers.push(`${input.plan.name} does not include run launches.`)
  }

  if (
    !isUnlimitedAgentsPerBundle(input.plan.agentsPerBundle) &&
    input.order.items.length > input.plan.agentsPerBundle
  ) {
    blockers.push(
      `${input.plan.name} allows at most ${input.plan.agentsPerBundle} agent${input.plan.agentsPerBundle === 1 ? '' : 's'} per launched bundle.`,
    )
  }

  if (activeRuns.length > 0) {
    blockers.push('Stop your current live run before starting another one.')
  }

  if (input.plan.id === 'warm_standby' && recoverableStoppedRun) {
    blockers.push('Resume or terminate the existing stopped Warm Standby run for this bundle instead of launching a new one.')
  }

  if (input.subscription && input.subscription.remainingCredits <= 0 && input.plan.includedCredits > 0) {
    blockers.push('No credits remaining on the current subscription.')
  }

  return launchPolicyCheckSchema.parse({
    allowed: blockers.length === 0,
    blockers,
    plan: input.plan,
    subscription: input.subscription,
    usage: {
      activeBundles: activeBundleIds.size,
      activeRunIds: activeRuns.map((run) => run.id),
      concurrentRuns: activeRuns.length,
    },
  })
}

function toUserSubscription(record: typeof userSubscriptions.$inferSelect): UserSubscription {
  return userSubscriptionSchema.parse({
    id: record.id,
    userId: record.userId,
    planId: record.planId,
    planVersion: record.planVersion,
    status: record.status,
    billingInterval: record.billingInterval,
    includedCredits: record.includedCredits,
    remainingCredits: record.remainingCredits,
    priceCents: record.priceCents,
    currency: record.currency,
    stripeCustomerId: record.stripeCustomerId,
    stripePriceId: record.stripePriceId,
    stripeSubscriptionId: record.stripeSubscriptionId,
    stripeCheckoutSessionId: record.stripeCheckoutSessionId,
    currentPeriodStart: record.currentPeriodStart?.toISOString() ?? null,
    currentPeriodEnd: record.currentPeriodEnd?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  })
}

function getReserveIdempotencyKey(chargeKey: string) {
  return `${chargeKey}:reserve:${RUNTIME_PLAN_VERSION}`
}

function getCommitIdempotencyKey(chargeKey: string) {
  return `${chargeKey}:commit:${RUNTIME_PLAN_VERSION}`
}

function getRefundIdempotencyKey(chargeKey: string) {
  return `${chargeKey}:refund:${RUNTIME_PLAN_VERSION}`
}

function getTopUpGrantIdempotencyKey(sessionId: string) {
  return `topup:${sessionId}`
}

let dbClient: DbClient | null = null

function getDb() {
  dbClient ??= createDb()
  return dbClient
}

function toLockedSubscriptionRow(row: Record<string, unknown> | undefined) {
  if (!row) {
    return null
  }

  return {
    id: String(row.id),
    planVersion: String(row.plan_version ?? RUNTIME_PLAN_VERSION),
    remainingCredits: Number(row.remaining_credits ?? 0),
  }
}

function parseTopUpAllocations(metadataJson: Record<string, unknown>) {
  const rawAllocations = metadataJson.topUpAllocations

  if (!Array.isArray(rawAllocations)) {
    return [] as TopUpAllocation[]
  }

  return rawAllocations
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null
      }

      const allocation = entry as { credits?: unknown; topUpId?: unknown }
      if (typeof allocation.topUpId !== 'string' || typeof allocation.credits !== 'number') {
        return null
      }

      return {
        credits: allocation.credits,
        topUpId: allocation.topUpId,
      } satisfies TopUpAllocation
    })
    .filter((entry): entry is TopUpAllocation => entry !== null)
}

function isMissingTopUpTableError(error: unknown) {
  const candidate = error as {
    cause?: { code?: string; message?: string }
    code?: string
    message?: string
  }
  const message = candidate?.message ?? candidate?.cause?.message ?? ''

  return (
    candidate?.code === '42P01' ||
    candidate?.cause?.code === '42P01' ||
    /relation "subscription_credit_top_ups" does not exist/i.test(message)
  )
}

export class SubscriptionService {
  constructor(private readonly db: DbClient = getDb()) {}

  listPlans(): SubscriptionPlan[] {
    return listSubscriptionPlans().map((plan) => subscriptionPlanSchema.parse(plan))
  }

  listTopUpPacks() {
    return listCreditTopUpPacks()
  }

  private async expireStaleTopUpCreditsInDb(db: MutationDb, userId: string) {
    try {
      const now = new Date()
      const expiredRows = await db
        .select()
        .from(subscriptionCreditTopUps)
        .where(
          and(
            eq(subscriptionCreditTopUps.userId, userId),
            gt(subscriptionCreditTopUps.creditsRemaining, 0),
            lte(subscriptionCreditTopUps.expiresAt, now),
          ),
        )
        .orderBy(asc(subscriptionCreditTopUps.expiresAt), asc(subscriptionCreditTopUps.createdAt))

      if (expiredRows.length === 0) {
        return 0
      }

      const [subscriptionRecord] = await db
        .select()
        .from(userSubscriptions)
        .where(eq(userSubscriptions.userId, userId))
        .limit(1)

      const nextBalance = Math.max(
        0,
        (subscriptionRecord?.remainingCredits ?? 0) -
          expiredRows.reduce((total, row) => total + row.creditsRemaining, 0),
      )

      if (subscriptionRecord) {
        await db
          .update(userSubscriptions)
          .set({
            remainingCredits: nextBalance,
            updatedAt: now,
          })
          .where(eq(userSubscriptions.id, subscriptionRecord.id))
      }

      for (const row of expiredRows) {
        await db
          .update(subscriptionCreditTopUps)
          .set({
            creditsRemaining: 0,
            consumedAt: row.consumedAt ?? now,
            updatedAt: now,
          })
          .where(eq(subscriptionCreditTopUps.id, row.id))

        await db.insert(creditLedger).values({
          id: crypto.randomUUID(),
          userId,
          subscriptionId: row.subscriptionId,
          orderId: null,
          runId: null,
          eventType: 'expire',
          unitType: 'launch_credit',
          deltaCredits: -row.creditsRemaining,
          resultingBalance: subscriptionRecord ? nextBalance : null,
          status: 'committed',
          reasonCode: 'top_up_expired',
          idempotencyKey: `topup-expire:${row.id}`,
          metadataJson: {
            expiresAt: row.expiresAt.toISOString(),
            packId: row.packId,
            stripeCheckoutSessionId: row.stripeCheckoutSessionId,
          },
        })
      }

      return expiredRows.length
    } catch (error) {
      if (isMissingTopUpTableError(error)) {
        return 0
      }

      throw error
    }
  }

  private async sumActiveTopUpCredits(db: MutationDb, userId: string) {
    try {
      const [row] = await db
        .select({
          total: sql<number>`coalesce(sum(${subscriptionCreditTopUps.creditsRemaining}), 0)`,
        })
        .from(subscriptionCreditTopUps)
        .where(
          and(
            eq(subscriptionCreditTopUps.userId, userId),
            gt(subscriptionCreditTopUps.creditsRemaining, 0),
            gt(subscriptionCreditTopUps.expiresAt, new Date()),
          ),
        )

      return Number(row?.total ?? 0)
    } catch (error) {
      if (isMissingTopUpTableError(error)) {
        return 0
      }

      throw error
    }
  }

  private async expireStaleTopUpCredits(userId: string) {
    return this.db.transaction((tx) => this.expireStaleTopUpCreditsInDb(tx, userId))
  }

  private async allocateTopUpCredits(db: MutationDb, userId: string, credits: number) {
    if (credits <= 0) {
      return [] as TopUpAllocation[]
    }

    let rows: Array<typeof subscriptionCreditTopUps.$inferSelect> = []
    try {
      rows = await db
        .select()
        .from(subscriptionCreditTopUps)
        .where(
          and(
            eq(subscriptionCreditTopUps.userId, userId),
            gt(subscriptionCreditTopUps.creditsRemaining, 0),
            gt(subscriptionCreditTopUps.expiresAt, new Date()),
          ),
        )
        .orderBy(asc(subscriptionCreditTopUps.expiresAt), asc(subscriptionCreditTopUps.createdAt))
    } catch (error) {
      if (isMissingTopUpTableError(error)) {
        return [] as TopUpAllocation[]
      }

      throw error
    }

    const allocations: TopUpAllocation[] = []
    let remainingToAllocate = credits
    const now = new Date()

    for (const row of rows) {
      if (remainingToAllocate <= 0) {
        break
      }

      const allocatedCredits = Math.min(row.creditsRemaining, remainingToAllocate)
      const nextRemaining = row.creditsRemaining - allocatedCredits
      allocations.push({
        credits: allocatedCredits,
        topUpId: row.id,
      })

      await db
        .update(subscriptionCreditTopUps)
        .set({
          creditsRemaining: nextRemaining,
          consumedAt: nextRemaining === 0 ? now : row.consumedAt,
          updatedAt: now,
        })
        .where(eq(subscriptionCreditTopUps.id, row.id))

      remainingToAllocate -= allocatedCredits
    }

    return allocations
  }

  async createBillingPortalSession(input: {
    origin: string
    returnPath: string
    userId: string
  }): Promise<{ portalUrl: string }> {
    const subscription = await this.getCurrentSubscription(input.userId)

    if (!subscription?.stripeCustomerId) {
      throw new HttpError(409, 'No Stripe customer found for this account.')
    }

    const stripe = getStripeCheckoutClient()
    const appUrl = getCheckoutBaseUrl(input.origin)
    const returnUrl = `${appUrl}${normalizeReturnPath(input.returnPath)}`

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: returnUrl,
    })

    return { portalUrl: session.url }
  }

  async createCheckoutSession(input: {
    origin: string
    planId: string
    returnPath: string
    userEmail?: string | null
    userId: string
  }): Promise<SubscriptionCheckoutSession> {
    const plan = requireSubscriptionPlan(input.planId)

    if (plan.id === 'free' || !plan.runtimeAccess) {
      throw new HttpError(400, 'Free does not require checkout.')
    }

    const stripe = getStripeCheckoutClient()
    const appUrl = getCheckoutBaseUrl(input.origin)
    const returnPath = normalizeReturnPath(input.returnPath)
    const separator = returnPath.includes('?') ? '&' : '?'
    const session = await stripe.checkout.sessions.create({
      cancel_url: `${appUrl}${returnPath}`,
      customer_email: input.userEmail ?? undefined,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              description: buildSessionPriceDescription(plan),
              metadata: {
                planId: plan.id,
              },
              name: `${plan.name} runtime plan`,
            },
            ...(plan.billingInterval === 'month'
              ? {
                  recurring: {
                    interval: 'month' as const,
                  },
                }
              : {}),
            unit_amount: plan.priceCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        checkoutKind: 'runtime_plan',
        planId: plan.id,
        returnPath,
        userId: input.userId,
      },
      mode: plan.billingInterval === 'month' ? 'subscription' : 'payment',
      success_url: `${appUrl}${returnPath}${separator}subscription_session_id={CHECKOUT_SESSION_ID}`,
    })

    if (!session.url) {
      throw new HttpError(502, 'Stripe did not return a checkout URL.')
    }

    return {
      sessionId: session.id,
      sessionUrl: session.url,
    }
  }

  async createTopUpCheckoutSession(input: {
    origin: string
    returnPath: string
    topUpPackId: string
    userEmail?: string | null
    userId: string
  }): Promise<SubscriptionCheckoutSession> {
    await this.expireStaleTopUpCredits(input.userId)

    const subscription = await this.getCurrentSubscription(input.userId)

    if (!subscription || !planConsumesLaunchCredits(subscription.planId)) {
      throw new HttpError(409, 'Top-up credits are available only on Run and Warm Standby.')
    }

    const pack = requireCreditTopUpPack(input.topUpPackId)
    const stripe = getStripeCheckoutClient()
    const appUrl = getCheckoutBaseUrl(input.origin)
    const returnPath = normalizeReturnPath(input.returnPath)
    const separator = returnPath.includes('?') ? '&' : '?'
    const session = await stripe.checkout.sessions.create({
      cancel_url: `${appUrl}${returnPath}`,
      customer_email: input.userEmail ?? undefined,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              description: buildTopUpPriceDescription(pack),
              metadata: {
                topUpPackId: pack.id,
              },
              name: `${pack.name} credit top-up`,
            },
            unit_amount: pack.priceCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        checkoutKind: 'runtime_top_up',
        returnPath,
        topUpPackId: pack.id,
        userId: input.userId,
      },
      mode: 'payment',
      success_url: `${appUrl}${returnPath}${separator}top_up_session_id={CHECKOUT_SESSION_ID}`,
    })

    if (!session.url) {
      throw new HttpError(502, 'Stripe did not return a checkout URL.')
    }

    return {
      sessionId: session.id,
      sessionUrl: session.url,
    }
  }

  async getCurrentSubscription(userId: string) {
    await this.expireStaleTopUpCredits(userId)
    const [record] = await this.db
      .select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.userId, userId))
      .limit(1)

    return record ? toUserSubscription(record) : null
  }

  async reconcileCheckoutSession(input: {
    sessionId: string
    userId: string
  }) {
    const stripe = getStripeCheckoutClient()
    const session = await stripe.checkout.sessions.retrieve(input.sessionId)

    if (session.metadata?.checkoutKind === 'runtime_top_up') {
      return this.applyCompletedTopUpCheckoutSession({
        session,
        stripe,
        userId: input.userId,
      })
    }

    return this.applyCompletedCheckoutSession({
      session,
      stripe,
      userId: input.userId,
    })
  }

  async handleStripeCheckoutCompletedSession(input: {
    session: Stripe.Checkout.Session
    userId: string
  }) {
    if (input.session.metadata?.checkoutKind === 'runtime_top_up') {
      return this.applyCompletedTopUpCheckoutSession({
        session: input.session,
        stripe: getStripeCheckoutClient(),
        userId: input.userId,
      })
    }

    return this.applyCompletedCheckoutSession({
      session: input.session,
      stripe: getStripeCheckoutClient(),
      userId: input.userId,
    })
  }

  async getLaunchPolicy(userId: string, order: Order): Promise<LaunchPolicyCheck> {
    await this.expireStaleTopUpCredits(userId)
    const subscription = await this.getCurrentSubscription(userId)
    const plan = subscription ? getSubscriptionPlan(subscription.planId) : getFreeSubscriptionPlan()
    const runRows = await this.db
      .select({
        id: runs.id,
        orderId: runs.orderId,
        persistenceMode: runtimeInstances.persistenceMode,
        preservedStateAvailable: runtimeInstances.preservedStateAvailable,
        runtimeState: runtimeInstances.state,
        status: runs.status,
        usesRealWorkspace: runs.usesRealWorkspace,
        workspaceReleasedAt: runUsage.workspaceReleasedAt,
      })
      .from(runs)
      .leftJoin(runUsage, eq(runUsage.runId, runs.id))
      .leftJoin(runtimeInstances, eq(runtimeInstances.runId, runs.id))
      .where(eq(runs.userId, userId))
    return buildLaunchPolicyCheck({
      order,
      plan,
      runRows: runRows.map((run) => ({
        ...run,
        persistenceMode: run.persistenceMode ?? null,
        preservedStateAvailable: run.preservedStateAvailable ?? null,
        runtimeState: run.runtimeState ?? null,
        workspaceReleasedAt: run.workspaceReleasedAt?.toISOString() ?? null,
      })),
      subscription,
    })
  }

  async reserveLaunchCredit(input: {
    chargeKey?: string
    orderId: string
    plan: SubscriptionPlan
    runId: string
    subscriptionId: string | null
    userId: string
  }) {
    if (!planConsumesLaunchCredits(input.plan.id)) {
      return null
    }

    const chargeKey = input.chargeKey ?? input.runId
    const idempotencyKey = getReserveIdempotencyKey(chargeKey)

    return this.db.transaction(async (tx) => {
      await this.expireStaleTopUpCreditsInDb(tx, input.userId)

      const existingRows = await tx
        .select()
        .from(creditLedger)
        .where(eq(creditLedger.idempotencyKey, idempotencyKey))
        .limit(1)

      const existing = existingRows[0]

      if (existing) {
        return {
          alreadyReserved: true,
          subscriptionId: existing.subscriptionId,
        }
      }

      const locked = await tx.execute(sql`
        select *
        from user_subscriptions
        where id = ${input.subscriptionId}
        for update
      `)

      const subscription = toLockedSubscriptionRow(locked.rows[0] as Record<string, unknown> | undefined)

      if (!subscription) {
        throw new HttpError(409, 'An active runtime subscription is required before launch.')
      }

      if (subscription.remainingCredits <= 0) {
        throw new HttpError(409, 'No credits remaining on the current subscription.')
      }

      const nextBalance = subscription.remainingCredits - 1
      const topUpAllocations = await this.allocateTopUpCredits(tx, input.userId, 1)

      const [updatedSubscription] = await tx
        .update(userSubscriptions)
        .set({
          remainingCredits: nextBalance,
          updatedAt: new Date(),
        })
        .where(eq(userSubscriptions.id, subscription.id))
        .returning()

      await tx.insert(creditLedger).values({
        id: crypto.randomUUID(),
        userId: input.userId,
        subscriptionId: subscription.id,
        orderId: input.orderId,
        runId: null,
        eventType: 'reserve',
        unitType: getPlanLedgerUnitType(input.plan.id),
        deltaCredits: -1,
        resultingBalance: nextBalance,
        status: 'pending',
        reasonCode: input.plan.id === 'warm_standby' ? 'wake_requested' : 'launch_requested',
        idempotencyKey,
        metadataJson: {
          planId: input.plan.id,
          planVersion: subscription.planVersion,
          topUpAllocations,
        },
      })

      return {
        alreadyReserved: false,
        subscriptionId: updatedSubscription.id,
      }
    })
  }

  async commitReservedLaunchCredit(input: {
    chargeKey?: string
    plan: SubscriptionPlan
    runId: string
    userId: string
  }) {
    if (!planConsumesLaunchCredits(input.plan.id)) {
      return null
    }

    return this.db.transaction(async (tx) => {
      const chargeKey = input.chargeKey ?? input.runId
      const reserveRows = await tx
        .select()
        .from(creditLedger)
        .where(eq(creditLedger.idempotencyKey, getReserveIdempotencyKey(chargeKey)))
        .limit(1)

      const reserve = reserveRows[0]

      if (!reserve) {
        return null
      }

      if (reserve.status === 'reversed') {
        return null
      }

      await tx
        .update(creditLedger)
        .set({
          status: 'committed',
        })
        .where(eq(creditLedger.id, reserve.id))

      const existingCommitRows = await tx
        .select()
        .from(creditLedger)
        .where(eq(creditLedger.idempotencyKey, getCommitIdempotencyKey(chargeKey)))
        .limit(1)

      if (existingCommitRows[0]) {
        return null
      }

      await tx.insert(creditLedger).values({
        id: crypto.randomUUID(),
        userId: input.userId,
        subscriptionId: reserve.subscriptionId,
        orderId: reserve.orderId,
        runId: input.runId,
        eventType: 'commit',
        unitType: reserve.unitType,
        deltaCredits: 0,
        resultingBalance: reserve.resultingBalance,
        status: 'committed',
        reasonCode: 'provider_accepted',
        idempotencyKey: getCommitIdempotencyKey(chargeKey),
        metadataJson: {
          chargeKey,
          reserveLedgerId: reserve.id,
          planId: input.plan.id,
        },
      })

      return null
    })
  }

  async refundReservedLaunchCredit(input: {
    chargeKey?: string
    plan: SubscriptionPlan
    reasonCode: string
    runId: string
    userId: string
  }) {
    if (!planConsumesLaunchCredits(input.plan.id)) {
      return null
    }

    const chargeKey = input.chargeKey ?? input.runId
    const refundIdempotencyKey = getRefundIdempotencyKey(chargeKey)

    return this.db.transaction(async (tx) => {
      const existingRefundRows = await tx
        .select()
        .from(creditLedger)
        .where(eq(creditLedger.idempotencyKey, refundIdempotencyKey))
        .limit(1)

      if (existingRefundRows[0]) {
        return null
      }

      const reserveRows = await tx
        .select()
        .from(creditLedger)
        .where(eq(creditLedger.idempotencyKey, getReserveIdempotencyKey(chargeKey)))
        .limit(1)

      const reserve = reserveRows[0]

      if (!reserve || reserve.status === 'reversed') {
        return null
      }

      const [runRow] = await tx.select({ id: runs.id }).from(runs).where(eq(runs.id, input.runId)).limit(1)

      const locked = await tx.execute(sql`
        select *
        from user_subscriptions
        where id = ${reserve.subscriptionId}
        for update
      `)

      const subscription = toLockedSubscriptionRow(locked.rows[0] as Record<string, unknown> | undefined)

      if (!subscription) {
        return null
      }

      const nextBalance = subscription.remainingCredits + 1
      const topUpAllocations = parseTopUpAllocations(reserve.metadataJson)

      await tx
        .update(userSubscriptions)
        .set({
          remainingCredits: nextBalance,
          updatedAt: new Date(),
        })
        .where(eq(userSubscriptions.id, subscription.id))

      for (const allocation of topUpAllocations) {
        const [topUpRow] = await tx
          .select()
          .from(subscriptionCreditTopUps)
          .where(eq(subscriptionCreditTopUps.id, allocation.topUpId))
          .limit(1)

        if (!topUpRow) {
          continue
        }

        const restoredRemaining = topUpRow.creditsRemaining + allocation.credits
        await tx
          .update(subscriptionCreditTopUps)
          .set({
            creditsRemaining: restoredRemaining,
            consumedAt: null,
            updatedAt: new Date(),
          })
          .where(eq(subscriptionCreditTopUps.id, allocation.topUpId))
      }

      await tx
        .update(creditLedger)
        .set({
          status: 'reversed',
        })
        .where(eq(creditLedger.id, reserve.id))

      await tx.insert(creditLedger).values({
        id: crypto.randomUUID(),
        userId: input.userId,
        subscriptionId: subscription.id,
        orderId: reserve.orderId,
        runId: runRow ? input.runId : null,
        eventType: 'refund',
        unitType: reserve.unitType,
        deltaCredits: 1,
        resultingBalance: nextBalance,
        status: 'committed',
        reasonCode: input.reasonCode,
        idempotencyKey: refundIdempotencyKey,
        metadataJson: {
          chargeKey,
          reserveLedgerId: reserve.id,
          planId: input.plan.id,
        },
      })

      return null
    })
  }

  private async applyCompletedCheckoutSession(input: {
    session: Stripe.Checkout.Session
    stripe: Stripe
    userId: string
  }) {
    const { session } = input

    if (session.metadata?.checkoutKind !== 'runtime_plan') {
      throw new HttpError(400, 'Checkout session is not a runtime plan purchase.')
    }

    assertCompletedRuntimePlanSession(session)

    const metadataUserId = session.metadata?.userId?.trim() || null

    if (metadataUserId && metadataUserId !== input.userId) {
      throw new HttpError(403, 'Checkout session belongs to another user.')
    }

    const planId = session.metadata?.planId?.trim()

    if (!planId) {
      throw new HttpError(400, 'Checkout session missing plan reference.')
    }

    const plan = requireSubscriptionPlan(planId)
    const existing = await this.getCurrentSubscription(metadataUserId || input.userId)

    if (existing?.stripeCheckoutSessionId === session.id) {
      return existing
    }

    const now = new Date()
    const period = await getStripePeriodBounds(input.stripe, session)
    const activeTopUpCredits = await this.sumActiveTopUpCredits(this.db, metadataUserId || input.userId)
    const nextBalance = plan.includedCredits + activeTopUpCredits
    const previousBalance = existing?.remainingCredits ?? 0
    const subscriptionId = existing?.id ?? crypto.randomUUID()
    const persistedUserId = metadataUserId || input.userId

    const nextValues = {
      billingInterval: plan.billingInterval,
      currency: 'USD',
      currentPeriodEnd: period.currentPeriodEnd,
      currentPeriodStart: period.currentPeriodStart,
      includedCredits: plan.includedCredits,
      planId: plan.id,
      planVersion: RUNTIME_PLAN_VERSION,
      priceCents: plan.priceCents,
      remainingCredits: nextBalance,
      status: 'active' as const,
      stripeCheckoutSessionId: session.id,
      stripeCustomerId: typeof session.customer === 'string' ? session.customer : existing?.stripeCustomerId ?? null,
      stripePriceId: existing?.stripePriceId ?? null,
      stripeSubscriptionId: period.stripeSubscriptionId ?? existing?.stripeSubscriptionId ?? null,
      updatedAt: now,
      userId: persistedUserId,
    }

    let record: typeof userSubscriptions.$inferSelect

    if (existing) {
      ;[record] = await this.db
        .update(userSubscriptions)
        .set(nextValues)
        .where(eq(userSubscriptions.id, existing.id))
        .returning()
    } else {
      ;[record] = await this.db
        .insert(userSubscriptions)
        .values({
          id: subscriptionId,
          ...nextValues,
        })
        .returning()
    }

    await this.db.insert(creditLedger).values({
      id: crypto.randomUUID(),
      eventType: existing ? 'reset' : 'grant',
      unitType: getPlanLedgerUnitType(plan.id),
      deltaCredits: nextBalance - previousBalance,
      metadataJson: {
        checkoutSessionId: session.id,
        planId: plan.id,
        planVersion: RUNTIME_PLAN_VERSION,
        previousPlanId: existing?.planId ?? null,
      },
      orderId: null,
      resultingBalance: nextBalance,
      reasonCode: existing ? 'subscription_update' : 'subscription_purchase',
      runId: null,
      status: 'committed',
      idempotencyKey: `subscription:${session.id}`,
      subscriptionId: record.id,
      userId: persistedUserId,
    })

    return toUserSubscription(record)
  }

  private async applyCompletedTopUpCheckoutSession(input: {
    session: Stripe.Checkout.Session
    stripe: Stripe
    userId: string
  }) {
    const { session } = input

    if (session.metadata?.checkoutKind !== 'runtime_top_up') {
      throw new HttpError(400, 'Checkout session is not a runtime top-up purchase.')
    }

    assertCompletedTopUpSession(session)

    const metadataUserId = session.metadata?.userId?.trim() || null

    if (metadataUserId && metadataUserId !== input.userId) {
      throw new HttpError(403, 'Checkout session belongs to another user.')
    }

    const topUpPackId = session.metadata?.topUpPackId?.trim()

    if (!topUpPackId) {
      throw new HttpError(400, 'Checkout session missing top-up pack reference.')
    }

    const pack = requireCreditTopUpPack(topUpPackId)
    const persistedUserId = metadataUserId || input.userId

    return this.db.transaction(async (tx) => {
      await this.expireStaleTopUpCreditsInDb(tx, persistedUserId)

      const lockedSubscription = await tx.execute(sql`
        select *
        from user_subscriptions
        where user_id = ${persistedUserId}
        for update
      `)
      const subscriptionRow = lockedSubscription.rows[0] as Record<string, unknown> | undefined

      if (!subscriptionRow) {
        throw new HttpError(409, 'Top-up credits are available only on Run and Warm Standby.')
      }

      const subscriptionId = String(subscriptionRow.id)
      const subscriptionPlanId = String(subscriptionRow.plan_id) as UserSubscription['planId']
      const subscriptionRemainingCredits = Number(subscriptionRow.remaining_credits ?? 0)

      if (!planConsumesLaunchCredits(subscriptionPlanId)) {
        throw new HttpError(409, 'Top-up credits are available only on Run and Warm Standby.')
      }

      const now = new Date()
      const expiresAt = getCreditTopUpExpiresAt(now)
      const [createdTopUp] = await tx
        .insert(subscriptionCreditTopUps)
        .values({
          id: crypto.randomUUID(),
          userId: persistedUserId,
          subscriptionId,
          packId: pack.id,
          creditsTotal: pack.credits,
          creditsRemaining: pack.credits,
          priceCents: pack.priceCents,
          currency: 'USD',
          stripeCheckoutSessionId: session.id,
          expiresAt,
          consumedAt: null,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing({
          target: subscriptionCreditTopUps.stripeCheckoutSessionId,
        })
        .returning()

      if (!createdTopUp) {
        const [existingSubscription] = await tx
          .select()
          .from(userSubscriptions)
          .where(eq(userSubscriptions.userId, persistedUserId))
          .limit(1)

        if (!existingSubscription) {
          throw new HttpError(409, 'An active runtime subscription is required before buying extra credits.')
        }

        return toUserSubscription(existingSubscription)
      }

      const nextBalance = subscriptionRemainingCredits + pack.credits

      const [updatedSubscription] = await tx
        .update(userSubscriptions)
        .set({
          remainingCredits: nextBalance,
          updatedAt: now,
        })
        .where(eq(userSubscriptions.id, subscriptionId))
        .returning()

      await tx
        .insert(creditLedger)
        .values({
          id: crypto.randomUUID(),
          userId: persistedUserId,
          subscriptionId,
          orderId: null,
          runId: null,
          eventType: 'grant',
          unitType: getPlanLedgerUnitType(subscriptionPlanId),
          deltaCredits: pack.credits,
          resultingBalance: nextBalance,
          status: 'committed',
          reasonCode: 'top_up_purchase',
          idempotencyKey: getTopUpGrantIdempotencyKey(session.id),
          metadataJson: {
            expiresAt: expiresAt.toISOString(),
            priceCents: pack.priceCents,
            topUpPackId: pack.id,
          },
        })
        .onConflictDoNothing({
          target: creditLedger.idempotencyKey,
        })

      return toUserSubscription(updatedSubscription)
    })
  }

  async syncSubscriptionFromStripe(userId: string) {
    const [record] = await this.db
      .select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.userId, userId))
      .limit(1)

    if (!record?.stripeSubscriptionId) {
      return
    }

    let stripe: Stripe
    try {
      stripe = getStripeCheckoutClient()
    } catch {
      return
    }

    let stripeSubscription: Stripe.Subscription
    try {
      stripeSubscription = await stripe.subscriptions.retrieve(record.stripeSubscriptionId)
    } catch {
      return
    }

    const stripeStatus = stripeSubscription.status

    if (stripeStatus === 'canceled' || stripeStatus === 'incomplete_expired') {
      await this.handleStripeSubscriptionDeleted(stripeSubscription)
      return
    }

    const mappedStatus: 'active' | 'canceled' | 'past_due' =
      stripeSubscription.cancel_at_period_end ? 'canceled'
        : stripeStatus === 'past_due' ? 'past_due'
        : 'active'

    const periodEnd = getStripeSubscriptionCurrentPeriodEnd(stripeSubscription)

    if (record.status === mappedStatus && (!periodEnd || record.currentPeriodEnd?.getTime() === periodEnd.getTime())) {
      return
    }

    await this.db
      .update(userSubscriptions)
      .set({
        status: mappedStatus,
        ...(periodEnd ? { currentPeriodEnd: periodEnd } : {}),
        updatedAt: new Date(),
      })
      .where(eq(userSubscriptions.id, record.id))
  }

  async handleStripeSubscriptionDeleted(subscription: Stripe.Subscription) {
    const [row] = await this.db
      .select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.stripeSubscriptionId, subscription.id))
      .limit(1)

    if (!row) {
      return
    }

    const now = new Date()
    const previousCredits = row.remainingCredits

    await this.db
      .update(userSubscriptions)
      .set({
        status: 'canceled',
        remainingCredits: 0,
        currentPeriodEnd: getStripeSubscriptionCurrentPeriodEnd(subscription) ?? row.currentPeriodEnd,
        stripeSubscriptionId: null,
        updatedAt: now,
      })
      .where(eq(userSubscriptions.id, row.id))

    if (previousCredits > 0) {
      await this.db.insert(creditLedger).values({
        id: crypto.randomUUID(),
        userId: row.userId,
        subscriptionId: row.id,
        orderId: null,
        runId: null,
        eventType: 'reset',
        unitType: getPlanLedgerUnitType(row.planId as SubscriptionPlan['id']),
        deltaCredits: -previousCredits,
        resultingBalance: 0,
        status: 'committed',
        reasonCode: 'subscription_canceled',
        idempotencyKey: `sub-canceled:${subscription.id}`,
        metadataJson: {
          stripeSubscriptionId: subscription.id,
          previousCredits,
        },
      })
    }
  }
}

let subscriptionServiceOverride: SubscriptionServiceLike | null = null

export function getSubscriptionService() {
  return subscriptionServiceOverride ?? new SubscriptionService()
}

export type SubscriptionServiceLike = Pick<
  SubscriptionService,
  | 'createBillingPortalSession'
  | 'createCheckoutSession'
  | 'createTopUpCheckoutSession'
  | 'commitReservedLaunchCredit'
  | 'refundReservedLaunchCredit'
  | 'getCurrentSubscription'
  | 'getLaunchPolicy'
  | 'handleStripeCheckoutCompletedSession'
  | 'handleStripeSubscriptionDeleted'
  | 'listPlans'
  | 'listTopUpPacks'
  | 'reserveLaunchCredit'
  | 'reconcileCheckoutSession'
  | 'syncSubscriptionFromStripe'
>

export function setSubscriptionServiceForTesting(service: SubscriptionServiceLike | null) {
  subscriptionServiceOverride = service
}
