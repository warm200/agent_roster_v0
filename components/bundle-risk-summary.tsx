'use client'

import type { BundleRisk } from '@/lib/types'
import { RiskBadge } from './risk-badge'
import { AlertTriangle, Info } from 'lucide-react'

interface BundleRiskSummaryProps {
  bundleRisk: BundleRisk
  className?: string
}

export function BundleRiskSummary({ bundleRisk, className }: BundleRiskSummaryProps) {
  const { level, highestRiskDriver, summary } = bundleRisk

  return (
    <div className={className}>
      <div className="flex items-center gap-3 mb-2">
        <RiskBadge level={level} size="md" />
        {highestRiskDriver && (
          <span className="text-sm text-muted-foreground">
            Driven by: <span className="text-foreground">{highestRiskDriver}</span>
          </span>
        )}
      </div>
      <div className="flex items-start gap-2 text-sm text-muted-foreground">
        {level === 'high' ? (
          <AlertTriangle className="w-4 h-4 mt-0.5 text-red-400 shrink-0" />
        ) : (
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
        )}
        <p>{summary}</p>
      </div>
    </div>
  )
}
