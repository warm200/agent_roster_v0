'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RiskBadge } from '@/components/risk-badge'
import { BundleRiskSummary } from '@/components/bundle-risk-summary'
import { TelegramSetupWizard } from '@/components/telegram-setup-wizard'
import { mockOrders, mockRuns, formatPrice } from '@/lib/mock-data'
import { formatDate, formatDateTime } from '@/lib/utils'
import { toast } from 'sonner'
import { 
  ChevronLeft, 
  Package, 
  Play, 
  Download, 
  Send, 
  CheckCircle2,
  AlertTriangle,
  FileText,
  ExternalLink
} from 'lucide-react'

interface PageProps {
  params: Promise<{ orderId: string }>
}

export default function BundleDetailPage({ params }: PageProps) {
  const { orderId } = use(params)
  const [telegramSetup, setTelegramSetup] = useState(false)
  
  // In real implementation, this would fetch from API
  // For demo, show mock data or a new demo order
  const order = mockOrders.find((o) => o.id === orderId) || {
    ...mockOrders[0],
    id: orderId,
    channelConfig: null,
  }

  const orderRuns = mockRuns.filter((r) => r.orderId === order.id)
  const hasTelegramSetup =
    telegramSetup ||
    (
      order.channelConfig?.tokenStatus === 'validated' &&
      order.channelConfig?.recipientBindingStatus === 'paired'
    )
  
  const canLaunchRun = order.status === 'paid' && hasTelegramSetup

  const handleLaunchRun = () => {
    toast.success('Run launch request accepted. Run history uses mock data in this prototype.')
    // In real implementation, this would create a run via API
  }

  const handleDownload = (agentTitle: string) => {
    toast.success(`Downloading ${agentTitle} package...`)
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
          disabled={!canLaunchRun}
          onClick={handleLaunchRun}
        >
          <Play className="w-4 h-4 mr-2" />
          Launch Run
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
            onComplete={() => setTelegramSetup(true)}
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
                    <Button 
                      variant="outline" 
                      onClick={() => handleDownload(item.agent.title)}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
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
                  <Button onClick={handleLaunchRun}>
                    <Play className="w-4 h-4 mr-2" />
                    Launch First Run
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
