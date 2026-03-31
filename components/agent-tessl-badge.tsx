'use client'

import { BadgeCheck, TriangleAlert } from 'lucide-react'

import type { AgentTesslReview } from '@/lib/types'
import {
  formatTesslScore,
  getTesslValidationClassName,
  getTesslValidationLabel,
} from '@/lib/tessl'
import { cn } from '@/lib/utils'

export function AgentTesslBadge({
  className,
  review,
}: {
  className?: string
  review: AgentTesslReview
}) {
  const Icon = review.validationPassed ? BadgeCheck : TriangleAlert

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium tracking-[0.01em]',
        getTesslValidationClassName(review),
        className,
      )}
      title={`Tessl ${getTesslValidationLabel(review)} • ${formatTesslScore(review.scores.aggregate)}/100`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>Tessl {formatTesslScore(review.scores.aggregate)}</span>
    </span>
  )
}
