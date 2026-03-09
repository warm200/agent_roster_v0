import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RiskBadge } from '@/components/risk-badge'
import { Badge } from '@/components/ui/badge'
import { mockOrders, mockRuns, formatPrice } from '@/lib/mock-data'
import { formatDate } from '@/lib/utils'
import { 
  Package, 
  Play, 
  ArrowRight, 
  CheckCircle2, 
  Clock,
  ShoppingCart
} from 'lucide-react'

export default function DashboardPage() {
  // In real implementation, these would be fetched from API
  const recentOrders = mockOrders.slice(0, 3)
  const recentRuns = mockRuns.slice(0, 3)

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Manage your agents and runs from here.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center">
                <Package className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-bold">{recentOrders.length}</p>
                <p className="text-sm text-muted-foreground">Purchased Bundles</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center">
                <Play className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-bold">{recentRuns.length}</p>
                <p className="text-sm text-muted-foreground">Total Runs</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {recentRuns.filter((r) => r.status === 'completed').length}
                </p>
                <p className="text-sm text-muted-foreground">Completed Runs</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <Clock className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {recentRuns.filter((r) => r.status === 'running').length}
                </p>
                <p className="text-sm text-muted-foreground">Running</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Recent Bundles */}
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
            {recentOrders.length > 0 ? (
              <div className="space-y-4">
                {recentOrders.map((order) => (
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

        {/* Recent Runs */}
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
            {recentRuns.length > 0 ? (
              <div className="space-y-4">
                {recentRuns.map((run) => (
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
