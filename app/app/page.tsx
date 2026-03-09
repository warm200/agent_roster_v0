'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RiskBadge } from '@/components/risk-badge'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { RunStatusBadge } from '@/components/run-status-badge'
import { formatPrice } from '@/lib/mock-data'
import { formatDate } from '@/lib/utils'
import type { Agent, Order, Run, RunLog } from '@/lib/types'
import { listOrders } from '@/services/orders.api'
import { listRuns, type RunSummary } from '@/services/runs.api'
import {
  Package,
  Play,
  ArrowRight,
  CheckCircle2,
  Clock,
  ShoppingCart,
  AlertTriangle,
} from 'lucide-react'

export default function DashboardPage() {
  const [orders, setOrders] = useState<Array<Order & { agents: Agent[] }>>([])
  const [runs, setRuns] = useState<RunSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadDashboard() {
      setIsLoading(true)
      setLoadError(null)

      try {
        const [bundlesPayload, runsPayload] = await Promise.all([
          listOrders(),
          listRuns(),
        ])

        if (isMounted) {
          setOrders(bundlesPayload.orders.map((order) => ({
            ...order,
            agents: order.items.map((item) => item.agent),
          })))
          setRuns(runsPayload.runs)
        }
      } catch (error) {
        if (isMounted) {
          setLoadError(error instanceof Error ? error.message : 'Unable to load dashboard')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadDashboard()

    return () => {
      isMounted = false
    }
  }, [])

  const stats = useMemo(
    () => ({
      completedRuns: runs.filter((run) => run.status === 'completed').length,
      purchasedBundles: orders.length,
      runningRuns: runs.filter((run) => run.status === 'running').length,
      totalRuns: runs.length,
    }),
    [orders, runs]
  )

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Manage your agents and runs from here.
        </p>
      </div>

      {loadError && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/5 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-red-400" />
            <div>
              <p className="font-medium text-red-400">Unable to load dashboard</p>
              <p className="text-sm text-muted-foreground">{loadError}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<Package className="w-6 h-6" />}
          label="Purchased Bundles"
          tone="bg-secondary"
          value={stats.purchasedBundles}
        />
        <StatCard
          icon={<Play className="w-6 h-6" />}
          label="Total Runs"
          tone="bg-secondary"
          value={stats.totalRuns}
        />
        <StatCard
          icon={<CheckCircle2 className="w-6 h-6 text-emerald-400" />}
          label="Completed Runs"
          tone="bg-emerald-500/20"
          value={stats.completedRuns}
        />
        <StatCard
          icon={<Clock className="w-6 h-6 text-amber-400" />}
          label="Running"
          tone="bg-amber-500/20"
          value={stats.runningRuns}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Bundles</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/app/bundles">
                View All
                <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <DashboardListSkeleton />
            ) : orders.length > 0 ? (
              <div className="space-y-4">
                {orders.slice(0, 3).map((order) => (
                  <Link
                    key={order.id}
                    href={`/app/bundles/${order.id}`}
                    className="flex items-center justify-between p-4 bg-secondary rounded-lg hover:bg-secondary/80 transition-colors"
                  >
                    <div>
                      <p className="font-medium">
                        {order.items.length} Agent{order.items.length > 1 ? 's' : ''}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatPrice(order.amountCents, order.currency)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <RiskBadge level={order.bundleRisk.level} size="sm" showLabel={false} />
                      <Badge variant={order.status === 'paid' ? 'default' : 'secondary'}>
                        {order.status}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground mb-4">No bundles yet</p>
                <Button asChild>
                  <Link href="/agents">
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Browse Agents
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Runs</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/app/runs">
                View All
                <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <DashboardListSkeleton />
            ) : runs.length > 0 ? (
              <div className="space-y-4">
                {runs.slice(0, 3).map((run) => (
                  <Link
                    key={run.id}
                    href={`/app/runs/${run.id}`}
                    className="flex items-center justify-between p-4 bg-secondary rounded-lg hover:bg-secondary/80 transition-colors"
                  >
                    <div>
                      <p className="font-medium">Run {run.id.slice(-4)}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(run.createdAt)}
                      </p>
                    </div>
                    <RunStatusBadge status={run.status} />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">No runs yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatCard({
  icon,
  label,
  tone,
  value,
}: {
  icon: ReactNode
  label: string
  tone: string
  value: number
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${tone}`}>
            {icon}
          </div>
          <div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-sm text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function DashboardListSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="flex items-center justify-between rounded-lg bg-secondary p-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
      ))}
    </div>
  )
}
