'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/lib/auth-context'
import { getCurrentSubscription, createBillingPortalSession } from '@/services/subscription.api'
import type { SubscriptionPlan, UserSubscription } from '@/lib/types'
import { CreditCard, ExternalLink, Settings } from 'lucide-react'

export default function AccountPage() {
  const { session } = useAuth()
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null)
  const [subscription, setSubscription] = useState<UserSubscription | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [portalLoading, setPortalLoading] = useState(false)

  useEffect(() => {
    let mounted = true

    async function load() {
      try {
        const payload = await getCurrentSubscription()
        if (mounted) {
          setPlan(payload.plan)
          setSubscription(payload.subscription)
        }
      } catch {
        // subscription fetch failed — leave as null
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    void load()
    return () => { mounted = false }
  }, [])

  const userName = session?.user?.name || 'Account'
  const userEmail = session?.user?.email || ''
  const hasStripeSubscription = subscription?.stripeSubscriptionId != null
  const isFree = !subscription || plan?.id === 'free'

  async function handleManageSubscription() {
    setPortalLoading(true)
    try {
      const { portalUrl } = await createBillingPortalSession()
      window.location.href = portalUrl
    } catch {
      setPortalLoading(false)
    }
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Account</h1>
        <p className="text-muted-foreground">
          Manage your profile and subscription.
        </p>
      </div>

      <div className="grid gap-6 max-w-2xl">
        {/* Profile */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Settings className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Profile</h2>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Name</p>
                <p className="text-sm font-medium text-foreground">{userName}</p>
              </div>
              {userEmail && (
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm font-medium text-foreground">{userEmail}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Subscription */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Subscription</h2>
            </div>

            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-10 w-48" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Current plan</p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-sm font-medium text-foreground">{plan?.name ?? 'Free'}</p>
                      <Badge variant="secondary">{plan?.priceLabel ?? '$0'}</Badge>
                    </div>
                  </div>
                </div>

                {subscription && (
                  <div>
                    <p className="text-xs text-muted-foreground">Credits remaining</p>
                    <p className="text-sm font-medium text-foreground mt-1">{subscription.remainingCredits}</p>
                  </div>
                )}

                {hasStripeSubscription ? (
                  <Button
                    onClick={handleManageSubscription}
                    disabled={portalLoading}
                    variant="outline"
                    className="mt-2"
                  >
                    {portalLoading ? 'Redirecting...' : 'Manage Subscription'}
                    <ExternalLink className="ml-2 h-3.5 w-3.5" />
                  </Button>
                ) : isFree ? (
                  <p className="text-xs text-muted-foreground">
                    You are on the Free plan. Purchase a runtime plan from any bundle page to get started.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Your plan was purchased as a one-time payment and does not have recurring billing to manage.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
