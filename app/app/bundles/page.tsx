import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RiskBadge } from '@/components/risk-badge'
import { Badge } from '@/components/ui/badge'
import { Empty } from '@/components/ui/empty'
import { mockOrders, formatPrice } from '@/lib/mock-data'
import { formatDate } from '@/lib/utils'
import { Package, ArrowRight, ShoppingCart, CheckCircle2, Send } from 'lucide-react'

export default function BundlesPage() {
  const orders = mockOrders

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">My Bundles</h1>
        <p className="text-muted-foreground">
          View and manage your purchased agent bundles.
        </p>
      </div>

      {orders.length > 0 ? (
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
        <Empty
          icon={Package}
          title="No bundles yet"
          description="Purchase agents to see them here."
        >
          <Button asChild>
            <Link href="/agents">
              <ShoppingCart className="w-4 h-4 mr-2" />
              Browse Agents
            </Link>
          </Button>
        </Empty>
      )}
    </div>
  )
}
