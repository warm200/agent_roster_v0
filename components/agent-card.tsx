'use client'

import Link from 'next/link'
import type { Agent } from '@/lib/types'
import { formatPrice } from '@/lib/mock-data'
import { RiskBadge } from './risk-badge'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { MessageSquare, ShoppingCart, Mail, Calendar, FileText, Zap, BarChart3, Sparkles } from 'lucide-react'

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

  return (
    <div className="group h-[25rem] [perspective:1400px]">
      <div className="relative h-full transition-transform duration-700 [transform-style:preserve-3d] max-md:[transform:rotateY(180deg)] md:group-hover:[transform:rotateY(180deg)] md:group-focus-within:[transform:rotateY(180deg)]">
        <div className="absolute inset-0 overflow-hidden rounded-[1.75rem] border border-border/70 bg-card shadow-[0_20px_60px_-28px_rgba(0,0,0,0.65)] [backface-visibility:hidden]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.14),transparent_42%),linear-gradient(160deg,rgba(255,255,255,0.03),transparent_60%)]" />
          <div className="absolute inset-x-4 top-4 flex items-center justify-between">
            <Badge variant="secondary" className="border border-border/60 bg-background/70 backdrop-blur">
              {categoryLabels[agent.category]}
            </Badge>
            <div className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/70 px-2.5 py-1 text-[11px] text-muted-foreground backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              Flip for specs
            </div>
          </div>

          <div className="relative h-full px-4 pb-28 pt-14">
            <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_25%,rgba(0,0,0,0.58)_100%)]" />
            <Avatar className="relative h-full w-full rounded-none border border-border/80 bg-secondary/80 shadow-[0_18px_50px_-24px_rgba(0,0,0,0.85)]">
              <AvatarImage alt={agent.title} className="h-full w-full object-cover object-center" src={agent.thumbnailUrl ?? undefined} />
              <AvatarFallback className="rounded-none bg-secondary text-foreground">
                <CategoryIcon className="h-20 w-20" />
              </AvatarFallback>
            </Avatar>
          </div>

          <div className="absolute inset-x-4 bottom-4 rounded-[1.4rem] border border-border/70 bg-background/88 p-4 backdrop-blur-xl">
            <Link href={`/agents/${agent.slug}`} className="block">
              <h3 className="text-lg font-semibold text-foreground transition-colors group-hover:text-primary">
                {agent.title}
              </h3>
            </Link>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatPrice(agent.priceCents, agent.currency)}
            </p>
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
                <h3 className="text-lg font-semibold text-foreground">{agent.title}</h3>
              </div>
              <RiskBadge level={agent.currentVersion.riskProfile.riskLevel} size="sm" />
            </div>

            <p className="line-clamp-4 text-sm leading-6 text-muted-foreground">{agent.summary}</p>

            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl border border-border/70 bg-background/70 p-3">
                <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Version</div>
                <div className="mt-1 font-medium text-foreground">v{agent.currentVersion.version}</div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/70 p-3">
                <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Price</div>
                <div className="mt-1 font-medium text-foreground">
                  {formatPrice(agent.priceCents, agent.currency)}
                </div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/70 p-3">
                <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">File Access</div>
                <div className="mt-1 font-medium text-foreground">
                  {agent.currentVersion.riskProfile.readFiles ? 'Reads files' : 'No file reads'}
                </div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/70 p-3">
                <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Network</div>
                <div className="mt-1 font-medium text-foreground">
                  {agent.currentVersion.riskProfile.network ? 'Enabled' : 'Disabled'}
                </div>
              </div>
            </div>

            <div className="mt-auto flex gap-2 pt-5">
              <Button variant="outline" size="sm" className="flex-1 bg-background/70" asChild>
                <Link href={`/agents/${agent.slug}`}>
                  <MessageSquare className="mr-1.5 h-4 w-4" />
                  Preview
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
