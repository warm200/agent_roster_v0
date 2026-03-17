'use client'

import { useEffect, useState } from 'react'
import { Check, CreditCard, Flame, Play, Snowflake, TimerReset } from 'lucide-react'
import { toast } from 'sonner'

import type { SubscriptionPlanId } from '@/lib/types'
import { cn } from '@/lib/utils'
import {
  createSubscriptionCheckoutSession,
  listPricingPlans,
} from '@/services/subscription.api'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type Props = {
  currentPlanId: SubscriptionPlanId
  currentCredits: number
  onOpenChange: (open: boolean) => void
  open: boolean
  returnPath: string
}

const planIconMap = {
  always_on: Flame,
  free: Snowflake,
  run: Play,
  warm_standby: TimerReset,
} as const

function getPlanSupportNote(
  plan: Awaited<ReturnType<typeof listPricingPlans>>['plans'][number],
) {
  switch (plan.id) {
    case 'run':
      return 'Includes 15 runtime credits.'
    case 'warm_standby':
      return 'Includes 10 runtime credits per month.'
    case 'always_on':
      return 'Persistent managed runtime.'
    default:
      return 'No managed runtime.'
  }
}

export function PlanUpgradeDialog({
  currentPlanId,
  currentCredits,
  onOpenChange,
  open,
  returnPath,
}: Props) {
  const { session } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [plans, setPlans] = useState<Awaited<ReturnType<typeof listPricingPlans>>['plans']>([])
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadPlans() {
      try {
        const payload = await listPricingPlans()

        if (isMounted) {
          setPlans(payload.plans)
        }
      } catch (error) {
        if (isMounted) {
          toast.error(error instanceof Error ? error.message : 'Unable to load runtime plans')
        }
      }
    }

    if (open && plans.length === 0) {
      void loadPlans()
    }

    return () => {
      isMounted = false
    }
  }, [open, plans.length])

  const handleChoosePlan = async (planId: string) => {
    setSelectedPlanId(planId)
    setIsLoading(true)

    try {
      const payload = await createSubscriptionCheckoutSession({
        email: session?.user?.email ?? null,
        planId,
        returnPath,
      })

      window.location.assign(payload.sessionUrl)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to start plan checkout')
      setIsLoading(false)
      setSelectedPlanId(null)
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-6xl border-white/10 bg-[#090909]/96 p-0 text-zinc-100 shadow-[0_40px_120px_-60px_rgba(0,0,0,0.95)] sm:max-w-6xl">
        <div className="rounded-[1.6rem] border border-white/6 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.05),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.025),rgba(255,255,255,0))] p-6 md:p-8">
          <DialogHeader className="items-center text-center">
            <DialogTitle className="text-3xl font-semibold tracking-[-0.03em] text-white">
              Adjust your plan
            </DialogTitle>
            <DialogDescription className="mt-2 text-zinc-400">
              Current plan: <span className="text-zinc-200">{plans.find((plan) => plan.id === currentPlanId)?.name ?? 'Free'}</span>
            </DialogDescription>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium tracking-[0.16em] text-emerald-200 uppercase">
              <CreditCard className="h-3.5 w-3.5" />
              {currentCredits} credits live
            </div>
          </DialogHeader>

          <div className="mt-8 grid gap-4 xl:grid-cols-4">
            {plans.map((plan) => {
              const Icon = planIconMap[plan.id]
              const isCurrent = plan.id === currentPlanId
              const isPaid = plan.id !== 'free'
              const isWorking = isLoading && selectedPlanId === plan.id

              return (
                <div
                  key={plan.id}
                  className={cn(
                    'flex min-h-[26rem] flex-col rounded-[1.35rem] border px-5 py-5 transition-colors',
                    isCurrent
                      ? 'border-white/20 bg-white/[0.08]'
                      : 'border-white/10 bg-white/[0.03] hover:border-white/18 hover:bg-white/[0.045]',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                      <Icon className="h-5 w-5 text-zinc-100" />
                    </div>
                    {isCurrent ? (
                      <span className="rounded-full border border-white/14 bg-white/[0.07] px-2 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-300">
                        Current plan
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-5">
                    <div className="text-2xl font-semibold text-white">{plan.name}</div>
                    <div className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-white">
                      {plan.priceLabel}
                    </div>
                    <p className="mt-4 text-sm leading-6 text-zinc-400">{plan.suitFor}</p>
                    <p className="mt-2 text-xs leading-5 text-zinc-500">{getPlanSupportNote(plan)}</p>
                  </div>

                  <div className="mt-5 space-y-2 text-sm text-zinc-300">
                    <div>{plan.agentsPerBundle} agents per launched bundle</div>
                    <div>
                      {plan.triggerMode === 'manual'
                        ? 'Manual only'
                        : plan.triggerMode === 'auto_wake'
                          ? 'Wake on Telegram'
                          : plan.triggerMode === 'always_active'
                            ? 'Persistent workspace'
                            : 'No runtime'}
                    </div>
                    <div>
                      {plan.id === 'run'
                        ? 'Manual bounded session'
                        : plan.id === 'warm_standby'
                          ? 'Auto-sleeps when idle'
                          : plan.id === 'always_on'
                            ? 'Long-running workspace support'
                            : 'Browse and preview only'}
                    </div>
                  </div>

                  <div className="mt-5 space-y-2 text-sm text-zinc-400">
                    {plan.planIncludes.map((item) => (
                      <div key={item} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 text-zinc-500" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-auto pt-6">
                    <Button
                      className={cn(
                        'w-full rounded-xl',
                        isCurrent
                          ? 'cursor-default border-white/10 bg-white/[0.05] text-zinc-500 hover:bg-white/[0.05]'
                          : '',
                      )}
                      disabled={isCurrent || !isPaid || isLoading}
                      onClick={() => {
                        if (!isCurrent && isPaid) {
                          void handleChoosePlan(plan.id)
                        }
                      }}
                      variant={isCurrent ? 'outline' : 'secondary'}
                    >
                      {isWorking ? 'Redirecting…' : isCurrent ? 'Your current plan' : 'Choose plan'}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
