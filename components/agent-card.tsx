'use client'

import Link from 'next/link'
import type { Agent } from '@/lib/types'
import { formatPrice } from '@/lib/mock-data'
import { RiskBadge } from './risk-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { MessageSquare, ShoppingCart, Mail, Calendar, FileText, Zap, BarChart3 } from 'lucide-react'

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
    <Card className="group relative bg-card border-border hover:border-muted-foreground/30 transition-colors">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Avatar className="h-10 w-10 rounded-lg border border-border bg-secondary">
              <AvatarImage alt={agent.title} src={agent.thumbnailUrl ?? undefined} />
              <AvatarFallback className="rounded-lg bg-secondary text-foreground">
                <CategoryIcon className="w-5 h-5" />
              </AvatarFallback>
            </Avatar>
            <div>
              <Badge variant="secondary" className="text-xs mb-1">
                {categoryLabels[agent.category]}
              </Badge>
            </div>
          </div>
          <RiskBadge level={agent.currentVersion.riskProfile.riskLevel} size="sm" />
        </div>

        <Link href={`/agents/${agent.slug}`} className="block group-hover:underline">
          <h3 className="font-semibold text-lg text-foreground mb-2">{agent.title}</h3>
        </Link>

        <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{agent.summary}</p>

        <div className="flex items-center justify-between">
          <span className="text-lg font-semibold text-foreground">
            {formatPrice(agent.priceCents, agent.currency)}
          </span>
          <span className="text-xs text-muted-foreground">v{agent.currentVersion.version}</span>
        </div>
      </CardContent>

      <CardFooter className="p-5 pt-0 flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" asChild>
          <Link href={`/agents/${agent.slug}`}>
            <MessageSquare className="w-4 h-4 mr-1.5" />
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
          <ShoppingCart className="w-4 h-4 mr-1.5" />
          {isInCart ? 'In Cart' : 'Add'}
        </Button>
      </CardFooter>
    </Card>
  )
}
