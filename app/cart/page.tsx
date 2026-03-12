'use client'

import Link from 'next/link'
import { Header } from '@/components/header'
import { RiskBadge } from '@/components/risk-badge'
import { BundleRiskSummary } from '@/components/bundle-risk-summary'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useCart } from '@/lib/cart-context'
import { formatPrice } from '@/lib/mock-data'
import { Trash2, ShoppingCart, ArrowRight, Package } from 'lucide-react'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'

export default function CartPage() {
  const { items, bundleRisk, totalCents, removeItem } = useCart()

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-foreground mb-8">Shopping Cart</h1>

        {items.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ShoppingCart className="w-6 h-6" />
              </EmptyMedia>
              <EmptyTitle>Your cart is empty</EmptyTitle>
              <EmptyDescription>
                Browse our agent catalog to find the perfect tools for your workflows.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild>
                <Link href="/agents">Browse Agents</Link>
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              {items.map((item) => (
                <Card key={item.id} className="bg-card">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <Avatar className="h-16 w-16 shrink-0 rounded-xl border border-border/70 bg-secondary">
                        <AvatarImage
                          alt={item.agent.title}
                          className="object-cover object-center"
                          src={item.agent.thumbnailUrl ?? undefined}
                        />
                        <AvatarFallback className="rounded-xl bg-secondary text-foreground">
                          <Package className="h-7 w-7" />
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <Link
                              href={`/agents/${item.agent.slug}`}
                              className="font-semibold text-foreground hover:underline"
                            >
                              {item.agent.title}
                            </Link>
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                              {item.agent.summary}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive shrink-0"
                            onClick={() => removeItem(item.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>

                        <div className="flex items-center justify-between mt-4">
                          <div className="flex items-center gap-3">
                            <RiskBadge
                              level={item.agentVersion.riskProfile.riskLevel}
                              size="sm"
                            />
                            <span className="text-xs text-muted-foreground">
                              v{item.agentVersion.version}
                            </span>
                          </div>
                          <span className="font-semibold">
                            {formatPrice(item.agent.priceCents, item.agent.currency)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <Card className="sticky top-24">
                <CardHeader>
                  <CardTitle>Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    {items.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span className="text-muted-foreground truncate mr-2">
                          {item.agent.title}
                        </span>
                        <span>{formatPrice(item.agent.priceCents, item.agent.currency)}</span>
                      </div>
                    ))}
                  </div>

                  <Separator />

                  <div className="flex justify-between font-semibold">
                    <span>Total</span>
                    <span>{formatPrice(totalCents)}</span>
                  </div>

                  <Separator />

                  <div className="pt-2">
                    <h4 className="text-sm font-medium mb-3">Bundle Risk</h4>
                    <BundleRiskSummary bundleRisk={bundleRisk} />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button className="w-full" size="lg" asChild>
                    <Link href="/checkout">
                      Proceed to Checkout
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
