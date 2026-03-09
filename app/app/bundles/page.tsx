'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RiskBadge } from '@/components/risk-badge'
import { Badge } from '@/components/ui/badge'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { formatPrice } from '@/lib/mock-data'
import { formatDate } from '@/lib/utils'
import type { Agent, Order } from '@/lib/types'
import { Package, ArrowRight, ShoppingCart, Send, AlertTriangle } from 'lucide-react'

interface BundlesResponse {
  orders: Order[]
  total: number
}

export default function BundlesPage() {
  const [orders, setOrders] = useState<Array<Order & { agents: Agent[] }>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadBundles() {
      setIsLoading(true)
      setLoadError(null)

      try {
        const response = await fetch('/api/me/orders')
        const payload: BundlesResponse | { error?: string } = await response.json()

        if (!response.ok) {
          throw new Error('error' in payload ? payload.error || 'Unable to load bundles' : 'Unable to load bundles')
        }

        if (isMounted && 'orders' in payload) {
          setOrders(
            payload.orders.map((order) => ({
              ...order,
              agents: order.items.map((item) => item.agent),
            })),
          )
        }
      } catch (error) {
        if (isMounted) {
          setLoadError(error instanceof Error ? error.message : 'Unable to load bundles')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadBundles()

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">My Bundles</h1>
        <p className="text-muted-foreground">
          View and manage your purchased agent bundles.
        </p>
      </div>

      {loadError && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/5 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-red-400" />
            <div>
              <p className="font-medium text-red-400">Unable to load bundles</p>
              <p className="text-sm text-muted-foreground">{loadError}</p>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <BundlesSkeleton />
      ) : orders.length > 0 ? (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card key={order.id} className="hover:border-muted-foreground/30 transition-colors">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                      <Package className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold">
                          Bundle ({order.items.length} Agent{order.items.length > 1 ? 's' : ''})
                        </h3>
                        <Badge variant={order.status === 'paid' ? 'default' : 'secondary'}>
                          {order.status}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span>{formatPrice(order.amountCents, order.currency)}</span>
                        <span>Purchased {formatDate(order.paidAt || order.createdAt)}</span>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {order.items.map((item) => (
                          <Badge key={item.id} variant="outline" className="text-xs">
                            {item.agent.title}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 lg:shrink-0">
                    <div className="flex items-center gap-3">
                      <RiskBadge level={order.bundleRisk.level} size="sm" />
                      {order.channelConfig?.recipientBindingStatus === 'paired' && (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                          <Send className="w-3 h-3" />
                          Telegram Connected
                        </span>
                      )}
                    </div>
                    <Button asChild>
                      <Link href={`/app/bundles/${order.id}`}>
                        Manage
                        <ArrowRight className="w-4 h-4 ml-1" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Package className="w-6 h-6" />
            </EmptyMedia>
            <EmptyTitle>No bundles yet</EmptyTitle>
            <EmptyDescription>Purchase agents to see them here.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link href="/agents">
                <ShoppingCart className="w-4 h-4 mr-2" />
                Browse Agents
              </Link>
            </Button>
          </EmptyContent>
        </Empty>
      )}
    </div>
  )
}

function BundlesSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="rounded-xl border border-border p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <Skeleton className="h-12 w-12 rounded-xl" />
              <div className="space-y-3">
                <div className="flex gap-3">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-4 w-52" />
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-9 w-24" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
