'use client'

import { AGENT_RISK_BADGE_CONFIG } from '@/lib/agent-risk'
import type { AgentRiskReviewLevel } from '@/lib/types'
import { cn } from '@/lib/utils'

export function AgentRiskBadge({
  className,
  level,
  showIcon = true,
}: {
  className?: string
  level: AgentRiskReviewLevel
  showIcon?: boolean
}) {
  const config = AGENT_RISK_BADGE_CONFIG[level]
  const Icon = config.icon

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium tracking-[0.01em]',
        config.className,
        className,
      )}
    >
      {showIcon ? <Icon className="h-3.5 w-3.5" /> : null}
      <span>{config.label}</span>
    </span>
  )
}
