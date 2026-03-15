import type Stripe from 'stripe'
import { eq } from 'drizzle-orm'

import { launchPolicyCheckSchema, subscriptionPlanSchema, userSubscriptionSchema } from '@/lib/schemas'
import { getFreeSubscriptionPlan, getSubscriptionPlan, listSubscriptionPlans } from '@/lib/subscription-plans'
import type { LaunchPolicyCheck, Order, SubscriptionPlan, UserSubscription } from '@/lib/types'

import { createDb, type DbClient } from '../db'
import { creditLedger, runs, userSubscriptions } from '../db/schema'
import { HttpError } from '../lib/http'
import { getStripe } from '../lib/stripe'

type SubscriptionCheckoutSession = {
  sessionId: string
  sessionUrl: string
}

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
  if (plan.billingInterval === 'month') {
    return `${plan.includedCredits} monthly credits, ${plan.concurrentRuns} concurrent runs, ${plan.agentsPerBundle} agents per launched bundle.`
  }

  return `${plan.includedCredits} credits, ${plan.concurrentRuns} concurrent runs, ${plan.agentsPerBundle} agents per launched bundle.`
}

function requireSubscriptionPlan(planId: string) {
  try {
    return getSubscriptionPlan(planId as SubscriptionPlan['id'])
  } catch {
    throw new HttpError(400, `Unknown subscription plan: ${planId}`)
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

export function isCountedActiveRun(run: {
  status: string
  usesRealWorkspace: boolean
}) {
  return (
    run.status === 'provisioning' ||
    run.status === 'running' ||
    (run.usesRealWorkspace && run.status === 'completed')
  )
}

export function buildLaunchPolicyCheck(input: {
  order: Order
  plan: SubscriptionPlan
  runRows: Array<{
    id: string
    orderId: string
    status: string
    usesRealWorkspace: boolean
  }>
  subscription: UserSubscription | null
}) {
  const activeRuns = input.runRows.filter(isCountedActiveRun)
  const activeBundleIds = new Set(activeRuns.map((run) => run.orderId))
  const blockers: string[] = []

  if (!input.plan.runtimeAccess) {
    blockers.push(`${input.plan.name} does not include run launches.`)
  }

  if (input.order.items.length > input.plan.agentsPerBundle) {
    blockers.push(
      `${input.plan.name} allows at most ${input.plan.agentsPerBundle} agent${input.plan.agentsPerBundle === 1 ? '' : 's'} per launched bundle.`,
    )
  }

  if (activeRuns.length >= input.plan.concurrentRuns) {
    blockers.push(
      `${input.plan.name} allows ${input.plan.concurrentRuns} concurrent active run${input.plan.concurrentRuns === 1 ? '' : 's'}.`,
    )
  }

  if (!activeBundleIds.has(input.order.id) && activeBundleIds.size >= input.plan.activeBundles) {
    blockers.push(
      `${input.plan.name} allows ${input.plan.activeBundles} active bundle${input.plan.activeBundles === 1 ? '' : 's'} at a time.`,
    )
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

let dbClient: DbClient | null = null

function getDb() {
  dbClient ??= createDb()
  return dbClient
}

export class SubscriptionService {
  constructor(private readonly db: DbClient = getDb()) {}

  listPlans(): SubscriptionPlan[] {
    return listSubscriptionPlans().map((plan) => subscriptionPlanSchema.parse(plan))
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

  async getCurrentSubscription(userId: string) {
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
    return this.applyCompletedCheckoutSession({
      session: input.session,
      stripe: getStripeCheckoutClient(),
      userId: input.userId,
    })
  }

  async getLaunchPolicy(userId: string, order: Order): Promise<LaunchPolicyCheck> {
    const subscription = await this.getCurrentSubscription(userId)
    const plan = subscription ? getSubscriptionPlan(subscription.planId) : getFreeSubscriptionPlan()
    const runRows = await this.db
      .select({
        id: runs.id,
        orderId: runs.orderId,
        status: runs.status,
        usesRealWorkspace: runs.usesRealWorkspace,
      })
      .from(runs)
      .where(eq(runs.userId, userId))
    return buildLaunchPolicyCheck({
      order,
      plan,
      runRows,
      subscription,
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
    const nextBalance = plan.includedCredits
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
      balanceAfter: nextBalance,
      deltaCredits: nextBalance - previousBalance,
      metadata: {
        checkoutSessionId: session.id,
        planId: plan.id,
        previousPlanId: existing?.planId ?? null,
      },
      reason: existing ? 'subscription_update' : 'subscription_purchase',
      subscriptionId: record.id,
      userId: persistedUserId,
    })

    return toUserSubscription(record)
  }
}

let subscriptionServiceOverride: SubscriptionServiceLike | null = null

export function getSubscriptionService() {
  return subscriptionServiceOverride ?? new SubscriptionService()
}

export type SubscriptionServiceLike = Pick<
  SubscriptionService,
  | 'createCheckoutSession'
  | 'getCurrentSubscription'
  | 'getLaunchPolicy'
  | 'handleStripeCheckoutCompletedSession'
  | 'listPlans'
  | 'reconcileCheckoutSession'
>

export function setSubscriptionServiceForTesting(service: SubscriptionServiceLike | null) {
  subscriptionServiceOverride = service
}
