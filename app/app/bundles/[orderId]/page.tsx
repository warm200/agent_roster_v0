'use client'

import { use, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { RiskBadge } from '@/components/risk-badge'
import { BundleRiskSummary } from '@/components/bundle-risk-summary'
import { AgentSetupCard } from '@/components/agent-setup-card'
import { TelegramSetupWizard } from '@/components/telegram-setup-wizard'
import { formatPrice } from '@/lib/mock-data'
import type { AgentSetup, Order, Run } from '@/lib/types'
import { formatDate, formatDateTime } from '@/lib/utils'
import { createOrderRun, getOrder, getOrderDownloads } from '@/services/orders.api'
import { listRuns } from '@/services/runs.api'
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

export default function BundleDetailPage({ params }: PageProps) {
  const { orderId } = use(params)
  const router = useRouter()
  const [order, setOrder] = useState<Order | null>(null)
  const [orderRuns, setOrderRuns] = useState<Run[]>([])
  const [downloads, setDownloads] = useState<Array<{
    orderItemId: string
    downloadUrl: string
    expiresAt: string
  }>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [telegramSetup, setTelegramSetup] = useState(false)
  const [isLaunching, setIsLaunching] = useState(false)

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

  useEffect(() => {
    let isMounted = true

    async function loadOrder() {
      setIsLoading(true)

      try {
        const orderPayload = await getOrder(orderId)

        if (isMounted) {
          setOrder(orderPayload)
        }

        const [runsResult, downloadsResult] = await Promise.allSettled([
          listRuns({ orderId }),
          getOrderDownloads(orderId),
        ])

        if (!isMounted) {
          return
        }

        setOrderRuns(runsResult.status === 'fulfilled' ? runsResult.value.runs : [])
        setDownloads(downloadsResult.status === 'fulfilled' ? downloadsResult.value.downloads : [])
      } catch {
        if (isMounted) {
          setOrder(null)
          setOrderRuns([])
          setDownloads([])
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
  }, [orderId])

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

  const canLaunchRun = order.status === 'paid' && hasTelegramSetup

  const handleLaunchRun = async () => {
    if (!canLaunchRun || isLaunching) return

    setIsLaunching(true)

    try {
      const payload = await createOrderRun(order.id)
      toast.success('Run requested. Redirecting to run details...')
      router.push(`/app/runs/${payload.id}`)
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

        <Button
          size="lg"
          disabled={!canLaunchRun || isLaunching}
          onClick={handleLaunchRun}
        >
          {isLaunching ? (
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

      {/* Run Requirements Warning */}
      {!canLaunchRun && (
        <Card className="mb-6 border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-400">Complete setup to launch runs</p>
              <p className="text-sm text-muted-foreground mt-1">
                You need to connect Telegram before launching runs. This enables notifications and result delivery.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="agents" className="space-y-6">
        <TabsList>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="telegram">Telegram Setup</TabsTrigger>
          <TabsTrigger value="downloads">Downloads</TabsTrigger>
          <TabsTrigger value="runs">Run History</TabsTrigger>
        </TabsList>

        {/* Agents Tab */}
        <TabsContent value="agents" className="space-y-6">
          <BundleRiskSummary bundleRisk={order.bundleRisk} />

          <AgentSetupCard
            orderId={order.id}
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
            {order.items.map((item) => (
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
                      </div>
                    </div>
                    <Button variant="outline" asChild>
                      <Link href={downloads.find((download) => download.orderItemId === item.id)?.downloadUrl ?? item.agentVersion.installPackageUrl}>
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
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
                          <RunStatusBadge status={run.status} />
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
                  <Button onClick={handleLaunchRun} disabled={isLaunching}>
                    {isLaunching ? (
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

function RunStatusBadge({ status }: { status: string }) {
  const variants: Record<string, { className: string; label: string }> = {
    provisioning: { className: 'bg-blue-500/15 text-blue-400 border-blue-500/30', label: 'Provisioning' },
    running: { className: 'bg-amber-500/15 text-amber-400 border-amber-500/30', label: 'Running' },
    completed: { className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', label: 'Completed' },
    failed: { className: 'bg-red-500/15 text-red-400 border-red-500/30', label: 'Failed' },
  }

  const variant = variants[status] || variants.failed

  return (
    <span className={`inline-flex items-center px-2 py-1 text-xs font-medium border rounded-full ${variant.className}`}>
      {variant.label}
    </span>
  )
}
