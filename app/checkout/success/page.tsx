'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { CheckCircle2, ArrowRight, Bot, MessageCircle } from 'lucide-react'
import { useCart } from '@/lib/cart-context'
import { reconcileCheckoutSession } from '@/services/checkout.api'

export default function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string; session_id?: string }>
}) {
  const params = use(searchParams)
  const router = useRouter()
  const { clearCart } = useCart()
  const [orderId, setOrderId] = useState<string | null>(params.orderId ?? null)
  const [isLoading, setIsLoading] = useState(!params.orderId && Boolean(params.session_id))
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    clearCart()
  }, [clearCart])

  useEffect(() => {
    let isMounted = true

    async function resolveOrderId() {
      if (params.orderId) {
        setOrderId(params.orderId)
        setIsLoading(false)
        return
      }

      if (!params.session_id) {
        router.push('/')
        return
      }

      try {
        const payload = await reconcileCheckoutSession(params.session_id)
        if (isMounted) {
          setOrderId(payload.id)
        }
      } catch (error) {
        if (isMounted) {
          setLoadError(error instanceof Error ? error.message : 'Unable to complete checkout')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void resolveOrderId()

    return () => {
      isMounted = false
    }
  }, [params.orderId, params.session_id, router])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-lg w-full bg-card border-border">
          <CardContent className="pt-8 pb-6 text-center">
            <Spinner className="mx-auto mb-6 h-8 w-8" />
            <h1 className="text-2xl font-semibold mb-2">Finalizing Purchase</h1>
            <p className="text-muted-foreground">
              Confirming your checkout session and preparing your bundle.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!orderId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-lg w-full bg-card border-border">
          <CardContent className="pt-8 pb-6 text-center">
            <h1 className="text-2xl font-semibold mb-2">Checkout Incomplete</h1>
            <p className="text-muted-foreground mb-6">
              {loadError ?? 'We could not confirm your order yet.'}
            </p>
            <Link href="/checkout" className="block">
              <Button className="w-full">Return to Checkout</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-lg w-full bg-card border-border">
        <CardContent className="pt-8 pb-6 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-6">
            <CheckCircle2 className="h-8 w-8 text-emerald-400" />
          </div>

          <h1 className="text-2xl font-semibold mb-2">Purchase Complete</h1>
          <p className="text-muted-foreground mb-6">
            Your agents are ready to be configured and deployed.
          </p>

          <div className="bg-muted/50 rounded-lg p-4 mb-6 text-left">
            <div className="text-xs text-muted-foreground mb-1">Order ID</div>
            <code className="text-sm font-mono">{orderId}</code>
          </div>

          <div className="space-y-3">
            <Link href={`/app/bundles/${orderId}`} className="block">
              <Button className="w-full gap-2">
                <MessageCircle className="h-4 w-4" />
                Set Up Telegram
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>

            <Link href="/app" className="block">
              <Button variant="outline" className="w-full gap-2">
                <Bot className="h-4 w-4" />
                Go to Dashboard
              </Button>
            </Link>
          </div>

          <p className="text-xs text-muted-foreground mt-6">
            A confirmation email has been sent to your inbox.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
