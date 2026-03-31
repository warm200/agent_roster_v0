'use client'

import Link from 'next/link'
import { ExternalLink, Shield, Sparkles } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { AgentTesslReview } from '@/lib/types'
import {
  formatTesslScore,
  getTesslRegistryUrl,
  getTesslSecurityClassName,
  getTesslSummary,
  getTesslValidationClassName,
  getTesslValidationLabel,
} from '@/lib/tessl'
import { cn, formatDate } from '@/lib/utils'

function Metric({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-secondary/20 p-4">
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  )
}

export function AgentTesslPanel({ review }: { review: AgentTesslReview }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5" />
          Tessl Review
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-center gap-3 border-b border-border pb-4">
          <span
            className={cn(
              'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium',
              getTesslValidationClassName(review),
            )}
          >
            {getTesslValidationLabel(review)}
          </span>
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
              getTesslSecurityClassName(review.scores.security),
            )}
          >
            <Shield className="h-3.5 w-3.5" />
            <span>{review.scores.security} security</span>
          </span>
        </div>

        <p className="text-sm leading-6 text-muted-foreground">{getTesslSummary(review)}</p>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Overall" value={formatTesslScore(review.scores.aggregate)} />
          <Metric label="Quality" value={formatTesslScore(review.scores.quality)} />
          <Metric label="Impact" value={formatTesslScore(review.scores.impact)} />
          <Metric label="Eval Avg" value={formatTesslScore(review.scores.evalAvg)} />
        </div>

        <div className="rounded-xl border border-border/70 bg-secondary/20 p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">{review.title}</p>
          {review.description ? <p className="mt-2 leading-6">{review.description}</p> : null}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
            <span>Last scored {review.scores.lastScoredAt ? formatDate(review.scores.lastScoredAt) : 'Unknown'}</span>
            <span>Registry updated {formatDate(review.updatedAt)}</span>
            <Link
              className="inline-flex items-center gap-1 text-foreground hover:text-primary"
              href={getTesslRegistryUrl(review)}
              rel="noreferrer"
              target="_blank"
            >
              View Tessl source
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
