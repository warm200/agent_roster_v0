'use client'

import { use, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { RunStatusBadge } from '@/components/run-status-badge'
import { RiskBadge } from '@/components/risk-badge'
import { BundleRiskSummary } from '@/components/bundle-risk-summary'
import { CreditTopUpDialog } from '@/components/credit-top-up-dialog'
import { AgentSetupCard } from '@/components/agent-setup-card'
import { PlanUpgradeDialog } from '@/components/plan-upgrade-dialog'
import { TelegramSetupWizard } from '@/components/telegram-setup-wizard'
import { calculateBundleRiskFromVersions } from '@/lib/bundle-risk'
import { formatPrice } from '@/lib/mock-data'
import { formatAgentsPerBundleLabel } from '@/lib/subscription-plans'
import type { AgentSetup, LaunchPolicyCheck, Order, Run } from '@/lib/types'
import { formatDate, formatDateTime } from '@/lib/utils'
import { createOrderRun, getOrder, getOrderDownloads, getOrderLaunchPolicy } from '@/services/orders.api'
import { listRuns } from '@/services/runs.api'
import {
  reconcileCreditTopUpCheckoutSession,
  reconcileSubscriptionCheckoutSession,
} from '@/services/subscription.api'
import { toast } from 'sonner'
import {
  ChevronLeft,
  Package,
  Play,
  Download,
  AlertTriangle,
  FileText,
  ExternalLink
} from 'lucide-react'

interface PageProps {
  params: Promise<{ orderId: string }>
}

function formatPlanTriggerMode(triggerMode: LaunchPolicyCheck['plan']['triggerMode']) {
  switch (triggerMode) {
    case 'manual':
      return 'Manual only'
    case 'auto_wake':
      return 'Wake on Telegram'
    case 'always_active':
      return 'Persistent workspace'
    default:
      return 'No runtime'
  }
}

export default function BundleDetailPage({ params }: PageProps) {
  const { orderId } = use(params)
  const searchParams = useSearchParams()
  const [order, setOrder] = useState<Order | null>(null)
  const [orderRuns, setOrderRuns] = useState<Run[]>([])
  const [downloads, setDownloads] = useState<Array<{
    orderItemId: string
    downloadUrl: string
    expiresAt: string
  }>>([])
  const [launchPolicy, setLaunchPolicy] = useState<LaunchPolicyCheck | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [telegramSetup, setTelegramSetup] = useState(false)
  const [isLaunching, setIsLaunching] = useState(false)
  const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false)
  const [isTopUpDialogOpen, setIsTopUpDialogOpen] = useState(false)
  const [isReconcilingPlan, setIsReconcilingPlan] = useState(false)
  const [isReconcilingTopUp, setIsReconcilingTopUp] = useState(false)
  const reconciledPlanSessionRef = useRef<string | null>(null)
  const reconciledTopUpSessionRef = useRef<string | null>(null)
  const subscriptionSessionId = searchParams.get('subscription_session_id')
  const topUpSessionId = searchParams.get('top_up_session_id')

  const handleChannelConfigChange = useCallback((channelConfig: NonNullable<Order['channelConfig']>) => {
    setOrder((currentOrder) => {
      if (!currentOrder) {
        return currentOrder
      }

      const currentConfig = currentOrder.channelConfig
      const unchanged =
        currentConfig?.id === channelConfig.id &&
        currentConfig?.tokenStatus === channelConfig.tokenStatus &&
        currentConfig?.recipientBindingStatus === channelConfig.recipientBindingStatus &&
        currentConfig?.recipientExternalId === channelConfig.recipientExternalId &&
        currentConfig?.botTokenSecretRef === channelConfig.botTokenSecretRef &&
        currentConfig?.updatedAt === channelConfig.updatedAt

      if (unchanged) {
        return currentOrder
      }

      return {
        ...currentOrder,
        channelConfig,
      }
    })

    setTelegramSetup(channelConfig.recipientBindingStatus === 'paired')
  }, [])

  const handleTelegramComplete = useCallback(() => {
    setTelegramSetup(true)
  }, [])

  const handleAgentSetupSaved = useCallback((agentSetup: AgentSetup) => {
    setOrder((currentOrder) =>
      currentOrder
        ? {
            ...currentOrder,
            agentSetup,
          }
        : currentOrder,
    )
  }, [])

  const refreshBundleData = useCallback(async () => {
    const orderPayload = await getOrder(orderId)
    const [runsResult, downloadsResult, launchPolicyResult] = await Promise.allSettled([
      listRuns({ orderId }),
      getOrderDownloads(orderId),
      getOrderLaunchPolicy(orderId),
    ])

    setOrder(orderPayload)
    setOrderRuns(runsResult.status === 'fulfilled' ? runsResult.value.runs : [])
    setDownloads(downloadsResult.status === 'fulfilled' ? downloadsResult.value.downloads : [])
    setLaunchPolicy(launchPolicyResult.status === 'fulfilled' ? launchPolicyResult.value : null)
  }, [orderId])

  const clearCheckoutParamsInPlace = useCallback((keys: string[]) => {
    if (typeof window === 'undefined') {
      return
    }

    const nextUrl = new URL(window.location.href)
    let mutated = false

    for (const key of keys) {
      if (!nextUrl.searchParams.has(key)) {
        continue
      }
      nextUrl.searchParams.delete(key)
      mutated = true
    }

    if (!mutated) {
      return
    }

    const nextHref = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`
    window.history.replaceState(window.history.state, '', nextHref)
  }, [])

  useEffect(() => {
    let isMounted = true

    async function loadOrder() {
      setIsLoading(true)

      try {
        await refreshBundleData()

        if (!isMounted) {
          return
        }
      } catch {
        if (isMounted) {
          setOrder(null)
          setOrderRuns([])
          setDownloads([])
          setLaunchPolicy(null)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadOrder()

    return () => {
      isMounted = false
    }
  }, [refreshBundleData])

  useEffect(() => {
    if (
      !subscriptionSessionId ||
      isReconcilingPlan ||
      reconciledPlanSessionRef.current === subscriptionSessionId
    ) {
      return
    }

    const sessionId = subscriptionSessionId
    let isMounted = true
    let completed = false

    async function reconcilePlanPurchase() {
      reconciledPlanSessionRef.current = sessionId
      setIsReconcilingPlan(true)

      try {
        await reconcileSubscriptionCheckoutSession(sessionId)
        await refreshBundleData()

        if (!isMounted) {
          return
        }

        window.dispatchEvent(new CustomEvent('subscription-updated'))
        toast.success('Plan updated. Credits are ready.')
        completed = true
        setIsReconcilingPlan(false)
        clearCheckoutParamsInPlace(['subscription_session_id'])
      } catch (error) {
        if (!isMounted) {
          return
        }

        reconciledPlanSessionRef.current = null
        toast.error(error instanceof Error ? error.message : 'Unable to confirm your plan purchase')
      } finally {
        if (isMounted && !completed) {
          setIsReconcilingPlan(false)
        }
      }
    }

    void reconcilePlanPurchase()

    return () => {
      isMounted = false
    }
  }, [clearCheckoutParamsInPlace, isReconcilingPlan, refreshBundleData, subscriptionSessionId])

  useEffect(() => {
    if (!topUpSessionId || isReconcilingTopUp || reconciledTopUpSessionRef.current === topUpSessionId) {
      return
    }

    const sessionId = topUpSessionId
    let isMounted = true
    let completed = false

    async function reconcileTopUpPurchase() {
      reconciledTopUpSessionRef.current = sessionId
      setIsReconcilingTopUp(true)

      try {
        await reconcileCreditTopUpCheckoutSession(sessionId)
        await refreshBundleData()

        if (!isMounted) {
          return
        }

        window.dispatchEvent(new CustomEvent('subscription-updated'))
        toast.success('Credits added. They expire 90 days after purchase.')
        completed = true
        setIsReconcilingTopUp(false)
        clearCheckoutParamsInPlace(['top_up_session_id'])
      } catch (error) {
        if (!isMounted) {
          return
        }

        reconciledTopUpSessionRef.current = null
        toast.error(error instanceof Error ? error.message : 'Unable to confirm your credit top-up')
      } finally {
        if (isMounted && !completed) {
          setIsReconcilingTopUp(false)
        }
      }
    }

    void reconcileTopUpPurchase()

    return () => {
      isMounted = false
    }
  }, [clearCheckoutParamsInPlace, isReconcilingTopUp, refreshBundleData, topUpSessionId])

  if (isLoading) {
    return <BundleDetailSkeleton />
  }

  if (!order) {
    return (
      <div className="p-6 lg:p-8">
        <Link
          href="/app/bundles"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Bundles
        </Link>
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-6">
            <p className="font-medium text-red-400">Bundle not found</p>
            <p className="mt-2 text-sm text-muted-foreground">
              This purchase could not be loaded.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const hasTelegramSetup =
    telegramSetup ||
    (
      order.channelConfig?.tokenStatus === 'validated' &&
      order.channelConfig?.recipientBindingStatus === 'paired'
    )

  const planAllowsLaunch = launchPolicy ? launchPolicy.allowed : true
  const canLaunchRun = order.status === 'paid' && hasTelegramSetup && planAllowsLaunch
  const effectiveDefaultAgentSlug = order.agentSetup?.defaultAgentSlug ?? order.items[0]?.agent.slug ?? null
  const liveBundleRisk = calculateBundleRiskFromVersions(
    order.items.map((item) => ({
      title: item.agent.title,
      version: item.agentVersion,
    })),
  )
  const hasPlanBlockers = Boolean(launchPolicy && launchPolicy.blockers.length > 0)
  const currentCredits = launchPolicy?.subscription?.remainingCredits ?? launchPolicy?.plan.includedCredits ?? 0
  const canTopUpCredits = Boolean(
    launchPolicy?.subscription &&
      (launchPolicy.plan.id === 'run' || launchPolicy.plan.id === 'warm_standby'),
  )
  const stoppedWarmRun = orderRuns.find(
    (run) =>
      run.orderId === order.id &&
      run.persistenceMode === 'recoverable' &&
      run.preservedStateAvailable &&
      (run.runtimeState === 'stopped' || run.runtimeState === 'archived'),
  ) ?? null

  const handleLaunchRun = async () => {
    if (!canLaunchRun || isLaunching || isReconcilingPlan || isReconcilingTopUp) return

    setIsLaunching(true)

    try {
      const payload = await createOrderRun(order.id)
      toast.success('Run requested. Redirecting to run details...')
      window.location.assign(`/app/runs/${payload.id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Network error while launching run')
    } finally {
      setIsLaunching(false)
    }
  }

  return (
    <div className="p-6 lg:p-8">
      <Link
        href="/app/bundles"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to Bundles
      </Link>

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-secondary flex items-center justify-center">
            <Package className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">
                Bundle ({order.items.length} Agent{order.items.length > 1 ? 's' : ''})
              </h1>
              <Badge variant={order.status === 'paid' ? 'default' : 'secondary'}>
                {order.status}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {formatPrice(order.amountCents, order.currency)} - Purchased{' '}
              {formatDate(order.paidAt || order.createdAt)}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            size="lg"
            disabled={!canLaunchRun || isLaunching || isReconcilingPlan || isReconcilingTopUp}
            onClick={handleLaunchRun}
          >
            {isReconcilingPlan ? (
              <>
                <Spinner className="w-4 h-4 mr-2" />
                Updating plan...
              </>
            ) : isReconcilingTopUp ? (
              <>
                <Spinner className="w-4 h-4 mr-2" />
                Updating credits...
              </>
            ) : isLaunching ? (
              <>
                <Spinner className="w-4 h-4 mr-2" />
                Launching...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Launch Run
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Run Requirements Warning */}
      {!canLaunchRun && (
        <Card className="mb-6 border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-400">Launch requirements not met</p>
              <div className="mt-1 space-y-1 text-sm text-muted-foreground">
                {!hasTelegramSetup ? (
                  <p>
                    You need to connect Telegram before launching runs. This enables notifications and result delivery.
                  </p>
                ) : null}
                {launchPolicy?.blockers.map((blocker) => (
                  <p key={blocker}>{blocker}</p>
                ))}
              </div>
            </div>
            </div>
            {hasPlanBlockers ? (
              <div className="flex shrink-0 flex-col gap-2">
                {stoppedWarmRun ? (
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/app/runs/${stoppedWarmRun.id}`}>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Manage Stopped Run
                    </Link>
                  </Button>
                ) : null}
                <Button
                  disabled={isReconcilingPlan}
                  onClick={() => setIsPlanDialogOpen(true)}
                  size="sm"
                >
                  Adjust Plan
                </Button>
                <p className="text-xs text-muted-foreground">
                  {stoppedWarmRun
                    ? 'Resume or terminate the stopped Warm Standby run to launch again from this bundle.'
                    : 'Purchase runtime credits to unlock bundle launches.'}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {launchPolicy ? (
        <Card className="mb-6 border-border/70 bg-card/60">
          <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                Current plan: {launchPolicy.plan.name}
              </p>
              <p className="text-sm text-muted-foreground">
                Credits {currentCredits}
                {' · '}
                Agents per bundle {formatAgentsPerBundleLabel(launchPolicy.plan.agentsPerBundle)}
                {' · '}
                Runtime mode {formatPlanTriggerMode(launchPolicy.plan.triggerMode)}
              </p>
            </div>
            <div className="flex gap-2">
              {canTopUpCredits ? (
                <Button
                  disabled={isReconcilingTopUp}
                  onClick={() => setIsTopUpDialogOpen(true)}
                  size="sm"
                  variant="outline"
                >
                  Top Up
                </Button>
              ) : null}
              <Button
                disabled={isReconcilingPlan}
                onClick={() => setIsPlanDialogOpen(true)}
                size="sm"
                variant="outline"
              >
                {launchPolicy.allowed ? 'View Plans' : 'Upgrade Plan'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Tabs defaultValue="agents" className="space-y-6">
        <TabsList>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="telegram">Telegram Setup</TabsTrigger>
          <TabsTrigger value="downloads">Downloads</TabsTrigger>
          <TabsTrigger value="runs">Run History</TabsTrigger>
        </TabsList>

        {/* Agents Tab */}
        <TabsContent value="agents" className="space-y-6">
          <BundleRiskSummary bundleRisk={liveBundleRisk} />

          <AgentSetupCard
            orderId={order.id}
            availableAgents={order.items.map((item) => ({
              riskLevel: item.agentVersion.riskProfile.riskLevel,
              slug: item.agent.slug,
              summary: item.agent.summary,
              title: item.agent.title,
              version: item.agentVersion.version,
            }))}
            initialSetup={order.agentSetup ?? null}
            onSaved={handleAgentSetupSaved}
          />

          <div className="grid gap-4">
            {order.items.map((item) => (
              <Card key={item.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold">{item.agent.title}</h3>
                        {effectiveDefaultAgentSlug === item.agent.slug ? (
                          <Badge variant="default">Default</Badge>
                        ) : null}
                        <RiskBadge level={item.agentVersion.riskProfile.riskLevel} size="sm" />
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{item.agent.summary}</p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>v{item.agentVersion.version}</span>
                        <span className="capitalize">{item.agent.category}</span>
                        <span>{formatPrice(item.priceCents)}</span>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/agents/${item.agent.slug}`}>
                        <ExternalLink className="w-4 h-4 mr-1" />
                        View
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Telegram Tab */}
        <TabsContent value="telegram">
          <TelegramSetupWizard
            orderId={order.id}
            initialStatus={{
              tokenStatus: order.channelConfig?.tokenStatus || 'pending',
              pairingStatus: order.channelConfig?.recipientBindingStatus || 'pending',
            }}
            onChannelConfigChange={handleChannelConfigChange}
            onComplete={handleTelegramComplete}
          />
        </TabsContent>

        {/* Downloads Tab */}
        <TabsContent value="downloads" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Download install packages to run agents locally. Each package includes configuration and setup instructions.
          </p>

          <div className="grid gap-4">
            {order.items.map((item) => {
              const signedDownload = downloads.find((download) => download.orderItemId === item.id)

              return (
                <Card key={item.id}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-medium">{item.agent.title}</h4>
                          <p className="text-sm text-muted-foreground">
                            v{item.agentVersion.version} - Install Package
                          </p>
                          {!signedDownload ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Secure download link unavailable. Refresh this page to mint a fresh package link.
                            </p>
                          ) : null}
                        </div>
                      </div>
                      {signedDownload ? (
                        <Button variant="outline" asChild>
                          <Link href={signedDownload.downloadUrl}>
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </Link>
                        </Button>
                      ) : (
                        <Button disabled variant="outline">
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        {/* Runs Tab */}
        <TabsContent value="runs" className="space-y-4">
          {orderRuns.length > 0 ? (
            <div className="grid gap-4">
              {orderRuns.map((run) => (
                <Card key={run.id}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h4 className="font-medium">Run {run.id.slice(-4)}</h4>
                          <RunStatusBadge status={run.status} runtimeState={run.runtimeState} />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {formatDateTime(run.createdAt)}
                        </p>
                      </div>
                      <Button variant="outline" asChild>
                        <Link href={`/app/runs/${run.id}`}>View Details</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Play className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="font-medium mb-2">No runs yet</p>
                <p className="text-sm text-muted-foreground mb-4">
                  {canLaunchRun
                    ? 'Launch your first run to see it here.'
                    : 'Complete Telegram setup to launch runs.'}
                </p>
                {canLaunchRun && (
                  <Button onClick={handleLaunchRun} disabled={isLaunching || isReconcilingPlan}>
                    {isReconcilingPlan ? (
                      <>
                        <Spinner className="w-4 h-4 mr-2" />
                        Updating plan...
                      </>
                    ) : isLaunching ? (
                      <>
                        <Spinner className="w-4 h-4 mr-2" />
                        Launching...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Launch First Run
                      </>
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {launchPolicy ? (
        <PlanUpgradeDialog
          currentCredits={currentCredits}
          currentPlanId={launchPolicy.plan.id}
          onOpenChange={setIsPlanDialogOpen}
          open={isPlanDialogOpen}
          returnPath={`/app/bundles/${orderId}`}
        />
      ) : null}
      {launchPolicy ? (
        <CreditTopUpDialog
          currentCredits={currentCredits}
          currentPlanId={launchPolicy.plan.id}
          onOpenChange={setIsTopUpDialogOpen}
          open={isTopUpDialogOpen}
          returnPath={`/app/bundles/${orderId}`}
        />
      ) : null}
    </div>
  )
}

function BundleDetailSkeleton() {
  return (
    <div className="space-y-6 p-6 lg:p-8">
      <Skeleton className="h-5 w-32" />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="h-14 w-14 rounded-xl" />
          <div className="space-y-3">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <Skeleton className="h-10 w-36" />
      </div>
      <Skeleton className="h-10 w-80" />
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  )
}
