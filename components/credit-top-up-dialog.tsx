'use client'

import { useState } from 'react'
import { BatteryCharging, Clock3, Coins, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

import { CREDIT_TOP_UP_EXPIRY_DAYS, listCreditTopUpPacks } from '@/lib/credit-topups'
import type { SubscriptionPlanId } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { createCreditTopUpCheckoutSession } from '@/services/subscription.api'

type Props = {
  currentCredits: number
  currentPlanId: SubscriptionPlanId
  onOpenChange: (open: boolean) => void
  open: boolean
  returnPath: string
}

const topUpPacks = listCreditTopUpPacks()

export function CreditTopUpDialog({
  currentCredits,
  currentPlanId,
  onOpenChange,
  open,
  returnPath,
}: Props) {
  const { session } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null)
  const isEligiblePlan = currentPlanId === 'run' || currentPlanId === 'warm_standby'

  const handleChoosePack = async (topUpPackId: string) => {
    setIsLoading(true)
    setSelectedPackId(topUpPackId)

    try {
      const payload = await createCreditTopUpCheckoutSession({
        email: session?.user?.email ?? null,
        returnPath,
        topUpPackId,
      })

      window.location.assign(payload.sessionUrl)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to start credit top-up checkout')
      setIsLoading(false)
      setSelectedPackId(null)
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-4xl border-white/10 bg-[#090909]/96 p-0 text-zinc-100 shadow-[0_40px_120px_-60px_rgba(0,0,0,0.95)] sm:max-w-4xl">
        <div className="rounded-[1.6rem] border border-white/6 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.05),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.025),rgba(255,255,255,0))] p-6 md:p-8">
          <DialogHeader className="items-center text-center">
            <DialogTitle className="text-3xl font-semibold tracking-[-0.03em] text-white">
              Top up runtime credits
            </DialogTitle>
            <DialogDescription className="mt-2 max-w-2xl text-zinc-400">
              Add extra launch and wake credits without changing your runtime plan.
            </DialogDescription>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium tracking-[0.16em] text-emerald-200 uppercase">
              <Coins className="h-3.5 w-3.5" />
              {currentCredits} credits live
            </div>
          </DialogHeader>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {topUpPacks.map((pack) => {
              const isWorking = isLoading && selectedPackId === pack.id

              return (
                <div
                  key={pack.id}
                  className="flex min-h-[18rem] flex-col rounded-[1.35rem] border border-white/10 bg-white/[0.03] px-5 py-5 transition-colors hover:border-white/18 hover:bg-white/[0.045]"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                    <BatteryCharging className="h-5 w-5 text-zinc-100" />
                  </div>
                  <div className="mt-5">
                    <div className="text-2xl font-semibold text-white">{pack.name}</div>
                    <div className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-white">
                      {pack.priceLabel}
                    </div>
                    <p className="mt-4 text-sm leading-6 text-zinc-300">+{pack.credits} credits</p>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">{pack.summary}</p>
                  </div>

                  <div className="mt-5 space-y-2 text-sm text-zinc-400">
                    <div className="flex items-start gap-2">
                      <Sparkles className="mt-0.5 h-4 w-4 text-zinc-500" />
                      <span>Added to your current runtime balance</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Clock3 className="mt-0.5 h-4 w-4 text-zinc-500" />
                      <span>Expires {pack.expiresInDays} days after purchase</span>
                    </div>
                  </div>

                  <div className="mt-auto pt-6">
                    <Button
                      className={cn('w-full rounded-xl')}
                      disabled={!isEligiblePlan || isLoading}
                      onClick={() => void handleChoosePack(pack.id)}
                      variant="secondary"
                    >
                      {isWorking ? 'Redirecting…' : `Buy ${pack.name}`}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm text-zinc-400">
            <p className="font-medium text-zinc-200">Top-up terms</p>
            <p className="mt-2">
              Top-up credits are added to your current balance and expire {CREDIT_TOP_UP_EXPIRY_DAYS} days after purchase.
            </p>
            {!isEligiblePlan ? (
              <p className="mt-2 text-amber-300">
                Credit top-ups are currently available only on Run and Warm Standby.
              </p>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
