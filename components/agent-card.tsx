'use client'

import Link from 'next/link'
import type { Agent } from '@/lib/types'
import { getAgentCapabilityChips, getAgentDisplayName, getAgentRiskLevel, getAgentSummary } from '@/lib/agent-risk'
import { formatPrice } from '@/lib/mock-data'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { AgentRiskBadge } from './agent-risk-badge'
import { ArrowUpRight, ShoppingCart, Mail, Calendar, FileText, Zap, BarChart3, Sparkles } from 'lucide-react'

interface AgentCardProps {
  agent: Agent
  onAddToCart?: (agent: Agent) => void
  isInCart?: boolean
}

const categoryIcons = {
  inbox: Mail,
  calendar: Calendar,
  docs: FileText,
  automation: Zap,
  analytics: BarChart3,
}

const categoryLabels = {
  inbox: 'Inbox',
  calendar: 'Calendar',
  docs: 'Documents',
  automation: 'Automation',
  analytics: 'Analytics',
}

export function AgentCard({ agent, onAddToCart, isInCart = false }: AgentCardProps) {
  const CategoryIcon = categoryIcons[agent.category]
  const chips = getAgentCapabilityChips(agent)
  const riskLevel = getAgentRiskLevel(agent)

  return (
    <div className="group h-[25rem] [perspective:1400px]">
      <div className="relative h-full transition-transform duration-700 [transform-style:preserve-3d] md:group-hover:[transform:rotateY(180deg)] md:group-focus-within:[transform:rotateY(180deg)]">
        <div className="absolute inset-0 overflow-hidden rounded-[1.75rem] border border-border/70 bg-card shadow-[0_20px_60px_-28px_rgba(0,0,0,0.65)] [backface-visibility:hidden]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.14),transparent_42%),linear-gradient(160deg,rgba(255,255,255,0.03),transparent_60%)]" />
          <div className="relative h-full px-3 pb-24 pt-3">
            <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_25%,rgba(0,0,0,0.58)_100%)]" />
            <Link
              aria-label={`Open ${getAgentDisplayName(agent)} details`}
              className="relative block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              href={`/agents/${agent.slug}`}
            >
              <Avatar className="relative h-full w-full rounded-none border border-border/80 bg-secondary/80 shadow-[0_18px_50px_-24px_rgba(0,0,0,0.85)]">
                <AvatarImage alt={getAgentDisplayName(agent)} className="h-full w-full object-cover object-center transition-transform duration-500 md:group-hover:scale-[1.02]" src={agent.thumbnailUrl ?? undefined} />
                <AvatarFallback className="rounded-none bg-secondary text-foreground">
                  <CategoryIcon className="h-20 w-20" />
                </AvatarFallback>
              </Avatar>
            </Link>
            <div className="absolute inset-x-4 top-4 flex items-start justify-between gap-3">
              <Badge variant="secondary" className="border border-white/15 bg-background/72 text-foreground shadow-sm backdrop-blur-md">
                {categoryLabels[agent.category]}
              </Badge>
              <div className="hidden items-center gap-1 rounded-full border border-white/15 bg-background/72 px-2.5 py-1 text-[11px] text-muted-foreground shadow-sm backdrop-blur-md md:inline-flex">
                <Sparkles className="h-3.5 w-3.5" />
                Flip for review
              </div>
            </div>
          </div>

          <div className="absolute inset-x-4 bottom-4 rounded-[1.4rem] border border-border/70 bg-background/88 p-4 backdrop-blur-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/agents/${agent.slug}`} className="block">
                  <h3 className="text-lg font-semibold text-foreground transition-colors group-hover:text-primary">
                    {getAgentDisplayName(agent)}
                  </h3>
                </Link>
                <p className="mt-1 text-sm text-muted-foreground">{formatPrice(agent.priceCents, agent.currency)}</p>
              </div>
              <AgentRiskBadge className="shrink-0" level={riskLevel} />
            </div>
          </div>
        </div>

        <div className="absolute inset-0 overflow-hidden rounded-[1.75rem] border border-border/70 bg-card shadow-[0_20px_60px_-28px_rgba(0,0,0,0.65)] [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_40%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_55%)]" />
          <div className="relative flex h-full flex-col p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <Badge variant="secondary" className="mb-2 border border-border/60 bg-background/70">
                  {categoryLabels[agent.category]}
                </Badge>
                <h3 className="text-lg font-semibold text-foreground">{getAgentDisplayName(agent)}</h3>
              </div>
              <AgentRiskBadge level={riskLevel} />
            </div>

            <p className="line-clamp-4 text-sm leading-6 text-muted-foreground">{getAgentSummary(agent)}</p>

            {chips.length > 0 ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {chips.map((chip) => (
                  <span
                    key={chip.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-[11px] text-slate-200"
                  >
                    <chip.icon className="h-3.5 w-3.5 text-slate-400" />
                    <span>{chip.label}</span>
                  </span>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-border/70 bg-background/40 p-3 text-sm text-muted-foreground">
                No high-confidence risky behavior detected.
              </div>
            )}

            <div className="mt-auto flex gap-2 pt-5">
              <Button variant="outline" size="sm" className="flex-1 bg-background/70" asChild>
                <Link href={`/agents/${agent.slug}`}>
                  <ArrowUpRight className="mr-1.5 h-4 w-4" />
                  Review details
                </Link>
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={() => onAddToCart?.(agent)}
                disabled={isInCart}
                variant={isInCart ? 'secondary' : 'default'}
              >
                <ShoppingCart className="mr-1.5 h-4 w-4" />
                {isInCart ? 'In Cart' : 'Add'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
