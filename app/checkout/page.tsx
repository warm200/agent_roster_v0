'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/header'
import { RiskBadge } from '@/components/risk-badge'
import { BundleRiskSummary } from '@/components/bundle-risk-summary'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { useCart } from '@/lib/cart-context'
import { formatPrice } from '@/lib/mock-data'
import { 
  ChevronLeft, 
  CreditCard, 
  ShieldCheck,
  Send,
  Play,
  Download
} from 'lucide-react'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { toast } from 'sonner'

export default function CheckoutPage() {
  const router = useRouter()
  const { items, bundleRisk, totalCents, clearCart } = useCart()
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [acceptedRisk, setAcceptedRisk] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const canCheckout = acceptedTerms && acceptedRisk && items.length > 0

  const handleCheckout = async () => {
    if (!canCheckout) return

    setIsProcessing(true)
    
    // Simulate payment processing
    await new Promise((resolve) => setTimeout(resolve, 2000))
    
    // In real implementation, this would create a Stripe session
    // For now, we'll simulate a successful purchase
    clearCart()
    toast.success('Purchase successful! Redirecting to your bundle...')
    
    // Redirect to the purchased bundle page
    router.push('/app/bundles/order-demo')
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CreditCard className="w-6 h-6" />
              </EmptyMedia>
              <EmptyTitle>Nothing to checkout</EmptyTitle>
              <EmptyDescription>
                Your cart is empty. Add some agents before checking out.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild>
                <Link href="/agents">Browse Agents</Link>
              </Button>
            </EmptyContent>
          </Empty>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-8">
        <Link
          href="/cart"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Cart
        </Link>

        <h1 className="text-3xl font-bold text-foreground mb-8">Checkout</h1>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Order Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Items */}
            <Card>
              <CardHeader>
                <CardTitle>Order Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {items.map((item, index) => (
                    <div key={item.id}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="font-medium">{item.agent.title}</span>
                          <RiskBadge 
                            level={item.agentVersion.riskProfile.riskLevel}
                            size="sm"
                            showLabel={false}
                          />
                        </div>
                        <span>{formatPrice(item.agent.priceCents, item.agent.currency)}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        v{item.agentVersion.version}
                      </p>
                      {index < items.length - 1 && <Separator className="mt-4" />}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Risk Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5" />
                  Bundle Risk Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <BundleRiskSummary bundleRisk={bundleRisk} />
              </CardContent>
            </Card>

            {/* Post-Purchase Info */}
            <Card>
              <CardHeader>
                <CardTitle>After Purchase</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  After your purchase is complete, you will be redirected to your bundle detail page where you can:
                </p>
                <ul className="space-y-3">
                  <li className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                      <Send className="w-4 h-4" />
                    </div>
                    <span>Connect your Telegram bot for notifications</span>
                  </li>
                  <li className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                      <Play className="w-4 h-4" />
                    </div>
                    <span>Launch runs with your purchased agents</span>
                  </li>
                  <li className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                      <Download className="w-4 h-4" />
                    </div>
                    <span>Download install packages for local setup</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Terms */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-start gap-3">
                  <Checkbox 
                    id="terms" 
                    checked={acceptedTerms}
                    onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                  />
                  <Label htmlFor="terms" className="text-sm leading-relaxed cursor-pointer">
                    I agree to the Terms of Service and Privacy Policy. I understand that purchases are non-refundable.
                  </Label>
                </div>
                <div className="flex items-start gap-3">
                  <Checkbox 
                    id="risk" 
                    checked={acceptedRisk}
                    onCheckedChange={(checked) => setAcceptedRisk(checked === true)}
                  />
                  <Label htmlFor="risk" className="text-sm leading-relaxed cursor-pointer">
                    I have reviewed the risk profile for this bundle and understand the capabilities and permissions required by the included agents.
                  </Label>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Payment Summary */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle>Payment Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal ({items.length} items)</span>
                    <span>{formatPrice(totalCents)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax</span>
                    <span>$0.00</span>
                  </div>
                </div>

                <Separator />

                <div className="flex justify-between font-semibold text-lg">
                  <span>Total</span>
                  <span>{formatPrice(totalCents)}</span>
                </div>
              </CardContent>
              <CardFooter className="flex-col gap-4">
                <Button 
                  className="w-full" 
                  size="lg"
                  disabled={!canCheckout || isProcessing}
                  onClick={handleCheckout}
                >
                  {isProcessing ? (
                    <>
                      <Spinner className="w-4 h-4 mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4 mr-2" />
                      Pay {formatPrice(totalCents)}
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Secure payment powered by Stripe
                </p>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
